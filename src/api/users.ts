import { GetItemCommand, UpdateItemCommand, PutItemCommand, ScanCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { dbclient } from "../db";
import { google } from "../creds";
import { OAuth2Client } from 'google-auth-library';
import { nanoid } from 'nanoid';

const google_client_id = google().client_id;
const google_client = new OAuth2Client(google_client_id);


interface User {
    id: string;
    token: string;
    username: string;
    email: string;
    elo: number;
    games: {id: string, color: string, result: string}[];
    blurb: string;
};

const db2user = (item: {[key: string]: AttributeValue}, token?: string): User => {
    if (item.id.S === undefined || item.username.S === undefined || item.email.S === undefined ||
        item.elo.N === undefined || item.games.L === undefined || item.blurb.S === undefined)
            throw new Error("Invalid user");

    if (token === undefined && item.token.S === undefined)
        throw new Error("Invalid user: No token provided");

    return {
        id: item.id.S,
        username: item.username.S,
        email: item.email.S,
        elo: parseInt(item.elo.N),
        games: item.games.L.map((v: AttributeValue, index: number, array: AttributeValue[]) => {
            const g = v.M!;
            return {
                id: g.id.S!,
                color: g.color.S!,
                result: g.result.S!,
            }
        }),
        blurb: item.blurb.S,
        token: token || item.token.S!
    }
}

export const login = async (token: string) => {
    if (!token)
        throw new Error('No token');

    const ticket = await google_client.verifyIdToken({
        idToken: token,
        audience: google_client_id
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.at_hash)
        throw new Error('No ticket payload');

    const email = payload.email;
    const res = await dbclient.send(new GetItemCommand({
        TableName: "users",
        Key: {
            "email": {S: email}
        }
    }));

    if (res.Item === undefined)
        return { token: '' }; // no user found

    await dbclient.send(new UpdateItemCommand({
        TableName: "users",
        Key: {
            "email": {S: email}
        },
        UpdateExpression: "set #token=:token",
        ExpressionAttributeValues: {
            ":token": {S: payload.at_hash},
        },
        ExpressionAttributeNames: {
            "#token": "token",
        },
    }));

    return db2user(res.Item, payload.at_hash);
}

export const getUser = async (email: string, token: string) => {
    if (!email || !token)
        throw new Error('No email or token');

    const res = await dbclient.send(new GetItemCommand({
        TableName: "users",
        Key: {
            "email": {S: email}
        }
    }));

    if (res.Item === undefined)
        throw new Error('No user');

    if (res.Item.token.S !== token)
        return { token: '' };

    return db2user(res.Item);
}

export const createUser = async (token: string, username: string) => {
    if (!token)
        throw new Error('No token');

    if (username.length < 3 || username.length > 20)
        return { error: 'Invalid username' };

    if (!/^\w+$/.test(username))
        return { error: 'Invalid username' };

    const ticket = await google_client.verifyIdToken({
        idToken: token,
        audience: google_client_id
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.at_hash)
        throw new Error('No ticket payload');

    const res = await dbclient.send(new GetItemCommand({
        TableName: "users",
        Key: {
            "email": {S: payload.email}
        }
    }));

    if (res.Item !== undefined)
        return { error: 'User already exists' };

    const results = await dbclient.send(new ScanCommand({
        TableName: "users",
        FilterExpression: "username = :username",
        ExpressionAttributeValues: {
            ":username": {S: username}
        }
    }));

    if (results.Count !== 0)
        return { error: 'Username already exists' };

    const item = {
        "email": {S: payload.email},
        "id": {S: nanoid()},
        "username": {S: username},
        "elo": {N: "1000"},
        "games": {L: []},
        "blurb": {S: ""},
        "token": {S: payload.at_hash},
    }

    await dbclient.send(new PutItemCommand({
        TableName: "users",
        Item: item,
    }));

    return db2user(item);
}

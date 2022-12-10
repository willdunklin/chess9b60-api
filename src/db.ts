import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import slugify from 'slugify';
import { creds } from "./creds";

export const dbclient = new DynamoDBClient({ region: 'us-east-2', credentials: creds() });

export async function getGame(client: DynamoDBClient, table: string, id: string) {
    id = slugify(id)

    if (id.length !== 6)
        throw Error("invalid id formatting")

    // console.log(id, table)
    const results = await client.send(new GetItemCommand({
        TableName: table,
        Key: {
            "id": {S: id}
        }
    }));
    if(!results)
        return undefined;
    return results.Item ? results.Item : undefined;
}

export async function updatePlayer(client: DynamoDBClient, table: string, id: string, token: string, isBlack: boolean) {
    const game = await getGame(client, table, id);

    // get the current player if it exists
    const player = isBlack ? game?.player_tokens?.M?.b?.S : game?.player_tokens?.M?.w?.S;
    if (player)
        return player; // if the player is already taken, return the player

    await client.send(new UpdateItemCommand({
        TableName: table,
        Key: {
            "id": {S: id}
        },
        ExpressionAttributeValues:{
            ":t": {S: token}
        },
        UpdateExpression: isBlack ? "set player_tokens.b = :t" : "set player_tokens.w = :t"
    }));
    return token; // otherwise, add the player and return the token
}
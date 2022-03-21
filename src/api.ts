import { getGame, updatePlayer } from "./db";
import { DynamoDBClient, PutItemCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { nanoid } from 'nanoid';
import { creds } from "./creds";
import { Response } from 'express-serve-static-core';

const { PieceTypes } = require("../chess9b60/src/bgio/pieces");
const { initialBoard } = require("../chess9b60/src/bgio/logic");
const Heap = require('heap');

const dbclient = new DynamoDBClient({ region: 'us-east-2', credentials: creds});
const tableName = "bgio";

function getNewID() {
    const str = nanoid().replace(/[^a-zA-Z0-9]/g, 'w');
    return str.substring(0, 6);
}

/// get game
export async function get(id: string, token: string): Promise<string|null> {
    try {
        const game = await getGame(dbclient, tableName, id);
        if (game?.player_tokens?.M?.w?.S === undefined || game?.player_tokens?.M?.b?.S === undefined) {
            return "invalid";
        }

        return assignPlayerID(id, token, game);
    } catch {
        return "invalid";
    }
}

async function assignPlayerID(id: string, token: string, game: {[key: string]: AttributeValue} | undefined) {
    const white: string|undefined = game?.player_tokens?.M?.w?.S;
    const black: string|undefined = game?.player_tokens?.M?.b?.S;

    let player = null;

    // if the user is one of the players, add them appropriately
    if(white === token)
        return "0";
    if(black === token)
        return "1";
    
    // if both players are taken, return null
    if(white !== "" && black !== "")
        return null;

    if(white !== "") {
        if(await updatePlayer(dbclient, tableName, id, token, true) !== token)  // make the player black
            return null; // if the player is already taken, make them spectator
        player = "1";

    } else if (black !== "") {
        if(await updatePlayer(dbclient, tableName, id, token, false) !== token) // make the player white
            return null; // if the player is already taken, make them spectator
        player = "0";
    } else {
        return "invalid";
    }

    return player;
}
///

/// create game
export async function create(time: number, increment: number, timer_enabled: boolean, black: string|null=null, white: string|null=null) {
    const id = getNewID();
    await makeMatch(id, time, increment, timer_enabled, black || "", white || "");
    return id;
}

async function makeMatch(id: string, start_time: number=900000, increment: number=10000, timer_enabled: boolean=true, black: string="", white: string="") {
    const board = initialBoard();

    const G = {
        "history": [board],
        "promotablePieces": [...new Set(
            board.filter((p: string|null) => p !== null)
            .map((p: string) => p.substring(1)) // remove color
            .filter((p: string) => !["K", "P"].includes(p)) // filter pawns and kings
            .sort((a: string, b: string) => (PieceTypes[a].strength < PieceTypes[b].strength) ? 1 : -1)
        )],
        "move_history": [],
        "whiteTurn": true,
        "inCheck": "",
        "noProgressCounter": 0,
        "timer_enabled": timer_enabled,
        "startTime": start_time,
        "wTime": start_time,
        "bTime": start_time,
        "increment": increment,
        "last_event": Date.now()        
    }
    const ctx = {
        "numPlayers": 2,
        "turn": 1,
        "currentPlayer": "0",
        "playOrder": ["0", "1"],
        "playOrderPos": 0,
        "phase": null,
        "activePlayers": null,
        "_activePlayersMinMoves": null,
        "_activePlayersMaxMoves": null,
        "_activePlayersNumMoves": {},
        "_prevActivePlayers": [],
        "_nextActivePlayers": null,
        "numMoves": 0
    }
    const plugins = {
        "random": { "data": { "seed": Date.now().toString(36).slice(-10) } },
        "log": { "data": {} },
        "events": { "data": {} }
    }
    const initialState = {
        "G": G,
        "ctx": ctx,
        "plugins": plugins,
        "_undo": {
            "G": G,
            "ctx": ctx,
            "plugins": plugins
        },
        "_redo": [],
        "_stateID": 0
    }

    const content = {
        id: {S: id},
        gameName: {S: "Chess"},
        players: {S: "{\"0\":{\"id\":0},\"1\":{\"id\":1}}"},
        setupData: {S: ""},
        gameover: {S: "null"},
        nextMatchID: {S: ""},
        unlisted: {BOOL: true},
        state: {S: JSON.stringify(initialState)},
        initialState: {S: JSON.stringify(initialState)},
        log: {S: "[]"},
        player_tokens: {M: { "w": {S: black}, "b": {S: white} }}
    }

    await dbclient.send(new PutItemCommand({
        TableName: tableName,
        Item: content
    }));

    return id;
}
///

/// joining pool
interface Player {
    time: number;
    token: string;
    res: Response<any, Record<string, any>, number>
}

let queue = new Heap((a: Player, b: Player) => b.time - a.time);

export async function join(token: string, res: Response<any, Record<string, any>, number>) {
    const player: Player = {time: Date.now(), token: token, res: res};
    queue.push(player);
    console.log('queue length: ' + queue.size());
    console.log('queue: ' + queue.toArray().map((p: Player) => p.token));

    await populate();
    console.log('queue length post populate: ' + queue.size());
    console.log();
}

async function populate() {
    let white: Player = queue.pop();
    let black: Player = queue.pop();

    if (white && black) {
        const id = await create(90000, 10000, true, black.token, white.token);
        // send the players the game id
        white.res.send(id);
        black.res.send(id);

        // iterate through the rest of the queue
        populate();
        return;
    }
    if (white)
        queue.push(white);
    if (black)
        queue.push(black);
}
///

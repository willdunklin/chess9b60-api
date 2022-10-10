import { getGame, updatePlayer } from "./db";
import { DynamoDBClient, PutItemCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { nanoid } from 'nanoid';
import { creds } from "./creds";
import { Response } from 'express-serve-static-core';

const { PieceTypes } = require("../chess9b60/src/bgio/pieces");
const { initialBoard } = require("../chess9b60/src/bgio/logic");

const dbclient = new DynamoDBClient({ region: 'us-east-2', credentials: creds});
const tableName = "bgio";

function getNewID() {
    const str = nanoid().replace(/[^a-zA-Z0-9]/g, 'w');
    return str.substring(0, 6);
}

/// get game
export async function get(id: string, token: string): Promise<string|null> {
    if (!id || !token)
        throw Error("Invalid parameters");

    const game = await getGame(dbclient, tableName, id);
    if (game?.player_tokens?.M?.w?.S === undefined || game?.player_tokens?.M?.b?.S === undefined) {
        return "invalid";
    }

    return assignPlayerID(id, token, game);
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
export async function create(time: number, increment: number, timer_enabled: boolean, strength: number[], black: string|null=null, white: string|null=null) {
    if (time === undefined || increment === undefined || timer_enabled === undefined)
        throw Error("Invalid parameters");
    const id = getNewID();
    await makeMatch(id, time, increment, timer_enabled, strength, white || "", black || "");
    return id;
}

async function makeMatch(id: string, start_time: number=900000, increment: number=10000, timer_enabled: boolean=true, strength: number[]=[3000,4000], black: string="", white: string="") {
    const board = initialBoard(strength[0], strength[1]);

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

export let queues: Player[][] = [[],[],[]];

export async function unjoin(token: string, message: string, range: [number, number]) {
    if (token === undefined)
        throw Error("Invalid parameters");

    for (let i = range[0]; i < range[1]; i++) {
        const queue = queues[i];
        const player = queue.find(p => p.token === token);

        if (player !== undefined) {
            queues[i] = queue.filter(p => p.token !== token);
            if (message !== null)
                player.res.send({ id: message });
        }
    }
}

export async function join(token: string, q_id: number, res: Response<any, Record<string, any>, number>) {
    if (token === undefined || q_id === undefined)
        throw Error("Invalid parameters");

    const player: Player = {time: Date.now(), token: token, res: res};

    // Refresh player if they are already in the queue
    unjoin(token, 'unjoined', [0, queues.length])
        .catch(err => console.log(err));

    queues[q_id].push(player);
    await populate(q_id);
}

// Time controls
const tc = [{base: 3  * 60 * 1000, inc: 2  * 1000},  // 3|2
            {base: 5  * 60 * 1000, inc: 3  * 1000},  // 5|3
            {base: 10 * 60 * 1000, inc: 10 * 1000}]; // 10|10

async function populate(q_id: number) {
    let white: Player | undefined = queues[q_id].pop();
    let black: Player | undefined = queues[q_id].pop();

    // Ensure no duplicate players
    if (white === black && white !== undefined) {
        queues[q_id].push(white);
        return;
    }

    if (white && black) {
        if (white?.token === black?.token) {
            queues[q_id].push(white);
            return;
        }

        const id = await create(tc[q_id].base, tc[q_id].inc, true, [3000,4000], black.token, white.token);
        // send the players the game id
        white.res.send({'id': id});
        black.res.send({'id': id});

        // iterate through the rest of the queue
        populate(q_id);
        return;
    }
    if (white)
        queues[q_id].push(white);
    if (black)
        queues[q_id].push(black);
}
///

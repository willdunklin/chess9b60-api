import { getGame, updatePlayer, makeGame } from "./db.js";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { nanoid } from 'nanoid';
import { initialBoard } from "../chess9b60/src/bgio/logic.js";
import { creds } from "./creds.js";
import pkg from 'heap';
const Heap = pkg;

const dbclient = new DynamoDBClient({ region: 'us-east-2', credentials: creds});
const tableName = "bgio";

function getNewID() {
    // some kind of game id unique string
    const str = nanoid().replace(/[^a-zA-Z0-9]/g, 'w');
    return str.substring(0, 6);
}

/// get game
export async function get(gameid, token) {
    let game = await getGame(dbclient, tableName, gameid);

    if (!game) {
        await makeGame(dbclient, tableName, gameid);
        game = {"gameid": {S: gameid}, "players": {M: {b: {S: ""}, w: {S: ""}}}}
    }

    return assignPlayerID(gameid, token, game);
}

async function assignPlayerID(gameid, token, game) {
    const white = game.players.M.w.S;
    const black = game.players.M.b.S;
    
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
        if(await updatePlayer(dbclient, tableName, gameid, token, true) !== token)  // make the player black
            return null; // if the player is already taken, make them spectator
        player = "1";

    } else if (black !== "") {
        if(await updatePlayer(dbclient, tableName, gameid, token, false) !== token) // make the player white
            return null; // if the player is already taken, make them spectator
        player = "0";
    } else {
        return "invalid";
    }

    return player;
}
///

/// create game
export async function create(time, increment, timer_enabled, black=null, white=null) {
    const gameid = getNewID();
    await makeMatch(gameid, time, increment, timer_enabled);

    if(black)
        await updatePlayer(dbclient, tableName, gameid, black, true);
    if(white)
        await updatePlayer(dbclient, tableName, gameid, white, false);

    return gameid;
}

async function makeMatch(gameid, start_time=900000, increment=10000, timer_enabled=true) {
    const board = initialBoard();

    const G = {
        "history": [board],
        "promotablePieces": [...new Set(
            board.filter(p => p !== null)
            .map(p => p.substring(1)) // remove color
            .filter(p => !["K", "P"].includes(p)) // filter pawns and kings
            .sort((a, b) => (PieceTypes[a].strength < PieceTypes[b].strength) ? 1 : -1)
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
        id: {S: gameid},
        gameName: {S: "Chess"},
        players: {S: "{\"0\":{\"id\":0},\"1\":{\"id\":1}}"},
        setupData: {S: ""},
        gameover: {S: "null"},
        nextMatchID: {S: ""},
        unlisted: {BOOL: true},
        state: {S: JSON.stringify(initialState)},
        initialState: {S: JSON.stringify(initialState)},
        log: {S: "[]"},
    }

    await dbclient.send(new PutItemCommand({
        TableName: tableName,
        Item: content
    }));

    return gameid;
}
///

/// joining pool
let queue = new Heap((a, b) => b.time - a.time);

export async function join(token) {
    queue.push({"time": Date.now(), "id": token});
    await populate();
}

async function populate() {
    let white = queue.pop();
    let black = queue.pop();

    if (white && black) {
        await create(90000, 10000, true, black, white);
        populate();
        return;
    }
    if (white)
        queue.push(white);
    if (black)
        queue.push(black);
}
///

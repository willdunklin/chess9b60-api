import { getGame, updatePlayer } from "./db";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand, ScanCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { nanoid } from 'nanoid';
import { creds, google } from "./creds";
import { Response } from 'express-serve-static-core';

import { PieceTypes } from "../chess9b60/src/bgio/pieces";
const { initialBoard } = require("../chess9b60/src/bgio/logic");
const { DynamnoStore } = require("../chess9b60/src/bgio/db");
import { OAuth2Client } from 'google-auth-library';

const google_client_id = google().client_id;
const google_client = new OAuth2Client(google_client_id);

const dbclient = new DynamoDBClient({ region: 'us-east-2', credentials: creds() });
const bgio_db = new DynamnoStore("us-east-2", creds(), "bgio");
const tableName = "bgio";

function getNewID() {
    const str = nanoid().replace(/[^a-zA-Z0-9]/g, 'w');
    return str.substring(0, 6);
}

///
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

    // console.log(db2user(item));
    return db2user(item);
}
///

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
    if (start_time === undefined || increment === undefined || timer_enabled === undefined || strength === undefined)
        throw Error("Invalid parameters");

    if (start_time < 0 || increment < 0 || strength[0] < 0 || strength[1] < 0)
        throw Error("Invalid parameters");

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
        "gameid": id,
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
        result: {S: ""},
        player_tokens: {M: { "w": {S: black}, "b": {S: white} }}
    }

    await dbclient.send(new PutItemCommand({
        TableName: tableName,
        Item: content
    }));

    return id;
}
///

const updatePlayersResult = async (white_id: string, black_id: string, game: string, result: string) => {
    const white = await dbclient.send(new ScanCommand({
        TableName: "users",
        FilterExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": {S: white_id}
        }
    }));

    const black = await dbclient.send(new ScanCommand({
        TableName: "users",
        FilterExpression: "id = :id",
        ExpressionAttributeValues: {
            ":id": {S: black_id}
        }
    }));

    if(white.Items === undefined || black.Items === undefined)
        return;

    const white_user = white.Items[0];
    const black_user = black.Items[0];

    if(white_user === undefined || black_user === undefined || white_user.elo.N === undefined || black_user.elo.N === undefined)
        return;

    const w_elo = parseInt(white_user.elo.N);
    const b_elo = parseInt(black_user.elo.N);

    // TODO: add elo calculation
    // await dbclient.send(new UpdateItemCommand({
    //     TableName: "users",
    //     Key: {
    //         "id": {S: white_id}
    //     },
    //     UpdateExpression: "SET elo = :elo",
    //     ExpressionAttributeValues: {
    //         ":elo": {N: w_elo} // TODO: change to updated elo
    //     }
    // }));

    // await dbclient.send(new UpdateItemCommand({
    //     TableName: "users",
    //     Key: {
    //         "id": {S: black_id}
    //     },
    //     UpdateExpression: "SET elo = :elo",
    //     ExpressionAttributeValues: {
    //         ":elo": {N: b_elo} // TODO: change to updated elo
    //     }
    // }));

    // TODO: add game to user's game history
}

export const end = async (id: string) => {
    const game = await getGame(dbclient, tableName, id);
    if (!game || !game.player_tokens || !game.player_tokens.M || !game.gameover?.S || game.result === undefined)
        return;

    const white_id = game.player_tokens.M.w.S;
    const black_id = game.player_tokens.M.b.S;
    if(white_id === '' || black_id === '' || white_id === undefined || black_id === undefined)
        return;

    if(game.result.S !== '')
        return;

    // check the result of the game
    const result = game.gameover.S.includes('draw') ? 'd' : game.gameover.S.includes('White') ? 'w' : 'b';

    // update the result
    await dbclient.send(new UpdateItemCommand({
        TableName: tableName,
        Key: { id: {S: id} },
        UpdateExpression: "set #result=:r",
        ExpressionAttributeValues: {
            ":r": {S: result}
        },
        ExpressionAttributeNames: {
            "#result": "result",
        },
    }));

    // update the players
    await updatePlayersResult(white_id, black_id, id, result);
}

///
const board2fen = (board: (string | null)[], piece_map: {[key: string]: string}, white: boolean, turn: number, halfmoves: number) => {
    let fen = '';
    let blanks = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i*8+j];

            if (piece === null)
                blanks++;
            else {
                if (blanks > 0) {
                    fen += blanks;
                    blanks = 0;
                }
                fen += piece_map[board[i*8+j]!];
            }
            if (j === 7 && i !== 7) {
                if (blanks > 0) {
                    fen += blanks;
                    blanks = 0;
                }
                fen += '/';
            }
        }
    }
    fen += ` ${white ? 'w' : 'b'} - - ${halfmoves} ${Math.floor(turn/2)}`;
    return fen;
}

const eimostu = 'eimostu';
const vanilla: {[key: string]: string} = {
    B: 'bishop = b\n',
    N: 'knight = n\n',
    R: 'rook = r\n',
    Q: 'queen = q\n'
}

const gen_piece_map = (promotablePieces: string[]) => {
    let piece_map: {[key: string]: string} = {WK: 'K', WP: 'P', BK: 'k', BP: 'p', K: 'K', P: 'P'};
    promotablePieces.forEach((p: string, i: number) => {
        if (p in vanilla) {
            piece_map[`W${p}`] = p.toUpperCase();
            piece_map[`B${p}`] = p.toLowerCase();
            piece_map[p] = p.toLowerCase();
        }
        else {
            piece_map[`W${p}`] = eimostu[i].toUpperCase();
            piece_map[`B${p}`] = eimostu[i];
            piece_map[p] = eimostu[i];
        }
    });
    return piece_map;
}

export const variant = async (id: string, start_pos: boolean) => {
    const { state } = await bgio_db.fetch(id, { state: true });

    const piece_map = gen_piece_map(state.G.promotablePieces);

    const idx = start_pos ? state.G.history.length - 1 : 0;
    const turn = state.ctx.turn;
    const fen = board2fen(state.G.history[idx], piece_map, turn % 2 === 1, turn + 1, start_pos ? 0 : state.G.noProgressCounter);

    let variant = `[!${id}#${turn}:chess]\npawn = p\nking = k\n`;
    let prom_pieces = 'promotionPieceTypes = ';
    state.G.promotablePieces.forEach((p: string, i: number) => {
        if (p in vanilla) {
            variant += vanilla[p];
            prom_pieces += p.toLowerCase();
        } else {
            variant += `customPiece${i+1} = ${eimostu[i]}:${PieceTypes[p].betza}\n`;
            prom_pieces += eimostu[i];
        }
    })
    variant += prom_pieces + '\n';
    variant += `startFen = ${fen}\n`;

    if (state.G.move_history[0]) {
        const last_move = state.G.move_history[0].map((m: string) => m.split('@')[1]).join('');
        return { turn: turn, name: `!${id}#${turn}`, filename: `${id}#${turn}.ini`, content: variant, last_move: last_move };
    }

    return { turn: turn, name: `!${id}#${turn}`, filename: `${id}#${turn}.ini`, content: variant, last_move: 'N/A' };
}
///

///
const get_square = (square: string) => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    if (file < 0 || file > 7 || rank < 0 || rank > 7)
        return -1;
    return file + rank * 8;
}

export const synthesize_game = async (id: string, moves: string[]) => {
    if (id === undefined || moves === undefined)
        throw Error("Invalid parameters");

    const { state } = await bgio_db.fetch(id, { state: true });
    const G = state.G;
    if (!state || !state.G)
        throw Error("Invalid target ID");

    let piece_map_inv: {[key: string]: string} = {};
    for (const [key, value] of Object.entries(gen_piece_map(G.promotablePieces))) {
        if (key.length >= 2 && (key[0] === 'W' || key[0] === 'B'))
            continue;
        piece_map_inv[value.toLowerCase()] = key;
    }

    let whiteTurn: boolean = G.whiteTurn;
    let move_history: string[][] = G.move_history;
    let history: (string | null)[][] = G.history;
    let board = [...history[0]];
    let ctx = state.ctx;

    moves.forEach((move: string) => {
        let from = '';
        let to = '';
        let promote = '';

        if (move.length === 5) {
            from = move.slice(0, 2);
            to = move.slice(2, 4);
            promote = piece_map_inv[move[4]];
        }
        else if (move.length === 4) {
            from = move.slice(0, 2);
            to = move.slice(2, 4);
        } else
            throw Error("Invalid move, must be 4 or 5 characters");

        if (get_square(from) < 0 || get_square(from) > 63 || get_square(to) < 0 || get_square(to) > 63)
            throw Error("Invalid move, out of board");

        const piece: string = board[get_square(from)]!;
        const from_piece = piece;
        let to_piece = piece;
        if (promote !== '') {
            to_piece = piece[0] + promote;
        }

        board[get_square(from)] = null;
        board[get_square(to)] = to_piece;
        history.unshift([...board]);

        move_history.unshift([`${from_piece}@${from}`, `${to_piece}@${to}`]);

        ctx.turn++;
        whiteTurn = !whiteTurn;
        ctx.currentPlayer = whiteTurn ? '0' : '1';
    });

    const game = await getGame(dbclient, tableName, id);
    if (!game || !game.state.S || !game.id || !game.player_tokens?.M)
        return 'invalid';

    game.id = { S: getNewID() };

    const new_state = JSON.parse(game.state.S!);
    new_state.G.history = history;
    new_state.G.move_history = move_history;
    new_state.G.whiteTurn = whiteTurn;
    new_state.G.timer_enabled = false;
    new_state.ctx = ctx;
    game.state = { S: JSON.stringify(new_state) };

    game.player_tokens!.M!.b.S = 'black_bot';
    game.player_tokens!.M!.w.S = 'white_bot';
    // TODO: * set player_tokens to "bot1" and "bot2"
    //       * set G.timer_enabled: false
    //       * set id to something new
    //       set ctx.gameover to what it should be
    //       set gameover to what it should be
    await dbclient.send(new PutItemCommand({
        TableName: tableName,
        Item: game
    }));

    return game.id.S;
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

import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { creds } from "../creds";
import { getGame, dbclient } from "../db";
import { PieceTypes } from "../../chess9b60/src/bgio/pieces";
import { getNewID } from "./util";

const { DynamnoStore } = require("../../chess9b60/src/bgio/db");

const bgio_db = new DynamnoStore("us-east-2", creds(), "bgio");

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

    const game = await getGame(dbclient, "bgio", id);
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
        TableName: "bgio",
        Item: game
    }));

    return game.id.S;
}
///

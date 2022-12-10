import EloRank from 'elo-rank';
import { UpdateItemCommand, ScanCommand, AttributeValue } from "@aws-sdk/client-dynamodb";
import { getGame, dbclient } from "../db";

interface GameResult {
    gameid: string;
    wasWhite: boolean;
    w: {r: number};
    b: {r: number};
    result: 1 | 0 | 0.5;
}

export const end = async (id: string) => {
    const game = await getGame(dbclient, "bgio", id);
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
        TableName: "bgio",
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
    await updatePlayerResult(white_id, black_id, id, result);
}

const updatePlayerResult = async (white_id: string, black_id: string, gameid: string, result: string) => {
    const white_player = await dbclient.send(new ScanCommand({
        TableName: "users",
        FilterExpression: "id = :id",
        ExpressionAttributeValues: { ":id": {S: white_id} }
    }));

    const black_player = await dbclient.send(new ScanCommand({
        TableName: "users",
        FilterExpression: "id = :id",
        ExpressionAttributeValues: { ":id": {S: black_id} }
    }));

    if(white_player.Items === undefined || white_player.Items[0] === undefined ||
       black_player.Items === undefined || black_player.Items[0] === undefined)
        return;

    const white_user = white_player.Items[0];
    const black_user = black_player.Items[0];

    if (white_user.email?.S === undefined || black_user.email?.S === undefined)
        return;

    const game: GameResult = {
        gameid: gameid,
        wasWhite: true,
        w: {r: parseInt(white_user.elo?.N || '1000')},
        b: {r: parseInt(black_user.elo?.N || '1000')},
        result: result === 'w' ? 1 : result === 'b' ? 0 : 0.5
    };

    await addGame(white_user, game, true);
    await addGame(black_user, game, false);
}

const addGame = async (player: {[key: string]: AttributeValue}, game: GameResult, white: boolean) => {
    if(!player.email?.S)
        return;

    const games = player.games?.L || [];
    game.wasWhite = white;
    games.push({ S: JSON.stringify(game) });

    const rank = new EloRank();
    const playerA = white ? game.w.r : game.b.r;
    const playerB = white ? game.b.r : game.w.r;
    const expected = rank.getExpected(playerA, playerB);
    const elo = rank.updateRating(expected, white ? game.result : 1 - game.result, playerA);

    await dbclient.send(new UpdateItemCommand({
        TableName: "users",
        Key: { email: {S: player.email.S} },
        UpdateExpression: "set games=:games, elo=:elo",
        ExpressionAttributeValues: { ":games": {L: games}, ":elo": {N: `${elo}`} }
    }));
}

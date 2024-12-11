import { parse } from 'url';

export const gameInitState = {}

export default function GameNianioFunction(state, cmd) {
    if (Object.hasOwn(cmd, 'ov.HttpWorker')) {
        if (Object.hasOwn(cmd['ov.HttpWorker'], 'ov.NewRequest')) {
            return handleNewRequest(state, cmd['ov.HttpWorker']['ov.NewRequest']);
        } else if (Object.hasOwn(cmd['ov.HttpWorker'], 'ov.ConnectinIdDoesntExist')) {
            // that will never happen in this implementation
            throw new Error(`Invalid cmd: ${cmd}`);
        } else {
            // that will never happen in this implementation
            throw new Error(`Invalid cmd: ${cmd}`);
        }
    } else if (Object.hasOwn(cmd, 'ov.TimerWorker')) {
        return handleTimerTimeOut(state, cmd['ov.TimerWorker']);
    } else {
        // that will never happen in this implementation
        throw new Error(`Invalid cmd: ${cmd}`);
    }
}

function sendMessageCmd(code, message, connectinId) {
    return { 'ov.HttpWorker': {
        'ConnectinId': connectinId,
        'StatusCode': code,
        'Payload': { 'ov.Message': message },
    }};
}

function sendBoardStateCmd(game, connectinId) {
    return { 'ov.HttpWorker': {
        'ConnectinId': connectinId,
        'StatusCode': 200,
        'Payload': { 'ov.BoardState': {
            'Board': game['Board'],
            'State': game['State'],
        }}
    }};
}

function startTimerCmd(gameId, connectinId) {
    return { 'ov.TimerWorker': {
        'GameId': gameId,
        'CallId': connectinId,
    }};
}

function getBoardState(board) {
    for (let i = 0; i < 3; i++) {
        if (board[i * 3] == board[i * 3 + 1] && board[i * 3] == board[i * 3 + 2] && board[i * 3] != ' ') return board[i * 3] == 'X' ? 'ov.YouWin' : 'ov.YouLose';
    }
    for (let i = 0; i < 3; i++) {
        if (board[i] == board[i + 3] && board[i] == board[i + 6] && board[i] != ' ') return board[i] == 'X' ? 'ov.YouWin' : 'ov.YouLose';
    }
    if (board[0] == board[4] && board[0] == board[8] && board[0] != ' ') return board[0] == 'X' ? 'ov.YouWin' : 'ov.YouLose';
    if (board[2] == board[4] && board[2] == board[6] && board[2] != ' ') return board[2] == 'X' ? 'ov.YouWin' : 'ov.YouLose';
    return board.flat().some(b => b == ' ') ? 'ov.Playing' : 'ov.Tie';
}

function handleStartNewGame(state, gameId, connectinId) {
    if (Object.hasOwn(state, gameId)) {
        let message = '';
        if (Object.hasOwn(state[gameId]['State'], 'ov.Playing')) message = 'Game already started';
        else if (Object.hasOwn(state[gameId]['State'], 'ov.UserEnded')) message = 'User ended this game';
        else if (Object.hasOwn(state[gameId]['State'], 'ov.TimeOut')) message = 'Game is lost because of TimeOut';
        else if (Object.hasOwn(state[gameId]['State'], 'ov.YouWin')) message = 'You won this game';
        else if (Object.hasOwn(state[gameId]['State'], 'ov.YouLose')) message = 'You lost this game';
        else if (Object.hasOwn(state[gameId]['State'], 'ov.Tie')) message = 'Game ended with tie';
        else throw new Error(`Invalid gameState: ${state[gameId]['State']}`);

        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, message, connectinId)],
        };
    } else {
        state[gameId] = {
            'Board': [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
            'State': { 'ov.Playing': null },
            'LastTimerCallId': 0,
        }
        return {
            'state': state,
            'extCmds': [
                sendMessageCmd(200, 'Game started', connectinId),
                startTimerCmd(gameId, 0),
            ],
        }
    }
}

function handleMove(state, gameId, pathSegments, connectinId) {
    if (pathSegments.length !== 3) {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Invalid move endpoint', connectinId)],
        };
    }

    const moveId = parseInt(pathSegments[2]);
    if (isNaN(moveId)) {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Invalid moveId', connectinId)],
        };
    }

    if (Object.hasOwn(state, gameId)) {
        const gameState = state[gameId]['State'];
        if (Object.hasOwn(gameState, 'ov.Playing')) {
            state[gameId]['LastTimerCallId']++;
            const board = state[gameId]['Board'];
            if (moveId < 0 || moveId > 8 || board[moveId] != ' ') {
                return {
                    'state': state,
                    'extCmds': [
                        sendMessageCmd(400, 'Invalid Move', connectinId),
                        startTimerCmd(gameId, state[gameId]['LastTimerCallId']),
                    ],
                }
            }

            board[moveId] = 'X';
            let boardState = getBoardState(board);

            if (boardState == 'ov.Playing') {
                const oponentMove = board.flat().findIndex(b => b == ' ');
                board[oponentMove] = 'O';
                boardState = getBoardState(board);
            }

            state[gameId]['Board'] = board;
            state[gameId]['State'] = {};
            state[gameId]['State'][boardState] = null;

            return {
                'state': state,
                'extCmds': [
                    sendBoardStateCmd(state[gameId], connectinId),
                    startTimerCmd(gameId, connectinId),
                ]
            }
        } else {
            return {
                'state': state,
                'extCmds': [sendBoardStateCmd(state[gameId], connectinId)]
            }
        }
    } else {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Game not started', connectinId)],
        };
    }
}

function handleEndGame(state, gameId, connectinId) {
    if (Object.hasOwn(state, gameId)) {
        const gameState = state[gameId]['State'];
        if (Object.hasOwn(gameState, 'ov.Playing')) {
            state[gameId]['State'] = { 'ov.UserEnded': null }
            return {
                'state': state,
                'extCmds': [sendMessageCmd(200, 'Game ended', connectinId)],
            };
        } else {
            return {
                'state': state,
                'extCmds': [sendMessageCmd(400, 'Game already ended', connectinId)],
            };
        }
    } else {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Game not started', connectinId)],
        };
    }
}

function handleNewRequest(state, request) {
    const connectinId = request['ConnectinId'];
    const url = request['Url'];
    const parsedUrl = parse(url || '', true);
    const pathname = parsedUrl.pathname || '';
    const pathSegments = pathname.split('/').filter(segment => segment.length > 0);

    if (pathSegments.length < 2) {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Invalid URL structure', connectinId)],
        };
    }

    const gameId = pathSegments[0];
    const action = pathSegments[1];

    if (!gameId) {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Missing gameId', connectinId)],
        };
    }

    if (action === 'start') return handleStartNewGame(state, gameId, connectinId);
    else if (action === 'move') return handleMove(state, gameId, pathSegments, connectinId);
    else if (action === 'end') return handleEndGame(state, gameId, connectinId);
    else {
        return {
            'state': state,
            'extCmds': [sendMessageCmd(400, 'Bad action', connectinId)],
        };
    }
}

function handleTimerTimeOut(state, command) {
    const callId = command['CallId'];
    const gameId = command['GameId'];
    const lastTimerCallId = state[gameId]['LastTimerCallId'];
    const gameState = state[gameId]['State'];
    if (Object.hasOwn(gameState, 'ov.Playing') && lastTimerCallId == callId) {
        state[gameId]['State'] = { 'ov.TimeOut': null };
    }
    return {
        'state': state,
        'extCmds': [],
    }
}

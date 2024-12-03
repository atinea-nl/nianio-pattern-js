export const gameInitState = {}

export function GameNianioFunction(state, cmd) {
    function sendMessageCmd(code, message, connectinId) {
        return { 'ov.HttpWorker': {
            'ConnectinId': connectinId,
            'Command': {
                'ov.SendMessage': {
                    'StatusCode': code,
                    'Message': message,
                }
            }
        }};
    }

    function sendBoardStateCmd(game, connectinId) {
        return { 'ov.HttpWorker': {
            'ConnectinId': connectinId,
            'Command': {
                'ov.SendBoardState': {
                    'Board': game['Board'],
                    'State': game['State'],
                }
            }
        }};
    }

    function startTimerCmd(gameId, connectinId) {
        return { 'ov.TimerWorker': {
            'ov.Start': {
                'GameId': gameId,
                'CallId': connectinId,
            }
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

    function getStateDescription(gameState) {
        if (Object.hasOwn(gameState, 'ov.Playing')) return 'Game already started';
        if (Object.hasOwn(gameState, 'ov.UserEnded')) return 'User ended this game';
        if (Object.hasOwn(gameState, 'ov.TimeOut')) return 'Game is lost because of TimeOut';
        if (Object.hasOwn(gameState, 'ov.YouWin')) return 'You won this game';
        if (Object.hasOwn(gameState, 'ov.YouLose')) return 'You lost this game';
        if (Object.hasOwn(gameState, 'ov.Tie')) return 'Game ended with tie';
        throw new Error(`Invalid gameState: ${gameState}`);
    }

    function makeMoveFunc(state, gameId, move, connectinId) {
        state[gameId]['LastTimerCallId']++;
        const board = state[gameId]['Board'];
        if (move < 0 || move > 8 || board[move] != ' ') {
            return {
                'state': state,
                'extCmds': [
                    sendMessageCmd(400, 'Invalid Move', connectinId),
                    startTimerCmd(gameId, state[gameId]['LastTimerCallId']),
                ],
            }
        }

        board[move] = 'X';
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
    }

    if (Object.hasOwn(cmd, 'ov.HttpWorker')) {
        const connectinId = cmd['ov.HttpWorker']['ConnectinId'];
        const gameId = cmd['ov.HttpWorker']['GameId'];
        const command = cmd['ov.HttpWorker']['Command'];

        if (Object.hasOwn(command, 'ov.StartGame')) {
            if (Object.hasOwn(state, gameId)) {
                const answer = getStateDescription(state[gameId]['State']);
                return {
                    'state': state,
                    'extCmds': [sendMessageCmd(400, answer, connectinId)],
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
        } else if (Object.hasOwn(command, 'ov.MakeMove')) {
            if (Object.hasOwn(state, gameId)) {
                const gameState = state[gameId]['State'];
                if (Object.hasOwn(gameState, 'ov.Playing')) {
                    return makeMoveFunc(state, gameId, command['ov.MakeMove'], connectinId);
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
        } else if (Object.hasOwn(command, 'ov.EndGame')) {
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
        } else {
            throw new Error(`Invalid command: ${command}`);
        }
    } else if (Object.hasOwn(cmd, 'ov.TimerWorker')) {
        if (Object.hasOwn(cmd['ov.TimerWorker'], 'ov.TimeOut')) {
            const callId = cmd['ov.TimerWorker']['ov.TimeOut']['CallId'];
            const gameId = cmd['ov.TimerWorker']['ov.TimeOut']['GameId'];
            const lastTimerCallId = state[gameId]['LastTimerCallId'];
            const gameState = state[gameId]['State'];
            if (Object.hasOwn(gameState, 'ov.Playing') && lastTimerCallId == callId) {
                state[gameId]['State'] = { 'ov.TimeOut': null };
            }
            return {
                'state': state,
                'extCmds': [],
            }
        } else {
            throw new Error(`Invalid cmd['ov.TimerWorker']: ${cmd['ov.TimerWorker']}`);
        }
    } else {
        throw new Error(`Invalid cmd: ${cmd}`);
    }
}

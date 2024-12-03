## nianio-pattern-js

After reading this documentation, you will be able to start using the nianio-pattern-js library in your own projects.

### What is Nianio Pattern?

Nianio Pattern is a design pattern that allows to manage application state with asynchronous communication between different components of the system.
More information available here: [Nianio Pattern specification](https://www.nianiolang.org/nianio_pattern_specyfication.html)

### Api documentation

The library provides the `NianioStart` function that initializes and starts Nianio. It expects parameters:
- `statePtd` - The ptd type of Nianio's internal state.
- `cmdPtd` - The ptd type of the commands sent to Nianio (by workers)
- `extCmdPtd` - Type of commands going out of Nianio (to the workers).
- `nianioFunction` - The transition function. On input it accepts the application state and command, on output it should return an object with a `state` field (new state) and an `extCmds` field (list of external commands). This is where the core logic of the system is implemented.
- `initState` - Nianio's initial state.
- `workerFactories` - Hash with worker factories (example will be given below)

The library does not contain a method to stop the Nianio dispatcher - this logic is left to developers to implement in `nianioFunction`. 

The dispatcher itself does not operate in an infinite loop but works as a result of receiving a command. Commands in the queue are scheduled to execute immediately after processing the current command.

### Worker definition
The definition of the worker we pass to Nianio is a function of type 'closure'. Inside this function we can define any logic and state of the worker. The worker function must meet the following conditions:
- Accepts on input a reference to a function that allows the worker to throw commands to Nianio.
- On the output, it returns a command that allows you to throw commands to the worker

The worker function is executed only once during the initialization of Nianio.

Example of counter worker that returns answer after 5s:
~~~js
function counterWorker(pushCmdFunc) {
    let counter = 0;

    function pushExtCmdFunc(extCmd) {
        const newValue = counter;
        counter++;
        setTimeout(() => pushCmdFunc(newValue), 5000);
    }

    return pushExtCmdFunc;
}
~~~

### Additional assumptions
- The library uses [json-ptd](https://github.com/atinea-nl/json-ptd)
- All command types should read from the variant with the name of the worker they are associated with. 
  In practice, this makes it easier to parse and send commands in `nianioFunction`. 

  With that assumption library additionally ensures that:
  - Before the command reaches the worker it is unpacked from variant with his name
  - Before a command gets from a worker to the Nianio queue it is wrapped in a variant with his name

### Error handling
In case of any exception during the dispatcher's transition (e.g. attempting to handle a command or a state that does not conform to ptd ), nianio will throw an unhandled exception with an error message. 
This is a state in which we don't know what to expect next, so the error will be thrown at the toplevel of js runtime and it will terminate the entire service.

## Full example

The example presents a http server with a simple game of tic-tac-toe. 
The game can be started with:
~~~
npm install
npm run start
~~~

Game is played through the endpoint `/` which requires a parameter `id` with the user id and `action` which can take such values:
- `start` - start the game.
- `move` - making a move - required parameter 'move' with number 0-8
- `end` - ending the game

In order to present asynchronicity during the game, a 10-second timer is started after the game starts, which, when finished, ends the game and blocks the possibility of further moves. Each move starts a new timer and invalidates the previous ones.

### Implementation

##### Ptd types:

~~~~js
const boardPtd = { 'ov.ptd_arr': { 'ov.ptd_utf8': null }};

const gameStatusPtd = { 'ov.ptd_var': {
    'Playing': { 'ov.no_param': null },
    'UserEnded': { 'ov.no_param': null },
    'TimeOut': { 'ov.no_param': null },
    'YouWin': { 'ov.no_param': null },
    'YouLose': { 'ov.no_param': null },
    'Tie': { 'ov.no_param': null },
}};

export const gameStatePtd = { 'ov.ptd_hash': { 'ov.ptd_rec': {
    'Board': boardPtd,
    'LastTimerCallId': { 'ov.ptd_int': null },
    'State': gameStatusPtd,
}}};

export const gameCmdPtd = {
    'ov.ptd_var': {
        'HttpWorker': { 'ov.with_param': { 'ov.ptd_rec': {
            'ConnectinId': { 'ov.ptd_int': null },
            'GameId': { 'ov.ptd_utf8': null },
            'Command': { 'ov.ptd_var': {
                'StartGame': { 'ov.no_param': null },
                'MakeMove': { 'ov.with_param': { 'ov.ptd_int': null }},
                'EndGame': { 'ov.no_param': null },
            }},
        }}},
        'TimerWorker': { 'ov.with_param': { 'ov.ptd_var': {
            'TimeOut': { 'ov.with_param': { 'ov.ptd_rec': {
                'GameId': { 'ov.ptd_utf8': null },
                'CallId': { 'ov.ptd_int': null },
            }}},
        }}},
    }
}

export const gameExtCmdPtd = {
    'ov.ptd_var': {
        'HttpWorker': { 'ov.with_param': { 'ov.ptd_rec': {
            'ConnectinId': { 'ov.ptd_int': null },
            'Command': { 'ov.ptd_var': {
                'SendBoardState': { 'ov.with_param': { 'ov.ptd_rec': {
                    'Board': boardPtd,
                    'State': gameStatusPtd,
                }}},
                'SendMessage': { 'ov.with_param': { 'ov.ptd_rec': {
                    'StatusCode': { 'ov.ptd_int': null },
                    'Message': { 'ov.ptd_utf8': null },
                }}},
            }},
        }}},
        'TimerWorker': { 'ov.with_param': { 'ov.ptd_var': {
            'Start': { 'ov.with_param': { 'ov.ptd_rec': {
                'GameId': { 'ov.ptd_utf8': null },
                'CallId': { 'ov.ptd_int': null },
            }}},
        }}},
    }
}
~~~~

##### TimerWorker
TimerWorker accepts an object with information about what game it comes from and the `CallId`. It's then used to verify that a new timer has not already been started for the user in question.

~~~~js
export function timerWorker(pushCmdFunc) {
    function pushExtCmdFunc(extCmd) {
        if (Object.hasOwn(extCmd, 'ov.Start')) {
            const extCmdValue = extCmd['ov.Start'];
            setTimeout(() => pushCmdFunc({ 'ov.TimeOut': extCmdValue }), 10 * 1000);
        } else {
            throw new Error(`Invalid extCmd: ${extCmd}`);
        }
    }

    return pushExtCmdFunc;
}
~~~~

##### HttpWorker

HttpWorker during initialization creates an http server that asynchronously accepts incoming requests and forwards them to Nianio.
It saves itself a map of established connections to use later when returning a response. 

~~~js
import { createServer } from 'http';
import { parse } from 'url';

export function httpWorker(pushCmdFunc) {
    let counter = 0;
    const resHashMap = {};

    const server = createServer((req, res) => {
        const query = parse(req.url || '', true);
        const queryParams = query.query;

        if (!Object.hasOwn(queryParams, 'id') || !Object.hasOwn(queryParams, 'action')) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('No id or action param');
            return;
        }

        const id = queryParams['id'];
        const action = queryParams['action'];
        const thisConnectinId = counter;
        resHashMap[thisConnectinId] = res;
        counter++;

        if (action == 'start') {
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.StartGame': null },
            });
        } else if (action == 'move') {
            if (!Object.hasOwn(queryParams, 'move')) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('No move param');
                return;
            }
            const move = parseInt(queryParams['move']);
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.MakeMove': move },
            });
        } else if (action == 'end') {
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.EndGame': null },
            });
        } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad action');
            return;
        }
    });

    server.listen(8000, () => console.log(`Server running at http://localhost:8000/`));

    function pushExtCmdFunc(extCmd) {
        const connectinId = extCmd['ConnectinId'];
        const command = extCmd['Command'];

        if (!Object.hasOwn(resHashMap, connectinId)) {
            throw new Error(`Invalid connectinId: ${connectinId}`);
        }
        const res = resHashMap[connectinId];

        if (Object.hasOwn(command, 'ov.SendBoardState')) {
            const extCmdValue = command['ov.SendBoardState'];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(extCmdValue));
        } else if (Object.hasOwn(command, 'ov.SendMessage')) {
            const extCmdValue = command['ov.SendMessage'];
            res.writeHead(extCmdValue['StatusCode'], { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 'Message': extCmdValue['Message'], }));
        } else {
            throw new Error(`Invalid command: ${command}`);
        }
    }

    return pushExtCmdFunc;
}
~~~

##### NianioFunction
The GameNianioFunction implementation is an example of how to create a `nianioFunction` and how to extract objects with the variant type. 

~~~js
function GameNianioFunction(state, cmd) {
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
~~~
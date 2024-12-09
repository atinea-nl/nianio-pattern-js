## nianio-pattern-js

After reading this documentation, you will be able to start using the nianio-pattern-js library in your own projects.

### What is Nianio Pattern?

Nianio Pattern is a design pattern that allows to manage application state with asynchronous communication between different components of the system.
More information available here: [Nianio Pattern specification](https://www.nianiolang.org/nianio_pattern_specyfication.html)

### Api documentation

The library provides the `NianioStart` function that initializes and starts Nianio. It expects object with parameters:
- `ptd` - object with ptd types. At the top level, it must include parameters:
    - `state` The ptd type of Nianio's internal state.
    - `cmd` - The ptd type of the commands sent to Nianio (by workers)
    - `extCmd` - Type of commands going out of Nianio (to the workers).
- `nianioFunction` - The transition function. On input it accepts the application state and command, on output it should return an object with a `state` field (new state) and an `extCmds` field (list of external commands). This is where the core logic of the system is implemented.
- `initState` - Nianio's initial state.
- `workerFactories` - Hash with worker factories (example will be given below)
- `nianioRuntime` - object with parameters (it's recomended to use default runtime from `./runtimes/`):
    - `logErrorBeforeTerminationFunc` - function that will execute itself before the nianio termination
    - `scheduleNextNianioTickFunc` - function that will execute next execution of dispatcher

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

### Default workers

Since workers should contain as little logic as possible, a few of the most standard examples of them can be standardized.

##### Simple timer worker

Simple timer worker sends back to the Nianio the same command it received after a predefined time during the initialization of the worker. 

~~~js
export function simpleTimerWorkerGenerator({seconds}) {
    if (seconds == null) throw new Error('seconds == null') 
    function simpleTimerWorker(pushCmdFunc) {
        function pushExtCmdFunc(extCmd) {
            setTimeout(() => pushCmdFunc(extCmd), seconds * 1000);
        }
        return pushExtCmdFunc;
    }
    return simpleTimerWorker;
}
~~~

##### Http worker

Http worker during initialization starts the http server on the given port. Requests in the form of url are forwarded to Nianio along with an id allowing to send a response through the established connection.
Return messages have a generic ptd type defined in `httpWorkerExtCmdPtdFromPayload`.

~~~js
import { createServer } from 'http';

export function httpWorkerGenerator({port}) {
    if (port == null) port = 8000;

    function httpWorker(pushCmdFunc) {
        let counter = 0;
        const resHashMap = {};

        const server = createServer((req, res) => {
            const connectionId = counter;
            resHashMap[connectionId] = res;
            counter++;
            const url = req.url || '';

            pushCmdFunc({ 'ov.NewRequest' : {
                'ConnectinId': connectionId,
                'Url': url,
            }});
        });

        server.listen(8000, () => console.log(`Server running at http://localhost:${port}/`));

        function pushExtCmdFunc(extCmd) {
            const connectionId = extCmd['ConnectinId'];

            if (!Object.hasOwn(resHashMap, connectionId)) {
                pushCmdFunc({ 'ov.ConnectinIdDoesntExist' : null });
                return;
            }

            const res = resHashMap[connectionId];
            const statusCode = extCmd['StatusCode'];
            const message = extCmd['Payload'];

            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(message));
            delete resHashMap[connectionId];
        }

        return pushExtCmdFunc;
    }

    return httpWorker;
}

export const httpWorkerCmdPtd = { 'ov.ptd_var': {
    'NewRequest': { 'ov.with_param': { 'ov.ptd_rec': {
        'ConnectinId': { 'ov.ptd_int': null },
        'Url': { 'ov.ptd_utf8': null } },
    }},
    'ConnectinIdDoesntExist': { 'ov.no_param': null },
}};

export function httpWorkerExtCmdPtdFromPayload(payloadPtd) {
    return { 'ov.ptd_rec': {
        'ConnectinId': { 'ov.ptd_int': null },
        'StatusCode': { 'ov.ptd_int': null },
        'Payload': payloadPtd,
    }};
}
~~~

## Full example

The example presents a http server with a simple game of tic-tac-toe. 
The game can be started with:
~~~
npm install
npm run start
~~~

Game is played through the endpoints:
- `/[gameId]/start` - start the game.
- `/[gameId]/move/[moveId]` - making a move - required parameter 'move' with number 0-8
- `/[gameId]/end` - ending the game

In order to present asynchronicity during the game, a 10-second timer is started after the game starts, which, when finished, ends the game and blocks the possibility of further moves. Each move starts a new timer and invalidates the previous ones.

### Implementation

##### Ptd types:

~~~~js
import { httpWorkerCmdPtd, httpWorkerExtCmdPtdFromPayload } from '../defaultWorkers/httpWorker.js'

export const gamePtd = {
    'state': { 'ov.ptd_hash': { 'ov.ptd_rec': {
        'Board': { 'ov.ptd_ref': 'boardPtd' },
        'LastTimerCallId': { 'ov.ptd_int': null },
        'State': { 'ov.ptd_ref': 'gameStatusPtd' },
    }}},
    'cmd': { 'ov.ptd_var': {
        'HttpWorker': { 'ov.with_param': httpWorkerCmdPtd },
        'TimerWorker': { 'ov.with_param': { 'ov.ptd_ref': 'timerWorkerPtd' } },
    }},
    'extCmd': { 'ov.ptd_var': {
        'HttpWorker': { 'ov.with_param': httpWorkerExtCmdPtdFromPayload({ 'ov.ptd_var': {
            'BoardState': { 'ov.with_param': { 'ov.ptd_rec': {
                'Board': { 'ov.ptd_ref': 'boardPtd' },
                'State': { 'ov.ptd_ref': 'gameStatusPtd' },
            }}},
            'Message': {  'ov.with_param': {'ov.ptd_utf8': null } },
        }})},
        'TimerWorker': { 'ov.with_param': { 'ov.ptd_ref': 'timerWorkerPtd' } },
    }},
    'gameStatusPtd': { 'ov.ptd_var': {
        'Playing': { 'ov.no_param': null },
        'UserEnded': { 'ov.no_param': null },
        'TimeOut': { 'ov.no_param': null },
        'YouWin': { 'ov.no_param': null },
        'YouLose': { 'ov.no_param': null },
        'Tie': { 'ov.no_param': null },
    }},
    'boardPtd': { 'ov.ptd_arr': { 'ov.ptd_utf8': null } },
    'timerWorkerPtd': { 'ov.ptd_rec': {
        'GameId': { 'ov.ptd_utf8': null },
        'CallId': { 'ov.ptd_int': null },
    }},
}
~~~~

##### NianioFunction
The GameNianioFunction implementation is an example of how to create a `nianioFunction` and how to extract objects with the variant type. 

~~~js
export function GameNianioFunction(state, cmd) {
    function sendMessageCmd(code, message, connectinId) {
        return { 'ov.HttpWorker': {
            'ConnectinId': connectinId,
            'StatusCode': code,
            'Payload': { 'ov.Message': message },
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

    function getStateDescription(gameState) {
        if (Object.hasOwn(gameState, 'ov.Playing')) return 'Game already started';
        if (Object.hasOwn(gameState, 'ov.UserEnded')) return 'User ended this game';
        if (Object.hasOwn(gameState, 'ov.TimeOut')) return 'Game is lost because of TimeOut';
        if (Object.hasOwn(gameState, 'ov.YouWin')) return 'You won this game';
        if (Object.hasOwn(gameState, 'ov.YouLose')) return 'You lost this game';
        if (Object.hasOwn(gameState, 'ov.Tie')) return 'Game ended with tie';
        throw new Error(`Invalid gameState: ${gameState}`);
    }

    function handleNewRequest(request) {
        function sendBoardStateCmd(game, connectinId) {
            return {
                'ov.HttpWorker': {
                    'ConnectinId': connectinId,
                    'StatusCode': 200,
                    'Payload': {
                        'ov.BoardState': {
                            'Board': game['Board'],
                            'State': game['State'],
                        }
                    }
                }
            };
        }

        function handleStartNewGame(pathSegments, connectinId) {
            if (pathSegments.length !== 2) {
                return {
                    'state': state,
                    'extCmds': [sendMessageCmd(400, 'Invalid start endpoint', connectinId)],
                };
            }

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
        }

        function handleMove(pathSegments, connectinId) {

            function makeMoveFunc(gameId, move, connectinId) {
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
                    return makeMoveFunc(gameId, moveId, connectinId);
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

        function handleEndGame(pathSegments, connectinId) {
            if (pathSegments.length !== 2) {
                return {
                    'state': state,
                    'extCmds': [sendMessageCmd(400, 'Invalid end endpoint', connectinId)],
                };
            }

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

        if (action === 'start') return handleStartNewGame(pathSegments, connectinId);
        else if (action === 'move') return handleMove(pathSegments, connectinId);
        else if (action === 'end') return handleEndGame(pathSegments, connectinId);
        else {
            return {
                'state': state,
                'extCmds': [sendMessageCmd(400, 'Bad action', connectinId)],
            };
        }
    }

    function handleTimerTimeOut(command) {
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

    if (Object.hasOwn(cmd, 'ov.HttpWorker')) {
        if (Object.hasOwn(cmd['ov.HttpWorker'], 'ov.NewRequest')) {
            return handleNewRequest(cmd['ov.HttpWorker']['ov.NewRequest']);
        } else if (Object.hasOwn(cmd['ov.HttpWorker'], 'ov.ConnectinIdDoesntExist')) {
            // that will never happen in this implementation
            throw new Error(`Invalid cmd: ${cmd}`);
        } else {
            // that will never happen in this implementation
            throw new Error(`Invalid cmd: ${cmd}`);
        }
    } else if (Object.hasOwn(cmd, 'ov.TimerWorker')) {
        return handleTimerTimeOut(cmd['ov.TimerWorker']);
    } else {
        // that will never happen in this implementation
        throw new Error(`Invalid cmd: ${cmd}`);
    }
}
~~~


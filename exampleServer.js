import NianioStart from './nianioPattern.js';
import { runtimeNodeJs } from './runtimes/nodeJs.js';
import { gamePtd } from './example_http_game/ptds.js';
import { GameNianioFunction, gameInitState } from './example_http_game/game.js';
import { simpleTimerWorkerGenerator } from './defaultWorkers/simpleTimerWorker.js';
import { httpWorkerGenerator } from './defaultWorkers/httpWorker.js';

NianioStart({
    ptd: gamePtd,
    initState: gameInitState,
    nianioFunction: GameNianioFunction,
    workerFactories: {
        'HttpWorker': httpWorkerGenerator({ port: 8000 }),
        'TimerWorker': simpleTimerWorkerGenerator({ seconds: 10 }),
    },
    nianioRuntime: runtimeNodeJs,
});
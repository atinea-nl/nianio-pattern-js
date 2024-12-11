import NianioStart from '../nianioPattern.js';
import { runtimeNodeJs } from '../runtimes/nodeJs.js';
import { gamePtd } from './ptds.js';
import GameNianioFunction, { gameInitState } from './game.js';
import { simpleTimerWorkerGenerator } from '../defaultWorkers/simpleTimerWorker.js';
import { httpWorkerGenerator } from '../defaultWorkers/httpWorker.js';

NianioStart({
    ptd: gamePtd,
    initState: gameInitState,
    nianioFunc: GameNianioFunction,
    workerFactories: {
        'HttpWorker': httpWorkerGenerator({ port: 9000 }),
        'TimerWorker': simpleTimerWorkerGenerator({ seconds: 10 }),
    },
    nianioRuntime: runtimeNodeJs,
});
import { NianioStart } from './nianioPattern.js';
import { gameStatePtd, gameCmdPtd, gameExtCmdPtd } from './example_http_game/ptds.js';
import { httpWorker } from './example_http_game/httpWorker.js';
import { timerWorker } from './example_http_game/timerWorker.js';
import { GameNianioFunction, gameInitState } from './example_http_game/game.js';

NianioStart(gameStatePtd, gameCmdPtd, gameExtCmdPtd, GameNianioFunction, gameInitState, {
    'HttpWorker': httpWorker,
    'TimerWorker': timerWorker,
});
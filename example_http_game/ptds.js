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
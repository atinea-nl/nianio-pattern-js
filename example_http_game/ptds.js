
const boardPtd = { 'ov.ptd_arr': { 'ov.ptd_utf8': null } };

const gameStatusPtd = {
    'ov.ptd_var': {
        'Playing': { 'ov.no_param': null },
        'UserEnded': { 'ov.no_param': null },
        'TimeOut': { 'ov.no_param': null },
        'YouWin': { 'ov.no_param': null },
        'YouLose': { 'ov.no_param': null },
        'Tie': { 'ov.no_param': null },
    }
};

export const gameStatePtd = {
    'ov.ptd_hash': {
        'ov.ptd_rec': {
            'Board': boardPtd,
            'LastTimerCallId': { 'ov.ptd_int': null },
            'State': gameStatusPtd,
        }
    }
};

export const gameCmdPtd = {
    'ov.ptd_var': {
        'HttpWorker': {
            'ov.with_param': {
                'ov.ptd_rec': {
                    'ConnectinId': { 'ov.ptd_int': null },
                    'GameId': { 'ov.ptd_utf8': null },
                    'Command': {
                        'ov.ptd_var': {
                            'StartGame': { 'ov.no_param': null },
                            'MakeMove': { 'ov.with_param': { 'ov.ptd_int': null } },
                            'EndGame': { 'ov.no_param': null },
                        }
                    },
                }
            }
        },
        'TimerWorker': {
            'ov.with_param': {
                'ov.ptd_var': {
                    'TimeOut': {
                        'ov.with_param': {
                            'ov.ptd_rec': {
                                'GameId': { 'ov.ptd_utf8': null },
                                'CallId': { 'ov.ptd_int': null },
                            }
                        }
                    },
                }
            }
        },
    }
}

export const gameExtCmdPtd = {
    'ov.ptd_var': {
        'HttpWorker': {
            'ov.with_param': {
                'ov.ptd_rec': {
                    'ConnectinId': { 'ov.ptd_int': null },
                    'Command': {
                        'ov.ptd_var': {
                            'SendBoardState': {
                                'ov.with_param': {
                                    'ov.ptd_rec': {
                                        'Board': boardPtd,
                                        'State': gameStatusPtd,
                                    }
                                }
                            },
                            'SendMessage': {
                                'ov.with_param': {
                                    'ov.ptd_rec': {
                                        'StatusCode': { 'ov.ptd_int': null },
                                        'Message': { 'ov.ptd_utf8': null },
                                    }
                                }
                            },
                        }
                    },
                }
            }
        },
        'TimerWorker': {
            'ov.with_param': {
                'ov.ptd_var': {
                    'Start': {
                        'ov.with_param': {
                            'ov.ptd_rec': {
                                'GameId': { 'ov.ptd_utf8': null },
                                'CallId': { 'ov.ptd_int': null },
                            }
                        }
                    },
                }
            }
        },
    }
}
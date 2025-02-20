
const runtimeClient = {
    logErrorBeforeTerminationFunc: ex => console.error(ex.message, ex),
    scheduleNextNianioTickFunc: func => setTimeout(func, 0),
    debugPrinter: _ => { }, // ({cmd, state, extCmds}) => console.debug(cmd, state, extCmds),
    deepCopy: val => JSON.parse(JSON.stringify(val)), // only for regular NianioStart (not needed for NianioStartWithNl)
}

export const runtimeNodeJs = {
    logErrorBeforeTerminationFunc: ex => console.error(ex.message, ex),
    scheduleNextNianioTickFunc: (func) => setImmediate(func),
    debugPrinter: _ => { }, // ({cmd, state, extCmds}) => console.debug(cmd, state, extCmds),
    deepCopy: val => JSON.parse(JSON.stringify(val)), // only for regular NianioStart (not needed for NianioStartWithNl)
}
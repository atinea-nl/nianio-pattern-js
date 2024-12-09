
export const runtimeNodeJs = {
    logErrorBeforeTerminationFunc: (ex) => console.error(JSON.stringify(ex, null, 4)),
    scheduleNextNianioTickFunc: (func) => setImmediate(func),
}
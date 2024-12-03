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

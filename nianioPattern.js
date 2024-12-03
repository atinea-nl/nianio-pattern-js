import { jsonptd } from './libs/json-ptd.js';

export function NianioStart(statePtd, cmdPtd, extCmdPtd, nianioFunction, initState, workerFactories) {
    let state;
    let queue;
    let isScheduled;
    let workers;

    function nianioTick() {
        try {
            while (queue.length > 0) {
                const command = queue.pop();
                const oldState = deepCopy(state);
                const result = nianioFunction(oldState, command);
                const newState = result['state'];
                const newStateCopy = deepCopy(newState);
                ptdEnsure(newStateCopy, statePtd);
                state = newStateCopy;

                const extCmds = result['extCmds'];
                const extCmdsCopy = [];

                for (let i = 0; i < extCmds.length; i++) {
                    const extCmdCopy = deepCopy(extCmds[i]);
                    ptdEnsure(extCmdCopy, extCmdPtd);
                    extCmdsCopy.push(extCmdCopy);
                }

                for (let i = 0; i < extCmdsCopy.length; i++) {
                    const extCmd = extCmdsCopy[i];
                    executeWorkerCommand(extCmd);
                }
            }
            isScheduled = false;
        } catch (ex) {
            process.nextTick(() => process.exit(1));
            throw ex;
        }
    }

    function executeWorkerCommand(extCmd) {
        const workerName = ptdGetVariantLabel(extCmd);
        if (!Object.hasOwn(workers, workerName)) throwNianioError(`Worker ${workerName} isn't definded`);
        const extCmdValue = extCmd[`ov.${workerName}`];
        workers[workerName](extCmdValue);
    }

    function pushCmdFromWorker(workerName) {
        return (cmd) => {
            const cmdCopy = deepCopy(cmd);
            const cmdWrappedCopy = {};
            cmdWrappedCopy[`ov.${workerName}`] = cmdCopy;
            ptdEnsure(cmdWrappedCopy, cmdPtd);
            queue.push(cmdWrappedCopy);
            if (!isScheduled) {
                process.nextTick(nianioTick);
                isScheduled = true;
            }
        };
    }

    function initNianio(initState) {
        state = initState;
        queue = [];
        isScheduled = false;
        workers = {};
        const workerNames = Object.keys(workerFactories);
        for (let i = 0; i < workerNames.length; i++) {
            const workerName = workerNames[i];
            workers[workerName] = workerFactories[workerName](pushCmdFromWorker(workerName));
        }
    }

    initNianio(initState);
}

function ptdGetVariantLabel(obj) {
    const keys = Object.keys(obj);
    if (keys.length != 1) throwNianioError(`Variant object must have exacly one value: ${obj}`);
    if (!keys[0].startsWith('ov.')) throwNianioError(`Varian label must start with 'ov.': ${obj}`);
    return keys[0].substring('ov.'.length);
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function throwNianioError(msg) {
    throw new Error(`Nianio: ${msg}`);
}

function ptdEnsure(value, ptd) {
    function stringify(obj) {
        return JSON.stringify(obj, null, 4);
    }

    if (!jsonptd.verify_type(value, ptd, {})) {
        throwNianioError(`jsonptd.verify_type error:\nPTD: ${stringify(ptd)}\nValue: ${stringify(value)}`)
    }
}

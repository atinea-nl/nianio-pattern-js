import { createServer } from 'http';

export function httpWorkerGenerator({port}) {
    if (port == null) port = 8000;

    function httpWorker(pushCmdFunc) {
        let counter = 0;
        const resHashMap = {};

        const server = createServer((req, res) => {
            const connectionId = counter;
            resHashMap[connectionId] = res;
            counter++;
            const url = req.url || '';

            pushCmdFunc({ 'ov.NewRequest' : {
                'ConnectinId': connectionId,
                'Url': url,
            }});
        });

        server.listen(8000, () => console.log(`Server running at http://localhost:${port}/`));

        function pushExtCmdFunc(extCmd) {
            const connectionId = extCmd['ConnectinId'];

            if (!Object.hasOwn(resHashMap, connectionId)) {
                pushCmdFunc({ 'ov.ConnectinIdDoesntExist' : null });
                return;
            }

            const res = resHashMap[connectionId];
            const statusCode = extCmd['StatusCode'];
            const message = extCmd['Payload'];

            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(message));
            delete resHashMap[connectionId];
        }

        return pushExtCmdFunc;
    }

    return httpWorker;
}

export const httpWorkerCmdPtd = { 'ov.ptd_var': {
    'NewRequest': { 'ov.with_param': { 'ov.ptd_rec': {
        'ConnectinId': { 'ov.ptd_int': null },
        'Url': { 'ov.ptd_utf8': null } },
    }},
    'ConnectinIdDoesntExist': { 'ov.no_param': null },
}};

export function httpWorkerExtCmdPtdFromPayload(payloadPtd) {
    return { 'ov.ptd_rec': {
        'ConnectinId': { 'ov.ptd_int': null },
        'StatusCode': { 'ov.ptd_int': null },
        'Payload': payloadPtd,
    }};
}
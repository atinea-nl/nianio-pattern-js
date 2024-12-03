import { createServer } from 'http';
import { parse } from 'url';

export function httpWorker(pushCmdFunc) {
    let counter = 0;
    const resHashMap = {};

    const server = createServer((req, res) => {
        const query = parse(req.url || '', true);
        const queryParams = query.query;

        if (!Object.hasOwn(queryParams, 'id') || !Object.hasOwn(queryParams, 'action')) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('No id or action param');
            return;
        }

        const id = queryParams['id'];
        const action = queryParams['action'];
        const thisConnectinId = counter;
        resHashMap[thisConnectinId] = res;
        counter++;

        if (action == 'start') {
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.StartGame': null },
            });
        } else if (action == 'move') {
            if (!Object.hasOwn(queryParams, 'move')) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('No move param');
                return;
            }
            const move = parseInt(queryParams['move']);
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.MakeMove': move },
            });
        } else if (action == 'end') {
            pushCmdFunc({
                'ConnectinId': thisConnectinId,
                'GameId': id,
                'Command': { 'ov.EndGame': null },
            });
        } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad action');
            return;
        }
    });

    server.listen(8000, () => console.log(`Server running at http://localhost:8000/`));

    function pushExtCmdFunc(extCmd) {
        const connectinId = extCmd['ConnectinId'];
        const command = extCmd['Command'];

        if (!Object.hasOwn(resHashMap, connectinId)) {
            throw new Error(`Invalid connectinId: ${connectinId}`);
        }
        const res = resHashMap[connectinId];

        if (Object.hasOwn(command, 'ov.SendBoardState')) {
            const extCmdValue = command['ov.SendBoardState'];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(extCmdValue));
        } else if (Object.hasOwn(command, 'ov.SendMessage')) {
            const extCmdValue = command['ov.SendMessage'];
            res.writeHead(extCmdValue['StatusCode'], { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 'Message': extCmdValue['Message'], }));
        } else {
            throw new Error(`Invalid command: ${command}`);
        }
    }

    return pushExtCmdFunc;
}
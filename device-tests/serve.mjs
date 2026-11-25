// Static server for the device tests + result collector (no dependencies).
// Usage: node device-tests/serve.mjs [port]   then open http://<this-pc-ip>:<port>/ on the TV.
// Tests POST their results to .../report; they are printed here and appended to device-tests/reports.jsonl.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    console.log(`${req.socket.remoteAddress} ${req.method} ${req.url}`);

    if (req.method === 'POST' && url.endsWith('/report')) {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            let data;
            try { data = JSON.parse(body); } catch { data = { raw: body }; }
            fs.appendFileSync(path.join(root, 'reports.jsonl'), JSON.stringify({ time: new Date().toISOString(), ip: req.socket.remoteAddress, path: url, ...data }) + '\n');
            console.log(`\n===== report from ${req.socket.remoteAddress} (${url}) =====\n${data.text || body}\n`);
            res.writeHead(204).end();
        });
        return;
    }

    // /dist/* is served from the repo's dist folder (Lightning builds).
    const base = url.startsWith('/dist/') ? path.dirname(root) : root;
    const file = path.join(base, url);
    if (!file.startsWith(base)) return res.writeHead(403).end();
    fs.stat(file, (err, st) => {
        if (err) return res.writeHead(404).end('not found');
        if (st.isDirectory()) {
            if (!url.endsWith('/')) return res.writeHead(301, { Location: url + '/' }).end();
            const links = fs.readdirSync(file).map((f) => `<li><a href="${f}">${f}</a></li>`).join('');
            return res.writeHead(200, { 'Content-Type': 'text/html' }).end(`<body style="font:28px sans-serif"><ul>${links}</ul>`);
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
    });
}).listen(port, '0.0.0.0', () => {
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
    console.log(`Serving ${root}`);
    for (const ip of ips) console.log(`  http://${ip}:${port}/rtt-check/lightning-rtt.html`);
});

/* NovelForge — NVIDIA NIM CORS Proxy
   Run: node proxy.js
   This proxies browser requests to NVIDIA's API to bypass CORS */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3457;

// MIME types for static files
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    // CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Proxy: POST /proxy/nvidia → forward to NVIDIA NIM
    if (req.method === 'POST' && req.url === '/proxy/nvidia') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const authHeader = req.headers['authorization'] || '';
            const options = {
                hostname: 'integrate.api.nvidia.com',
                port: 443,
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'Content-Length': Buffer.byteLength(body),
                },
            };

            const proxy = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', chunk => data += chunk);
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });

            proxy.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
            });

            proxy.write(body);
            proxy.end();
        });
        return;
    }

    // Static file serving
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n  NovelForge running at http://localhost:${PORT}`);
    console.log(`  NVIDIA proxy active at /proxy/nvidia\n`);
});

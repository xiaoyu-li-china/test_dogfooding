const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

const clients = new Map();

function broadcast(data, excludeClient = null) {
    const jsonData = JSON.stringify(data);
    clients.forEach((client, ws) => {
        if (ws !== excludeClient && ws.readyState === WebSocket.OPEN) {
            ws.send(jsonData);
        }
    });
}

wss.on('connection', (ws) => {
    const clientId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    clients.set(ws, { id: clientId });

    console.log('[WS] Client connected:', clientId);
    console.log('[WS] Total clients:', clients.size);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const client = clients.get(ws);

            if (data.type === 'message') {
                const messageData = {
                    type: 'message',
                    username: data.username,
                    content: data.content,
                    timestamp: Date.now()
                };
                console.log('[MSG]', data.username, ':', data.content);
                broadcast(messageData, ws);
            } else if (data.type === 'typing') {
                const typingData = {
                    type: 'typing',
                    username: data.username,
                    isTyping: data.isTyping
                };
                console.log('[TYPING]', data.username, ':', data.isTyping);
                broadcast(typingData, ws);
            }
        } catch (error) {
            console.error('[ERROR] Failed to parse message:', error.message);
        }
    });

    ws.on('close', () => {
        const client = clients.get(ws);
        console.log('[WS] Client disconnected:', client?.id);
        clients.delete(ws);
        console.log('[WS] Total clients:', clients.size);
    });

    ws.on('error', (error) => {
        console.error('[WS] Error:', error.message);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

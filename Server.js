const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;
const DB_FILE = './bike-state.json';
let bikeState = [];

// تحميل البيانات المحفوظة
if (fs.existsSync(DB_FILE)) {
    try {
        bikeState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        console.log("✅ تم تحميل البيانات المحفوظة من القرص");
    } catch (e) { console.log("⚠️ ملف الحفظ فارغ أو تالف"); }
}

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'bike-manager.html'), (err, data) => {
            if (err) { res.writeHead(404); res.end("Missing HTML file"); return; }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log("📱 جهاز جديد اتصل بالسيرفر");

    // إرسال البيانات فور الاتصال
    if (bikeState.length > 0) {
        ws.send(JSON.stringify({ type: 'update', data: bikeState }));
    }

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            if (msg.type === 'sync' || msg.type === 'update') {
                bikeState = msg.data;
                // الحفظ الفوري في ملف الـ JSON
                fs.writeFileSync(DB_FILE, JSON.stringify(bikeState, null, 2));
                
                // إرسال التحديث لكل الأجهزة المتصلة الأخرى
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'update', data: bikeState }));
                    }
                });
            }
        } catch (e) {}
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل الآن!`);
    console.log(`🔗 افتح الرابط في المتصفح: http://localhost:${PORT}`);
});

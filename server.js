const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'bike_state.json');

// ===== حفظ البيانات على القرص =====
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('خطأ في قراءة البيانات:', e.message);
  }
  return null;
}

function saveState(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.error('خطأ في حفظ البيانات:', e.message);
  }
}

let bikeState = loadState();

// ===== HTTP Server (يخدم index.html) =====
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('index.html غير موجود');
    }
    return;
  }

  // API: جلب الحالة الحالية
  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', data: bikeState }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ===== WebSocket Server =====
const wss = new WebSocketServer({ server });

let clients = new Set();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`✅ اتصال جديد من: ${ip} | إجمالي المتصلين: ${clients.size + 1}`);
  clients.add(ws);

  // أرسل الحالة الحالية للمتصل الجديد فوراً
  if (bikeState) {
    ws.send(JSON.stringify({ type: 'update', data: bikeState }));
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'update' || msg.type === 'sync') {
        bikeState = msg.data;
        saveState(bikeState);

        // بث التحديث لجميع المتصلين الآخرين
        const payload = JSON.stringify({ type: 'update', data: bikeState });
        clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(payload);
          }
        });

        console.log(`🔄 تحديث البيانات | المتصلين النشطين: ${clients.size}`);
      }

      // ping/pong للحفاظ على الاتصال
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

    } catch (e) {
      console.error('خطأ في تحليل الرسالة:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`❌ انقطع اتصال ${ip} | المتبقي: ${clients.size}`);
  });

  ws.on('error', (err) => {
    clients.delete(ws);
    console.error('خطأ WebSocket:', err.message);
  });
});

// ===== تنظيف المتصلين المنقطعين كل 30 ثانية =====
setInterval(() => {
  clients.forEach((ws) => {
    if (ws.readyState !== 1) {
      clients.delete(ws);
    }
  });
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚲 Bike Manager Server يعمل على المنفذ ${PORT}`);
  console.log(`🌐 افتح المتصفح على: http://YOUR_DROPLET_IP:${PORT}`);
  console.log(`📡 WebSocket جاهز للمزامنة\n`);
});

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

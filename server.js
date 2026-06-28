/* ============================================================
   CINE FINANCE — tiny local server (no dependencies).
   Serves this folder on http://localhost:8123 and opens the
   browser. A local server (not file://) is what lets the app
   use the File System Access API for automatic backups and
   call the Claude API. Bound to 127.0.0.1 only — never exposed
   to the network. Run via start.cmd / the desktop shortcut.
   ============================================================ */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = 8123;
const HOST = '127.0.0.1';
const URL  = `http://localhost:${PORT}/`;

const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2',
  '.ttf':'font/ttf', '.pdf':'application/pdf', '.txt':'text/plain; charset=utf-8'
};

function openBrowser(url){
  // Windows: `start`; falls back gracefully elsewhere.
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd);
}

const server = http.createServer((req, res) => {
  // strip query, decode, prevent path traversal
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' ) urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('404 — לא נמצא: ' + urlPath);
      return;
    }
    const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': type, 'Cache-Control':'no-store'});
    res.end(data);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    // An instance is already running — just open the browser to it.
    console.log('CINE FINANCE כבר פועל. פותח את הדפדפן…');
    openBrowser(URL);
    process.exit(0);
  } else {
    console.error(e);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log('CINE FINANCE פועל בכתובת ' + URL);
  console.log('להשארה פתוח — אל תסגור חלון זה כל עוד אתה עובד. לסגירה: Ctrl+C.');
  openBrowser(URL);
});

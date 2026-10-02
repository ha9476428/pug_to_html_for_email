#!/usr/bin/env node
/**
 * Dev server cho landing/ — phục vụ thẳng file nguồn (không build, không qua Pug/juice,
 * giữ nguyên @media) + tự reload trình duyệt khi sửa file.
 *
 *   npm run dev              http://localhost:3001
 *   PORT=4000 npm run dev    đổi port
 *
 * Mở design/overlay.html qua server này (http://localhost:3001/design/overlay.html)
 * thì overlay tự nạp được ảnh design/<trang>/<width>.png — mở bằng file:// thì không.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

// Thư mục gốc của project landing (landing/).
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3001;
// Không phục vụ / không theo dõi các thư mục này (tooling, ảnh output của test:pixel).
const IGNORE_DIRS = new Set(['node_modules', 'scripts', path.join('design', 'output')]);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function isIgnored(rel) {
    for (const dir of IGNORE_DIRS) {
        if (rel === dir || rel.startsWith(dir + path.sep)) return true;
    }
    return false;
}

const clients = new Set();
const reloadSnippet = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

http
    .createServer((req, res) => {
        if (req.url === '/__reload') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return;
        }
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(ROOT, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
        const rel = path.relative(ROOT, file);
        if (rel.startsWith('..') || path.isAbsolute(rel) || isIgnored(rel) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404).end('Not found');
            return;
        }
        const contentType = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
        // Chỉ file .html mới cần đọc dạng text (để chèn script reload); còn lại đọc Buffer để không hỏng file nhị phân (ảnh, font...).
        // HEAD (overlay.html dùng để dò ảnh design) chỉ trả header, không trả body.
        const body = file.endsWith('.html')
            ? fs.readFileSync(file, 'utf8').replace('</body>', `${reloadSnippet}</body>`)
            : fs.readFileSync(file);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(req.method === 'HEAD' ? undefined : body);
    })
    .listen(PORT, () => console.log(`\nLanding preview: http://localhost:${PORT}`));

let timer;
fs.watch(ROOT, { recursive: true }, (event, file) => {
    if (!file || isIgnored(file) || path.basename(file) === '.DS_Store') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
        console.log(`${event}: ${file}`);
        clients.forEach((c) => c.write('data: reload\n\n'));
    }, 100);
});
console.log('Đang theo dõi landing/ ... (Ctrl+C để dừng)');

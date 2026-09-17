#!/usr/bin/env node
/**
 * Build email: Pug -> HTML -> inline CSS (juice) -> dist/
 *
 *   node scripts/build.js            build 1 lần (HTML gọn, sẵn sàng gửi)
 *   node scripts/build.js --pretty   build HTML dễ đọc
 *   node scripts/build.js --watch    build + theo dõi thay đổi + preview http://localhost:3000
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const pug = require('pug');
const juice = require('juice').default;

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const EMAILS = path.join(SRC, 'emails');
const DATA = path.join(SRC, 'data');
const DIST = path.join(ROOT, 'dist');
const CONFIG = path.join(SRC, 'config');

const args = new Set(process.argv.slice(2));
const WATCH = args.has('--watch');
const PRETTY = args.has('--pretty') || WATCH;
const PORT = Number(process.env.PORT) || 3000;
const GMAIL_CLIP_KB = 102;

/** Nạp lại config mỗi lần build để sửa theme không cần restart. */
function loadConfig() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(CONFIG)) delete require.cache[key];
  }
  return { theme: require(path.join(CONFIG, 'theme')), h: require(path.join(CONFIG, 'helpers')) };
}

function loadData(name) {
  const file = path.join(DATA, `${name}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function listEmails() {
  return fs
    .readdirSync(EMAILS, { recursive: true })
    .filter((f) => f.endsWith('.pug') && !path.basename(f).startsWith('_'))
    .map((f) => f.split(path.sep).join('/'));
}

function beautify(html) {
  const { html: fmt } = require('js-beautify');
  return fmt(html, {
    indent_size: 4,
    wrap_line_length: 0,
    preserve_newlines: false,
    // giữ nguyên nội dung có khoảng trắng quan trọng
    unformatted: ['a', 'span', 'strong', 'b', 'em', 'i', 'sup', 'sub', 'br'],
    content_unformatted: ['pre', 'textarea', 'style'],
    extra_liners: [],
  });
}

/**
 * js-beautify không tách comment vùng (xem mixin +comment) ra dòng riêng —
 * nó dính liền vào thẻ đứng trước/sau trên cùng 1 dòng, không có thụt lề.
 * Hàm này tách từng comment ra dòng riêng, giữ đúng mức thụt lề của dòng
 * chứa nó, và chèn thêm 1 dòng trống trước mỗi comment "S" (start).
 */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const OPEN_TAG_RE = /<([a-zA-Z][\w-]*)(?:\s[^>]*)?>$/;

/** true nếu `text` kết thúc bằng 1 thẻ mở (không phải void) — nội dung theo sau nó là con, cần thụt thêm 1 cấp. */
function opensNewLevel(text) {
  const m = text.match(OPEN_TAG_RE);
  return !!m && !VOID_TAGS.has(m[1].toLowerCase());
}

function formatRegionComments(html) {
  const COMMENT_RE = /<!-- .+? : [SE] -->/g;
  const lines = html.split('\n');
  const out = [];

  for (const line of lines) {
    if (!COMMENT_RE.test(line)) {
      out.push(line);
      continue;
    }
    let indent = line.match(/^[ \t]*/)[0];

    COMMENT_RE.lastIndex = 0;
    let lastIndex = 0;
    let match;
    const segments = [];
    while ((match = COMMENT_RE.exec(line))) {
      if (match.index > lastIndex) segments.push(line.slice(lastIndex, match.index));
      segments.push(match[0]);
      lastIndex = COMMENT_RE.lastIndex;
    }
    if (lastIndex < line.length) segments.push(line.slice(lastIndex));

    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;
      if (/ : S -->$/.test(trimmed)) out.push('');
      out.push(indent + trimmed);
      // Thẻ mở (vd `<td ...>`) vừa được tách ra dòng riêng => nội dung/comment theo sau nó
      // (còn lại trên cùng dòng gốc) là con của thẻ đó, cần thụt thêm 1 cấp (4 space).
      if (opensNewLevel(trimmed)) indent += '    ';
    }
  }

  return out.join('\n');
}

function buildOne(rel, locals) {
  const name = rel.replace(/\.pug$/, '');
  const file = path.join(EMAILS, rel);
  const rendered = pug.renderFile(file, {
    basedir: SRC, // cho phép include /mixins/... (đường dẫn tuyệt đối từ src)
    ...locals,
    ...loadData(name),
    cache: false,
  });

  let html = juice(rendered, {
    removeStyleTags: true, // xoá toàn bộ <style> sau khi inline — không style nào sót lại trong <head>
    preserveMediaQueries: false,
    preserveFontFaces: false,
    preserveImportant: true,
    applyWidthAttributes: true,
    applyHeightAttributes: true,
    applyAttributesTableElements: true,
    insertPreservedExtraCss: false,
  });

  if (PRETTY) {
    html = beautify(html);
    html = formatRegionComments(html);
  }

  const out = path.join(DIST, `${name}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);

  const kb = Buffer.byteLength(html) / 1024;
  const warn = kb > GMAIL_CLIP_KB ? `  ⚠️  > ${GMAIL_CLIP_KB}KB, Gmail sẽ cắt email` : '';
  console.log(`  ✓ ${name}.html  (${kb.toFixed(1)} KB)${warn}`);
  return name;
}

function writeIndex(names) {
  const items = names.map((n) => `<li><a href="${n}.html">${n}</a></li>`).join('');
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Email preview</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px}a{color:#0B5FFF}li{margin:8px 0}</style>
<h1>Email templates</h1><ul>${items}</ul>`
  );
}

function buildAll() {
  const t0 = Date.now();
  fs.mkdirSync(DIST, { recursive: true });
  const locals = loadConfig();
  const names = [];
  let failed = 0;
  console.log('\nBuilding emails...');
  for (const rel of listEmails()) {
    try {
      names.push(buildOne(rel, locals));
    } catch (err) {
      failed++;
      console.error(`  ✗ ${rel}\n${err.message}\n`);
    }
  }
  writeIndex(names);
  console.log(`Done in ${Date.now() - t0}ms${failed ? ` — ${failed} lỗi` : ''}`);
  return failed;
}

// ---------------------------------------------------------------------------
// Dev server + live reload (chỉ khi --watch; script reload KHÔNG ghi vào file)
// ---------------------------------------------------------------------------
function serve() {
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
      const file = path.join(DIST, urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) {
        res.writeHead(404).end('Not found');
        return;
      }
      let body = fs.readFileSync(file, 'utf8');
      if (file.endsWith('.html')) body = body.replace('</body>', `${reloadSnippet}</body>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
    })
    .listen(PORT, () => console.log(`\nPreview: http://localhost:${PORT}`));

  return () => clients.forEach((c) => c.write('data: reload\n\n'));
}

async function main() {
  const failed = buildAll();
  if (!WATCH) process.exit(failed ? 1 : 0);

  const reload = serve();
  const { watch } = require('chokidar');
  let timer;
  watch(SRC, { ignoreInitial: true }).on('all', (event, file) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`\n${event}: ${path.relative(ROOT, file)}`);
      buildAll();
      reload();
    }, 100);
  });
  console.log('Đang theo dõi src/ ... (Ctrl+C để dừng)');
}

main();

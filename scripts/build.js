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
// Component demo cho Figma/design review — mỗi component 1 file, KHÔNG phải email để gửi.
const FIGMA = path.join(SRC, 'figma');
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

/** Liệt kê file .pug (không tính partial bắt đầu bằng `_`) trong 1 thư mục. */
function listPug(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true })
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

/**
 * Cảnh báo thẻ <a> có set `color` inline nhưng thiếu `!important`.
 * Gmail app (Android/iOS) và nhiều client khác tự ép màu link mặc định
 * (thường là xanh) đè lên style inline nếu không có !important — link
 * sẽ hiển thị sai màu dù code không lỗi gì.
 */
function findAnchorColorWarnings(html) {
  const warnings = [];
  const aTagRe = /<a\b[^>]*>/gi;
  let m;
  while ((m = aTagRe.exec(html))) {
    const tag = m[0];
    const styleMatch = tag.match(/\sstyle\s*=\s*"([^"]*)"/i);
    if (!styleMatch) continue;
    const hasBadColor = styleMatch[1].split(';').some((decl) => {
      const i = decl.indexOf(':');
      if (i === -1) return false;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const value = decl.slice(i + 1).trim();
      return prop === 'color' && value && !/!important/i.test(value);
    });
    if (hasBadColor) warnings.push(tag.length > 140 ? `${tag.slice(0, 140)}…` : tag);
  }
  return warnings;
}

/**
 * @param srcDir  thư mục chứa file .pug nguồn (EMAILS hoặc FIGMA)
 * @param rel     đường dẫn .pug tương đối trong srcDir, vd "welcome.pug"
 * @param outName tên dùng để ghi ra dist/ + hiện trong index, vd "welcome" hoặc "figma/buttons"
 */
function buildOne(srcDir, rel, locals, outName) {
  const file = path.join(srcDir, rel);
  const rendered = pug.renderFile(file, {
    basedir: SRC, // cho phép include /mixins/... (đường dẫn tuyệt đối từ src)
    ...locals,
    ...loadData(rel.replace(/\.pug$/, '')),
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

  const out = path.join(DIST, `${outName}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);

  const kb = Buffer.byteLength(html) / 1024;
  const warn = kb > GMAIL_CLIP_KB ? `  ⚠️  > ${GMAIL_CLIP_KB}KB, Gmail sẽ cắt email` : '';
  console.log(`  ✓ ${outName}.html  (${kb.toFixed(1)} KB)${warn}`);

  const anchorWarnings = findAnchorColorWarnings(html);
  if (anchorWarnings.length) {
    console.log(`  ⚠️  ${anchorWarnings.length} thẻ <a> đổi color thiếu !important (Gmail app/… có thể ghi đè màu):`);
    for (const w of anchorWarnings) console.log(`      ${w}`);
  }

  return outName;
}

function writeIndex(emailNames, figmaNames) {
  const list = (names) => `<ul>${names.map((n) => `<li><a href="${n}.html">${n}</a></li>`).join('')}</ul>`;
  // Figma: chỉ link tới trang tổng hợp figma/index.html, không liệt kê từng component riêng.
  const figmaSection = figmaNames.includes('figma/index')
    ? '<ul><li><a href="figma/index.html">figma/index</a></li></ul>'
    : '<p>(chưa có)</p>';
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Email preview</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px}a{color:#0B5FFF}li{margin:8px 0}h2{margin-top:32px}</style>
<h1>Email preview</h1>
<h2>Emails</h2>${emailNames.length ? list(emailNames) : '<p>(chưa có)</p>'}
<h2>Figma components</h2>${figmaSection}`
  );
}

/**
 * Tự sinh src/figma/index.pug — quét mọi `_figma-*.pug` trong src/figma/
 * (theo thứ tự alphabet của tên file) và include hết vào 1 trang tổng
 * hợp. Thêm 1 component mới (`_figma-ten.pug`) là tự xuất hiện ở đây,
 * không cần sửa tay.
 *
 * Chỉ ghi file khi nội dung thực sự đổi — tránh vòng lặp vô hạn với
 * chokidar (ghi file trong src/ mà đang bị chính nó watch).
 */
function syncFigmaIndex() {
  if (!fs.existsSync(FIGMA)) return;

  const partials = fs
    .readdirSync(FIGMA)
    .filter((f) => f.endsWith('.pug') && f.startsWith('_figma-'))
    .sort();

  const includes = partials.map((f) => `  +divider\n  include ./${f.replace(/\.pug$/, '')}`).join('\n');

  const content = `//- ⚠️ FILE TỰ SINH — đừng sửa tay, sẽ bị ghi đè ở lần build kế tiếp.
//- Xem _README.md để biết cách thêm component mới.
//-
//- Trang TỔNG HỢP DUY NHẤT — gộp toàn bộ component trong src/figma/,
//- giống trang "component library" trong Figma. Tự quét mọi file
//- _figma-*.pug trong thư mục này mỗi lần build.
extends ../layouts/layout-base

block vars
  - var title = 'Component Catalog — Overview'

block content
  +section({ padding: ['xl', 'lg', 'md'] })
    +heading(1) Component Catalog
    +spacer('xs')
    +text({ color: theme.color.textMuted }) Tổng hợp toàn bộ component trong src/figma/.
${includes ? `\n${includes}\n` : ''}`;

  const out = path.join(FIGMA, 'index.pug');
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== content) {
    fs.writeFileSync(out, content);
  }
}

function buildAll() {
  const t0 = Date.now();
  fs.mkdirSync(DIST, { recursive: true });
  const locals = loadConfig();
  const emailNames = [];
  const figmaNames = [];
  let failed = 0;

  console.log('\nBuilding emails...');
  for (const rel of listPug(EMAILS)) {
    try {
      emailNames.push(buildOne(EMAILS, rel, locals, rel.replace(/\.pug$/, '')));
    } catch (err) {
      failed++;
      console.error(`  ✗ ${rel}\n${err.message}\n`);
    }
  }

  syncFigmaIndex();
  const figmaFiles = listPug(FIGMA);
  if (figmaFiles.length) {
    console.log('\nBuilding figma components...');
    for (const rel of figmaFiles) {
      try {
        figmaNames.push(buildOne(FIGMA, rel, locals, `figma/${rel.replace(/\.pug$/, '')}`));
      } catch (err) {
        failed++;
        console.error(`  ✗ ${rel}\n${err.message}\n`);
      }
    }
  }

  writeIndex(emailNames, figmaNames);
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

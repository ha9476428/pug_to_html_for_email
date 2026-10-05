#!/usr/bin/env node
/**
 * Build email: Pug -> HTML -> inline CSS (juice) -> ../dist/email/
 *
 * Mỗi thư mục trong pages/ (bắt đầu bằng "_" => không build) chứa 1 hoặc nhiều email:
 *   pages/<thư-mục>/<file>.pug | <file>.html   mỗi file = 1 email (file bắt đầu bằng "_" = partial, không build)
 *   pages/<thư-mục>/<file>.json                dữ liệu mẫu riêng cho <file>.pug (tuỳ chọn)
 *   pages/<thư-mục>/data.json                  dữ liệu mẫu dùng chung cho mọi .pug trong thư mục (tuỳ chọn)
 *   pages/<thư-mục>/images/                    ảnh xem thử local (tuỳ chọn), dùng chung trong thư mục
 * Build ra cùng thư mục, GIỮ NGUYÊN TÊN FILE:
 *   pages/demo/demo2.pug  ->  dist/email/demo/demo2.html  (+ dist/email/demo/images/)
 *
 *   npm run build          build 1 lần (HTML gọn, sẵn sàng gửi)
 *   npm run build:pretty   build HTML dễ đọc
 *   npm run dev            build + theo dõi thay đổi + preview http://localhost:3000
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const pug = require('pug');
const juice = require('juice').default;

// Thư mục gốc của project email (email/). Bản build ghi ra dist/email/ ở thư mục gốc repo.
const ROOT = path.resolve(__dirname, '..');
const SRC = ROOT;
// Mỗi email = 1 thư mục con: pages/<tên>/index.pug|index.html (+ data.json, images/).
const PAGES = path.join(SRC, 'pages');
// Component demo cho Figma/design review — mỗi component 1 file, KHÔNG phải email để gửi.
const FIGMA = path.join(SRC, 'figma');
const DIST = path.join(ROOT, '..', 'dist', 'email');
const CONFIG = path.join(SRC, 'config');
// Các thư mục nguồn được theo dõi khi --watch (KHÔNG watch cả ROOT — sẽ dính dist/, node_modules/).
const WATCH_DIRS = ['config', 'pages', 'figma', 'layouts', 'mixins', 'partials'].map((d) => path.join(SRC, d));
// Tên thư mục trong dist/email/ đã dành cho component catalog — email không được đặt tên trùng.
const RESERVED_NAMES = new Set(['figma']);

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

function loadData(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

/** Liệt kê thư mục email trong pages/ (không tính thư mục bắt đầu bằng `_`, vd `_starter`). */
function listEmailDirs() {
    if (!fs.existsSync(PAGES)) return [];
    return fs
        .readdirSync(PAGES, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
        .map((d) => d.name)
        .sort();
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
 * Inline CSS (juice), format (nếu --pretty và format !== false), ghi ra dist/, in cảnh báo.
 * Dùng chung cho cả email viết bằng Pug (đã render ra HTML) lẫn email viết
 * thẳng bằng HTML (đọc nguyên file).
 *
 * @param rendered  chuỗi HTML đầu vào (chưa inline CSS)
 * @param outName   tên dùng để ghi ra dist/ + hiện trong index, vd "welcome" hoặc "figma/buttons"
 * @param format    false = giữ nguyên xuống dòng/thụt lề của nguồn (email viết bằng HTML), không chạy beautify
 */
/** true nếu đa số khai báo trong style="" của nguồn viết liền, không có dấu cách sau ":". */
function prefersCompactStyle(html) {
    let compact = 0;
    let spaced = 0;
    for (const [, css] of html.matchAll(/\sstyle="([^"]*)"/g)) {
        for (const decl of css.split(';')) {
            const m = decl.match(/^\s*[\w-]+(\s*):(\s*)\S/);
            if (!m) continue;
            if (m[1] || m[2]) spaced++;
            else compact++;
        }
    }
    return compact > spaced;
}

/** "margin: 0 0 8px; font-size: 12px;" -> "margin:0 0 8px;font-size:12px;" (giữ nguyên khoảng trắng TRONG giá trị). */
function compactStyle(css) {
    if (/url\(/i.test(css)) return css; // url(data:...;base64,...) có ";" bên trong — để nguyên cho an toàn
    const decls = css
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
            const i = d.indexOf(':');
            return i === -1 ? d : `${d.slice(0, i).trim()}:${d.slice(i + 1).trim()}`;
        });
    return decls.length ? `${decls.join(';')};` : '';
}

// Thẻ rỗng (void) viết kiểu "<img ... />" trong nguồn.
const SELF_CLOSING_RE = new RegExp(`<(?:${[...VOID_TAGS].join('|')})\\b[^>]*\\s/>`, 'i');
// Thẻ rỗng chưa có "/>" ở cuối (juice xuất ra dạng này).
const VOID_TAG_RE = new RegExp(`<(${[...VOID_TAGS].join('|')})\\b((?:[^>"']|"[^"]*"|'[^']*')*?)\\s*(?<!/)>`, 'gi');

function processHtml(rendered, outName, { format = true } = {}) {
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

    if (PRETTY && format) {
        html = beautify(html);
        html = formatRegionComments(html);
    } else if (!format) {
        // juice xoá <style> nhưng để lại dòng chỉ còn dấu cách/tab — dọn các dòng đó,
        // giữ nguyên dòng trống thật (không có ký tự nào) mà bạn tự viết trong nguồn.
        html = html.replace(/\n[ \t]+(?=\n)/g, '');
        // juice đổi <img ... /> thành <img ...> — nếu nguồn viết thẻ rỗng kiểu " />" thì trả lại như cũ.
        if (SELF_CLOSING_RE.test(rendered)) html = html.replace(VOID_TAG_RE, (_m, tag, attrs) => `<${tag}${attrs} />`);
        // juice viết lại style của thẻ có class thành "prop: value; prop: value;" — nếu nguồn
        // viết style liền (vd "margin:0;padding:0;") thì đưa về đúng kiểu đó.
        if (prefersCompactStyle(rendered)) html = html.replace(/\sstyle="([^"]*)"/g, (_m, css) => ` style="${compactStyle(css)}"`);
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

/**
 * @param file    đường dẫn tuyệt đối tới file .pug nguồn
 * @param data    biến riêng của email (nội dung data.json), {} nếu không có
 * @param outName tên dùng để ghi ra dist/, vd "welcome/index" hoặc "figma/index"
 */
function buildPug(file, locals, data, outName) {
    const rendered = pug.renderFile(file, {
        basedir: SRC, // cho phép extends/include /layouts/..., /mixins/... (đường dẫn tuyệt đối từ email/)
        ...locals,
        ...data,
        cache: false,
    });

    return processHtml(rendered, outName);
}

/**
 * Ghép file HTML nhỏ vào email HTML bằng comment — 2 cú pháp, dùng lẫn được:
 *
 *   SSI (Server Side Includes, chuẩn của Apache/Nginx):
 *     <!--#include file="_header.html" -->            tương đối với file đang viết
 *     <!--#include virtual="/partials/footer.html" --> tính từ thư mục email/ (có hay không có "/" đầu đều được)
 *
 *   Cú pháp riêng của project (giữ để tương thích):
 *     <!-- @include _header.html -->                   tương đối với file đang viết
 *     <!-- @include /partials/footer.html -->          bắt đầu bằng "/" = tính từ thư mục email/
 *
 * File được include cũng có thể include tiếp file khác. Đặt tên file nhỏ bắt đầu
 * bằng "_" (vd _header.html) để nó không bị build thành 1 email riêng.
 *
 * Include file .pug (vd <!--#include file="_banner.pug" -->): file được render ra HTML
 * trước khi ghép — xem renderPugPartial().
 */
const SSI_INCLUDE_RE = /<!--#include\s+(file|virtual)\s*=\s*(["'])(.*?)\2\s*-->/g;
const AT_INCLUDE_RE = /<!--\s*@include\s+(["']?)([^"'\s]+)\1\s*-->/g;

/**
 * Render 1 file .pug nhỏ được include vào email HTML: có sẵn `theme`, `h`, dữ liệu
 * data.json của thư mục và toàn bộ mixin (+button, +text...) — không cần tự include
 * /mixins/index. Kết quả được format xuống dòng/thụt lề cho dễ đọc.
 */
function renderPugPartial(file, ctx) {
    let source = fs.readFileSync(file, 'utf8');
    // Tự nạp mixin, trừ khi file dùng `extends` (extends bắt buộc phải là dòng đầu tiên).
    const addedLines = /^\s*extends\s/m.test(source) ? 0 : 1;
    if (addedLines) source = `include /mixins/index\n${source}`;
    let html;
    try {
        html = pug.render(source, {
            filename: file, // để include/extends tương đối và báo lỗi đúng tên file
            basedir: SRC,
            ...ctx.locals,
            ...ctx.data,
            cache: false,
        });
    } catch (err) {
        // Lỗi trong chính file này: trừ dòng include mixin đã chèn thêm để số dòng khớp file thật.
        if (err.filename === file && typeof err.line === 'number') {
            throw new Error(`${path.relative(SRC, file)}:${err.line - addedLines}${err.column ? `:${err.column}` : ''}\n${err.msg}`);
        }
        throw err;
    }
    return beautify(html).trim();
}

function resolveHtmlIncludes(file, ctx, stack = []) {
    const rel = (f) => path.relative(SRC, f);
    if (stack.includes(file)) {
        throw new Error(`Include vòng lặp: ${[...stack, file].map(rel).join(' -> ')}`);
    }

    // fromRoot = true: đường dẫn tính từ email/; false: tương đối với file đang viết.
    // Nội dung ghép vào được thụt lề theo đúng vị trí dòng include, để bản build trông như viết tay.
    const include = (target, fromRoot, offset, source) => {
        const included = fromRoot ? path.join(SRC, target) : path.resolve(path.dirname(file), target);
        if (!fs.existsSync(included)) {
            throw new Error(`Không tìm thấy file include "${target}" (trong ${rel(file)}) — đã tìm ở ${rel(included)}`);
        }
        const content = (
            included.endsWith('.pug') ? renderPugPartial(included, ctx) : resolveHtmlIncludes(included, ctx, [...stack, file])
        ).replace(/\s+$/, '');
        const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
        const before = source.slice(lineStart, offset);
        const indent = /^[ \t]*$/.test(before) ? before : '';
        return content.replace(/\n(?=[^\n])/g, `\n${indent}`);
    };

    return fs
        .readFileSync(file, 'utf8')
        .replace(SSI_INCLUDE_RE, (_m, kind, _q, target, offset, source) => include(target, kind === 'virtual', offset, source))
        .replace(AT_INCLUDE_RE, (_m, _q, target, offset, source) => include(target, target.startsWith('/'), offset, source));
}

/**
 * Email viết thẳng bằng HTML (không qua Pug) — ghép các file include, rồi vẫn được
 * inline CSS (juice) + cảnh báo dung lượng/màu link như email viết bằng Pug.
 */
function buildHtml(file, locals, data, outName) {
    return processHtml(resolveHtmlIncludes(file, { locals, data }), outName, { format: false });
}

/**
 * Liệt kê file nguồn email trong pages/<name>/ — mọi .pug/.html nằm trực tiếp trong
 * thư mục (không tính file bắt đầu bằng "_": partial dùng để include).
 */
function listEmailSources(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((f) => f.isFile() && /\.(pug|html)$/.test(f.name) && !f.name.startsWith('_'))
        .map((f) => f.name)
        .sort();
}

/**
 * Build mọi email trong thư mục pages/<name>/ ra dist/email/<name>/, giữ nguyên tên file:
 * pages/<name>/demo2.pug -> dist/email/<name>/demo2.html.
 * Lỗi của từng file được in ra và đếm riêng, không chặn các file khác trong thư mục.
 *
 * @returns {{ built: string[], failed: number }}  built = outName đã build, vd ["demo/demo2"]
 */
function buildEmailFolder(name, locals) {
    if (RESERVED_NAMES.has(name)) throw new Error(`Tên "${name}" đã dành cho dist/email/${name}/ — đổi tên thư mục email khác.`);
    const dir = path.join(PAGES, name);
    const sources = listEmailSources(dir);
    if (!sources.length) {
        console.log(`  – bỏ qua pages/${name}/ (chưa có file .pug hoặc .html)`);
        return { built: [], failed: 0 };
    }

    const built = [];
    let failed = 0;
    const seen = new Map(); // tên không đuôi -> file đã gặp, để bắt trùng demo2.pug + demo2.html
    for (const file of sources) {
        const base = file.replace(/\.(pug|html)$/, '');
        const outName = `${name}/${base}`;
        try {
            if (seen.has(base)) {
                throw new Error(`Trùng tên với ${seen.get(base)} — cả 2 đều build ra ${base}.html, đổi tên 1 file.`);
            }
            seen.set(base, file);
            const source = path.join(dir, file);
            const ownData = path.join(dir, `${base}.json`);
            const data = loadData(fs.existsSync(ownData) ? ownData : path.join(dir, 'data.json'));
            if (file.endsWith('.pug')) buildPug(source, locals, data, outName);
            else buildHtml(source, locals, data, outName); // data dùng cho file .pug được #include vào
            built.push(outName);
        } catch (err) {
            failed++;
            console.error(`  ✗ pages/${name}/${file}\n${err.message}\n`);
        }
    }

    if (built.length && copyEmailImages(name)) console.log(`      ảnh: pages/${name}/images/ -> dist/email/${name}/images/`);
    return { built, failed };
}

/**
 * Copy pages/<name>/images/ (nếu có ảnh) nguyên trạng vào dist/email/<name>/images/.
 * Chỉ để XEM THỬ LOCAL khi dev — email client không đọc được file trên máy bạn,
 * trước khi gửi thật phải đổi src ảnh sang URL đã host public.
 */
const IMAGES_SKIP = new Set(['.DS_Store', '.gitkeep', 'README.md']);

function copyEmailImages(name) {
    const src = path.join(PAGES, name, 'images');
    if (!fs.existsSync(src)) return false;
    const files = fs.readdirSync(src, { recursive: true }).filter((f) => !IMAGES_SKIP.has(path.basename(f)));
    if (!files.length) return false;
    fs.cpSync(src, path.join(DIST, name, 'images'), {
        recursive: true,
        filter: (file) => !IMAGES_SKIP.has(path.basename(file)),
    });
    return true;
}

function writeIndex(emailNames, figmaNames) {
    const list = (names) => `<ul>${names.map((n) => `<li><a href="${n}.html">${n}.html</a></li>`).join('')}</ul>`;
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
 * Tự sinh figma/index.pug — quét mọi `_figma-*.pug` trong figma/
 * (theo thứ tự alphabet của tên file) và include hết vào 1 trang tổng
 * hợp. Thêm 1 component mới (`_figma-ten.pug`) là tự xuất hiện ở đây,
 * không cần sửa tay.
 *
 * Chỉ ghi file khi nội dung thực sự đổi — tránh vòng lặp vô hạn với
 * chokidar (ghi file trong figma/ mà đang bị chính nó watch).
 */
function syncFigmaIndex() {
    if (!fs.existsSync(FIGMA)) return;

    const partials = fs
        .readdirSync(FIGMA)
        .filter((f) => f.endsWith('.pug') && f.startsWith('_figma-'))
        .sort();

    const includes = partials.map((f) => `    +divider\n    include ./${f.replace(/\.pug$/, '')}`).join('\n');

    const content = `//- ⚠️ FILE TỰ SINH — đừng sửa tay, sẽ bị ghi đè ở lần build kế tiếp.
//- Xem _README.md để biết cách thêm component mới.
//-
//- Trang TỔNG HỢP DUY NHẤT — gộp toàn bộ component trong email/figma/,
//- giống trang "component library" trong Figma. Tự quét mọi file
//- _figma-*.pug trong thư mục này mỗi lần build.
extends ../layouts/layout-base

block vars
    - var title = 'Component Catalog — Overview'

block content
    +section({ padding: ['xl', 'lg', 'md'] })
        +heading(1) Component Catalog
        +spacer('xs')
        +text({ color: theme.color.textMuted }) Tổng hợp toàn bộ component trong email/figma/.
${includes ? `\n${includes}\n` : ''}`;

    const out = path.join(FIGMA, 'index.pug');
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== content) {
        fs.writeFileSync(out, content);
    }
}

function buildAll() {
    const t0 = Date.now();
    // Xoá dist/email/ cũ để email đã xoá/đổi tên không còn sót lại thư mục build cũ.
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });
    const locals = loadConfig();
    const emailNames = [];
    const figmaNames = [];
    let failed = 0;

    console.log('\nBuilding emails...');
    for (const name of listEmailDirs()) {
        try {
            const result = buildEmailFolder(name, locals);
            emailNames.push(...result.built);
            failed += result.failed;
        } catch (err) {
            failed++;
            console.error(`  ✗ pages/${name}/\n${err.message}\n`);
        }
    }

    syncFigmaIndex();
    const figmaFiles = listPug(FIGMA);
    if (figmaFiles.length) {
        console.log('\nBuilding figma components...');
        for (const rel of figmaFiles) {
            try {
                figmaNames.push(buildPug(path.join(FIGMA, rel), locals, {}, `figma/${rel.replace(/\.pug$/, '')}`));
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
            const contentType = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
            // Chỉ file .html mới cần đọc dạng text (để chèn script reload); còn lại đọc Buffer để không hỏng file nhị phân (ảnh, font...).
            const body = file.endsWith('.html')
                ? fs.readFileSync(file, 'utf8').replace('</body>', `${reloadSnippet}</body>`)
                : fs.readFileSync(file);
            res.writeHead(200, { 'Content-Type': contentType }).end(body);
        })
        .listen(PORT, () => console.log(`\nPreview: http://localhost:${PORT}`));

    return () => clients.forEach((c) => c.write('data: reload\n\n'));
}

async function main() {
    const failed = buildAll();
    if (!WATCH) process.exit(failed ? 1 : 0);

    const reload = serve();
    const { watch } = require('chokidar');
    const watchDirs = WATCH_DIRS.filter((d) => fs.existsSync(d));
    let timer;
    watch(watchDirs, { ignoreInitial: true }).on('all', (event, file) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            console.log(`\n${event}: ${path.relative(ROOT, file)}`);
            buildAll();
            reload();
        }, 100);
    });
    console.log(`Đang theo dõi ${watchDirs.map((d) => path.relative(ROOT, d) || '.').join(', ')} ... (Ctrl+C để dừng)`);
}

main();

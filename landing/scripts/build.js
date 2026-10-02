#!/usr/bin/env node
/**
 * Build landing: copy nguyên trạng file trang (html, css/, images/, js/...) vào dist/ —
 * không qua Pug/juice, giữ nguyên @media. dist/ là bản sạch để deploy/upload,
 * không kèm tooling (scripts/, design/, package.json, README...).
 *
 *   npm run build
 */
const fs = require('node:fs');
const path = require('node:path');

// Thư mục gốc của project landing (landing/).
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Không copy vào dist/: tooling, ảnh thiết kế để test, chính dist/.
const EXCLUDE = new Set(['dist', 'node_modules', 'scripts', 'design', 'package.json', 'README.md', '.DS_Store']);

function build() {
    const t0 = Date.now();
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });

    const copied = [];
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
        if (EXCLUDE.has(entry.name)) continue;
        fs.cpSync(path.join(ROOT, entry.name), path.join(DIST, entry.name), {
            recursive: true,
            filter: (src) => path.basename(src) !== '.DS_Store',
        });
        copied.push(entry.isDirectory() ? `${entry.name}/` : entry.name);
    }

    console.log('\nBuilding landing...');
    for (const name of copied.sort()) console.log(`  ✓ ${name}`);
    console.log(`Done in ${Date.now() - t0}ms -> ${path.relative(process.cwd(), DIST) || '.'}`);
}

build();

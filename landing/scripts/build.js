#!/usr/bin/env node
/**
 * Build landing: copy nguyên trạng file trang (html, css/, images/, js/...) vào
 * dist/landing/ ở thư mục gốc repo — không qua Pug/juice, giữ nguyên @media. Đây là bản sạch để deploy/upload,
 * không kèm tooling (scripts/, design/, package.json, README...).
 *
 *   npm run build
 */
const fs = require('node:fs');
const path = require('node:path');

// Thư mục gốc của project landing (landing/).
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, '..', 'dist', 'landing');

// Không copy vào dist/landing/: tooling, ảnh thiết kế để test.
const EXCLUDE = new Set(['node_modules', 'scripts', 'design', 'package.json', 'README.md', '.DS_Store']);

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

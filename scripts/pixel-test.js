#!/usr/bin/env node
/**
 * Pixel-perfect test cho landing/ — so ảnh thiết kế (PNG) với ảnh chụp
 * thực tế của trang tại từng breakpoint, xuất ảnh diff (chỗ khác nhau tô đỏ)
 * + % sai lệch.
 *
 *   npm run test:pixel                chạy hết breakpoint có ảnh design
 *   npm run test:pixel -- --threshold=2   đổi ngưỡng % lỗi cho phép (mặc định 1%)
 *
 * Ảnh thiết kế: đặt vào landing/design/<width>.png (vd landing/design/1200.png).
 * Thiếu ảnh cho breakpoint nào thì breakpoint đó tự bị bỏ qua (không lỗi).
 * Kết quả (ảnh chụp thực tế + ảnh diff) ghi vào landing/design/output/ — không commit vào git.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default;

const ROOT = path.resolve(__dirname, '..');
const LANDING = path.join(ROOT, 'landing');
const DESIGN_DIR = path.join(LANDING, 'design');
const OUTPUT_DIR = path.join(DESIGN_DIR, 'output');
const PAGE_URL = `file://${path.join(LANDING, 'index.html')}`;

const BREAKPOINTS = [1200, 768, 375];

const args = process.argv.slice(2);
const thresholdArg = args.find((a) => a.startsWith('--threshold='));
const THRESHOLD_PCT = thresholdArg ? Number(thresholdArg.split('=')[1]) : 1;

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Cắt (không scale) 1 ảnh PNG về đúng width/height chỉ định, căn góc trên-trái. */
function cropTo(png, width, height) {
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, Math.min(width, png.width), Math.min(height, png.height), 0, 0);
  return out;
}

async function shoot(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  const buffer = await page.screenshot({ fullPage: true });
  await page.close();
  return PNG.sync.read(buffer);
}

async function main() {
  if (!fs.existsSync(path.join(LANDING, 'index.html'))) {
    console.error(`Không tìm thấy ${path.join(LANDING, 'index.html')}`);
    process.exit(1);
  }

  const jobs = BREAKPOINTS.map((width) => ({
    width,
    designFile: path.join(DESIGN_DIR, `${width}.png`),
  })).filter((job) => {
    if (!fs.existsSync(job.designFile)) {
      console.log(`— bỏ qua ${job.width}px (chưa có landing/design/${job.width}.png)`);
      return false;
    }
    return true;
  });

  if (!jobs.length) {
    console.log(`\nChưa có ảnh thiết kế nào. Đặt file vào landing/design/<width>.png, vd:`);
    for (const w of BREAKPOINTS) console.log(`  landing/design/${w}.png`);
    process.exit(0);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  let hasFail = false;

  console.log(`\nPixel test — ngưỡng cho phép: ${THRESHOLD_PCT}%\n`);

  for (const { width, designFile } of jobs) {
    const design = readPng(designFile);
    const actualRaw = await shoot(browser, width);

    const w = Math.max(design.width, actualRaw.width);
    const h = Math.max(design.height, actualRaw.height);
    const designPadded = cropTo(design, w, h);
    const actualPadded = cropTo(actualRaw, w, h);

    const diff = new PNG({ width: w, height: h });
    const mismatched = pixelmatch(designPadded.data, actualPadded.data, diff.data, w, h, {
      threshold: 0.1,
      diffColor: [255, 0, 0],
    });

    const pct = (mismatched / (w * h)) * 100;
    const pass = pct <= THRESHOLD_PCT;
    if (!pass) hasFail = true;

    const actualOut = path.join(OUTPUT_DIR, `${width}-actual.png`);
    const diffOut = path.join(OUTPUT_DIR, `${width}-diff.png`);
    fs.writeFileSync(actualOut, PNG.sync.write(actualPadded));
    fs.writeFileSync(diffOut, PNG.sync.write(diff));

    const status = pass ? '✓ PASS' : '✗ FAIL';
    console.log(
      `${status}  ${width}px  —  lệch ${pct.toFixed(2)}%  (design ${design.width}x${design.height}, thực tế ${actualRaw.width}x${actualRaw.height})`
    );
    console.log(`         actual: ${path.relative(ROOT, actualOut)}`);
    console.log(`         diff:   ${path.relative(ROOT, diffOut)}\n`);
  }

  await browser.close();
  process.exit(hasFail ? 1 : 0);
}

main();

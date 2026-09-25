#!/usr/bin/env node
/**
 * Pixel-perfect test cho landing/ — so ảnh thiết kế (PNG) với ảnh chụp
 * thực tế của TỪNG TRANG .html trong landing/ (index.html, index2.html...)
 * ở từng breakpoint, xuất ảnh diff (chỗ khác nhau tô đỏ) + % sai lệch.
 *
 *   npm run test:pixel                    chạy hết trang/breakpoint có ảnh design
 *   npm run test:pixel -- --threshold=2   đổi ngưỡng % lỗi cho phép (mặc định 1%)
 *
 * Ảnh thiết kế: landing/design/<tên-trang>/<width>.png
 *   vd trang landing/index.html    -> landing/design/index/1200.png
 *      trang landing/index2.html  -> landing/design/index2/1200.png
 * Trang/breakpoint nào chưa có ảnh thì tự bị bỏ qua (không lỗi).
 * Kết quả (ảnh chụp thực tế + ảnh diff) ghi vào landing/design/output/<tên-trang>/ — không commit vào git.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default;

// Thư mục gốc của project landing (landing/).
const ROOT = path.resolve(__dirname, '..');
const LANDING = ROOT;
const DESIGN_DIR = path.join(LANDING, 'design');
const OUTPUT_DIR = path.join(DESIGN_DIR, 'output');

const BREAKPOINTS = [1200, 768, 375];

const args = process.argv.slice(2);
const thresholdArg = args.find((a) => a.startsWith('--threshold='));
const THRESHOLD_PCT = thresholdArg ? Number(thresholdArg.split('=')[1]) : 1;

/** Mọi trang .html nằm trực tiếp trong landing/ (không tính file trong css/js/images/design/scripts). */
function listLandingPages() {
  return fs
    .readdirSync(LANDING, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.html'))
    .map((f) => f.name.replace(/\.html$/, ''))
    .sort();
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Cắt (không scale) 1 ảnh PNG về đúng width/height chỉ định, căn góc trên-trái. */
function cropTo(png, width, height) {
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, Math.min(width, png.width), Math.min(height, png.height), 0, 0);
  return out;
}

async function shoot(browser, pageUrl, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  const buffer = await page.screenshot({ fullPage: true });
  await page.close();
  return PNG.sync.read(buffer);
}

async function main() {
  const pages = listLandingPages();
  if (!pages.length) {
    console.error(`Không tìm thấy trang .html nào trong ${LANDING}`);
    process.exit(1);
  }

  const pageJobs = pages
    .map((pageName) => {
      const pageDesignDir = path.join(DESIGN_DIR, pageName);
      const jobs = BREAKPOINTS.map((width) => ({
        width,
        designFile: path.join(pageDesignDir, `${width}.png`),
      })).filter((job) => fs.existsSync(job.designFile));
      return { pageName, jobs };
    })
    .filter(({ pageName, jobs }) => {
      if (!jobs.length) {
        console.log(`— bỏ qua trang "${pageName}.html" (chưa có ảnh trong design/${pageName}/)`);
        return false;
      }
      return true;
    });

  if (!pageJobs.length) {
    console.log(`\nChưa có ảnh thiết kế nào. Đặt file vào design/<tên-trang>/<width>.png, vd:`);
    for (const p of pages) for (const w of BREAKPOINTS) console.log(`  design/${p}/${w}.png`);
    process.exit(0);
  }

  const browser = await chromium.launch();
  let hasFail = false;

  console.log(`\nPixel test — ngưỡng cho phép: ${THRESHOLD_PCT}%`);

  for (const { pageName, jobs } of pageJobs) {
    const pageUrl = `file://${path.join(LANDING, `${pageName}.html`)}`;
    const pageOutputDir = path.join(OUTPUT_DIR, pageName);
    fs.mkdirSync(pageOutputDir, { recursive: true });

    console.log(`\n${pageName}.html`);

    for (const { width, designFile } of jobs) {
      const design = readPng(designFile);
      const actualRaw = await shoot(browser, pageUrl, width);

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

      const actualOut = path.join(pageOutputDir, `${width}-actual.png`);
      const diffOut = path.join(pageOutputDir, `${width}-diff.png`);
      fs.writeFileSync(actualOut, PNG.sync.write(actualPadded));
      fs.writeFileSync(diffOut, PNG.sync.write(diff));

      const status = pass ? '✓ PASS' : '✗ FAIL';
      console.log(
        `  ${status}  ${width}px  —  lệch ${pct.toFixed(2)}%  (design ${design.width}x${design.height}, thực tế ${actualRaw.width}x${actualRaw.height})`
      );
      console.log(`           actual: ${path.relative(ROOT, actualOut)}`);
      console.log(`           diff:   ${path.relative(ROOT, diffOut)}`);
    }
  }

  await browser.close();
  console.log('');
  process.exit(hasFail ? 1 : 0);
}

main();

# landing/

Landing page viết tay bằng **HTML/CSS/JS thuần** — không qua Pug, không qua juice, nên `@media`, CSS trong `css/`, ảnh trong `images/` giữ nguyên trạng. Không có bước build: file trong thư mục này chính là bản chạy thật.

> Email (Pug → HTML inline CSS) nằm ở project riêng [`../email/`](../email/README.md). Pipeline email **xoá sạch `@media`** khi build (email client không hỗ trợ media query đáng tin cậy), nên landing cần responsive thật phải tách hẳn ra đây.

## Chạy

```bash
cd landing
npm install          # hoặc chạy 1 lần `npm install` ở thư mục gốc repo
npm run dev          # http://localhost:3001 — tự reload khi sửa file
npm run test:pixel   # so trang với ảnh thiết kế (xem bên dưới)
```

Hoặc từ thư mục gốc repo: `npm run dev:landing`, `npm run test:pixel`.

Không cần server cũng được — mở thẳng `index.html` bằng trình duyệt.

## Cấu trúc

```
landing/
├── package.json
├── index.html            # trang landing (link tới css/, images/ bằng đường dẫn tương đối)
├── css/
│   ├── reset.css         # modern CSS reset, load trước style.css
│   └── style.css         # toàn bộ CSS, kể cả @media 1200/768/375
├── images/
│   └── hero-product.svg  # ảnh cho landing page — thêm ảnh mới vào đây
├── design/               # ảnh thiết kế để test pixel-perfect + overlay.html
│   └── README.md
└── scripts/
    ├── dev.js            # npm run dev — static server + live reload
    └── pixel-test.js     # npm run test:pixel — so trang với ảnh thiết kế
```

## Test pixel-perfect

So mọi trang `.html` trong `landing/` (tự phát hiện — `index.html`, `index2.html`...) với ảnh thiết kế (PNG) tại từng breakpoint 1200/768/375, dùng Playwright chụp ảnh thực tế + `pixelmatch` để diff:

```bash
npm run test:pixel
```

Đặt ảnh thiết kế vào `design/<tên-trang>/<width>.png` (vd `design/index/1200.png`) trước khi chạy — xem chi tiết ở [`design/README.md`](design/README.md). Breakpoint chưa có ảnh sẽ tự bị bỏ qua.

Muốn so bằng mắt thay vì chờ script: mở [`design/overlay.html`](design/overlay.html) — chọn ảnh thiết kế, kéo chồng lên trang thật với độ mờ tuỳ chỉnh để canh khớp. Mở qua `npm run dev` (`http://localhost:3001/design/overlay.html`) thì overlay tự nạp luôn ảnh trong `design/<trang>/<width>.png`.

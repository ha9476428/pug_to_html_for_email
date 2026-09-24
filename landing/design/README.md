# landing/design/

Ảnh thiết kế (export từ Figma/Photoshop...) để test pixel-perfect cho các trang `.html` trong `landing/` (`index.html`, và mọi trang khác bạn tạo thêm — vd `index2.html`).

Đặt file PNG vào theo **từng trang**, tên theo breakpoint:

```
landing/design/index/1200.png       # cho landing/index.html
landing/design/index/768.png
landing/design/index/375.png

landing/design/index2/1200.png      # cho landing/index2.html (nếu có)
landing/design/index2/768.png
landing/design/index2/375.png
```

Rồi chạy:

```bash
npm run test:pixel
```

> Lần chạy đầu tiên (sau `npm install`) sẽ tự tải Chromium cho Playwright (~280MB, một lần duy nhất, có cache lại — script `pretest:pixel` tự lo, không cần chạy tay `npx playwright install`).

Script tự quét **mọi trang `.html`** nằm trực tiếp trong `landing/` (không cần khai báo gì thêm), mở từng trang bằng Chromium (Playwright) ở đúng width tương ứng, chụp full-page, so với ảnh thiết kế bằng `pixelmatch`, in ra % sai lệch cho từng trang/breakpoint (ngưỡng mặc định 1%, đổi bằng `npm run test:pixel -- --threshold=2`).

Kết quả (ảnh chụp thực tế + ảnh diff tô đỏ chỗ khác nhau) ghi vào `landing/design/output/<tên-trang>/` — thư mục này **không commit vào git** (đã thêm vào `.gitignore`), tự sinh lại mỗi lần chạy.

Trang/breakpoint nào chưa có ảnh thiết kế tương ứng sẽ tự bị bỏ qua, không báo lỗi.

## So bằng mắt — kéo lớp ảnh mờ chồng lên trang (`overlay.html`)

Ngoài test tự động, có công cụ mở bằng trình duyệt để tự tay so bằng mắt: đặt ảnh thiết kế mờ chồng lên đúng trang đang chạy, kéo để canh khớp.

```bash
open landing/design/overlay.html
```

(hoặc double-click file trong Finder — không cần server, mở thẳng bằng `file://` là chạy được)

- Chọn **trang** (`index.html`, `index2.html`...) ở dropdown đầu tiên
- Chọn **breakpoint** (1200/768/375) — trang bên dưới tự co theo đúng width đó (kể cả `@media`)
- Nút **Ảnh thiết kế** → chọn file PNG bất kỳ trên máy (không cần đặt tên/đúng thư mục như test tự động)
- Thanh **Độ mờ** — kéo để chỉnh độ trong suốt của lớp ảnh
- **Kéo ảnh** bằng chuột để canh cho khớp; phím mũi tên nhích từng 1px (giữ Shift = 10px); nút **Reset vị trí** đưa ảnh về góc trên-trái
- **Blend → Difference**: chỗ nào 2 lớp khác nhau sẽ nổi sáng lên — soi lệch chính xác hơn so bằng mắt thường

**Tạo trang mới (vd `landing/index2.html`)** — tool tự phát hiện file `.html` mới, chỉ cần thêm 1 dòng vào mảng `PAGES` ở đầu thẻ `<script>` trong `overlay.html`:

```js
var PAGES = [
    { id: 'index', label: 'index.html' },
    { id: 'index2', label: 'index2.html' },   // <- thêm dòng này
];
```

(`npm run test:pixel` thì không cần sửa gì — tự quét mọi trang.)

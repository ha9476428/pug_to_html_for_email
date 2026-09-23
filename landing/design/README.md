# landing/design/

Ảnh thiết kế (export từ Figma/Photoshop...) để test pixel-perfect cho `landing/index.html`.

Đặt file PNG đặt tên theo breakpoint:

```
landing/design/1200.png
landing/design/768.png
landing/design/375.png
```

Rồi chạy:

```bash
npm run test:pixel
```

Script mở `landing/index.html` bằng Chromium (Playwright) ở đúng width tương ứng, chụp full-page, so với ảnh thiết kế bằng `pixelmatch`, in ra % sai lệch cho từng breakpoint (ngưỡng mặc định 1%, đổi bằng `npm run test:pixel -- --threshold=2`).

Kết quả (ảnh chụp thực tế + ảnh diff tô đỏ chỗ khác nhau) ghi vào `landing/design/output/` — thư mục này **không commit vào git** (đã thêm vào `.gitignore`), tự sinh lại mỗi lần chạy.

Breakpoint nào chưa có ảnh thiết kế tương ứng sẽ tự bị bỏ qua, không báo lỗi.

## So bằng mắt — kéo lớp ảnh mờ chồng lên trang (`overlay.html`)

Ngoài test tự động, có công cụ mở bằng trình duyệt để tự tay so bằng mắt: đặt ảnh thiết kế mờ chồng lên đúng trang đang chạy, kéo để canh khớp.

```bash
open landing/design/overlay.html
```

(hoặc double-click file trong Finder — không cần server, mở thẳng bằng `file://` là chạy được)

- Chọn breakpoint (1200/768/375) — trang bên dưới tự co theo đúng width đó (kể cả `@media`)
- Nút **Ảnh thiết kế** → chọn file PNG bất kỳ trên máy (không cần đặt tên/đúng thư mục như test tự động)
- Thanh **Độ mờ** — kéo để chỉnh độ trong suốt của lớp ảnh
- **Kéo ảnh** bằng chuột để canh cho khớp; phím mũi tên nhích từng 1px (giữ Shift = 10px); nút **Reset vị trí** đưa ảnh về góc trên-trái
- **Blend → Difference**: chỗ nào 2 lớp khác nhau sẽ nổi sáng lên — soi lệch chính xác hơn so bằng mắt thường

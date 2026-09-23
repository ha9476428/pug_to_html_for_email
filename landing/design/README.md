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

# mail/images/

Ảnh để **xem thử local khi dev** — build tự copy nguyên trạng vào `dist/images/`, xem được qua `http://localhost:3000/images/<tên-file>` khi chạy `npm run dev`.

## ⚠️ Không dùng để gửi email thật

Khi người nhận mở email, email client (Gmail, Outlook, Apple Mail...) tải ảnh **trực tiếp qua internet** — không đọc được `dist/` hay bất kỳ file nào trên máy bạn. Ảnh đặt ở đây **chỉ để xem trước lúc code**, trước khi gửi thật phải:

1. Upload ảnh lên nơi host public (S3, Cloudinary, imgur, GitHub raw...)
2. Đổi `src` trong `.pug`/`.html` sang URL đã host đó

## Cách dùng

Đặt file ảnh vào đây, ví dụ `mail/images/banner.png`, rồi tham chiếu trong email (cùng thư mục `dist/`, nên chỉ cần path tương đối):

**Pug** (dùng mixin `+image`):

```pug
+image('images/banner.png', 'Banner khuyến mãi', 600)
```

**HTML thuần**:

```html
<img src="images/banner.png" alt="Banner khuyến mãi" width="600" />
```

Build lại (`npm run build` hoặc để `npm run dev` tự rebuild) — ảnh sẽ hiện đúng khi xem `dist/<tên-email>.html` qua `http://localhost:3000/`.

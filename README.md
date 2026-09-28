# pug_to_html_for_email

Repo gồm **2 project tách riêng**, mỗi project có `package.json`, script và README của riêng nó:

| Thư mục | Dùng để | Công nghệ | Chạy |
|---|---|---|---|
| [`email/`](email/README.md) | Làm **email HTML** (Gmail, Apple Mail, Outlook.com, app di động) | Pug → juice (inline 100% CSS, xoá `@media`) → `email/dist/` | `npm run dev:email` → http://localhost:3000 |
| [`landing/`](landing/README.md) | Làm **landing page** responsive | HTML/CSS/JS viết tay, giữ nguyên `@media`, không cần build | `npm run dev:landing` → http://localhost:3001 |

Hai project không dùng chung code hay thư mục build — sửa bên này không ảnh hưởng bên kia.

## Bắt đầu

```bash
git clone https://github.com/ha9476428/pug_to_html_for_email.git
cd pug_to_html_for_email
npm install          # cài 1 lần cho cả email/ lẫn landing/ (npm workspaces)
```

Yêu cầu Node.js ≥ 20.

Lệnh chạy từ thư mục gốc:

```bash
npm run dev:email           # email: build + watch + live reload (port 3000)
npm run build:email         # email: build HTML gọn vào email/dist/ (dùng để gửi)
npm run build:email:pretty  # email: build HTML có thụt lề, dễ đọc

npm run dev:landing         # landing: static server + live reload (port 3001)
npm run test:pixel          # landing: so trang với ảnh thiết kế
```

Hoặc `cd email` / `cd landing` rồi chạy `npm run dev`, `npm run build`... như một project bình thường. Chi tiết từng bên xem README trong thư mục tương ứng.

```
email/      # project email — xem email/README.md
landing/    # project landing page — xem landing/README.md
```

## License

MIT

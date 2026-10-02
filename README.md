# pug_to_html_for_email

Repo gồm **2 project tách riêng**, mỗi project có `package.json`, script và README của riêng nó:

| Thư mục | Dùng để | Công nghệ | Chạy |
|---|---|---|---|
| [`email/`](email/README.md) | Làm **email HTML** (Gmail, Apple Mail, Outlook.com, app di động) | Pug → juice (inline 100% CSS, xoá `@media`) → build ra `dist/email/` | `npm run dev:email` → http://localhost:3000 |
| [`landing/`](landing/README.md) | Làm **landing page** responsive | HTML/CSS/JS viết tay, giữ nguyên `@media` → build ra `dist/landing/` | `npm run dev:landing` → http://localhost:3001 |

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
npm run dev                 # chạy CẢ 2 cùng lúc: email (port 3000) + landing (port 3001)
npm run dev:email           # chỉ email: build + watch + live reload (port 3000)
npm run dev:landing         # chỉ landing: static server + live reload (port 3001)

npm run build               # build cả 2: email -> dist/email/, landing -> dist/landing/
npm run build:email         # chỉ email: HTML gọn vào dist/email/ (dùng để gửi)
npm run build:email:pretty  # chỉ email: HTML có thụt lề, dễ đọc
npm run build:landing       # chỉ landing: copy trang vào dist/landing/ (dùng để deploy)

npm run test:pixel          # landing: so trang với ảnh thiết kế
```

Hoặc `cd email` / `cd landing` rồi chạy `npm run dev`, `npm run build`... như một project bình thường. Chi tiết từng bên xem README trong thư mục tương ứng.

```
email/                  # nguồn email — xem email/README.md
├── pages/              # mỗi thư mục: các file .pug/.html (mỗi file 1 email) + images/
│   ├── welcome/
│   └── flash-sale/
└── layouts/ mixins/ partials/ config/ figma/ scripts/
landing/                # nguồn landing page — xem landing/README.md
├── index.html css/ images/
└── design/ scripts/
dist/                   # ⬅ toàn bộ bản build
├── email/              #    mỗi email 1 thư mục
│   ├── welcome/        #    index.html + images/ (giữ nguyên tên file gốc)
│   └── flash-sale/
└── landing/            #    index.html + css/ + images/
```

## License

MIT

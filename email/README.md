# email/

Bộ khung viết **email HTML bằng Pug**, build ra HTML **100% inline style** (không còn `<style>` nào trong `<head>`) — dùng tốt trên Gmail, Apple Mail, Outlook.com, các app di động.

- Dùng đủ **template (`extends`) → `block` → `mixin`** của Pug
- **Biến dùng chung một chỗ** (`config/theme.js`): màu, font-family, cỡ chữ, spacing… không phải khai báo lại
- **Helper style** (`h.font()`, `h.pad()`) để khỏi gõ lại `font-family`, `line-height`
- Build tự inline toàn bộ CSS (juice), tự cảnh báo nếu email > 102KB (Gmail cắt) hoặc thẻ `<a>` đổi màu thiếu `!important`
- `npm run dev`: xem trước + tự reload khi sửa file

> **Không hỗ trợ Outlook desktop / responsive qua media query.** Xem mục [Giới hạn](#giới-hạn) bên dưới.
>
> Landing page (responsive, có `@media`) nằm ở project riêng [`../landing/`](../landing/README.md).

## Chạy

```bash
cd email
npm install          # hoặc chạy 1 lần `npm install` ở thư mục gốc repo
npm run dev          # http://localhost:3000 — build + watch + live reload
npm run build        # build HTML gọn vào ../dist/email/ (dùng để gửi)
npm run build:pretty # build HTML có thụt lề (4 space), dễ đọc
```

Hoặc từ thư mục gốc repo: `npm run dev:email`, `npm run build:email`, `npm run build:email:pretty`.

## Cấu trúc

```
email/
├── package.json
├── scripts/
│   └── build.js         # pages/<tên>/index.pug|html -> juice (inline CSS) -> ../dist/email/<tên>/index.html
├── config/
│   ├── theme.js         # ⭐ biến dùng chung: màu, font, size, spacing, brand
│   └── helpers.js       # h.font(), h.pad(), h.reset
├── layouts/
│   └── layout-base.pug  # layout gốc: <head>, khung container, các block
├── mixins/
│   ├── index.pug        # gom mixin (layout đã include sẵn)
│   ├── _layout.pug      # container, section, columns/column, spacer, divider
│   ├── _content.pug     # preheader, heading, text, link, button, image, infoTable/infoRow
│   └── _debug.pug       # comment(label) — đánh dấu vùng trong HTML build ra
├── partials/
│   ├── header.pug       # header mặc định (logo)
│   └── footer.pug       # footer mặc định
├── pages/               # ⭐ mỗi email = 1 thư mục riêng
│   ├── _starter/        # mẫu Pug để copy (bắt đầu bằng "_" => không build)
│   ├── _starter-html/   # mẫu HTML thuần để copy — xem mục bên dưới
│   ├── welcome/
│   │   ├── index.pug    # nguồn email (index.pug HOẶC index.html)
│   │   └── images/      # ảnh XEM THỬ LOCAL của email này (không dùng khi gửi thật)
│   ├── order-confirmation/
│   │   ├── index.pug
│   │   ├── data.json    # dữ liệu mẫu (tuỳ chọn) — key thành biến trong template
│   │   └── images/
│   └── flash-sale/
│       ├── index.html   # email viết thẳng bằng HTML
│       └── images/
└── figma/               # component catalog — xem mục riêng bên dưới
    ├── _README.md
    ├── _figma-buttons.pug ... _figma-typography.pug
    └── index.pug        # ⚠️ file TỰ SINH, đừng sửa tay
```

Bản build **không** nằm trong `email/` mà ở `dist/email/` (thư mục gốc repo):

```
dist/email/              # HTML đã build — mỗi email 1 thư mục, có commit vào git
├── index.html           # trang liệt kê mọi email (khi npm run dev)
├── welcome/
│   ├── index.html
│   └── images/          # copy từ email/pages/welcome/images/ (nếu có ảnh)
├── order-confirmation/
├── flash-sale/
└── figma/
```

## Biến dùng chung — không khai báo lại

`theme` và `h` được build script truyền vào **mọi** file `.pug`:

```pug
p(style=h.reset + h.font({ size: 'sm', weight: 'semibold', color: theme.color.primary }))
  | Nội dung
```

`h.font()` sinh ra:

```
font-family:'Inter', Arial, Helvetica, sans-serif;font-size:14px;font-weight:600;
line-height:21px;color:#0B5FFF
```

Đổi font / màu toàn bộ email: chỉ sửa `config/theme.js`.

Trong CSS (`style.`) vẫn dùng được biến qua `#{}` — CSS này sẽ được **inline hết** vào thẻ tương ứng khi build (không còn sót lại trong `<head>`):

```pug
block styles
  style.
    .badge { color: #{theme.color.secondary}; font-family: #{theme.font.family}; }
```

## Template & block

Mọi email `extends` layout và chỉ ghi đè block cần thiết:

| Block     | Mục đích                                      | Mặc định          |
|-----------|-----------------------------------------------|-------------------|
| `vars`    | `title`, `preheader`, `lang`, `unsubscribeUrl`, biến riêng | tên brand |
| `styles`  | CSS riêng (được inline khi build)             | trống             |
| `header`  | phần đầu email                                | `partials/header` |
| `content` | nội dung chính                                | —                 |
| `footer`  | phần cuối email                               | `partials/footer` |

```pug
extends ../layouts/layout-base

block vars
  - var title = 'Đặt lại mật khẩu'
  - var preheader = 'Link có hiệu lực trong 15 phút'

block content
  +section
    +heading(1) Đặt lại mật khẩu
    +spacer('md')
    +text Nhấn nút bên dưới để tạo mật khẩu mới.
    +spacer('lg')
    +button('Đặt lại mật khẩu', 'https://example.com/reset')

//- Bỏ header mặc định:
block header
```

## Mixin

| Mixin | Ví dụ |
|---|---|
| `+container(width)` | layout đã dùng sẵn |
| `+section(opts)` | `+section({ bg: theme.color.primary, padding: ['xl','lg'], align: 'center' })` |
| `+columns(opts)` / `+column(width, opts)` | xem bên dưới |
| `+spacer(size)` | `+spacer('lg')` hoặc `+spacer(20)` |
| `+divider(opts)` | `+divider({ color: theme.color.border, spacing: 'md' })` |
| `+heading(level, opts)` | `+heading(2, { align: 'center' }) Tiêu đề` |
| `+text(opts)` | `+text({ size: 'sm', color: theme.color.textMuted }) Nội dung` |
| `+link(href, opts)` | `+link('https://...') Xem thêm` |
| `+button(label, href, opts)` | `+button('Mua ngay', url, { bg: theme.color.secondary, width: 240, radius: 24 })` |
| `+image(src, alt, width, opts)` | `+image(url, 'Banner', 600, { href: link })` |
| `+infoTable` / `+infoRow(label, value, opts)` | bảng "nhãn — giá trị" (đơn hàng, giao dịch…) |
| `+preheader(text)` | layout tự gọi khi có biến `preheader` |
| `+comment(label)` | bọc 1 block, sinh cặp `<!-- LABEL : S -->` / `<!-- LABEL : E -->` để dò trong View Source |

Cột hybrid (tự xếp chồng trên mobile, **không cần media query**):

```pug
+section
  +columns
    +column(276)
      +text Cột trái
    +column(276)
      +text Cột phải
```

> Tổng width các cột = bề rộng khả dụng (600 − padding của section; mặc định 600 − 24×2 = 552).

## Component catalog (`figma/`)

Nơi xem trước toàn bộ mixin/partial dùng chung — giống trang "component library" trong Figma, build ra `dist/email/figma/index.html` (thư mục gốc repo). Chi tiết đầy đủ ở [`figma/_README.md`](figma/_README.md), tóm tắt:

- Mỗi component 1 file `_figma-ten.pug` (chỉ nội dung, không tự build riêng).
- `index.pug` **tự sinh** mỗi lần build: quét mọi `_figma-*.pug` trong thư mục, include hết theo thứ tự alphabet của tên file. Thêm component mới = chỉ cần tạo file `_figma-ten.pug`, không cần sửa `index.pug`.

## Giới hạn

Đây là quyết định có chủ đích, không phải thiếu sót:

- **Không hỗ trợ Outlook desktop** (Word rendering engine) — đã bỏ hết `<!--[if mso]>`, ghost table, nút VML. Outlook desktop có thể hiện nút vuông, cột xếp dọc thay vì hybrid.
- **Không dùng media query** — mọi CSS đều inline 100%, kể cả trong `<head>` cũng không còn `<style>` nào. Layout co giãn nhờ kỹ thuật "hybrid columns" (bảng lồng bảng) chứ không phải `@media`.
- Đổi lại: HTML gọn hơn, không rủi ro client cắt bớt `<style>` trong `<head>`, và chắc chắn hiển thị đúng trên Gmail/Apple Mail/Outlook.com/app di động — nơi đa số người dùng thực tế đọc mail.

Build tự cảnh báo (console) khi:
- Email > 102KB — Gmail sẽ cắt phần còn lại.
- Thẻ `<a>` có `color` nhưng thiếu `!important` — Gmail app (Android/iOS) hay ép màu link mặc định đè lên nếu thiếu.

## Tạo email mới

1. Copy cả thư mục `pages/_starter/` → `pages/ten-email/` (tên thư mục = tên email, không bắt đầu bằng `_`, không đặt là `figma`; nên dùng `-` thay dấu cách, vd `quater-3`)
2. Sửa `pages/ten-email/index.pug` (đặt tên khác cũng được, vd `quater-3.pug`, miễn trong thư mục chỉ có **1** file `.pug`/`.html` — build luôn ra `index.html`)
3. (Tuỳ chọn) tạo `pages/ten-email/data.json` — các key trong JSON thành biến trong template
4. (Tuỳ chọn) bỏ ảnh vào `pages/ten-email/images/`
5. `npm run dev` và mở `http://localhost:3000` → build ra `dist/email/ten-email/index.html`

Email dùng `extends /layouts/layout-base` (đường dẫn tính từ `email/`) nên không phải sửa đường dẫn khi đổi tên/di chuyển thư mục.

### Viết thẳng bằng HTML (không dùng Pug)

Không muốn học Pug? Copy cả thư mục `pages/_starter-html/` → `pages/ten-email/` và code HTML/CSS bình thường trong `index.html`. Build vẫn:

- **Inline hết CSS** trong thẻ `<style>` vào từng thẻ (juice) — xoá `<style>` khỏi `<head>`
- Cảnh báo email > 102KB hoặc `<a>` đổi màu thiếu `!important`
- Hiện trong trang danh sách `http://localhost:3000` và tự reload khi `npm run dev`

Đổi lại: không có `theme`/`h`, block/mixin, hay nạp `data.json` — mọi biến, style phải viết tay trong chính file `.html`. Mỗi thư mục email chỉ chứa **1** file nguồn `.pug` hoặc `.html` (nên đặt tên `index`). Có nhiều file thì build ưu tiên `index.pug`/`index.html`; không có `index` mà lại có nhiều file thì báo lỗi. Thư mục chưa có file nguồn nào thì tạm bỏ qua.

### Ảnh trong email

Email thật **luôn cần URL ảnh đã host public** — Gmail/Outlook/Apple Mail tải ảnh qua internet khi người nhận mở email, không đọc được file trên máy bạn hay `dist/`. Xem `theme.brand.logo` trong `config/theme.js` làm ví dụ (URL `placehold.co`).

Muốn xem thử ảnh cục bộ khi đang code (trước khi có link host)? Mỗi email có thư mục `images/` riêng — đặt file vào `pages/<tên>/images/`, build tự copy vào `dist/email/<tên>/images/`, nên trong email chỉ cần path tương đối:

```pug
+image('images/banner.png', 'Banner khuyến mãi', 600)
```

```html
<img src="images/banner.png" alt="Banner khuyến mãi" width="600" />
```

Xem được qua `http://localhost:3000/<tên>/` khi chạy `npm run dev`.

⚠️ **Nhớ đổi sang URL host thật trước khi gửi** (upload lên S3, Cloudinary, CDN... rồi đổi `src`) — ảnh local chỉ để xem trước lúc dev.

## Kiểm tra trước khi gửi

Nên test thực tế trên Litmus / Email on Acid / Testi@, hoặc gửi thử tới Gmail (web + app), Apple Mail, Outlook.com.

## `dist/email/`

Thư mục `dist/email/` ở thư mục gốc repo (HTML đã build, inline CSS) có commit vào git — sau khi sửa email, nhớ `npm run build` rồi commit lại `dist/email/` cùng lúc để repo luôn có bản build mới nhất. Mỗi lần build sẽ xoá rồi tạo lại `dist/email/` (không đụng tới `dist/landing/`).

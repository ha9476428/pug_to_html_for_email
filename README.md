# pug_to_html_for_email

Bộ khung viết **email HTML bằng Pug**, build ra HTML **100% inline style** (không còn `<style>` nào trong `<head>`) — dùng tốt trên Gmail, Apple Mail, Outlook.com, các app di động.

- Dùng đủ **template (`extends`) → `block` → `mixin`** của Pug
- **Biến dùng chung một chỗ** (`src/config/theme.js`): màu, font-family, cỡ chữ, spacing… không phải khai báo lại
- **Helper style** (`h.font()`, `h.pad()`) để khỏi gõ lại `font-family`, `line-height`
- Build tự inline toàn bộ CSS (juice), tự cảnh báo nếu email > 102KB (Gmail cắt) hoặc thẻ `<a>` đổi màu thiếu `!important`
- `npm run dev`: xem trước + tự reload khi sửa file

> **Không hỗ trợ Outlook desktop / responsive qua media query.** Xem mục [Giới hạn](#giới-hạn) bên dưới.

## Bắt đầu

```bash
git clone https://github.com/ha9476428/pug_to_html_for_email.git
cd pug_to_html_for_email
```

```bash
npm install
npm run dev          # http://localhost:3000 — build + watch + live reload
npm run build        # build HTML gọn vào dist/ (dùng để gửi)
npm run build:pretty # build HTML có thụt lề (4 space), dễ đọc
```

Yêu cầu Node.js ≥ 20.

## Cấu trúc

```
src/
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
├── data/
│   └── <tên-email>.json # dữ liệu mẫu, tự nạp theo tên file email
├── emails/
│   ├── _starter.pug     # file mẫu để copy (bắt đầu bằng "_" => không build)
│   ├── welcome.pug
│   └── order-confirmation.pug
└── figma/                    # component catalog — xem mục riêng bên dưới
    ├── _README.md
    ├── _figma-buttons.pug ... _figma-typography.pug
    └── index.pug              # ⚠️ file TỰ SINH, đừng sửa tay
scripts/build.js               # Pug -> HTML -> juice (inline CSS) -> dist/
dist/                          # HTML đã build — có commit vào git
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

Đổi font / màu toàn bộ email: chỉ sửa `src/config/theme.js`.

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

## Component catalog (`src/figma/`)

Nơi xem trước toàn bộ mixin/partial dùng chung — giống trang "component library" trong Figma, build ra `dist/figma/index.html`. Chi tiết đầy đủ ở [`src/figma/_README.md`](src/figma/_README.md), tóm tắt:

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

1. Copy `src/emails/_starter.pug` → `src/emails/ten-email.pug`
2. (Tuỳ chọn) tạo `src/data/ten-email.json` — các key trong JSON thành biến trong template
3. `npm run dev` và mở `http://localhost:3000`

## Kiểm tra trước khi gửi

Nên test thực tế trên Litmus / Email on Acid / Testi@, hoặc gửi thử tới Gmail (web + app), Apple Mail, Outlook.com.

## `dist/`

Thư mục `dist/` (HTML đã build, inline CSS) có commit vào git — sau khi sửa `src/`, nhớ `npm run build` rồi commit lại `dist/` cùng lúc để repo luôn có bản build mới nhất.

## License

MIT

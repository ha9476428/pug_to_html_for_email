# pug_to_html_for_email

Bộ khung viết **email HTML bằng Pug**, build ra HTML đã inline CSS, **tương thích Outlook** (desktop Windows, Outlook.com), Gmail, Apple Mail.

- Dùng đủ **template (`extends`) → `block` → `mixin`** của Pug
- **Biến dùng chung một chỗ** (`src/config/theme.js`): màu, font-family, cỡ chữ, spacing… không phải khai báo lại
- **Helper style** (`h.font()`, `h.pad()`) để khỏi gõ lại `font-family`, `line-height`, `mso-line-height-rule`
- Mixin sẵn sàng cho Outlook: ghost table, nút VML bo góc, cột hybrid tự xếp chồng trên mobile
- `npm run dev`: xem trước + tự reload khi sửa file

## Bắt đầu

```bash
git clone https://github.com/ha9476428/pug_to_html_for_email.git
cd pug_to_html_for_email
```

```bash
npm install
npm run dev          # http://localhost:3000 — build + watch + live reload
npm run build        # build HTML gọn vào dist/ (dùng để gửi)
npm run build:pretty # build HTML có thụt lề, dễ đọc
```

Yêu cầu Node.js ≥ 20.

## Cấu trúc

```
src/
├── config/
│   ├── theme.js        # ⭐ biến dùng chung: màu, font, size, spacing, brand
│   └── helpers.js      # h.font(), h.pad(), h.reset
├── layouts/
│   └── base.pug        # layout gốc: <head>, MSO fix, khung container, các block
├── mixins/
│   ├── index.pug       # gom mixin (layout đã include sẵn)
│   ├── _layout.pug     # container, section, columns/column, spacer, divider
│   └── _content.pug    # preheader, heading, text, link, button, image, infoTable/infoRow
├── partials/
│   ├── header.pug      # header mặc định (logo)
│   └── footer.pug      # footer mặc định
├── data/
│   └── <tên-email>.json  # dữ liệu mẫu, tự nạp theo tên file email
└── emails/
    ├── _starter.pug    # file mẫu để copy (bắt đầu bằng "_" => không build)
    ├── welcome.pug
    └── order-confirmation.pug
scripts/build.js        # Pug -> HTML -> juice (inline CSS) -> dist/
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
line-height:21px;mso-line-height-rule:exactly;color:#0B5FFF
```

Đổi font / màu toàn bộ email: chỉ sửa `src/config/theme.js`.

Trong CSS (`style.`) vẫn dùng được biến qua `#{}`:

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
extends ../layouts/base

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
| `+container(width)` | layout đã dùng sẵn (ghost table cho Outlook) |
| `+section(opts)` | `+section({ bg: theme.color.primary, padding: ['xl','lg'], align: 'center' })(class="mobile-pad")` |
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

Cột hybrid (nằm ngang trên desktop/Outlook, tự xếp chồng trên mobile, **không cần media query**):

```pug
+section
  +columns
    +column(276)
      +text Cột trái
    +column(276)
      +text Cột phải
```

> Tổng width các cột = bề rộng khả dụng (600 − padding của section; mặc định 600 − 24×2 = 552).

## Những gì đã xử lý cho Outlook

- `xmlns:v` / `xmlns:o` + `OfficeDocumentSettings` (PixelsPerInch 96) để ảnh không bị phóng to
- Ép font fallback (`theme.font.msoFallback`) — tránh Outlook rơi về Times New Roman khi dùng web font
- Web font bọc trong `<!--[if !mso]>` để Outlook bỏ qua
- Ghost table cho container và cột (Outlook không hiểu `max-width`, `inline-block`)
- Nút VML `v:roundrect` (bo góc + nền màu trong Outlook)
- `mso-line-height-rule:exactly` + line-height tính bằng px
- Spacer dùng `<td height>` thay cho margin
- `mso-table-lspace/rspace`, `border-collapse`, `-ms-interpolation-mode`
- Ảnh luôn có thuộc tính `width`

Ngoài ra: fix link tự động của Apple Mail/Samsung, preheader có ký tự đệm, cảnh báo khi email > 102KB (Gmail sẽ cắt).

## Tạo email mới

1. Copy `src/emails/_starter.pug` → `src/emails/ten-email.pug`
2. (Tuỳ chọn) tạo `src/data/ten-email.json` — các key trong JSON thành biến trong template
3. `npm run dev` và mở `http://localhost:3000`

## Kiểm tra trước khi gửi

Nên test thực tế trên Litmus / Email on Acid / Testi@, hoặc gửi thử tới Outlook desktop (Windows), Outlook.com, Gmail (web + app) và Apple Mail.

## License

MIT

# src/figma/

Component demo cho design review — KHÔNG phải email để gửi. Build qua
cùng pipeline Pug -> inline CSS (juice) như email thật, nên những gì
thấy ở đây đúng với sản phẩm cuối.

- `npm run dev` -> mở `http://localhost:3000` -> link "figma/index".
- Build ra 1 trang duy nhất: `dist/figma/index.html` — gộp toàn bộ
  component, giống trang "component library" trong Figma.

## Cấu trúc

- `_ten.pug` — nội dung demo của 1 component. Bắt đầu bằng `_` nên
  KHÔNG tự build thành trang riêng (giống quy ước trong `src/mixins/`).
- `index.pug` — `extends ../layouts/base`, rồi `include` lần lượt
  từng `_ten.pug`, ngăn cách bằng `+divider`.

"Component" ở đây không chỉ là mixin trong `src/mixins/` — partial dùng
chung trong `src/partials/` (`header.pug`, `footer.pug`) cũng là
component, nên cũng có demo riêng: `_header.pug`, `_footer.pug`.

## Thêm component mới

1. Tạo `_ten.pug`. Nếu demo 1 mixin (`src/mixins/`):

   ```pug
   +section({ padding: ['lg', 'lg', 'sm'] })
     +heading(2) Tên component
     +spacer('xs')
     +text({ color: theme.color.textMuted }) Mô tả ngắn — src/mixins/_xxx.pug

   +section({ padding: [0, 'lg', 'lg'] })
     +mixinName(...)
   ```

   Nếu demo 1 partial (`src/partials/`) — partial thường đã tự bọc
   `+section(...)` riêng nên KHÔNG bọc thêm lần nữa:

   ```pug
   +section({ padding: ['lg', 'lg', 'sm'] })
     +heading(2) Tên component
     +spacer('xs')
     +text({ color: theme.color.textMuted }) Mô tả ngắn — src/partials/ten.pug

   include ../partials/ten
   ```

2. Thêm vào `index.pug`: `+divider` rồi `include _ten`.

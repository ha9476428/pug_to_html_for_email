# src/figma/

Component demo cho design review — KHÔNG phải email để gửi. Build qua
cùng pipeline Pug -> inline CSS (juice) như email thật, nên những gì
thấy ở đây đúng với sản phẩm cuối.

- `npm run dev` -> mở `http://localhost:3000` -> link "figma/index".
- Build ra 1 trang duy nhất: `dist/figma/index.html` — gộp toàn bộ
  component, giống trang "component library" trong Figma.

"Component" ở đây không chỉ là mixin trong `src/mixins/` — partial dùng
chung trong `src/partials/` (`header.pug`, `footer.pug`) cũng là
component, nên cũng có demo riêng.

## index.pug là file TỰ SINH — đừng sửa tay

Mỗi lần build, script tự quét mọi file `_figma-*.pug` trong thư mục
này (theo thứ tự **alphabet** của tên file) và ghi đè `index.pug` để
include hết vào 1 trang tổng hợp. **Thêm 1 component mới = chỉ cần
tạo file `_figma-ten.pug`, không cần đụng vào `index.pug`.**

`_figma-` là tiền tố bắt buộc — đánh dấu đây là component "align với
Figma" (có demo trong catalog này), và khiến `build.js` không tự build
file thành trang riêng (giống cách dấu `_` được dùng trong
`src/mixins/`).

Không có cơ chế kiểm soát thứ tự riêng — thứ tự hiển thị đúng bằng thứ
tự alphabet của tên file (vd `_figma-buttons.pug` hiện trước
`_figma-colors.pug`). Muốn 1 component hiện ở vị trí cụ thể thì tự đặt
tên sao cho đúng alphabet.

## Thêm component mới

1. Tạo `_figma-ten.pug`. Nếu demo 1 mixin (`src/mixins/`):

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

2. Chạy `npm run dev` (hoặc `npm run build`) — component tự xuất hiện
   trong `figma/index.html`, không cần sửa gì thêm.

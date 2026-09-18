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

Mỗi lần build, script tự quét mọi file `_design-*.pug` trong thư mục
này (theo thứ tự alphabet) và ghi đè `index.pug` để include hết vào 1
trang tổng hợp. **Thêm 1 component mới = chỉ cần tạo file
`_design-NN-ten.pug`, không cần đụng vào `index.pug`.**

`_design-` là tiền tố bắt buộc — đánh dấu đây là component "align với
Figma" (có demo trong catalog này). Nó cũng khiến `build.js` không tự
build file thành trang riêng (giống cách dấu `_` được dùng trong
`src/mixins/`).

Vì thứ tự hiển thị dựa trên tên file, phần số sau `_design-` dùng để
kiểm soát thứ tự:

```
_design-00-header.pug
_design-10-colors.pug
_design-20-typography.pug
_design-30-buttons.pug
_design-40-link.pug
_design-50-columns.pug
_design-60-info-table.pug
_design-70-comment-markers.pug
_design-80-image.pug
_design-90-footer.pug
```

Cách nhau 10 để dễ chèn thêm ở giữa (vd `_design-35-badge.pug` để chèn
giữa buttons và link) mà không phải đổi số hàng loạt.

## Thêm component mới

1. Tạo `_design-NN-ten.pug` (chọn số phù hợp vị trí muốn hiển thị). Nếu
   demo 1 mixin (`src/mixins/`):

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

# src/figma/

Component demo cho design review — KHÔNG phải email để gửi. Build qua
cùng pipeline Pug -> inline CSS (juice) như email thật, nên những gì
thấy ở đây đúng với sản phẩm cuối.

- `npm run dev` -> mở `http://localhost:3000` -> mục "Figma components".
- Mỗi component build ra `dist/figma/<tên>.html`.
- `dist/figma/index.html` — trang tổng hợp TẤT CẢ component vào 1 trang
  để xem nhanh, giống trang "component library" trong Figma.

## Cấu trúc: nội dung tách riêng khỏi trang

Mỗi component có 2 file:

- `_ten.pug` — chỉ nội dung demo (không `extends`, không `block`).
  Bắt đầu bằng `_` nên KHÔNG build thành trang riêng (giống quy ước
  trong `src/mixins/`).
- `ten.pug` — trang đứng riêng, `extends ../layouts/base` rồi
  `include _ten`.

`index.pug` include lại toàn bộ `_ten.pug` theo thứ tự, nối bằng
`+divider`, để có 1 trang tổng hợp — sửa nội dung ở `_ten.pug` thì cả
trang riêng lẫn trang tổng hợp đều cập nhật theo, không cần sửa 2 nơi.

## Thêm component mới

1. Tạo `_ten.pug`:

   ```pug
   +section({ padding: ['lg', 'lg', 'sm'] })
     +heading(2) Tên component
     +spacer('xs')
     +text({ color: theme.color.textMuted }) Mô tả ngắn — src/mixins/_xxx.pug

   +section({ padding: [0, 'lg', 'lg'] })
     +mixinName(...)
   ```

2. Tạo `ten.pug`:

   ```pug
   extends ../layouts/base

   block vars
     - var title = 'Tên component — mixinName()'

   block content
     include _ten
   ```

3. Thêm `include _ten` (kèm `+divider` trước nó) vào `index.pug`.

/**
 * HELPERS — các đoạn style lặp lại (font-family, line-height...) gom thành hàm.
 * Được truyền vào mọi template dưới tên `h`.
 *
 *   p(style=h.font({ size: 'sm', color: theme.color.textMuted }))
 */
const theme = require('./theme');

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

/** Chuỗi style chữ chuẩn cho email. */
function font({
  size = 'base',
  weight = 'regular',
  color = theme.color.text,
  lineHeight = 'base',
  align,
} = {}) {
  const fs = typeof size === 'number' ? size : theme.font.size[size];
  const fw = typeof weight === 'number' ? weight : theme.font.weight[weight];
  const lhRatio = typeof lineHeight === 'number' ? lineHeight : theme.font.lineHeight[lineHeight];
  const lh = Math.round(fs * lhRatio);
  return [
    `font-family:${theme.font.family}`,
    `font-size:${fs}px`,
    `font-weight:${fw}`,
    `line-height:${lh}px`,
    `color:${color}`,
    align ? `text-align:${align}` : '',
  ]
    .filter(Boolean)
    .join(';');
}

/** Reset margin cho p / h1..h6 (Outlook tự thêm margin). */
const reset = 'margin:0;padding:0;';

/** Padding nhanh: pad('md') | pad('md','lg') | pad(8, 16, 8, 16) */
function pad(...vals) {
  return `padding:${vals.map((v) => px(theme.space[v] ?? v)).join(' ')};`;
}

module.exports = { font, reset, pad, px };

/**
 * THEME — nguồn biến dùng chung DUY NHẤT cho mọi email.
 * Build script tự truyền object này vào mọi file .pug dưới tên `theme`
 * => không cần khai báo lại màu, font, kích thước trong từng template.
 *
 * Dùng trong Pug:  td(style=`color:${theme.color.text};`)
 */
module.exports = {
    // Bề rộng nội dung email (px). 600 là chuẩn an toàn cho Outlook/Gmail.
    width: 600,

    // Font stack — luôn có fallback hệ thống nếu web font không tải được.
    font: {
        family: "'Inter', Arial, Helvetica, sans-serif",
        // Web font (chỉ client hỗ trợ mới tải; để '' nếu không dùng)
        webfontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
        size: { xs: 12, sm: 14, base: 16, lg: 20, xl: 24, xxl: 32 },
        lineHeight: { tight: 1.25, base: 1.5 },
        weight: { regular: 400, semibold: 600, bold: 700 },
    },

    color: {
        primary: '#0B5FFF',
        primaryDark: '#0847C2',
        secondary: '#00B894',
        text: '#1F2937',
        textMuted: '#6B7280',
        textInverse: '#FFFFFF',
        bgBody: '#F3F4F6', // nền ngoài email
        bgContent: '#FFFFFF', // nền khung nội dung
        border: '#E5E7EB',
        danger: '#DC2626',
    },

    space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },

    radius: { sm: 4, md: 8, pill: 999 },

    // Thông tin thương hiệu — sửa theo dự án
    brand: {
        name: 'Your Brand',
        logo: 'https://placehold.co/140x40/0B5FFF/FFFFFF?text=LOGO',
        logoWidth: 140,
        logoHeight: 40,
        url: 'https://example.com',
        address: '123 Đường ABC, Quận 1, TP. Hồ Chí Minh',
        supportEmail: 'support@example.com',
    },
};

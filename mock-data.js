// Dữ liệu mẫu ban đầu cho ứng dụng QR Check-In (Hệ thống Tuyển sinh THPT)
const INITIAL_USERS = [
    {
        id: "usr-admin",
        email: "mchieu.nguyen@gmail.com",
        password: "Minhga@678548",
        name: "Nguyễn Minh Chiêu",
        role: "admin", // admin, manager, user
        department: "Ban Tổ Chức"
    }
];

const INITIAL_CUSTOMERS = [
    {
        id: "TIC-8801",
        HoVaTen: "Phạm Minh Hoàng",
        SoDienThoai: "0912345678",
        Email: "hoang.pham@example.com",
        TruongTHPT: "THPT Chuyên Lê Hồng Phong",
        ChungChiTiengAnh: "IELTS 7.5",
        ChungChiTuyenSinhQuocTe: "SAT 1450",
        TraiNghiemHoatDong: "Chủ nhiệm CLB Robot, Đạt giải Nhất khoa học kỹ thuật cấp Tỉnh",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8801",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8802",
        HoVaTen: "Nguyễn Thị Mai Chi",
        SoDienThoai: "0987654321",
        Email: "chi.nguyen@example.com",
        TruongTHPT: "THPT Chuyên Trần Đại Nghĩa",
        ChungChiTiengAnh: "IELTS 8.0",
        ChungChiTuyenSinhQuocTe: "ACT 34",
        TraiNghiemHoatDong: "Thành viên Đội tuyển HSG Tiếng Anh, Tình nguyện viên Mùa hè xanh",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8802",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8803",
        HoVaTen: "Lê Anh Tuấn",
        SoDienThoai: "0905556667",
        Email: "tuan.le@example.com",
        TruongTHPT: "THPT Nguyễn Thượng Hiền",
        ChungChiTiengAnh: "IELTS 6.5",
        ChungChiTuyenSinhQuocTe: "SAT 1350",
        TraiNghiemHoatDong: "Lớp trưởng 12A1, Huy chương Đồng điền kinh học sinh thành phố",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8803",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8804",
        HoVaTen: "Trần Quốc Bảo",
        SoDienThoai: "0934443322",
        Email: "bao.tran@example.com",
        TruongTHPT: "THPT Gia Định",
        ChungChiTiengAnh: "TOEFL iBT 95",
        ChungChiTuyenSinhQuocTe: "SAT 1480",
        TraiNghiemHoatDong: "Thành viên CLB Tranh biện, Đạt giải Khuyến khích HSG Tin học",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8804",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8805",
        HoVaTen: "Đặng Hồng Nhung",
        SoDienThoai: "0978889900",
        Email: "nhung.dang@example.com",
        TruongTHPT: "THPT Bùi Thị Xuân",
        ChungChiTiengAnh: "Không",
        ChungChiTuyenSinhQuocTe: "Không",
        TraiNghiemHoatDong: "Đội phó Đội văn nghệ trường, Đạt giải Ba cuộc thi nét vẽ xanh",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8805",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8806",
        HoVaTen: "Bùi Thế Anh",
        SoDienThoai: "0945678901",
        Email: "anh.bui@example.com",
        TruongTHPT: "THPT chuyên Năng Khiếu",
        ChungChiTiengAnh: "IELTS 7.0",
        ChungChiTuyenSinhQuocTe: "SAT 1520",
        TraiNghiemHoatDong: "Học sinh giỏi xuất sắc 3 năm liền, Giải Ba Olympic Toán cấp quốc gia",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8806",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    },
    {
        id: "TIC-8807",
        HoVaNam: "Vũ Hoàng Nam",
        HoVaTen: "Vũ Hoàng Nam",
        SoDienThoai: "0961234567",
        Email: "nam.vu@example.com",
        TruongTHPT: "THPT Marie Curie",
        ChungChiTiengAnh: "IELTS 6.0",
        ChungChiTuyenSinhQuocTe: "Không",
        TraiNghiemHoatDong: "Thành viên tích cực CLB Bóng rổ, Đạt danh hiệu học sinh 3 tốt",
        status: "Pending",
        qrCode: "QRCHECKIN-TIC-8807",
        checkInTime: null,
        checkInLocation: null,
        checkedBy: null
    }
];

const INITIAL_LOCATIONS = [
    "Cổng Chính (Main Gate)",
    "Hội Trường Lớn (Grand Hall)",
    "Khu Vực VIP Lounge",
    "Khu Vực Seminar B"
];

// Xuất các giá trị mặc định để sử dụng
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { INITIAL_USERS, INITIAL_CUSTOMERS, INITIAL_LOCATIONS };
}

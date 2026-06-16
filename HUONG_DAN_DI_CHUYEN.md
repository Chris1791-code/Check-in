# HƯỚNG DẪN DI CHUYỂN & HƯỚNG DẪN VẬN HÀNH HỆ THỐNG QR CHECK-IN

Tài liệu này hướng dẫn chi tiết cách chuyển ứng dụng QR Check-in sang máy tính (laptop) khác, thiết lập hệ thống, vận hành các nghiệp vụ hàng ngày, và xử lý các lỗi thường gặp (đặc biệt là lỗi bị chặn Camera khi truy cập qua mạng nội bộ/IP Host).

---

## Ⅰ. KIẾN TRÚC LƯU TRỮ DỮ LIỆU (QUAN TRỌNG)

Ứng dụng QR Check-in được thiết kế dưới dạng **SPA (Single Page Application - Ứng dụng trang đơn)** chạy hoàn toàn phía Client (trình duyệt).
*   **Cơ sở dữ liệu:** Được lưu trữ trực tiếp trong bộ nhớ **`localStorage`** của trình duyệt web trên máy tính đang chạy.
*   **Đặc điểm:** Dữ liệu này đi liền với trình duyệt của máy tính đó. Nếu bạn chỉ sao chép thư mục code sang máy tính khác và mở lên, trình duyệt của máy tính mới sẽ **chưa có dữ liệu** (chỉ có dữ liệu mẫu ban đầu). 
*   Vì vậy, để di chuyển sang máy khác mà vẫn giữ nguyên dữ liệu, bạn cần thực hiện đồng thời **Di chuyển thư mục nguồn** và **Di chuyển dữ liệu (Import/Export)**.
*   **Cơ chế mã QR đồng nhất (Đồng bộ Offline tuyệt đối):** Hệ thống sử dụng thuật toán mã hóa **Sinh ID đồng nhất**. Mã số vé (như `TIC-XXXXXXXXX` - 9 chữ số) và mã QR tương ứng được tính toán một cách nhất quán dựa trên *Họ tên, Số điện thoại và Email* của học sinh. 
*   **Tự động cập nhật mã vé & trạng thái Check-in (ID & Status Auto-Sync):** Khi nhập file Excel từ Laptop A chứa các học sinh đã tồn tại trong database Laptop B, hệ thống sẽ tự động ghi đè mã số vé cũ trên Laptop B thành mã vé từ Laptop A. Đồng thời, các thông tin check-in (như trạng thái Đã quét, thời gian, địa điểm check-in) cũng được đồng bộ chéo giữa 2 máy. Điều này giúp bạn dễ dàng liên kết dữ liệu mà không sợ lệch mã QR đã in.

---

## Ⅱ. CÁC BƯỚC DI CHUYỂN SANG LAPTOP KHÁC

Thực hiện theo 3 bước sau để chuyển toàn bộ ứng dụng và dữ liệu từ Laptop cũ (Laptop A) sang Laptop mới (Laptop B):

### Bước 1: Sao chép thư mục mã nguồn
1. Truy cập thư mục chứa ứng dụng trên Laptop A: `e:\Build App\QR Check-In` (hoặc vị trí bạn lưu thư mục này).
2. Nén thư mục thành file ZIP (Ví dụ: `QR_Checkin_App.zip`).
3. Sử dụng USB, Google Drive, Zalo hoặc mạng LAN để gửi file ZIP này sang Laptop B.
4. Trên Laptop B, giải nén file ZIP vào một thư mục bất kỳ (ví dụ: `C:\QR Check-In` hoặc màn hình Desktop).

### Bước 2: Xuất dữ liệu từ Laptop A
1. Trên Laptop A, mở ứng dụng, đăng nhập tài khoản **Admin** (`admin@qrcheckin.com` / `admin123`).
2. Vào tab **Khách Hàng**.
3. Nhấp nút **Xuất Excel Danh Sách** để tải về file danh sách học sinh hiện tại (chứa cả cột mã QR, chứng chỉ, hoạt động đã gộp, thông tin check-in).
4. Vào tab **Lịch Sử**, nhấp nút **Xuất Báo Cáo Excel (CSV)** để tải về lịch sử check-in nếu cần lưu trữ.
5. Chuyển các file Excel vừa xuất sang Laptop B.

### Bước 3: Nhập dữ liệu vào Laptop B
1. Trên Laptop B, mở ứng dụng và đăng nhập tài khoản **Admin**.
2. Vào tab **Khách Hàng**, cuộn xuống dưới cùng và nhấp chọn **Xóa Tất Cả Dữ Liệu** (để đảm bảo cơ sở dữ liệu trống sạch, sẵn sàng nhận file mới).
3. Nhấp chọn **Nhập Excel / CSV** (hoặc kéo thả file Excel danh sách vừa lấy từ Laptop A vào vùng Drag-n-Drop).
4. Hệ thống sẽ tự động nạp toàn bộ học sinh, đồng bộ các ID gốc, trạng thái check-in giống hệt như trên máy cũ, đồng thời dọn dẹp trùng lặp. Lúc này Laptop B đã có đầy đủ dữ liệu gốc và sẵn sàng quét vé.

---

## Ⅲ. CẤU HÌNH HỆ THỐNG TRÊN LAPTOP B

Để khởi chạy ứng dụng trên máy tính mới, bạn có hai lựa chọn:

### Phương án A: Chạy trực tiếp (Offline không cần cài đặt)
*   **Cách làm:** Click đúp trực tiếp vào file `index.html` trong thư mục code để mở trên trình duyệt (Chrome/Edge).
*   **Hạn chế:** Các trình duyệt hiện đại (Chrome, Edge, Safari) áp đặt chính sách bảo mật rất nghiêm ngặt. Khi chạy file cục bộ (`file:///...`), **tính năng quét camera quét QR có thể bị trình duyệt khóa quyền truy cập**. Phương án này chỉ phù hợp khi bạn muốn xem dữ liệu, sửa đổi thủ công, hoặc check-in bằng cách nhập mã số vé.

### Phương án B: Khởi chạy Máy chủ cục bộ (Khuyên dùng)
Để camera và mọi tính năng mạng hoạt động hoàn hảo, bạn nên chạy ứng dụng thông qua một Server cục bộ (Localhost).
1. Đám bảo máy tính đã cài đặt **Python** (hầu hết máy tính phát triển hoặc có thể cài nhanh từ Microsoft Store).
2. Mở Command Prompt (cmd) hoặc PowerShell trên Laptop B.
3. Di chuyển vào thư mục code (ví dụ):
   ```cmd
   cd C:\QR Check-In
   ```
4. Chạy lệnh khởi động máy chủ nhẹ của Python:
   ```cmd
   python -m http.server 3000
   ```
5. Mở trình duyệt web và truy cập địa chỉ: `http://localhost:3000`
   *(Vì localhost được trình duyệt coi là "Kênh an toàn" (Secure Context) nên camera quét mã sẽ được kích hoạt bình thường).*

---

## Ⅳ. HƯỚNG DẪN THAO TÁC CÔNG VIỆC HẰNG NGÀY

Sau khi hệ thống đã hoạt động trên Laptop B, dưới đây là quy trình xử lý công việc:

### 1. Chuẩn bị danh sách học sinh (Trước sự kiện)
1. Đăng nhập quyền **Admin**.
2. Chuẩn bị file Excel danh sách học sinh theo cấu trúc 7 cột chuẩn: `HoVaTen`, `SoDienThoai`, `Email`, `TruongTHPT`, `ChungChiTiengAnh`, `ChungChiTuyenSinhQuocTe`, `TraiNghiemHoatDong`.
3. Nhập file Excel vào hệ thống qua nút **Nhập Excel / CSV**. Hệ thống sẽ tự động gộp các học sinh trùng tên/email/số điện thoại đăng ký nhiều hoạt động lại và hiển thị thông báo kết quả.
4. Bấm **Tải ZIP Ảnh QR** để tải về thư mục ảnh chứa mã QR của tất cả học sinh (đặt tên dạng `<Mã_Vé>_<Họ_Tên>.png`) để phục vụ in thẻ hoặc gửi thông báo.

### 2. Gửi email thông báo vé QR (Trước sự kiện)
1. Vào tab **Hộp Thư Đi (Sandbox)**. Tất cả thư xác nhận kèm mã QR sẽ nằm ở trạng thái **Chờ gửi (Pending)**.
2. Để gửi thử nghiệm hoặc kiểm tra giao diện thư gửi đi, bấm **Xem HTML Email** ở từng dòng.
3. Bấm **Gửi Tất Cả Thư Chờ** ở góc trên bên phải để hệ thống tự động đẩy thư đi tuần tự (gửi thật nếu có cấu hình EmailJS, hoặc gửi mô phỏng).

### 3. Thực hiện soát vé Check-in tại quầy (Trong sự kiện)
1. Nhân viên soát vé đăng nhập tài khoản (quyền **User** hoặc **Manager**).
2. Chọn địa điểm trực (ví dụ: *Cổng Chính*, *Hội Trường Lớn*).
3. Bật camera quét. Khi học sinh xuất trình mã QR trên điện thoại hoặc thẻ in sẵn:
   *   **Camera quét thành công:** Giao diện nháy xanh, phát âm thanh chúc mừng, hiển thị đầy đủ thông tin (Họ tên, trường THPT, chứng chỉ tiếng Anh/SAT, và các hoạt động học sinh đã đăng ký).
   *   **Vé quét trùng lặp:** Giao diện báo đỏ, cảnh báo thông tin thời gian và địa điểm đã check-in trước đó để tránh một vé dùng nhiều lần.
4. **Trường hợp học sinh quên mang vé:** Gõ mã vé (Ví dụ: `TIC-8801`) hoặc số điện thoại vào ô **Check-in thủ công** và ấn Enter.
5. **Trường hợp khách vãng lai (không có trong danh sách):**
   *   Bấm nút **Đăng ký Khách vãng lai**.
   *   Nhập các thông tin cơ bản: Họ tên, SĐT, Email, Trường THPT, Chứng chỉ.
   *   Bấm **Đăng ký & Check-in**. Hệ thống sẽ tự sinh mã vé dạng `TIC-W-XXXX` và check-in trực tiếp cho khách.

---

## Ⅴ. XỬ LÝ SỰ CỐ & CÁC LỖI PHÁT SINH

### 1. Lỗi bị khóa / không hiển thị Camera khi truy cập qua địa chỉ IP mạng (Lỗi Host)
> [!WARNING]
> **Hiện tượng:** Khi Laptop A chạy máy chủ (`python -m http.server 3000`), Laptop B truy cập vào qua địa chỉ IP của Laptop A (ví dụ: `http://192.168.1.50:3000`). Khi vào màn hình quét, danh sách Camera bị trống hoặc trình duyệt báo lỗi: **"Lỗi cấp quyền Camera" / "Quyền truy cập Camera bị chặn"**.

*   **Nguyên nhân:** Các trình duyệt Chromium (Chrome, Edge, Opera) quy định rằng Camera chỉ được phép hoạt động trên các kết nối an toàn (HTTPS hoặc localhost). Địa chỉ IP nội bộ dạng `http://192.168.1.XX:3000` là kết nối HTTP không mã hóa nên trình duyệt tự động khóa API camera vì lý do bảo mật.
*   **Cách khắc phục:**

#### Cách 1: Thiết lập cấu hình bỏ qua bảo mật trên trình duyệt của máy khách (Laptop B)
Bạn có thể cấu hình cho trình duyệt trên Laptop B coi địa chỉ IP của Laptop A là một host an toàn bằng các bước sau:

**Dành cho trình duyệt Google Chrome:**
1. Trên Laptop B, mở Chrome và truy cập địa chỉ sau:
   ```text
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```
2. Tìm dòng **"Insecure origins treated as secure"**.
3. Chuyển trạng thái từ **Disabled** sang **Enabled**.
4. Trong ô văn bản bên dưới, nhập địa chỉ IP kèm port của Laptop A. Ví dụ:
   ```text
   http://192.168.1.50:3000
   ```
   *(Nếu có nhiều IP, ngăn cách nhau bằng dấu phẩy)*.
5. Nhấp nút **Relaunch** ở góc dưới màn hình để khởi động lại Chrome. Quyền truy cập camera giờ đây sẽ hoạt động bình thường trên link IP đó.

**Dành cho trình duyệt Microsoft Edge:**
1. Trên Laptop B, mở Edge và truy cập địa chỉ sau:
   ```text
   edge://flags/#unsafely-treat-insecure-origin-as-secure
   ```
2. Chuyển trạng thái **"Insecure origins treated as secure"** sang **Enabled**.
3. Nhập URL của máy chủ: `http://192.168.1.50:3000`.
4. Nhấp **Restart** trình duyệt để áp dụng.

#### Cách 2: Chạy trực tiếp máy chủ trên Laptop B
Thay vì kết nối chéo qua IP của Laptop A, hãy copy thư mục code sang Laptop B, khởi chạy lệnh `python -m http.server 3000` trực tiếp trên Laptop B và truy cập qua `http://localhost:3000`. Vì là địa chỉ `localhost`, trình duyệt sẽ cấp quyền camera ngay lập tức mà không cần cấu hình flag bảo mật.

---

### 2. Camera bị chặn quyền trên localhost
*   **Hiện tượng:** Truy cập `http://localhost:3000` nhưng vẫn không bật được camera.
*   **Cách sửa:**
    1. Nhấp vào biểu tượng **ổ khóa** hoặc biểu tượng **cài đặt trang web** ở bên trái thanh địa chỉ trình duyệt.
    2. Kiểm tra mục **Máy ảnh (Camera)**, chuyển trạng thái từ *Chặn (Block)* sang *Cho phép (Allow)*.
    3. Tải lại trang (`F5`).

### 3. Lỗi import file Excel báo lỗi định dạng hoặc không đọc được
*   **Nguyên nhân:** File Excel có cấu trúc cột bị thay đổi tên hoặc có các dòng tiêu đề phụ/dòng trống nằm xen kẽ ở đầu file làm sai lệch chỉ mục cột.
*   **Cách sửa:**
    1. Tải file Excel mẫu chuẩn bằng nút **Tải mẫu Excel** trong tab Khách hàng.
    2. Copy chính xác dữ liệu của bạn đặt vào các cột tương ứng trong file mẫu. Không thêm, bớt hoặc đổi tên các tiêu đề cột ở dòng thứ 1.
    3. Thực hiện import lại file mẫu đã điền dữ liệu.


📖 Hướng Dẫn Vận Hành Hệ Thống Nhiều Máy (LAN Sync Mode)
Vui lòng thực hiện chính xác theo các bước đơn giản sau:

BƯỚC 1: KHỞI ĐỘNG MÁY CHỦ TRÊN LAPTOP CHÍNH (LAPTOP A)
Trên Laptop chính (nơi chứa dữ liệu gốc), mở PowerShell hoặc Command Prompt (cmd).
Di chuyển vào thư mục chứa code:
cmd


cd "E:\Build App\QR Check-In"
Chạy lệnh khởi động máy chủ đồng bộ:
cmd


python server.py
Giao diện console sẽ lập tức hiển thị bảng thông tin dạng:
text


======================================================================
    [SERVER] HE THONG MAY CHU DONG BO LAN - QR CHECK-IN SU KIEN
======================================================================
  * Trang thai: Dang hoat dong...
  * May chu chinh (Laptop nay) truy cap qua:
      [LINK]  http://localhost:3000
  * Cac may phu (Laptop khac) trong cung mang Wi-Fi truy cap qua:
      [LINK]  http://192.168.1.50:3000
----------------------------------------------------------------------
  [GUIDE] HUONG DAN DANH CHO CAC MAY PHU:
  1. Ket noi laptop phu vao cung mot mang Wi-Fi/LAN voi may chu nay.
  2. Mo trinh duyet (Chrome/Edge) va nhap dia chi: http://192.168.1.50:3000
  3. Check-in logs va du lieu se tu dong dong bo giua cac may sau moi 5s.
======================================================================
(Trong ví dụ trên, địa chỉ IP của Laptop chính là 192.168.1.50).
BƯỚC 2: KẾT NỐI TỪ CÁC LAPTOP PHỤ (LAPTOP B, C,...)
Đảm bảo tất cả các laptop phụ đều đã kết nối chung vào một mạng Wi-Fi hoặc mạng LAN với Laptop chính.
Trên các laptop phụ, mở trình duyệt web (Google Chrome hoặc Microsoft Edge).
Nhập chính xác địa chỉ IP của Laptop chính (ví dụ: http://192.168.1.50:3000) và nhấn Enter.
Giao diện ứng dụng check-in sẽ ngay lập tức hiện ra. Ở góc trên cùng bên phải, bạn sẽ thấy biểu tượng nhấp nháy màu xanh lá cây ghi "Máy chủ LAN" báo hiệu kết nối thành công.
⚠️ LƯU Ý QUAN TRỌNG VỀ BẢO MẬT TRÌNH DUYỆT (CẤP QUYỀN CAMERA)
Do các trình duyệt Chromium (Chrome, Edge) chặn quyền truy cập Camera trên các kết nối HTTP không mã hóa (chỉ cho phép localhost hoặc HTTPS), bạn cần mở cấu hình bảo mật trên trình duyệt của các laptop phụ một lần duy nhất để bật camera:

Trên Chrome của Laptop phụ:
Nhập vào thanh địa chỉ: chrome://flags/#unsafely-treat-insecure-origin-as-secure
Tìm dòng "Insecure origins treated as secure" và chuyển từ Disabled sang Enabled.
Nhập địa chỉ IP của Laptop chính vào ô văn bản bên dưới (ví dụ: http://192.168.1.50:3000).
Nhấp nút Relaunch ở góc dưới cùng bên phải để khởi động lại trình duyệt.
Trên Edge của Laptop phụ:
Nhập vào thanh địa chỉ: edge://flags/#unsafely-treat-insecure-origin-as-secure
Chuyển trạng thái sang Enabled.
Điền địa chỉ máy chủ: http://192.168.1.50:3000 và nhấn Restart trình duyệt.
Sau khi làm thao tác trên, các laptop phụ có thể bật Camera quét mã QR, đăng ký khách vãng lai, xem biểu đồ, và mọi thay đổi check-in sẽ tự động truyền về lưu trữ trực tiếp trên file cứng của máy chủ chính theo thời gian thực!

---

## Ⅵ. HƯỚNG DẪN KẾT NỐI & SỬ DỤNG NHIỀU CAMERA ĐỒNG THỜI (MULTI-CAMERA)

Để tăng tốc độ soát vé tại sự kiện lớn, bạn có thể biến các điện thoại của nhân viên thành các mắt camera quét mã QR, tất cả truyền hình ảnh về hiển thị và quét đồng thời trên màn hình của 1 Laptop duy nhất (không cần nhiều laptop phụ).

### 1. Chuẩn bị phần cứng và phần mềm
Hệ thống sử dụng phần mềm webcam ảo **Iriun Webcam** hoặc **DroidCam** (bộ cài đặt offline cho Windows đã được tích hợp sẵn trong thư mục ứng dụng):
- **Laptop chính:** Chạy file cài đặt [IriunWebcam-2.9.5.exe](file:///e:/Build%20App/QR%20Check-In/IriunWebcam-2.9.5.exe) để cài đặt Iriun Webcam Client.
- **Các điện thoại quét (tối đa 4 chiếc):** Lên Google Play Store (Android) hoặc Apple App Store (iOS) tìm và tải ứng dụng **Iriun Webcam**.

### 2. Các bước kết nối không dây qua Wi-Fi nội bộ
1. Đảm bảo Laptop và tất cả các Điện thoại đều kết nối vào **chung một mạng Wi-Fi** (hoặc dùng 1 điện thoại phát điểm truy cập cá nhân di động và cho laptop + các điện thoại khác kết nối vào).
2. Trên Laptop, mở phần mềm **Iriun Webcam** đã cài đặt.
3. Trên từng Điện thoại, mở ứng dụng **Iriun Webcam**. 
4. Điện thoại và Laptop sẽ tự động phát hiện ra nhau và ghép đôi. Trên điện thoại sẽ hiện giao diện camera đang quay, còn trên màn hình Laptop sẽ hiện tab luồng hình ảnh của các điện thoại tương ứng.
5. Windows sẽ tự động đăng ký các điện thoại này thành các thiết bị camera độc lập:
   - Điện thoại 1: `Iriun Webcam`
   - Điện thoại 2: `Iriun Webcam #2`
   - Điện thoại 3: `Iriun Webcam #3`
   - Điện thoại 4: `Iriun Webcam #4`

### 3. Thao tác trên giao diện ứng dụng QR Check-in
Sau khi đã ghép đôi các điện thoại thành công, bạn vận hành chế độ đa camera trên web như sau:

1. Mở trình duyệt truy cập ứng dụng (Ví dụ: `http://localhost:3000`).
2. Vào tab **Quét Mã**.
3. Tại thanh tiêu đề điều khiển phía trên bên phải, nhấp nút **Đa Cam (Grid)**. Giao diện quét sẽ lập tức chuyển từ 1 khung hình lớn thành lưới 4 ô quét song song (**Cổng 1** đến **Cổng 4**).
4. Tại mỗi Cổng, nhấp vào dropdown chọn thiết bị camera và chọn một điện thoại tương ứng:
   - Cổng 1: Chọn `Integrated Camera` (Camera mặc định của Laptop).
   - Cổng 2: Chọn `Iriun Webcam` (Điện thoại 1).
   - Cổng 3: Chọn `Iriun Webcam #2` (Điện thoại 2).
   - Cổng 4: Chọn `Iriun Webcam #3` (Điện thoại 3).
   *(Hệ thống đã được lập trình để tự động dò tìm và gán trước các camera khác nhau cho mỗi cổng để bạn không mất thời gian chọn thủ công).*
5. Nhấp nút **Bật Quét** ở từng ô để kích hoạt luồng camera. Khi camera hoạt động, đèn quét laser màu đỏ và chấm tròn báo hiệu màu xanh lá cây sẽ hiển thị ở ô quét đó.
6. **Tiến hành soát vé:**
   - Nhân viên cầm các điện thoại hướng camera vào mã QR của học sinh để quét.
   - Khi bất kỳ camera nào bắt được mã QR hợp lệ, hệ thống sẽ:
     * Phát âm thanh bíp chúc mừng check-in thành công.
     * **Hiển thị hiệu ứng nháy xanh lá cây và thông báo "Thành công!" ngay tại ô camera quét được mã đó** để dễ dàng nhận biết máy nào vừa quét xong.
     * Cập nhật thông tin học sinh lên panel chi tiết và đẩy vào nhật ký check-in thời gian thực.
   - Nếu vé đã được quét trước đó hoặc không hợp lệ, hệ thống sẽ phát âm thanh cảnh báo lỗi và hiển thị ô thông báo đỏ ngay trên camera của cổng đó.
7. Khi muốn tạm dừng quét ở cổng nào, nhấp nút **Dừng Quét (Nút đỏ hình ô vuông)** ở tiêu đề cổng đó. Hoặc nhấp **Đơn Cam** để dừng toàn bộ và quay về chế độ quét 1 camera lớn thông thường.

---

# IV. HƯỚNG DẪN TRIỂN KHAI ONLINE (VERCEL & GOOGLE SHEETS SYNC)

Nếu bạn không muốn sử dụng mạng Wi-Fi LAN nội bộ phức tạp, hoặc muốn **sử dụng nhiều điện thoại di động trực tiếp để quét mã QR độc lập cùng lúc** (mỗi nhân viên cầm 1 điện thoại quét riêng bằng camera của điện thoại đó từ bất kỳ đâu, sử dụng mạng 3G/4G/Wi-Fi), đây là giải pháp tối ưu nhất.

Hệ thống sẽ hoạt động trên máy chủ Cloud tĩnh của Vercel (miễn phí, có sẵn HTTPS bảo mật để chạy camera điện thoại) và sử dụng **Google Sheets** làm cơ sở dữ liệu lưu trữ trực tuyến thời gian thực.

---

### 1. Bước 1: Deploy ứng dụng lên Vercel (Miễn phí & Cực nhanh)
Vì ứng dụng được xây dựng hoàn toàn bằng HTML/JS thuần (Client-side), bạn có thể lưu trữ nó trên Vercel miễn phí:
1. Tạo một tài khoản miễn phí trên [Vercel](https://vercel.com).
2. Tải thư mục chứa dự án này lên một kho lưu trữ **GitHub** (chọn chế độ Private hoặc Public).
3. Trên Vercel, nhấn **Add New** -> **Project**, kết nối với tài khoản GitHub của bạn và chọn kho lưu trữ chứa ứng dụng `QR Check-In`.
4. Nhấn nút **Deploy**. Vercel sẽ tự động cung cấp cho bạn một đường dẫn HTTPS bảo mật miễn phí (ví dụ: `https://qr-checkin.vercel.app`).
5. Nhân viên chỉ cần dùng điện thoại di động truy cập trực tiếp vào đường dẫn này là có thể tự sử dụng camera của máy để soát vé.

---

### 2. Bước 2: Cấu hình Google Sheets làm Cơ sở dữ liệu Online
1. Truy cập [Google Sheets](https://sheets.google.com), tạo một bảng tính mới.
2. Thiết lập tiêu đề cột ở dòng số 1. Bạn có thể sử dụng bất kỳ tiêu đề cột nào (ví dụ: `Họ tên`, `Số điện thoại`, `Email`, `Mã Vé`, `Bàn số`, `Size áo`,...). Cột `Họ tên` là bắt buộc, các cột còn lại tùy chỉnh theo sự kiện của bạn.
3. Ở thanh công cụ của Google Sheets, chọn **Tiện ích mở rộng (Extensions)** -> **Apps Script**.
4. Xóa toàn bộ đoạn mã mặc định và dán đoạn mã Google Apps Script sau vào (đoạn mã này cũng có thể sao chép nhanh tại tab **Thiết Lập** -> **Google Sheets** trên ứng dụng):

```javascript
// GOOGLE APPS SCRIPT - DATABASE ENGINE FOR QR CHECK-IN
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
  var headers = data[0];
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
      if (data[i][j] !== "") hasData = true;
    }
    if (hasData) {
      row["_rowNum"] = i + 1;
      rows.push(row);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var payload = JSON.parse(e.postData.contents);
  var headers = sheet.getDataRange().getValues()[0];
  
  var ticketId = payload.id;
  var action = payload.action; // "checkin" or "add_customer"
  
  // Tìm cột chứa ID vé
  var idColIdx = -1;
  var possibleIdHeaders = ["Mã số sinh viên", "Mã số cán bộ", "MSSV", "MSCB", "Mã Vé / ID", "Mã Vé", "ID", "Id", "id", "Ticket ID", "TicketID", "Mã số", "Mã"];
  for (var k = 0; k < headers.length; k++) {
    if (possibleIdHeaders.map(function(h){return h.toLowerCase();}).indexOf(headers[k].toLowerCase()) !== -1) {
      idColIdx = k;
      break;
    }
  }
  if (idColIdx === -1) idColIdx = 0;
  
  var rowNum = payload.rowNum;
  
  if (!rowNum && ticketId) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]).trim() === String(ticketId).trim()) {
        rowNum = i + 1;
        break;
      }
    }
  }
  
  var statusCol = headers.indexOf("Trạng Thái Check-in") + 1;
  var timeCol = headers.indexOf("Thời Gian Check-in") + 1;
  var locCol = headers.indexOf("Địa Điểm Check-in") + 1;
  var staffCol = headers.indexOf("Người Soát Vé") + 1;
  
  if (statusCol === 0) { statusCol = headers.length + 1; sheet.getRange(1, statusCol).setValue("Trạng Thái Check-in"); }
  if (timeCol === 0) { timeCol = headers.length + 2; sheet.getRange(1, timeCol).setValue("Thời Gian Check-in"); }
  if (locCol === 0) { locCol = headers.length + 3; sheet.getRange(1, locCol).setValue("Địa Điểm Check-in"); }
  if (staffCol === 0) { staffCol = headers.length + 4; sheet.getRange(1, staffCol).setValue("Người Soát Vé"); }
  
  if (action === "add_customer") {
    var newRow = new Array(headers.length);
    var namePossibles = ["HoVaTen", "Họ tên", "Họ và tên", "Họ và Tên", "Name", "Full Name", "Khách hàng", "Tên khách hàng", "Học sinh", "Tên học sinh"];
    var phonePossibles = ["SoDienThoai", "Số điện thoại", "SĐT", "Phone", "SDT", "Số ĐT", "Điện thoại", "Telephone"];
    var emailPossibles = ["Email", "Mail", "Địa chỉ email", "Gmail"];
    
    for (var j = 0; j < headers.length; j++) {
      var headerLower = headers[j].toLowerCase();
      if (j === idColIdx) {
        newRow[j] = ticketId;
      } else if (namePossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.HoVaTen || "";
      } else if (phonePossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.SoDienThoai || "";
      } else if (emailPossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.Email || "";
      } else if (payload[headers[j]] !== undefined) {
        newRow[j] = payload[headers[j]];
      } else {
        newRow[j] = "";
      }
    }
    
    sheet.appendRow(newRow);
    var newRowNum = sheet.getLastRow();
    
    sheet.getRange(newRowNum, statusCol).setValue(payload.status || "Pending");
    if (payload.status === "Checked In") {
      sheet.getRange(newRowNum, timeCol).setValue(payload.checkInTime || new Date().toISOString());
      sheet.getRange(newRowNum, locCol).setValue(payload.location || "Lối vào");
      sheet.getRange(newRowNum, staffCol).setValue(payload.staff || "Nhân viên");
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "rowNum": newRowNum}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } else {
    if (rowNum) {
      sheet.getRange(rowNum, statusCol).setValue("Checked In");
      sheet.getRange(rowNum, timeCol).setValue(payload.checkInTime || new Date().toISOString());
      sheet.getRange(rowNum, locCol).setValue(payload.location || "Lối vào");
      sheet.getRange(rowNum, staffCol).setValue(payload.staff || "Nhân viên");
      return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    } else {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Ticket ID not found"}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
  }
}
```

5. Bấm biểu tượng **Lưu (Save)**.
6. Chọn **Triển khai (Deploy)** -> **Tùy chọn triển khai mới (New deployment)**.
7. Chọn loại triển khai là **Ứng dụng web (Web app)**.
8. Cấu hình thông số:
   - *Thực thi dưới tên:* Tôi (tài khoản Google của bạn)
   - *Ai có quyền truy cập:* Mọi người (Anyone) - *Bắt buộc chọn "Mọi người" để các điện thoại quét có thể cập nhật trạng thái check-in mà không bị chặn phân quyền.*
9. Nhấp **Triển khai (Deploy)** và phê duyệt cấp quyền tài khoản Google.
10. Sao chép địa chỉ **URL Ứng dụng web (Web app URL)** nhận được (có dạng `https://script.google.com/macros/s/.../exec`).

---

### 3. Bước 3: Liên kết ứng dụng với Google Sheets
1. Mở link ứng dụng đã deploy trên Vercel.
2. Chuyển sang tab **Thiết Lập** -> Nhìn sang thẻ **Đồng Bộ Google Sheets**:
   - Tích chọn **Kích hoạt đồng bộ Google Sheets**.
   - Dán URL Apps Script Web App đã sao chép ở Bước 2 vào.
   - Nhấn **Lưu & Đồng Bộ**.
3. Hệ thống sẽ ngay lập tức tải danh sách khách hàng trực tuyến từ file Google Sheets về trình duyệt và hiển thị chấm trạng thái xanh lá cây cùng dòng chữ **Google Sheets** ở thanh tiêu đề trên cùng.

---

### 4. Vận hành nhiều điện thoại quét đồng thời
Khi đã hoàn thành cài đặt trên:
1. Tất cả nhân viên soát vé chỉ cần truy cập cùng đường dẫn Vercel của sự kiện trên điện thoại của mình.
2. Trên điện thoại của họ, vào phần **Thiết Lập** -> dán cùng địa chỉ URL Apps Script Web App và bật đồng bộ (hoặc cấu hình này sẽ tự động lưu lại trong trình duyệt của họ).
3. **Khi soát vé:**
   - Mỗi nhân viên đứng tại một vị trí, cầm điện thoại vào tab **Quét Mã** và quét mã QR của khách.
   - Khi quét thành công, dữ liệu check-in (thời gian, địa điểm, tên người soát vé) được gửi lập tức lên file Google Sheets trực tuyến.
   - Trình duyệt trên các điện thoại khác sẽ chạy ngầm chu kỳ đồng bộ tự động chéo **10 giây/lần**, cập nhật tức thời trạng thái khách hàng từ Google Sheets về.
   - Nếu một mã vé đã được quét thành công bởi nhân viên A, và 10 giây sau khách mang mã đó qua nhân viên B quét lại, điện thoại của nhân viên B sẽ cảnh báo ngay lập tức: **"Đã check-in trước đó lúc hh:mm tại cổng..."** để ngăn chặn gian lận vé.

---

## Ⅶ. HỖ TRỢ PHÂN HỆ MÃ VẠCH (BARCODE) SONG SONG MÃ QR

Hệ thống hiện tại hỗ trợ đồng thời mã QR và mã vạch 1D truyền thống (như CODE128, CODE39, EAN). Điều này cho phép bạn tận dụng thẻ sinh viên hoặc thẻ cán bộ có sẵn để check-in mà không cần sinh mã QR mới.

### 1. Cách hoạt động
- **Sinh mã vạch tự động:** Khi bạn nhập danh sách hoặc xem thông tin chi tiết một khách hàng, hệ thống sẽ tự động vẽ mã vạch chuẩn **CODE128** tương ứng từ Mã số sinh viên (MSSV) hoặc Mã số cán bộ (MSCB) trực tiếp lên vé xem trước và email mẫu.
- **Tự động nhận diện ID từ Excel:** Khi nhập file Excel, hệ thống hỗ trợ ánh xạ tự động cột ID từ các tên tiêu đề tiếng Việt thông dụng như: `Mã số sinh viên`, `Mã số cán bộ`, `MSSV`, `MSCB`, `Mã số`.
- **Quét song song:** Camera quét của ứng dụng (`html5-qrcode`) được cấu hình để nhận diện song song cả mã QR và mã vạch 1D dẹt. Vùng quét (`qrbox`) đã được điều chỉnh sang dạng hình chữ nhật rộng dẹt (ví dụ: 320x180) để dễ dàng căn chỉnh cả 2 loại mã.

### 2. Lưu ý khi cấu hình Google Sheets Apps Script
Nếu bạn sử dụng tính năng đồng bộ trực tuyến với Google Sheets, hãy cập nhật danh sách các cột tìm kiếm ID trong file Apps Script của bạn ở dòng 316 để khớp với mã số sinh viên/mã số cán bộ:
```javascript
  var possibleIdHeaders = ["Mã số sinh viên", "Mã số cán bộ", "MSSV", "MSCB", "Mã Vé / ID", "Mã Vé", "ID", "Id", "id", "Ticket ID", "TicketID", "Mã số", "Mã"];
```

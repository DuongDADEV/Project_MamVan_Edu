# Nhật ký thay đổi (Changelog) - Dự án Mầm Văn 7

## [2026-10-12] - Cổng Quản Trị Admin (Quản lý Tài khoản Giáo viên) & Bản Đồ Tính Năng
### Đã thực hiện:
- **Xây dựng Cổng Admin Quản trị (`src/screens/admin/AdminPortal.tsx`) theo theme Giáo viên**:
  - Đồng bộ bảng màu và phong cách thiết kế Giấy & Mực (nền ấm `#FAF7F0`, thẻ `#FFFDF8`, viền `#E6DCC8`, màu nhận diện `#2F3E6B` & `#7C3AED`).
  - Thống kê 4 thẻ trực quan: Tổng số giáo viên, Đang hoạt động, Dùng thử (Trial), Bị khóa.
  - Bộ lọc tab theo trạng thái (Tất cả, Hoạt động, Dùng thử, Bị khóa) và thanh tìm kiếm tức thì theo tên, username, SĐT, email, trường học.
  - **Cấp tài khoản giáo viên mới (`CreateTeacherModal`)**: Tự động sinh username (`gv...`), mật khẩu mặc định `123456`, chọn thời hạn dùng thử (3 ngày, 7 ngày) hoặc tài khoản chính thức, nhập thông tin liên hệ và ghi chú.
  - **Chỉnh sửa tài khoản giáo viên (`EditTeacherModal`)**: Cập nhật thông tin cá nhân, trường, môn, đặt lại mật khẩu mới, gia hạn thêm ngày dùng thử (+3, +7, +30 ngày).
  - **Khóa / Mở khóa 1-click (`toggleLockTeacher`)**: Khóa tài khoản giáo viên tạm thời, chặn đăng nhập từ xa kèm thông báo lý do rõ ràng.
  - **Xóa tài khoản an toàn (`DeleteTeacherConfirmModal`)**: Modal cảnh báo trước khi xóa, bảo vệ tài khoản mẫu gốc `gv001`.
  - **Truy cập với tư cách GV (Impersonate)**: Admin bấm "Vào xem" để truy cập thẳng vào không gian của giáo viên đó kiểm tra lớp học/học liệu, có thanh banner tím cố định ở trên đầu "🛡️ Đang xem dưới quyền GV [Tên] - ← Quay lại trang Admin".
- **Hạ tầng Dịch vụ & Dữ liệu (`TeacherRepository`)**:
  - Bổ sung interface `TeacherRepository` trong `src/services/types.ts`.
  - Triển khai `MockTeacherRepository` (lưu trữ `localStorage: mam_van_teachers`, phát sự kiện `syncEventBus.emit('teacher')`).
  - Triển khai `SupabaseTeacherRepository` trong `src/services/supabase/supabaseRepositories.ts` kết nối bảng `teachers` của PostgreSQL với fallback an toàn.
  - Cập nhật `authService.signIn`: Hỗ trợ đăng nhập `role: 'admin'` (`admin / 123456`), kiểm tra trạng thái `isLocked` của giáo viên để chặn truy cập khi bị khóa.
- **Tích hợp Đăng nhập & Định tuyến (`src/App.tsx`, `src/screens/LoginScreen.tsx`)**:
  - Hỗ trợ đường dẫn `/admin` hoặc `#/admin`.
  - Bổ sung vai trò `Admin` trên màn hình đăng nhập, có thẻ bấm điền nhanh tài khoản demo `admin / 123456`.
- **Bản đồ tính năng tương tác (`BAN_DO_TINH_NANG_DA_LAM_MAM_VAN.html`)**:
  - Xây dựng bản đồ mạng lưới SVG tương tác tổng hợp toàn bộ tính năng đã xây dựng của Giáo viên, AI Studio, Học sinh, Gamification/Mastery, Dữ liệu và Hạ tầng.


## [2026-10-12] - Sửa lỗi bóc tách YouTube & Bổ sung tưới nước Vườn Văn Mầm Mực
### Đã thực hiện:
- **Khắc phục triệt để lỗi bóc tách video YouTube**:
  - Viết bộ lọc `cleanScrapedText` loại bỏ 100% rác markdown images `![Image...]`, các liên kết sàn thương mại điện tử Shopee, Lazada, Tiki, mã token hash dài bất thường và danh sách khối sản phẩm gắn thẻ (tagged products).
  - Loại bỏ các dòng điều hướng YouTube, danh sách video đề xuất trên sidebar, các nút mạng xã hội và thông tin donate.
  - Chuẩn hóa prompt Gemini AI ép buộc tạo bài giảng sư phạm có cấu trúc rõ ràng (Tổng quan, Luận điểm then chốt, Phân tích chuyên sâu, Bài học vận dụng), không để lọt bất kỳ ký tự rác nào ra ngoài giao diện.
  - Xử lý cơ chế fallback an toàn: Tự động tổng hợp tri thức chuẩn mực theo chủ đề video ngay cả khi AI hết hạn ngạch hoặc mạng chập chờn.
- **Bổ sung hiệu ứng và tương tác tưới cây trong Cây Tri Thức (Vườn Văn Mầm Mực)**:
  - Đồng bộ logic giọt nước và hiệu ứng tưới nước giữa Trang chủ (`HomeScreen`) và màn hình Cây Tri Thức (`TreeScreen`).
  - Thêm thanh tương tác "💧 Nước tưới Mầm Mực" cùng nút "Tưới nước cho cây (+XP)" trực tiếp trong màn hình Vườn Văn Mầm Mực.
  - Khi học sinh bấm tưới, giọt nước tím rơi xuống trên đỉnh cây, phát ra các vòng hào quang rực rỡ và kích hoạt chuỗi tích lũy điểm danh/chăm sóc cây văn chương.

## [2026-10-12] - Nâng cấp Xưởng AI NotebookLM & Ngân hàng câu hỏi
### Đã thực hiện:
- **Xem trước và Duyệt bộ câu hỏi AI vừa tạo**:
  - Khi AI tạo xong bộ câu hỏi, không tự động lưu ngay mà hiển thị màn hình Xem trước & Duyệt (Preview Draft Questions).
  - Cho phép giáo viên kiểm tra đề bài, ngữ liệu trích dẫn, các phương án (đáp án đúng được tô màu xanh nổi bật), lời giải thích sư phạm.
  - Cho phép chọn/bỏ chọn từng câu hoặc chọn tất cả, xóa câu không phù hợp trước khi bấm "Lưu vào Ngân hàng câu hỏi".
- **Khắc phục triệt để lỗi số lượng câu hỏi**:
  - Prompt ép chặt Gemini AI sinh chính xác đúng số lượng câu hỏi được chọn theo slider (kể cả 10 hoặc 15 câu), cấu hình `maxOutputTokens: 8192`.
  - Mở rộng `MockAIService` sinh đủ số lượng câu hỏi chất lượng cao tương ứng với slider khi chạy chế độ mock.
- **Lưu trữ và phục hồi lịch sử trò chuyện (Chat History Persistence)**:
  - Tự động lưu và tải lại lịch sử hỏi đáp RAG với tài liệu nguồn qua `localStorage` theo từng `topicId`.
  - Bổ sung nút "Làm mới chat" để giáo viên xóa lịch sử và bắt đầu phiên hỏi đáp mới khi cần.
- **Bóc tách nội dung, phụ đề từ link video YouTube và trang web**:
  - Hỗ trợ dán đường dẫn YouTube hoặc URL bất kỳ ở tab Nguồn tài liệu.
  - Tự động bóc tách tiêu đề, transcript, lời thoại và tổng hợp kiến thức bài học đưa vào nguồn tài liệu của NotebookLM.
- **Làm nổi bật câu hỏi mới tạo trong Ngân hàng**:
  - Đánh dấu huy hiệu `Vừa tạo mới` và tự động đưa các câu hỏi AI vừa được duyệt lên đầu danh sách Ngân hàng.

## [2026-10-12] - Đấu nối Supabase Database cho Frontend
### Đã thực hiện:
- **Cơ sở dữ liệu Supabase**:
  - Tạo và thực thi schema 9 bảng cốt lõi trong `database/schema.sql` (`teachers`, `classes`, `students`, `student_states`, `topics`, `questions`, `essay_submissions`, `reward_requests`, `system_settings`).
  - Mở quyền RLS cho phép Frontend truy vấn và ghi dữ liệu qua API.
  - Đã nạp dữ liệu mẫu ban đầu: Giáo viên An (`gv001`), Lớp 7A2, 2 học sinh mẫu (`hs001`, `hs002`), 4 chủ đề Cây Tri Thức.
- **Dịch vụ Frontend (`src/services`)**:
  - Tạo `src/services/supabase/supabaseRepositories.ts` triển khai đầy đủ các interface repository (`SupabaseAuthRepository`, `SupabaseClassRepository`, `SupabaseStudentRepository`, `SupabaseAttemptRepository`, `SupabaseEssayRepository`).
  - Cập nhật `src/services/index.ts` trỏ `authService`, `classService`, `studentService`, `attemptService`, `essayService` sang Supabase.
  - Tích hợp cơ chế tự động fallback an toàn về LocalStorage nếu mất kết nối mạng.
- **Kiểm thử & Triển khai**:
  - `npm run lint` (`tsc --noEmit`): Đạt 0 lỗi.
  - `npm run build`: Hoàn tất thành công (1.04s).
  - Đẩy code lên nhánh `dev` tại `origin dev` để kích hoạt Vercel tự động build và deploy bản preview mới nhất.

# Nhật ký thay đổi (Changelog) - Dự án Mầm Văn 7

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

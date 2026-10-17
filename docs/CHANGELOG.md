# Nhật ký thay đổi (Changelog) - Dự án Mầm Văn 7

## [2026-10-18] - Đợt 0: Nền kỹ thuật — Cổng kiểm tra TypeScript & Sửa sạch 18 lỗi type
### Đã thực hiện:
- **Bổ sung cổng kiểm tra TypeScript vào lệnh build (`package.json`)**: đổi script `build` thành `tsc --noEmit && vite build`. Trước đây build chỉ chạy Vite nên lỗi kiểu dữ liệu lọt qua khâu kiểm tra.
- **Sửa sạch 18/18 lỗi TypeScript (kiểm tra `tsc --noEmit` từ 18 lỗi → 0 lỗi):**
  - `src/analytics/metricsEngine.ts`: xóa block import trùng lặp 4 type từ `./types.ts`; sửa `e.class_id` → `e.classId` khi đếm bài chờ chấm; bỏ phép so sánh chết `status === 'PENDING'` (type `RewardStatus` không có giá trị này, chỉ có `PENDING_APPROVAL`).
  - `src/components/VideoCard.tsx`, `src/screens/LearnScreen.tsx`: gọi sai dịch vụ — `contentService.getQuizzes` không tồn tại trên `ContentRepository`; chuyển sang `quizService.getQuizzes` (QuizRepository) giống các màn hình còn lại.
  - `src/screens/VideoLessonScreen.tsx`: bảo vệ truy cập `video.durationSec` khi `video` có thể null/undefined khi tính thời lượng hiệu dụng.
  - `src/services/mock/mockRepositories.ts`: cố định `filter.classId` vào biến cục bộ trước khi dùng trong callback lọc bài nộp.
  - `src/services/supabase/supabaseRepositories.ts`: ép `submission.classId` về `string | null` đúng kiểu khi lưu bài nộp; ánh xạ trường đề bài sang `questionPrompt` (type `EssaySubmission` không có trường `prompt`, bảng `essay_submissions` cũng không có cột này).
- **Cấu hình môi trường:** tạo `.env.local` (Supabase live + GEMINI_API_KEY) — file được .gitignore bảo vệ, không commit.
### Kiểm chứng:
- `npm run build` (đã gồm kiểm tra type) thành công; app chạy thử hiển thị bình thường.

## [2026-10-18] - Đợt 4: Chấm bài — thêm luồng "Xem chi tiết" theo học sinh, bỏ dấu "+" thừa
### Đã thực hiện:
- **Thêm nút [Xem chi tiết] theo học sinh** (theo Figma Giao diện 1 — trước đây còn thiếu): mỗi dòng trong Hàng đợi chấm bài giờ có thêm nút "Xem chi tiết" bên cạnh [Chấm ngay / Xem lại] (`GradingQueueTable.tsx`).
- **Màn hình chi tiết học sinh mới** (`src/components/teacher/grading/StudentGradingDetail.tsx`, nối vào `TeacherGradingScreen.tsx`): hiển thị thông tin học sinh + lớp, thống kê nhanh (tổng bài đã nộp / đã chấm / chờ chấm / điểm trung bình), và toàn bộ bài em đã làm **nhóm theo từng bài kiểm tra** — mỗi bài gồm tên đề, năng lực, số từ, thời điểm nộp, trích đoạn nội dung, trạng thái/điểm và nút [Chấm ngay / Xem lại] mở thẳng màn hình chấm bài đó. Có nút Quay lại về hàng đợi.
- **Bỏ dấu "+" thừa:** các nút câu nhận xét mẫu nhanh trong màn hình chấm bài từng hiển thị "+ <câu mẫu>" — đã bỏ dấu "+" ở đầu (`SplitGradingWorkspace.tsx`), chỉ giữ nội dung câu mẫu.
- Giữ nguyên nút [Chấm ngay / Xem lại] và toàn bộ luồng chốt điểm hiện có.
### Kiểm chứng:
- `npm run build` (gồm kiểm tra TypeScript) thành công, 0 lỗi type.

## [2026-10-18] - Đợt 3: Nội dung học — màu chủ đề nhuộm cả thẻ, tiêu đề lớn, bỏ chữ "Ngữ văn 7", kéo-thả sắp xếp chủ đề, nút Quay lại ở 3 trình soạn
### Đã thực hiện (đủ 6 yêu cầu của tài liệu góp ý):
- **Màu nhận diện đổi cả chủ đề** (`TopicTreeSidebar.tsx`, `TeacherContentScreen.tsx`): thẻ chủ đề ở cây bên trái được nhuộm nền + viền theo đúng màu nhận diện đã chọn (không còn chỉ là chấm tròn nhỏ); trạng thái đang chọn cũng tô theo màu của chính chủ đề đó. Trang chi tiết chủ đề nhuộm nền/viền đồng bộ và ô chữ cái đầu dùng nguyên màu chủ đề.
- **Tiêu đề chủ đề lớn hơn:** ở cây chủ đề tăng từ 12px lên 16px (font Lora, đậm); ở trang chi tiết chủ đề tăng lên 30px.
- **Bỏ chữ "Ngữ văn 7"** trong khu quản lý nội dung: `TopicModal` không còn tự điền tag mặc định "Ngữ văn 7" khi tạo/sửa chủ đề; các chủ đề cũ đang lưu tag này sẽ không hiển thị tag ở cây chủ đề và trang chi tiết nữa (tag thật như "Thơ ca", "Tiếng Việt"... vẫn hiện bình thường).
- **Sắp xếp chủ đề bằng kéo-thả:** bỏ 2 nút mũi tên lên/xuống, thay bằng tay nắm kéo ở mỗi thẻ — giữ và kéo thẻ chủ đề tới vị trí mới (thẻ đích được khoanh viền cam), thứ tự mới lưu ngay qua `reorderTopics` có sẵn.
- **Nút "Quay lại" ở cả 3 trình soạn** (VideoLessonEditor, TheoryLessonEditor, QuizBuilder): nút ở góc trái thanh tiêu đề, bấm để quay về trang chi tiết của chủ đề chứa bài — không còn cảnh mở bài liên kết xong không có đường quay lại.
- **Bỏ dòng chữ thừa** "Kiểu Google Form • Hỗ trợ 4 định dạng chuyên biệt cho môn Ngữ văn" trong QuizBuilder.
### Kiểm chứng:
- `npm run build` (gồm kiểm tra TypeScript) thành công, 0 lỗi type.

## [2026-10-18] - Đợt 2: Xưởng AI (đếm câu theo loại, panel kéo/thu) & Ngân hàng câu hỏi (lọc dạng list, gọn trạng thái AI); kiểm chứng Gemini API Key
### Đã thực hiện:
- **Xưởng Sáng Tạo AI (`src/components/teacher/ai/AiContentStudioModal.tsx`):**
  - Bỏ hẳn mục "Loại bài kiểm tra đích" và thanh trượt "Tổng số câu" theo Figma. Thay bằng bảng **Loại câu hỏi và số lượng**: 4 dòng (Chọn 1 đáp án / Chọn nhiều đáp án / Điền vào chỗ trống / Tự luận) với nút − / + từng loại; dòng cuối tự cộng "Tổng số câu dự kiến". Nút sinh nội dung bị khóa khi tổng = 0. (Hàm đếm `typeCounts` vốn đã có sẵn trong code nhưng chưa được nối — nay đã nối hoàn chỉnh.)
  - Cấu hình số lượng được truyền xuống tầng AI: prompt của Gemini (`src/services/ai/GeminiAIService.ts`) có thêm mục "CƠ CẤU LOẠI CÂU HỎI (BẮT BUỘC ĐÚNG SỐ LƯỢNG TỪNG LOẠI)" — loại nào để 0 thì không sinh câu loại đó; bộ sinh dự phòng (`MockAIService.ts`) cũng chọn đúng cơ cấu loại khi Gemini lỗi.
  - Khi lưu bộ câu hỏi AI vào ngân hàng: tiêu đề chuẩn hóa "Bộ câu hỏi: <chủ đề>", thời lượng = tối đa(7 phút, số câu), XP = số câu × 5 (không còn phụ thuộc loại bài kiểm tra đã bị bỏ).
  - **3 panel kéo ra / thu vào / chỉnh độ rộng** theo ghi chú Figma: kéo viền giữa các panel để đổi độ rộng (giới hạn 240–620px), nút chevron trên tay kéo để thu panel thành thanh dọc 46px, bấm thanh dọc để mở lại. Độ rộng + trạng thái thu được lưu theo máy (localStorage), chỉ áp dụng ở màn hình ≥768px.
- **Ngân hàng câu hỏi (`src/screens/teacher/TeacherQuestionBankScreen.tsx`):**
  - Thanh trạng thái Gemini ở đầu trang thu gọn thành 1 dòng: chấm trạng thái + dòng chữ ngắn + nút "Cấu hình" (chưa có key thì nút cam "Nhập API Key"). Bỏ khối mô tả dài và nút to theo ảnh chụp yêu cầu.
  - Bộ lọc chuyển từ dạng chip sang **dạng danh sách (list)** 3 nhóm rõ ràng: 1. Dạng học liệu, 2. Năng lực (viết đầy đủ: Nhận biết / Thông hiểu / Phân tích / Vận dụng), 3. Độ khó (Dễ / Trung bình / Khó) — mục đang chọn được tô nền nổi bật.
### Kiểm chứng:
- `npm run build` (gồm kiểm tra TypeScript) thành công, 0 lỗi type.
- **Gemini API Key đã kiểm chứng bằng lệnh gọi thật:** model `gemini-2.5-flash` trả lời đúng (khóa hợp lệ). Lưu ý: `gemini-2.0-flash` đã bị Google ngừng cung cấp; `gemini-flash-latest` thỉnh thoảng quá tải (lỗi 503 tạm thời) — có thể đổi model trong mục "Cấu hình" ở đầu trang Ngân hàng câu hỏi nếu gặp lỗi này trong Xưởng AI.

## [2026-10-18] - Đợt 1: Lớp & Học sinh — Sửa lỗi thêm học sinh không hiện, tên đăng nhập trùng; bỏ mục Danh sách học sinh; gọn trường thông tin
### Đã thực hiện:
- **Sửa lỗi "thêm học sinh đầu tiên không hiện, chỉ hiện học sinh thứ 2":**
  - *Nguyên nhân:* Ở chế độ Supabase, `getStudents` chỉ đọc bảng `students` trên DB, trong khi `createStudent` khi gặp lỗi (trùng tên đăng nhập, class_id không phải UUID) lại âm thầm rơi về kho mock (localStorage) hoặc gán học sinh sang lớp mặc định — học sinh tạo ra không nằm trong dữ liệu được đọc nên không hiển thị.
  - *Khắc phục (`src/services/supabase/supabaseRepositories.ts`):* `getStudents` hợp nhất thêm học sinh từ kho mock chưa có trên DB (theo id + username); `createStudent` không còn gán bừa sang lớp mặc định — class_id dạng UUID dùng thẳng, `class_7a2` ánh xạ lớp mặc định như đường đọc, id lạ chuyển mock xử lý để giữ đúng lớp; trùng tên đăng nhập ở DB thì sinh lại tên khác và thử lại 1 lần trước khi fallback.
- **Sửa lỗi "mỗi lần thêm học sinh phải tự đổi Tên đăng nhập":**
  - *Nguyên nhân:* `generateUsername` dùng số ngẫu nhiên và tầng Supabase thậm chí không dùng hàm này (sinh `hs_` + chuỗi ngẫu nhiên), dễ trùng khi thêm nhiều học sinh.
  - *Khắc phục (`src/services/mock/credentialUtils.ts`):* sinh hậu tố số **xác định** — chọn số nhỏ nhất chưa bị dùng; tầng Supabase dùng chung `generateUsername` với danh sách tên hiện có. Kiểm chứng bằng test tự động: 5 học sinh trùng tên → 5 tên đăng nhập khác nhau, chạy lại cho kết quả giống hệt.
- **Mã HS tự động:** thêm `generateStudentCode` (HS0001, HS0002, ... chọn số trống nhỏ nhất); để trống Mã HS khi tạo là hệ thống tự cấp ở cả 2 tầng lưu trữ. Ô nhập đổi placeholder thành "Tự động", tiêu đề cột chuẩn hóa thành "Mã HS".
- **Bỏ trường Ngày sinh** khỏi form thêm học sinh (nhập tay + xem trước Excel) và ngừng thu thập khi tạo tài khoản (`src/components/teacher/AddStudentModal.tsx`). Dữ liệu cũ trong DB giữ nguyên.
- **Bỏ mục "Danh sách học sinh" ở màn tổng quan** (`src/screens/teacher/ClassesAndStudentsScreen.tsx`) theo Figma: màn hình chỉ còn quản lý lớp — nút "+ Tạo lớp mới", ô "Tìm theo tên lớp...", thẻ lớp với nút "Vào lớp →"; quản lý học sinh thực hiện bên trong từng lớp (đã có sẵn bảng học sinh + nút Thêm học sinh ở trang chi tiết lớp).
### Kiểm chứng:
- `npm run build` (gồm kiểm tra TypeScript) thành công, 0 lỗi type; test đơn vị cho hàm sinh tên đăng nhập/mã HS đạt.

## [2026-10-14] - Khắc Phục Lỗi Phân Bố Phổ Điểm Histogram & Lỗi Mất Bài Nộp Tự Luận Chờ Chấm
### Đã thực hiện:
- **Khắc phục lỗi Phân bố phổ điểm (Histogram) hiển thị sai số lượng học sinh (`src/analytics/scoreAnalytics.ts`)**:
  - *Nguyên nhân:* Trước đó hàm `computeScoreDistribution` duyệt và cộng dồn từng câu hỏi học sinh làm (`qList.forEach`), khiến 42 câu hỏi đã làm bị đếm thành "30 học sinh" ở dải < 5 và "12 học sinh" ở dải 8-10.
  - *Khắc phục:* Viết lại hàm tính toán theo đúng chuẩn thống kê sư phạm: duyệt theo từng học sinh trong lớp (`students.forEach`), tính điểm trung bình của mỗi học sinh từ các bài làm đã hoàn thành và xếp mỗi học sinh vào duy nhất 1 dải điểm tương ứng. Tổng số học sinh trên các cột biểu đồ luôn khớp 100% với số học sinh thực tế của lớp.
- **Khắc phục lỗi học sinh gửi bài nhưng giáo viên không thấy bài trong Hàng đợi chấm (`src/services/supabase/supabaseRepositories.ts`, `src/services/mock/mockRepositories.ts`, `src/App.tsx`, `src/screens/TheoryLessonScreen.tsx`, `src/screens/VideoLessonScreen.tsx`)**:
  - *Nguyên nhân 1:* Trong `App.tsx`, khi học sinh hoàn thành bài tập về nhà / quiz có câu tự luận, hàm `onComplete` không gọi `essayRepository.createSubmission` và không lưu vào `essaySubmissions` của học sinh.
  - *Nguyên nhân 2:* Trong `TheoryLessonScreen.tsx` và `VideoLessonScreen.tsx`, `studentId` bị hardcode là `'hs001'`, không lấy ID và tên thực tế của tài khoản học sinh đang đăng nhập.
  - *Nguyên nhân 3:* Trong `SupabaseEssayRepository.getSubmissions()`, hệ thống chỉ truy vấn bảng Supabase và nếu Supabase trả về rỗng thì không hợp nhất với bài nộp lưu trữ ở local/fallback, dẫn đến giáo viên thấy 0 bài.
  - *Khắc phục:* 
    - Đấu nối `essayRepository.createSubmission` trong `App.tsx` cho mọi luồng nộp bài tập tự luận.
    - Truyền động `state.profile.id`, `state.profile.name`, `grade` trong các màn hình học tập.
    - Cập nhật `SupabaseEssayRepository.getSubmissions` và `createSubmission` tự động hợp nhất (merge) dữ liệu từ Supabase và Local State, đảm bảo không bao giờ bị thất lạc bài nộp của học sinh dù làm bài online hay offline.

### Đã thực hiện:
- **Xây dựng `SupabaseQuizRepository` kết nối trực tiếp PostgreSQL (`src/services/supabase/supabaseRepositories.ts`)**:
  - Triển khai `QuizRepository` kết nối bảng `questions` trên Supabase Database Cloud.
  - Tự động chuẩn hóa kiểu dữ liệu giữa TypeScript (`single`, `multi`, `fill`, `essay`) và PostgreSQL (`single_choice`, `multiple_choice`, `fill_in_blank`, `essay`).
  - Lưu vĩnh viễn mọi câu hỏi do AI tạo hoặc giáo viên nhập thủ công vào Supabase (`upsert onConflict id`).
  - Hỗ trợ fallback tức thì sang `mockRepo` (LocalStorage) khi offline hoặc chưa cấu hình Supabase.
  - Tự động đồng bộ và nạp 22 câu hỏi mẫu khởi nguồn lên Supabase Database, ngăn ngừa tình trạng mất dữ liệu hay bị reset về 22 câu khi tải lại trang.
- **Cập nhật Service Registry (`src/services/index.ts`)**:
  - Xuất `quizService` và `quizRepository` trỏ thẳng sang `supabaseQuizRepo`.
- **Cập nhật Bản Đồ Tính Năng (`BAN_DO_TINH_NANG_DA_LAM_MAM_VAN.html`)**:
  - Chuyển Cổng Admin (`admin`) thành một module chính thức hoàn thành (`ADM-01` đến `ADM-08`), màu tím `#7c3aed`.
  - Bổ sung `INF-09` (SupabaseQuizRepository lưu câu hỏi vĩnh viễn) vào khối Dữ liệu & Hạ tầng.
  - Mở rộng luồng tương tác: Luồng [10] (Admin ➜ Giáo viên: Quản trị & Impersonate), Luồng [11] (Hạ tầng ⇄ Admin: Dữ liệu hai chiều).
  - Tách riêng khối mở rộng tương lai cho Phụ huynh và Kênh thông báo.
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

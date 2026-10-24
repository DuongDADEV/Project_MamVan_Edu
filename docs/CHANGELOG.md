## 2026-10-25 (TỔNG QUAN: BẢNG CHỦ ĐỀ THAY BIỂU ĐỒ LUỒNG + BẢNG PROGRESS THẬT + XÓA MỤC BÀI GIAO Ở HOME + KHUNG CUỘN BẢNG HỌC SINH + CROSS-FILTER THEO HỌC SINH)

Năm việc trong một đợt, theo lệnh chủ dự án ngày 25/10. Ghi chú chất lượng trong hộp thoại xuất bản (chưa quyết xóa hay giữ), biểu đồ 4 mức lớp (đã park), RLS thật và mật khẩu tài khoản KHÔNG đụng trong đợt này.

- **Trợ lý hết kẹt bong bóng "Đang truy vấn dữ liệu thật của lớp…" (timeout 180 giây, 25/10)**: đường truy vấn + chờ Gemini trước đây không có timeout/abort nào (setTimeout duy nhất trong file chỉ là nút xác nhận xóa 6 giây) nên model/mạng treo là bong bóng xoay mãi, không gửi được câu mới (nút gửi khóa theo busy). Nay mỗi lượt hỏi có timer 180 giây: quá mốc thì tự thoát busy + hiện tin nhắn lỗi trong khung chat "Truy vấn quá lâu (quá 180 giây), em chưa nhận được kết quả. Thầy/cô thử hỏi lại giúp em." để hỏi lại được ngay. Không đổi prompt, tools hay cách truy vấn — chỉ thêm cơ chế thoát kẹt (AnalyticsAssistantTab.send, dùng chung cho cả tab Phân tích lẫn bong bóng chat nổi). Kết quả về muộn sau mốc bị bỏ qua (không ghi đè thông báo lỗi); lượt gửi mới sau timeout có mã lượt riêng nên timer/finally của lượt cũ không bao giờ chạm vào trạng thái của lượt mới.
- **Bảng "Tiến độ hoàn thành luồng theo chủ đề" thay biểu đồ "Tiến độ học theo luồng" (tab Tổng quan, theo ảnh khoanh 01:11 25/10)**: panel cũ hiện trạng thái trống vì bảng student_activity_progress không tồn tại nay thành BẢNG, không làm biểu đồ cột ngang nữa. Cột: Chủ đề | Học sinh hoàn thành | Tổng số học sinh | % hoàn thành (cột % là cột chủ dự án yêu cầu thêm). Sắp xếp giảm dần theo %, hòa nhau thì tên chủ đề tăng dần. % = học sinh hoàn thành toàn bộ luồng của chủ đề trên tổng số học sinh trong phạm vi — TÁI DỤNG ĐÚNG định nghĩa isTopicFullyComplete của app (src/logic/topicCompletion.ts, định nghĩa dùng cho quỹ XP chủ đề từ 22/10): mọi mục luồng đều xong — video có bước video_flow_completed, lý thuyết có bước theory_flow_completed, quiz làm đúng hết phần chấm tự động (câu tự luận không chặn; quiz chỉ có tự luận hoặc không có câu hỏi thì tính xong nếu đã làm); chủ đề rỗng không bao giờ tính là hoàn thành. KHÔNG dùng computeTopicProgressList (định nghĩa đó đếm bước học toàn cục, không lọc theo chủ đề nên mọi chủ đề ra cùng một số — không đáp ứng yêu cầu "theo chủ đề"). Bảng tính trực tiếp từ states của portal (TeacherPortal -> TeacherOverviewScreen -> PbixOverviewSection; tra state theo supaId rồi fallback appId) nên luôn tươi. Lọc: chỉ chịu lọc lớp (qua học sinh trong phạm vi); KHÔNG chịu lọc ngày (trạng thái hoàn thành không gắn ngày) và KHÔNG chịu lọc luồng (hoàn thành chủ đề trải mọi luồng). Hệ quả phải nói rõ: nút lọc "Theo luồng" nay không còn áp cho visual nào (trước đây nó chỉ áp cho biểu đồ luồng) — nút vẫn hiển thị nguyên cho các visual khác theo bố cục pbix nhưng hiện tại là inert; nếu chủ dự án muốn ẩn nút thì nói thêm. Trạng thái trống trung thực: chưa có chủ đề / chưa có học sinh thì hiện ghi chú, không bịa số; chủ đề có 0 học sinh hoàn thành thì hiện hàng 0% thật. Sửa kèm lỗi hiển thị ở thẻ "Tỷ lệ điểm đạt": ghi chú từ "180.20000000000002/247 điểm (câu đã chấm)" thành "180.2/247" — chỉ làm tròn hiển thị về 1 thập phân (hàm mới formatScore1dp), giá trị 73% và công thức không đổi.
- **Bảng student_activity_progress thật (migration_013) + backfill**: file mới database/migration_013_student_activity_progress.sql (idempotent; khóa chính (student_id, activity_id) để upsert chạy lại không trùng; thêm topic_id, progress_status, completed_at; RLS allow-all theo mẫu 002/005/012, khóa thật để vòng sau). Backfill chạy trực tiếp lên Supabase production qua tunnel .dbkit (mật khẩu trích lúc chạy bằng regex, không in/log/lưu): chỉ nạp được hàng hoàn thành HOẠT ĐỘNG QUIZ (PRACTICE / TEST / TEST_1 / TEST_2) từ attempt_answers theo đúng quy tắc isQuizAllCorrect — mỗi câu chấm tự động phải có ít nhất 1 lần trả lời đúng hoàn toàn (is_correct hoặc score_awarded >= max_score với max_score > 0); câu tự luận không chặn; hoạt động không có câu chấm tự động thì tính xong nếu học sinh đã làm. VIDEO / DETAILED_THEORY / KEY_POINTS KHÔNG có hàng backfill vì Supabase không có tín hiệu hoàn thành bước đó (trạng thái xem video/đọc lý thuyết chỉ nằm trong localStorage states, không join được với learning_activities) — KHÔNG bịa hàng cho các loại này. LƯU Ý KIẾN TRÚC: bảng chủ đề ở trên KHÔNG đọc bảng progress này (chưa có writer trực tiếp nên dữ liệu backfill sẽ cũ ngay); bảng progress là kho lưu trữ đúng định dạng pbix, chờ bước ghi trực tiếp sau này. Số dòng backfill + dòng mẫu xem báo cáo đợt (chạy xong mới có số).
- **XÓA mục "Bài tập được giao" khỏi trang chủ học sinh (sửa hiểu sai ở vòng 3, theo ảnh 01:26 25/10)**: vòng 3 parent đã hiểu sai — tưởng "ở đây" là thẻ "Nhiệm vụ tuần" và tưởng Home không có mục riêng; thực tế mục riêng nằm ở HomeScreen (dòng cũ 395-396): component AssignedHomeworkSection (dữ liệu getStudentAssignments — chính 4 bài Ôn tập Ngữ văn tuần 1, Ôn tập kiến thức chủ đề, Đọc hiểu và viết cảm nhận, văn 9 trong ảnh) đặt giữa banner hero và carousel "Chủ đề học kỳ này". Đợt này xóa hoàn toàn khối đó khỏi HomeScreen (cả import); không còn mục Home nào khác phụ thuộc vào nó (component tự chứa, chỉ nhận studentId + callback mở bài; file component vẫn nằm trong repo để dùng lại sau nếu cần, không còn chỗ nào import). Các bài đó vẫn hiển thị bình thường trong mục Bài tập (tab Về nhà) — mục Bài tập KHÔNG đụng. Thẻ "Nhiệm vụ tuần" giữ nguyên như vòng 3 (chỉ quiz về nhà). Trang chủ học sinh còn lại: banner thông báo bài mới (nếu có) + hero banner + carousel "Chủ đề học kỳ này" + hàng Điểm danh & Học tiếp + thanh XP hôm nay + Cây tri thức & thẻ Nhiệm vụ tuần + khu "Cần ôn lại" & Quà tặng tuần.
- **Bảng "Học sinh cần quan tâm" trong khung cuộn dọc**: trước đây bảng trải hết 10 học sinh + hàng Tổng cộng làm trang dài. Nay khung cuộn max-height 300px (đủ hiện header + hàng Tổng cộng + khoảng 5–6 dòng học sinh, mỗi dòng ~37px), cuộn dọc được; header dính ở đầu khung khi cuộn (th sticky top-0, nền trắng); hàng Tổng cộng chuyển sang tfoot dính dưới đáy khung (td sticky bottom-0, nền stone-50) nên luôn nhìn thấy mà không chiếm chỗ cuộn. Giữ một bảng duy nhất (không tách bảng header/body) để các cột thẳng hàng tuyệt đối. Chỉ áp cho bảng học sinh này; bảng bài tập (4 dòng) không cần nên giữ nguyên.
- **Cross-filter theo học sinh (bấm dòng học sinh -> mọi panel còn lại lọc theo em đó, kiểu Power BI)**: bấm một dòng trong bảng "Học sinh cần quan tâm" thì chọn em đó — dòng highlight nền indigo, hiện chỉ báo "Đang xem: <tên> ✕" ngay dưới thanh lọc kèm giải thích; bấm lại vào dòng đã chọn hoặc bấm ✕ thì bỏ chọn, trở về xem toàn bộ. Bảng học sinh vẫn hiện đủ các dòng để đổi sang em khác; đổi lớp lọc làm em đang chọn ra khỏi phạm vi thì tự bỏ chọn. Khi đã chọn, mọi panel còn lại chạy trên đúng 1 học sinh đó (kết hợp với lọc lớp/ngày/luồng đang có, công thức gốc không đổi — chỉ thêm lớp lọc học sinh bằng cách chạy computePbixDashboard lần 2 với students = [em đó]): bảng bài tập giữ nguyên cột, giá trị thu về của riêng em đó theo từng bài (hàng Tổng cộng = tỷ lệ chung của em đó); bảng chủ đề hiện % của riêng em đó theo từng chủ đề (mỗi chủ đề 0% hoặc 100%, tổng số = 1); biểu đồ mức tư duy hiện tỷ lệ đạt theo mức của riêng em đó; biểu đồ đăng nhập theo ngày hiện ngày đăng nhập của riêng em đó; KPI Tỷ lệ nộp bài / Tỷ lệ điểm đạt / Câu chờ chấm chuyển sang giá trị của riêng em đó. NGOẠI LỆ DUY NHẤT: KPI "Hoạt động 7 ngày" GIỮ MỨC TOÀN LỚP khi đang chọn học sinh — công thức pbix đếm DISTINCT học sinh trong cửa sổ 7 ngày, nên "số ngày em đó đăng nhập" là một chỉ số khác hẳn công thức gốc (không phải chỉ thêm lớp lọc); theo đúng lệnh thì giữ toàn lớp và ghi rõ tại đây. Muốn KPI đó hiện số ngày của em đó thì cần định nghĩa chỉ số mới, nói thêm một câu là làm.

## 2026-10-25 (TAB TỔNG QUAN XÂY LẠI THEO FILE POWER BI CỦA CHỦ DỰ ÁN)

Theo lệnh chủ dự án ngày 25/10 ("giữ lại mỗi hình khoanh đen, còn lại sửa hết cho giống file pbix"): chỉ giữ nguyên tuyệt đối banner chào trên cùng (chip "Tổng quan toàn trường", "Chào thầy…!", đoạn chào mừng, mascot, nút "Thêm học sinh mới"); toàn bộ phần dưới banner xây lại theo trang "Tổng quan" của file Dashboard_MamVan__1.pbix do chủ dự án gửi. Các tab khác của Phân tích (điểm số, câu hỏi, trợ lý AI + bubble) KHÔNG đụng tới. Ghi chú chất lượng trong hộp thoại xuất bản (chưa quyết xóa hay giữ), biểu đồ 4 mức lớp (đã park), RLS thật và mật khẩu tài khoản KHÔNG đụng trong đợt này.

- **Cách bóc pbix (không đoán từ ảnh)**: giải nén file pbix, đọc Report/definition/pages/*/page.json + visuals/*/visual.json (bố cục, trường, thứ tự sắp xếp, visualInteractions) và DataModel (hàm DAX của từng measure qua pbixray). Mọi công thức dưới đây đều lấy từ file, không suy từ ảnh chụp.
- **Bố cục mới**: bộ lọc 3 slicer (Khoảng thời gian — chọn khoảng ngày; Lớp học — chọn lớp; Theo luồng — Luồng Lý thuyết / Luồng Video); hàng KPI 4 thẻ; hàng 2 gồm bảng Học sinh cần quan tâm + bảng Tiến độ bài được giao + biểu đồ Tiến độ học theo luồng; hàng 3 gồm biểu đồ cột Tỷ lệ điểm đạt theo mức tư duy + biểu đồ đường Số học sinh đăng nhập theo ngày. Màu bám ảnh pbix trong khả năng render web: thanh cột cam đào (#E0957A), đường xanh dương (#118DFF, màu dataColor đầu của theme Fluent2 trong file), thẻ trắng trên nền be của app.
- **Công thức DAX đã cài (module mới src/analytics/pbixDashboard.ts, dữ liệu src/analytics/pbixDashboardData.ts, giao diện src/components/teacher/analytics/PbixOverviewSection.tsx)**: Hoạt động 7 ngày = DISTINCTCOUNT học sinh có login_date trong [MAX(login_date) − 6, MAX(login_date)] (neo không chịu lọc ngày theo REMOVEFILTERS, chỉ chịu lọc lớp); Tỷ lệ nộp bài = SUBMITTED / tổng target (targets không có đường tới dim_date nên lọc ngày không đổi KPI này); Câu trả lời chờ chấm = DISTINCTCOUNT câu PENDING (pbix đặt NoFilter từ lọc ngày); Tỷ lệ điểm đạt = tổng điểm / tổng điểm tối đa của câu đã chấm (theo ĐIỂM, không phải số câu; có lọc ngày qua attempts.submitted_date); bảng học sinh = Họ tên + Hoạt động gần nhất (MAX login_at, không lọc ngày) + Số bài chưa nộp + Tỷ lệ đạt điểm cá nhân (điểm-trọng số, có lọc ngày, 1 thập phân) + Gợi ý theo dõi đúng SWITCH DAX (chưa có login / vắng ≥ 7 ngày + nợ bài / vắng ≥ 7 ngày / còn bài chưa nộp / chưa cần ưu tiên), sắp xếp theo gợi ý giảm dần rồi tên tăng dần; bảng bài giao = Được giao / Đã nộp / Chưa nộp / Tỷ lệ nộp theo từng bài (chỉ bài có ≥ 1 lượt giao trong phạm vi), sắp xếp theo tỷ lệ nộp giảm dần; mức tư duy từ questions.level qua SWITCH NHAN_BIET/THONG_HIEU/PHAN_TICH/VAN_DUNG (chỉ mức có câu đã chấm trong phạm vi, sắp xếp theo tỷ lệ giảm dần đúng sortDefinition của file); đường ngày = DISTINCTCOUNT học sinh theo login_date, tăng dần. Hàng Total ở cả 2 bảng: tổng số + tỉ lệ chung (bảng học sinh: MAX ngày + gợi ý của hàng đầu sau sắp xếp, giống cách pbix hiển thị). Ngày nộp của lượt làm quy theo múi giờ Asia/Saigon; ngày hiển thị theo quy ước DD/MM/YYYY (pbix gốc M/D/YYYY — lệch locale hiển thị, không lệch số liệu). Phạm vi dữ liệu: chỉ học sinh thuộc lớp của giáo viên đang đăng nhập (portal đã lọc sẵn); học sinh resolve sang id Supabase bằng id trực tiếp rồi fallback theo username; bài/hoạt động lọc theo teacherId.
- **Mặc định lọc**: lớp = tất cả các lớp của giáo viên (banner khi đó hiện "Tổng quan toàn trường" như cũ; với gv001 chỉ có 1 lớp nên tương đương chọn 7A4); khoảng ngày = khoảng dữ liệu phiên thật (min–max login_date) sau lần nạp đầu, người dùng tự chỉnh sau đó; luồng = tất cả các luồng (trung lập — lựa chọn "Luồng Lý thuyết" trong ảnh chụp chỉ là trạng thái tác giả chọn, không phải quy tắc). Bộ lọc lưu sessionStorage với khóa mới mam_van_pbix_overview_filters (không dùng chung khóa cũ).
- **ĐIỂM HỞ — biểu đồ Tiến độ học theo luồng chưa có dữ liệu thật**: bảng student_activity_progress KHÔNG tồn tại trong Supabase (đã kiểm tra: không có trong migration_008, không có trong src/ hay database/); 160 dòng progress trong file pbix đến từ Excel mẫu nạp bằng import_bi_mock_v3.py nhưng chưa từng được nạp lên Supabase. Khung biểu đồ được dựng sẵn và nối đúng hàm tính (tỉ lệ hoàn thành theo Step_Label, đúng SWITCH Flow_Name/Step_Label của DAX) nhưng hiện trạng thái trống trung thực giải thích thiếu bảng — TUYỆT ĐỐI KHÔNG bịa tiến độ từ lượt làm bài (làm bài khác với hoàn thành bước học). Biểu đồ sẽ tự hiện khi app có bảng tiến độ thật.
- **Đã gỡ**: thanh lọc cũ (AnalyticsFilterBar), 6 thẻ KPI cũ (computeOverviewMetrics), mục Học sinh cần quan tâm cũ (detectStudentsNeedingAttention), Nhận xét sư phạm tự động (generatePedagogicalInsights), 3 biểu đồ cũ (daily line mastery/topic-progress). Các module analytics cũ vẫn nằm trong repo (các tab Phân tích khác còn dùng một phần) nên không xóa file. Hàng học sinh trong bảng mới chỉ hiển thị (không bấm sang hồ sơ như mục cũ) — hồ sơ chi tiết vẫn vào được từ các tab Phân tích; quan hệ sơ đồ "mở chi tiết để xử lý" vì vậy bị gỡ.
- **Kiểm chứng logic**: script tạm /tmp/test_pbix_dashboard.ts (không commit) với dữ liệu giả lập theo hình live inventory — 36/36 khẳng định đạt, bao gồm neo MAX(login_date), cửa sổ 7 ngày, REMOVEFILTERS/NoFilter ngày, tỉ lệ điểm-trọng số, SWITCH gợi ý đủ 4 nhánh, sắp xếp 2 bảng, DISTINCTCOUNT theo ngày và trạng thái trống của biểu đồ luồng.

## 2026-10-25 (TINH GỌN THANH CÔNG CỤ TRÌNH SOẠN + TRỢ LÝ HẾT TỪ CHỐI VẼ/ĐẾM TRONG PHẠM VI)

Hai việc trong một đợt, theo yêu cầu của chủ dự án ngày 25/10. Ghi chú chất lượng trong hộp thoại xuất bản (chưa quyết xóa hay giữ), biểu đồ 4 mức lớp (đã park), RLS thật và mật khẩu tài khoản KHÔNG đụng trong đợt này.

- **Tinh gọn thanh công cụ trình soạn (giáo viên)**: nhãn dài gây rối được rút ngắn nhất quán cả 4 trình soạn — "Xem trước như học sinh" -> "Xem trước", "Cập nhật lên web học sinh" -> "Cập nhật lên web". Nghĩa đầy đủ vẫn giữ trong tooltip (nút xem trước giữ tooltip mô tả, nút cập nhật giữ/gắn tooltip "Cập nhật lên web học sinh"). Khoảng cách và padding nút thu hẹp một chút (gap-2 -> gap-1.5; px-3 -> px-2.5, px-3.5 -> px-3, px-4 -> px-3.5; py-2 -> py-1.5 ở thanh trên cùng), nút chính màu xanh vẫn nổi bật nhất. GIỮ NGUYÊN đủ chức năng, không bỏ nút nào: đã kiểm tra code, "Lưu nháp" là chỗ lưu duy nhất ở 3/4 trình soạn (video/lý thuyết/bài tập không có tự động lưu, chỉ QuizBuilder có autoSaveTimer) nên bỏ là mất bài; huy hiệu trạng thái (Bản nháp) và dòng "Đã lưu nháp lúc" là 2 thông tin khác nhau (trạng thái xuất bản vs thời điểm lưu) nên giữ cả hai. Hành vi lưu/xuất bản không đổi (xuất bản vẫn tự lưu trước). Trình soạn bài tập (AssignmentEditor) không có thanh trên cùng mà có thanh hành động dưới cùng với nhãn vốn đã ngắn ("Lưu nháp", "Giao bài cho học sinh"/"Cập nhật bài đã giao") nên chỉ thu hẹp gap/padding cho nhất quán, không đổi nhãn. Nút xuất bản CHỦ ĐỀ ở trang chi tiết chủ đề và trong PublishModal vẫn giữ nhãn cũ (không thuộc 4 trình soạn).
- **Trợ lý hết từ chối vẽ/đếm trong phạm vi (theo báo cáo của chủ dự án trên trình duyệt của chính chủ dự án, AI live)**: trước đây khi hỏi "vẽ sơ đồ" rồi "Lớp 7A4 có bao nhiêu học sinh chưa có điểm?", trợ lý trả lời kiểu "Em xin lỗi, em không thể vẽ sơ đồ cho câu hỏi này. Em chỉ có thể vẽ biểu đồ khi câu trả lời xoay quanh so sánh/phân bố/xu hướng..." rồi chỉ đề nghị liệt kê thay vì trả lời — vi phạm lệnh toàn quyền từ đợt 2. Nay sửa 3 chỗ: (1) get_score_distribution trả thêm tongHocSinh (tổng số học sinh trong phạm vi lọc), soHocSinhChuaCoDiem + hocSinhChuaCoDiem (học sinh trong phạm vi lọc mà không nằm trong khoảng điểm nào, tức chưa có lượt làm/chấm trong kỳ — tính bằng scoped trừ đi thành viên các khoảng, đã kiểm chứng bằng script tạm: 10 học sinh, 6 có điểm, 4 chưa có điểm, đúng tập hợp); series biểu đồ của công cụ này kèm thêm hàng "Chưa có điểm" để vẽ breakdown đã có điểm vs chưa có điểm (data.cacKhoang vẫn giữ nguyên 4 khoảng điểm để câu trả lời tên theo mức điểm không bị lẫn học sinh chưa có điểm; phanTram của các khoảng là tỉ lệ trong số học sinh có điểm, còn phanTram của hàng "Chưa có điểm" là tỉ lệ trong tổng số — biểu đồ vẽ theo số lượng nên không lệch). (2) Cổng vẽ biểu đồ mở rộng: mô tả công cụ render_chart + quy tắc 2 của prompt nay cho vẽ với MỌI breakdown theo nhóm có dữ liệu (so sánh/phân bố/xu hướng HOẶC đếm theo trạng thái như đã có điểm vs chưa có điểm), không còn giới hạn ở 3 dạng cũ. (3) Prompt thêm quy tắc 5e (câu hỏi đếm theo trạng thái phải gọi công cụ rồi trả lời trực tiếp con số + tên, nếu được yêu cầu vẽ thì gọi thêm render_chart — tuyệt đối không né sang đề nghị khác) và 5f (cấm câu "Em xin lỗi, em không thể..." với mọi yêu cầu nằm trong phạm vi công cụ — phải làm luôn; chỉ từ chối ngắn gọn khi thực sự ngoài phạm vi, kèm việc thay thế làm được ngay). Ranh giới phạm vi KHÔNG ĐỔI (chỉ dữ liệu giáo viên đó, không mở sang giáo viên khác hay quản trị hệ thống); các công cụ ghi đã có không đụng. LƯU Ý KIỂM CHỨNG: hành vi AI live chỉ kiểm chứng được trên trình duyệt của chính chủ dự án (khóa Gemini nằm trong localStorage của trình duyệt đó) — chủ dự án hỏi lại trợ lý "Lớp 7A4 có bao nhiêu học sinh chưa có điểm?" + "vẽ sơ đồ" để thấy câu trả lời trực tiếp kèm biểu đồ.

## 2026-10-25 (TIÊU ĐỀ NỘI DUNG HỌC SÁT DẢI LUỒNG — KHE 0)

Sửa spacing thuần túy theo yêu cầu mới của chủ dự án ngày 25/10 (ưu tiên hơn bản "thu hẹp" trước đó): sau khi sửa, dải LUỒNG HỌC nằm sát ngay dưới khối tiêu đề "Nội dung học", margin/padding giữa hai khối = 0, không còn khe trắng nào ở chỗ đã khoanh. Không đổi vị trí các khối (dải vẫn trên cùng, trên cả hàng công cụ), không đổi nội dung, không đụng tới các màn khác. Sơ đồ KHÔNG đổi (không đổi nội dung mục, quan hệ hay file/hàm nào của mục nào) nên không sinh lại sơ đồ đợt này.

- **Nguyên nhân khe trắng (đo từ code)**: khe giữa border dưới của khối tiêu đề và mép trên của dải = `mb-6` (24px) của PageHeader + `gap-6` (24px) của container cột ngoài trong TeacherContentScreen = 48px, cộng thêm `pb-4` (16px) nằm TRONG khối tiêu đề (giữa dòng mô tả và đường border). Vùng chứa dải (two-pane area, khung phải) và bản thân dải (TopicFlowStrip) không có margin/padding trên nào — không phải nguồn gây khe.
- **Cách sửa**: PageHeader thêm prop tùy chọn `flush` (mặc định false, các màn khác gọi không kèm prop nên không đổi gì) — khi bật, margin dưới khối tiêu đề chuyển `mb-6` -> `mb-0`; TeacherContentScreen bật `flush` cho tiêu đề "Nội dung học" và đổi container cột ngoài từ `gap-6` -> `gap-0` (hai con in-flow duy nhất của cột là tiêu đề và vùng two-pane; các modal còn lại đều fixed/null khi đóng nên gap-0 không ảnh hưởng chúng). Kết quả: mép trên của dải chạm đúng đường border dưới của khối tiêu đề (0px ở điểm tiếp giáp). Giữ nguyên: `pb-4` + đường border của khối tiêu đề (thiết kế nội bộ của header, giống mọi trang giáo viên khác), `mb-3` dưới dải (khe giữa dải và hàng công cụ), menu "+ Thêm bài" (z-50) và thanh công cụ sticky (z-20) không xung đột.

## 2026-10-25 (NHIỆM VỤ TUẦN VỀ TRƯỚC ĐỢT 2 + DẢI LUỒNG LÊN TRÊN CÙNG + MỐC QUÀ LÊN SUPABASE)

Ba việc trong một đợt, theo quyết định của chủ dự án ngày 25/10. Ghi chú chất lượng trong hộp thoại xuất bản (chưa quyết xóa hay giữ), biểu đồ 4 mức lớp (đã park), phân quyền trợ lý AI, RLS thật và mật khẩu tài khoản KHÔNG đụng trong đợt này.

- **Thẻ Nhiệm vụ tuần trở về như trước đợt 2 (học sinh)**: thẻ nay CHỈ liệt kê BTVN quiz, KHÔNG gộp bài BI từ getStudentAssignments nữa (gỡ hẳn phần lấy bài BI khỏi weeklyTasks trong HomeScreen; import getStudentAssignments ở HomeScreen cũng gỡ). Hậu quả đã được chủ dự án chấp nhận: với hs001 thẻ sẽ lại hiện trạng thái trống (vì 4 bài của hs001 đều là bài BI), danh sách đầy đủ vẫn ở mục Bài tập — mục đó vẫn dùng getStudentAssignments bình thường, không đụng tới. Không "sửa" trạng thái trống này. Cách hiển thị giữ nguyên (tối đa 4 dòng, nhiều hơn thì nút "Xem tất cả" sang mục Bài tập).
- **Dải luồng học lên trên cùng khung phải (giáo viên)**: dải TopicFlowStrip (nút tròn từng bài + "+ Thêm bài") chuyển từ cuối thân trình soạn lên TRÊN CÙNG khung phải, TRÊN CẢ hàng công cụ (Quay lại / Lưu nháp / Cập nhật lên web học sinh), đúng vạch đen chủ dự án vẽ ở mép trên. Cách làm ít rủi ro nhất sau khi kiểm tra code: dải chỉ render một lần ở shell chung (TeacherContentScreen), mọi props đều ở cấp shell (stripTopic/stripItems/handleFlowReorder/handleCreateNewManual) nên chỉ cần đổi thứ tự render trong shell — không sửa từng trình soạn. Mọi trình soạn dùng dải này (video/lý thuyết/quiz/bài tập) đều thấy cùng vị trí mới; kéo-thả đổi thứ tự giữ nguyên (lưu ngay qua saveTopic flowOrder); menu "+ Thêm bài" (z-50) vẫn phủ lên thanh công cụ sticky (z-20) bên dưới.
- **Mốc quà giáo viên tạo chuyển lên Supabase (migration_012)**: trước đây SupabaseRewardRepository ủy thác sang mock repo nên mốc chỉ nằm trong localStorage của trình duyệt tạo nó (key mam_van_rewards) — học sinh trên máy khác không thấy. Nay getRewards/saveReward/deleteReward đọc/ghi bảng thật `reward_tiers` (file database/migration_012_reward_tiers.sql: id text, teacher_id, required_xp/xp_cost, required_attendance_days, tier_key, teaser_description, secret_name/secret_description, is_physical, name, description, stock, is_active, created_at/updated_at; RLS allow_all theo mẫu migration_002/005 — ghi rõ trong file là cần vòng khóa thật sau). Ngữ nghĩa hợp nhất hướng (c) giữ nguyên: học sinh thấy 5 mốc mặc định + mốc của giáo viên phụ trách lớp mình; giáo viên thấy 5 mặc định (chỉ xem) + mốc tự tạo (quản lý được); mốc lưu mới gắn teacherId (màn quản lý đã gắn sẵn từ đợt trước); khử trùng theo id; xếp theo XP tăng dần; quy tắc secret giữ nguyên. AN TOÀN THỨ TỰ TRIỂN KHAI: code deploy trước, SQL chạy sau vẫn an toàn — Supabase chưa sẵn sàng hoặc bảng chưa tồn tại / lỗi đọc-ghi thì code fallback về mốc local cũ, app không vỡ; sau khi lưu/xóa Supabase thành công vẫn ghi audit + phát sự kiện 'reward' như mock để các màn dùng useLiveQuery tự tươi. Mốc local cũ KHÔNG tự bay sang Supabase: sau khi chạy SQL, giáo viên tạo lại mốc 1 lần (máy nào cũng được) thì học sinh mọi máy đều thấy; khi code đọc được bảng Supabase thì mốc local cũ không còn hiện nữa (code đọc Supabase trước, chỉ fallback khi bảng chưa có / lỗi).

## 2026-10-24 (GỘP MỐC QUÀ 2 NGUỒN — HƯỚNG C)

User chốt hướng (c) "gộp cả hai nguồn lại" sau chẩn đoán đợt 2 (học sinh thấy danh mục cứng REWARDS_CATALOG, giáo viên thấy kho trống vì getSeedRewards trả []).

- **Danh mục hợp nhất phía học sinh**: màn Đổi quà (RewardsScreen) nay hiện hợp nhất gồm 5 mốc mặc định + mốc giáo viên tự tạo trong kho thuộc giáo viên phụ trách lớp mình. Giáo viên của học sinh được tra qua tài khoản → lớp → teacherId của lớp; nếu tra không được thì chỉ hiện mốc chưa gắn dấu (không bao giờ lộ mốc của giáo viên khác). Khử trùng theo id: mốc trong kho thắng khi trùng id với mốc mặc định. Sắp xếp theo XP yêu cầu tăng dần. Lịch sử yêu cầu và rương đã mở cũng tra theo danh mục hợp nhất (quy tắc secret giữ nguyên: chưa mở chỉ hiện "Quà bí mật", đã mở mới hiện tên thật). Teaser "mốc gần đạt nhất" ở Trang chủ cũng tính theo danh mục hợp nhất để khỏi lệch với trang Đổi quà.
- **Danh mục hợp nhất phía giáo viên**: tab Danh mục trong màn Quản lý quà nay hiện hợp nhất gồm 5 mốc mặc định (gắn nhãn "Mặc định", chỉ xem trước — không sửa/xóa được) + mốc giáo viên tự tạo thuộc chính giáo viên đó (thêm/sửa/xóa như trước). Mốc lưu mới được gắn teacherId khi lưu (sửa mốc cũ giữ dấu cũ, sửa mốc chưa gắn dấu thì nhận dấu của giáo viên đang sửa). Mốc cũ chưa gắn dấu vẫn hiện cho giáo viên (tương thích ngược).
- **Kỹ thuật**: thêm trường tùy chọn teacherId vào RewardTier; 2 hàm thuần trong data/rewards.ts — mergeRewardTiers (gộp + khử trùng theo id + sắp xếp theo XP) và filterDbRewardsForOwner (lọc theo giáo viên, không mở rộng phạm vi). Kho quà vẫn là kho localStorage (repo Supabase ủy thác sang mock repo) nên không cần migration SQL. Luồng gửi yêu cầu của học sinh không đổi logic (tra catalog trước rồi kho dự phòng — 2 nguồn không trùng id qua UI nên giá không lệch); chỉ cập nhật chú thích cho đúng danh mục hợp nhất. Trợ lý AI tra tên quà và DevPanel giữ nguyên (ngoài phạm vi đợt này, không hồi quy).
- **Kiểm chứng logic hợp nhất (script tạm, không commit)**: catalog 5 + kho 4 (1 trùng id, 1 của GV khác, 1 chưa gắn dấu, 1 của GV mình) → hợp nhất cho GV mình = 7 (trùng id lấy bản kho, mốc GV khác bị ẩn, mốc chưa gắn dấu giữ lại), sắp xếp đúng 100 → 999; GV không xác định được = 6 (chỉ mặc định + chưa gắn dấu).
- **Sơ đồ hệ thống**: cập nhật theo đúng luật sơ đồ (xem chi tiết trong báo cáo đợt này).

## 2026-10-24 (ĐỢT 2 — NHÁP LÝ THUYẾT / TRÌNH SOẠN / CÂY CHỦ ĐỀ / TRANG TIẾN ĐỘ / MỐC QUÀ / SIDEBAR / TRANG CHỦ / TRỢ LÝ TÊN THEO MỨC ĐIỂM + CÔNG CỤ GHI)

Đợt 2 trong đêm 24/10, tiếp nối đợt 1 cùng ngày (commit c291c45). Biểu đồ 4 mức năng lực của cả lớp vẫn TẠM GÁC theo dặn của chủ dự án nên đợt này KHÔNG đụng.

- **Nháp lý thuyết nay đẩy được vào học liệu (giáo viên)**: trước đây thẻ nháp lý thuyết chỉ có "Duyệt trong Studio" (lưu lại vẫn là nháp) + "Xóa nháp" nên duyệt xong nháp vẫn nằm đó. Nay mỗi thẻ nháp lý thuyết có thêm nút "Đưa vào học liệu" (chỉ người tạo nháp mới đẩy được, theo đúng mẫu luồng câu hỏi): lý thuyết trở thành bài lý thuyết trong cây nội dung của chủ đề đó (lý thuyết là học liệu, KHÔNG vào ngân hàng câu hỏi), đẩy xong XÓA nháp. Mô tả tab Nháp cập nhật đúng đích đến này. Đồng thời sửa lỗi rớt nháp khi duyệt từ Studio: đường áp dụng nháp lý thuyết nay xóa khóa nháp tường minh trước khi đóng modal (trước đây dựa vào hiệu ứng tự lưu, có thể không chạy kịp khi modal đóng cùng nhịp).
- **Thanh công cụ trình soạn lên trên dải luồng (giáo viên)**: dải danh sách bài của chủ đề (TopicFlowStrip) chuyển từ trên xuống dưới khối trình soạn trong khung phải — hàng nút "Quay lại | Chỉnh sửa bài giảng | Bản nháp | Xem trước như học sinh | Lưu nháp | Cập nhật lên web học sinh" nay nằm ở vị trí cao nhất của khung phải. Mọi nút + chức năng giữ nguyên; dải luồng vẫn dùng được bình thường ở dưới thân trình soạn.
- **Xóa 2 hộp cảnh báo trong trình soạn bài kiểm tra (giáo viên)**: gỡ hẳn khối kiểm tra chất lượng (runQualityCheck) và băng-rôn "Lưu ý chất lượng bài kiểm tra" / "Có lỗi cần sửa trước khi xuất bản" trong QuizBuilder. Đồng thời gỡ luôn 3 chặn đi kèm: nút xuất bản hết chuyển màu đỏ/khóa khi có lỗi, luồng xuất bản hết bỏ qua bước lưu khi bị chặn, và cổng cha hết từ chối mở modal xuất bản khi bị chặn. Hệ quả theo đúng yêu cầu chủ dự án: bài kiểm tra 0 câu hỏi (hoặc thiếu đáp án) nay vẫn xuất bản được — không còn chặn ẩn nào.
- **Nút thu gọn cây chủ đề (giáo viên)**: tiêu đề panel "Cây chủ đề" có thêm 1 nút thu gọn toàn bộ panel thành rail (tái dùng đúng cơ chế rail khi mở trình soạn: rail có nút mở lại, bấm mở lại thì cây trở lại đầy đủ). Hành vi đóng/mở từng chủ đề và persist theo giáo viên từ đợt 1 không đổi; trạng thái thu gọn thủ công chỉ giữ trong phiên trang.
- **Xóa hẳn trang "Tiến độ & lượt làm bài" (giáo viên)**: xóa file TeacherProgressScreen.tsx, mục nav, loại tab khỏi TeacherNavTab và nhánh render trong TeacherPortal. Đã rà soát: không còn chỗ nào import hay liên kết tới trang này (Tổng quan/widget/thông báo không trỏ tới nó). Các loại huy hiệu 'progress' trong badges.ts/types.ts là danh mục huy hiệu, không liên quan, giữ nguyên.
- **Rà soát mốc quà không khớp (giáo viên 0 mốc, học sinh có mốc) — CHƯA SỬA, chờ chủ dự án chốt**: nguyên nhân gốc đã xác minh: hai nguồn sự thật khác nhau. Phía học sinh luôn hiện danh mục cứng REWARDS_CATALOG (5 mốc XP cố định). Phía giáo viên hiện danh mục từ rewardService.getRewards(), mà kho mock khởi tạo bằng danh sách rỗng (getSeedRewards trả []) nên giáo viên chưa tự tạo mốc nào thì trang quản lý đúng là trống. Đây KHÔNG phải lỗi sai khóa/sai bộ lọc — mà là quyết định sản phẩm (mốc nào mới là chuẩn: danh mục cứng của học sinh, mốc giáo viên tự tạo, hay gộp hai nguồn). Đợt này không tự chọn; chờ chủ dự án quyết rồi mới sửa.
- **Sidebar học sinh ở khung desktop (học sinh)**: khung aside desktop nay cho vùng nav cuộn nội bộ và ghim khối cuối (thẻ XP + chip avatar/họ tên/lớp) — chip không còn bị đẩy xuống dưới nếp gấp khi nội dung cao hơn viewport (trước đây chỉ thu nhỏ cửa sổ mới thấy chip). Logo "Mầm Văn" chống ngắt từ (nowrap ở hàng chữ + khóa co ở cụm logo) nên không còn vỡ thành "Mầ" / "m".
- **Trang chủ học sinh (mục 8)**: thẻ "Nhiệm vụ tuần" trước đây chỉ nhìn BTVN quiz nên học sinh có bài BI được giao vẫn thấy trống. Nay thẻ liệt kê bài tập được giao từ CÙNG nguồn với danh sách "Bài tập được giao" (bài BI từ assignments/targets + BTVN quiz), sắp xếp theo hạn nộp (không hạn xếp cuối), mỗi dòng có tiêu đề, số câu, hạn nộp, trạng thái đã nộp/chưa nộp, điểm cao nhất (nếu có) và nút Làm bài/Làm lại; hiển thị tối đa 4 bài, nhiều hơn 4 thì có nút "Xem tất cả" sang mục Bài tập; chỉ hiện trạng thái trống khi thực sự không có bài nào. Huy hiệu +20 XP và nút "Đến kho bài học rèn luyện" (khi trống) giữ nguyên. Mục "Chủ đề học kỳ này" chỉ hiện tối đa 4 thẻ; nút "Tất cả bài học" sẵn có đã mở đúng danh sách đầy đủ ở mục Học bài (bộ lọc mặc định là tất cả) nên không phải sửa thêm. Kiểu onNavigateTab của HomeScreen mở rộng sang NavTab để nút "Xem tất cả" sang được mục Bài tập (cổng cha vốn đã hỗ trợ).
- **Trợ lý trả lời tên theo mức điểm (mục 9)**: hàm phổ điểm nay kèm danh sách học sinh từng khoảng (tên + điểm TB, xếp theo điểm giảm dần) và công cụ get_score_distribution trả thêm trường hocSinh mỗi khoảng; mô tả công cụ + quy tắc prompt 5c cập nhật: hỏi "điểm khá là những ai" thì trả tên thật từ công cụ, không xin lỗi vì quyền/công cụ. Kiểm chứng mức code: học sinh TB 7,2 rơi đúng khoảng Khá kèm tên + điểm. Công thức tính điểm không đổi (trắc nghiệm scoreRatio×10 + tự luận đã chấm; không dùng bảng xếp hạng chỉ tính quiz để khỏi lệch khoảng).
- **Trợ lý có công cụ ghi — toàn quyền trong phạm vi giáo viên (mục 10)**: bổ sung 9 công cụ đọc + 17 công cụ ghi trong analyticsAssistant.ts, đi qua ĐÚNG service/repository mà UI dùng (contentRepo/quizRepo/essayRepo/rewardRepo/biRepository, import trực tiếp để tránh vòng lặp với services/index). Đọc: học sinh của lớp, chủ đề, bài kiểm tra, bài tập đã giao, câu hỏi, chi tiết bài tự luận, bài tự luận chờ chấm, phiếu chấm BI chờ duyệt, yêu cầu quà chờ duyệt. Ghi: tạo chủ đề (nháp), tạo nháp video/lý thuyết (đã gắn vào luồng chủ đề), xuất bản/gỡ xuất bản học liệu, tạo bài kiểm tra (nháp), tạo câu hỏi vào ngân hàng riêng, xuất bản bài kiểm tra, tạo bài tập BI (giao ngay), sửa bài tập BI (trường không nêu giữ nguyên), chấm tự luận, chấm phiếu chờ duyệt BI, duyệt/từ chối yêu cầu quà, xóa học liệu/bài kiểm tra/câu hỏi (qua đúng luồng xóa của app). Mọi công cụ ghi đối chiếu tên/id với dữ liệu của chính giáo viên trước khi làm (lớp, học sinh, chủ đề, bài, phiếu, yêu cầu quà); ngoài phạm vi thì trả lỗi rõ ràng, không bịa id. Thông báo cho lớp thực hiện qua cờ notifyStudent của luồng xuất bản (không có API thông báo độc lập). Prompt viết lại quy tắc 5 (hành động trực tiếp, không xin xác nhận thêm, báo kết quả cụ thể sau mỗi hành động) + thêm 5d (tên mơ hồ thì liệt kê đối chiếu, không đoán). Giới hạn còn lại (chưa có công cụ): quản trị giáo viên khác, cài đặt hệ thống, gửi thông báo độc lập ngoài luồng xuất bản, sửa/xóa tài khoản học sinh, và đổi mật khẩu — các việc này vẫn phải làm trên UI hoặc do quản trị hệ thống.
- **Sơ đồ hệ thống**: cập nhật theo đúng luật sơ đồ (xem chi tiết trong báo cáo đợt 2).

## 2026-10-24 (ĐỢT SỬA THEO YÊU CẦU CHỦ DỰ ÁN — BÀI TẬP / HỌC BÀI / ĐIỂM MỚI / NGÂN HÀNG / AI TOÀN QUYỀN)

Đợt sửa một đợt chung (học sinh + giáo viên) theo đúng kế hoạch đã duyệt ngày 24/10 (file KE-HOACH-dot-sua-2026-10-24.md trong thư mục goal). Biểu đồ 4 mức năng lực của cả lớp được chủ dự án dặn để sau nên đợt này TUYỆT ĐỐI KHÔNG làm.

- **Mục Bài tập mới (học sinh, nằm ngay dưới mục Học bài)**: 2 tab "Kiểm tra" / "Về nhà", sắp xếp theo hạn nộp (không hạn thì xếp cuối). Tab Kiểm tra gồm quiz nội dung loại quick/mastery/final; tab Về nhà gồm quiz homework + bài tập BI cô giao (dữ liệu BI luôn ghi display_location='HOMEWORK'). Bấm bài chưa làm thì mở làm bài; bấm bài kiểm tra đã làm thì mở màn xem lại.
- **Nút Học bài mới (học sinh)**: bỏ 3 nút Luồng học / Xem video / Lý thuyết chung, thay bằng MỘT nút "Học bài" trên mỗi thẻ chủ đề. Bấm nút thì mở danh sách luồng học đúng thứ tự cô đã đẩy (chỉ mục đã đẩy mới hiện, nháp không hiện); điều hướng từ Trang chủ/Cây/Kết quả tới chủ đề thì tự mở sẵn danh sách Học bài của chủ đề đó.
- **Điểm mới ở Kết quả học tập (học sinh)**: bỏ hiển thị 4 mức nhớ/hiểu/phân tích/vận dụng ở phía học sinh (4 mức vẫn giữ phía giáo viên + AI; hàm calculateAllMastery KHÔNG bị sửa, chỉ còn dùng cho chip trạng thái tổng quát). Thay bằng: trắc nghiệm (đúng/tổng câu, điểm TB — trắc nghiệm = single/multi/fill; điểm tạm 0.8 của tự luận lúc nộp KHÔNG được tính vào đây) + tự luận (thang 10, đạt/chưa đạt với ngưỡng 5, đã chấm/chưa chấm — điểm/nhận xét lấy từ phiếu chấm essay_submissions, hợp nhất với bản local) + lịch sử lần làm (gom các câu cùng một lần nộp theo dấu thời gian) + nút "Xem chi tiết" mở popup toàn bộ bài đã làm (trắc nghiệm trước, tự luận sau) kèm nhận xét của cô ngay dưới bài làm; tự luận chưa chấm ghi rõ "cô giáo chưa chấm". Thêm mục "Điểm theo từng bài kiểm tra" cho bài tập BI cô giao (điểm cao nhất, trạng thái chấm, số lần nộp + popup đáp án + nhận xét theo từng lần nộp).
- **Bài kiểm tra chỉ làm 1 lần (học sinh)**: quiz nội dung loại quick/mastery/final đã hoàn thành (dấu quiz_completed) thì mọi lối vào (Học bài, Bài tập, Trang chủ) đều đi qua cùng một điểm chặn ở App và mở màn xem lại (đúng/sai mới nhất theo từng câu + trạng thái/điểm/nhận xét tự luận), không ghi thêm kết quả, không cộng XP. BTVN (homework + bài tập BI) làm lại không giới hạn. Lịch sử làm bài cũ giữ nguyên.
- **Vùng soạn Nội dung học (giáo viên)**: khi mở trình soạn (video/lý thuyết/quiz/bài tập) thì cây trái thu gọn thành rail chỉ còn nút mở lại để vùng soạn chiếm toàn bộ khung phải; thoát soạn thì cây trở lại; cô vẫn mở lại cây bằng nút trên rail bất cứ lúc nào.
- **Bỏ hẳn thumbnail video (giáo viên + học sinh)**: gỡ khỏi trình soạn (state, upload, khối hiển thị), khỏi xem trước (thuộc tính poster) và khỏi thẻ danh sách (không còn đọc thumbnailUrl); dữ liệu cũ trong DB giữ nguyên, không xóa. Thẻ VideoCard hiện không còn nơi nào dùng (lưới video ở Học bài đã bỏ) nhưng vẫn gỡ nhánh ảnh để khỏi hiện lại.
- **Cây chủ đề giữ trạng thái đóng/mở (giáo viên)**: trạng thái từng chủ đề lưu theo giáo viên (localStorage khóa theo teacher id) — rời trang rồi quay lại vẫn giữ nguyên như lúc rời đi; lần đầu/chủ đề mới mặc định mở như cũ.
- **Ngân hàng nháp→chính (giáo viên)**: chuyển hẳn — câu đã đẩy bị xóa khỏi nháp, hết nháp thì xóa luôn khóa nháp (hành vi này vốn đã đúng, nay ghi rõ + giữ nguyên). Chỉ chính giáo viên tạo ra nháp mới được chuyển: nháp do AI tạo được đóng dấu người tạo từ lúc lưu; mục nháp chỉ hiện nháp của chính giáo viên + nháp cũ chưa đóng dấu (tương thích ngược); nháp có dấu của giáo viên khác không hiện, không chuyển được. Ngân hàng câu hỏi vốn đã tách theo giáo viên ở tầng kho (chỉ lấy câu của chủ sở hữu theo phiên) nên không đổi thêm.
- **Thêm thủ công bài tập đánh giá (giáo viên)**: màn soạn Bài tập & đánh giá (AssignmentEditor) trước đây chỉ chọn câu từ ngân hàng; nay có thêm khối "Tạo câu hỏi mới (thủ công)" đủ 4 loại (TN 1 đáp án / TN nhiều đáp án / Điền khuyết / Tự luận) — câu mới lưu vào ngân hàng riêng của giáo viên và đưa thẳng vào đề, bấm Lưu/Giao bài mới ghi nhận vào bài.
- **Màu chủ đề đậm lên**: nền thẻ + viền ở cây chủ đề, dải luồng và kết quả học tập dùng độ đậm cao hơn; 2 màu nhạt nhất trong bảng chọn (Xanh tre, Hổ phách) đổi sang tông đậm hơn.
- **Trợ lý Phân tích AI toàn quyền (giáo viên)**: gỡ quy tắc cũ "không tự giao bài, đổi điểm hay sửa dữ liệu — chỉ đề xuất". Nay trợ lý hành động với toàn quyền của giáo viên trong phạm vi dữ liệu của giáo viên đó: không từ chối vì lý do quyền hạn khi yêu cầu nằm trong dữ liệu của giáo viên; việc có công cụ thì làm thẳng, việc chưa có công cụ ghi thì chuẩn bị sẵn để giáo viên bấm một lần là xong. Mọi số vẫn phải tính từ công cụ, thiếu dữ liệu vẫn trả lời "chưa đủ dữ liệu"; phân tách theo giáo viên vẫn giữ (công cụ chỉ thấy dữ liệu của giáo viên đó). Chưa dựng công cụ ghi mới — trợ lý chưa tự ghi dữ liệu mà không qua bước tay của giáo viên. Nhãn trạng thái đổi từ "AI Thật Đang Hoạt Động" thành "AI Đang Hoạt Động".
- **Sơ đồ hệ thống**: cập nhật theo đúng luật sơ đồ — TREE +12 nút (296 nút), quan hệ 22 → 24 (bỏ quan hệ "% năng lực → Kết quả học tập" vì phía học sinh đã bỏ hiển thị %, thêm 3 quan hệ: Bài tập → QuizRunner, Học bài → QuizRunner, Điểm kiểm tra → Hàng đợi chấm), code-map 295/295 không lỗi. Bản HTML mới đã chép vào docs/ của repo.

## 2026-10-22 (RÀ SOÁT BỔ SUNG 2 — GỠ NỐT 2 CỤM SỐ BỊA NGOÀI CHECKLIST: TƯƠNG TÁC & CHUYÊN CẦN + ĐỘ TIN CẬY AI)

Đợt bổ sung chiều nay phát hiện thêm 2 cụm bịa nằm ngoài checklist 5 cụm; chủ dự án duyệt xử nốt trong ngày:

- **Tab "Tương tác & chuyên cần" (Phân tích)**: bỏ hẳn chỉ số "thời gian mở web" từng suy diễn bằng công thức phút học × 1,35 + 15 (hệ thống không hề đo thời gian mở web). Phút học tích cực của từng học sinh hết cộng "28 phút mỗi ngày điểm danh" — nay chỉ tính từ giây học đã ghi nhận thật (giây hôm nay + giây phiên liên tục), cùng nguồn với thẻ Tổng quan. Cột và thẻ "chạm trần XP" bị gỡ hẳn vì khái niệm trần XP đã bãi bỏ (hàm điểm danh tuần cũng hết đếm học sinh đạt 900 XP/tuần); thay bằng chỉ số thật: chuỗi ngày điểm danh liên tục dài nhất của từng học sinh và thẻ tổng số buổi điểm danh của lớp. Tỉ lệ chuyên cần trung bình hết mặc định 85% khi chưa có dữ liệu — chưa có học sinh trong phạm vi lọc thì hiện "— / Chưa có dữ liệu điểm danh". Cùng đợt, các phép suy diễn phút học còn sót ở hàm liên quan cũng bị gỡ: biểu đồ theo ngày ở Tổng quan và công cụ hoạt động học tập của Trợ lý hết nhân 32 phút cho mỗi học sinh có mặt (state không lưu phút học theo ngày — biểu đồ nay vẽ số học sinh hoạt động thật theo ngày), hoạt động theo tuần trong hồ sơ học sinh hết nhân 32 phút/ngày (chỉ còn số ngày điểm danh thật), và bảng điểm nội bộ gỡ nốt phép cộng 1800 giây/ngày điểm danh cùng phép chia 6 tuần vô căn cứ.
- **Chỉ số độ tin cậy AI (Xưởng chấm bài)**: hàm tính hết trả số mẫu khi chưa có dữ liệu (trước đây chưa có bài nào vẫn hiện độ chênh 0,35, tỉ lệ sửa nhiều 10%, xu hướng tuần và chênh theo tiêu chí chế sẵn; giao diện còn có thêm số dự phòng 8,5%, tổng bài thẩm định cứng "36" và bảng tiêu chí viết chết trong code). Nay: chưa có bài nào vừa có điểm AI gợi ý vừa có điểm chốt của giáo viên thì hàm trả rỗng và giao diện báo rõ "Chưa đủ dữ liệu để tính độ tin cậy AI". Khi có dữ liệu thật, mọi chỉ số đều tính từ chính các bài đó: độ chênh trung bình và tỉ lệ sửa nhiều từ chênh lệch AI–giáo viên đã ghi, xu hướng tuần gom theo tuần chốt điểm thật, chênh theo tiêu chí ghép cặp điểm rubric của AI với điểm chốt của giáo viên theo đúng tên tiêu chí, và thẻ tổng bài hiện đúng số bài dùng để tính.

## 2026-10-22 (RÀ SOÁT BỔ SUNG — GỠ NỐT 5 CỤM SỐ LIỆU BỊA CÒN SÓT SAU ĐỢT XÓA DỮ LIỆU MẪU)

Đợt rà soát sáng nay đối chiếu lại toàn bộ cây code và phát hiện 5 cụm số liệu/dữ liệu bịa nằm ở các file chưa được chạm tới; nay đã gỡ hết:

- **Thẻ Tổng quan giáo viên**: bỏ tỉ lệ "+15%" bịa khi không có học sinh hoạt động ở kỳ trước — nay không có dữ liệu kỳ trước thì ẩn huy hiệu so sánh (các chênh lệch khác vốn không có phép tính kỳ trước cũng ẩn thay vì hiện "+0%" giả). Tỉ lệ hoàn thành hết dùng mẫu số ước lượng "12 bước/học sinh": nay tính trên TỔNG SỐ BƯỚC HỌC THẬT của các chủ đề trong phạm vi lọc (mỗi video một bước xem hết, lý thuyết một bước đọc hiểu, mỗi bài của chủ đề một bước hoàn thành) nhân số học sinh; cổng giáo viên nay nạp thêm danh sách bài để đếm đúng. Thời gian học tích cực trung bình hết cộng "mỗi ngày điểm danh = 30 phút" và hết chia 6 tuần vô căn cứ — chỉ tính từ số giây hoạt động đã ghi nhận thật, nhãn thẻ đổi thành "Phút học tích cực TB". Trợ lý phân tích dùng chung các hàm tính này nên số của trợ lý khớp thẻ Tổng quan.
- **Phân tích câu hỏi**: bỏ hẳn khối "đáp án nhiễu được chọn nhiều nhất" từng gán đáp án sai đầu tiên với tỉ lệ 65% tổng số lượt sai, và bỏ phép gán thời gian làm bài 140/45 giây theo mức năng lực. Dữ liệu làm bài thật không lưu đáp án học sinh đã chọn cũng không lưu thời gian từng câu, nên hai chỉ số này để trống/0 thay vì suy đoán.
- **Xưởng chấm AI**: bài mẫu chấm sẵn (điểm bịa 9.5/7.5/5.5/3.5) và 3 rubric mẫu không còn được gieo làm mặc định — thư viện mẫu và rubric nay rỗng cho đến khi giáo viên tự tạo/lưu; nhật ký kiểm toán mẫu (dead code) đã xóa hẳn.
- **Hồ sơ học sinh**: state khởi tạo hết mặc định lớp bịa "Lớp 7A2" và tên trường cứng — không tra được lớp thật từ dữ liệu thì để trống; mọi fallback tên lớp "7A2" còn sót trong kho dữ liệu và các màn hình (bản đồ nhiệt, tương tác, chấm bài, quà tặng, thêm học sinh) đều đổi sang tra lớp thật hoặc để trống/"Chưa rõ lớp".
- **Cài đặt hệ thống**: gỡ hẳn các trường trần XP đã bãi bỏ (trần ngày 130/150, trần tuần 900) khỏi giá trị mặc định, khỏi kiểu dữ liệu và khỏi hằng cấu hình; tên trường/lớp mặc định bịa ("Trường THCS Lê Quý Đôn", "7A2") đổi thành trống để giáo viên tự điền. Cài đặt vẫn lưu trong trình duyệt theo từng giáo viên như hiện tại (chưa chuyển lên bảng system_settings — đợt riêng nếu cần); XP điểm danh ngày giữ nguyên hiệu lực.

## 2026-10-22 (VÁ LƯU BỀN + ĐỊNH DẠNG TRỢ LÝ — từ kết quả kiểm chứng)

Kiểm chứng độc lập phát hiện 3 điểm và đã vá cả ba: (1) lịch sử chat của Trợ lý mất sau khi tải lại trang trong môi trường kiểm chứng — key lưu lịch sử chưa nằm trong danh sách bảo vệ của bootstrapStorage nên có thể bị đợt dọn schema quét mất; nay đã thêm 'mam_van_assistant_chat_v1' vào protectedKeys theo đúng nguyên tắc "dữ liệu thật của người dùng không bị dọn theo schema". (2) Nút xóa lịch sử dùng hộp thoại xác nhận native (window.confirm) — khó thao tác/xác nhận trong nhiều bối cảnh; nay đổi sang xác nhận tại chỗ: bấm lần 1 nút chuyển đỏ "Xóa hết?", bấm lần 2 mới xóa, tự hủy sau 3,5 giây. (3) Bộ render markdown tự chế liên tục sót các biến thể mô hình viết lệch (dấu * thừa, trích dẫn >); nay thay bằng thư viện react-markdown + remark-gfm với định dạng theo bảng màu của app.

## 2026-10-22 (ĐỒNG NHẤT + LƯU BỀN LỊCH SỬ TRÒ CHUYỆN TRỢ LÝ — theo yêu cầu chủ dự án)

Lịch sử trò chuyện của Trợ lý phân tích được đưa về MỘT kho dùng chung (assistantChatStore): tab Trợ lý trong mục Phân tích và bong bóng chat nổi đọc/ghi cùng một cuộc hội thoại — hỏi ở nơi này thì nơi kia thấy ngay, trạng thái "đang truy vấn" cũng dùng chung (không gửi trùng từ hai nơi), và lịch sử được lưu bền vào bộ nhớ trình duyệt (tối đa 80 tin nhắn gần nhất) nên tải lại trang không mất. Có nút thùng rác cạnh ô nhập để xóa toàn bộ lịch sử khi cần (xóa một nơi là sạch cả hai).

## 2026-10-22 (KÍCH HOẠT AI THẬT + GỌN GIAO DIỆN TRỢ LÝ)

Đã lấy API Key có sẵn trong Google AI Studio của chủ dự án (dự án mặc định, gói miễn phí) và nhập vào Cài đặt của app: trạng thái chuyển từ "AI Giả lập (Mock Demo)" sang "AI Thật Đang Hoạt Động", kiểm tra kết nối Gemini thành công. Kiểm chứng hỏi đáp trực tiếp của Trợ lý phân tích: câu tổng quan lớp trả số khớp dữ liệu thật (10 học sinh, 38 bài tự luận chờ chấm, dòng bằng chứng đầy đủ, câu gợi ý nối tiếp); câu hỏi chủ đề yếu nhất được trả lời trung thực "chưa đủ dữ liệu" vì toàn hệ thống hiện chỉ có 1 lượt trả lời trong state học sinh (dữ liệu lượt làm ở các bảng tiến độ là nguồn riêng — nhất quán với các tab cố định). Đồng thời sửa hiển thị: bong bóng trợ lý nay render đúng định dạng (tiêu đề, chữ đậm, gạch đầu dòng) thay vì hiện ký hiệu markdown thô, và tắt thinking budget trên model flash để trả lời nhanh hơn.

## 2026-10-22 (BỔ SUNG: BONG BÓNG CHAT TRỢ LÝ PHÂN TÍCH — theo yêu cầu chủ dự án)

Ngoài tab trong mục Phân tích, Trợ lý phân tích nay có thêm bong bóng chat nổi ở góc phải dưới của cổng giáo viên: hiện ở mọi màn hình (Tổng quan, Nội dung, Chấm bài, Tiến độ…), bấm vào mở khung chat ngay tại chỗ với cùng 6 công cụ và cùng bộ lọc chung của trang Phân tích nên số liệu luôn khớp; đóng/mở lại không mất nội dung hội thoại.

## 2026-10-22 (TRỢ LÝ PHÂN TÍCH AI — GIAI ĐOẠN 1, theo phương án chủ dự án duyệt)

Mục Phân tích có thêm tab đầu tiên "Trợ lý phân tích AI": giáo viên hỏi bằng lời thường, Gemini chọn công cụ truy vấn phù hợp trong 6 công cụ (tổng quan lớp / so sánh chủ đề / phổ điểm / phân tích câu hỏi / hồ sơ học sinh / hoạt động học tập), hệ thống chạy đúng các hàm tính mà các tab cố định đang dùng trên dữ liệu thật, AI chỉ diễn đạt kết quả, nêu bằng chứng (số học sinh · số lượt trả lời · khoảng thời gian) và đề xuất bước tiếp theo + câu hỏi nối tiếp. Biểu đồ (cột/đường) do AI khai báo loại và trục qua một công cụ riêng, nhưng số liệu vẽ lấy nguyên văn từ kết quả công cụ — AI không chạm vào dữ liệu điểm. Rào chắn: mẫu quá ít thì trợ lý phải nói "chưa đủ dữ liệu" thay vì kết luận; trợ lý không tự giao bài/đổi điểm; chưa nhập khóa Gemini ở Cài đặt thì hiện hướng dẫn thay vì trả lời bịa. Các tab biểu đồ cố định giữ nguyên như chủ dự án đã duyệt.

Kèm sửa một lỗi dây chuyền phát hiện trong lúc làm: cổng giáo viên trước đây KHÔNG truyền ngân hàng câu hỏi vào màn Phân tích, khiến tab Phân tích câu hỏi và phần tra cứu câu hỏi trong Hồ sơ học sinh luôn nhận ngân hàng rỗng (hiện 0 dù kho có 27 câu) — nay cổng đã nạp và truyền đúng ngân hàng thật.

## 2026-10-22 (GỘP PHIẾU CHẤM VÀO HÀNG ĐỢI CHẤM BÀI — theo lệnh chủ dự án)

Trước đây hàng đợi "Chấm bài" chỉ đọc bảng bài nộp tự luận (đang 0 bài) nên hiện "Cần chấm 0", trong khi 39 phiếu chờ chấm thật (câu tự luận học sinh nộp qua bài được giao / luồng học, lưu ở bảng phiếu chấm của nhánh tiến độ) chỉ xem/chấm được ở màn Tiến độ bài làm. Nay gộp về một mối:

- Hàng đợi chấm đọc thêm phiếu chờ + phiếu đã chấm của đúng phạm vi học sinh thuộc giáo viên (id phiếu mang tiền tố riêng), hiển thị cạnh bài nộp thường: đúng học sinh, đúng lớp, đề bài thật từ bảng câu hỏi, nguồn bài (tên bài tập/hoạt động) làm tiêu đề, thời gian chờ thật.
- Quy đổi thang điểm hai chiều: hàng đợi chấm thang 10, phiếu tính theo điểm tối đa riêng của từng câu (2/3/4 điểm) — điểm đã chấm hiển thị quy về thang 10, khi chốt điểm ở hàng đợi thì quy ngược về thang của câu trước khi ghi.
- Chốt điểm tại hàng đợi ghi ngược về ĐÚNG nguồn: phiếu → ĐÃ CHẤM (kèm điểm, nhận xét, rubric, người chấm theo UUID phiên đăng nhập), câu trả lời → đã chấm, tổng điểm của lượt làm tính lại — nên số "chờ chấm" ở màn Tiến độ tự khớp ngay vì cùng một bảng. Kèm kiểm toán + thông báo học sinh + ghi năng lực như bài nộp thường; nháp chấm của phiếu lưu bền trên máy và tự xóa khi chốt.
- Tài khoản/mật khẩu giữ nguyên theo ý chủ dự án.

## 2026-10-22 (TIẾP RÀ SOÁT — SỬA NHÃN LỚP BỊA Ở PHÂN TÍCH ĐIỂM)

Phiên kiểm chứng sau đợt xóa dữ liệu mẫu phát hiện bảng điểm nội bộ giáo viên ghi lớp "7A3" cho cả 10 học sinh (thật: 7A4). Gốc rễ: code thời demo gán nhãn theo điều kiện cứng — lớp nào không phải mã demo 'class_7a2' thì mặc định '7A3'; xu hướng điểm tuần cũng chia đôi học sinh theo 2 lớp demo đó. Đã sửa: tên lớp ở bảng điểm tra từ danh sách lớp THẬT của giáo viên (dự phòng: khối/lớp trong hồ sơ của chính học sinh, không có nữa thì để '—'); xu hướng tuần bỏ hẳn cách chia lớp bịa, chỉ tính điểm trung bình từ toàn bộ kết quả thật. Kiểm chứng lại ngân hàng câu hỏi bằng truy vấn REST trực tiếp: cả 27 câu của gv001 đều trả về đúng — con số 0 trong phiên kiểm chứng trước là lỗi nạp nhất thời của phiên trình duyệt đó, không phải lỗi dữ liệu/code (sẽ kiểm chứng lại trực quan riêng ngân hàng).

## 2026-10-22 (RÀ SOÁT TOÀN DIỆN + XÓA SẠCH DỮ LIỆU MẪU — theo lệnh chủ dự án)

Yêu cầu: mọi con số trên màn hình phải truy được nguồn trong cơ sở dữ liệu, không hiển thị bừa. Kết quả rà soát: DB sạch (22 bảng không có dòng mẫu); vấn đề nằm ở CODE — file dữ liệu mẫu `src/data/mockData.ts` (1.038 dòng) vẫn được 17 file tham chiếu và nhiều màn hình dùng nó làm dự phòng. Đã xử lý toàn bộ:

- **Màn hình học sinh:** Học bài + thẻ video không còn gộp bài tập mẫu vào danh sách thật (số bước/XP tối đa hết bị phồng); màn video bỏ cả dự phòng video mẫu lẫn việc tự thay bằng video khác (không thấy = báo không tìm thấy); màn lý thuyết, thẻ "học tiếp", màn làm bài, màn kết quả, luồng bài tập về nhà (bỏ bài mẫu chết cứng `quiz_homework_special`) — tất cả chỉ dùng dữ liệu thật, thiếu thì hiện trạng thái rỗng/không tồn tại.
- **State học sinh:** state khởi tạo đổi thành state TRỐNG trung tính (mọi số = 0, hồ sơ từ phiên đăng nhập) thay cho state mẫu 310 XP — hết số bịa ở frame đầu; gỡ việc tự gieo state mẫu hs001 trong kho local; gỡ hẳn tính năng "Đặt lại dữ liệu demo" (App + DevPanel).
- **Phân tích giáo viên:** tab hồ sơ học sinh không còn BỊA "đáp án học sinh đã chọn" (hệ thống vốn không lưu lựa chọn — trước đây suy diễn từ đúng/sai + ngân hàng mẫu); nội dung câu hỏi/đáp án đúng tra từ ngân hàng THẬT truyền vào, không thấy thì ghi rõ "Câu hỏi không còn trong ngân hàng"; tab phân tích câu hỏi + hồ sơ không còn mặc định chạy trên ngân hàng mẫu.
- **Kho bài tự luận (máy chủ):** đề bài/mức độ tra thẳng từ bảng `questions` thật thay cho ngân hàng mẫu; bỏ nhãn bịa "Cảm nghĩ về bài thơ…" và tên lớp bịa "7A1" (thay bằng nhãn trung tính / "Không rõ lớp").
- **Xóa hẳn `src/data/mockData.ts`**; danh mục huy hiệu (cấu hình sản phẩm) tách sang `src/data/badges.ts`, danh mục quà vốn ở `src/data/rewards.ts`. Cấu hình cứng còn lại (catalog quà/huy hiệu, cấu hình XP mặc định) là định nghĩa sản phẩm trong code — mọi bản ghi phát sinh (XP, huy hiệu đã mở, yêu cầu quà) đều ở DB.
- **Dữ liệu:** đặt lại state của hs001 về 0 (nền 310 XP đến từ các phiên kiểm chứng của đội phát triển; 9 học sinh còn lại vốn 0 XP). Lịch sử làm bài ở các bảng tiến độ giữ nguyên.

## 2026-10-22 (SỬA LỖI: học sinh lúc hiện đúng người, lúc hiện thành học sinh mẫu khác)

- **Triệu chứng:** cùng tài khoản hs001, có lần trang chủ hiện đúng "Nguyễn Minh An — Lớp 7A4", có lần lại hiện "Nguyễn Minh Anh — Lớp 7A2" với XP nền của dữ liệu mẫu.
- **Nguyên nhân:** khi truy vấn máy chủ gặp lỗi thoáng qua, khâu đăng nhập tự rơi về kho tài khoản MẪU — tài khoản mẫu trùng tên đăng nhập + mật khẩu nên đăng nhập "thành công" nhưng là một người khác hẳn (kèm toàn bộ tiến độ mẫu); phiên mẫu còn được lưu lại và khôi phục ở các lần mở sau, nên danh tính nhấp nháy qua lại.
- **Cách sửa (3 điểm, đều trong kho Supabase):**
  1. Đăng nhập: lỗi truy vấn/ngoại lệ khi máy chủ đã cấu hình → trả lỗi "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại!", KHÔNG còn rơi về tài khoản mẫu ở cả 3 vai trò.
  2. Khôi phục phiên: phiên đã lưu mà id không phải UUID (phiên mẫu) và tên đăng nhập tồn tại trên máy chủ với id thật → hủy phiên, bắt đăng nhập lại; không xác minh được (mất mạng) thì giữ nguyên, tránh đăng xuất oan.
  3. Nạp tiến độ học sinh: nếu danh sách học sinh không chứa tài khoản (bản dự phòng/thiếu), tra thẳng dòng tài khoản theo id kèm tên lớp để tên + lớp luôn là của người thật.

## 2026-10-22 (SỬA LỖI: XP của chủ đề không lưu được)

- **Triệu chứng (kiểm chứng XP phát hiện):** đặt "XP thưởng khi hoàn thành toàn bộ chủ đề" = 50 lúc tạo và sửa lại 2 lần, mở lại vẫn 0.
- **Nguyên nhân:** `saveTopic` tự dựng `video_payload` riêng để upsert và THIẾU trường `xpReward` (trường này chỉ có ở `pushTopicRecord`) — mỗi lần lưu chủ đề là payload bị ghi đè mất XP.
- **Cách sửa:** bổ sung `xpReward: topic.xpReward ?? savedMock.xpReward ?? 0` vào payload của `saveTopic` (mọi đường lưu chủ đề — sửa, gắn bài, đổi luồng — đều giữ nguyên XP đã cấu hình).

## 2026-10-22 (SỬA LỖI: xóa chủ đề không ăn — chủ đề tự hồi sinh)

- **Triệu chứng:** bấm thùng rác + xác nhận xóa chủ đề, hộp thoại đóng nhưng chủ đề vẫn còn sau khi tải lại trang (kiểm chứng trình duyệt bấm tới 7 lần không xóa được).
- **Nguyên nhân:** `deleteTopic` xóa cứng dòng trên Supabase nhưng KHÔNG gỡ chủ đề khỏi bộ đệm payload của trình duyệt; lần nạp sau, `getTopics` coi chủ đề đó là "chỉ có ở máy này" và tự đẩy ngược lên máy chủ (cơ chế chống mất dữ liệu) → chủ đề hồi sinh. Bộ đệm của thiết bị khác cũng gây hồi sinh tương tự. Đây cũng là gốc của việc xóa thẳng trong DB trước đó không hiệu quả.
- **Cách sửa (migration_011):** bảng topics thêm cột `deleted_at` — xóa chủ đề nay là **xóa mềm** (đóng dấu thời gian xóa): `getTopics` loại mọi dòng đã đóng dấu khỏi mọi thiết bị, danh sách "chỉ có ở máy này" cũng bỏ qua các id đã đóng dấu, và `deleteTopic` gỡ ngay chủ đề khỏi bộ đệm payload của máy đang thao tác.

## 2026-10-22 (MÔ HÌNH XP MỚI — theo chủ đề & bài kiểm tra, chủ dự án duyệt)

Đổi toàn bộ mô hình XP theo yêu cầu chủ dự án (kế hoạch: KE-HOACH-XP-THEO-CHU-DE-VA-BAI-KIEM-TRA.md):

- **3 nguồn XP duy nhất:** (1) **Điểm danh ngày** — mức XP giáo viên chỉnh ở Cài đặt (nay điểm danh dùng đúng mức đã cấu hình thay vì hằng số cứng); (2) **Quỹ XP của chủ đề** — giáo viên nhập trong cửa sổ Chỉnh sửa chủ đề (`xpReward`, lưu trong payload chủ đề), học sinh nhận đủ 1 lần khi hoàn thành toàn bộ chủ đề: xem trọn luồng video + xong lý thuyết + **làm đúng hết** phần chấm tự động của mọi bài trong luồng (tự luận không chặn); bộ đánh giá mới `src/logic/topicCompletion.ts` chạy ở App sau mỗi thay đổi tiến độ; (3) **XP của bài kiểm tra/bài được giao** — nộp bài là nhận, không xét đúng sai: bài độc lập dùng cột mới `xp_reward` (migration_010, nhập ngay trong màn soạn AssignmentEditor), bài trong chủ đề dùng ô "Điểm thưởng XP khi hoàn thành" sẵn có của QuizBuilder.
- **Bỏ toàn bộ trần XP:** `xpEngine.awardXP` viết lại — không còn trần ngày theo phút học (130/150), không trần tuần (900), không chặn sau 90 phút; giữ lật ngày/tuần theo giờ địa phương + mỗi khóa XP chỉ trả 1 lần. Trang chủ học sinh và DevPanel bỏ hiển thị trần.
- **Bỏ cộng XP lẻ theo hành động:** luồng Video/Lý thuyết không cộng XP từng bước nữa — các bước chỉ ghi nhận hoàn thành qua `recordStepCompletion` (vẫn phục vụ Cây/Năng lực và điều kiện quỹ chủ đề); chữ "(+N XP)" trên nút chuyển bước và hộp tổng kết cuối luồng đã gỡ.
- **Màn Cài đặt XP rút gọn:** xóa thẻ "Trần giới hạn XP Ngày & Tuần" và "Bảng điểm XP cho từng hành động học tập" — chỉ còn **Điểm danh ngày** + ghi chú nơi đặt XP chủ đề/bài kiểm tra; bỏ luôn validation/cảnh báo trần khi lưu.
- Kiểm chứng: tsc sạch; bộ test logic cập nhật theo mô hình mới 34/34 đạt; test riêng bộ đánh giá hoàn thành chủ đề 4/4 (chưa đúng hết → không trao; đúng hết + có tự luận → trao đủ; trao lần 2 → không; thiếu xem video → chưa hoàn thành).

## 2026-10-22 (cụm nút đầu trang Ngân hàng — theo yêu cầu chủ dự án)

- **Ngân hàng câu hỏi:** 4 nút [Kho ngân hàng] [Bản nháp] [Mầm AI Studio] [+ Thêm câu hỏi thủ công] **gom thành một cụm sát nhau ở góc phải đầu trang** (đúng vị trí nút Thêm câu hỏi trước đây); **xóa hẳn nút cam "Mở Mầm AI Studio"** (trùng chức năng với tab Mầm AI Studio).

## 2026-10-22 (gộp khối đầu trang Ngân hàng câu hỏi)

- **Ngân hàng câu hỏi & Kho học liệu:** tiêu đề trang + 2 nút hành động (Thêm câu hỏi thủ công / Mở Mầm AI Studio) + thanh tab (Kho ngân hàng / Bản nháp / Mầm AI Studio) **gộp vào MỘT khối đầu trang duy nhất** (trước: tiêu đề một nơi, tab một nơi) — cùng đợt đồng bộ với màn Chấm bài.
## 2026-10-22 (đợt sửa theo kiểm chứng luồng học + đồng bộ màn Chấm bài)

- **Bổ sung XUẤT BẢN CHỦ ĐỀ:** trang chi tiết chủ đề có nút "Cập nhật lên web học sinh" mở PublishModal dùng chung (nhánh topic trong `handleOpenPublishModalForCurrent`). Trước đây cơ chế xuất bản chỉ có cho Video/Lý thuyết/Bài tập — chủ đề mới tạo kẹt ở Bản nháp vĩnh viễn, học sinh không thấy (phát hiện khi kiểm chứng luồng học bước 5–6).
- **Siết lớp lưu trữ — hết "bài tự biến mất":** kiểm chứng phát hiện video tạo trong chủ đề mới hiện trong cây/dải rồi biến mất: `saveVideoLesson` lưu cục bộ rồi đẩy Supabase, đẩy hỏng vẫn trả về thành công (chỉ log khi thành công) nên chủ đề ghi tham chiếu treo còn dòng video không hề lên máy chủ. Nay `saveVideoLesson / saveTheoryLesson / saveQuiz` dùng `pushOrThrow`: đẩy hỏng → thử lại 1 lần sau 700ms → vẫn hỏng thì **ném lỗi** để tầng tạo bài dừng lại và báo giáo viên, thay vì im lặng.
- **Màn Chấm bài — gộp đầu trang + đồng bộ theme** (theo yêu cầu chủ dự án): 2 thẻ thống kê lớn (Cần chấm / Chờ > 24 giờ) và thanh tìm kiếm–bộ lọc riêng được **gộp thành một dải gọn duy nhất** trên cùng (thống kê dạng pill, giữ nguyên mọi thao tác lọc khi bấm), bảng hàng đợi được đẩy lên cao; **đầu bảng đổi từ cam #F59E0B chói sang navy #2F3E6B** đồng bộ giao diện chung.
- Ghi nhận vận hành: lần dọn chủ đề thử "CHỦ ĐỀ THỬ LUỒNG — XÓA SAU TEST" — xóa thẳng trong DB bị app **hồi sinh** từ bộ đệm trình duyệt (cơ chế tự đồng bộ local→Supabase); phải xóa qua giao diện mới sạch (xem mục sơ đồ).

## 2026-10-22 (tách mục) — Cây tách 2 tab riêng: Chủ đề / Bài tập & đánh giá

- Theo phản hồi của chủ dự án (hai loại chung một danh sách "khó nhìn, khó kiểm soát"): cột cây nay có **công tắc 2 tab** ở đầu — tab **Chủ đề** chỉ hiện cây chủ đề, tab **Bài tập & đánh giá** thay đúng vị trí đó bằng danh sách bài kiểm tra; mỗi tab có số đếm riêng và **nút Thêm của riêng tab đó**. Chọn một bài tập (vừa tạo mới hoặc bấm thẻ) thì cột tự chuyển sang tab Bài tập & đánh giá và ngược lại.

- (Bổ sung cùng đợt, theo làm rõ của chủ dự án) **3 thẻ chọn loại nội dung** trong panel (Bộ câu hỏi / Ý trọng tâm video / Lý thuyết chi tiết) cũng đã **fix cứng kích thước**: trước đây thẻ đang chọn được bôi đậm làm chữ phình ra — "Ý trọng tâm video" bị rớt chữ "video" xuống dòng và thẻ đổi chiều cao theo trạng thái chọn. Nay cả 3 thẻ cố định chiều cao 68px, chữ luôn đậm như nhau + không xuống dòng (thu hẹp khoảng cách lưới và đệm thẻ để chữ nằm gọn một hàng); chọn thẻ nào chỉ viền/nền đổi, cỡ thẻ không đổi nữa.

## 2026-10-22 (đợt BÀI TẬP & ĐÁNH GIÁ NGANG HÀNG CHỦ ĐỀ) — mục riêng trong cây + màn soạn bài kiểm tra

Theo yêu cầu chủ dự án: "Thêm bài tập & đánh giá" phải ngang vai trò với "Thêm chủ đề"; mỗi bài là một mục riêng như một bài kiểm tra có nhiều câu hỏi.

- **Cây chủ đề (TopicTreeSidebar):** hai nút "Thêm chủ đề" và "Thêm bài tập & đánh giá" nay đứng cùng một hàng ở đầu cây, cùng kích cỡ. Danh sách cây hiện thêm **thẻ mục riêng cho từng bài tập & đánh giá** (màu hổ phách, dưới các chủ đề): tiêu đề, nhãn Bản nháp/Đã giao, số câu hỏi · số học sinh · đã nộp; bấm thẻ mở màn soạn, nút thùng rác xóa qua hộp thoại xác nhận.
- **Tạo mục như tạo chủ đề:** bấm "Thêm bài tập & đánh giá" → tạo ngay bản nháp "Bài kiểm tra mới" trong DB rồi chọn luôn mục đó (không còn form bật lên làm-một-lần; `AssignmentBuilderModal` đã gỡ bỏ).
- **Màn soạn mới `AssignmentEditor`** (khung phải): tiêu đề, trạng thái, cài đặt (hạn nộp, giới hạn thời gian), chọn lớp + tích từng học sinh (mặc định cả lớp), **đề gồm** (thêm/bớt/đổi thứ tự câu), ngân hàng câu hỏi có tìm kiếm + cảnh báo câu trắc nghiệm chưa có nội dung đáp án. "Lưu nháp" = học sinh chưa thấy; "Giao bài" = chốt giao cho học sinh đã chọn.
- **Dữ liệu (biRepository):** thêm `getTeacherAssignments / createEmptyAssignment / getAssignmentForEdit / updateAssignment / deleteAssignmentCompletely`. Đồng bộ đối tượng khi cập nhật: thêm học sinh mới, gỡ học sinh bị bỏ chọn **chỉ khi em chưa có lượt làm**. Khóa an toàn phía học sinh: `getStudentAssignments` chỉ trả bài **có published_at** (nháp không lộ dù đã chọn sẵn đối tượng), và màn "Tiến độ bài làm" chỉ tính bài đã giao.

## 2026-10-22 (hotfix) — Panel Mầm AI hết nhảy lên/xuống khi đổi loại nội dung

- Nguyên nhân: trong panel phải (Xưởng tạo đầu ra) của `AiContentStudioModal`, chỉ loại "Bộ câu hỏi" có khối cấu hình cao ~330px; đổi sang "Ý trọng tâm video"/"Lý thuyết chi tiết" là khối biến mất → chiều cao panel sụt → vị trí cuộn bị kẹp lại → toàn bộ nội dung nhảy lên/xuống mỗi lần bấm đổi loại.
- Sửa: vùng cấu hình theo loại có **chiều cao cố định** (min-h 332px; hai loại không có cấu hình hiện khung ghi chú giữ chỗ), và panel **neo cuộn về đầu** mỗi khi đổi loại. Nút "Tạo bản nháp với Mầm AI" từ nay đứng yên một vị trí ở cả 3 loại.

## 2026-10-22 (đợt bố cục 3) — Bỏ nút Tạo mới đầu trang, menu theo theme gọn, bài mới chèn ngay sau bài đang mở

- **Bỏ nút "+ Tạo mới" ở góc trên trang Nội dung học** (yêu cầu chủ dự án): tạo bài chỉ còn ở 3 vị trí có ngữ cảnh — dòng "+ Tạo mới" cuối cây, "Thêm vào chủ đề" ở chi tiết chủ đề, "+ Thêm bài" trên dải luồng.
- **Menu "Thêm vào chủ đề" sửa theo theme gọn** (lấy menu 3 dòng của dải luồng làm gốc): mỗi loại một dòng icon + tên, bấm dòng = tạo thủ công, icon ✦ ở cuối dòng = Tạo với AI; bỏ hẳn kiểu hai cấp "• Tạo thủ công / Tạo với AI (sắp có)" lồng bên dưới.
- **Quy tắc vị trí mới khi tạo bài** (`logic/flowOrder.ts` thêm `insertFlowKeyAfter`, `TeacherContentScreen.placeInFlowOrder`): bài mới tạo được **chèn NGAY SAU bài đang mở** trong luồng của chủ đề (đang ở vị trí 1 tạo mới → bài mới ở vị trí 2), áp cho mọi đường tạo: menu cây / chi tiết chủ đề / dải luồng / nút "+ Tạo mới" tạo bài liên kết trong trình soạn Video & Lý thuyết (bài liên kết trước đây chỉ hiện ở cuối nhờ thứ tự suy ra tạm). Không mở bài nào → vào cuối luồng như cũ.

## 2026-10-22 (hotfix bố cục 2) — Menu Thêm bài phủ lên trên + thống nhất chữ "Tạo mới"

- **Sửa lỗi menu "+ Thêm bài" bị cắt mất:** nút thêm trước đây nằm bên trong vùng cuộn ngang của thanh luồng nên menu xổ xuống bị vùng cuộn nuốt mất; đã đưa nút ra ngoài vùng cuộn — menu giờ xổ xuống **phủ lên trên** trình soạn bên dưới (z-50), bấm ra ngoài để đóng.
- **Thống nhất cách gọi:** 5 link "+ Tạo mới ngay" ở phần bài liên kết của trình soạn Video (3 mục: Bài luyện tập / Kiểm tra 1 / Kiểm tra 2) và Lý thuyết (2 mục) đổi thành "+ Tạo mới" cho đồng nhất với các nút Tạo mới khác trong trang.

## 2026-10-22 (ngay sau đợt Luồng học) — Gọn bố cục dải luồng học

- `TopicFlowStrip` viết lại phần hiển thị theo phản hồi của chủ dự án ("bố cục khó chịu"): từ một thẻ cao ~110px (nút tròn + tên bài 2 dòng bên dưới + sợi nối kéo dài hết chiều ngang khi ít bài) thành **một thanh mỏng ~52px**: nút tròn 32px, tên bài + loại bài nằm ngang bên cạnh, các bài xếp sát nhau bên trái (nối bằng đoạn gạch ngắn cố định, cuộn ngang khi dài), bỏ dòng chữ hướng dẫn dài (chỉ còn trong tooltip), nhãn "Luồng học · tên chủ đề" thu thành một cột nhỏ bên trái. Chức năng giữ nguyên: bấm để tới bài, kéo–thả đổi thứ tự, chấm trạng thái, nút "+ Thêm bài".

## 2026-10-22 — Luồng học trong chủ đề: bỏ video nháp tự sinh, Tạo mới 3 mục, dải nút tròn, học sinh học theo thứ tự

Theo kế hoạch đã duyệt (kèm ảnh chụp của chủ dự án):
- **Bỏ tự sinh video nháp khi tạo chủ đề**: tạo chủ đề mới chỉ chọn chủ đề đó, chủ đề TRỐNG. Hai video nháp ma "Bài giảng Video mới" trong chủ đề "Văn 7" đã xóa khỏi DB (kèm dọn videoIds).
- **Menu Tạo mới hợp nhất đúng 3 mục** (Bài giảng Video / Lý thuyết / Bài tập) ở mọi vị trí: dropdown góc trên trang Nội dung học (trước có 5), menu "Thêm vào chủ đề", dòng **"+ Tạo mới"** luôn ở cuối danh sách bài của mỗi chủ đề trong cây, và nút + cuối dải luồng. Loại bài tập cụ thể (Luyện tập/Kiểm tra nhanh/Mastery/BTVN…) chọn trong Cài đặt bài.
- **Thứ tự luồng học `flowOrder`** lưu trên bản ghi chủ đề (`video_payload.flowOrder`, khóa `video:<id>/theory:<id>/quiz:<id>`; helper `src/logic/flowOrder.ts` — chủ đề cũ suy ra tạm video → lý thuyết → bài tập). **Dải luồng học** (`TopicFlowStrip`) ở đầu khung phải: nút tròn icon theo loại nối gạch ngang, bấm để tới bài, **kéo–thả đổi thứ tự lưu ngay**, nút đang mở tô đậm, chấm trạng thái nháp/đã xuất bản. Cây chủ đề cũng hiển thị các bài **hợp nhất theo đúng thứ tự luồng**.
- **Học sinh**: màn Học bài thêm tab **"Luồng học"** (mặc định) — bài trong chủ đề hiện theo đúng flowOrder (số thứ tự + icon loại), bấm mở đúng bài kể cả Bài tập; 2 tab cũ giữ nguyên.
- **QuizBuilder**: tạo Bài tập mới mở thẳng tab **Cài đặt bài** trước, có nút "Tiếp tục: Soạn câu hỏi →"; mở bài cũ giữ nguyên.

## 2026-10-21 (đêm muộn) — Bài tập độc lập DÙNG THẬT: tạo bài, giao bài, làm bài, tự chấm

- Mục mới **"Thêm bài tập & đánh giá"** ngay dưới đầu Cây chủ đề (màn Nội dung học) mở `AssignmentBuilderModal`: đặt tên bài, chọn câu hỏi từ Ngân hàng câu hỏi (cảnh báo tại chỗ nếu câu trắc nghiệm chưa có văn bản lựa chọn), chọn lớp + bỏ chọn từng học sinh, đặt hạn nộp và giới hạn thời gian. Lưu ghi vào `assignments` + `assignment_questions` + `assignment_targets` (`biRepository.createAssignment`).
- Học sinh: mục **Bài tập được giao** ở trang chủ bấm được → `AssignmentAttemptScreen` làm bài thật (chọn đáp án/điền khuyết/viết tự luận, đếm ngược và tự nộp khi hết giờ nếu bài có giới hạn). Nộp bài (`submitAssignmentAttempt`) ghi `attempts` + `attempt_answers`: câu có đáp án đúng **tự chấm ngay**, câu tự luận sinh phiếu `answer_reviews` PENDING chảy vào hàng chờ chấm của màn Tiến độ bài làm; trạng thái nộp của học sinh cập nhật ngay.
- Chuẩn hóa loại câu hai hệ tên: app dùng `single/multi/fill/essay`, DB/payload dùng `single_choice/multiple_choice/fill_in_blank/essay` — `normalizeQType` quy về một hệ ở cả bước lấy đề (không lộ đáp án) lẫn bước chấm.
- Kiểm chứng trên production theo vòng khép kín tự dọn dẹp: tạo bài thử giao riêng hs001 (1 câu tự chấm + 1 câu tự luận), hs001 làm và nộp, đối chiếu điểm + phiếu chờ phía gv001, sau đó xóa bài thử khỏi DB (cascade) để dữ liệu giả lập giữ nguyên trạng.

## 2026-10-21 (đêm) — Xóa sạch DB + nạp dữ liệu giả lập Power BI + màn Tiến độ bài làm (GĐ2–GĐ5)

- GĐ2: sao lưu toàn bộ 12 bảng ra ngoài repo (`~/workspace/mamvan-backups/2026-10-21_pre-wipe/`), chạy file gộp migration 003+004+005 (RLS đủ 12 bảng + cột `questions.payload`), TRUNCATE sạch 12 bảng, dựng lại Admin (migration_006) + giáo viên chủ dữ liệu **gv001**.
- GĐ3: `database/migration_008_bi_mock_model.sql` — thêm 10 bảng (learning_activities, activity_questions, assignments, assignment_questions, assignment_targets, attempts có CHECK XOR nguồn, attempt_answers, answer_reviews, student_sessions, dim_date) + cột `questions.max_score / grading_method / difficulty` và `topics.subject / grade`. Loại câu hỏi giữ đúng 4 dạng của hệ thống — SHORT_ANSWER trong file Excel gộp vào essay.
- GĐ4: `scripts/import_bi_mock_v3.py` nạp trọn file `MamVan_DuLieu_GiaLap_10HocSinh_v3-2.xlsx`: lớp 7A4, 10 học sinh (hs001–hs010, mật khẩu mặc định), 2 chủ đề, 16 hoạt động, 10 câu hỏi, 30 nối hoạt động–câu hỏi, 3 bài độc lập + 11 câu + 30 lượt giao, 54 lượt làm, 223 câu trả lời, 44 phiếu chấm, 32 phiên đăng nhập, 61 dòng dim_date. **Đáp án đúng được suy ra từ chính dữ liệu file** (mỗi câu AUTO có đúng 1 đáp án được chấm đúng) và tích sẵn vào `correct_answer`: q01 A, q02 A, q03 [A,B], q04 "so sánh", q07 A, q08 A. Kiểm chứng độc lập (chế độ `--verify`): ĐẠT TOÀN BỘ — mọi count khớp file, attempts XOR 28/26/0, câu chờ chấm 39 = phiếu chờ 39, targets 24 đã nộp/6 chưa, đối soát điểm từng attempt 0 lệch, last_active_at khớp phiên gần nhất. (Neo ngày đúng của dữ liệu: phiên đăng nhập kết thúc 21/10/2026 — cửa sổ 7 ngày cuối là 15–21/10 = 7 em, kỳ trước 08–14/10 = 6 em.)
- GĐ5: lớp dữ liệu `src/services/supabase/biRepository.ts` (đọc các bảng mới, mọi truy vấn chặn theo phạm vi học sinh của giáo viên) + màn giáo viên mới **Tiến độ bài làm** (mục menu riêng): KPI đăng nhập 7 ngày so kỳ trước, biểu đồ phiên 14 ngày + bảng phiên gần đây, tiến độ nộp bài độc lập theo từng học sinh, **hàng chờ chấm chấm được ngay tại màn** (ghi phiếu chấm + cập nhật điểm câu và tổng lượt làm), danh sách lượt làm bài mở xem từng câu (đáp án đã chọn, đúng/sai, điểm, thời gian làm), cây luồng học theo chủ đề. Trang chủ học sinh thêm mục **Bài tập được giao** (trạng thái nộp, hạn, điểm cao nhất).
- Ghi chú dữ kiện: file Excel không có văn bản các lựa chọn A–D của câu trắc nghiệm và không có thân nội dung video/bài giảng — phần đó chờ file bổ sung riêng; đáp án đúng đã có sẵn nên khi bổ sung lựa chọn là làm bài/chấm tự động được ngay.

## 2026-10-21 (tối) — Tách dữ liệu RIÊNG theo giáo viên (GĐ1) + migration_007

- Khắc phục lỗi các tài khoản giáo viên thấy/dùng chung dữ liệu của nhau. Đã chạy `database/migration_007_teacher_isolation.sql` vào DB: thêm cột `teacher_id` cho `video_lessons`, `theory_lessons`, `quizzes`, `questions` (+ index); nội dung cũ chưa có chủ được gán về giáo viên chính gv004 — kiểm chứng 0 dòng còn thiếu chủ ở cả 5 bảng nội dung.
- `payloadStore.ts`: thêm cơ chế xác định chủ sở hữu theo phiên đăng nhập (giáo viên = chính mình; học sinh = giáo viên chủ nhiệm lớp của em; Admin = không có nội dung riêng); đồng bộ payload chỉ đọc/ghi nội dung của đúng chủ; item local mang dấu chủ của người khác hoặc vô chủ bị bỏ qua hoàn toàn; khi đẩy lên tự đóng dấu `teacher_id`.
- `supabaseRepositories.ts`: `getTopics` lọc theo chủ + ánh xạ `teacher_id`; `saveTopic`/`pushTopicRecord` ghi `teacher_id`; `getQuestions` chỉ lấy câu của giáo viên (trực tiếp hoặc qua chủ đề của mình), bỏ gộp 22 câu mẫu dùng chung ở chế độ Supabase, lỗi truy vấn chỉ còn fallback về câu local của chính giáo viên; `saveQuestion` đóng dấu chủ ở cả local lẫn cột DB; `getSubmissions` mặc định chặn trong các lớp của giáo viên (kể cả nơi gọi không truyền lọc); `getAllStates` chỉ đọc state học sinh thuộc lớp của mình; đăng xuất dọn toàn bộ cache nội dung/dữ liệu học tập + khóa cài đặt theo tài khoản.
- `mockRepositories.ts`: đăng xuất dọn cache tương tự; cài đặt hệ thống gắn riêng theo từng giáo viên (khóa lưu trữ có hậu tố id giáo viên, chưa có bản riêng thì kế thừa mặc định).
- Kiểm tra: `tsc` sạch, test logic 35/35, build OK. Kiểm chứng A/B bằng 2 tài khoản giáo viên trên production thực hiện ngay sau deploy đợt này (cổng bắt buộc trước Giai đoạn 2 — xóa sạch DB — của kế hoạch nạp dữ liệu giả lập).

# Nhật ký thay đổi (Changelog) - Dự án Mầm Văn 7

## [2026-10-21] - Bảo mật: Admin thành tài khoản THẬT trong database — gỡ đăng nhập ghi cứng khỏi mã nguồn
- Trước đây đăng nhập Admin là thông tin ghi cứng ngay trong mã nguồn ở cả 2 đường (`supabaseRepositories.ts` và `mockRepositories.ts`): nhập đúng tên đăng nhập + mật khẩu viết sẵn trong code là app tự tạo phiên Admin, không hề tra cứu database — mà repo đang công khai nên ai cũng đọc được.
- Nay Admin là một tài khoản thật trong bảng `teachers` với `role = 'admin'` (bảng này vốn đã thiết kế `role IN ('teacher','admin')`), tạo bằng `database/migration_006_admin_account.sql` — chủ dự án tự đặt mật khẩu Admin trong file trước khi chạy ở Supabase SQL Editor. Cả 2 đường đăng nhập đều tra cứu tài khoản thật như giáo viên: sai tên → báo không tồn tại, bị khóa → báo khóa, sai mật khẩu → báo sai mật khẩu; bí danh đăng nhập cũ bị bỏ hẳn.
- Siết thêm cùng đợt: cổng Giáo viên nay chỉ nhận tài khoản `role = 'teacher'`, nên tài khoản Admin không dùng qua cổng Giáo viên được; type `TeacherProfile.role` nới thành `'teacher' | 'admin'` cho khớp schema DB.
- Kiểm chứng: tsc sạch, test logic 35/35, build thành công và bundle không còn dấu vết bí danh cũ.
- Thứ tự lên sóng: code đã lên nhánh dev; bản production chỉ deploy SAU KHI migration_006 được chạy trong Supabase (tránh khóa đường vào Admin trong lúc chuyển đổi).
- Hoàn tất tối 21/10: theo chỉ định của chủ dự án, migration_006 đã được chạy thẳng vào database (mật khẩu Admin giữ nguyên như mật khẩu cũ theo quyết định của chủ dự án) và bản mới đã deploy production. Kiểm chứng trực tiếp trên production đạt cả 3 ca: đăng nhập `admin` vào được Cổng Admin; bí danh cũ bị từ chối với thông báo "Tài khoản Quản trị viên không tồn tại trên hệ thống"; sai mật khẩu bị từ chối với thông báo "Mật khẩu Quản trị viên chưa chính xác".

## [2026-10-21] - Bảo mật: bổ sung header bảo mật cho bản production + gỡ email hardcode
- Theo kết quả rà soát bảo mật (audit) ngày 21/10: trước đây trang chưa có header bảo mật nào, Vercel phát mặc định `Access-Control-Allow-Origin: *` và lộ banner `Server: Vercel`.
- Nay `vercel.json` bổ sung cho mọi đường dẫn: Content-Security-Policy (chỉ cho phép script từ chính trang; kết nối giới hạn ở Supabase, Gemini API, r.jina.ai, noembed; cấm nhúng trang vào iframe của trang khác qua `frame-ancestors 'self'`), X-Frame-Options: SAMEORIGIN (chống clickjacking), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (khóa camera/micro/định vị/thanh toán), Strict-Transport-Security (ép HTTPS 2 năm), và Access-Control-Allow-Origin thu hẹp về đúng `https://mamvan.vercel.app`.
- Gỡ email thật hardcode `nguyenvanan.van7@mamvan.edu.vn` khỏi bundle: trước đây email này là giá trị dự phòng hiển thị ở menu tài khoản giáo viên khi hồ sơ chưa có email; nay hiển thị "Chưa cập nhật email".
- Việc còn treo ngoài đợt này: logic XP/điểm danh vẫn tính ở client (mục Info của audit) — muốn bịt hẳn phải khóa quyền ghi ở tầng cơ sở dữ liệu (RLS + các migration 003/004/005 đang chờ chủ dự án chạy trong Supabase), không thuộc phạm vi sửa cấu hình lần này.

## [2026-10-21] - Ngân hàng câu hỏi: bỏ thanh trạng thái Mầm AI
- Theo yêu cầu của chủ dự án: gỡ hẳn thanh "Mầm AI đang kích hoạt (AI-2.5-flash)" + nút Cấu hình khỏi đầu màn Ngân hàng câu hỏi, kèm modal nhập API Key riêng của thanh này (không còn nơi nào mở nữa).
- Cấu hình API Key / model Gemini vẫn còn nguyên ở tab Cài đặt và ngay trong Mầm AI Studio (mở bằng nút "Mở Mầm AI Studio" trên cùng màn hình) — không mất chức năng nào.
- Sơ đồ hệ thống đã cập nhật tương ứng: bỏ mục "Thanh trạng thái Mầm AI thu gọn 1 dòng" khỏi nhánh 1.4 (còn 262 mục).

## [2026-10-21] - Mầm AI Studio: xóa nguồn "Cây dừa" là xóa hẳn, không tự mọc lại khi tải lại trang
- Bài thơ "Cây dừa" (Trần Đăng Khoa) là nguồn mẫu mặc định viết sẵn trong xưởng AI để giáo viên có sẵn tài liệu thử nghiệm. Trước đây: xóa hết nguồn rồi tải lại trang thì bài thơ tự xuất hiện lại — vì code đọc localStorage coi danh sách rỗng như "chưa từng có dữ liệu" nên nạp lại bài mẫu.
- Nay phân biệt rõ: đã có dữ liệu lưu (kể cả danh sách rỗng do GV chủ động xóa hết) thì tôn trọng trạng thái đó; chỉ nạp bài mẫu ở lần mở xưởng đầu tiên khi chưa từng có dữ liệu. Muốn lấy lại bài mẫu thì bấm nút "Khôi phục bài thơ Cây dừa" ở trạng thái trống.

## [2026-10-20] - Màn Nội dung học: khung cây chủ đề đứng yên, hai khung cuộn độc lập
- Theo yêu cầu của chủ dự án: khung "Cây chủ đề" nay đứng yên tại chỗ, danh sách chủ đề tự cuộn bên trong khung; khung trình soạn bên phải cuộn riêng phần thân, thanh công cụ (Quay lại / Xem trước / Lưu nháp / Cập nhật lên web học sinh) dính chặt ở phía trên — cuộn khung này không kéo theo khung kia và cả trang không còn cuộn theo.
- Áp dụng cho cả 3 trình soạn: Video, Lý thuyết và Trình tạo bài tập. Riêng tab Nội dung học dùng khung chiều cao cố định theo màn hình; các tab khác giữ nguyên cách cuộn trang như cũ.
- Trên điện thoại: cây chủ đề thu gọn tối đa 45% chiều cao, phần soạn thảo cuộn độc lập bên dưới.

## [2026-10-18] - Mục Bản nháp ở Ngân hàng câu hỏi
- Thêm tab "Bản nháp" (có huy hiệu đếm số mục chờ) ở màn Ngân hàng câu hỏi: mọi bộ câu hỏi và lý thuyết Mầm AI tạo ra mà chưa duyệt đều nằm tại đây.
- Mỗi bộ câu hỏi nháp mở ra xem từng câu, tích chọn những câu đã duyệt rồi "Đưa vào Ngân hàng"; câu chưa chọn ở lại nháp. Có nút mở sang Studio để duyệt ở màn hình duyệt đầy đủ, và xóa nháp (hỏi xác nhận). Lý thuyết nháp cũng duyệt qua Studio từ mục này.
- Nguyên tắc xuyên suốt: chưa duyệt thì chưa vào Ngân hàng.

## [2026-10-18] - Chấm bài: hết trùng học sinh + bảng theo mẫu thiết kế
- Sửa lỗi một học sinh hiện 2 dòng trong hàng đợi chấm: cùng một em mang nhiều định danh khác nhau giữa các nguồn dữ liệu local nên bị tính thành 2 người, và cùng một bài có thể có bản sao. Nay mọi bài được quy về đúng một học sinh trong danh sách thật (khớp theo tên + lớp khi lệch định danh) và khử trùng bài theo nội dung trước khi hiển thị — mỗi học sinh chỉ còn 1 dòng duy nhất.
- Bảng hàng đợi làm lại theo mẫu: đầu bảng cam, cột Học sinh | Lớp | Chủ đề đã làm (x/y) | Bài chờ chấm (0 thì làm mờ) | Chờ lâu nhất (đỏ khi quá hẹn) | Xem chi tiết.
- Màn chi tiết học sinh: gom bài theo CHỦ ĐỀ (dòng nhóm "Thơ - bài chờ chấm: 2" / "- (Hoàn thành)"), thanh tổng kết tính "chủ đề đã làm"; mốc quá hẹn thống nhất là chờ trên 24 giờ (đúng mẫu: 24h chưa tính quá hẹn, 40h thì có) và chữ trong bảng là "(quá hẹn)".

## [2026-10-18] - Mầm AI Studio: bản nháp bền + duyệt lý thuyết trước khi lưu
- Bộ câu hỏi AI tạo xong nay là BẢN NHÁP được tự lưu lại: đóng xưởng, chuyển màn hình hay tải lại trang rồi quay lại vẫn còn nguyên để duyệt tiếp; trên xưởng có thanh "BẢN NHÁP" báo số câu + giờ lưu nháp, bấm vào là duyệt tiếp.
- Lưu vào Ngân hàng chỉ lưu những câu đã tích chọn; các câu chưa chọn ở lại bản nháp chờ duyệt sau — không còn cảnh chưa duyệt vội là mất. Có nút xóa bản nháp (hỏi xác nhận).
- Lý thuyết AI tạo xong không áp dụng ngay nữa: mở màn DUYỆT LÝ THUYẾT xem trước toàn bộ nội dung đúng dạng học sinh sẽ đọc, ưng ý mới bấm "Lưu lý thuyết vào học liệu". Bản nháp lý thuyết cũng được tự lưu như bộ câu hỏi.
- Bỏ chữ "Thật" khỏi các nhãn trong xưởng: nút tạo nay là "Tạo bản nháp với Mầm AI", trạng thái "Mầm AI (AI-2.5-flash)".

## [2026-10-18] - Khối chủ đề ở Kết quả học tập: bỏ chấm màu, nhuộm màu như phía giáo viên
- Bỏ chấm tròn màu trước tên chủ đề trong mục "Điểm theo từng chủ đề".
- Khối của mỗi chủ đề nhuộm nền + viền theo đúng màu chủ đề đó, giống cách hiển thị ở phía giáo viên.

## [2026-10-18] - Thẻ thống kê thanh bên học sinh hiện Tổng XP tích lũy
- Thẻ dưới chân thanh điều hướng học sinh trước đây hiện "XP hôm nay" làm số chính. Nay số chính là "Tổng XP tích lũy" của tài khoản; XP hôm nay chuyển xuống dòng nhỏ bên dưới.

## [2026-10-18] - Bỏ 2 thẻ tổng quan ở Kết quả học tập
- Bỏ thẻ "Câu hỏi đã làm" và thẻ "Điểm trung bình" khỏi hàng tổng quan đầu màn Kết quả học tập; còn lại thẻ "Tổng XP tích lũy" và "Huy hiệu đạt được" dàn đều 2 cột.

## [2026-10-18] - Làm lại biểu đồ tiến bộ của học sinh theo kiểu đường mốc tuần
- Biểu đồ cũ (cột + đường, 2 trục tung) khó đọc: cột màu be nhạt gần như tàng hình, nhãn tuần kiểu "-5 tuần", tuần không làm bài trống trơn và điểm trung bình chỉ còn một chấm lơ lửng — nhìn như hỏng.
- Nay là đường tiến bộ nối 6 mốc tuần: mỗi mốc là vòng tròn chứa điểm trung bình của tuần; tuần này to nhất, viền cam nổi bật; tuần chưa học hiện mốc xám ghi "Chưa học" thay vì biến mất; dưới mỗi mốc có nhãn tuần dễ hiểu ("Tuần trước", "2 tuần trước"...) và số câu đã làm; góc phải thẻ có tổng số câu và điểm tuần này.

## [2026-10-18] - Sửa lỗi không nộp được bài (có câu điền khuyết)
- Nguyên nhân: đáp án câu điền khuyết trong database có thể là một chuỗi đơn (vd "Hà Nội") trong khi code chấm bài luôn coi đáp án là danh sách — lúc bấm nộp, việc chấm văng lỗi ngay giữa chừng: hộp thoại đóng, không thông báo, không thoát, nút nộp khoá cứng, bài không tới tay giáo viên. Mọi bài có câu điền khuyết kiểu này (BTVN, bài trong video/lý thuyết) đều dính.
- Chuẩn hoá đáp án về đúng dạng danh sách ngay tại tầng đọc dữ liệu cho câu điền khuyết và chọn nhiều.
- Màn hình làm bài cũng tự chịu được đáp án dạng chuỗi ở cả bước chấm khi nộp lẫn bước kiểm tra tức thời.
- Bọc toàn bộ xử lý nộp bài: nếu có lỗi lạ phát sinh, học sinh được báo lỗi rõ ràng và nút nộp mở lại để nộp lại — không còn chết im lặng.

## [2026-10-18] - Thông báo bài mới cho học sinh
- Khi thầy/cô xuất bản (hoặc xuất bản lại) video / lý thuyết / bài tập cho lớp, học sinh nhận thông báo kiểu tin nhắn: chuông thông báo trên thanh điều hướng (cả máy tính và điện thoại) có huy hiệu đỏ đếm số chưa đọc; mở ra thấy danh sách bài mới kèm chủ đề và thời gian; bấm vào là vào làm bài đó ngay.
- Trang chủ học sinh hiện biểu ngữ bài mới nhất chưa đọc với nút "Vào làm ngay".
- Thông báo được suy ra từ mốc xuất bản của chính nội dung (trong vòng 14 ngày, đúng lớp được giao); trạng thái đã đọc lưu theo tài khoản học sinh nên đồng bộ mọi thiết bị — thay cho cơ chế cũ chỉ lưu trong trình duyệt của máy thầy/cô, học sinh ở máy khác không bao giờ nhận được.

## [2026-10-18] - Thẻ chủ đề ở trang chủ học sinh cao đều nhau
- Thẻ chủ đề nào tên dài xuống 2 dòng hoặc có mô tả thì cao hơn thẻ khác, chân thẻ ("X bài giảng · Vào học") lệch hàng. Nay tiêu đề và mô tả giữ sẵn chiều cao cố định 2 dòng (thiếu mô tả vẫn giữ chỗ), chân thẻ ghim xuống đáy — mọi thẻ cao bằng nhau, thẳng hàng.

## [2026-10-18] - Cỡ chữ hiển thị phóng lớn thật sự
- Tùy chọn Cỡ chữ (Chuẩn / Lớn 112% / Rất lớn 125%) trước đây chỉ đổi cỡ chữ gốc của trang — phần lớn chữ trong giao diện dùng cỡ px cố định nên chọn "Lớn" mà chữ không hề lớn lên.
- Nay chuyển sang phóng toàn cục theo đúng tỉ lệ đã ghi (112% / 125%): mọi chữ và thành phần giao diện đều phóng theo, áp dụng ngay khi chọn.

## [2026-10-18] - Gọn thanh công cụ hàng đợi chấm bài
- Hai ô "Trạng thái" và "Sắp xếp" gộp thành 1 ô duy nhất (hai nhóm lựa chọn: Trạng thái / Sắp xếp); bỏ lựa chọn "Nộp trước nhất".
- Bỏ nút "Chấm bài kế tiếp" trên thanh công cụ.

## [2026-10-18] - Khu vực chấm bài theo đúng mẫu Figma (chi tiết học sinh + thẻ thống kê hàng đợi)
- Trang "Xem chi tiết" học sinh dựng lại theo mẫu: thẻ tên "Họ tên · Lớp", thanh tổng kết đậm (x/y bài kiểm tra đã làm, số bài chờ chấm, số bài quá hạn, ĐTB, công tắc "Chỉ hiện bài chưa chấm"), bảng đầu cam gom theo bài kiểm tra với dòng nhóm "… - bài chờ chấm: N" / "… - (Hoàn thành)", cột Điểm hiện "Gợi ý Xđ" cho bài AI đã gợi ý.
- Hàng đợi chấm bài: 4 thẻ thống kê gom thành 2 thẻ theo mẫu — "Cần chấm" (gộp chờ chấm + đã có gợi ý AI, kèm nút lọc riêng gợi ý AI bên trong) và "Chờ > 24 giờ" màu đỏ nổi bật nhất (bấm vào là sắp xếp bài chờ lâu nhất lên đầu).
- Màn chấm bài: chỉnh 2 câu chữ theo mẫu Giao diện 3 ("Gợi ý chấm tự động bởi AI", "Tiêu chí đánh giá & Chấm điểm") — bố cục vốn đã khớp mẫu.

## [2026-10-18] - Hàng đợi chấm bài gom theo học sinh
- Trước đây mỗi bài nộp là một dòng riêng — một học sinh nộp 4 bài chiếm 4 dòng trùng tên. Nay hàng đợi gom theo học sinh: mỗi em đúng 1 dòng tổng hợp (tổng số bài đã nộp, bao nhiêu bài chờ chấm / có gợi ý AI / đã chốt, tổng số từ, lần nộp gần nhất, thời gian chờ lâu nhất).
- Bấm "Xem chi tiết" (hoặc bấm vào dòng) mở trang chi tiết của học sinh với danh sách từng bài; "Chấm ngay" mở thẳng bài chờ lâu nhất chưa chấm của em.
- Nhãn "Mô hình Gemini AI" trong Cài đặt đổi thành "Mô hình Mầm AI" cho đồng bộ thương hiệu.

## [2026-10-18] - Đậm màu tiêu đề 3 khối trong Mầm AI Studio
- Tiêu đề 3 khối (Nguồn tài liệu, Trò chuyện & Tra cứu tài liệu, Xưởng tạo đầu ra) chuyển sang màu mực đậm nhất, cỡ chữ lớn hơn một nấc và in đậm hơn; dòng phụ đề dưới tiêu đề cũng đậm hơn để dễ đọc.

## [2026-10-18] - Đổi thương hiệu hiển thị trong Mầm AI Studio theo yêu cầu
- Tiêu đề "Xưởng Sáng Tạo AI Mầm Văn" → "Xưởng Sáng Tạo Mầm AI Studio"; bỏ nhãn "Mầm AI Studio" thừa bên cạnh tiêu đề.
- Mọi chữ "Gemini AI" hiển thị → "Mầm AI" (nút trạng thái, nút tạo bản nháp, thanh trạng thái ở Ngân hàng câu hỏi); tên model trong ngoặc và trong danh sách chọn model hiển thị dạng "AI-2.5-flash" / "Mầm AI-..." — giá trị model thật gửi lên API giữ nguyên.
- Phụ đề xưởng bỏ chữ "Ngữ văn 7"; tiêu đề mục trò chuyện bỏ "(RAG Grounding)"; số đếm ở thẻ nguồn bỏ chữ "từ".
- Lời chào của trợ lý: "Tôi là trợ lý Mầm AI Studio" → "Tôi là trợ lý Mầm AI".

## [2026-10-18] - Bộ lọc Ngân hàng câu hỏi gập/mở được
- 3 nhóm lọc dạng danh sách (Dạng học liệu, Năng lực, Độ khó) nay bấm vào tiêu đề nhóm là thu gọn hoặc mở ra được — hết cảnh lúc nào cũng trải dài chiếm chỗ.
- Khi nhóm đang thu gọn, tiêu đề hiện kèm lựa chọn đang áp dụng (ví dụ "2. Năng lực · Thông hiểu") để vẫn biết mình đang lọc theo gì.

## [2026-10-18] - Gọn nhãn ở Ngân hàng câu hỏi
- Tab "Kho ngân hàng (98 câu hỏi, ... video, ... bài)" bỏ phần ngoặc đơn thống kê — chỉ còn "Kho ngân hàng".
- Thẻ lọc "Tự luận / Rubric" bỏ chữ Rubric — chỉ còn "Tự luận".

## [2026-10-18] - Gọn giao diện cây nội dung: nhãn trạng thái, bỏ chấm màu, đầu cây không xuống dòng
- Nhãn trạng thái "Có chỉnh sửa chưa xuất bản" dài nên bị xuống 2 dòng — rút gọn thành "Có sửa chưa đăng" và khóa không xuống dòng cho mọi nhãn trạng thái.
- Bỏ chấm màu tròn ở đầu mỗi thẻ chủ đề trong cây nội dung (thừa, gây rối mắt).
- Đầu cây nội dung: tiêu đề rút gọn "Cây chủ đề", nút "Thêm chủ đề" giữ nguyên 1 dòng — không còn ngắt dòng lộn xộn.

## [2026-10-18] - Nút thêm ở trang chủ đề thành menu thêm tổng hợp
- Nút "+ Thêm video vào chủ đề" ở trang chi tiết chủ đề khóa cứng vào video — đã đổi thành nút "Thêm vào chủ đề" mở menu đủ 5 loại như menu Tạo mới (Bài giảng Video, Lý thuyết, Bài luyện tập, Bài kiểm tra, Bài tập về nhà; tạo thủ công hoặc Tạo với AI), mọi mục tạo ra đều gắn đúng vào chủ đề đang mở.

## [2026-10-18] - Nút "Quay lại" trong trình tạo bài tập trở về đúng bài gốc
- Từ trình soạn video/lý thuyết bấm "+ Tạo mới ngay" để tạo bài tập liên kết, rồi bấm "Quay lại" trong trình tạo bài tập: trước đây luôn văng về trang chủ đề, mất bài đang soạn.
- Nay app ghi nhớ bài gốc (video hoặc lý thuyết) khi tạo bài tập liên kết — Quay lại là trở về đúng bài đó. Nếu mở bài tập trực tiếp từ cây nội dung, Quay lại vẫn về trang chủ đề như cũ; chọn mục khác trên cây thì ghi nhớ được xóa.

## [2026-10-18] - Tạo chủ đề mới xong mở sẵn trình soạn video đầu tiên
- Trước đây lưu chủ đề mới xong màn hình chính vẫn trống trơn (không chọn chủ đề, không mở trình soạn) khiến giáo viên không biết làm gì tiếp.
- Nay: vừa tạo chủ đề là app tự chọn chủ đề đó, tự tạo sẵn 1 bản nháp "Bài giảng Video mới" gắn vào chủ đề và mở ngay trình soạn video để Thầy/Cô nhập nội dung luôn. Nhánh "+ Tạo mới → Bài giảng Video" dùng chung một hàm tạo nháp với luồng này.

## [2026-10-18] - Thay toàn bộ hộp thoại xác nhận mặc định của trình duyệt bằng hộp thoại giữa màn hình
- 6 chỗ từng dùng hộp thoại mặc định của trình duyệt (hiện trên đầu trang, kèm chữ tên miền) đã chuyển sang hộp thoại xác nhận của app (giữa màn hình, có lớp phủ): xóa video / lý thuyết / bài tập trong cây nội dung, xóa chủ đề, xóa câu hỏi khỏi ngân hàng, lưu trữ lớp học.
- Nội dung hỏi rõ ràng hơn: "Bạn có chắc chắn muốn xóa ... không? Hành động này không thể hoàn tác." kèm nút Xóa màu đỏ.

## [2026-10-18] - Ba tinh chỉnh giao diện giáo viên theo phản hồi trực tiếp
- Thẻ lớp: dòng mô tả nay luôn chiếm đúng 1 dòng cố định (kể cả khi trống) — trước đây lớp không có mô tả bị khối "Sĩ số / Hoạt động 7 ngày" đẩy lên cao, các thẻ trong cùng hàng lệch nhau.
- Đặt lại mật khẩu học sinh: Thầy/Cô được TỰ ĐẶT mật khẩu theo ý mình ngay trong hộp thoại xác nhận (tối thiểu 6 ký tự); để trống thì hệ thống mới sinh ngẫu nhiên như cũ. Tầng xử lý đã hỗ trợ sẵn mật khẩu tùy chỉnh, nay mới có ô nhập.
- Bảng danh sách học sinh: tiêu đề cột giữ trên 1 dòng (không ngắt 2 dòng như trước).

## [2026-10-18] - Dứt điểm vòng focus đen bám trên nút menu sau khi bấm
- Người dùng phản ánh: bấm sang trang khác là một vòng đen dày bám lại quanh mục menu vừa bấm (vòng focus mặc định của trình duyệt — mỗi trình duyệt/thiết bị vẽ một kiểu nên môi trường kiểm tra không tái hiện được, nhưng luật CSS chống viền focus sẵn có không phủ được trạng thái :focus-visible sau chạm/bấm).
- Xử lý dứt điểm ở tầng hành vi: mọi nút điều hướng trong Navbar (thanh bên, thanh dưới di động, nút Hồ sơ) tự nhả focus (blur) ngay sau khi bấm — không còn phần tử nào giữ focus để trình duyệt vẽ vòng. Đổi lại: điều hướng bằng phím Enter trên menu sẽ cần Tab lại từ đầu; chấp nhận được với ứng dụng học tập dùng chuột/cảm ứng là chính.

## [2026-10-18] - Vá hiển thị tên lớp trong phân tích giáo viên + chốt phạm vi Tổng quan theo lớp của giáo viên
- Danh sách "Học sinh cần quan tâm" từng in MÃ UUID của lớp thay vì tên lớp (học sinh lớp 7a4 hiện thành "Lớp d4036e4a-..."): hàm phân tích nay tra tên lớp theo danh sách lớp thật, không tra được thì hiện "—" — tuyệt đối không in mã UUID, không bịa tên "7A2/7A3" như các fallback thời demo (đã sửa ở cả 3 nơi: metricsEngine, hồ sơ học sinh, bản đồ nhiệt).
- Màn Tổng quan giáo viên: kho dữ liệu trả học sinh toàn hệ thống trong khi lớp chỉ nạp lớp của giáo viên đang đăng nhập — tổng quan nay chỉ tính học sinh thuộc lớp của mình (đúng phân quyền, hết lẫn học sinh lớp khác).

## [2026-10-18] - Gỡ nốt 2 nút "Đặt lại dữ liệu demo" khỏi giao diện khách thật
- Màn Hồ sơ học sinh: bỏ nút "Đặt lại dữ liệu demo của tài khoản" — nút này ghi đè tiến độ thật của học sinh bằng dữ liệu mẫu, tuyệt đối không được tồn tại ở bản khách dùng.
- Màn Cài đặt giáo viên: bỏ cả khu vực "Khôi phục & Đặt lại dữ liệu thử nghiệm (Demo)" cùng hộp thoại xác nhận và hàm xử lý — tránh khôi phục nhầm 28 học sinh seed + 6 tuần điểm số mẫu đè lên dữ liệu thật.
- Công cụ đặt lại chỉ còn trong DevPanel của bản development (không có ở production).

## [2026-10-18] - Vá rò rỉ state mẫu lên DB + ghi nhận rà soát thư viện nội dung
### Lỗi nghiêm trọng đã vá (phát hiện khi kiểm chứng sau dọn dẹp):
- Học sinh thật chưa có dòng state trên DB bị thừa kế TOÀN BỘ tiến độ từ bản local (vốn là state mẫu: 310 XP, log học bài cũ, huy hiệu sẵn) — chỉ riêng hồ sơ được thay bằng hồ sơ thật; khi app lưu ngược lên, DB bị ô nhiễm số liệu mẫu và lời chào hiện sai lớp. Nay: học sinh mới bắt đầu TRẮNG với hồ sơ thật, DB là nguồn sự thật duy nhất.
- Hiệu ứng lưu state trong App chạy đua với hiệu ứng nạp: bản khởi tạo có thể bị ghi lên DB trong 300ms đầu trước khi dữ liệu thật về. Đã thêm cổng chặn — chỉ ghi sau khi state thật của đúng học sinh đó đã nạp xong.
- Đã xoá dòng state ô nhiễm của hs001 để tài khoản bắt đầu lại từ 0 thật.
### Rà soát thư viện nội dung (video/lý thuyết/quiz):
- Trong lúc rà soát, các hàng quiz từng bị xoá nhầm do tiêu chí kiểm tra nội dung chưa đúng cấu trúc dữ liệu (quiz liên kết câu hỏi qua `questionIds`); **toàn bộ 33 quiz đã được khôi phục nguyên vẹn từ bản sao lưu** và kiểm đếm lại (23 bản có câu hỏi thật, 10 bản trống). 16 video nháp cũng đã khôi phục đủ 19 bản sau khi rà soát lại: chúng là bản nháp ĐANG LÀM của giáo viên (có bản chứa link video thật/quiz liên kết), không phải dữ liệu mẫu thuần — giữ nguyên để giáo viên tự dọn trong giao diện. Lưu ý chất lượng: nhiều bản nháp còn tiêu đề mặc định "Bài giảng Video mới"/"Bài Lý thuyết mới" và vài ý trọng tâm chứa ký tự rác — nên dọn tay khi rảnh.

## [2026-10-18] - Tổng kiểm tra "sẵn sàng cho khách thật": gỡ toàn bộ scaffolding demo, dọn dữ liệu test trong DB
### UI/UX:
- Sửa 5 nút thừa dấu "+" trong nhãn (đã có sẵn icon +): "+ Tạo mới" (Nội dung học), "+ Tạo lớp mới", "+ Thêm câu hỏi thủ công", "+ Thêm câu bằng AI", "+ Chèn ngữ liệu/đoạn trích".
### Gỡ demo/mock khỏi bản chạy thật:
- Màn hình đăng nhập: bỏ điền sẵn tài khoản/mật khẩu mẫu, bỏ toàn bộ khu "Tài khoản demo sẵn có (bấm để điền nhanh)" (gồm các thẻ admin/gv001/hs001/hs002 và dòng in mật khẩu mẫu), bỏ lối tắt in sẵn thông tin Admin; placeholder chuyển thành trung tính. Người dùng thật tự nhập tài khoản được cấp.
- Xoá `src/services/mock/demoSeedHistory.ts` (máy sinh lịch sử học tập giả — vốn đã không còn được gọi) cùng script test phụ thuộc vào nó `scripts/test_prompt4_flow.ts` và import mồ côi trong mockRepositories.
### Dữ liệu (Supabase):
- Sao lưu toàn bộ 12 bảng ra file ngoài repo trước khi dọn. Đã xoá 21 tài khoản học sinh test (tên rác/trùng) + 15 bài nộp test + toàn bộ state test; giữ lại: hs001 (tài khoản mẫu chính thức), 5 giáo viên, 4 lớp, và toàn bộ nội dung học thật (6 chủ đề, 97 câu hỏi, 33 quiz, 19 video, 6 lý thuyết).
### Tồn đọng đã ghi nhận (cần chủ dự án quyết):
- Đăng nhập Admin vẫn là thông tin cứng trong mã nguồn (repo công khai) — nên chuyển sang tài khoản quản trị lưu trong DB/biến môi trường trước khi mở cho khách thật.
- Lớp kho mock (localStorage) vẫn tồn tại làm đường dự phòng khi mất kết nối DB; dữ liệu vận hành chính đã ở Supabase.

## [2026-10-18] - Chốt 5 quyết định sau QA vòng 2: XP phẳng theo hoàn thành, đổi quà TRỪ vào TỔNG XP của tài khoản, tạo tài khoản hs001 thật
### Đã chốt & thực hiện:
- **XP giữ nguyên tính phẳng theo hoàn thành** (không gắn điểm số) — xác nhận đây là thiết kế có chủ đích, không sửa.
- **Đổi quà nay TRỪ vào TỔNG XP của tài khoản** (làm rõ theo ý chủ dự án: ví chi tiêu là XP của acc — XP vĩnh viễn, chỉ giảm khi xin quà; KHÔNG phải XP tuần. Mốc mở rương vẫn xét theo XP tuần như thiết kế cũ): trừ ngay khi học sinh gửi yêu cầu (giữ đúng số XP của mốc quà, ghi vào trường mới `deductedXp` của yêu cầu), **bị từ chối thì hoàn lại đầy đủ vào tổng XP**, duyệt/trao/mở không trừ thêm. Chặn gửi yêu cầu khi tổng XP không đủ. Áp dụng đồng nhất ở App và cả 2 kho dữ liệu (mock + Supabase, gồm hoàn XP khi từ chối hàng loạt). Giá XP tra theo danh mục học sinh nhìn thấy (`REWARDS_CATALOG`), kho GV tùy biến là nguồn dự phòng. Test tự động bổ sung: mục 6 trong `scripts/test_round2_logic.ts` (tổng 35/35 đạt).
- **Tạo tài khoản học sinh mẫu `hs001` thật trên Supabase** (trước đây chỉ là thẻ tĩnh trên màn đăng nhập, không tồn tại trên máy chủ nên không đăng nhập được): Nguyễn Minh Anh, lớp 7a1 của gv004, mã HS001, mật khẩu theo tài liệu hướng dẫn dự án; đã kiểm chứng khớp đúng điều kiện đăng nhập của app.
- **Migration 003 + 004:** đã thử chạy từ máy trạm nhưng kết nối TLS trực tiếp tới database bị proxy chặn — **vẫn cần chủ dự án dán 2 file SQL vào Supabase SQL Editor** (app đang chạy chế độ tương thích an toàn trong lúc chờ).
- **Đổi mật khẩu database:** để sau theo ý chủ dự án, chưa thực hiện.
- **Sửa kèm khi kiểm chứng hs001:** học sinh mới (chưa có dòng state trên Supabase) bị chào bằng tên mẫu chung chung "Học sinh" và lớp mặc định — nay state lần đầu được dựng từ hồ sơ thật (đúng tên + đúng lớp) ở cả hai nhánh đọc state.

## [2026-10-18] - QA vòng 2: Đổi tên "Mầm AI Studio", sửa triệt để XP/điểm danh qua ngày, khóa cửa hậu bảo mật, gỡ số liệu bịa
### Đổi tên thương hiệu:
- **"NotebookLM AI Studio" → "Mầm AI Studio"** ở toàn bộ giao diện và tài liệu trong app (23 vị trí, 8 file). Kiểm chứng trên bản build production: "NotebookLM" còn 0 chỗ.
### XP & điểm danh/tưới cây (kiểm chứng bằng test tự động `scripts/test_round2_logic.ts` — 27/27 đạt):
- **Module ngày/tuần mới** `src/logic/studentStateUtils.ts`: ngày tính theo **giờ địa phương** thay vì UTC (trước đây ngày mới bắt đầu lúc 07:00 sáng giờ VN — học sinh có thể điểm danh 2 lần trong một buổi sáng hoặc bị chặn nhầm sáng hôm sau), khóa tuần theo thứ Hai, hàm lật bộ đếm ngày/tuần `rolloverStudentState`, và `countLearningSteps` không tính khóa điểm danh là "bước học".
- **Sửa lỗi mất XP từ ngày thứ 2:** trước đây bộ đếm XP ngày/tuần không bao giờ được reset nên từ ngày thứ 2 mọi lần cộng XP đều trả về 0. Nay bộ đếm tự lật khi sang ngày/tuần mới (cả khi nạp state và phòng thủ ngay trong `awardXP`), state cũ được suy mốc từ ngày điểm danh gần nhất để không xóa nhầm số liệu hôm nay.
- **Tách "tiến độ học" khỏi "đã trả XP"** (`xpAwardedSteps`): học lúc đã chạm trần XP vẫn ghi nhận tiến độ cho Cây/Năng lực, nhưng hôm sau làm lại sẽ được trả XP đúng một lần — trước đây bước bị "đốt", XP mất vĩnh viễn.
- Cộng XP bài tập về nhà không còn ghi trùng khóa bước; thông báo XP hiển thị **số XP thực nhận** (kể cả khi bị chặn bởi trần); xin quà bị chặn trùng khi đã có yêu cầu chưa bị từ chối; màn Kết quả học tập và tỉ lệ tương tác không còn tính ngày điểm danh là hoạt động học.
### Bảo mật & quyền:
- **Xóa cửa hậu mật khẩu:** đăng nhập bằng "123456" (hoặc "admin123") với mọi tài khoản kể cả khi chủ tài khoản đã đổi mật khẩu khác — đã gỡ ở cả 2 bản kho dữ liệu; gợi ý mật khẩu bị xóa khỏi thông báo lỗi đăng nhập; đặt lại mật khẩu nay sinh mật khẩu ngẫu nhiên thay vì "123456".
- **Dev Panel chỉ còn trong bản dev** (`import.meta.env.DEV`) — bản production không còn nút cộng XP/tự duyệt quà/tự chấm 9.0 (kiểm chứng: code bị loại khỏi gói build thật).
- Đăng xuất nay xóa cả phiên "đang đóng vai", hủy lần lưu đang chờ và reset state — trước đây đăng xuất khi đang đóng vai GV có thể leo quyền trở lại.
- "Xem góc Học sinh": lưu phiên gốc, có thanh cảnh báo cố định + nút **Thoát xem thử** quay về đúng phiên GV/Admin; lỗi đăng nhập hs001 được báo rõ thay vì im lặng. Bộ đếm giờ học chỉ chạy khi người dùng thật là học sinh.
### Dữ liệu Supabase (kho dữ liệu thật):
- **Yêu cầu quà dùng số liệu thật:** snapshot XP tuần/điểm danh/tên lớp tính từ state thật (trước đây bịa 260 XP/4 ngày và luôn "đủ điều kiện"); tạo yêu cầu không còn gán nhầm sang id của hs002, không nuốt lỗi insert; trạng thái GIVEN/OPENED không còn bị ghi thành REJECTED — kèm **`database/migration_003_reward_status.sql`** (chủ dự án chạy trong Supabase SQL Editor để DB chấp nhận 2 trạng thái này).
- Câu hỏi giữ đủ trường (đoạn văn, điểm từng phần, trạng thái...) qua cột `payload` mới — **`database/migration_004_question_payload.sql`** (chạy kèm migration_003; app tự chạy chế độ tương thích khi chưa chạy).
- Bài tự luận không còn bị gán cho "học sinh đầu tiên bất kỳ" khi không tra được chủ nhân; xóa học sinh/giáo viên đọc lỗi DB và lùi về dữ liệu cục bộ thay vì báo thành công giả; sửa UUID mặc định khớp seed trong `schema.sql`; sửa thứ tự gộp state làm mất yêu cầu quà/tùy chọn mỗi lần đọc; sửa payload cập nhật học sinh làm mất tên đăng nhập/mật khẩu; đăng nhập lùi về tài khoản tạo cục bộ khi DB chưa có; danh sách lớp gộp cả lớp chỉ có ở cục bộ; chấm bài ghi đúng chủ đề/năng lực + nhật ký kiểm toán + thông báo ở cả 2 kho (trước đây Supabase gán cứng 1 chủ đề thơ); bộ nhớ cục bộ sống sót qua nâng phiên bản schema (thêm khóa bảo vệ rubric/mẫu/cấu hình AI/quà/thông báo).
### Luồng học & chấm:
- **Quiz hết giờ nộp đúng đáp án đã làm** (trước đây nộp bài trống vì handler bị kẹt ở lần render đầu) + chốt chống nộp 2 lần; hộp xác nhận nộp bài báo số câu chưa trả lời; **sau mỗi quiz học sinh thấy màn hình kết quả** (điểm, XP thực nhận, xem lại từng câu với đúng câu hỏi đã làm — kể cả câu hỏi do GV/AI tạo); bài tự luận mang đúng mã học sinh.
- Luồng lý thuyết: XP từng bước lấy từ cấu hình chuẩn (luyện tập 5, kiểm tra 8) và **cộng thưởng hoàn thành luồng +10** như đã hứa trong cấu hình (trước đây không bao giờ được cộng); khôi phục bước học dở theo khóa bước ổn định — màn lý thuyết trước đây luôn bắt đầu lại từ bước 0.
- Ngân hàng câu hỏi: tô sáng đáp án đúng nhận cả 2 dạng lưu (chữ cái và toàn văn); QuizBuilder dọn đáp án khi xóa lựa chọn + chặn xuất bản khi đáp án không còn trong danh sách lựa chọn; điểm tiêu chí trong màn chấm bài gõ số thập phân/xóa trắng bình thường; rubric không cho lưu khi tổng trọng số ≠ 100.
- **AI lỗi không còn giả danh:** khi Gemini lỗi và hệ thống dùng bản dự phòng, GV được cảnh báo rõ và tiêu đề bản nháp ghi "(Bản dự phòng — Gemini lỗi)" thay vì "(Sinh bởi Gemini AI)".
### Phân tích (Analytics) — gỡ toàn bộ số liệu bịa:
- Không còn số mặc định ngụy trang (tỉ lệ đúng 13/18, điểm TB lớp 7.5, đạt 82%, chuỗi chuyên cần 78→91%, xem video 84.5%...): mọi biểu đồ tính từ dữ liệu thật (lịch sử điểm danh, nhật ký XP, kết quả câu hỏi, bước đã học); tuần không có điểm hiển thị trống thay vì tụt về 0 giả.
### Chi tiết khác (vòng rà soát sâu):
- Lọc câu hỏi/chủ đề hiển thị đúng sự kiện đồng bộ (`quiz` thay vì `quizzes`/`questions` không tồn tại); eventBus tra đúng thực thể theo khóa storage thay vì phát "*" gây tải lại toàn bộ; bảng dữ liệu không còn trang trắng khi lọc/xóa ở trang cuối; hàng đợi quà: xuất CSV theo đúng bộ lọc đang xem, duyệt/trao hàng loạt chỉ tính yêu cầu hợp lệ; cài đặt: kiểm tra thứ tự ngưỡng + chặn giá trị 0/trống trước khi lưu, đổi mật khẩu nay kiểm tra mật khẩu hiện tại và lưu thật, bỏ hàng thiết bị bịa; thêm lớp: cảnh báo trùng tên + năm học; lớp đã lưu trữ không còn trong các ô chọn; nhập Excel lỗi hiện thông báo thay vì bảng trống im lặng; tạo lớp/học sinh dùng UUID đầy đủ + hàm sinh ngẫu nhiên an toàn (crypto); cảnh báo API Key Gemini lưu trong trình duyệt.
### Kiểm chứng:
- `npx tsc --noEmit` = 0 lỗi; `npm run build` thành công; test logic tự động 27/27 đạt; 2 lỗi ở bộ test cũ (`test_prompt2_flow` treo, `test_prompt5_flow` thiếu mốc rương) đã xác nhận **có sẵn trên code gốc** (kiểm chứng bằng git stash), không phải hồi quy của đợt này.
- **Kiểm thử thật trên bản preview (tài khoản mẫu):** cổng giáo viên đạt toàn bộ (đăng nhập gv004, Lớp & Học sinh hiện dữ liệu thật, Ngân hàng câu hỏi có nút "⚡ Mở Mầm AI Studio" + thanh trạng thái mỏng, Hàng đợi chấm hiển thị bài thật). Đăng nhập học sinh bằng `hs001` bị từ chối — đã truy rõ: **bảng học sinh thật trên Supabase không có tài khoản hs001** (hs001 chỉ là thẻ mẫu tĩnh trên màn đăng nhập; code cũ cũng trả đúng lỗi này), không phải hồi quy; phía học sinh được kiểm thử bằng một tài khoản học sinh thật trong DB.
- **Sửa thêm từ kiểm thử thật:** điểm gợi ý AI ở hàng đợi chấm hiển thị dạng `7.200000000000001đ` và mặc định bịa `8` khi chưa có gợi ý — nay dùng `formatScore` (làm tròn 1 chữ số thập phân) ở cả 3 nơi hiển thị và không còn số mặc định.

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

## [2026-10-18] - Đợt 6: Thêm mục "Kết quả học tập" cho học sinh + chia nhỏ gói JS (tải lười)
### Đã thực hiện:
- **Mục mới "Kết quả học tập"** ở thanh điều hướng học sinh (theo ghi chú Figma cạnh sidebar — trước đây chưa có trong hệ thống), nằm giữa "Cây tri thức" và "Đổi quà" (`src/components/Navbar.tsx`, `src/App.tsx`, `src/types` điều hướng `NavTab` thêm `'results'`).
- **Màn hình Kết quả học tập mới** (`src/screens/LearningResultsScreen.tsx`), đúng nội dung đã chốt:
  - *Thẻ tổng quan:* tổng XP (+XP hôm nay), số câu đã làm, điểm trung bình /10 + tỉ lệ đúng, số huy hiệu đã đạt.
  - *Điểm theo từng chủ đề:* mức thành thạo 4 năng lực (Nhận biết / Thông hiểu / Phân tích / Vận dụng) dạng thanh %, điểm trung bình và trạng thái (Đã hoàn thành / Đang học / Cần ôn lại / Chưa học) — dùng chung hàm tính `calculateAllMastery` với Cây tri thức nên số liệu nhất quán; bấm tên chủ đề để tới bài học.
  - *Biểu đồ tiến bộ:* biểu đồ Recharts 6 tuần gần nhất (cột = số câu đã làm, đường = điểm trung bình), tính từ chính lịch sử làm bài của học sinh.
  - *Thành tích & huy hiệu:* toàn bộ danh mục huy hiệu, phân biệt đã đạt / chưa đạt.
- **Chia nhỏ gói JS bằng tải lười (React.lazy):** TeacherPortal, LearnScreen, TreeScreen, RewardsScreen, ProfileScreen và màn Kết quả học tập được tách thành các gói riêng chỉ tải khi cần. Gói JS ban đầu giảm từ **2,37 MB xuống ~0,79 MB**; phần giáo viên (~1,08 MB) và thư viện biểu đồ (~0,39 MB) chỉ tải khi vào đúng khu vực.
### Kiểm chứng:
- `npm run build` thành công, 0 lỗi TypeScript; máy chủ dev khởi động bình thường (HTTP 200).

## [2026-10-18] - Đợt 5: Cây tri thức "Vườn Văn Mầm Mục" — 15 vị trí lá theo chủ đề thật, màu trạng thái chuẩn Figma, hiệu ứng nhấp lá
### Đã thực hiện (`src/components/GrowthTree.tsx`, `src/screens/TreeScreen.tsx`):
- **15 vị trí lá trên tán cây, gắn với chủ đề thật:** trước đây chỉ có 4 vị trí và chủ đề thứ 5 trở đi bị vẽ chồng lên vị trí cũ. Nay cây có 15 vị trí lá — **4 lá chính đầu tiên** tương ứng 4 chủ đề đầu tiên trong thứ tự khóa học (lá to, có nhãn tên), và **từ chủ đề thứ 5 trở đi các "lá ẩn" mới bắt đầu xuất hiện** ở 11 vị trí còn lại (lá nhỏ hơn, rê chuột để xem tên + %). Không có chủ đề thì không vẽ lá — tối đa 15 lá.
- **Màu lá đúng quy ước Figma:** đã hoàn thành (≥80%) = **xanh lá đậm**, đang học (50–79%) = **xanh biển**, cần ôn lại (<50%) = **vàng**, chưa học = **xám**. Thêm hàng chú thích màu ngay dưới cây trong màn Cây tri thức.
- **Hiệu ứng "NHẤP vào cây":** bấm vào lá đã hoàn thành, lá lún xuống như bị ấn vào tán cây kèm vòng sáng lan tỏa; các lá khác giữ nguyên thao tác bấm để xem chi tiết chủ đề.
- Giữ nguyên cơ chế tưới nước "Nước tưới Mầm Mực" và các giai đoạn sinh trưởng của cây.
### Kiểm chứng:
- `npm run build` (gồm kiểm tra TypeScript) thành công, 0 lỗi type.

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

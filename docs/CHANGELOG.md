# Nhật ký thay đổi (Changelog) - Dự án Mầm Văn 7

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

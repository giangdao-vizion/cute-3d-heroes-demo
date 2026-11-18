# Backlog ý tưởng game sinh tồn

Tài liệu này lưu các ý tưởng chưa triển khai để nghiên cứu sau. Game được ưu tiên hiện tại là **Đấu Trường Sinh Tồn 360°**, có đặc tả riêng tại [`dau-truong-sinh-ton-design.md`](./dau-truong-sinh-ton-design.md).

## Nguyên tắc chung cho sảnh game

- `index.html` sẽ trở thành sảnh hiển thị mỗi game dưới dạng thẻ.
- Mỗi game mở ở một trang HTML riêng và chỉ tải module cần thiết.
- Model, animation, lựa chọn tướng và một phần tiến trình được dùng chung.
- Mỗi thẻ game nên có ảnh minh họa, mô tả một câu, thời lượng dự kiến, kỷ lục và nút chơi.
- Tất cả game phải chạy được trên static hosting và **bắt buộc tương thích mobile/phone**.
- Thiết kế màn hình điện thoại dọc trước, sau đó mới mở rộng cho desktop.
- Mọi thao tác chính phải dùng được bằng cảm ứng; bàn phím chỉ là phương thức bổ sung.
- HUD phải hỗ trợ safe area, không tràn ở chiều rộng 360px và không bị bàn tay che thao tác chính.
- Mục tiêu hiệu năng tối thiểu là 30 FPS trên điện thoại tầm trung; số model và hiệu ứng phải có giới hạn.
- Mỗi game phải được kiểm thử ít nhất ở viewport 360×640 và 390×844 trước khi hoàn thành.

## 1. Đoàn Tàu Thoát Hiểm

### Ý tưởng cốt lõi

Một xe hàng tự chạy xuyên qua vùng đất đầy quái. Người chơi chạy xung quanh để bảo vệ, sửa chữa và thu thập tài nguyên. Nếu xe bị phá hủy, ván chơi kết thúc.

### Điểm tạo hứng thú

- Rời xe để lấy hòm giúp mạnh nhanh hơn nhưng làm xe mất người bảo vệ.
- Cuối mỗi chặng chọn một trong hai tuyến đường: an toàn, kho báu, trạm sửa hoặc boss.
- Có thể nâng cấp từng bộ phận: giáp xe, tốc độ, nỏ tự động và sức chứa đồng đội.
- Các sự kiện bất ngờ như cầu hỏng, phục kích hoặc đoàn người xin đi nhờ.

### Tái sử dụng

- Logic bám mục tiêu và đợt quái từ Giữ cổng.
- Tướng, thú cưng, hòm và thẻ nâng cấp hiện có.
- Cây, đá và địa hình có thể cuộn ngược để tạo cảm giác xe đang chạy.

### Rủi ro cần nghiên cứu

- Chuyển động của xe, camera và nhân vật phải dễ đọc trên màn hình nhỏ.
- Cần tránh để việc sửa xe biến thành thao tác lặp nhàm chán.
- Phải quyết định xe chạy theo đường cố định hay người chơi được chọn hướng trực tiếp.

Trang dự kiến: `escape-caravan.html`.

## 2. Vòng Tròn Ánh Sáng

### Ý tưởng cốt lõi

Một đèn trại là vùng an toàn duy nhất trong đêm. Người chơi phải rời ánh sáng để lấy tinh thể, mang về duy trì ngọn đèn và sống sót đến bình minh.

### Điểm tạo hứng thú

- Ánh sáng cạn dần tạo đồng hồ áp lực trực quan.
- Ngoài bóng tối có tài nguyên tốt hơn nhưng tầm nhìn thấp và quái mạnh hơn.
- Người chơi chọn dùng tinh thể để kéo dài thời gian hay nâng cấp đèn.
- Một số quái sợ sáng, một số khác có thể tạm thời dập đèn.
- Bản đồ và vị trí tài nguyên thay đổi mỗi ván.

### Tái sử dụng

- Ánh sáng, sương, quái và hệ thống nhặt vật phẩm từ engine hiện tại.
- Thẻ nâng cấp có thể chia thành nhóm đèn, chiến đấu và khám phá.
- Thú cưng có vai trò dò đường hoặc mang tinh thể về.

### Rủi ro cần nghiên cứu

- Ánh sáng động và nhiều quái có thể ảnh hưởng hiệu năng mobile.
- Màn hình tối phải vẫn rõ, không gây khó chịu khi chơi ngoài trời.
- Cần xác định điều kiện thắng: sống đến bình minh, thắp đủ đài hoặc hạ boss đêm.

Trang dự kiến: `last-light.html`.

## 3. Cầu Sập Sinh Tồn

### Ý tưởng cốt lõi

Nhân vật liên tục chạy trên cây cầu đang sụp từ phía sau, vừa né bẫy vừa đánh quái và chọn cổng nâng cấp.

### Điểm tạo hứng thú

- Không thể đứng yên hoặc quay lại quá lâu.
- Hai nhánh đường tạo lựa chọn tức thời giữa phần thưởng và độ nguy hiểm.
- Cổng có thể cho sức mạnh kèm lời nguyền, ví dụ x2 sát thương nhưng mất nửa máu.
- Boss rượt phía sau; mục tiêu là làm chậm boss bằng bẫy trong lúc chạy.
- Phiên chơi ngắn 3–6 phút, phù hợp chơi nhanh.

### Tái sử dụng

- Cầu, cổng số, hòm và hệ thống kéo ngang từ Giữ cổng.
- Đạn, tướng và quái hiện có.
- Có thể ghép đoạn cầu theo module thay vì tạo bản đồ lớn.

### Rủi ro cần nghiên cứu

- Phải phân biệt rõ với Giữ cổng về cảm giác điều khiển.
- Sinh đoạn cầu vô tận cần bảo đảm luôn có đường đi hợp lệ.
- Camera và tốc độ chạy phải không gây chóng mặt.

Trang dự kiến: `crumbling-bridge.html`.

## 4. Săn Đêm – Trốn Boss

### Ý tưởng cốt lõi

Một boss bất tử săn người chơi trong mê cung. Người chơi phải tìm và kích hoạt ba bàn thờ trước khi có thể chiến đấu với boss.

### Điểm tạo hứng thú

- Chuyển nhịp từ trốn chạy sang phản công tạo cao trào rõ ràng.
- Tiếng động và dấu chân báo boss đang đến dù chưa nhìn thấy.
- Quái nhỏ có thể làm chậm, gây tiếng động hoặc tiết lộ vị trí.
- Mỗi bàn thờ kích hoạt làm boss mạnh hơn nhưng cũng mở một năng lực mới.
- Vật phẩm dùng một lần như bẫy, bom khói và mồi nhử tạo quyết định chiến thuật.

### Tái sử dụng

- T-Rex hoặc khủng long sừng làm boss prototype.
- Hệ thống di chuyển, animation và hiệu ứng chiến đấu hiện có.
- Cây, đá và tường dungeon có thể tạo mê cung đơn giản.

### Rủi ro cần nghiên cứu

- AI truy đuổi và tìm đường phức tạp hơn các game hiện tại.
- Cần thiết kế âm thanh; nếu không có âm thanh, trải nghiệm mất phần lớn căng thẳng.
- Camera từ trên cao có thể làm boss quá dễ quan sát, cần sương hoặc giới hạn tầm nhìn.

Trang dự kiến: `night-hunt.html`.

## 5. Thành Trì Bốn Hướng

### Ý tưởng cốt lõi

Căn cứ nằm giữa bản đồ và bị tấn công từ bốn đường. Người chơi trực tiếp chạy đến điểm nóng, xây công trình và hỗ trợ phòng tuyến yếu nhất.

### Điểm tạo hứng thú

- Người chơi không thể có mặt ở mọi nơi, buộc phải ưu tiên.
- Mỗi đường có môi trường và loại quái riêng.
- Giữa các đợt được đặt tháp, bẫy, lính hoặc thú cưng.
- Sự kiện thay đổi luật như sương mù, quái tăng tốc, mất điện tháp hoặc hai boss đồng thời.
- Công trình kết hợp: tháp băng đặt cạnh tháp sét tạo hiệu ứng lan.

### Tái sử dụng

- Hệ thống phòng thủ, nâng cấp và boss từ Giữ cổng.
- Model tướng, quái, thú cưng và vật phẩm hiện tại.
- Logic tự bắn có thể dùng cho tháp và lính.

### Rủi ro cần nghiên cứu

- Nhiều đường và nhiều đơn vị dễ vượt giới hạn hiệu năng.
- Giao diện xây dựng trên điện thoại cần rất ít thao tác.
- Phải tránh việc người chơi chỉ đứng ở giữa và để tháp tự xử lý mọi thứ.

Trang dự kiến: `four-fronts.html`.

## 6. Ý tưởng mở rộng ngắn

Các ý tưởng sau mới ở mức mầm, chỉ nghiên cứu khi năm concept phía trên đã được đánh giá:

- **Đảo Nhỏ Thu Hẹp:** mặt đất chìm dần, người chơi xây cầu tạm và tranh giành vùng an toàn với quái.
- **Hang Động Độc:** khí độc dâng lên theo tầng; phải tìm cửa xuống trước khi hết không khí.
- **Bầy Thú Đồng Hành:** nhân vật yếu nhưng có thể thuần hóa và phối đội hình thú cưng trong mỗi ván.
- **Đêm Khủng Long:** thu thập vật liệu ban ngày, dựng trại rồi phòng thủ trước đàn khủng long ban đêm.
- **Hầm Ngục Một Mạng:** mỗi phòng chọn một trong ba cửa; mất tướng hiện tại thì chuyển sang tướng dự bị.

## Tiêu chí chọn game tiếp theo

Chỉ đưa một ý tưởng vào triển khai khi trả lời được các câu hỏi:

1. Vòng chơi 30 giây có vui khi chưa có tiến trình hoặc phần thưởng dài hạn không?
2. Nó khác rõ ràng với Arena và Giữ cổng ở thao tác chính nào?
3. Có thể tạo prototype bằng tài nguyên hiện có mà không cần backend không?
4. Chạy được trên điện thoại với số model và hiệu ứng dự kiến không?
5. Có ít nhất ba kiểu quyết định, không chỉ né và tăng sát thương?
6. Một ván có điểm kết thúc hoặc cao trào rõ ràng không?

Sau Đấu Trường Sinh Tồn, **Vòng Tròn Ánh Sáng** là ứng viên ưu tiên vì tạo trải nghiệm khác biệt nhất trong khi vẫn tái sử dụng phần lớn tài nguyên hiện có.

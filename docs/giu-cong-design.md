# Giữ Cổng – thiết kế gameplay

Chế độ chơi vô tận trong `cute-3d-demo`: tướng đứng ở cuối cây cầu, quái tràn tới, chơi tới khi cổng thất thủ. Code: `js/defense.js`. Mở thẳng: `http://localhost:8790/#defense`.

## Dòng game tham khảo (nghiên cứu 16-11-2026)

| Kiểu | Ví dụ | Lấy gì |
|---|---|---|
| Lane shooter có cổng số | Mini game trong quảng cáo Last War: Survival, Count Masters, Gun Rush | Đi trái phải, bắn tự động, cổng +/x lính, bắn thùng để nhận quà |
| Roguelite chọn thẻ | Survivor.io, Archero | Lên cấp chọn 1 trong 3 sức mạnh, mỗi ván một bộ chiêu khác nhau |
| Thủ tuyến vô tận | Turret Defense King, Modern Command Mayhem | Đợt quái mạnh dần không hết, boss theo mốc, nâng cấp vĩnh viễn giữa các ván |

Ghi chú: phần "bắn cổng" của Last War chỉ là mini game quảng cáo, game thật là xây thành. Chính vòng chơi ngắn trong quảng cáo mới là thứ gây nghiện, nên Giữ Cổng làm đúng vòng đó.

## Nguyên tắc giao diện

Thiết kế cho điện thoại dọc trước: camera nhìn dốc từ trên cao, cầu vừa khít bề ngang, tướng ở gần đáy màn hình. HUD chỉ có icon và số (🏰 máu cổng, điểm, 🏆 kỷ lục, 🚩 đợt với vòng thời gian, cấp, 🔥 combo, 👑 boss, ☄️ chiêu cuối). Màn menu, thẻ, thua đều là ô icon. Cảm ứng kéo tương đối để ngón tay không che tướng.

Icon: render 3D có viền tối kiểu game mobile, cùng style với nhân vật (model CC0 KayKit/Quaternius + hình tự dựng), không dùng emoji. Bộ icon 2D miễn phí đã xem (Kenney UI, game-icons.net, các gói trên itch.io) đều phẳng hoặc pixel, không hợp; gói cartoon bóng kiểu Last War thì phải trả phí.

## Vòng chơi

- **Mỗi 1–3 giây:** né trái phải, nhắm hàng quái, bắn vỡ hòm.
- **Mỗi 20 giây:** một cặp cổng thưởng trôi tới, mỗi bên một phần thưởng và một số máu. Bắn hết máu thì nhận thưởng và cổng biến mất, đạn lại bay xuyên qua. Không bắn kịp thì cổng trôi qua, không được gì. Phải chọn giữa bắn quái và bắn cổng.
- **Mỗi 30 giây:** sang đợt mới, quái trâu hơn 20%, mở thêm loại quái.
- **Lên cấp:** 3 thẻ hiện gọn ở góc trái, game không dừng. Bấm lúc rảnh tay, thẻ chưa chọn thì vẫn nằm đó (số trên ngọc là số lượt chọn đang chờ).
- **Mỗi 5 đợt:** boss (T-Rex, Khủng long sừng). Hạ boss: chậm thời gian, hồi cổng, thêm 1 thẻ.
- **Mỗi ván:** thua thì nhận sao, mua nâng cấp vĩnh viễn, ván sau đi xa hơn.

## Máu và sát thương là số nguyên

Số máu chỉ hiện trên đầu quái sau phát trúng đầu tiên (giữ chút bí mật) và ẩn ngay khi quái chết. Hòm và cổng luôn hiện số. Mốc máu: quái yếu đợt 1 có 1 máu, quái mạnh 10, boss vài trăm; hòm quà và cổng thưởng cũng có số. Viên đạn sức mạnh 1 trúng thì số giảm đúng 1, chí mạng x2. Người chơi luôn biết còn bao nhiêu phát nữa là hạ được. Thẻ và cổng tăng sát thương cộng +1 mỗi lần.

## Chỉ bắn trúng thứ đang thấy

Quái, hòm, cổng phải đi vào vùng nhìn thấy (dưới thanh HUD phía trên) mới bị bắn trúng; đạn tắt khi tới mép đó. Mọi cú bắn trúng đều có tia sáng tại chỗ trúng. Đạn có lõi sáng, quầng sáng và vệt đuôi theo màu từng tướng.

## Các hệ thống

- **Đạn theo tướng:** Hiệp sĩ chém sóng kiếm, Chiến binh ném rìu xoay, Pháp sư cầu tím, Sát thủ phi dao, Sát thủ trùm đầu bắn nỏ.
- **Lính:** tối đa 30 (hiện 16 model, phần dư cộng vào sát thương). Quái chạm vạch đỏ giết lính trước, hết lính mới trừ máu cổng.
- **Hòm:** súng (+tia/+tốc/+sát thương/+xuyên), lính, máu cổng, bom, nộ.
- **13 thẻ lên cấp** chia Thường / Hiếm / Sử thi: thêm tia, bắn nhanh, sát thương, xuyên thấu, chí mạng, đạn nổ, đạn băng, viện binh, huấn luyện lính, sét trời, thú cưng xung kích, sửa cổng, nộ khí.
- **Chiêu cuối:** mưa sao băng khi đầy nộ (Space).
- **Thú cưng** (chó Shiba, cáo, husky): định kỳ lao lên cầu cắn quái.
- **Combo:** hạ liên tục tăng hệ số điểm tới x5, một con lọt vạch là mất combo.

## Giữ người chơi ở lại lâu

- Kỷ lục điểm và đợt luôn hiện trên màn hình. Báo "Kỷ lục mới!" ngay lúc vượt, màn thua ghi "còn X điểm nữa".
- Mỗi ván cho sao để nâng cấp vĩnh viễn (sát thương gốc, tường dày, lính khởi đầu, nộ khởi đầu).
- Chơi lại một nút, không có màn chờ.
- Chỉ số người chơi tăng cộng dồn tuyến tính, quái tăng lũy thừa: luôn có điểm thua, nhưng mỗi ván xa hơn một chút.

## Cân bằng (mô phỏng bot đơn giản)

Mỗi level 2:30 quân thường (đồng hồ đếm ngược, 10 giây cuối chuyển đỏ), hết giờ ra boss, hạ boss xong sang level mới: khoảng 3 phút/level. Trong level quái trâu thêm x1.2 mỗi 30 giây; sang level mới nhảy thêm x1.25 và ra quái dày hơn.

Điểm: quái thường 10, quái tinh anh 30, boss 500, nhân số level và hệ số combo; qua level +500 x level.

Mô phỏng 16-11-2026 (bot đuổi theo hòm và cổng, chọn thẻ ngẫu nhiên), bản trước khi giảm tăng sát thương: trụ tới level 7 trong 20 phút, sát thương lên 69 và điểm 215 triệu. Đã làm cổng +1 sát thương hiếm hơn, bỏ +1 sát thương khỏi hòm, đổi cách tính điểm như trên.

## Ý tưởng làm tiếp

- Âm thanh và nhạc (hiện chưa có).
- Quái đặc biệt: pháp sư xương che khiên cho đồng đội, ong bay vòng tránh đạn.
- Nhiệm vụ ngày ("hạ 500 quái", "tới đợt 15") và bảng xếp hạng online.
- Mở khoá tướng bằng sao thay vì có sẵn.

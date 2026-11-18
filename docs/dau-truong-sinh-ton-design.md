# Đấu Trường Sinh Tồn 360° – kế hoạch triển khai

## 1. Mục tiêu

Tạo một game survival roguelite chơi nhanh trên trình duyệt, ưu tiên điện thoại:

- Người chơi điều khiển một tướng trong đấu trường mở, quái xuất hiện từ mọi hướng.
- Tướng tự đánh; người chơi tập trung di chuyển, né đòn, chọn nâng cấp và định vị.
- Một ván tiêu chuẩn kéo dài 10 phút, có boss ở phút 3, 6 và 10.
- Mỗi ván tạo được một bộ kỹ năng khác nhau; thua vẫn nhận sao để mở khóa lâu dài.
- Tái sử dụng model, animation, renderer và dữ liệu nhân vật hiện có.

Tên file dự kiến: `survivor-arena.html`.

## 2. Trụ cột trải nghiệm

1. **Dễ điều khiển:** kéo ngón tay hoặc WASD để di chuyển; không cần nút đánh thường.
2. **Luôn có quyết định:** chọn đường thoát, nhặt kinh nghiệm, mạo hiểm lấy hòm hoặc đối đầu quái tinh anh.
3. **Nâng cấp làm thay đổi lối chơi:** thêm đạn, đổi quỹ đạo, tạo hiệu ứng nguyên tố và tiến hóa kỹ năng; tránh chỉ cộng chỉ số nhỏ.
4. **Áp lực tăng rõ ràng:** mật độ, tốc độ và đội hình quái thay đổi theo thời gian.
5. **Phản hồi mạnh:** hit flash, số sát thương, rung camera nhẹ, âm thanh, đóng băng ngắn khi hạ boss.

## 3. Vòng chơi

### Trong từng giây

1. Di chuyển và né quái.
2. Vũ khí tự nhắm hoặc đánh theo quy luật riêng.
3. Quái chết rơi ngọc kinh nghiệm.
4. Người chơi cân nhắc quay lại nhặt ngọc hay giữ khoảng cách an toàn.

### Trong từng phút

1. Lên cấp và chọn 1 trong 3 thẻ.
2. Hòm hoặc quái tinh anh xuất hiện, tạo mục tiêu ngắn hạn.
3. Thành phần đàn quái thay đổi để chống một chiến thuật cụ thể.
4. Boss xuất hiện ở các mốc cố định.

### Sau mỗi ván

1. Tổng kết thời gian sống, số quái hạ, boss hạ và combo cao nhất.
2. Nhận sao dựa trên thành tích.
3. Mua nâng cấp vĩnh viễn hoặc mở khóa tướng.
4. Chơi lại ngay hoặc trở về sảnh game.

## 4. Luật ván đầu tiên

- Thời lượng tối đa: 10 phút.
- Mục tiêu thắng: hạ boss cuối ở phút 10.
- Người chơi có máu, không có cổng cần bảo vệ.
- Quái chạm người chơi gây sát thương rồi bị đẩy lùi nhẹ; có 0,6 giây miễn nhiễm sau khi trúng đòn.
- Ngọc kinh nghiệm nằm trên đất; sau 20 giây tự bay về gần người chơi để tránh rác vật thể.
- Lên cấp tạm dừng game và hiện 3 thẻ. Đây là điểm nghỉ giúp người mới đọc lựa chọn.
- Hòm rơi từ quái tinh anh và boss, cho hồi máu hoặc nâng ngẫu nhiên một kỹ năng đang sở hữu.
- Thua khi máu về 0; thắng khi boss cuối bị hạ.

## 5. Nhịp độ 10 phút

| Thời gian | Nội dung | Mục đích |
|---|---|---|
| 0:00–1:00 | Quái mầm xanh, chuột; mật độ thấp | Học di chuyển và nhặt ngọc |
| 1:00–2:00 | Ong và đầu lâu bay cắt góc | Buộc đổi hướng |
| 2:00–3:00 | Nhện trâu, tinh anh đầu tiên | Kiểm tra sát thương |
| 3:00 | Boss Khủng long sừng | Boss lao thẳng, dạy né tín hiệu |
| 3:00–4:30 | Xương chiến binh thành cụm | Khuyến khích sát thương diện rộng |
| 4:30–6:00 | Xương pháp sư bắn xa, ong bao vây | Ép ưu tiên mục tiêu |
| 6:00 | Boss T-Rex | Cắn hình quạt và gầm gọi quái |
| 6:00–8:00 | Đội hình hỗn hợp, tinh anh thường xuyên | Kiểm tra build |
| 8:00–10:00 | Đàn quái dày, vòng vây co lại | Cao trào sinh tồn |
| 10:00 | Boss cuối cường hóa | Điều kiện chiến thắng |

Mốc thời gian phải được cấu hình bằng dữ liệu để dễ cân bằng, không viết cứng trong logic sinh quái.

## 6. Tướng và bản sắc chiến đấu

Giữ chỉ số nền từ `js/catalog.js`, sau đó thêm cấu hình riêng cho survival:

| Tướng | Vũ khí khởi đầu | Điểm mạnh | Điểm yếu |
|---|---|---|---|
| Hiệp sĩ | Sóng kiếm theo hướng di chuyển | Trâu, dễ chơi | Tầm ngắn |
| Chiến binh rìu | Rìu xoay quanh người | Dọn đàn sát thân | Khó đánh mục tiêu xa |
| Pháp sư | Cầu phép tự tìm mục tiêu | Tầm xa, nguyên tố mạnh | Máu thấp |
| Sát thủ | Dao bắn về kẻ gần nhất | Tốc đánh cao | Sát thương mỗi đòn thấp |
| Sát thủ trùm đầu | Nỏ xuyên theo đường thẳng | Hạ hàng quái tốt | Cần định vị |

MVP chỉ cần Hiệp sĩ, Pháp sư và Sát thủ trùm đầu để kiểm tra ba kiểu vũ khí khác nhau. Hai tướng còn lại thêm sau khi vòng chơi ổn định.

## 7. Hệ thống kỹ năng

Mỗi kỹ năng có tối đa 5 cấp. Người chơi mang tối đa 6 kỹ năng chủ động và 6 nội tại.

### Kỹ năng chủ động cho MVP

| Kỹ năng | Hành vi | Hướng nâng cấp |
|---|---|---|
| Vũ khí riêng của tướng | Tự đánh theo bản sắc tướng | Sát thương, số lượng, tốc độ |
| Sét trời | Đánh kẻ ngẫu nhiên, lan mục tiêu | Số tia, lan, choáng |
| Quả cầu băng | Bay quanh người, làm chậm | Số cầu, bán kính, đóng băng |
| Bom lửa | Rơi vào cụm đông nhất | Bán kính, cháy, tần suất |
| Thú cưng xung kích | Thú cưng lao xuyên đàn quái | Số thú, tốc độ, hồi chiêu |
| Khiên xoay | Chặn quái và gây sát thương gần | Số khiên, đẩy lùi, kích thước |

### Nội tại cho MVP

- Tăng sát thương.
- Tăng tốc đánh.
- Tăng tốc chạy.
- Tăng máu tối đa và hồi một phần máu.
- Tăng bán kính hút ngọc.
- Tăng chí mạng.

### Tiến hóa kỹ năng

Kỹ năng chủ động cấp 5 cộng với nội tại đúng cặp sẽ tiến hóa khi mở hòm boss:

- Quả cầu băng + tốc đánh → **Bão Tuyết**, tạo vùng đóng băng định kỳ.
- Bom lửa + sát thương → **Thiên Thạch**, nổ hai lần và để lại vùng cháy.
- Sét trời + chí mạng → **Lôi Võng**, sét lan không giới hạn trong một khoảng ngắn.
- Thú cưng + tốc chạy → **Bầy Thú**, nhiều thú chạy vòng liên tục.

MVP có thể phát hành với hai tiến hóa đầu tiên; cấu trúc dữ liệu phải hỗ trợ bổ sung mà không sửa lõi.

## 8. Thiết kế kẻ địch

Mỗi loại quái phải tạo một vấn đề khác nhau:

- **Quái mầm xanh:** cơ bản, đi thẳng.
- **Chuột:** nhanh, máu thấp, ép phản ứng.
- **Nhện:** chậm, nhiều máu, chặn đường.
- **Ong/đầu lâu:** bay theo đường cong để cắt góc.
- **Xương chiến binh:** đi theo đội hình dày.
- **Xương pháp sư:** giữ khoảng cách và bắn đạn có tín hiệu.
- **Xương sát thủ:** tăng tốc ngắn sau khi đến gần.
- **Tinh anh:** bản lớn hơn, có hào quang và một thuộc tính ngẫu nhiên như nhanh, giáp hoặc nổ khi chết.

Không sinh quái ngay trong vùng an toàn quanh người chơi hoặc trong vùng camera đang nhìn thấy quá gần.

### Boss

**Khủng long sừng**

- Báo hiệu bằng vệt đỏ trên đất rồi lao thẳng.
- Va tường bị choáng và nhận thêm sát thương.
- 50% máu: lao hai lần liên tiếp.

**T-Rex**

- Cắn hình quạt phía trước.
- Gầm đẩy lùi và gọi một vòng quái nhỏ.
- 40% máu: tăng tốc, các đòn có thời gian báo hiệu ngắn hơn.

Boss cuối dùng T-Rex cường hóa cho MVP; về sau nên có model và bộ chiêu riêng.

## 9. Bản đồ và camera

- Đấu trường hình vuông bo góc, rộng hơn màn hình khoảng 4–5 lần.
- Camera nghiêng từ trên cao, luôn theo người chơi với độ trễ nhẹ.
- Biên bản đồ có vật cản mềm hoặc sương để người chơi nhận biết.
- Cây, đá và cột trang trí không cản đường trong MVP để tránh lỗi điều hướng.
- Sau phút 8, vùng an toàn co dần, tạo áp lực mà không cần tăng quá nhiều quái.
- Camera dọc cho điện thoại; trên desktop mở rộng tầm nhìn nhưng không tăng phạm vi tấn công.

## 10. Điều khiển và HUD

### Điều khiển

- Mobile: joystick ảo xuất hiện tại vị trí chạm, kéo tương đối.
- Desktop: WASD hoặc phím mũi tên.
- `P` hoặc nút góc màn hình: tạm dừng.
- Không có nút đánh thường.

### HUD

- Góc trên trái: chân dung, máu và cấp.
- Chính giữa trên: đồng hồ đếm đến 10:00.
- Góc trên phải: số quái hạ và nút tạm dừng.
- Thanh dưới: 6 icon kỹ năng và cấp hiện tại.
- Thanh kinh nghiệm chạy sát đáy màn hình.
- Boss có thanh máu riêng dưới đồng hồ.

Ưu tiên icon và số; văn bản dài chỉ xuất hiện trong màn chọn thẻ, tạm dừng và tổng kết.

## 11. Tiến trình lâu dài

Dùng chung sao và lựa chọn tướng qua `localStorage`, nhưng tách namespace dữ liệu:

```text
cute3d.survivor.bestTime
cute3d.survivor.bestKills
cute3d.survivor.stars
cute3d.survivor.upgrades
cute3d.survivor.unlockedHeroes
```

Nâng cấp vĩnh viễn ban đầu:

- +máu khởi đầu.
- +sát thương khởi đầu.
- +bán kính hút ngọc.
- +một lần hồi sinh mỗi ván.
- Mở khóa tướng.

Giới hạn sức mạnh vĩnh viễn để kỹ năng trong ván vẫn là yếu tố quyết định.

## 12. Kiến trúc kỹ thuật đề xuất

### Trang và module

```text
index.html                         Sảnh chọn game
showroom.html                      Chọn/xem nhân vật
arena.html                         Game arena hiện tại
defense.html                       Giữ cổng
survivor-arena.html                Đấu trường sinh tồn
js/survivor/main.js                Khởi tạo, vòng lặp và chuyển trạng thái
js/survivor/survivor.js            Luật ván chơi
js/survivor/spawner.js             Timeline và sinh quái
js/survivor/weapons.js             Kỹ năng, đạn và tiến hóa
js/survivor/pickups.js             Ngọc, hòm và vật phẩm hồi máu
js/survivor/config.js              Cân bằng dạng dữ liệu
js/survivor/ui.js                  HUD, thẻ và tổng kết
```

Tiếp tục dùng chung:

- `js/catalog.js`: model, animation và chỉ số nền.
- `js/engine.js`: renderer, tải model và tiện ích cảnh.
- `js/state.js`: lựa chọn tướng; cần bổ sung API lưu dữ liệu theo chế độ.

Mỗi trang game sở hữu một renderer và animation loop riêng. Không tải code của các game khác để giảm thời gian mở trang và tránh phụ thuộc UI.

### Nguyên tắc hiệu năng

- Tái sử dụng model đã clone và dùng object pool cho quái, đạn, ngọc, hiệu ứng.
- Giới hạn số model quái hiển thị; nhóm phần dư thành đàn có sát thương tương đương nếu thiết bị yếu.
- Không tạo DOM cho từng quái; thanh máu chỉ dành cho boss và tinh anh.
- Dùng squared distance thay cho căn bậc hai trong tìm mục tiêu.
- Giảm tần suất tìm mục tiêu và va chạm xuống 10–20 lần/giây, render vẫn theo màn hình.
- Có cấu hình chất lượng tự động dựa trên FPS trong 10 giây đầu.

## 13. Các trạng thái game

```text
loading → ready → playing ↔ paused
                    ↓
                 level-up
                    ↓
                  playing
                    ↓
              victory / game-over
```

Chỉ một trạng thái được phép xử lý input gameplay. Khi chọn thẻ, đồng hồ, AI và hiệu ứng phải dừng hoàn toàn.

## 14. Kế hoạch triển khai theo lát cắt

### Lát cắt 1 – chơi được

- Tạo `survivor-arena.html` và module khởi tạo.
- Một tướng di chuyển, camera theo tướng.
- Một loại quái đuổi người chơi.
- Tướng tự đánh, quái chết và rơi ngọc.
- Máu, XP, lên cấp và màn thua.

**Hoàn thành khi:** chơi liên tục 3 phút trên desktop và mobile mà không lỗi hoặc giảm FPS nghiêm trọng.

### Lát cắt 2 – vòng chơi MVP

- Timeline 10 phút và sáu loại quái.
- Sáu kỹ năng chủ động, sáu nội tại.
- Chọn thẻ, hòm, tinh anh và hai tiến hóa.
- Hai boss với tín hiệu đòn đánh.
- Màn thắng, tổng kết và chơi lại.

**Hoàn thành khi:** có thể thắng/thua, các ván tạo ra build khác nhau và không có lựa chọn thẻ vô hiệu.

### Lát cắt 3 – sảnh và tiến trình

- Chuyển `index.html` thành sảnh game.
- Tách showroom, arena và defense sang trang riêng.
- Chia sẻ lựa chọn tướng và sao.
- Kỷ lục, nâng cấp vĩnh viễn và mở khóa tướng.
- Điều hướng quay về sảnh nhất quán.

**Hoàn thành khi:** tải trực tiếp từng URL, refresh và quay lại sảnh không mất dữ liệu.

### Lát cắt 4 – hoàn thiện

- Âm thanh, nhạc và phản hồi va chạm.
- Cân bằng độ khó, tỷ lệ thẻ và phần thưởng.
- Hướng dẫn ván đầu, pause khi tab mất focus.
- Tự điều chỉnh chất lượng, kiểm tra nhiều kích thước màn hình.
- Thêm hai tướng còn lại và thử thách hằng ngày dạng offline.

## 15. Tiêu chí nghiệm thu MVP

- Chạy được bằng static hosting, không cần backend hoặc bước build.
- Điều khiển được bằng cảm ứng và bàn phím.
- Một ván đầy đủ có thời lượng tối đa 10 phút.
- Có ít nhất 3 tướng, 6 kỹ năng chủ động, 6 nội tại, 6 loại quái và 2 boss.
- Có lên cấp, chọn thẻ, hòm, tiến hóa kỹ năng, thắng, thua và chơi lại.
- Lưu kỷ lục và nâng cấp bằng `localStorage`.
- Không sinh quái đè lên người chơi.
- Không có object/DOM tăng vô hạn sau nhiều lần chơi lại.
- Mục tiêu 60 FPS trên desktop phổ thông và tối thiểu 30 FPS trên điện thoại tầm trung.
- Các nút chính vẫn dùng được ở màn hình dọc nhỏ và vùng safe area.

## 16. Cân bằng và kiểm thử

Các giá trị máu, sát thương, tốc độ, XP và timeline đặt trong `config.js`. Ghi lại sau mỗi ván test:

- Thời điểm và nguyên nhân mất máu.
- Cấp và bộ kỹ năng khi thắng/thua.
- Số quái đang sống cao nhất.
- FPS thấp nhất và số object cao nhất.
- Kỹ năng gây bao nhiêu phần trăm tổng sát thương.

Mục tiêu cân bằng ban đầu:

- Người mới sống được 3–5 phút.
- Người hiểu hệ thống có thể gặp boss cuối sau vài ván.
- Không kỹ năng nào thường xuyên chiếm hơn 45% tổng sát thương nếu không được tiến hóa.
- Mỗi lần lên cấp đều có ít nhất một lựa chọn dùng được.
- Boss hạ được bằng nhiều build, không bắt buộc một kỹ năng cụ thể.

## 17. Ngoài phạm vi MVP

- Multiplayer và bảng xếp hạng online.
- Tài khoản hoặc đồng bộ cloud.
- Bản đồ sinh ngẫu nhiên phức tạp.
- Trang bị có kho đồ.
- Nhiệm vụ ngày phụ thuộc máy chủ.
- Quảng cáo, thanh toán hoặc năng lượng giới hạn lượt chơi.

Các mục này chỉ xem xét sau khi vòng chơi 10 phút đã vui và ổn định.

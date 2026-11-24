# Siêu Thị Chibi – ý tưởng và khung quyết định

Game quản lý siêu thị trên điện thoại dọc: người chơi mở rộng quầy, xếp hàng hóa, phục vụ khách đi lại mua sắm. Tài liệu này dùng để chốt hướng trước khi làm prototype.

## 1. Ý tưởng cốt lõi (đề xuất mặc định)

Một vòng chơi ngắn, dễ hiểu trên iPhone:

1. Khách vào siêu thị, đi giữa các quầy, nhặt món muốn mua.
2. Khách xếp hàng tại quầy thanh toán.
3. Nếu xếp hàng lâu / hết hàng / bẩn / thiếu nhân viên → khách bực, đánh giá thấp hoặc bỏ đi.
4. Người chơi dùng tiền để mở quầy mới, nâng cấp kệ, thuê nhân viên, mở rộng mặt bằng.
5. Mục tiêu ván: đạt doanh thu / sao / số khách hài lòng trong thời hạn, hoặc chơi vô tận giữ cửa hàng sống.

Điểm gây nghiện nên nằm ở **áp lực không gian + thời gian**, không phải micro-management nặng:

- Nhìn một cái là biết chỗ nào đang tắc.
- Quyết định nhanh: mở thêm 1 quầy hay thuê thêm 1 người?
- Mỗi lần nâng cấp thấy siêu thị “lớn lên” rõ ràng.

## 2. Ba hướng gameplay có thể chọn

| Hướng | Cảm giác | Độ khó làm | Phù hợp mobile? |
|---|---|---|---|
| A. **Idle + tap** | Nhìn khách tự mua, chạm để thu tiền / gọi nhân viên / dọn dẹp | Thấp | Rất tốt |
| B. **Quản lý + chỉ huy** | Chọn nhân viên, kéo họ tới quầy, mở rộng layout | Trung bình | Tốt nếu thao tác lớn |
| C. **Mô phỏng sâu** | Tự đi nhân vật, mang hàng, xếp kệ, tính tồn kho chi tiết | Cao | Dễ rối trên màn nhỏ |

**Khuyến nghị cho repo này:** bắt đầu bằng **hướng A**, có thêm vài thao tác chỉ huy kiểu B. Tránh C ở prototype đầu.

## 3. Tài nguyên cần có

### 3.1. Model / nghệ thuật 3D (hoặc 2.5D)

Nếu dùng Three.js như các game hiện có:

| Nhóm | Ví dụ tối thiểu cho prototype | Ghi chú |
|---|---|---|
| Nhân vật khách | 4–6 kiểu chibi (nam/nữ/trẻ/già) | Cần idle, walk, wait, angry, celebrate |
| Nhân viên | 1–2 model (thu ngân, bổ sung hàng) | Có thể tái dùng khách đổi màu trang phục |
| Quầy / kệ | Kệ thấp, kệ cao, quầy thu ngân, tủ lạnh | Ưu tiên khối low-poly, dễ ghép |
| Hàng hóa | 8–12 SKU đại diện (sữa, bánh, rau, nước…) | Có thể là prop nhỏ trên kệ, không cần physics |
| Nội thất | Cửa ra vào, tường, sàn, biển hiệu, thùng rác | Tạo “cảm giác siêu thị” |
| FX / UI 3D | Bubble cảm xúc, dấu `$`, dấu `!`, sao đánh giá | Nên render 2D overlay thay vì mesh nếu có thể |

Nếu muốn nhẹ hơn trên iPhone: làm **top-down 2D/isometric** trước, sau mới chuyển 3D. Prototype 2D rẻ hơn rất nhiều.

### 3.2. Dữ liệu gameplay

- Danh mục mặt hàng: giá mua, giá bán, tốc độ bán, độ ưu tiên của khách.
- Loại khách: ngân sách, kiên nhẫn, sở thích danh mục.
- Công thức tiền: doanh thu, lãi, chi phí thuê / điện / lương.
- Bảng nâng cấp: sức chứa kệ, tốc độ thu ngân, số khách vào/giờ.
- Layout slot: ô đặt được quầy nào, kích thước siêu thị theo cấp.

### 3.3. Âm thanh / cảm giác

Tối thiểu: bước chân nhẹ, beep thanh toán, bell cửa, tiếng “bực”, jingle nâng cấp. Có thể hoãn sang sau prototype hình ảnh.

### 3.4. Hệ thống kỹ thuật tái dùng từ repo

- Sảnh chọn game từ `index.html`.
- Trang riêng kiểu `supermarket.html` + `js/supermarket/`.
- Lưu tiến trình bằng `localStorage` như `state.js`.
- Nhân vật chibi KayKit/Quaternius có thể tái dùng làm khách/nhân viên nếu chọn hướng 3D.
- Không tải model khi ở Home; chỉ load khi vào mode siêu thị.

## 4. Các bước thực hiện đề xuất

### Bước 0 – Chốt quyết định (1 vòng trao đổi)

Chốt các mục ở mục 5 bên dưới trước khi code nhiều.

### Bước 1 – Prototype giấy / blockout

- Bản đồ siêu thị 1 phòng, 2 kệ, 1 quầy thu ngân, cửa ra vào.
- Khách spawn → đi tới kệ → đi tới quầy → trả tiền → ra về.
- Người chơi chỉ có 2–3 nút: mở kệ, thuê thu ngân, bổ sung hàng.

Mục tiêu: chứng minh vòng “khách vào → tắc → mở rộng → thông” đã vui.

### Bước 2 – Loop kinh tế ngắn

- Thêm tiền, giá hàng, hết hàng, khách bỏ đi.
- Thêm 1–2 nâng cấp rõ hiệu quả.
- HUD mobile: tiền, sao, nút xây, nút tốc độ x2.

### Bước 3 – Nội dung đủ chơi 3–5 phút

- 6–8 loại hàng, 3 loại khách, 4 loại quầy.
- 1 mục tiêu ngày (ví dụ: 20 khách hài lòng).
- Màn thắng/thua + chơi lại.

### Bước 4 – Mở rộng meta

- Mở thêm khu (thực phẩm tươi, thời trang, điện máy).
- Nhân viên chuyên biệt, sự kiện (giờ cao điểm, ship hàng trễ).
- Tiến trình vĩnh viễn giữa các ngày.

### Bước 5 – polish mobile

- Viewport 360×640 và 390×844.
- Chạm lớn, không che bằng tay.
- Giới hạn số agent/pathfinding để giữ ≥30 FPS.

## 5. Những điều cần chốt để ra quyết định

Trả lời lần lượt các câu sau; mỗi câu nên chọn **1 phương án**.

### A. Cảm giác chơi chính là gì?

1. Xây cửa hàng lớn dần (tycoon)
2. Sinh tồn ca làm việc (đừng để khách giận)
3. Puzzle sắp xếp layout
4. Idle xem tiền chảy

**Đề xuất:** 1 + 2. Xây là phần thưởng dài, chống tắc là phần thú vị từng phút.

### B. Người chơi điều khiển cái gì?

1. Chỉ bấm UI / đặt công trình
2. Kéo thả nhân viên + đặt công trình
3. Điều khiển 1 nhân vật đi làm việc trong siêu thị

**Đề xuất:** 2. Vẫn thân thiện mobile, sâu hơn idle thuần.

### C. Nhìn từ góc nào?

1. Top-down 2D
2. Isometric 2.5D
3. 3D nghiêng như Giữ cổng / Sinh tồn

**Đề xuất:** nếu muốn ra prototype nhanh → 1 hoặc 2; nếu muốn đồng bộ brand 3D hiện có → 3 nhưng giới hạn số khách trên sàn.

### D. Độ sâu mô phỏng hàng hóa?

1. Kệ chỉ có “đầy / vơi” chung
2. Từng danh mục (sữa, bánh, rau…)
3. Từng SKU + tồn kho chi tiết

**Đề xuất:** bắt đầu từ 2. Đủ cảm giác quản lý, chưa nặng Excel.

### E. Thắng/thua thế nào?

1. Vô tận, phá kỷ lục doanh thu
2. Theo ngày/ca: đạt chỉ tiêu sao
3. Story mở khóa khu mới

**Đề xuất:** 2 cho prototype (dễ đọc), sau thêm 1 làm mode phụ.

### F. Phạm vi prototype v1?

Chốt một gói “chỉ làm những cái này”:

- [ ] 1 mặt bằng cố định
- [ ] 2 kệ + 1 thu ngân
- [ ] 1 loại nhân viên
- [ ] 4–6 loại hàng
- [ ] Khách đi path đơn giản (không cần navmesh phức tạp)
- [ ] 3 nút hành động chính trên HUD
- [ ] Chạy ổn trên iPhone Safari

Mọi thứ ngoài list trên = chưa làm.

### G. Ngân sách nghệ thuật

1. Dùng lại model chibi hiện có + prop tự dựng bằng hình khối
2. Mua/pack CC0 nội thất siêu thị
3. Vẽ 2D riêng

**Đề xuất:** 1 cho spike; chỉ chuyển 2/3 khi loop đã vui.

## 6. Rủi ro cần biết sớm

- **Pathfinding + đông khách** rất dễ làm giật trên điện thoại.
- Camera quá gần thì không thấy tắc; quá xa thì không thấy nhân vật dễ thương.
- Quản lý tồn kho chi tiết dễ biến game thành bảng tính nhàm.
- Nếu phải tự bê hàng liên tục, mobile sẽ mệt tay.
- Đồng bộ 3D với brand hiện tại đẹp, nhưng chậm hơn isometric rất nhiều.

## 7. Tiêu chí “đáng làm tiếp”

Prototype được xem là thành công nếu trong 60–90 giây đầu, người chơi:

1. Hiểu khách đang làm gì mà không cần hướng dẫn dài.
2. Thấy một chỗ tắc và muốn bấm nâng cấp ngay.
3. Sau lần nâng cấp đầu, cảm giác “ồ, thông thật”.
4. Muốn mở thêm 1 quầy nữa trước khi thoát.

Nếu chưa đạt 4 ý trên, đừng thêm nội dung — chỉnh loop trước.

## 8. Đề xuất quyết định mặc định để bắt đầu

Nếu cần một bộ chốt sẵn để triển khai ngay:

- Tên tạm: **Siêu Thị Chibi**
- Hướng: tycoon chống tắc, thao tác đặt công trình + chỉ huy nhân viên
- Góc nhìn: 3D nghiêng mobile, số khách hard-cap thấp
- Kinh tế: theo danh mục hàng, chưa SKU chi tiết
- Mode: theo ca / ngày, có chỉ tiêu sao
- Trang: `supermarket.html`
- Tài nguyên v1: model nhân vật hiện có + kệ/quầy low-poly tự dựng
- Không làm ở v1: tự điều khiển nhân vật, kho chi tiết, multi-floor, online

## 9. Câu hỏi cần bạn trả lời để khóa hướng

1. Chọn hướng A/B/C ở mục 2?
2. Góc nhìn 2D, isometric hay 3D?
3. Prototype đầu tiên chơi **60 giây** để chứng minh gì: xây lớn, chống tắc, hay xem tiền chảy?
4. Muốn gắn vào sảnh Cute Heroes (dùng tướng chibi hiện có), hay tách brand siêu thị riêng?
5. Có muốn mình viết tiếp đặc tả chi tiết màn prototype + danh sách task kỹ thuật không?

# Siêu thị quản lý – hướng đã chốt

Tài liệu khóa quyết định sản phẩm trước khi làm prototype. Mục tiêu thiết bị: iPhone, giao diện dọc trước.

## 1. Quyết định đã khóa

| Hạng mục | Chốt |
|---|---|
| Hướng chơi | **Idle-tap**: khách và nhân viên tự chạy; người chơi chạm để thu, đặt mua, xây, tăng tốc |
| Góc nhìn | **Isometric 2.5D** |
| Mục tiêu prototype | Chứng minh cảm giác **xây lớn**: siêu thị nở rộng rõ sau mỗi lần đầu tư |
| Brand | **Brand siêu thị riêng**, không dùng nhận diện Cute Heroes |
| Hàng hóa | **Tồn kho chi tiết theo SKU** |
| Trang dự kiến | `supermarket.html` + `js/supermarket/` |
| Tên tạm | **Mini Mart Tycoon** (có thể đổi sau) |

## 2. Cách đọc các quyết định cùng lúc

Idle-tap + tồn kho chi tiết dễ thành “bảng tính”. Cách hòa giải:

- Tồn kho **có số thật** (SKU, sức chứa, giá nhập/bán, số lượng).
- Người chơi **không nhập số tay**. Chủ yếu tap: Đặt hàng, Bổ sung kệ, Mở SKU mới, Nâng sức chứa.
- Hệ thống tự trừ/kho/kệ khi khách mua.
- Cảnh báo bằng bubble `!` / `Hết hàng` trên isometric, không bắt mở menu liên tục.

Prototype ưu tiên **xây lớn**, nên vòng vui chính là:

1. Kiếm tiền từ khách tự mua.
2. Tap mở thêm kệ / phòng / khu.
3. Nhìn map isometric rộng ra ngay lập tức.
4. Muốn mở tiếp vì còn chỗ trống hoặc còn khu khóa.

Chống tắc và khách giận vẫn có, nhưng là lớp phụ trong v1.

## 3. Brand riêng

Tách hoàn toàn khỏi Cute Heroes:

- Tên, logo, favicon, màu, font riêng.
- Không tái sử dụng tướng KayKit làm “hero chọn tướng”.
- Có thể nằm chung repo/sảnh chỉ như một game độc lập, hoặc mở URL riêng.
- Tone đề xuất: siêu thị mini dễ thương, sạch, màu lạnh + vàng giá; tránh palette tím/cream mặc định của AI.

Cần chốt sớm (không chặn prototype xám):

1. Tên cuối.
2. 1 câu slogan.
3. 3–5 màu brand.
4. Style nhân vật: người que dễ thương / chibi / icon phẳng.

## 4. Vòng chơi idle-tap

### Vòng 5–15 giây

- Khách spawn, đi kệ, lấy SKU còn hàng, xếp hàng, trả tiền, ra về.
- Tiền bay lên; kho và kệ tự cập nhật.
- Tap nhanh: thu tiền mặt (nếu có cơ chế hold-to-collect), tăng tốc x2, bổ sung 1 SKU đang đỏ.

### Vòng 30–90 giây

- Mở thêm 1 kệ hoặc nâng cấp quầy thu ngân.
- Mở thêm 1–2 SKU.
- Đặt đơn nhập hàng (tap 1 lần theo gói đề xuất).

### Vòng 3–10 phút

- Mở rộng mặt bằng (thêm aisle / phòng).
- Thuê thêm 1 nhân viên idle (tự restock hoặc tự thu ngân).
- Đạt mốc xây: “Siêu thị cấp 2”.

## 5. Tồn kho chi tiết (SKU)

Mỗi SKU có tối thiểu:

- `id`, tên, danh mục
- `cost`, `price`
- `stock` (trong kho sau)
- `shelf` (số đang trên kệ)
- `shelfCap`
- `popularity` (tần suất khách muốn mua)

Luồng:

1. Đặt hàng → sau timer ngắn, hàng vào `stock`.
2. Nhân viên / nút Restock chuyển `stock` → `shelf`.
3. Khách mua trừ `shelf`, cộng tiền.
4. `shelf = 0` → khách bỏ qua hoặc bực nếu đó là món họ muốn.

Prototype v1 số lượng đề xuất:

- 8 SKU thuộc 3 danh mục (Đồ uống, Đồ ăn nhẹ, Đồ tươi).
- 1 kho chung sức chứa giới hạn.
- Không làm hạn dùng / thất thoát phức tạp ở v1.

## 6. Tài nguyên cần có

### Nghệ thuật isometric

| Nhóm | Prototype tối thiểu |
|---|---|
| Nền / tile | Sàn siêu thị, tường thấp, cửa kính |
| Buildables | Kệ đơn, kệ đôi, quầy thu ngân, kho nhỏ, thảm lối đi |
| Hàng trên kệ | Icon/prop 8 SKU, trạng thái đầy/vơi |
| Nhân vật | 3 skin khách + 1 thu ngân + 1 restock, animation walk/idle đơn giản |
| UI | Tiền, nút Xây, Kho, Tốc độ, bubble hết hàng |
| Brand | Logo wordmark, app icon riêng, màu theme |

Ưu tiên sprite/tile isometric hoặc mesh isometric thấp; không cần ortographic 3D phức tạp cho spike đầu.

### Dữ liệu

- Bảng SKU
- Bảng giá xây / nâng cấp / mở rộng phòng
- Cong khách vào theo cấp siêu thị
- Save: tiền, cấp mặt bằng, cấp công trình, tồn kho từng SKU

### Kỹ thuật

- Trang riêng, lazy-load, không đụng runtime Cute Heroes.
- Chạm lớn, safe-area, portrait iPhone.
- Hard-cap số khách trên sàn để giữ mượt.
- Path đơn giản theo waypoint/aisle, chưa cần navmesh nặng.

## 7. Phạm vi prototype v1 (xây lớn)

Làm đúng các mục này:

- [ ] Brand shell riêng (tên tạm + màu + logo placeholder)
- [ ] Map isometric 1 khu, có chỗ trống để mở rộng
- [ ] Idle: khách tự mua / thanh toán / rời đi
- [ ] 8 SKU + kho + kệ số lượng thật
- [ ] Tap: Đặt hàng gói, Restock, Xây kệ, Mở rộng 1 lần
- [ ] Nhịp “kiếm tiền → mở rộng → map to hơn” trong 60–90 giây
- [ ] Lưu localStorage
- [ ] Kiểm thử 360×640 và 390×844

Không làm ở v1:

- Kéo thả nhân viên thủ công
- Tự điều khiển 1 nhân vật
- Hạn dùng, thuế, nhân sự ca kíp sâu
- Nhiều tầng / parking / online
- Gắn chọn tướng Cute Heroes

## 8. Tiêu chí prototype đạt

Trong 90 giây đầu, người chơi phải:

1. Thấy khách tự hoạt động mà không cần học điều khiển phức tạp.
2. Tap xây/mở rộng ít nhất 1 lần vì muốn siêu thị lớn hơn.
3. Nhận ra map rộng ra sau khi xây.
4. Muốn mở thêm vì còn khu trống hoặc còn công trình khóa.
5. Chạm được cảnh báo hết hàng SKU bằng 1–2 tap, không lạc vào bảng tính.

Nếu chỉ vui vì đếm tồn kho mà không muốn xây tiếp → lệch mục tiêu prototype.

## 9. Các bước triển khai tiếp

1. **Khóa brand tạm**: tên, slogan, palette, style nhân vật.
2. **Blockout isometric xám**: sàn, 2 kệ, 1 thu ngân, 1 vùng mở rộng.
3. **Idle loop + tiền**.
4. **SKU/kho/kệ số**.
5. **Build loop**: giá xây, map nở, mốc cấp siêu thị.
6. **HUD mobile + save**.
7. **Playtest iPhone**, chỉnh nhịp tiền/giá xây trước khi vẽ đẹp.

## 10. Việc còn mở (không phá hướng đã chốt)

1. Tên brand cuối cùng?
2. Style art: tile vẽ tay, asset pack CC0, hay tự dựng hình khối isometric?
3. Tiền thu tự động hoàn toàn, hay cần tap thu tại quầy ở giai đầu?
4. Mở rộng theo ô (grid build) hay theo mốc phòng (room unlock)?
5. Có muốn mình viết tiếp đặc tả kỹ thuật file/module + backlog task code ngay không?

# My Supermarket – kế hoạch triển khai cụ thể

Kế hoạch chuyển từ ý tưởng đã chốt → prototype chơi được trên iPhone → bản đủ vui để mở rộng.

Tài liệu liên quan:

- Hướng đã chốt: [`sieu-thi-quan-ly-design.md`](./sieu-thi-quan-ly-design.md)
- Backlog task: [`my-supermarket-backlog.md`](./my-supermarket-backlog.md)

## Mục tiêu cuối cùng của giai Prototype

Có game **My Supermarket** tại `supermarket.html`, chơi được trên iPhone Safari, với:

1. Idle-tap
2. Map isometric tile vẽ tay
3. Xây / mở rộng theo ô lưới
4. Tồn kho SKU chi tiết
5. Tap thu tiền lúc đầu, nâng cấp mới auto-collect
6. Trong ~90 giây người chơi muốn xây lớn thêm

## Nguyên tắc làm việc trong kế hoạch

- Làm theo pha; mỗi pha có **đầu ra kiểm tra được**.
- Gameplay xám được chấp nhận trước art đẹp.
- Không pha scope: chưa làm tự điều khiển nhân vật, multi-floor, online, hạn dùng.
- Push thẳng `main`.
- Mỗi pha xong phải mở được trên điện thoại thật hoặc viewport iPhone.

---

## Pha 0 — Khóa sản xuất (trước code nặng)

**Trạng thái:** đã chốt trong `js/supermarket/config.js` (palette, grid 8×8 với 4×4 mở sẵn, economy, 8 SKU). URL riêng `/supermarket.html` đến hết prototype; chưa gắn thẻ `index.html`.

**Mục tiêu:** đủ thông số để không phải đoán khi code.

Việc cần làm:

1. [x] Chốt palette 5 màu + font chữ My Supermarket.
2. [x] Chốt kích thước grid khởi đầu.
3. [x] Chốt bảng giá nháp: mở ô, xây kệ, xây quầy, gói nhập hàng, auto-collect.
4. [x] Chốt 8 SKU tên/giá/cost/popularity.
5. [x] Quyết định: URL riêng đến hết prototype.

**Đầu ra:** `js/supermarket/config.js`.  
**Tiêu chí xong:** không còn câu hỏi “giá bao nhiêu / lưới bao lớn / màu gì” để bắt đầu Pha 1.

---

## Pha 1 — Khung game & map lưới

**Trạng thái:** đang chờ duyệt M1 trên điện thoại.

**Mục tiêu:** vào được thế giới My Supermarket trên iPhone.

Việc cần làm:

1. [x] Tạo `supermarket.html` + `js/supermarket/main.js` full-page.
2. [x] Shell brand: title, màu, nút **Mở cửa**, favicon placeholder.
3. [x] Engine isometric tối thiểu: quy đổi grid ↔ screen, render sàn.
4. [x] Data lưới: ô `locked / empty / occupied`.
5. [x] Camera fit portrait; chạm không làm zoom trang.

**Đầu ra:** https://giangdao-vizion.github.io/cute-3d-heroes-demo/supermarket.html  
**Tiêu chí xong:** chạy ổn trên iPhone, không lộ nền lỗi, tap được trên map.

Backlog: A1, A2, B1, B2, I1 (placeholder).

---

## Pha 2 — Vòng idle kiếm tiền (tap thu)

**Mục tiêu:** có cảm giác “siêu thị đang chạy” và tay phải tap thu tiền.

Việc cần làm:

1. Catalog buildables: kệ, quầy thu ngân, kho.
2. Đặt sẵn layout mẫu: 1 cửa, 2 kệ, 1 quầy, 1 kho.
3. Khách idle: vào → lấy hàng giả lập → xếp hàng → trả tiền.
4. Money stack tại quầy; **bắt buộc tap mới vào ví**.
5. HUD tiền + tốc độ x1/x2.

**Đầu ra:** chơi 30–60 giây chỉ để nhìn khách và tap thu tiền.  
**Tiêu chí xong:** không cần hướng dẫn dài vẫn hiểu phải tap vào đống tiền.

Backlog: C1, E1, E2, F1, G1 (phần tiền/tốc độ).

---

## Pha 3 — Xây lớn theo ô lưới

**Mục tiêu:** chứng minh thesis prototype: muốn xây để map lớn hơn.

Việc cần làm:

1. Nút **Xây**: chọn kệ/quầy → tap ô `empty`.
2. Nút **Mở ô**: `locked` kề vùng đã mở → trả tiền → `empty`.
3. Giá tăng dần theo tiến độ.
4. Store Level theo số ô/công trình.
5. Feedback rõ: map rộng hơn, toast lên cấp.

**Đầu ra:** từ tiền tap-thu có thể mở ô và đặt thêm kệ.  
**Tiêu chí xong:** trong ~90 giây, người chơi tự muốn mở rộng ít nhất 1 lần.

Backlog: B3, C2, C3, G2.

---

## Pha 4 — Tồn kho SKU thật

**Mục tiêu:** hàng hóa có số, nhưng vẫn idle-tap (không Excel).

Việc cần làm:

1. 8 SKU với `stock / shelf / shelfCap / cost / price`.
2. Đặt hàng 1 tap theo gói đề xuất.
3. Restock 1 tap: kho → kệ.
4. Khách chỉ lấy được SKU còn `shelf > 0`.
5. Bubble hết hàng trên kệ; thiếu hàng thì khách bỏ qua/bực nhẹ.

**Đầu ra:** hết hàng làm chậm doanh thu; tap restock/đặt hàng phục hồi.  
**Tiêu chí xong:** người chơi hiểu kho qua bubble + 1 bottom sheet đơn giản, không nhập số tay.

Backlog: D1, D2, D3 (sheet có thể để cuối pha).

---

## Pha 5 — Nâng cấp auto-collect + save + cứng iPhone

**Mục tiêu:** đủ thành prototype v1 “chơi lại được”.

Việc cần làm:

1. Shop nâng cấp **Auto Collect** (giá cao, mua sau giai tap tay).
2. Save/load `localStorage` (`mysupermarket.save.v1`).
3. Hard-cap khách/FX; giữ ≥30 FPS.
4. Checklist 360×640 và 390×844.
5. Reset tiến trình.

**Đầu ra:** prototype v1 hoàn chỉnh theo định nghĩa trong backlog.  
**Tiêu chí xong:** tắt mở lại vẫn còn tiến trình; có đường tắt tap-thu bằng auto-collect.

Backlog: F2, H1, K1, K2, G1/G2 hoàn thiện.

---

## Pha 6 — Art tile vẽ tay + nhân viên + tune

**Mục tiêu:** từ prototype xám → bản trông đúng brand và mượt nhịp.

Việc cần làm:

1. Thay placeholder bằng tile/building/SKU/nhân vật vẽ tay.
2. Logo & icon app My Supermarket sạch.
3. Nhân viên restock tự động (thuê bằng tiền).
4. Onboarding 3 hint ngắn.
5. Tune economy theo playtest: thời điểm mở ô đầu, thời điểm mua auto-collect.

**Đầu ra:** bản demo công khai được.  
**Tiêu chí xong:** nhìn nhận ra brand; loop 3–5 phút vẫn muốn mở thêm aisle.

Backlog: I2, I3, J1, G3, K3, F3.

---

## Pha 7 — Sau prototype (chỉ khi Pha 5–6 đạt)

Làm lần lượt, không song song ồ ạt:

1. Thêm aisle theme / khu mới.
2. Nhiều loại khách hơn, sự kiện giờ cao điểm.
3. Quầy 2, decorator, mục tiêu ngày/sao.
4. Gắn thẻ đẹp trên sảnh `index.html` (nếu chưa làm).
5. Âm thanh, hiệu ứng bay tiền, meta dài hạn.

---

## Lộ trình thực thi đề xuất theo mốc kiểm tra

| Mốc | Kết quả mang ra xem |
|---|---|
| M1 | Mở `supermarket.html` thấy lưới My Supermarket |
| M2 | Tap thu tiền từ khách idle |
| M3 | Mở ô + xây kệ, map lớn rõ |
| M4 | 8 SKU stock/shelf hoạt động |
| M5 | Auto-collect + save + ổn iPhone = **Prototype v1** |
| M6 | Art tay + nhân viên + tune = **Demo public** |

## Thứ tự ưu tiên nếu phải cắt scope

Giữ lại trước:

1. Tap thu tiền
2. Mở ô / xây lưới
3. Khách idle
4. Save

Cắt sau nếu thiếu lực:

1. Panel kho đẹp
2. Nhân viên
3. Art final
4. Onboarding
5. Thẻ trên home Cute Heroes

## Cách dùng kế hoạch này

1. Làm lần lượt Pha 0 → 5 để có Prototype v1.
2. Mỗi pha tick task tương ứng trong [`my-supermarket-backlog.md`](./my-supermarket-backlog.md).
3. Không sang pha sau nếu tiêu chí xong của pha hiện tại chưa đạt.
4. Khi bắt đầu code Pha 1, cập nhật README bằng link `/supermarket.html`.

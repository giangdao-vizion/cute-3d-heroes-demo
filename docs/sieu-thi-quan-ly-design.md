# My Supermarket – hướng đã chốt

Tài liệu khóa quyết định sản phẩm trước khi làm prototype. Mục tiêu thiết bị: iPhone, giao diện dọc trước.

## 1. Quyết định đã khóa

| Hạng mục | Chốt |
|---|---|
| Brand | **My Supermarket** (brand riêng, không dùng nhận diện Cute Heroes) |
| Hướng chơi | **Idle-tap**: khách/nhân viên tự chạy; người chơi tap để thu tiền, đặt hàng, restock, xây |
| Góc nhìn | **Isometric 2.5D**, art **tile vẽ tay** |
| Mục tiêu prototype | Chứng minh cảm giác **xây lớn** trên lưới ô |
| Mở rộng | **Theo ô lưới (grid build)** |
| Thu tiền | **Tap thu lúc đầu**; nâng cấp mới mở **thu tự động** |
| Hàng hóa | **Tồn kho chi tiết theo SKU** |
| Trang | `supermarket.html` + `js/supermarket/` |
| Backlog kỹ thuật | [`my-supermarket-backlog.md`](./my-supermarket-backlog.md) |
| Kế hoạch triển khai | [`my-supermarket-plan.md`](./my-supermarket-plan.md) |

## 2. Cách đọc các quyết định cùng lúc

Idle-tap + tồn kho chi tiết dễ thành “bảng tính”. Cách hòa giải:

- Tồn kho **có số thật** (SKU, sức chứa, giá nhập/bán, số lượng).
- Người chơi **không nhập số tay**. Chủ yếu tap: Đặt hàng, Bổ sung kệ, Mở SKU mới, Nâng sức chứa, Xây ô.
- Hệ thống tự trừ kho/kệ khi khách mua.
- Cảnh báo bằng bubble `!` / `Hết hàng` trên isometric.

Thu tiền:

1. Ban đầu tiền nằm thành stack tại quầy / điểm thu; phải **tap để thu**.
2. Nâng cấp `Auto Checkout` / `Auto Collect` mới tự cộng tiền theo tick.
3. Prototype phải làm người chơi cảm thấy tap thu thú vị ở phút đầu, rồi muốn mua auto.

Prototype ưu tiên **xây lớn theo lưới**:

1. Kiếm tiền (tap thu).
2. Mở/unlock ô hoặc đặt công trình lên ô trống.
3. Map isometric rộng/dày hơn ngay lập tức.
4. Muốn mở tiếp vì còn ô khóa hoặc còn slot xây.

## 3. Brand: My Supermarket

- Tên chính thức: **My Supermarket**
- Tách logo, favicon, màu, font khỏi Cute Heroes
- Có thể xuất hiện như thẻ game độc lập trên sảnh, nhưng runtime/art/UI riêng
- Tone: siêu thị mini sạch, dễ thương, tay vẽ; màu lạnh + điểm nhấn vàng giá
- Slogan tạm: **Build your aisle empire.**

Còn lại ở bước art direction ngắn:

1. Palette 5 màu cụ thể
2. Nét vẽ tile (độ dày outline, shadow mềm)
3. Tỷ lệ nhân vật so với kệ

## 4. Vòng chơi idle-tap

### Vòng 5–15 giây

- Khách spawn → kệ → lấy SKU còn hàng → xếp hàng → để tiền tại điểm thu → ra về
- Người chơi tap stack tiền để thu
- Tap nhanh phụ: restock SKU đỏ, mở panel xây

### Vòng 30–90 giây

- Mua thêm 1 kệ trên ô trống / mở khóa 1 ô biên
- Đặt đơn nhập hàng (gói đề xuất 1 tap)
- Thấy map có thêm nội thất / diện tích

### Vòng 3–10 phút

- Mở thêm hàng ô (aisle mới)
- Thuê nhân viên restock idle
- Mua nâng cấp thu tiền tự động
- Đạt mốc **Store Level 2**

## 5. Lưới xây dựng

- Bản đồ là grid isometric (ví dụ khởi đầu 6×6 ô usable).
- Mỗi ô có trạng thái: `locked` | `empty` | `occupied` | `blocked`.
- Xây = chọn loại công trình → tap ô hợp lệ.
- Mở rộng = trả tiền để `locked → empty` ở các ô biên.
- Công trình v1: floor/aisle, shelf, checkout, stockroom, decor nhẹ.

## 6. Tồn kho chi tiết (SKU)

Mỗi SKU có tối thiểu:

- `id`, tên, danh mục
- `cost`, `price`
- `stock` (kho)
- `shelf` (trên kệ)
- `shelfCap`
- `popularity`

Luồng: Đặt hàng → vào `stock` → Restock → `shelf` → khách mua trừ `shelf` → cộng tiền chờ thu.

Prototype v1: 8 SKU / 3 danh mục / 1 kho chung. Chưa làm hạn dùng.

## 7. Tài nguyên art tile vẽ tay

| Nhóm | Prototype tối thiểu |
|---|---|
| Tile sàn/tường | 4–6 biến thể sàn, 2 tường, 1 cửa |
| Buildables | Kệ đơn, kệ đôi, quầy thu ngân, kho, ô khóa |
| SKU | 8 icon hàng + trạng thái đầy/vơi trên kệ |
| Nhân vật | 3 khách + 1 thu ngân + 1 restock (spritesheet walk/idle) |
| UI/brand | Logo My Supermarket, nút Xây/Kho/Tốc độ, stack tiền tap được |

## 8. Phạm vi prototype v1

- [ ] Shell brand My Supermarket
- [ ] Grid isometric vẽ tay (xám được chấp nhận nếu chưa có bản vẽ final)
- [ ] Idle khách + stack tiền tap-to-collect
- [ ] 8 SKU + kho + kệ số
- [ ] Xây trên ô + mở khóa ô biên
- [ ] 1 nâng cấp auto-collect
- [ ] Save localStorage
- [ ] iPhone 360×640 và 390×844

Không làm ở v1: kéo thả nhân viên, tự điều khiển nhân vật, hạn dùng, multi-floor, online, chọn tướng Cute Heroes.

## 9. Tiêu chí prototype đạt

Trong 90 giây đầu:

1. Khách tự chạy, dễ hiểu không cần tutorial dài.
2. Phải tap thu tiền ít nhất vài lần và thấy thỏa mãn.
3. Xây/mở ô ít nhất 1 lần vì muốn siêu thị lớn hơn.
4. Nhận ra lưới rộng/dày hơn sau khi xây.
5. Hết hàng xử lý được bằng 1–2 tap.

## 10. Việc còn mở nhỏ

1. Palette 5 màu + font brand.
2. Kích thước grid khởi đầu và giá mở ô.
3. Auto-collect là nâng cấp quầy hay nâng cấp cửa hàng?
4. Có gắn thẻ vào `index.html` ngay từ spike hay để URL riêng đến khi ổn?

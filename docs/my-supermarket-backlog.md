# My Supermarket – backlog task kỹ thuật

Backlog triển khai theo hướng đã chốt trong [`sieu-thi-quan-ly-design.md`](./sieu-thi-quan-ly-design.md).

Quy ước:

- Ưu tiên **P0** phải có trước khi gọi là prototype chơi được.
- **P1** làm ngay sau khi loop xây lớn ổn.
- **P2** để sau playtest.
- Mỗi task nên merge/push thẳng `main` theo `AGENTS.md`.
- Target: iPhone portrait, chạm lớn, không phụ thuộc runtime Cute Heroes.

## Epic A — Skeleton dự án & brand shell

### A1. Tạo trang và module riêng `[P0]`

- [ ] Thêm `supermarket.html` full-page (không iframe).
- [ ] Thêm `js/supermarket/main.js` entry.
- [ ] CSS riêng: `html, body { width:100%; height:100%; }`, canvas/stage fixed full viewport.
- [ ] Safe-area, `touch-action`, chặn double-tap zoom như các game mobile hiện có.
- [ ] Chạy độc lập tại `/supermarket.html`.

### A2. Brand My Supermarket `[P0]`

- [ ] Title / theme-color / apple meta riêng.
- [ ] Favicon + apple-touch-icon placeholder mang chữ hoặc mark **My Supermarket**.
- [ ] Biến CSS brand (`--ms-ink`, `--ms-bg`, `--ms-accent`, `--ms-money`, `--ms-shelf`).
- [ ] Màn mở đầu tối giản: logo chữ, nút **Mở cửa**, không dùng UI Cute Heroes.

### A3. (Tuỳ chọn sớm) Lối vào từ sảnh `[P1]`

- [ ] Thẻ game trên `index.html` trỏ sang `supermarket.html`.
- [ ] Không preload art/module siêu thị khi đứng ở home.

## Epic B — Nền tảng isometric grid

### B1. Camera & map stage `[P0]`

- [ ] Stage canvas hoặc DOM/canvas hybrid cho isometric.
- [ ] Chuyển toạ độ `grid(x,y) ↔ screen`.
- [ ] Pan nhẹ trong biên; fit map vào iPhone dọc.
- [ ] Zoom cố định v1 (hoặc 2 mức), ưu tiên đọc được ô xây.

### B2. Mô hình lưới `[P0]`

- [ ] Data `Grid`: width/height, cell state `locked|empty|occupied|blocked`.
- [ ] Grid khởi đầu nhỏ (đề xuất `6×6` usable + vành locked).
- [ ] Render tile sàn theo state.
- [ ] Highlight ô hợp lệ khi đang chế độ xây.

### B3. Mở rộng theo ô `[P0]`

- [ ] Action **Mở ô**: chỉ các ô `locked` kề `empty/occupied`.
- [ ] Trừ tiền, đổi `locked → empty`, phát FX đơn giản.
- [ ] Giá mở ô tăng theo số ô đã mở.
- [ ] Camera/map cảm nhận được diện tích lớn hơn sau mỗi lần mở.

## Epic C — Công trình xây trên lưới

### C1. Catalog buildables `[P0]`

- [ ] Định nghĩa: `shelf`, `checkout`, `stockroom`, `floor_decor` (decor có thể P1).
- [ ] Mỗi loại: footprint (1×1 trước), giá, cấp, sprite key.
- [ ] Rule ô đặt được (ví dụ checkout gần lối ra).

### C2. Đặt / nâng cấp công trình `[P0]`

- [ ] UI nút **Xây** → chọn loại → tap ô.
- [ ] Lưu `buildingId` vào cell `occupied`.
- [ ] Nâng cấp shelf/checkout in-place (cap hàng, tốc độ thu).
- [ ] Không cho chồng footprint ở v1.

### C3. Nhịp “xây lớn” `[P0]`

- [ ] Mốc Store Level theo số ô đã mở + số công trình.
- [ ] Toast/banner khi lên cấp cửa hàng.
- [ ] Ít nhất 2 lần mở rộng rõ trong 90 giây đầu với economy mặc định.

## Epic D — SKU, kho, kệ

### D1. Data SKU `[P0]`

- [ ] 8 SKU / 3 category (Drinks, Snacks, Fresh).
- [ ] Field: `id,name,category,cost,price,stock,shelf,shelfCap,popularity,icon`.
- [ ] File data tách `js/supermarket/catalog.js`.

### D2. Kho & restock `[P0]`

- [ ] `stockroom` quyết định `stockCap` tổng hoặc theo category.
- [ ] Action **Đặt hàng**: mua gói đề xuất 1 tap (không nhập số).
- [ ] Timer giao hàng ngắn → cộng `stock`.
- [ ] Action **Restock**: chuyển `stock → shelf` theo shelf còn chỗ.
- [ ] Bubble `!` trên kệ khi `shelf=0`.

### D3. Panel kho mobile `[P1]`

- [ ] Bottom sheet danh sách SKU: stock/shelf/cap/giá.
- [ ] Tap nhanh Đặt hàng / Restock từng dòng.
- [ ] Không dùng bảng phức tạp kiểu desktop.

## Epic E — Khách idle & thanh toán

### E1. Customer agent `[P0]`

- [ ] Spawn theo rate dựa Store Level.
- [ ] State machine: `enter → shop → queue → pay → leave` (+ `leaveAngry` đơn giản).
- [ ] Path waypoint theo aisle/grid, hard-cap số khách trên sàn.
- [ ] Chọn 1–N SKU theo `popularity` và `shelf>0`.

### E2. Checkout queue `[P0]`

- [ ] Mỗi `checkout` có hàng đợi.
- [ ] Thời gian thanh toán theo cấp quầy.
- [ ] Khi pay xong: tạo **money stack** tại quầy, chưa cộng vào ví nếu chưa có auto-collect.

### E3. Cảm xúc/feedback nhẹ `[P1]`

- [ ] Icon kiên nhẫn / giận khi chờ lâu hoặc thiếu hàng.
- [ ] Khách bỏ đi trừ điểm trải nghiệm (chưa cần sâu).

## Epic F — Thu tiền: tap trước, auto sau

### F1. Tap-to-collect `[P0]`

- [ ] Money stack có hit area lớn trên quầy.
- [ ] Tap cộng tiền vào ví, floating text `+$`.
- [ ] Stack cộng dồn nếu chưa thu; visual scale theo số tiền đang chờ.
- [ ] Âm thanh/rung nhẹ optional P2.

### F2. Nâng cấp auto-collect `[P0]`

- [ ] Upgrade item trong shop: **Auto Collect**.
- [ ] Khi sở hữu: tiền pay xong vào ví ngay (hoặc thu định kỳ không cần tap).
- [ ] Giá đủ cao để phút đầu vẫn phải tap.
- [ ] UI trạng thái: đang tay thu / đã auto.

### F3. Economy tuning pass `[P1]`

- [ ] Bảng giá: SKU margin, mở ô, xây kệ, auto-collect.
- [ ] Đảm bảo trong 60–90s có thể mở ≥1 ô hoặc xây ≥1 kệ nếu tap đều.
- [ ] Tránh tiền dư làm mở full map quá sớm.

## Epic G — HUD & input mobile

### G1. HUD lõi `[P0]`

- [ ] Top: tiền, store level.
- [ ] Bottom: **Xây**, **Kho**, **Tốc độ x1/x2**.
- [ ] Nút không bị tay che; hỗ trợ safe-area.
- [ ] Không overlay dày kiểu dashboard.

### G2. Build mode UX `[P0]`

- [ ] Vào build mode làm mờ HUD phụ, hiện giá trên ô.
- [ ] Hủy bằng nút X hoặc tap ngoài.
- [ ] Feedback ô không hợp lệ rõ ràng.

### G3. Onboarding cực ngắn `[P1]`

- [ ] 3 hint lần đầu: tap thu tiền → đặt hàng/restock → mở ô/xây.
- [ ] Không modal dài.

## Epic H — Save / load

### H1. Local save `[P0]`

- [ ] Key riêng, ví dụ `mysupermarket.save.v1`.
- [ ] Lưu: tiền, grid states, buildings, sku stocks, upgrades, store level.
- [ ] Autosave theo interval + khi thay đổi lớn.
- [ ] Nút reset tiến trình ở settings đơn giản.

## Epic I — Art tile vẽ tay

### I1. Pipeline art `[P0]`

- [ ] Quy ước kích thước tile isometric và origin chân tile.
- [ ] Thư mục `img/supermarket/tiles/`, `buildings/`, `sku/`, `chars/`, `ui/`.
- [ ] Placeholder vẽ tay đơn sắc chấp nhận được cho spike gameplay.

### I2. Bộ tile tối thiểu `[P0]`

- [ ] Floor empty / locked / highlight.
- [ ] Shelf, checkout, stockroom.
- [ ] 8 SKU icons.
- [ ] 1 money stack sprite.

### I3. Nhân vật & polish art `[P1]`

- [ ] Spritesheet walk/idle cho khách và nhân viên.
- [ ] Biến thể màu khách.
- [ ] Logo + icon app My Supermarket bản sạch.

## Epic J — Nhân viên idle

### J1. Restocker tự động `[P1]`

- [ ] Thuê nhân viên: tự restock định kỳ khi có `stock` và kệ trống.
- [ ] Không cần kéo thả.

### J2. Cashier speed / second checkout `[P1]`

- [ ] Giảm thời gian pay hoặc cho phép 2 quầy.
- [ ] Tương thích queue hiện có.

## Epic K — Playtest & perf iPhone

### K1. Perf budget `[P0]`

- [ ] Hard-cap khách/FX.
- [ ] Không alloc nặng mỗi frame.
- [ ] Mục tiêu ≥30 FPS trên iPhone tầm trung.

### K2. Checklist thiết bị `[P0]`

- [ ] Viewport 360×640 và 390×844.
- [ ] Tap targets ≥44px.
- [ ] Không lộ nền trắng / layout vỡ khi address bar Safari đổi.

### K3. Telemetry thủ công playtest `[P1]`

- [ ] Ghi thời điểm lần xây/mở ô đầu.
- [ ] Ghi thời điểm mua auto-collect.
- [ ] Điều chỉnh giá theo dữ liệu playtest nội bộ.

## Thứ tự làm đề xuất (sprint mỏng)

1. **A1 + A2 + B1 + B2** — vào được map lưới brand riêng.
2. **C1 + C2 + F1 + E1 + E2** — xây được, khách mua, tap thu tiền.
3. **D1 + D2 + B3 + C3** — kho SKU + mở ô + cảm giác xây lớn.
4. **F2 + G1 + G2 + H1 + K1/K2** — auto-collect, HUD, save, bắt được trên iPhone.
5. **I3 + J1 + D3 + G3 + K3** — art sạch, nhân viên, panel kho, onboarding, tune.

## Định nghĩa xong Prototype v1

Prototype được coi là xong khi:

- Chơi được trên iPhone Safari qua `supermarket.html`.
- Có brand My Supermarket riêng.
- Có grid mở ô + đặt kệ/quầy.
- Có 8 SKU với stock/shelf thật.
- Tap thu tiền bắt buộc lúc đầu; mua được auto-collect.
- Trong ~90 giây, người chơi tự muốn mở rộng thêm ít nhất một lần.

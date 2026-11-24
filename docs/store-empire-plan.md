# Store Empire – kế hoạch triển khai

Game riêng, **không** liên quan bản test `supermarket.html` / `js/supermarket/`.
Nguồn yêu cầu: "Store Empire" original spec + "Scope Update V2.0" (V2 thay phần hình ảnh và kiến trúc: 3D isometric thay cho Phaser 2D).

## Quyết định đã chốt (24-11-2026)

| Chủ đề | Quyết định |
| --- | --- |
| Stack | React + TypeScript + Vite + Three.js + React Three Fiber + Drei + Zustand + Dexie + vite-plugin-pwa |
| Vị trí | Source: `store-empire-src/`. Build (`base: './'`) ra `store-empire/`, commit bản build. Không đổi cấu hình GitHub Pages |
| Vào game | Nút thứ 4 trên `index.html` → `store-empire/` (mở full-page như Sinh tồn) |
| PWA | Manifest + service worker riêng, scope chỉ trong `store-empire/` (không cache game khác) |
| Asset | Chỉ asset miễn phí (CC0). Thiếu thì tạo bằng Gemini trên Vertex AI (credit GCP) |
| Thiết bị | iPhone trước, portrait, chạm một tay |

## Asset (đã tải và kiểm tra 24-11-2026)

- Đang dùng: Kenney Mini Shop 2.1 (29 model: kệ có từng món hàng tách riêng, quầy, tủ đông, tường, hàng rào, cổng có animation mở/đóng, nhân viên) và Kenney Mini Characters 2.0 (20 nhân vật, 32 clip: idle, walk, sprint, pick-up, interact, holding-both, emote...). Cùng texture atlas, cùng phong cách. Nằm ở `store-empire-src/public/models/`.
- Tải Kenney phải qua trình duyệt (link ký tên theo phiên); curl bị 403.
- Dự phòng: Quaternius Universal Base Characters (CC0, rig humanoid, 20 kiểu tóc).
- Animation thiếu (restock, cleaning, cashier): lấy từ Quaternius Universal Animation Library 1/2 (CC0, >250 clip một rig) nếu retarget được; nếu không, ghép từ clip có sẵn (interact, pick up) + chuyển động đạo cụ bằng code.
- Chưa tải (Phase 1, khi cần 15–20 sản phẩm và thêm đồ trang trí): Kenney Food Kit, Kenney Furniture Kit (CC0).
- Gemini (Vertex AI) chỉ tạo ảnh: texture, nhãn sản phẩm, icon HUD, avatar. Gemini không tạo được model 3D có rig.
- Mỗi gói lưu file LICENSE cạnh model, ghi nguồn vào `README.md`.
- Không trộn với KayKit fantasy / Quaternius quái vật đang dùng ở các mode khác.

## Phase 0 – prototype hình ảnh (cần duyệt trước khi làm tiếp)

Mục tiêu: chứng minh hướng 3D trên iPhone thật, chưa có hệ thống kinh tế.

1. Khung project Vite + R3F, build ra `store-empire/`, nút trên index.
2. Camera orthographic isometric (~40°), pan một ngón, pinch zoom, giới hạn biên.
3. Một cửa hàng nhỏ hoàn chỉnh: sàn, tường, cửa, cửa sổ, kệ có hàng, quầy thu ngân, kho, đồ trang trí. Bố cục lấy từ file config, không hard-code.
4. Nhân vật chính: chạm vào sàn để đi tới (tìm đường trên lưới), idle/walk/run. Có vòng sáng đánh dấu để khác NPC.
5. Ít nhất 3 NPC: 2 khách (vào cửa → xem kệ → quầy → ra cửa), 1 nhân viên thu ngân.
6. Vật thể tương tác: chạm kệ/quầy/thùng hàng → nhân vật đi tới, chạy animation làm việc, có phản hồi (số bay, rung nhẹ).
7. HUD mobile: thanh trên (level, tiền, XP, chức danh), dock dưới 5 tab (Store, Tasks, Employees, Character, Business); tab chưa có tính năng hiện trạng thái khóa, không phải nút giả.
8. Hiệu năng: đo FPS trên iPhone, chế độ chất lượng tự động (tắt bóng / giảm pixel ratio khi chậm).

Logic mô phỏng (vị trí, trạng thái NPC, tìm đường) nằm trong `src/sim/` bằng TypeScript thuần; R3F chỉ đọc state để vẽ.

### Tiêu chí nghiệm thu Phase 0

10 tiêu chí trong mục 10 của Scope V2. Kiểm tra trên trình duyệt desktop (giả lập iPhone) và anh thử trên iPhone thật trước khi qua Phase 1.

## Trạng thái Phase 0 (24-11-2026)

Đã làm và kiểm tra trên Chrome giả lập iPhone 390×844:
1. Cửa hàng 3D hoàn chỉnh từ `layout.ts` – có.
2. Camera isometric 40°, pan 1 ngón, pinch zoom, giới hạn biên – có (pinch chưa thử trên máy thật).
3. Nhân vật chính điều khiển bằng chạm, đi theo A* – có.
4. Idle / walk / sprint / pick-up / interact / ôm thùng (chân đi + tay giữ) / ăn mừng – có.
5. NPC: 1 thu ngân + tối đa 4 khách cùng lúc – có.
6. Khách: vào cổng → kệ → lấy hàng (hết hàng thì lắc đầu) → xếp hàng → trả tiền → ra cổng – có, không spawn giữa sàn.
7. Vật thể tương tác: kho → lấy thùng, kệ → bổ sung, quầy, nảy khi chạm – có.
8. Chạm trên mobile – có (giả lập touch).
9. HUD mobile: level, XP, lương, chức danh, mục tiêu, doanh thu, dock 5 tab (2 tab khoá có lý do) – có.
10. Ổn định trên điện thoại thật – **chưa kiểm**, cần Giang thử trên iPhone.

Biết trước: JS bundle 1,2 MB (343 KB gzip) do drei; nhân viên và người chơi dùng hai model khác nhau, người chơi có vòng vàng.

## Phase 1 trở đi

Phase 1: Employee → Store Manager (task, XP, lương, kho, khách, tuyển và giao việc nhân viên, nâng cấp cửa hàng có thay đổi hình ảnh, thăng chức, save Dexie, offline progress, export/import JSON). Lập backlog chi tiết sau khi Phase 0 được duyệt.
Phase 2–4: làm chủ cửa hàng, nhiều cửa hàng, hệ thống nâng cao (theo spec gốc).

# Cute 3D Heroes – demo chọn nhân vật

Demo web 3D (Three.js) để xem và chọn nhân vật chibi cho một game kiểu MOBA/arena.

- **Showroom:** 24 nhân vật đứng trên sân khấu, bấm vào từng con để xem toàn bộ animation, chọn tướng, thú cưng, boss và các loại quái.
- **Chơi thử:** điều khiển tướng đã chọn, đánh các đợt quái, đợt 5, 10, 15... có boss.

## Chạy

Bấm đúp `start.command`, hoặc:

```bash
cd cute-3d-demo && python3 -m http.server 8790
# mở http://localhost:8790
```

Cần internet lần đầu để tải Three.js và font từ CDN. Model nằm sẵn trong `models/`.

Điều khiển: bấm chuột lên đất để đi, bấm vào quái để đánh, WASD cũng đi được, `Q` chiêu xoay, `Space` lướt.

## Nguồn model (tất cả CC0, dùng thương mại được, không bắt buộc ghi công)

| Bộ | Tác giả | Có gì | Link gốc |
|---|---|---|---|
| Adventurers Character Pack 1.0 | Kay Lousberg (KayKit) | Hiệp sĩ, Chiến binh rìu, Pháp sư, Sát thủ x2, ~75 animation mỗi con | https://kaylousberg.itch.io/kaykit-adventurers |
| Skeletons Character Pack 1.0 | Kay Lousberg (KayKit) | 4 quái xương, ~95 animation | https://kaylousberg.itch.io/kaykit-skeletons |
| Platformer Game Kit | Quaternius | Bé tròn, Quái mầm xanh, Đầu lâu, Ong | https://quaternius.com/packs/ultimateplatformer.html |
| Easy Enemy Pack | Quaternius | Ếch, Chuột, Nhện, Ong vò vẽ, Rắn | https://quaternius.com/packs/easyenemy.html |
| Animated Dinosaur Pack | Quaternius | T-Rex, Khủng long sừng, Raptor | https://quaternius.com/packs/animateddinosaurs.html |
| Ultimate Animated Animals | Quaternius | Shiba, Cáo, Husky | https://quaternius.com/packs/ultimateanimatedanimals.html |

File GLB lấy từ GitHub: `KayKit-Game-Assets/KayKit-Character-Pack-*-1.0` và bản GLB đã chuyển sẵn ở `trebeljahr/quaternius-showcase`.

## Cấu trúc

- `js/catalog.js` – danh sách model, vai trò, chỉ số, tên animation. Thêm model mới chỉ cần thêm một dòng ở đây.
- `js/engine.js` – tải GLB, chuẩn hoá chiều cao, điều khiển animation, cây/đá trang trí.
- `js/gallery.js` – showroom. `js/game.js` – game. `js/state.js` – lựa chọn lưu trong localStorage.

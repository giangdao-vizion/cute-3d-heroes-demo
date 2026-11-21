# Cute 3D Heroes

Demo web 3D (Three.js) gồm nhiều chế độ game với nhân vật chibi.

- **Trang chủ:** chọn tướng bằng giao diện 2D tối ưu cho điện thoại và chọn chế độ chơi. Model 3D chỉ được tải sau khi bắt đầu game.
- **Chơi thử:** điều khiển tướng đã chọn, đánh các đợt quái, đợt 5, 10, 15... có boss.
- **Giữ cổng (vô tận):** tướng đứng cuối cây cầu, tự bắn, quái tràn tới mãi. Bắn hòm nhận quà, chọn cổng số (+lính, +% tốc bắn), lên cấp chọn thẻ, boss mỗi 5 đợt, sao để nâng cấp vĩnh viễn. Mở thẳng: `http://localhost:8790/#defense`. Thiết kế: `docs/giu-cong-design.md`.
- **Đấu trường sinh tồn:** di chuyển tự do, tự động tấn công, nhặt ngọc kinh nghiệm và chọn nâng cấp khi lên cấp. Mở thẳng: `http://localhost:8790/survivor-arena.html`. Thiết kế: `docs/dau-truong-sinh-ton-design.md`.

**Bản online:** https://giangdao-vizion.github.io/cute-3d-heroes-demo/ (GitHub Pages, repo `giangdao-vizion/cute-3d-heroes-demo`, public). Cập nhật: commit + `git push`, Pages tự build lại sau khoảng 1 phút.

## Chạy

Bấm đúp `start.command`, hoặc:

```bash
cd cute-3d-demo && python3 -m http.server 8790
# mở http://localhost:8790
```

Cần internet lần đầu để tải Three.js và font từ CDN. Model nằm sẵn trong `models/`.

Điều khiển Giữ cổng: rê chuột / kéo ngón tay (hoặc A, D) để đi trái phải, `Space` mưa sao băng, `P` tạm dừng, `1 2 3` chọn thẻ.

Điều khiển Chơi thử: bấm chuột lên đất để đi, bấm vào quái để đánh, WASD cũng đi được, `Q` chiêu xoay, `Space` lướt.

Điều khiển Đấu trường sinh tồn: kéo trên màn hình hoặc dùng WASD/phím mũi tên để di chuyển, tướng tự động tấn công. `P` hoặc `Esc` để tạm dừng, `1 2 3` để chọn thẻ.

## Nguồn model (tất cả CC0, dùng thương mại được, không bắt buộc ghi công)

| Bộ | Tác giả | Có gì | Link gốc |
|---|---|---|---|
| Adventurers Character Pack 1.0 | Kay Lousberg (KayKit) | Hiệp sĩ, Chiến binh rìu, Pháp sư, Sát thủ x2, ~75 animation mỗi con | https://kaylousberg.itch.io/kaykit-adventurers |
| Skeletons Character Pack 1.0 | Kay Lousberg (KayKit) | 4 quái xương, ~95 animation | https://kaylousberg.itch.io/kaykit-skeletons |
| Platformer Game Kit | Quaternius | Bé tròn, Quái mầm xanh, Đầu lâu, Ong | https://quaternius.com/packs/ultimateplatformer.html |
| Easy Enemy Pack | Quaternius | Ếch, Chuột, Nhện, Ong vò vẽ, Rắn | https://quaternius.com/packs/easyenemy.html |
| Animated Dinosaur Pack | Quaternius | T-Rex, Khủng long sừng, Raptor | https://quaternius.com/packs/animateddinosaurs.html |
| Ultimate Animated Animals | Quaternius | Shiba, Cáo, Husky | https://quaternius.com/packs/ultimateanimatedanimals.html |
| Dungeon Remastered 1.0 | Kay Lousberg (KayKit) | Rương, chồng vàng, khiên kiếm (icon + hòm quà trong Giữ cổng) | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0 |
| Platformer Game Kit, Modular Weapons, Modular Dungeon | Quaternius | Sao, ngọc, tim, bom, kiếm vàng, khiên, đầu lâu, bình thuốc (icon) | https://quaternius.com/packs/ultimateplatformer.html |
| Sunfall Rift – Ember projectile | 3DAssets.dev | Model cầu lửa GLB 56 tam giác dùng trong Đấu trường sinh tồn | https://3dassets.dev/assets/sunfall-rift-moba-ember-projectile-49569ecb |

File GLB lấy từ GitHub: `KayKit-Game-Assets/KayKit-Character-Pack-*-1.0` và bản GLB đã chuyển sẵn ở `trebeljahr/quaternius-showcase`.

## Cấu trúc

- `js/catalog.js` – danh sách model, vai trò, chỉ số, tên animation. Thêm model mới chỉ cần thêm một dòng ở đây.
- `js/engine.js` – tải GLB, chuẩn hoá chiều cao, điều khiển animation, cây/đá trang trí.
- `img/icons/` – icon 3D của Giữ cổng (WEBP 160px). Tạo lại bằng `tools/icon-studio.html`: mở qua server, xem lưới icon, bấm "Tải tất cả" ra PNG rồi chuyển WEBP (`cwebp -q 88 -resize 160 160`). Model nguồn ở `models/props/`; tháp, cờ, cúp, lửa, sét, bông tuyết, mũi tên, bia, nổ là hình tự dựng bằng code.
- `js/main.js` – trang chủ và bộ chọn nhân vật 2D. `js/game.js` – game arena. `js/defense.js` – chế độ Giữ cổng. `js/state.js` – lựa chọn lưu trong localStorage.
- `survivor-arena.html`, `js/survivor/` – trang và logic riêng của Đấu Trường Sinh Tồn.
- `docs/dau-truong-sinh-ton-design.md` – kế hoạch chi tiết cho game Đấu Trường Sinh Tồn 360°.
- `docs/y-tuong-game-sinh-ton.md` – backlog các game survival để nghiên cứu và triển khai sau.

# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- My Supermarket dùng góc nhìn **top-down** (nhìn thẳng từ trên xuống, ô vuông, vật thể là mặt trên). Không dùng isometric / skew giả isometric. Art tile vẽ tay; thu tiền tap-first rồi nâng cấp auto-collect.
- Không unlock từng ô. Lên **store level** thì **tự động mở cả một vùng** lớn hơn (`LEVEL_REGIONS` trong `config.js`). Level theo số công trình, không theo số ô.
- Trong My Supermarket, quầy/kệ/cửa dùng **icon minh họa** (bộ `img/supermarket/icon-*.svg`); dock xây dựng cũng icon-first, không danh sách chữ kiểu “quầy thu phí…”. Nếu còn chữ phụ (giá $), giữ tối giản.
- Luồng khách bắt buộc: **vào từ cửa → mua sắm → xếp hàng thanh toán → ra cửa rồi biến mất**. Không spawn/despawn giữa sàn.
- Sinh tồn mở full-page (`survivor-arena.html`), không dùng iframe. `html, body { width:100%; height:100%; }` và `canvas { position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; }`. Không ghi đè size canvas bằng inline style từ JS.
- Trang home (`index.html`) cũng dùng `html, body { width:100%; height:100%; }` và `body, #home { position:fixed; top/left/bottom/right:0; width/height:100%; }`. Không để `html`/`body` nền phẳng `#fff0c7` lộ thành dải trắng sữa dưới shell.
- Sinh tồn late-game: chế độ Chuẩn (thắng boss phút 10) / Endless; tiến hóa (evolve) khi skill max; biến dị (mutation) thay overflow thuần; nhiệm vụ ~90s; vũ khí phụ Dao quỹ đạo; sao meta (`cute3d.survivor.stars` / `meta`). Logic phụ trong `js/survivor/late-game.js`.
- **Store Empire** là game riêng (không phải My Supermarket): 3D isometric, source ở `store-empire-src/`, bản build ở `store-empire/`. Sửa source xong phải `npm run build` rồi commit cả hai. Logic game nằm trong `src/sim/` (TypeScript thuần), không viết logic trong component React. Chỉ dùng asset CC0 cùng phong cách Kenney Mini; làm từng phase và chờ duyệt (`docs/store-empire-plan.md`).

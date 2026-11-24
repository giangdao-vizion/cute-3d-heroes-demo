# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- My Supermarket dùng góc nhìn **top-down** (nhìn thẳng từ trên xuống, ô vuông, vật thể là mặt trên). Không dùng isometric / skew giả isometric. Art tile vẽ tay; thu tiền tap-first rồi nâng cấp auto-collect; mở rộng theo ô lưới.
- Trong My Supermarket, chữ trạng thái của ô (tồn kho, khóa, PAY, Kho…) phải nằm trong **khung/panel riêng** bên trong ô, không được đè lên chi tiết đồ họa của ô.
- Sinh tồn mở full-page (`survivor-arena.html`), không dùng iframe. `html, body { width:100%; height:100%; }` và `canvas { position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; }`. Không ghi đè size canvas bằng inline style từ JS.
- Trang home (`index.html`) cũng dùng `html, body { width:100%; height:100%; }` và `body, #home { position:fixed; top/left/bottom/right:0; width/height:100%; }`. Không để `html`/`body` nền phẳng `#fff0c7` lộ thành dải trắng sữa dưới shell.
- Sinh tồn late-game: chế độ Chuẩn (thắng boss phút 10) / Endless; tiến hóa (evolve) khi skill max; biến dị (mutation) thay overflow thuần; nhiệm vụ ~90s; vũ khí phụ Dao quỹ đạo; sao meta (`cute3d.survivor.stars` / `meta`). Logic phụ trong `js/survivor/late-game.js`.

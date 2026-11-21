# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- Full-screen Sinh tồn: `html`/`body`/`canvas`/`#survivorFrame` phải `inset:0` phủ cả màn (kèm `100dvh` / `-webkit-fill-available`). Không co canvas theo `visualViewport` rồi để nền lộ ở đáy iPhone. Nền shell + `scene.background` dùng màu cỏ (`--ground` / `#98d77d`), không dùng xanh trời.

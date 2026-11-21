# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- Sinh tồn mở full-page (`survivor-arena.html`), không dùng iframe. `html, body { width:100%; height:100%; }` và `canvas { position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; }`. Không ghi đè size canvas bằng inline style từ JS.

# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- Chiều cao full-screen phải theo `visualViewport` (`--app-height` / `--app-width` / `--app-top` / `--app-left`). Không đặt `min-height: -webkit-fill-available` sau `--app-height`, và không dùng `inset:0` cùng lúc với chiều cao cố định — sẽ lộ dải nền dưới canvas trên iPhone.

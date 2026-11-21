# Nguyên tắc làm việc

- Thiết bị mục tiêu của dự án là iPhone. Mọi thay đổi giao diện và tương tác phải ưu tiên trải nghiệm trên iPhone.
- Luôn commit và push thẳng lên nhánh `main`. Không tạo pull request, không mở nhánh feature cho công việc thường ngày.
- Khi phát sinh thêm nguyên tắc làm việc cho repository, cập nhật nguyên tắc đó vào file `AGENTS.md`.
- Full-screen Sinh tồn trên iPhone: `canvas` dùng `position:absolute; top:0; left:0; bottom:0; right:0; width:100%; height:100%` (canvas cần thêm width/height 100% vì là replaced element). Body/iframe cũng absolute `top/left/bottom/right:0`. Không ghi đè size bằng inline style từ JS.

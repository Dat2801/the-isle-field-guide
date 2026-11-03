# Sổ Tay The Isle / The Isle Field Guide

Hồ sơ song ngữ (Việt / Anh) của 36 loài khủng long trong game *The Isle*: cách sống, thức ăn, cách sinh tồn, tấn công, phòng thủ, phím điều khiển và hướng cộng mutation. Trang có phòng online: mọi người đặt biệt danh, thấy ai đang xem loài nào và nhận thông báo khi có người vào hoặc rời.

## Chạy trên máy

```bash
npm start
```

Mở http://localhost:3000. Không cần cài thư viện nào (Node.js 18 trở lên).

## Deploy lên Render

1. Đẩy repo này lên GitHub.
2. Trên Render: **New → Blueprint**, chọn repo. Render đọc `render.yaml` và tạo một Web Service miễn phí.
3. Mở link `https://<tên-dịch-vụ>.onrender.com`.

Gói miễn phí tự "ngủ" sau khoảng 15 phút không có ai truy cập; lần mở tiếp theo mất 30–60 giây để chạy lại. Danh sách người online nằm trong bộ nhớ nên phải giữ 1 instance.

## Cấu trúc

- `index.html` — toàn bộ giao diện và dữ liệu loài (dùng được cả trong Claude Artifact lẫn trên máy chủ này).
- `server.js` — phục vụ trang, ảnh và phòng online qua Server-Sent Events (`/api/events`, `/api/presence`).
- `img/` — tranh phục dựng.

## Nguồn ảnh

Tranh phục dựng lấy từ [Wikimedia Commons](https://commons.wikimedia.org) với giấy phép CC BY, CC BY-SA, CC0 hoặc public domain; tác giả và giấy phép của từng ảnh ghi trong hồ sơ mỗi loài. Ảnh Omniraptor do chủ sổ tay cung cấp, chưa rõ nguồn.

Thông tin lối chơi là tóm tắt từ cộng đồng và có thể thay đổi theo bản cập nhật của The Isle. Đây là trang của người hâm mộ, không liên quan đến nhà phát triển game.

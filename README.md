# PoseCam

App chia sẻ ảnh kiểu Locket, thêm **hướng dẫn tạo dáng**: chọn dáng có sẵn, dáng hiện mờ trên khung
chụp, app chấm điểm mức khớp theo thời gian thực, nhắc cách chỉnh và có thể tự chụp khi khớp.

- `mobile/` — app React Native CLI (TypeScript). Android build và chạy được; iOS có code nhưng cần macOS để build.
- `backend/` — FastAPI + SQLite + MediaPipe (nhận diện người và đồ vật, chấm điểm dáng).
- `poses/` — bộ sinh thư viện dáng (55 dáng tự thiết kế) và ảnh xem trước `poses/preview/*.png`.
- `docs/PLAN.md` — kế hoạch; `docs/API.md` — hợp đồng API.

## Chạy backend

```bash
./scripts/dev.sh          # cài thư viện, tải model MediaPipe nếu thiếu, chạy http://0.0.0.0:8020
cd backend && uv run pytest -q
```

## Chạy app Android

```bash
cd mobile
npm install
npx react-native start            # Metro
npx react-native run-android      # build + cài lên máy ảo / điện thoại
```

Địa chỉ server mặc định là `http://10.0.2.2:8020` (máy ảo Android nhìn thấy máy tính qua địa chỉ này).
Trên điện thoại thật, vào **Hồ sơ → Máy chủ** và nhập `http://<IP-máy-tính-trong-LAN>:8020`.

## Tính năng

- **Giống Locket:** đăng ký/đăng nhập, kết bạn theo username, camera khung vuông bo góc (flash, camera
  trước dùng flash màn hình), chụp → thêm chú thích → chọn người nhận → gửi, lịch sử vuốt dọc với emoji,
  widget Android hiện ảnh mới nhất bạn bè gửi.
- **Hướng dẫn tạo dáng:** 55 dáng chia 7 nhóm (Selfie, 1 người, 2 người, Nhóm, Đồ vật, Phong cảnh, Thú cưng)
  cùng tab **Gợi ý** theo khung hình. App gửi khung hình nhỏ lên `/analyze` khoảng 1.5 lần/giây; backend dùng
  MediaPipe tìm người (tối đa 5) và đồ vật, rồi trả về điểm khớp 0–100, chi đúng/sai và lời nhắc tiếng Việt
  ("Giơ tay bên phải cao hơn", "Ngồi xuống theo dáng mẫu", "Người ở giữa: …"). Bật **Tự chụp** thì app
  đếm ngược 3‑2‑1 và chụp khi giữ đúng dáng.

## Kiểm thử

| Phần | Lệnh | Kết quả |
|---|---|---|
| Backend | `cd backend && uv run pytest -q` | 128 test |
| App | `cd mobile && npx tsc --noEmit && npx eslint . && npx jest` | 50 test |
| APK | `cd mobile/android && ./gradlew assembleDebug` | build được |

Đã chạy trên máy ảo Android `Medium_Phone_API_36.1` với backend thật: đăng ký, kết bạn, gửi ảnh có dáng,
thả emoji, widget, chọn dáng và chấm điểm trực tiếp.

## Giới hạn

- Chấm điểm chạy trên server (khoảng 40–55 ms xử lý + độ trễ mạng); muốn mượt hơn cần chuyển nhận diện lên máy.
- Chưa có thông báo đẩy: widget làm mới 15 phút một lần và mỗi khi mở app.
- iOS chưa build (cần macOS), chưa có widget iOS.
- Lịch sử chưa có kéo-để-tải-lại (xung đột với cử chỉ vuốt dọc); thay vào đó tự tải lại khi mở lịch sử,
  mỗi 20 giây và sau khi gửi ảnh.

## Thư viện dáng

```bash
uv run --with pillow python poses/posegen.py   # sinh poses/library.json + ảnh xem trước
./scripts/sync-poses.sh                         # chép sang backend và app
```

Mỗi dáng người được mô tả bằng góc khớp hoặc vị trí bàn tay, từ đó sinh 17 điểm khung xương theo chuẩn
COCO. Dáng bố cục (phong cảnh, đồ vật, thú cưng) gồm đường dẫn hướng và các vòng đặt đồ vật.

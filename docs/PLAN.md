# PoseCam — Kế hoạch

App chia sẻ ảnh kiểu Locket (chụp nhanh, gửi cho bạn bè, ảnh hiện trên widget màn hình chính),
thêm **hướng dẫn tạo dáng**: chọn một dáng pose có sẵn, dáng hiện mờ trên khung chụp, app chấm điểm
mức khớp theo thời gian thực, nhắc cách chỉnh ("Giơ tay phải cao hơn", "Lùi ra xa") và có thể tự
chụp khi khớp. App cũng tự nhận diện khung hình (1 người, 2 người, nhóm, đồ vật, phong cảnh, thú cưng)
để gợi ý dáng phù hợp.

## 1. Quyết định chính

| Vấn đề | Lựa chọn | Lý do |
|---|---|---|
| App di động | **React Native CLI 0.88** (TypeScript), không dùng Expo | Theo yêu cầu; cần native module cho camera và widget |
| Camera | `react-native-vision-camera` v5 | Camera trước/sau, flash, zoom, snapshot nhanh từ preview |
| Vẽ dáng pose | `react-native-svg` | Dáng là dữ liệu vector, vẽ được ở mọi kích thước, tô màu từng chi |
| Backend | **FastAPI** + SQLite (SQLAlchemy 2) + JWT | Theo yêu cầu; đủ cho MVP, chạy một lệnh |
| Nhận diện | **MediaPipe** chạy trên backend: Pose Landmarker (tối đa 5 người) + Object Detector (EfficientDet-Lite0, COCO) | Mã nguồn mở Apache-2.0, chạy CPU, Python 3.13 |
| Chấm điểm khớp dáng | Trên backend, một bản cài đặt duy nhất | Không phải đồng bộ thuật toán giữa Python và TypeScript |
| Thư viện dáng pose | **Tự thiết kế** bằng bộ sinh khung xương (forward kinematics), không tải ảnh từ Internet | Ảnh pose trên mạng có bản quyền và không máy đọc được; khung xương thì vừa vẽ được vừa chấm điểm được |
| Widget | Android: `AppWidgetProvider` (Kotlin) + WorkManager | iOS widget cần Xcode/macOS, máy hiện tại là Linux |

## 2. Cấu trúc thư mục

```
posecam/
├── docs/            PLAN.md, API.md
├── poses/           bộ sinh thư viện dáng (Python) → library.json + ảnh xem trước
├── backend/         FastAPI (uv), app/, tests/, models/ (tải về, không commit)
├── mobile/          React Native CLI app (Android chạy được; iOS có code nhưng chưa build)
└── scripts/         dev.sh (chạy backend), sync-poses.sh (chép library.json sang backend + mobile)
```

## 3. Tính năng

**Giống Locket**
- Đăng ký / đăng nhập (username + mật khẩu).
- Bạn bè: tìm theo username, gửi / chấp nhận / từ chối lời mời, xoá bạn.
- Màn hình camera: khung vuông bo góc, nút chụp tròn lớn viền vàng, đổi camera, flash (camera trước dùng flash màn hình), zoom.
- Sau khi chụp: xem trước, thêm chú thích ngắn (≤ 60 ký tự) trên ảnh, chọn người nhận ("Tất cả" hoặc từng bạn), gửi.
- Lịch sử: vuốt lên từ camera, xem ảnh theo trang dọc toàn màn hình, người gửi, thời gian, thả emoji.
- Widget Android: hiện ảnh mới nhất bạn bè gửi, tự làm mới định kỳ và khi mở app.

**Thêm mới: hướng dẫn tạo dáng**
- Thư viện ~45 dáng, chia nhóm: Gợi ý, Selfie, 1 người, 2 người, Nhóm 3+, Đồ vật (có "3 vật"), Phong cảnh, Thú cưng.
- Hai loại dáng: **dáng người** (khung xương 17 điểm COCO) và **bố cục** (đường 1/3, đường chân trời, vị trí đặt đồ vật).
- Chọn dáng → dáng hiện mờ trên khung chụp, người dùng tạo dáng theo.
- Khoảng 1.5 lần/giây app gửi một ảnh nhỏ lên `/analyze`. Backend trả về:
  - điểm khớp 0–100,
  - chi nào đúng / sai (tô xanh / đỏ trên khung),
  - gợi ý bằng tiếng Việt,
  - trạng thái "sẵn sàng".
- Tự chụp khi điểm ≥ 85 liên tiếp 3 lần (bật/tắt được), có đếm ngược 3‑2‑1.
- Tab "Gợi ý": dựa trên số người / đồ vật nhận diện được và dáng hiện tại của người trong khung, đề xuất các dáng dễ làm theo nhất.

## 4. Các bước thực hiện

| # | Việc | Người làm | Kiểm chứng |
|---|---|---|---|
| 0 | Khung thư mục, PLAN.md, API.md | Claude | — |
| 1 | Bộ sinh dáng + thư viện ~45 dáng + ảnh xem trước; module chấm điểm và gợi ý (Python) | Claude | Xem ảnh xem trước từng dáng; pytest cho chấm điểm |
| 2 | Backend FastAPI: auth, bạn bè, ảnh, cảm xúc, media, `/poses`, `/analyze` với MediaPipe | Agent backend | pytest, chạy uvicorn, gọi thử bằng ảnh thật |
| 3 | App React Native: toàn bộ màn hình, camera, chọn dáng, overlay, chấm điểm trực tiếp, gửi ảnh, lịch sử, bạn bè, cài đặt, widget Android | Agent mobile | `tsc`, ESLint, Jest, build APK |
| 4 | Ghép nối, chạy trên máy ảo Android với backend thật, chụp màn hình từng luồng, sửa lỗi | Claude | Ảnh chụp màn hình emulator, log |
| 5 | README hướng dẫn chạy, giới hạn còn lại | Claude | — |

Bước 2 và 3 chạy song song sau bước 0. Bước 1 làm song song với 2–3; thư viện dáng và module chấm điểm được ghép vào sau.

## 5. Tiêu chí hoàn thành

- Backend: `uv run pytest` qua hết; `scripts/dev.sh` khởi động được; `/analyze` trả kết quả đúng trên ảnh mẫu có người.
- Mobile: `npx tsc --noEmit`, ESLint và Jest qua; `./gradlew assembleDebug` build được APK.
- Chạy trên emulator: đăng ký 2 tài khoản, kết bạn, chụp và gửi ảnh, người kia thấy trong lịch sử và trên widget; mở bảng chọn dáng, overlay hiện trên camera, vòng `/analyze` chạy và hiện điểm / gợi ý.

## 6. Giới hạn đã biết (MVP)

- Chấm điểm dáng chạy trên server qua mạng LAN, độ trễ khoảng 0.3–0.8 giây; muốn mượt hơn cần chuyển nhận diện lên máy (frame processor).
- Chưa có thông báo đẩy (FCM/APNs): widget làm mới theo chu kỳ của WorkManager (tối thiểu 15 phút) và mỗi khi mở app.
- Widget iOS và build iOS chưa kiểm thử vì cần macOS.
- Máy ảo Android chỉ có camera giả lập, nên phần nhận diện người được kiểm thử bằng ảnh mẫu trên backend, không phải bằng camera thật.

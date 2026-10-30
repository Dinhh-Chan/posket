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

## Thư viện dáng

```bash
uv run --with pillow python poses/posegen.py   # sinh poses/library.json + ảnh xem trước
./scripts/sync-poses.sh                         # chép sang backend và app
```

Mỗi dáng người được mô tả bằng góc khớp hoặc vị trí bàn tay, từ đó sinh 17 điểm khung xương theo chuẩn
COCO. Dáng bố cục (phong cảnh, đồ vật, thú cưng) gồm đường dẫn hướng và các vòng đặt đồ vật.

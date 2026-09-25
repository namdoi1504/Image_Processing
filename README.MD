# Vision Lab · Chương 11 — Xử lý ảnh

Giao diện tiếng Việt cho **YOLO26**, **DeepLabV3 ResNet101** và **Neural Style Transfer**. Hỗ trợ kéo thả ảnh, ảnh mẫu, chỉnh tham số, so sánh trước/sau và tải kết quả; responsive cho desktop và điện thoại.

## Chạy giao diện

Cần Node.js 22 trở lên:

```powershell
cd web
npm install
npm run dev
```

Mở http://localhost:5173. Không cần API để xem kết quả mẫu của cả ba demo. YOLO và chuyển phong cách dùng kết quả có sẵn từ dự án; ảnh phân vùng được tạo bằng API DeepLabV3 với độ phủ 60%. Kết quả mẫu được ghi rõ là ảnh có sẵn; tham số hiện tại không áp dụng. Chạy suy luận mới trên ảnh bất kỳ cần API.

## Chạy mô hình thật

API dùng YOLO26n, torchvision DeepLabV3 ResNet101 và các model OpenCV `.t7` trong `models/instance_norm`. Script gốc được giữ nguyên.

Từ thư mục gốc, dùng **Python 3.11** và môi trường mới:

```powershell
py -3.11 -m venv .venv-web
.\.venv-web\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv-web\Scripts\python.exe -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Trên web, mở **Chế độ xem mẫu / Kết nối mô hình**, nhập `http://localhost:8000`, kiểm tra rồi lưu. Hoặc sao chép `web/.env.example` thành `web/.env.local` và khởi động lại Vite. Thiết lập lưu trong trình duyệt ưu tiên hơn biến môi trường.

- `GET /health`: kiểm tra API; `models_loaded` cho biết model đã nạp chưa. Health không tự tải weights.
- `POST /predict`: multipart gồm `file`, `demo` (`detection`, `segmentation`, `style`), `confidence` (0.05–1), `opacity` (0–1), `style`.
- JSON trả ảnh PNG base64, tên model, thời gian, kích thước, danh sách dự đoán/tỉ lệ lớp.
- JPG/PNG/WEBP, tối đa 10 MB và 25 triệu pixel. Giảm kích thước tối đa 1600 px; segmentation 900 px; style 800 px. Tệp upload tạm được đóng sau khi đọc; không lưu ảnh kết quả trên server.
- YOLO dùng `yolo26n.pt` tại gốc; nếu thiếu, Ultralytics tải weights. DeepLabV3 tải weights torchvision lần đầu, cần mạng và dung lượng cache. Lần đầu có thể lâu hơn.
- Một process xử lý một lượt suy luận; request đồng thời nhận 503. UI chờ tối đa 5 phút.

## Deploy lên Vercel

1. Đẩy repository lên GitHub và import vào Vercel.
2. **Root Directory: `web`**, **Framework Preset: Vite**.
3. Build: `npm run build`; Output: `dist`; Install: `npm ci`.
4. Nếu có backend public, thêm `VITE_API_URL=https://your-api.example.com` vào Environment Variables.
5. Deploy. Khi đổi biến môi trường, redeploy để Vite build lại.

`web/vercel.json` đã có cấu hình. Không cần Python runtime trên Vercel. Chưa có backend thì site vẫn xem được kết quả mẫu.

**Vercel host frontend; API Python chạy riêng.** PyTorch và weights lớn được chạy trên máy chủ/container để tránh giới hạn bundle và payload của [Vercel Functions](https://vercel.com/docs/functions/limitations).

## Deploy API bằng Docker

Build từ **gốc repository**:

```powershell
docker build -f backend/Dockerfile -t vision-lab-api .
docker run --rm -p 8000:8000 -e ALLOWED_ORIGINS=https://your-project.vercel.app vision-lab-api
```

Chạy container trên máy chủ Docker, cấu hình public HTTPS và cấp đủ RAM cho PyTorch (bắt đầu 4 GB rồi đo thực tế). Lưu cache weights nếu cần tránh tải lại sau khi khởi động. Image dùng CPU, cổng `PORT` mặc định 8000.

`ALLOWED_ORIGINS` là danh sách origin ngăn cách bởi dấu phẩy, không có dấu `/` cuối:

```text
https://your-project.vercel.app,https://your-domain.com,http://localhost:5173
```

Frontend HTTPS cần API HTTPS. Vercel Preview khác domain production cần thêm origin tương ứng. [Tài liệu CORS](https://fastapi.tiangolo.com/tutorial/cors/).

API phục vụ demo, chưa có đăng nhập/rate limit theo người dùng. Khi công khai, cấu hình xác thực/rate limit trên máy chủ/gateway theo nhu cầu; CORS không thay thế xác thực.

## Kiểm tra

```powershell
cd web
npm run build
npx playwright install chromium
npm test
```

Kiểm tra validation API không cần tải weights (chạy từ gốc):

```powershell
.\.venv-web\Scripts\python.exe -m pip install httpx
.\.venv-web\Scripts\python.exe -m unittest backend.test_api
```

Playwright kiểm tra upload, chọn demo, API mock, lỗi API, so sánh, tải kết quả và mobile. Kiểm tra suy luận thật bằng cách nối API rồi chạy từng demo với ảnh mẫu.

Hoặc chạy `.\.venv-web\Scripts\python.exe -m backend.smoke_models` từ gốc để kiểm tra cả ba mô hình thật; kết quả ghi vào `backend/smoke-results/`. Cần tải weights ở lần đầu.

Nếu máy đã có Edge, có thể chạy test không cần tải Chromium: `$env:PLAYWRIGHT_CHANNEL='msedge'; npm test` (PowerShell, từ `web`).

## Cấu trúc

```text
web/                  Giao diện Vite, cấu hình Vercel
web/public/samples/   Bản sao ảnh mẫu và kết quả có sẵn
backend/app.py        API suy luận ba mô hình
backend/Dockerfile    Container CPU
models/               Model neural style transfer .t7
images/               Ảnh đầu vào của script gốc
images_val/           Kết quả của script gốc
```

Script gốc dùng Python 3.11.9 và `requirements.txt` tại gốc; sửa đường dẫn ảnh trong script trước khi chạy. API có dependencies riêng trong `backend/requirements.txt`.

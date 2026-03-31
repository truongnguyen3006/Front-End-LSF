# Ecommerce Frontend

Frontend cho hệ ecommerce đóng vai trò consumer khi tích hợp với **LSF** ở repo chính. Mục tiêu của repo này không phải mô phỏng một website ecommerce đầy đủ tính năng, mà là cung cấp giao diện để chạy, quan sát luồng đặt hàng và hỗ trợ demo phần tích hợp framework trong hệ thống.

## Chức năng chính

### Khách hàng
- Xem danh sách sản phẩm và lọc theo từ khóa, danh mục
- Xem chi tiết sản phẩm, chọn màu, size và kiểm tra tồn kho theo biến thể
- Đăng ký, đăng nhập tài khoản
- Thêm sản phẩm vào giỏ hàng, chỉnh số lượng và đặt hàng
- Theo dõi trạng thái đơn hàng qua trang đơn hàng và màn hình chờ xử lý
- Nhận cập nhật trạng thái đơn hàng theo thời gian thực qua WebSocket
- Xem và cập nhật hồ sơ cá nhân
- Có sẵn giao diện danh sách yêu thích để mở rộng thêm sau này

### Admin
- Xem dashboard tổng quan với số lượng người dùng, số đơn hàng và doanh thu trong ngày
- Xem danh sách sản phẩm trong hệ thống
- Tạo sản phẩm mới, khai báo biến thể theo màu, size, giá, số lượng ban đầu và hình ảnh
- Chỉnh sửa hoặc xóa sản phẩm
- Xem danh sách đơn hàng và mở chi tiết từng đơn
- Xem danh sách người dùng trong hệ thống
- Khóa hoặc mở khóa tài khoản người dùng
- Có khu vực **Framework Evidence** để hỗ trợ demo phần tích hợp LSF

## Framework Evidence

Khu vực admin có thêm một màn riêng để phục vụ demo framework:

- Xem availability theo SKU
- Xem recent outbox events
- Lọc nhanh theo `msgKey`
- Mở nhanh các công cụ quan sát như Grafana, Zipkin, phpMyAdmin và Outbox Admin API

Phần này được thêm vào để frontend không chỉ đóng vai trò giao diện mua hàng, mà còn hỗ trợ quan sát kết quả tích hợp framework trong flow order → inventory → outbox.

## Công nghệ sử dụng

- **Next.js 16** – xây dựng ứng dụng frontend
- **React 19** – phát triển giao diện theo component
- **TypeScript** – hỗ trợ kiểm soát kiểu dữ liệu
- **Ant Design** – dựng nhanh các màn hình quản trị và người dùng
- **Tailwind CSS 4** – hỗ trợ layout và style utility-first
- **TanStack Query** – xử lý fetch, cache và đồng bộ dữ liệu
- **Axios** – giao tiếp với REST API
- **Zustand** – lưu state cục bộ như giỏ hàng và phiên đăng nhập
- **SockJS / STOMP** – cập nhật trạng thái đơn hàng theo thời gian thực

## Cấu trúc chính

```text
src/
├─ app/                # các trang chính
├─ components/         # component giao diện
├─ services/           # gọi API
├─ lib/                # axios, helper, auth, order status
├─ store/              # state management
├─ constants/          # quick links hệ thống
└─ types/              # kiểu dữ liệu
```

## Các màn hình chính

### Trang sản phẩm
<img src="screenshots/products.png" alt="products" width="1135">

### Trang chi tiết sản phẩm
<img src="screenshots/ProductDetail.png" alt="ProductDetail" width="845">

### Trang giỏ hàng
<img src="screenshots/Cart.png" alt="Cart" width="848">

### Trang đặt hàng
<img src="screenshots/1%20(1).png" alt="Checkout" width="1560">

### Trang Admin có Framework
<img src="screenshots/1%20(2).png" alt="Admin" width="1904">

## Yêu cầu môi trường

- Node.js 20+
- npm 10+
- Backend API chạy tại `http://localhost:8000`
- WebSocket server chạy tại `http://localhost:8087/ws`

## Cách chạy local

### 1. Clone project

```bash
git clone <repo-url>
cd <project-folder>
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file môi trường

Tạo file `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:8087/ws
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000
NEXT_PUBLIC_ZIPKIN_URL=http://localhost:9411
NEXT_PUBLIC_PHPMYADMIN_URL=http://localhost:8888
NEXT_PUBLIC_OUTBOX_ADMIN_URL=http://localhost:8000/admin/outbox
```

### 4. Chạy frontend

```bash
npm run dev
```

Frontend chạy tại:

```text
http://localhost:3001
```

Backend cần được khởi động trước để frontend có thể gọi API, nhận cập nhật trạng thái đơn hàng qua WebSocket và mở các liên kết quan sát trong khu vực Framework Evidence.

## Hạn chế hiện tại

- Chưa phải một website thương mại điện tử hoàn chỉnh
- Frontend này không triển khai luồng thanh toán VNPAY
- Giao diện được giữ ở mức đủ dùng để phục vụ luồng đặt hàng và phần demo tích hợp framework
- Trọng tâm của project vẫn nằm ở framework chính và cách consumer ecommerce dùng để kiểm chứng tích hợp

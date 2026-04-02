# Hướng dẫn triển khai — Sonaro Gate

---

## Phần 1 — Cài đặt tự động (1 lệnh)

Đây là cách nhanh nhất. Script sẽ tự động kiểm tra hệ thống, cài Docker, tải mã nguồn, cấu hình môi trường, mở cổng firewall và khởi động toàn bộ hệ thống.

### Yêu cầu tối thiểu

| Thành phần | Tối thiểu |
|---|---|
| Hệ điều hành | Ubuntu 24.04 LTS (64-bit) |
| CPU | 2 nhân |
| RAM | 2 GB |
| Ổ đĩa | 20 GB trống |
| Card mạng | **Tối thiểu 2 NIC** (1 cho WAN, 1 cho LAN) |
| Quyền | `root` hoặc `sudo` |

### Chạy lệnh cài đặt

```bash
curl -fsSL https://raw.githubusercontent.com/huynhtrungcsc/sonaro-gate/main/deploy/install.sh | sudo bash
```

Khi chạy trực tiếp trên terminal, script sẽ hỏi chọn phương thức cài đặt (Docker hoặc Native). Khi chạy qua pipe (`curl | bash`), mặc định là **Docker**.

### Tùy chọn nâng cao

```bash
# Chỉ định port khác (mặc định: 5000)
curl -fsSL .../install.sh | sudo PORT=8080 bash

# Chỉ định thư mục cài đặt khác (mặc định: /opt/sonaro)
curl -fsSL .../install.sh | sudo INSTALL_DIR=/srv/sonaro bash

# Bắt buộc dùng Docker (bỏ qua prompt hỏi)
curl -fsSL .../install.sh | sudo INSTALL_METHOD=docker bash
```

### Script tự động làm những gì?

1. **Kiểm tra hệ thống** — OS, CPU, RAM, ổ đĩa, NIC, kết nối internet, UFW
2. **Phát hiện cài đặt cũ** — nếu tìm thấy, hỏi xác nhận rồi xóa sạch trước khi cài mới
3. **Cài Docker Engine** — từ kho chính thức của Docker (bỏ qua nếu đã có)
4. **Tải mã nguồn** — clone về `/opt/sonaro`
5. **Tạo file `.env`** — sinh password DB và JWT secret ngẫu nhiên, chmod 600
6. **Mở cổng firewall** — tự động chạy `ufw allow 5000/tcp` nếu UFW đang bật
7. **Build và khởi động** — build Docker image, chạy 2 container (PostgreSQL + Sonaro Gate)
8. **Kiểm tra sức khỏe** — poll `/api/health` trong tối đa 3 phút
9. **In hướng dẫn** — địa chỉ truy cập, thông tin đăng nhập, lệnh quản lý

### Sau khi cài xong

Truy cập giao diện web:

```
http://<IP_SERVER>:5000
```

| Trường | Giá trị mặc định |
|---|---|
| Email | `admin@sonaro.local` |
| Mật khẩu | `Admin123!` |

> **Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.**
> Vào: **System → Administrators → Click admin → Change Password**

---

## Phần 2 — Triển khai từng bước bằng Docker

Dành cho ai muốn hiểu rõ từng bước hoặc cần tùy chỉnh cấu hình.

### Bước 0 — Chuẩn bị máy chủ

Cài Ubuntu 24.04 LTS, đảm bảo máy có ít nhất 2 card mạng (NIC).

Kiểm tra card mạng hiện có:

```bash
ip link show
```

Kết quả mẫu:

```
1: lo: <LOOPBACK> ...
2: ens33: <BROADCAST,MULTICAST,UP> ...    ← sẽ dùng làm WAN
3: ens34: <BROADCAST,MULTICAST,UP> ...    ← sẽ dùng làm LAN
```

Nếu chỉ có 1 NIC, cần thêm card mạng thứ hai trước khi tiếp tục (trên VMware/VirtualBox: thêm Network Adapter trong phần cấu hình VM).

---

### Bước 1 — Cài Docker Engine

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
```

Kiểm tra:

```bash
docker --version
docker compose version
```

---

### Bước 2 — Tải mã nguồn

```bash
sudo git clone --depth 1 https://github.com/huynhtrungcsc/sonaro-gate.git /opt/sonaro
```

---

### Bước 3 — Tạo file cấu hình môi trường

```bash
cd /opt/sonaro

# Sinh password và secret ngẫu nhiên
DB_PASS=$(openssl rand -hex 20)
JWT_SECRET=$(openssl rand -hex 32)

sudo tee .env > /dev/null <<EOF
NODE_ENV=production
PORT=5000

POSTGRES_DB=sonaro_gate
POSTGRES_USER=sonaro
POSTGRES_PASSWORD=${DB_PASS}

DATABASE_URL=postgresql://sonaro:${DB_PASS}@127.0.0.1:5432/sonaro_gate
JWT_SECRET=${JWT_SECRET}

SONARO_SKIP_SETUP=
EOF

sudo chmod 600 .env
```

Kiểm tra nội dung file (không để lộ ra ngoài):

```bash
sudo cat /opt/sonaro/.env
```

---

### Bước 4 — Mở cổng firewall

Kiểm tra UFW có đang bật không:

```bash
sudo ufw status
```

Nếu kết quả là `Status: active`, mở cổng 5000:

```bash
sudo ufw allow 5000/tcp
sudo ufw status numbered
```

Nếu UFW không active, bỏ qua bước này.

---

### Bước 5 — Build Docker image

```bash
cd /opt/sonaro
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env build
```

Lần đầu tiên mất khoảng **3–5 phút** (tải dependencies, compile TypeScript, build React). Các lần sau nhanh hơn nhờ Docker layer cache.

Theo dõi tiến trình build:

```bash
# Nếu muốn xem chi tiết hơn, thêm --progress=plain
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env build --progress=plain
```

---

### Bước 6 — Khởi động container

```bash
cd /opt/sonaro
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d
```

Kiểm tra 2 container đã chạy chưa:

```bash
sudo docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml ps
```

Kết quả mong đợi:

```
NAME           STATUS          PORTS
sonaro-db      Up (healthy)
sonaro-gate    Up
```

---

### Bước 7 — Kiểm tra ứng dụng đã sẵn sàng

```bash
# Thử từ chính máy chủ
curl http://127.0.0.1:5000/api/health
```

Kết quả mong đợi: `{"status":"ok"}`

Nếu chưa có kết quả (app đang khởi động), thử lại sau 10–30 giây. Xem log để theo dõi:

```bash
sudo docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f sonaro-gate
```

---

### Bước 8 — Truy cập giao diện web

Mở trình duyệt từ bất kỳ máy nào trong cùng mạng:

```
http://<IP_SERVER>:5000
```

Tìm IP của máy chủ:

```bash
ip addr show
# hoặc
hostname -I
```

Đăng nhập:

| Trường | Giá trị |
|---|---|
| Email | `admin@sonaro.local` |
| Mật khẩu | `Admin123!` |

**Đổi mật khẩu ngay sau khi đăng nhập lần đầu!**

---

### Bước 9 — Cấu hình card mạng (WAN/LAN/DMZ)

Đây là bước bắt buộc để firewall có thể định tuyến traffic.

Vào giao diện web: **Network → Interfaces**

Gán vai trò cho từng card mạng:

| Card mạng | Vai trò |
|---|---|
| ens33 (có IP internet) | WAN |
| ens34 | LAN |
| ens35 (nếu có) | DMZ |

Sau khi gán xong, thiết bị LAN sẽ có thể truy cập internet qua firewall.

---

### Bảng lệnh quản lý container thường dùng

| Tác vụ | Lệnh |
|---|---|
| Xem trạng thái | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml ps` |
| Xem log realtime | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f` |
| Xem log app | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f sonaro-gate` |
| Xem log database | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs -f db` |
| Restart app | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml restart sonaro-gate` |
| Restart tất cả | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml restart` |
| Dừng tất cả | `docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml down` |
| Mở shell trong container | `docker exec -it sonaro-gate bash` |

---

### Xử lý sự cố

**Không truy cập được web UI?**

```bash
# 1. Kiểm tra container đang chạy
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml ps

# 2. Kiểm tra port 5000 có đang lắng nghe
ss -tlnp | grep 5000

# 3. Kiểm tra UFW
sudo ufw status numbered
sudo ufw allow 5000/tcp   # nếu 5000 chưa có trong danh sách

# 4. Test tại chỗ trên server
curl -v http://127.0.0.1:5000/api/health

# 5. Xem log lỗi
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs --tail=50 sonaro-gate
```

**Container không khởi động?**

```bash
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs db
docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs sonaro-gate
```

Lỗi phổ biến:

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `password authentication failed` | Sai `POSTGRES_PASSWORD` trong `.env` | Kiểm tra và sửa `/opt/sonaro/.env` rồi `docker compose up -d` lại |
| `port 5000 already in use` | Có tiến trình khác đang dùng port 5000 | `lsof -i :5000` để tìm, rồi dừng nó |
| Container exit ngay sau khi start | Lỗi khởi động app | Xem log bằng lệnh trên |

---

## Phần 3 — Cập nhật hệ thống

### Quy trình cập nhật chuẩn

Khi có code mới từ GitHub, thực hiện theo đúng thứ tự sau:

**Bước 1 — Lấy code mới nhất từ GitHub**

```bash
cd /opt/sonaro
sudo git pull origin main
```

Kiểm tra những thay đổi vừa được tải về:

```bash
git log --oneline -10
```

**Bước 2 — Kiểm tra có thay đổi cấu hình không**

```bash
# Xem file .env hiện tại
sudo cat /opt/sonaro/.env

# So sánh với file mẫu (nếu có cập nhật)
diff /opt/sonaro/.env /opt/sonaro/.env.example 2>/dev/null || true
```

Nếu có biến môi trường mới trong `.env.example`, thêm vào `.env` trước khi tiếp tục.

**Bước 3 — Rebuild image và khởi động lại**

```bash
cd /opt/sonaro
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

Tham số `--build` bắt buộc phải có — nó rebuild Docker image với code mới. Bỏ qua `--build` sẽ chạy container từ image cũ, không có tác dụng gì.

**Bước 4 — Kiểm tra sau cập nhật**

```bash
# Xem container đang chạy version mới
sudo docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml ps

# Xem log để đảm bảo không có lỗi
sudo docker compose -f /opt/sonaro/deploy/docker-compose.prod.yml logs --tail=30 sonaro-gate

# Test API health
curl http://127.0.0.1:5000/api/health
```

---

### Cập nhật trong 1 lệnh duy nhất

```bash
cd /opt/sonaro && \
sudo git pull origin main && \
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build && \
sudo docker compose -f deploy/docker-compose.prod.yml logs --tail=20 sonaro-gate
```

---

### Rollback về phiên bản trước

Nếu sau khi cập nhật có lỗi và cần quay lại phiên bản cũ:

```bash
cd /opt/sonaro

# Xem lịch sử commit
git log --oneline -15

# Quay về commit trước đó (thay <commit-hash> bằng hash thực tế)
sudo git reset --hard <commit-hash>

# Rebuild image với code cũ
sudo docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

---

### Những điều cần lưu ý khi cập nhật

**Dữ liệu cấu hình không bị mất** — PostgreSQL lưu trong Docker named volume (`pgdata`). Rebuild image không xóa volume này. Chỉ khi chạy `docker compose down -v` thì volume mới bị xóa.

**Migration database** — Nếu phiên bản mới có thay đổi cấu trúc database, Drizzle ORM sẽ tự động chạy migration khi container khởi động lại. Không cần làm thủ công.

**Thời gian downtime** — Trong quá trình `up -d --build`, Docker sẽ dừng container cũ rồi khởi động container mới. Thời gian gián đoạn thường dưới 30 giây.

**Backup trước khi cập nhật phiên bản lớn** — Vào giao diện web: **System → Backup & Restore → Export** để tải về file backup trước.

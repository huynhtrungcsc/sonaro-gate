# Hướng dẫn dịch vụ — Sonaro Gate

Tài liệu này mô tả các dịch vụ hệ thống bên ngoài mà Sonaro Gate quản lý và cách cấu hình, kiểm tra chúng trên Ubuntu 24.04 LTS.

---

## Mục lục

1. [WireGuard VPN](#1-wireguard-vpn)
2. [OpenVPN](#2-openvpn)
3. [Suricata IDS/IPS](#3-suricata-idsips)
4. [NAT (Network Address Translation)](#4-nat-network-address-translation)
5. [Kiểm tra trạng thái hệ thống](#5-kiểm-tra-trạng-thái-hệ-thống)
6. [Xử lý sự cố](#6-xử-lý-sự-cố)

---

## 1. WireGuard VPN

### Tổng quan

WireGuard là VPN kernel-level được tích hợp vào Linux kernel từ 5.6+. Sonaro Gate quản lý các tunnel WireGuard thông qua giao diện web — **không cần thao tác thủ công**.

### Kiểm tra cài đặt

```bash
# Kiểm tra phiên bản
wg --version

# Kiểm tra kernel module
lsmod | grep wireguard

# Kiểm tra crypto hoạt động (tạo key thử)
wg genkey | wg pubkey
# Output phải là chuỗi base64 dài 44 ký tự, ví dụ:
# 8GboYh7YM6HhN3MB5CmHGzHm53tCBMJQABw/fHqueng=
```

**Nếu tất cả trả về kết quả → WireGuard hoạt động bình thường.**

### Cách hoạt động trong Sonaro Gate

1. Vào **VPN → Tunnels** → tạo WireGuard tunnel
2. Hệ thống tự động:
   - Tạo `wg0.conf` tại `/etc/wireguard/wg0.conf`
   - Chạy `wg-quick up wg0`
   - Thêm route và iptables rule cho tunnel
3. Peers (client) được thêm vào tab **Peers** của tunnel

### Cấu hình thủ công (nâng cao)

```bash
# Xem trạng thái tất cả interface WireGuard
wg show

# Xem interface cụ thể
wg show wg0

# Tạo key pair cho peer mới
wg genkey | tee /tmp/peer-private.key | wg pubkey > /tmp/peer-public.key
cat /tmp/peer-private.key   # giữ bí mật
cat /tmp/peer-public.key    # thêm vào AllowedPeers trên server

# Khởi động/dừng thủ công (không nên dùng khi Sonaro Gate đang chạy)
wg-quick up   wg0
wg-quick down wg0
```

### Firewall ports cần mở cho WireGuard

| Port | Protocol | Mục đích |
|------|----------|----------|
| 51820 | UDP | WireGuard VPN (mặc định) |

```bash
# Mở port nếu dùng UFW
sudo ufw allow 51820/udp
```

---

## 2. OpenVPN

### Tổng quan

OpenVPN hỗ trợ cả chế độ road-warrior (remote access) và site-to-site. Sonaro Gate quản lý cấu hình và PKI (Public Key Infrastructure) thông qua giao diện web.

### Kiểm tra cài đặt

```bash
# Kiểm tra phiên bản
openvpn --version

# Kiểm tra thư mục cấu hình
ls -la /etc/openvpn/
ls -la /etc/openvpn/server/
ls -la /etc/openvpn/client/
```

### Cấu trúc thư mục

```
/etc/openvpn/
├── server/          # Cấu hình server
│   └── server.conf  # (tạo bởi Sonaro Gate)
├── client/          # Cấu hình client
│   └── *.ovpn       # (export từ giao diện web)
├── pki/             # PKI (CA, certs, keys)
│   ├── ca.crt
│   ├── server.crt
│   ├── server.key
│   └── dh.pem
└── easy-rsa/        # Tool quản lý PKI
```

### Firewall ports cần mở cho OpenVPN

| Port | Protocol | Mục đích |
|------|----------|----------|
| 1194 | UDP | OpenVPN (mặc định) |
| 443  | TCP | OpenVPN qua HTTPS (tránh chặn firewall) |

```bash
sudo ufw allow 1194/udp
sudo ufw allow 443/tcp   # nếu dùng TCP mode
```

### Debug kết nối VPN

```bash
# Xem log OpenVPN
journalctl -u openvpn -f

# Test cấu hình trước khi bật
openvpn --config /etc/openvpn/server/server.conf --verb 4
```

---

## 3. Suricata IDS/IPS

### Tổng quan

Suricata là engine phân tích mạng (IDS = Intrusion Detection, IPS = Intrusion Prevention). Ở chế độ IDS nó chỉ ghi log cảnh báo, ở chế độ IPS nó chặn gói tin nguy hiểm trực tiếp qua NFQueue.

### Kiểm tra cài đặt

```bash
# Kiểm tra phiên bản
suricata --version

# Kiểm tra cấu hình (không cần interface thật)
sudo suricata -T -c /etc/suricata/suricata.yaml
# Output phải kết thúc bằng "Configuration provided was successfully loaded."

# Đếm số rules đã tải
grep -c "^alert" /var/lib/suricata/rules/suricata.rules
# Thường từ 30.000–50.000 rules với bộ Emerging Threats Open

# Kiểm tra rules files
ls -la /var/lib/suricata/rules/
ls -la /etc/suricata/rules/
```

### Cập nhật threat signatures

```bash
# Cập nhật ngay (không restart)
sudo suricata-update

# Xem danh sách nguồn rule
sudo suricata-update list-sources

# Thêm nguồn Emerging Threats Open (nếu chưa có)
sudo suricata-update add-source et/open \
    "https://rules.emergingthreats.net/open/suricata-%(__version__)s/emerging.rules.tar.gz"

# Cập nhật và reload (khi Suricata đang chạy)
sudo suricata-update && sudo kill -USR2 $(pidof suricata)
```

### File cấu hình quan trọng

| File | Mục đích |
|------|----------|
| `/etc/suricata/suricata.yaml` | Cấu hình chính |
| `/var/lib/suricata/rules/suricata.rules` | Rules tổng hợp (tự động cập nhật) |
| `/etc/suricata/rules/sonaro-local.rules` | Rules tùy chỉnh của Sonaro Gate |
| `/var/log/suricata/eve.json` | Log sự kiện (JSON format, cho SIEM) |
| `/var/log/suricata/fast.log` | Log cảnh báo nhanh (text format) |

### Cấu hình HOME_NET

Biến `HOME_NET` trong `/etc/suricata/suricata.yaml` xác định mạng nội bộ. Cần set đúng để rules phân loại traffic chính xác:

```yaml
vars:
  address-groups:
    HOME_NET: "[192.168.0.0/16,10.0.0.0/8,172.16.0.0/12]"
```

Script cài đặt tự động detect subnet và set biến này. Nếu cần sửa thủ công:

```bash
# Xem subnet hiện tại
ip -4 addr show scope global

# Sửa HOME_NET
sudo nano /etc/suricata/suricata.yaml
# Tìm dòng HOME_NET và sửa

# Validate lại
sudo suricata -T -c /etc/suricata/suricata.yaml
```

### Xem cảnh báo realtime

```bash
# Theo dõi cảnh báo (fast.log)
sudo tail -f /var/log/suricata/fast.log

# Theo dõi eve.json với jq
sudo tail -f /var/log/suricata/eve.json | jq 'select(.event_type=="alert")'

# Top 10 signature bị kích hoạt nhiều nhất
sudo jq -r 'select(.event_type=="alert") | .alert.signature' \
    /var/log/suricata/eve.json | sort | uniq -c | sort -rn | head -10
```

### Chế độ IPS (Inline Prevention)

Khi bật IPS trong Sonaro Gate, Suricata chạy ở chế độ NFQueue — chặn trực tiếp gói tin:

```bash
# Kiểm tra NFQueue (cần kernel module)
lsmod | grep nf_queue

# Xem queue hiện tại
cat /proc/net/netfilter/nf_queue 2>/dev/null
```

> **Lưu ý:** Ở chế độ IPS, nếu Suricata crash thì traffic bị DROP hoàn toàn (fail-closed). Hãy chắc chắn config đúng trước khi bật IPS trên production.

---

## 4. NAT (Network Address Translation)

Sonaro Gate hỗ trợ 4 loại NAT, tất cả được cấu hình qua **Firewall → NAT**.

### 4.1 Port Forward (DNAT — Destination NAT)

Chuyển hướng traffic từ IP:Port bên ngoài vào máy nội bộ. Ví dụ: forward port 80 WAN → web server LAN.

**Ví dụ tạo port forward:**

1. Vào **Firewall → NAT** → tab **Port Forward**
2. Nhấn **Create New → Port Forward Rule**
3. Điền:
   - Interface: WAN
   - Protocol: TCP
   - External Port: 8080
   - Internal Address: 192.168.1.100
   - Internal Port: 80
4. Nhấn **OK** → **Apply to System**

**iptables equivalent:**
```bash
iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 8080 \
    -j DNAT --to-destination 192.168.1.100:80
iptables -A FORWARD -d 192.168.1.100 -p tcp --dport 80 -j ACCEPT
```

### 4.2 Outbound NAT (SNAT / Masquerade)

Thay thế IP nguồn của traffic đi ra internet. Cần thiết để máy LAN có thể kết nối internet qua 1 IP WAN.

**Chế độ Automatic (mặc định):**
- Hệ thống tự tạo MASQUERADE rule cho tất cả traffic LAN → WAN

**iptables equivalent:**
```bash
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

**Chế độ Manual (SNAT cố định):**
```bash
iptables -t nat -A POSTROUTING -s 192.168.1.0/24 -o eth0 \
    -j SNAT --to-source 203.0.113.10
```

### 4.3 1:1 NAT (Static NAT)

Map 1 IP public ↔ 1 IP private theo cả hai chiều. Traffic đến IP public → forward vào IP private. Traffic từ IP private → ra với IP public đó.

**Dùng cho:**
- Server cần IP public riêng (web server, mail server)
- Thiết bị cần có IP public cố định

**iptables equivalent:**
```bash
# Inbound (DNAT)
iptables -t nat -A PREROUTING -d 203.0.113.10 -j DNAT --to 192.168.1.100

# Outbound (SNAT)
iptables -t nat -A POSTROUTING -s 192.168.1.100 -j SNAT --to 203.0.113.10
```

### 4.4 NPt — Network Prefix Translation (IPv6)

Tương đương NAT cho IPv6 — dịch prefix mạng nội bộ (ULA `fd00::/64`) sang prefix public (GUA `2001:db8::/64`) mà không cần state.

### Apply rules

Sau khi tạo/sửa NAT rules, nhấn nút **Apply to System** trên toolbar để đẩy rules vào iptables ngay lập tức.

Kiểm tra rules đã được áp dụng:
```bash
# Xem NAT table
sudo iptables -t nat -L -n -v

# Xem PREROUTING (DNAT / port forward)
sudo iptables -t nat -L PREROUTING -n -v

# Xem POSTROUTING (SNAT / masquerade)
sudo iptables -t nat -L POSTROUTING -n -v
```

---

## 5. Kiểm tra trạng thái hệ thống

### Chạy lại verification sau khi cài đặt

Script cài đặt in bảng kiểm tra ở cuối. Nếu muốn chạy lại thủ công:

```bash
# Kiểm tra toàn bộ bằng 1 lệnh
cat << 'EOF' | sudo bash
echo "=== IP Forwarding ==="
cat /proc/sys/net/ipv4/ip_forward  # phải là 1

echo "=== WireGuard ==="
wg --version
lsmod | grep wireguard
wg genkey | wg pubkey  # phải trả về 44 ký tự base64

echo "=== OpenVPN ==="
openvpn --version | head -1

echo "=== Suricata ==="
suricata --version
suricata -T -c /etc/suricata/suricata.yaml 2>&1 | tail -3
grep -c "^alert" /var/lib/suricata/rules/suricata.rules 2>/dev/null || echo "0 rules"

echo "=== iptables ==="
iptables --version
iptables -t nat -L -n 2>/dev/null | head -10
EOF
```

### Bảng trạng thái mong đợi

| Thành phần | Kiểm tra | Kết quả mong đợi |
|---|---|---|
| IP Forwarding | `cat /proc/sys/net/ipv4/ip_forward` | `1` |
| WireGuard kernel | `lsmod \| grep wireguard` | có dòng `wireguard` |
| WireGuard crypto | `wg genkey \| wg pubkey` | chuỗi 44 ký tự |
| OpenVPN | `openvpn --version` | OpenVPN 2.x.x |
| Suricata binary | `suricata --version` | Suricata 7.x.x |
| Suricata config | `suricata -T -c /etc/suricata/suricata.yaml` | `...successfully loaded.` |
| Suricata rules | `grep -c "^alert" /var/lib/suricata/rules/suricata.rules` | ≥ 30000 |
| nf_conntrack | `lsmod \| grep nf_conntrack` | có dòng `nf_conntrack` |

---

## 6. Xử lý sự cố

### WireGuard: `modprobe wireguard` thất bại

```bash
# Kiểm tra kernel version (cần ≥ 5.6 để có built-in WireGuard)
uname -r

# Nếu kernel cũ, cài DKMS version
sudo apt-get install -y wireguard-dkms linux-headers-$(uname -r)
sudo modprobe wireguard

# Kiểm tra lại
lsmod | grep wireguard
```

### Suricata: `suricata -T` thất bại

```bash
# Xem log chi tiết
sudo suricata -T -c /etc/suricata/suricata.yaml -v 2>&1

# Lỗi phổ biến: rule file không tồn tại
sudo suricata-update   # tải lại rules

# Lỗi: interface không hợp lệ (bỏ qua khi chỉ test config)
# → Thêm tùy chọn --simulate-pkt hoặc bỏ cấu hình af-packet
```

### Suricata không có rules (0 rules)

```bash
# Chạy lại suricata-update
sudo suricata-update

# Nếu lỗi network, thêm nguồn ET/Open thủ công
sudo suricata-update add-source et/open \
    "https://rules.emergingthreats.net/open/suricata-%(__version__)s/emerging.rules.tar.gz"
sudo suricata-update
```

### NAT không hoạt động (máy LAN không ra được internet)

```bash
# 1. Kiểm tra IP forwarding
cat /proc/sys/net/ipv4/ip_forward  # phải là 1

# 2. Kiểm tra MASQUERADE rule
sudo iptables -t nat -L POSTROUTING -n -v
# Phải có dòng: MASQUERADE  all  --  *  eth0  ...

# 3. Bật thủ công nếu thiếu
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
# (thay eth0 bằng interface WAN thực tế)

# 4. Áp dụng qua UI
# Vào Firewall → NAT → Apply to System
```

### Port Forward không hoạt động

```bash
# Kiểm tra DNAT rule
sudo iptables -t nat -L PREROUTING -n -v

# Kiểm tra FORWARD rule (cần có để cho phép traffic đi qua)
sudo iptables -L FORWARD -n -v

# Test kết nối từ bên ngoài
curl -v http://<WAN_IP>:<external_port>
```

---

*Cập nhật lần cuối: 2025 — Sonaro Gate 2025.1 LTS*

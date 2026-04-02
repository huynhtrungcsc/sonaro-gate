# Wallix FW-500 • 2025.1 LTS — Kiến trúc hệ thống

Tài liệu này mô tả toàn bộ kiến trúc, luồng hoạt động, và các thành phần của Wallix FW-500 • 2025.1 LTS.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Luồng khởi động hệ thống](#2-luồng-khởi-động-hệ-thống)
3. [Luồng traffic mạng](#3-luồng-traffic-mạng)
4. [Kiến trúc phần mềm](#4-kiến-trúc-phần-mềm)
5. [Tích hợp kernel Linux](#5-tích-hợp-kernel-linux)
6. [Cơ sở dữ liệu](#6-cơ-sở-dữ-liệu)
7. [Xác thực & Bảo mật](#7-xác-thực--bảo-mật)
8. [Background Agent](#8-background-agent)
9. [Luồng áp dụng cấu hình](#9-luồng-áp-dụng-cấu-hình)
10. [Triển khai Docker](#10-triển-khai-docker)

---

## 1. Tổng quan kiến trúc

```
                          INTERNET
                              │
                              │ (WAN — eth0 / ens3)
                              ▼
                    ┌─────────────────┐
                    │                 │
                    │   WALLIX NGFW    │  ← Ubuntu 24.04 LTS
                    │   (bare-metal)  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │ iptables  │  │  Firewall / NAT / Forward
                    │  │ ip route  │  │  Routing
                    │  │ sysctl    │  │  IP Forwarding
                    │  │ netplan   │  │  Network config (persist)
                    │  └───────────┘  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │ Node.js   │  │  Web UI + REST API
                    │  │ :5000     │  │
                    │  └───────────┘  │
                    │                 │
                    │  ┌───────────┐  │
                    │  │PostgreSQL │  │  Config database
                    │  │ :5432     │  │
                    │  └───────────┘  │
                    │                 │
                    └────────┬────────┘
                             │
                             │ (LAN — eth1 / ens4)
                             ▼
                    ┌─────────────────┐
                    │   LAN Network   │  192.168.1.0/24
                    │                 │
                    │  ┌───┐  ┌───┐  │
                    │  │PC │  │PC │  │  Clients nhận NAT'd internet
                    │  └───┘  └───┘  │
                    │                 │
                    │  Trình duyệt    │  http://192.168.1.1:5000
                    │  → Web UI       │  (quản trị firewall)
                    └─────────────────┘
```

---

## 2. Luồng khởi động hệ thống

```
sudo npx tsx server/index.ts
           │
           ▼
    ┌─────────────────────────────────────────────────────┐
    │  server/index.ts — main()                           │
    └─────────────────────────────────────────────────────┘
           │
           ├─── 1. Connect PostgreSQL (Drizzle ORM)
           │         └─► Retry 5 lần nếu DB chưa sẵn sàng
           │
           ├─── 2. Run Migrations (drizzle-kit)
           │         └─► Tạo/cập nhật tables tự động
           │
           ├─── 3. Seed Database
           │         └─► server/seed.ts
           │               ├── Admin user (nếu chưa có)
           │               └── Default settings
           │
           ├─── 4. Check Setup State
           │         └─► Đọc system_settings WHERE key='setup_complete'
           │
           ├─── 5. Run CLI Wizard (nếu eligible)
           │         └─► server/setup.ts
           │               ├── Điều kiện: root + TTY + chưa setup + WALLIX_SKIP_SETUP≠1
           │               ├── Detect NICs (systeminformation)
           │               ├── Wizard tương tác (readline)
           │               ├── Ghi netplan YAML → netplan apply
           │               ├── Enable IP forwarding (sysctl + persist)
           │               ├── Enable NAT masquerade (iptables)
           │               └── Save config to DB, set setup_complete=true
           │
           ├─── 6. Start Background Agent
           │         └─► server/agent.ts
           │               ├── syncRealNetworkInterfaces() — ngay lập tức
           │               ├── collectSystemMetrics() — ngay lập tức
           │               ├── collectNetworkStats() — ngay lập tức
           │               └─► setInterval: 30s / 60s / 120s
           │
           └─── 7. Start Express Web Server
                     └─► port 5000
                           ├── Development: Vite middleware (HMR)
                           └── Production: serve dist/ (static files)
```

---

## 3. Luồng traffic mạng

### 3.1 Packet đi từ LAN ra Internet (Forward + NAT)

```
LAN Client (192.168.1.100)
        │  packet: src=192.168.1.100, dst=8.8.8.8
        ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                    LINUX NETFILTER                          │
 │                                                             │
 │   ┌─────────────┐    ┌─────────────┐    ┌───────────────┐  │
 │   │  PREROUTING │───►│   ROUTING   │───►│   FORWARD     │  │
 │   │  (-t nat)   │    │  (decision) │    │   (-t filter) │  │
 │   └─────────────┘    └─────────────┘    └───────┬───────┘  │
 │         │                                        │          │
 │   DNAT rules                              iptables rules    │
 │   (port forward)                          từ DB: ACCEPT/DROP│
 │                                                   │          │
 │                                           ┌───────▼───────┐  │
 │                                           │  POSTROUTING  │  │
 │                                           │  (-t nat)     │  │
 │                                           │  MASQUERADE   │  │
 │                                           └───────┬───────┘  │
 └───────────────────────────────────────────────────┼──────────┘
                                                     │
                                              src=WAN_IP:PORT
                                                     ▼
                                              Internet (8.8.8.8)
```

### 3.2 Packet đến từ Internet (Port Forwarding / DNAT)

```
Internet → WAN_IP:8080
        │
        ▼
 PREROUTING (nat table)
        │  DNAT rule: dst-port=8080 → 192.168.1.10:80
        ▼
 FORWARD (filter table)
        │  Rule: src=any, dst=192.168.1.10, dport=80 → ACCEPT
        ▼
 LAN Server (192.168.1.10:80)
```

### 3.3 Luật tường lửa (iptables FORWARD chain)

```
Packet đến FORWARD chain
        │
        ├─► Rule 1: src=192.168.1.0/24, dst=any, dport=80,443 → ACCEPT
        ├─► Rule 2: src=10.0.0.0/8, dst=192.168.1.0/24 → DROP
        ├─► Rule 3: state=ESTABLISHED,RELATED → ACCEPT
        └─► Default policy: DROP (whitelist mode)
```

---

## 4. Kiến trúc phần mềm

### 4.1 Tổng thể

```
┌────────────────────────────────────────────────────────────────┐
│                    Wallix NGFW Application                      │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Frontend (React)                     │  │
│  │                                                          │  │
│  │  Vite + TypeScript + TailwindCSS + shadcn/ui             │  │
│  │  TanStack Query (data fetching) + React Router           │  │
│  │  43 trang quản trị                                       │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │ HTTP/REST                          │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                   Backend (Express)                      │  │
│  │                                                          │  │
│  │  server/index.ts — Điều phối trung tâm                  │  │
│  │  ├── /api/rpc/*      Auth routes (login, change pw)      │  │
│  │  ├── /api/system/*   System commands (apply-config)      │  │
│  │  ├── /api/*          PostgREST-compatible CRUD           │  │
│  │  └── /*              React SPA (dev: Vite, prod: static) │  │
│  │                                                          │  │
│  │  Modules:                                                │  │
│  │  ├── server/agent.ts      Background metrics collector   │  │
│  │  ├── server/iptables.ts   Kernel networking integration  │  │
│  │  ├── server/setup.ts      First-boot CLI wizard          │  │
│  │  ├── server/auth.ts       JWT + bcrypt authentication    │  │
│  │  ├── server/postgrest.ts  Dynamic CRUD router            │  │
│  │  ├── server/seed.ts       Database seeder                │  │
│  │  └── server/db.ts         Drizzle ORM + PostgreSQL       │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │                  PostgreSQL 16                           │  │
│  │                                                          │  │
│  │  30+ tables: firewall_rules, nat_rules, interfaces,      │  │
│  │  system_metrics, traffic_stats, vpn_tunnels, dhcp, dns,  │  │
│  │  users, audit_logs, system_settings, ...                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Request lifecycle (REST API)

```
Trình duyệt
    │
    │  POST /api/rpc/authenticate
    │  { "p_email": "...", "p_password": "..." }
    ▼
Express Router (server/index.ts)
    │
    ├─► auth.ts: verify credentials (bcrypt)
    │        └─► PostgreSQL: SELECT * FROM users WHERE email=?
    │
    └─► Trả về JWT token (HS256, expires 8h)

Trình duyệt — mọi request sau:
    │
    │  GET /api/firewall_rules
    │  Authorization: Bearer <token>
    ▼
Express Router
    │
    ├─► Middleware: verifyJWT()
    │        ├─► Decode token
    │        ├─► Check expiry
    │        └─► Attach user to req
    │
    └─► postgrest.ts: dynamic CRUD handler
             └─► Drizzle ORM → PostgreSQL
             └─► Trả về JSON array
```

### 4.3 Frontend data flow

```
React Page (ví dụ: FirewallRules.tsx)
    │
    ├── useQuery({ queryKey: ['/api/firewall_rules'] })
    │       └─► Fetch GET /api/firewall_rules (với JWT header)
    │       └─► Cache với TanStack Query (stale-time: 30s)
    │
    ├── [User thêm luật mới]
    │
    └── useMutation → apiRequest('POST', '/api/firewall_rules', data)
             └─► Invalidate cache ['/api/firewall_rules']
             └─► UI tự cập nhật
```

---

## 5. Tích hợp kernel Linux

File: `server/iptables.ts`

### 5.1 Các lệnh được sử dụng

```
┌──────────────────────────────────────────────────────────────────┐
│  Chức năng          │ Lệnh Linux                                 │
├──────────────────────────────────────────────────────────────────┤
│  Kiểm tra iptables  │ which iptables && iptables -L -n           │
│  Flush rules        │ iptables -F FORWARD                        │
│  Thêm luật ACCEPT   │ iptables -I FORWARD -s SRC -d DST -j ACCEPT│
│  Thêm luật DROP     │ iptables -A FORWARD -j DROP                │
│  IP Forward sysctl  │ sysctl -w net.ipv4.ip_forward=1            │
│  IP Forward persist │ /etc/sysctl.d/99-wallix-forward.conf        │
│  NAT masquerade     │ iptables -t nat -A POSTROUTING -j MASQUERADE│
│  DNAT (port fwd)    │ iptables -t nat -A PREROUTING -p tcp       │
│                     │   --dport EXT -j DNAT --to-dest INT:PORT   │
│  Gán IP cho NIC     │ ip addr add IP/MASK dev IFACE              │
│  Xóa IP khỏi NIC   │ ip addr del IP/MASK dev IFACE              │
│  Bật NIC            │ ip link set IFACE up                       │
│  Tắt NIC            │ ip link set IFACE down                     │
│  Thêm route tĩnh    │ ip route add NET/MASK via GW               │
│  Xóa route          │ ip route del NET/MASK                      │
│  Xem bảng route     │ ip route show                              │
│  Netplan persist    │ /etc/netplan/90-wallix.yaml + netplan apply  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 applyFullConfig() — Master function

```
POST /api/system/apply-config
        │
        ▼
applyFullConfig()
        │
        ├─► 1. enableIpForwarding()
        │         sysctl net.ipv4.ip_forward=1
        │         persist: /etc/sysctl.d/99-wallix-forward.conf
        │
        ├─► 2. applyFirewallRules()
        │         iptables -F FORWARD  (flush hiện tại)
        │         iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
        │         Đọc DB → firewall_rules WHERE enabled=true
        │         Với mỗi rule: iptables -I/-A FORWARD [criteria] -j ACCEPT/DROP
        │         iptables -P FORWARD DROP  (default deny)
        │
        ├─► 3. enableNatMasquerade()
        │         Kiểm tra MASQUERADE đã tồn tại chưa
        │         Thêm: iptables -t nat -A POSTROUTING -j MASQUERADE
        │
        └─► 4. applyNatRules()
                  Đọc DB → nat_rules WHERE enabled=true
                  DNAT: iptables -t nat -A PREROUTING -p PROTO --dport EXT \
                        -j DNAT --to-destination INT_IP:INT_PORT
                  SNAT: iptables -t nat -A POSTROUTING -s SRC_NET \
                        -j SNAT --to-source SRC_IP
```

### 5.3 Graceful degradation

```
Lệnh iptables/ip thất bại
        │
        ├─► Nếu không phải root: log cảnh báo, tiếp tục
        ├─► Nếu iptables không có: trả về { available: false }
        ├─► Nếu thiếu permission: trả về { hasPermission: false }
        └─► Không crash server — UI vẫn hoạt động để dev/test
```

---

## 6. Cơ sở dữ liệu

### 6.1 Bảng chính

```
┌─────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL SCHEMA                         │
├─────────────────────────┬───────────────────────────────────────┤
│  Bảng                   │  Mô tả                                │
├─────────────────────────┼───────────────────────────────────────┤
│  users                  │  Tài khoản admin, bcrypt hash         │
│  system_settings        │  Key-value config (setup_complete,...) │
│  network_interfaces     │  Cấu hình NIC (WAN/LAN/OPT)           │
│  firewall_rules         │  Luật tường lửa IPv4                  │
│  nat_rules              │  DNAT/SNAT/Masquerade rules           │
│  static_routes          │  Bảng định tuyến tĩnh                 │
│  aliases                │  Nhóm địa chỉ IP (ipset)              │
│  virtual_ips            │  IP ảo (VIP)                          │
│  ip_pools               │  Pool IP cho NAT                      │
│  schedules              │  Lịch áp dụng luật                    │
│  services               │  Định nghĩa port/protocol             │
│  traffic_shapers        │  Cấu hình QoS bandwidth               │
│  traffic_shaping_policies│ Policy áp dụng shaper               │
│  wildcard_fqdns         │  Địa chỉ FQDN wildcard                │
│  dhcp_servers           │  Cấu hình DHCP server                 │
│  dhcp_leases            │  Lease DHCP hiện tại                  │
│  dhcp_static_mappings   │  MAC → IP tĩnh                       │
│  dns_servers            │  Cấu hình DNS server                  │
│  dns_overrides          │  Override DNS records                 │
│  dns_filter_profiles    │  Blocklist DNS filter                 │
│  vpn_tunnels            │  IPSec/WireGuard/OpenVPN tunnels       │
│  ids_signatures         │  IPS signature rules (Suricata)       │
│  ids_alerts             │  IPS alerts log                       │
│  packet_captures        │  Session bắt gói tin                  │
│  ha_config              │  High Availability (keepalived) config │
│  certificates           │  SSL/TLS certificates                 │
│  user_groups            │  Nhóm người dùng                      │
│  policy_routes          │  Policy-based routing rules           │
│  routing_protocols      │  OSPF/BGP/RIP configuration           │
│  system_metrics         │  CPU/RAM/Disk metrics (time-series)   │
│  traffic_stats          │  Bytes in/out theo NIC (time-series)  │
│  audit_logs             │  Nhật ký hành động admin              │
└─────────────────────────┴───────────────────────────────────────┘
```

### 6.2 Schema definitions

Toàn bộ schema được định nghĩa trong một file duy nhất:

```typescript
// shared/schema.ts — Nguồn sự thật duy nhất (Single Source of Truth)
// Drizzle ORM schema → tự động tạo TypeScript types + SQL migrations

export const firewallRules = pgTable('firewall_rules', {
  id:        serial('id').primaryKey(),
  name:      text('name').notNull(),
  enabled:   boolean('enabled').default(true),
  action:    text('action').notNull(),     // 'pass' | 'block'
  interface: text('interface').notNull(),  // 'WAN' | 'LAN' | 'any'
  direction: text('direction').notNull(),  // 'in' | 'out' | 'any'
  protocol:  text('protocol'),
  source:    jsonb('source'),
  destination: jsonb('destination'),
  logging:   boolean('logging').default(false),
  schedule:  text('schedule'),
  created_at: timestamp('created_at').defaultNow(),
});
```

### 6.3 Migrations

```bash
# Tự động sync schema với database (an toàn)
npx drizzle-kit push

# Xem SQL được generate
npx drizzle-kit generate
```

---

## 7. Xác thực & Bảo mật

### 7.1 Luồng đăng nhập

```
Browser                    Express              PostgreSQL
   │                          │                     │
   │  POST /api/rpc/authenticate                     │
   │  { email, password }     │                     │
   │─────────────────────────►│                     │
   │                          │  SELECT * FROM users│
   │                          │  WHERE email=?      │
   │                          │────────────────────►│
   │                          │◄────────────────────│
   │                          │  { hash, role, ... }│
   │                          │                     │
   │                          │  bcrypt.compare(    │
   │                          │    password, hash)  │
   │                          │                     │
   │                          │  jwt.sign({         │
   │                          │    userId, email,   │
   │                          │    role             │
   │                          │  }, JWT_SECRET,     │
   │                          │  { expiresIn: '8h' })
   │                          │                     │
   │◄─────────────────────────│                     │
   │  { token: "eyJ..." }     │                     │
```

### 7.2 Middleware xác thực

```typescript
// Mọi request /api/* (trừ /authenticate và /health) đều qua:
function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  req.user = payload;
  next();
}
```

### 7.3 Lưu trữ password

```
Plaintext password → bcrypt(saltRounds=12) → hash trong PostgreSQL
Không bao giờ lưu plaintext. Không thể đảo ngược.
```

---

## 8. Background Agent

File: `server/agent.ts`

Agent chạy ngầm trong cùng process với web server, thu thập metrics thực từ OS.

```
startAgent()
     │
     ├─── syncRealNetworkInterfaces()  [ngay + mỗi 2 phút]
     │         │
     │         ├── systeminformation.networkInterfaces()
     │         │     └─► Đọc /proc/net/dev, /sys/class/net/*
     │         │
     │         ├── ip route show default
     │         │     └─► Xác định interface WAN
     │         │
     │         └── Upsert vào DB: network_interfaces table
     │               (name, ip, mac, speed, status, type: WAN/LAN/OPT)
     │
     ├─── collectSystemMetrics()  [ngay + mỗi 30 giây]
     │         │
     │         ├── systeminformation.currentLoad()    → CPU %
     │         ├── systeminformation.mem()            → RAM total/used/free
     │         ├── systeminformation.fsSize()         → Disk usage
     │         ├── systeminformation.cpuTemperature() → Nhiệt độ
     │         ├── os.uptime()                        → Uptime
     │         └── INSERT vào system_metrics table
     │
     └─── collectNetworkStats()  [ngay + mỗi 60 giây]
               │
               ├── systeminformation.networkStats()
               │     └─► Đọc /sys/class/net/*/statistics/rx_bytes (real)
               │
               ├── Tính tốc độ: (current_bytes - prev_bytes) / elapsed_time
               │
               └── INSERT vào traffic_stats table
                     (interface, inbound_bytes, outbound_bytes, rx_speed, tx_speed)
```

---

## 9. Luồng áp dụng cấu hình

Khi admin nhấn "Apply Configuration" trên web UI:

```
Web UI → POST /api/system/apply-config
              │
              ▼
         applyFullConfig()
              │
              ├─► Bước 1: enableIpForwarding()
              │           ┌─────────────────────────────────┐
              │           │ sysctl -w net.ipv4.ip_forward=1 │
              │           │ echo "net.ipv4.ip_forward=1"    │
              │           │   >> /etc/sysctl.d/99-aegis.conf│
              │           └─────────────────────────────────┘
              │
              ├─► Bước 2: applyFirewallRules()
              │           ┌─────────────────────────────────┐
              │           │ iptables -F FORWARD             │ ← Flush cũ
              │           │ iptables -A FORWARD -m state \  │
              │           │   --state ESTABLISHED,RELATED \ │
              │           │   -j ACCEPT                     │ ← Allow return
              │           │                                 │
              │           │ SELECT * FROM firewall_rules    │ ← Đọc DB
              │           │   WHERE enabled=true            │
              │           │                                 │
              │           │ Với mỗi rule:                   │
              │           │ iptables -I FORWARD [rule] -j ACCEPT/DROP
              │           │                                 │
              │           │ iptables -P FORWARD DROP        │ ← Default deny
              │           └─────────────────────────────────┘
              │
              ├─► Bước 3: enableNatMasquerade()
              │           ┌─────────────────────────────────┐
              │           │ iptables -t nat -A POSTROUTING  │
              │           │   -j MASQUERADE                 │
              │           └─────────────────────────────────┘
              │
              └─► Bước 4: applyNatRules()
                          ┌─────────────────────────────────┐
                          │ SELECT * FROM nat_rules          │
                          │   WHERE enabled=true             │
                          │                                  │
                          │ DNAT: iptables -t nat -A PREROUTING
                          │   -p tcp --dport {ext_port}      │
                          │   -j DNAT --to-dest {int}:{port} │
                          │                                  │
                          │ SNAT: iptables -t nat -A POSTROUTING
                          │   -s {src_net}                   │
                          │   -j SNAT --to-source {src_ip}   │
                          └─────────────────────────────────┘
```

---

## 10. Triển khai Docker

### 10.1 Docker image build (multi-stage)

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
  npm ci
  npm run build          # Vite → dist/

# Stage 2: Production
FROM node:20-alpine AS production
  npm ci --omit=dev      # No devDeps
  COPY server/ shared/   # Backend source
  COPY --from=builder dist/ ./dist/  # Frontend built files
  CMD ["npx", "tsx", "server/index.ts"]
```

### 10.2 Yêu cầu đặc biệt của Docker cho NGFW

```yaml
# docker-compose.yml — cần privileged hoặc NET_ADMIN
services:
  aegis:
    privileged: true       # Cho phép iptables ghi vào host kernel
    network_mode: host     # Chia sẻ network namespace với host
                           # → NIC thật của host visible trong container
```

> **Tại sao cần `network_mode: host`?**
> Container mặc định có network namespace riêng (veth pair). Để quản lý NIC thật của host (ens3, ens4, eth0...) và thực thi iptables trên kernel của host, container phải chia sẻ network namespace với host.

### 10.3 So sánh deployment modes

```
┌─────────────────┬──────────────────────────────────────────────┐
│  Mode           │  iptables   NIC thật   Port binding          │
├─────────────────┼──────────────────────────────────────────────┤
│ Bare-metal      │  ✅          ✅           ✅ port 5000         │
│ Docker +        │  ✅          ✅           ✅ qua host          │
│   privileged    │             (qua host NS)                     │
│   +network=host │                                               │
│ Docker          │  ⚠️ chỉ trong│  ❌        ✅ port mapping      │
│   (thường)      │   container  │                                │
│ Docker Desktop  │  ❌          ❌           ✅ port mapping      │
│   (Mac/Win)     │                                               │
└─────────────────┴──────────────────────────────────────────────┘
```

---

## Tóm tắt luồng hoàn chỉnh — từ browser đến iptables

```
Admin mở trình duyệt
        │
        │  http://192.168.1.1:5000
        ▼
Express (Node.js) phục vụ React SPA (dist/index.html)
        │
        │  [Admin đăng nhập]
        ▼
POST /api/rpc/authenticate → JWT token (lưu trong localStorage)
        │
        │  [Admin tạo luật tường lửa mới]
        ▼
POST /api/firewall_rules
  Body: { action: "pass", source: "192.168.1.0/24", destination: "any" }
        │
        ▼
PostgreSQL: INSERT INTO firewall_rules ...
        │
        │  [Admin nhấn "Apply Configuration"]
        ▼
POST /api/system/apply-config
        │
        ▼
server/iptables.ts: applyFullConfig()
        │
        ├── iptables -F FORWARD
        ├── iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT
        ├── iptables -I FORWARD -s 192.168.1.0/24 -j ACCEPT   ← luật mới
        ├── iptables -P FORWARD DROP
        └── iptables -t nat -A POSTROUTING -j MASQUERADE
        │
        ▼
Linux kernel netfilter áp dụng luật
        │
        ▼
LAN clients (192.168.1.x) có internet theo luật đã định ✅
```

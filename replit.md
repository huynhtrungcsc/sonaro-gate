# Sonaro Gate 2025.1 LTS — Developer Handbook

> **Internal reference document.** Covers architecture, data patterns, feature status, coding conventions, and commit rules for every engineer working on this codebase.

## Replit Setup

- **Workflow**: `Start application` — runs `NODE_ENV=development npx tsx server/index.ts` on port 5000
- **Database**: Replit built-in PostgreSQL (credentials injected via environment secrets)
- **Environment Variables**: `NODE_ENV`, `PORT`, `JWT_SECRET`, `SONARO_SKIP_SETUP`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` set in shared environment
- **Default Login**: `admin@sonaro.local` / `Admin123!`
- The server runs both frontend (via Vite dev middleware) and backend API on port 5000

---

## 1. Project Identity

| Item | Value |
|---|---|
| Product name | **Sonaro Gate** |
| Version | **2025.1 LTS** |
| Brand tagline | Next-Generation Firewall Management |
| Default hostname | `sonaro-gw-01` |
| Serial prefix | `SGW-` |
| Default admin | `admin@sonaro.local` / `Admin123!` |
| Install path (production) | `/opt/sonaro` |
| Auth endpoint | `POST /api/rpc/authenticate` → `{ p_email, p_password }` |
| WebSocket path | `/ws` |
| Demo mode | Hardcoded `false` in `DemoModeContext` — **do NOT delete the context** |

---

## 2. Architecture Overview

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| Routing (frontend) | `wouter` + `react-router-dom` |
| Data fetching | TanStack Query v5 |
| Backend | Node.js 20, Express.js, TypeScript (`tsx`) |
| Database | PostgreSQL 16, Drizzle ORM, drizzle-zod |
| Real-time | WebSocket (`ws` package, `noServer` mode) |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| OS integration | `child_process.exec` → iptables, ip, sysctl, netplan, suricata |
| Metrics collection | `systeminformation` library |

### Port Layout

Everything runs on **port 5000**:
- HTTP API (`/api/*`)
- React frontend (Vite dev middleware or built static files)
- WebSocket (`/ws` — live metrics push)
- Vite HMR WebSocket (dev only — shares port 5000, no conflict)

### WebSocket Architecture (CRITICAL — do not break this)

The WebSocket server uses `noServer: true` to avoid intercepting Vite's HMR WebSocket:

```
HTTP server (port 5000)
     │
     ├── All HTTP requests → Express routes
     │
     └── WebSocket upgrades → manual routing in httpServer.on('upgrade', ...)
              │
              ├── path === '/ws'     → our WebSocket server (live metrics)
              └── everything else    → Vite HMR WebSocket (left untouched)
```

- `server/ws.ts` — WebSocket server (`noServer: true`) + `broadcast(type, data)` function
- `server/agent.ts` — calls `broadcast('metrics', payload)` every 30s and `broadcast('traffic', payload)` every 60s
- `server/index.ts` — creates `httpServer` BEFORE Vite, passes `hmr: { server: httpServer }` to Vite
- `src/hooks/useRealtimeMetrics.ts` — frontend hook, connects via `wss://<host>/ws`, auto-reconnects every 3s

**DO NOT** change `ws.ts` back to `{ server: httpServer, path: '/ws' }` — this breaks Vite HMR and causes browser `[vite] server connection lost` crash loops.

---

## 3. Running the Application

### Development (Replit)

Workflow: **`Start application`** → runs `npx tsx server/index.ts`

Boot sequence:
1. Load `.env`
2. Connect to PostgreSQL (Replit-managed)
3. Seed admin user if not present
4. Skip CLI wizard (no root on Replit)
5. Start background agent (metrics every 30s, network stats every 60s)
6. Attach WebSocket server (`/ws`)
7. Register all API routes
8. Start Vite dev middleware on port 5000

### Production (Ubuntu 24.04 bare-metal)

```bash
# Automated full installer (recommended — installs everything)
sudo bash scripts/setup-ubuntu.sh

# Or manual start after installation
sudo systemctl start sonaro-gate

# Or direct start (for first-boot wizard)
sudo npx tsx server/index.ts
```

The setup wizard runs automatically when:
- Process is root (`uid === 0`)
- Terminal is a TTY (not piped)
- `setup_complete` setting is not set in DB
- `SONARO_SKIP_SETUP` env var is not set

### Docker

```bash
cp .env.example .env
docker compose up -d
# Requires privileged: true + network_mode: host for real iptables
```

**Docker image base (production stage):** `ubuntu:24.04` — required for native `netplan` support.
Alpine was replaced because `netplan` is Ubuntu-specific. Builder stage remains `node:20-alpine`.

**Packages installed in production container:**
- `iproute2` — `ip addr`, `ip route`, `ip link`
- `iptables` — full iptables/ip6tables stack
- `ipset` — dynamic address sets
- `netplan.io` — `netplan generate` / `netplan apply` (Ubuntu-native)
- `isc-dhcp-client` (`dhclient`) — DHCP client for WAN apply
- `dhcpcd` — lightweight DHCP fallback
- `procps` — `pgrep` for detecting running `dhclient` processes

**DHCP lease volume mounts** (for `detectIpMode()` in `server/agent.ts`):
| Mount | Purpose |
|---|---|
| `/var/lib/dhcp:/var/lib/dhcp:ro` | dhclient lease files |
| `/var/lib/dhcpcd:/var/lib/dhcpcd:ro` | dhcpcd lease/info files |
| `/run/systemd/netif:/run/systemd/netif:ro` | systemd-networkd lease files (Ubuntu 22.04+) |

---

## 4. Key Files Reference

### Server

| File | Purpose |
|---|---|
| `server/index.ts` | Express entry point — registers all routes, creates HTTP + WebSocket server |
| `server/agent.ts` | Background OS metrics collector — every 30s/60s, broadcasts via WebSocket. `syncRealNetworkInterfaces()` detects actual NICs and their ip_mode (dhcp/static/unconfigured) via: 1) ip route proto dhcp, 2) systemd lease files, 3) dhclient process, 4) netplan YAML parsing |
| `server/ws.ts` | WebSocket server (`noServer` mode) — `broadcast(type, data)` function |
| `server/iptables.ts` | Kernel integration: iptables, ip addr/route, sysctl, netplan |
| `server/suricata.ts` | Suricata IPS management — start/stop/reload, custom rules, signature update |
| `server/setup.ts` | CLI setup wizard (pfSense-style, first boot only) |
| `server/auth.ts` | JWT sign/verify, bcrypt password hashing, `requireAuth` middleware |
| `server/postgrest.ts` | PostgREST-compatible CRUD router for all 30+ DB tables |
| `server/seed.ts` | Seeds admin user (`admin@sonaro.local / Admin123!`) + system settings + 30 default services + 7 schedules + 6 traffic shapers + 4 shaping policies + virtual IPs + IP pools + wildcard FQDNs + DNS defaults |
| `server/db.ts` | Drizzle ORM connection to PostgreSQL |

### Shared

| File | Purpose |
|---|---|
| `shared/schema.ts` | **Single source of truth** — Drizzle ORM schema for all tables (snake_case column names) |

### Frontend Core

| File | Purpose |
|---|---|
| `src/App.tsx` | React Router routes — maps paths to page components |
| `src/hooks/useDbData.ts` | 27 TanStack Query hooks for all DB tables |
| `src/hooks/useRealtimeMetrics.ts` | WebSocket client hook — receives live metrics, auto-reconnects |
| `src/lib/api.ts` | CRUD API clients (`createCrud()`) for all tables |
| `src/lib/queryClient.ts` | TanStack Query configuration + default `fetch` wrapper |
| `src/contexts/AuthContext.tsx` | Login state, JWT token storage |
| `src/contexts/DemoModeContext.tsx` | Always returns `false` — **never delete** |

### Deployment

| File | Purpose |
|---|---|
| `scripts/setup-ubuntu.sh` | Comprehensive Ubuntu 24.04 installer — Suricata, WireGuard, OpenVPN, dnsmasq, PostgreSQL, systemd |
| `Dockerfile` | Multi-stage: node:20-alpine builder (Vite + drizzle-kit) → ubuntu:24.04 production runtime (netplan, dhclient, iptables, dhcpcd) |
| `docker-compose.yml` | PostgreSQL 16 + Sonaro Gate stack |
| `.env.example` | Environment variable template |

---

## 5. Database Schema

### Column naming
- All PostgreSQL column names are **snake_case** (e.g., `src_ip`, `valid_from`, `key_type`)
- Drizzle ORM returns them as-is — use snake_case in JSX: `sig.valid_from`, `cert.key_type`
- When a field might be missing: `(item as any).snake_case ?? (item as any).camelCase ?? defaultValue`

### Schema management

```bash
# Push schema changes (safe — non-destructive)
npm run db:push

# Never change primary key column types (serial ↔ varchar = destructive)
# Never manually write SQL migrations
```

### Tables (30+)

`firewall_rules`, `nat_rules`, `network_interfaces`, `static_routes`, `policy_routes`, `vpn_tunnels`, `ip_pools`, `virtual_ips`, `wildcard_fqdns`, `traffic_shapers`, `traffic_shaping_policies`, `dhcp_servers`, `dhcp_static_mappings`, `dhcp_leases`, `dns_servers`, `dns_records`, `dns_filter_profiles`, `ids_signatures`, `certificates`, `schedules`, `audit_logs`, `system_settings`, `system_metrics`, `traffic_stats`, `users`, `user_roles`

---

## 6. API Endpoints

### Auth

```
POST /api/rpc/authenticate     { p_email, p_password } → { token }
POST /api/rpc/change_password  { old_password, new_password }
```

### System / Kernel

```
GET  /api/system/iptables                  Current iptables rules (requires root)
GET  /api/system/nftables                  nftables rules
GET  /api/system/routes                    ip route table
GET  /api/system/ip-forward                IP forwarding status
POST /api/system/ip-forward/enable         Enable IP forwarding
POST /api/system/apply-rule                Apply single firewall rule
POST /api/system/apply-all-rules           Apply ALL firewall rules to kernel
POST /api/system/apply-nat-rules           Apply ALL NAT rules to kernel
POST /api/system/nat-masquerade            Enable masquerade on interface
POST /api/system/apply-config              Apply full config (firewall + NAT + netplan)
GET  /api/system/interfaces                Real NIC list from OS
GET  /api/system/interfaces/:name          Single interface details
POST /api/system/interfaces/:name/apply    Apply interface config to OS + netplan + DB
                                           Body: { ip_mode: 'static'|'dhcp', ip_address?, subnet?, gateway?, description? }
                                           Returns: { success, root, netplan, message }
POST /api/system/interfaces/:name/state    Set interface up/down
POST /api/system/netplan/apply             Write + apply Netplan config
GET  /api/health                           Health check — returns { root: bool, ... }
```

### IPS (Suricata)

```
GET  /api/system/ips/status                 Engine status (installed/running/version/ruleCount)
POST /api/system/ips/start                  Start Suricata service
POST /api/system/ips/stop                   Stop Suricata service
POST /api/system/ips/reload                 Hot-reload rules (SIGUSR2)
POST /api/system/ips/update-signatures      Run suricata-update + reload
POST /api/system/ips/rules                  Add custom rule → writes to sonaro-local.rules
PATCH /api/system/ips/rules/:sid/enabled    Enable/disable rule by SID
DELETE /api/system/ips/rules/:sid           Delete rule by SID
GET  /api/system/ips/alerts                 Read recent alerts from fast.log
```

### CRUD (all DB tables)

```
GET    /api/<table>               List (supports ?col=operator.val, ?order=col.asc, ?limit=N)
POST   /api/<table>               Create
PATCH  /api/<table>?id=eq.<id>    Update
DELETE /api/<table>?id=eq.<id>    Delete
```

---

## 7. Frontend Patterns

### Data fetching — TanStack Query v5

```typescript
// READ: use a hook from useDbData.ts
const { data: rules = [], isLoading } = useFirewallRules();

// WRITE: useMutation + cache invalidation
const queryClient = useQueryClient();
const createMut = useMutation({
  mutationFn: (data: InsertType) => firewallRulesApi.create(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/firewall_rules'] }),
  onError: () => toast.error('Failed to create rule'),
});
```

**Rules:**
- Never define your own `queryFn` — the global fetcher handles auth headers automatically
- Always invalidate cache after mutations — use array queryKey for hierarchical data: `['/api/firewall_rules', id]`
- Show loading states: `isLoading` for queries, `isPending` for mutations

### Forms — react-hook-form + zodResolver

```typescript
const form = useForm<InsertType>({
  resolver: zodResolver(insertSchema),
  defaultValues: { name: '', enabled: true },
});

// Always provide defaultValues — the form is controlled
// Log form.formState.errors if submission silently fails
```

### Standard CSS classes

```
.forti-toolbar          Horizontal toolbar strip (flex row)
.forti-toolbar-btn      Toolbar button; add .primary for accent color
.forti-toolbar-separator  Vertical divider in toolbar
.forti-search           Search input container
.data-table             Full-width table with FortiGate styling
.data-table-row-selected  Selected row highlight
.section                Card/section container
.section-header         Section title bar
.forti-input            Text input
.forti-select           Select dropdown
.forti-label            Form label (right-aligned, grey)
.widget                 Dashboard widget card
```

### Component gotchas

- `FortiToggle` props: `enabled` (boolean) + `onToggle` or `onChange` — **NOT** `checked`
- `<SelectItem>` must have a `value` prop or it throws
- `useToast` is exported from `@/hooks/use-toast`
- Do not explicitly import React — Vite's JSX transformer handles it
- Use `import.meta.env.VITE_*` for frontend env vars (not `process.env`)
- Add `data-testid` attributes to all interactive elements

---

## 8. Feature Status

### Fully Implemented (kernel-level)

- ✅ Firewall rules → `iptables -A FORWARD`
- ✅ NAT / masquerade → `iptables -t nat -A POSTROUTING -j MASQUERADE`
- ✅ Port forwarding (DNAT) → `iptables -t nat -A PREROUTING -j DNAT`
- ✅ IP forwarding → `sysctl net.ipv4.ip_forward=1`
- ✅ Interface management → `ip addr`, `ip link`
- ✅ Static routes → `ip route add`
- ✅ Netplan persistence → `/etc/netplan/90-sonaro.yaml`
- ✅ Real OS metrics → `systeminformation` library → `/proc`, `/sys`
- ✅ WebSocket live push → metrics every 30s, traffic every 60s
- ✅ IDS/IPS engine control → `server/suricata.ts` → Suricata lifecycle + rules

### DB-Wired UI (full CRUD, waiting for external daemon)

- ✅ DNS Server — Forward Zones, Local Records, DNS Filter Profiles
- ✅ DHCP — Servers, Static Mappings, Leases
- ✅ Certificates — DB wired, snake_case field names
- ✅ VPN Tunnels — IPSec, SSL
- ✅ Policy Routes — DB wired, mutations
- ✅ Schedules — DB wired
- ✅ Traffic Shapers — DB wired
- ✅ IDS Signatures — DB wired + Suricata rule writing

### UI Ready, External Daemon Required

- 🔧 DHCP daemon → install `dnsmasq`, configure `/etc/dnsmasq.d/`
- 🔧 DNS daemon → install `dnsmasq` or `bind9`
- 🔧 WireGuard VPN → `setup-ubuntu.sh` generates keys, UI manages them
- 🔧 OpenVPN → `setup-ubuntu.sh` generates PKI, UI manages tunnels
- 🔧 Packet capture → install `tcpdump`
- 🔧 HA/VRRP → install `keepalived`
- 🔧 Dynamic routing → install `frrouting` (OSPF/BGP/RIP)
- 🔧 QoS/Traffic shaping → `tc qdisc`

---

## 9. Pages (43 total)

All pages use real DB hooks and mutations. No fake/hardcoded data.

| Path | Component | DB Tables Used |
|---|---|---|
| `/` | `Index.tsx` | `system_metrics`, `traffic_stats`, `system_settings` |
| `/interfaces` | `Interfaces.tsx` | `network_interfaces` |
| `/firewall/rules` | `Firewall.tsx` | `firewall_rules` |
| `/firewall/nat` | `NAT.tsx` | `nat_rules` |
| `/firewall/virtual-ips` | `VirtualIPs.tsx` | `virtual_ips` |
| `/firewall/schedules` | `Schedules.tsx` | `schedules` |
| `/firewall/traffic-shapers` | `TrafficShaper.tsx` | `traffic_shapers`, `traffic_shaping_policies` |
| `/firewall/wildcard-fqdn` | `WildcardFQDN.tsx` | `wildcard_fqdns` |
| `/security/ids` | `IDSSettings.tsx` | `ids_signatures` + Suricata API |
| `/security/dnsfilter` | `DNSFilter.tsx` | `dns_filter_profiles` |
| `/security/certificates` | `CertificateManagement.tsx` | `certificates` |
| `/routing/static` | `StaticRouting.tsx` | `static_routes` |
| `/routing/policy` | `PolicyRoutes.tsx` | `policy_routes` |
| `/routing/ospf` | `OSPFRouting.tsx` | (UI ready) |
| `/routing/bgp` | `BGPRouting.tsx` | (UI ready) |
| `/routing/rip` | `RIPRouting.tsx` | (UI ready) |
| `/dns` | `DNSServer.tsx` | `dns_servers`, `dns_records`, `dns_filter_profiles` |
| `/dhcp` | `DHCP.tsx` | `dhcp_servers`, `dhcp_static_mappings`, `dhcp_leases` |
| `/vpn/ipsec` | `VPN.tsx` | `vpn_tunnels`, `ip_pools` |
| `/vpn/ssl` | `SSLVPN.tsx` | `vpn_tunnels` |
| `/packet-capture` | `PacketCapture.tsx` | (UI ready) |
| `/system/admins` | `UserManagement.tsx` | `users`, `user_roles` |
| `/system/settings` | `SystemSettings.tsx` | `system_settings` |
| `/system/ha` | `HighAvailability.tsx` | (UI ready) |
| `/system/backup` | `BackupRestore.tsx` | (UI ready) |
| `/monitoring/traffic` | `TrafficMonitor.tsx` | `traffic_stats` |
| `/threats` | `ThreatMonitor.tsx` | (Suricata alerts) |
| `/logs` | `LogReport.tsx` | `audit_logs` |

**Note:** `/routing` (bare path) is NOT sidebar-linked — it's an unused fallback redirect page. Sidebar links go to `/routing/static`, `/routing/policy`, etc.

---

## 10. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Yes |
| `JWT_SECRET` | Min 32 chars random string | Yes (production) |
| `PORT` | HTTP server port | No (default: 5000) |
| `NODE_ENV` | `development` or `production` | No (default: development) |
| `ADMIN_EMAIL` | Seed admin email | No |
| `ADMIN_PASSWORD` | Seed admin password | No |
| `SONARO_SKIP_SETUP` | Set to `1` to skip first-boot wizard | No |

---

## 11. Suricata IPS Integration

### Files

- `server/suricata.ts` — all Suricata operations
- Custom rules stored at: `/etc/suricata/rules/sonaro-local.rules`
- Suricata config: `/etc/suricata/suricata.yaml`
- Alert log: `/var/log/suricata/fast.log`

### Key functions

```typescript
getSuricataStatus()          → { installed, running, version, ruleCount, pid }
startSuricata()              → systemctl start suricata
stopSuricata()               → systemctl stop suricata
reloadSuricata()             → kill -USR2 $(pidof suricata)  [live reload, no restart]
updateSignatures()           → suricata-update + reload
addLocalRule(params)         → append to sonaro-local.rules + reload
setRuleEnabled(sid, bool)    → comment/uncomment rule by SID + reload
deleteRule(sid)              → remove line by SID + reload
getRecentAlerts(limit)       → tail /var/log/suricata/fast.log
```

### Rule SID allocation

- SID range `9000000–9999999` — reserved for Sonaro Gate custom rules
- Generated as: `Date.now() % 1_000_000 + 9_000_000`
- ET/Open rules use lower SID ranges (1–7999999)

### Install on Ubuntu

```bash
apt-get install suricata suricata-update
suricata-update     # download ET/Open rule sets
systemctl enable suricata && systemctl start suricata
```

---

## 12. Dashboard Real-Time Indicator

The Dashboard (`Index.tsx`) shows a **tiny 6px pulsing dot** (green = connected, amber = reconnecting) in the top-right corner of the toolbar. No bold text labels. The `Updated HH:MM:SS` timestamp appears on the left in small grey text.

**Design rule**: Professional NGFW consoles (FortiGate, pfSense) don't display large "LIVE" labels — just a subtle LED-style status indicator.

---

## 13. Coding Conventions

### Component pattern

```typescript
// ✅ Correct — snake_case from DB, safe fallback
{sig.valid_from ?? (sig as any).validFrom ?? '—'}

// ✅ Correct — FortiToggle
<FortiToggle enabled={rule.enabled} onToggle={() => toggle(rule.id)} />

// ❌ Wrong — FortiToggle has no checked prop
<FortiToggle checked={rule.enabled} />
```

### Mutation pattern

```typescript
const mut = useMutation({
  mutationFn: (data: InsertType) => myApi.create(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/my_table'] }),
  onError: () => toast.error('Failed'),
});
// Call: mut.mutate(formData)
// Loading: mut.isPending
```

### API fetch outside React Query (for action buttons)

```typescript
async function apiPost(url: string, body?: object) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  return r.json();
}
```

### Import rules

Every component must have its imports present. Common pattern that causes crashes:
```typescript
// If StatsBar is used in JSX, this import MUST exist:
import { StatsBar } from '@/components/ui/stats-bar';
```

---

## 14. Git Commit Convention

**Always apply this convention when committing or pushing to GitHub.**

### Format (Conventional Commits)

```
<type>(<scope>): <short English description, lowercase, no period, max 72 chars>

<optional body — explains WHY, not just what>
```

### Valid types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only (README, ARCHITECTURE…) |
| `chore` | Config changes, no logic impact |
| `refactor` | Code restructure, no new feature |
| `style` | CSS/UI-only changes |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |
| `security` | Security vulnerability patch |

### Author config (required for every commit)

```bash
git config user.name "Huỳnh Chí Trung"
git config user.email "huynhtrungcsc@users.noreply.github.com"
```

### Absolute prohibitions

- ❌ Never use the word "Replit" in a commit message
- ❌ Never use the word "Lovable" in a commit message
- ❌ Never write the commit title in Vietnamese

### Correct examples

```
feat(ips): integrate suricata backend with real rule management
fix(websocket): use noServer mode to avoid hijacking vite hmr
fix(ids): add missing StatsBar import in LogReport and CertificateManagement
feat(dashboard): replace bold LIVE label with subtle pulsing dot indicator
docs(readme): rewrite with full architecture diagrams and ubuntu deploy guide
feat(installer): add comprehensive ubuntu setup script for suricata wireguard openvpn
```

---

## 15. Dependencies

### Backend

`express`, `cors`, `dotenv`, `pg`, `drizzle-orm`, `drizzle-kit`, `drizzle-zod`, `systeminformation`, `bcryptjs`, `jsonwebtoken`, `ws`, `tsx`

### Frontend

`react`, `react-dom`, `vite`, `tailwindcss`, `@tanstack/react-query`, `wouter`, `react-router-dom`, `lucide-react`, `react-icons`, `sonner`, `zod`, `@hookform/resolvers`, `react-hook-form`, `recharts`, plus all `@radix-ui/*` and `shadcn/ui` components

### Do not edit `package.json` directly

Use the package management tools to install dependencies. Never modify `package.json` scripts.

---

## 16. CI/CD Pipeline

| Trigger | Action |
|---|---|
| Push / PR to `main` | TypeScript typecheck → Vite build → Docker build → `npm audit` |
| Tag `v*.*.*` | Multi-platform Docker image built → pushed to GHCR → GitHub Release created |

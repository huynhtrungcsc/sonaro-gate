# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2025.1 LTS | ✅ Active |
| Older | ⚠️ Security fixes only |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

**Preferred method:** Use [GitHub Security Advisories](https://github.com/huynhtrungcsc/sonaro-gate/security/advisories/new) to report privately.

**Alternative:** Email **huynhtrungcsc@gmail.com** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within **48 hours** and provide a detailed response within **7 days**.

## Repository

- **GitHub**: [https://github.com/huynhtrungcsc/sonaro-gate](https://github.com/huynhtrungcsc/sonaro-gate)
- **Issues**: [https://github.com/huynhtrungcsc/sonaro-gate/issues](https://github.com/huynhtrungcsc/sonaro-gate/issues)

## Security Measures

### Application Security

- **Authentication**: Email/password with bcrypt hashing (cost factor 10)
- **Authorization**: JWT tokens; all routes behind `requireAuth` middleware
- **Input Validation**: Zod schema validation on all API request bodies
- **Audit Logging**: Every configuration change is logged with actor, timestamp, and action detail
- **No demo mode**: The UI always reflects real system data — no simulation mode in production

### Infrastructure Security

- **TLS**: Use nginx reverse proxy with Let's Encrypt or self-signed certificate — see README.md
- **Rate Limiting**: Configure nginx upstream rate limiting for the management port
- **Database**: `scram-sha-256` PostgreSQL authentication; `.env` file chmod 600
- **Containers**: Docker requires `privileged: true` + `network_mode: host` for iptables — isolate management access accordingly
- **Secrets**: All secrets auto-generated with `openssl rand -hex 32`

### Network Security

- Firewall rules enforced directly in the Linux kernel via `iptables`
- IDS/IPS integration via Suricata — custom rules managed through the web UI
- NAT masquerade and DNAT port forwarding via `iptables -t nat`
- IP forwarding controlled via `sysctl net.ipv4.ip_forward`

## Best Practices for Deployment

1. **Change default credentials** immediately after first login (`admin@sonaro.local` / `Admin123!`)
2. **Generate a strong JWT_SECRET**: `openssl rand -hex 32`
3. **Restrict management port**: Only allow your admin IP to reach port 5000
   ```bash
   iptables -A INPUT -p tcp --dport 5000 -s <YOUR_ADMIN_IP> -j ACCEPT
   iptables -A INPUT -p tcp --dport 5000 -j DROP
   netfilter-persistent save
   ```
4. **Use HTTPS**: Set up nginx with TLS in front of port 5000 — see README.md §12
5. **Keep the system updated**:
   ```bash
   apt update && apt upgrade
   cd /opt/sonaro && git pull && npm install && npm run build && systemctl restart sonaro-gate
   ```
6. **Monitor logs**:
   ```bash
   journalctl -u sonaro-gate -f          # application logs
   tail -f /var/log/suricata/fast.log    # IPS alerts
   ```
7. **Use a dedicated server** — avoid running Sonaro Gate on a shared or multi-purpose machine

## Default Credentials (change immediately)

| Email | Password |
|---|---|
| `admin@sonaro.local` | `Admin123!` |

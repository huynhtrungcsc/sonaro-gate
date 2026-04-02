# Contributing to Sonaro Gate

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- Docker & Docker Compose (for full stack testing)
- PostgreSQL 16 (local or via Docker)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/huynhtrungcsc/sonaro-gate.git
cd sonaro-gate

# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env — set DATABASE_URL at minimum

# Push database schema
npm run db:push

# Start development server (Express + Vite on port 5000)
npx tsx server/index.ts
```

### Full Stack with Docker

```bash
# Start PostgreSQL + Sonaro Gate
cp .env.example .env
docker compose up -d

# Watch logs
docker compose logs -f sonaro-gate
```

## Project Structure

```
server/         — Backend: Express, iptables, Suricata, agent, WebSocket
src/pages/      — 43 management page components
src/components/ — Reusable UI components (Shell, Sidebar, FortiToggle…)
src/hooks/      — TanStack Query data hooks (useDbData.ts, useRealtimeMetrics.ts)
src/lib/        — API client, queryClient, utilities
src/contexts/   — Auth context, DemoMode context
shared/         — Drizzle ORM schema (single source of truth)
scripts/        — Ubuntu deployment and installer scripts
```

## Code Style

- **TypeScript** strict mode throughout
- **Tailwind CSS** with the existing FortiGate-style CSS classes (`.forti-toolbar`, `.data-table`, `.section`)
- **shadcn/ui** components as the base UI library
- **Column names**: all DB columns are `snake_case` — use them as-is in JSX (e.g., `rule.src_ip`)
- **Data fetching**: always use TanStack Query hooks from `src/hooks/useDbData.ts`
- **Mutations**: always invalidate the relevant query cache with `queryClient.invalidateQueries()`
- **No demo/fake data**: all pages must use real DB hooks — zero hardcoded data

## Git Commit Convention

All commits **must** follow the Conventional Commits format:

```
<type>(<scope>): <short English description, lowercase, no period, max 72 chars>
```

Valid types: `feat`, `fix`, `docs`, `chore`, `refactor`, `style`, `perf`, `ci`, `security`

```bash
# Set author before committing
git config user.name "Huỳnh Chí Trung"
git config user.email "huynhtrungcsc@users.noreply.github.com"
```

Examples:
```
feat(firewall): add iptables FORWARD chain enforcement
fix(websocket): use noServer mode to coexist with vite hmr
docs(readme): add ubuntu 24.04 step-by-step deployment guide
feat(ips): integrate suricata backend with real rule management
```

**Never** include "Replit" or "Lovable" in commit messages.
**Never** write the commit title in Vietnamese.

## Submitting Changes

1. Fork the repository: [https://github.com/huynhtrungcsc/sonaro-gate](https://github.com/huynhtrungcsc/sonaro-gate)
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and verify TypeScript: `npx tsc --noEmit`
4. Open a Pull Request with:
   - Clear description of what changed and why
   - Screenshots for UI changes
   - Steps to test

## Reporting Issues

Use [GitHub Issues](https://github.com/huynhtrungcsc/sonaro-gate/issues)

Include: steps to reproduce, expected behavior, actual behavior, OS/Node.js version.

For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

# FieldPulse — Implementation Plan

FieldPulse is a cross-platform sales tool for field sales reps. Reps log in, browse their
accounts, record visits, move deals through a pipeline and see quota progress — from an
Expo/React Native app on the road or from a browser at their desk. Both clients share the
same TypeScript domain logic, Zod API contracts and typed API client through a Turborepo
monorepo. A Node API persists data (including login sessions) in PostgreSQL, and GitHub
Actions runs lint, typecheck, tests and builds for every package.

## Key decisions

| Area | Decision | Why |
|---|---|---|
| Monorepo | Turborepo + npm workspaces | Cached, dependency-aware task graph across apps/packages |
| Contracts | `@fieldpulse/contracts` — Zod schemas, types inferred with `z.infer` | One source of truth; validated on server *and* client |
| Shared logic | `@fieldpulse/core` — pure TS (pipeline math, quota, visit planning, offline queue) | Runs identically on mobile, web, and API; trivially unit-tested |
| API client | `@fieldpulse/api-client` — fetch wrapper that parses every response with Zod | Contract drift fails loudly instead of silently |
| Backend | Express + `pg`, SQL migrations, opaque session tokens stored hashed in Postgres | "PostgreSQL for session persistence"; revocable sessions, no JWT secrets on device |
| Mobile | Expo (React Native) + React Navigation, SecureStore for token | Fast cross-platform setup |
| Web | Vite + React + React Router, localStorage token | Lightweight web target sharing the same packages |
| Tests | Vitest in packages + API (supertest with a fake repository) | Fast, no DB required for unit tests |
| CI/CD | GitHub Actions: install → lint → typecheck → test → build via `turbo`, plus Postgres service for migration check; web build artifact + EAS build on tags | Automated pipelines across all packages |

## Phases

### Phase 1 — Monorepo scaffold + Zod contracts
Deliverables: workspace root, Turborepo pipeline, shared tsconfig, contracts package with
schemas for auth, accounts, contacts, visits, deals and pipeline summaries, plus tests.
Files:
- `package.json`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.eslintrc.cjs`, `.prettierrc`
- `packages/contracts/{package.json,tsconfig.json,vitest.config.ts}`
- `packages/contracts/src/{index,common,auth,accounts,visits,deals,pipeline,routes}.ts`
- `packages/contracts/test/contracts.test.ts`

### Phase 2 — Shared core logic + typed API client
Deliverables: pure domain functions (weighted pipeline, stage transitions, quota attainment,
visit route planning by distance, overdue follow-ups, formatting), an offline mutation queue
with pluggable storage, and a Zod-validating API client.
Files:
- `packages/core/src/{index,pipeline,quota,visits,geo,format,offlineQueue}.ts`, tests
- `packages/api-client/src/{index,client,errors}.ts`, tests

### Phase 3 — API server with PostgreSQL
Deliverables: Express API, config via env, pg pool, SQL migrations + runner, seed script,
repositories, password hashing (scrypt), Postgres-backed sessions with expiry/revocation,
auth middleware, Zod validation middleware, routes for auth/accounts/visits/deals/pipeline,
error handling, tests using an in-memory repository. `docker-compose.yml` for Postgres.
Files:
- `apps/api/src/{index,app,config,db,errors}.ts`
- `apps/api/src/middleware/{auth,validate}.ts`
- `apps/api/src/repositories/{types,pg,memory}.ts`
- `apps/api/src/routes/{auth,accounts,visits,deals,pipeline}.ts`
- `apps/api/src/services/{passwords,sessions}.ts`
- `apps/api/migrations/*.sql`, `apps/api/scripts/{migrate,seed}.ts`
- `apps/api/test/*.test.ts`, `docker-compose.yml`, `.env.example`

### Phase 4 — Mobile (Expo) and web (Vite) clients
Deliverables: both clients consume `core` + `api-client`; screens for login, today's
visit plan, accounts list/detail, log visit, pipeline board with stage moves, quota card.
Mobile queues mutations offline and flushes on reconnect.
Files:
- `apps/mobile/{app.json,package.json,babel.config.js,metro.config.js,tsconfig.json,App.tsx}`
- `apps/mobile/src/{api,auth,storage,navigation}.ts(x)`, `apps/mobile/src/screens/*.tsx`
- `apps/web/{index.html,package.json,vite.config.ts,tsconfig.json}`
- `apps/web/src/{main,App,api,auth}.tsx`, `apps/web/src/pages/*.tsx`, `apps/web/src/styles.css`

### Phase 5 — CI/CD with GitHub Actions
Deliverables: CI workflow (lint, typecheck, test, build with turbo cache; migration check
against a Postgres service container), release workflow (web build artifact, API Docker
image, EAS mobile build on version tags), API Dockerfile, Dependabot config.
Files:
- `.github/workflows/{ci,release}.yml`, `.github/dependabot.yml`
- `apps/api/Dockerfile`, `.dockerignore`

### Wrap-up
`.gitignore` and `README.md` (architecture diagram, run + test instructions).

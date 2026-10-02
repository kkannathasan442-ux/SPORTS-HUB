# SportsHub

> **Tagline:** Book. Play. Compete. Connect.

SportsHub is a modern, multi-tenant digital sports and recreation platform designed for sports enthusiasts, venue owners, managers, receptionists, scorers, coaches, super admins, and public users.

---

## Current Status

> **STEP 2 completed — Core Database Schema established.**
> **Authentication, RLS policies, booking, and payments are not implemented yet.**

This repository contains the **STEP 2 — Core Database Schema**. Business features (such as user authentication, RLS security policies, booking, payments, tournaments, live scoring, etc.) will be added in subsequent verified steps.

---

## Database Architecture & Schema (STEP 2)

SportsHub uses PostgreSQL with Supabase for its scalable, multi-tenant relational backend.

### Ordered Migrations (`supabase/migrations/`)
1. `20261001000001_extensions.sql` — PostgreSQL extensions (`uuid-ossp`, `pgcrypto`) & `handle_updated_at()` trigger.
2. `20261001000002_enums.sql` — Controlled enums (`organization_status`, `member_status`, `app_role`, `venue_status`, `facility_status`, `pricing_type`, `maintenance_block_status`).
3. `20261001000003_profiles.sql` — Application user profiles linked to `auth.users(id)`.
4. `20261001000004_organizations.sql` — Multi-tenant organization entities.
5. `20261001000005_organization_members.sql` — Staff & member roles within organizations.
6. `20261001000006_venues.sql` — Physical sports complexes and coordinates.
7. `20261001000007_sports.sql` — Platform-level global sports catalog.
8. `20261001000008_venue_sports.sql` — Venue-to-sport offering mappings.
9. `20261001000009_facilities.sql` — Specific courts, pitches, tables, and bookable spaces.
10. `20261001000010_venue_operating_hours.sql` — Venue daily operating hours schedules.
11. `20261001000011_pricing_rules.sql` — Tiered hourly pricing rules with composite multi-tenant integrity.
12. `20261001000012_maintenance_blocks.sql` — Scheduled facility downtime blocks.
13. `20261001000013_customer_profiles.sql` — Extended customer/athlete preferences & emergency contacts.
14. `20261001000014_core_indexes.sql` — Performance indexes for fast relational querying.

### Seed Dataset (`supabase/seed/seed.sql`)
* **Initial 6 Sports:** Cricket, Badminton, Basketball, Table Tennis, Chess, Carrom.
* **Demo Organization:** Demo Sports Group (`demo-sports-group`).
* **Demo Venue:** Demo Sports Arena (`demo-sports-arena`).
* **Demo Facilities:** Cricket Turf 01, Badminton Court 01 & 02, Basketball Court 01, Table Tennis Table 01, Chess Room, Carrom Room.

---

## Supabase Setup

SportsHub connects to a dedicated Supabase project for its backend, authentication, and realtime services.

### 1. Create Dedicated Supabase Project
1. Go to [database.new](https://database.new) and create a **new, dedicated Supabase project** named `SportsHub`.
2. Do **not** connect or link to existing projects (e.g. TIC360 or CrickPulse).

### 2. Retrieve Project Credentials
In your Supabase Dashboard:
1. Navigate to **Project Settings → API**.
2. Copy the **Project URL** (`https://<project-ref>.supabase.co`).
3. Copy the **Project API Keys**:
   - `anon` (public / publishable key)
   - `service_role` (secret administrative key — server only)

### 3. Configure Local Environment Variables
Create `.env.local` in `apps/web/` (or at the root):

```bash
cp .env.example apps/web/.env.local
```

Populate the variables:

```env
# Web (Public / Browser Safe)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Mobile Expo (Public / Mobile Safe)
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Server-Only Secret (Never expose to browser or mobile)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### 4. Security Rules & Credentials Isolation
* **Never commit `.env` or `.env.local` files:** These files are strictly ignored by `.gitignore`.
* **Public Client Access:** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `EXPO_PUBLIC_*`) are exposed to client-side code.
* **Server-Only Secret:** `SUPABASE_SERVICE_ROLE_KEY` must never be imported or bundled into client components, browser code, or mobile apps.

---

## Supported Initial Sports

* Cricket
* Badminton
* Basketball
* Table Tennis
* Chess
* Carrom

*(Architecture is extensible for future sports).*

---

## Applications & Tech Stack

### Web (`apps/web`)
* **Framework:** Next.js (App Router, `src/` directory)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Supabase Client:** `@supabase/ssr` (Browser & Server clients in `src/lib/supabase/`)
* **Components:** Custom lightweight design system tokens (Buttons, Cards, Badges, Containers)
* **Quality:** ESLint, Prettier-compatible

### Mobile (`apps/mobile`)
* **Framework:** React Native with Expo
* **Language:** TypeScript
* **Supabase Client:** `@supabase/supabase-js` (Mobile client in `src/lib/supabase/`)
* **Components:** Lightweight mobile components (`MobileButton`, `MobileContainer`)

### Backend (`supabase/`)
* **Database:** PostgreSQL (Supabase) — *Core schema defined in 14 migrations*
* **Auth:** Supabase Auth (*Future Step*)
* **Realtime:** Supabase Realtime (*Future Step*)

### Shared Packages (`packages/`)
* `packages/types`: Shared TypeScript definitions and database entity models
* `packages/config`: Central application constants, sport definitions, and routes
* `packages/validation`: Shared Zod validation schemas (Env, Health, Database Models)
* `packages/api`: Shared API contracts and client abstractions
* `packages/shared`: Shared utilities, formatting helpers, and class mergers

### Testing (`tests/`)
* **Unit Tests:** Vitest (`tests/unit/` — Foundation, Supabase Env, Database Schema)
* **Security Tests:** Vitest (`tests/security/` — Scope boundaries & credential isolation)
* **E2E Tests:** Playwright (`tests/e2e/`)

---

## Architecture Overview

```text
SportsHub/
│
├── apps/
│   ├── web/                     # Next.js Web Application
│   │   └── src/lib/supabase/    # Browser, Server, Admin, Env & Health modules
│   └── mobile/                  # React Native + Expo Mobile Application
│       └── src/lib/supabase/    # Mobile Client, Env & Health modules
│
├── packages/
│   ├── shared/                  # Common utilities & helpers
│   ├── types/                   # Cross-platform TypeScript interfaces & entity types
│   ├── validation/              # Shared Zod validation schemas (Env, Health, Entities)
│   ├── config/                  # App constants & sports configuration
│   └── api/                     # Shared API contracts & HTTP abstractions
│
├── supabase/
│   ├── migrations/              # 14 ordered PostgreSQL core schema migrations
│   ├── functions/               # Supabase edge functions (future steps)
│   ├── seed/                    # Development seed dataset (seed.sql)
│   └── tests/                   # Database & RLS policy tests (future steps)
│
├── tests/
│   ├── unit/                    # Vitest unit test suites (Foundation, Supabase Env, Schema)
│   ├── integration/             # Integration test suites
│   ├── security/                # Security verification test suites (Scope boundaries)
│   └── e2e/                     # Playwright end-to-end tests
│
├── package.json                 # Monorepo root with npm workspaces
├── tsconfig.json                # Root TypeScript configuration
├── vitest.config.ts             # Vitest configuration
├── playwright.config.ts         # Playwright configuration
├── .gitignore                   # Version control ignore rules
├── .env.example                 # Environment variables blueprint
└── README.md                    # Project documentation
```

---

## Architectural Rules

1. **Separation of Concerns:** Web and Mobile share core types, validation schemas, and constants without duplicating business logic.
2. **UI Independence:** UI components do not contain complex business logic directly.
3. **Future Data Access:** Database access will strictly live in repositories and server-side functions.
4. **Validation:** All inputs and environment configurations are validated through shared Zod schemas.
5. **Zero Trust:** Client-provided prices, roles, or organization IDs will never be trusted without server verification.
6. **Secret Isolation:** Service-role keys never leave server-side environments.

---

## Getting Started

### Prerequisites
* **Node.js:** v18.0.0+ (Tested on v24+)
* **npm:** v9.0.0+

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Servers
* **Web:**
  ```bash
  npm run dev
  # or
  npm run dev:web
  ```
  Open [http://localhost:3000](http://localhost:3000) to view the landing page.
  Open [http://localhost:3000/health](http://localhost:3000/health) to view the system health check.

* **Mobile:**
  ```bash
  npm run dev:mobile
  ```

### 3. Run Quality & Test Commands

* **Run Linting:**
  ```bash
  npm run lint
  ```

* **Run Type Checking:**
  ```bash
  npm run typecheck
  ```

* **Run Unit & Security Tests:**
  ```bash
  npm run test
  ```

* **Run Production Build:**
  ```bash
  npm run build
  ```

* **Run End-to-End Tests:**
  ```bash
  npm run test:e2e
  ```

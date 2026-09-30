# SportsHub

> **Tagline:** Book. Play. Compete. Connect.

SportsHub is a modern, multi-tenant digital sports and recreation platform designed for sports enthusiasts, venue owners, managers, receptionists, scorers, coaches, super admins, and public users.

---

## Current Status

> **STEP 0 completed.**
> **Authentication and database are not implemented yet.**

This repository currently contains the **STEP 0 — Project Foundation**. Business features (such as user authentication, database schemas, booking, payments, tournaments, live scoring, etc.) will be added in subsequent verified steps.

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
* **Components:** Custom lightweight design system tokens (Buttons, Cards, Badges, Containers)
* **Quality:** ESLint, Prettier-compatible

### Mobile (`apps/mobile`)
* **Framework:** React Native with Expo
* **Language:** TypeScript
* **Components:** Lightweight mobile components (`MobileButton`, `MobileContainer`)

### Backend (`supabase/`) — Future Implementation
* **Database:** PostgreSQL (Supabase)
* **Auth:** Supabase Auth (Future Step)
* **Realtime:** Supabase Realtime (Future Step)

### Shared Packages (`packages/`)
* `packages/types`: Shared TypeScript definitions across web and mobile
* `packages/config`: Central application constants, sport definitions, and routes
* `packages/validation`: Shared Zod validation schemas
* `packages/api`: Shared API contracts and client abstractions
* `packages/shared`: Shared utilities, formatting helpers, and class mergers

### Testing (`tests/`)
* **Unit Tests:** Vitest (`tests/unit/`)
* **E2E Tests:** Playwright (`tests/e2e/`)

---

## Architecture Overview

```text
SportsHub/
│
├── apps/
│   ├── web/                     # Next.js Web Application
│   └── mobile/                  # React Native + Expo Mobile Application
│
├── packages/
│   ├── shared/                  # Common utilities & helpers
│   ├── types/                   # Cross-platform TypeScript interfaces
│   ├── validation/              # Shared Zod validation schemas
│   ├── config/                  # App constants & sports configuration
│   └── api/                     # Shared API contracts & HTTP abstractions
│
├── supabase/
│   ├── migrations/              # Database migration SQL (future steps)
│   ├── functions/               # Supabase edge functions (future steps)
│   ├── seed/                    # Development seed datasets (future steps)
│   └── tests/                   # Database & RLS policy tests (future steps)
│
├── tests/
│   ├── unit/                    # Vitest unit test suites
│   ├── integration/             # Integration test suites
│   ├── security/                # Security and access test suites
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
4. **Validation:** All inputs will be validated through shared Zod schemas.
5. **Zero Trust:** Client-provided prices, roles, or organization IDs will never be trusted without server verification.

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

* **Run Unit Tests:**
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

---

## Environment Configuration

Copy `.env.example` to `.env.local` for local web development:

```bash
cp .env.example apps/web/.env.local
```

> **Security Note:** Never commit `.env` or production secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`) to source control.

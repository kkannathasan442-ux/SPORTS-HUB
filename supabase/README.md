# SportsHub Supabase Infrastructure

This directory contains the database migrations, serverless functions, seed scripts, and database test suites for **SportsHub**.

## Directory Structure

* `migrations/`: Ordered, version-controlled PostgreSQL schema definitions.
* `functions/`: Supabase Edge Functions (Deno / TypeScript).
* `seed/`: Local development seed datasets (`seed.sql`).
* `tests/`: Database unit and RLS policy test suites.

## Core Database Schema (STEP 2)

The core PostgreSQL relational schema includes:

| Table | Purpose | Primary Keys & References |
| :--- | :--- | :--- |
| `profiles` | Application user profiles | `id` → `auth.users(id)` |
| `organizations` | Multi-tenant sports businesses / clubs | `id`, unique `slug` |
| `organization_members` | Staff & member roles within organizations | `id`, composite unique `(organization_id, user_id)` |
| `venues` | Physical sports venues owned by organizations | `id`, unique `(organization_id, slug)` |
| `sports` | Global catalog of supported sports | `id`, unique `slug` |
| `venue_sports` | Sports offered at specific venues | `id`, unique `(venue_id, sport_id)` |
| `facilities` | Individual courts, pitches, tables, and spaces | `id`, unique `(venue_id, slug)` |
| `venue_operating_hours` | Daily schedules (0=Sun, 1=Mon, ..., 6=Sat) | `id`, unique `(venue_id, day_of_week)` |
| `pricing_rules` | Tiered hourly pricing rules (base, peak, member) | `id`, composite tenant FKs to venues & facilities |
| `maintenance_blocks` | Scheduled maintenance downtime windows | `id`, composite tenant FKs to venues & facilities |
| `customer_profiles` | Player/customer extended preferences & emergency contacts | `id`, unique `user_id` → `profiles(id)` |

## Applying Migrations

To apply migrations to your dedicated SportsHub Supabase project:

```bash
# Push migrations to connected remote Supabase project
npx supabase db push

# Apply seed dataset
npx supabase db reset  # (local development only)
```

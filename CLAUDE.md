# Quacker — starter template

Full-stack teaching template: pnpm monorepo with two apps.

- `apps/backend` — NestJS + Prisma + Postgres. Auth: BetterAuth (mounted at `/api/auth/*`, treat as a black box). API docs: Swagger at `/api/docs`.
- `apps/frontend` — React + Vite + TanStack Router/Query, Tailwind + shadcn/ui, `ky` + `zod` API client. Feature folders under `src/features/`.

The worked example is the quack feed: `Quack` model → seed → repository → service → `GET`/`POST /api/quacks` (DTO-validated, author taken from the session) → zod schema → TanStack Query → list page + post form. Copy its pattern for new features.

**Before writing or changing any UI, read [`DESIGN.md`](DESIGN.md).** It is a contract, not a suggestion — it exists to stop generated screens drifting into generic nested cards.

## Commands

- `pnpm dev` — everything: env files, Postgres (Docker), migrate, seed, both dev servers
- `pnpm check-all` — lint + type-check + tests + build (same as CI)
- `pnpm backend test` / `pnpm frontend test:ci` — unit tests
- `pnpm backend prisma:migrations:run` — create/apply migrations after schema changes

## Conventions

Deliberately sparse — this file grows as the team learns what it expects from generated code. Add rules here when you find yourself repeating the same review feedback.

### New work starts from an up-to-date `main`

Before starting anything new — a story, a fix, a docs change — sync local `main` with GitHub: `git fetch origin`, `git checkout main`, `git merge --ff-only origin/main`. Then branch off that `main`. Other people's PRs land on GitHub while you work, so a local `main` is stale by default; branching off it means building on old code and resolving conflicts later instead of now.

If the fast-forward fails, local `main` has commits GitHub doesn't. Stop and ask — don't merge, rebase or reset it on your own.

### UI controls come from the kit

Need a control that isn't in `src/components/ui/`? Add it with `pnpm dlx shadcn@latest add <name>` — don't hand-roll one in a feature folder, even where a native input would do the job. One accessibility implementation to reason about beats a per-control judgement call.

The CLI puts `shadow-xs`/`shadow-sm` on inputs, textareas and cards. [`DESIGN.md`](DESIGN.md) keeps shadows for things that genuinely float — dialogs, dropdowns, toasts. Strip them.

Check `git diff` after the CLI runs. It has been seen adding an unrelated `cn` npm package to `package.json` and making the new component `import { cn } from "cn"`. Remove the package and import `cn` from `@/lib/utils` like every other file in `src/components/ui/` — a kit component needs nothing beyond its Radix primitive.

### Permission checks live in the service

Every endpoint that changes or deletes data checks in the service that the user from `@User()` may do it, and throws `ForbiddenException` otherwise. Hiding a button in the UI is not a check. The current user always comes from the session, never from the body or the URL.

### Commits contain real changes only

Prettier and the shadcn CLI rewrite line endings on Windows, so files you never edited show up as modified. Don't commit them: compare `git status` with `git diff --ignore-cr-at-eol --stat`, and restore any file that appears only in the first with `git checkout -- <file>`.

### The app is already running

Assume the dev servers are up. If something is listening on the app's ports, that is this application: use it. Don't start a second instance, don't restart it, don't run `pnpm dev`.

Don't reach for the browser to check your own work. Tests and type-checks are the evidence; open the running app when asked to, not on your own initiative.

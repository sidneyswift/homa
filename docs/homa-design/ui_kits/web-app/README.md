# Homa, Web App UI kit

> **Historical design prototype:** This July 2026 kit is preserved as visual
> decision history. It is not the current route, pricing, identity, availability,
> proof, or capability specification. Use the reconciled PRD, backlog, current
> application code, and production evidence for those claims.

Historical interactive Homa desktop-app prototype.

**Flow:** Sign in (any credentials) → app shell with left nav → switch between **Ask Homa** (chat), **Progress** (dashboard), **Benchmarks** (skills checklist + impact), **Week planner**, and **Discover** (lesson-matched outings + community). `onboarding.html` is the first-run flow.

## Files
- `index.html`, entry; mounts the app and loads the design-system bundle + Lucide.
- `App.jsx`, login gate + authenticated shell, view routing.
- `Sidebar.jsx`, left navigation, kid switcher, account footer.
- `ChatView.jsx`, the assistant chat surface (bubbles, suggestions, composer).
- `DashboardView.jsx`, per-child progress: stat tiles, subject mastery bars, Homa insight.
- `BenchmarksView.jsx`, standards standing, the parent skills checklist, targeted practice, impact proof ("up 12 points").
- `PlannerView.jsx`, 5-day week grid with color-coded subject blocks.
- `DiscoverView.jsx`, lesson-matched local suggestions (museum/zoo), nearby co-ops & story hours, Homa families.
- `CurriculumView.jsx`, side-by-side curriculum comparison with fit badges and Homa's plain-language take.
- `Onboarding.jsx` / `onboarding.html`, first-run: add kids → subjects → Homa drafts the week.

Composes design-system components: Button, IconButton, Input, Card, Badge, ProgressBar, Avatar, Tabs, Chip, Callout, Icon.

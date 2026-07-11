# @homa/core

Shared TypeScript domain package consumed by web and mobile.

Current exports include:

- the typed event registry and wall-door names;
- waitlist, phone, US-state, and onboarding schemas;
- age and birthday helpers for the scored range;
- the map question bank, subjects, scoring, personalization, and staleness rules;
- deterministic four-week and month-plan builders;
- report and curriculum types plus their validation gates; and
- shared copy-law constants.

`src/index.ts` is the canonical public surface. Consumers transpile the raw TypeScript package. Run `pnpm check:map` for bank and scorer changes and `pnpm check:events` for event-registry changes.

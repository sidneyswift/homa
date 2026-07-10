import { defaultBackend, defineSandbox } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

/**
 * The agent's sandbox, locked down before anything uses it (agentic
 * ladder item 9 groundwork; 15-agentic-architecture.md §3). eve's default
 * egress policy is allow-all; children's-data posture says deny-all until
 * a workload needs a named host. The worksheet factory (M0-03/M2-05)
 * extends this same file later: seeded generator scripts under
 * agent/sandbox/workspace/, a fal.ai allowlist entry with brokered
 * credentials, and prewarmed bootstrap, without touching the default
 * backend choice (Vercel Sandbox deployed, Docker/microsandbox locally).
 *
 * just-bash (the dependency-free local fallback) takes no network options
 * and has no real network egress either, so the per-backend keys below
 * cover every backend that can actually reach the internet.
 *
 * Local dev pins just-bash outright: defaultBackend would pick
 * microsandbox on Apple Silicon, and its first VM boot proved unusable
 * on the dev machine (minutes of CPU, turn never progressed;
 * 2026-07-09). Deployed runtime (VERCEL set) still resolves to Vercel
 * Sandbox with deny-all.
 */
export default defineSandbox({
  backend: process.env.VERCEL
    ? defaultBackend({
        vercel: { networkPolicy: "deny-all" },
        docker: { networkPolicy: "deny-all" },
        microsandbox: { networkPolicy: "deny-all" },
      })
    : justbash(),
});

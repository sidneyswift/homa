/**
 * Dependency-free Node preload for local eval children, including --exec.
 * The same barrier is installed by the direct Eve eval config after its first
 * dotenv load. Eve 0.19 loads dotenv again when its development server starts.
 */
export const DURABLE_WRITE_ENV_VARS = Object.freeze([
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_SECRET_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "HOMA_FAMILY_READ_WRITE_TOKEN",
  "HOMA_LESSON_READ_WRITE_TOKEN",
  "RESEND_API_KEY",
  "TELNYX_API_KEY",
  "STRIPE_TEST_SECRET_KEY",
  "STRIPE_LIVE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "HANDWRYTTEN_API_KEY",
]);

const durableWriteNames = new Set(DURABLE_WRITE_ENV_VARS);
let isolatedEnvironment;

/**
 * Keep exact credential names absent for this process's lifetime. This is a
 * local eval safety boundary, not a sandbox against hostile application code.
 * Launch-time Vercel and explicit opt-out modes never install the barrier.
 */
export function installEvalIsolationBarrier() {
  if (
    process.env.HOMA_EVAL_ISOLATION !== "1" ||
    process.env.VERCEL !== undefined ||
    process.env.HOMA_EVAL_ALLOW_PROD_WRITES === "1" ||
    process.env === isolatedEnvironment
  ) return;

  const environment = process.env;
  for (const name of durableWriteNames) delete environment[name];
  isolatedEnvironment = new Proxy(environment, {
    set(target, name, value) {
      if (typeof name === "string" && durableWriteNames.has(name)) return true;
      return Reflect.set(target, name, value);
    },
    defineProperty(target, name, descriptor) {
      if (typeof name === "string" && durableWriteNames.has(name)) return true;
      return Reflect.defineProperty(target, name, descriptor);
    },
  });
  process.env = isolatedEnvironment;
}

installEvalIsolationBarrier();

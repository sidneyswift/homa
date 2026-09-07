import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parseEnv } from "node:util";

import { applyEvalIsolation } from "../../lib/eval-isolation";

// Load only the model credential from the local file. Never load the whole
// production environment into the model/writer process before scrubbing it.
const local=parseEnv(readFileSync(".env.local","utf8"));
const environment:NodeJS.ProcessEnv={...process.env,VERCEL_OIDC_TOKEN:local.VERCEL_OIDC_TOKEN};
const isolation=applyEvalIsolation(environment);
assert.equal(isolation.mode,"scrubbed");assert.equal(isolation.databaseTarget,"sandbox");
delete environment.AI_GATEWAY_API_KEY;
assert.ok(environment.VERCEL_OIDC_TOKEN,"Refresh Vercel OIDC with pnpm dev:token");
const claims=JSON.parse(Buffer.from(environment.VERCEL_OIDC_TOKEN.split(".")[1],"base64url").toString("utf8"));
assert.ok(claims.exp*1000>Date.now()+10*60_000,"OIDC needs refresh before the acceptance run");
assert.ok(environment.HOMA_HOURS_ACCEPTANCE_REPORT&&isAbsolute(environment.HOMA_HOURS_ACCEPTANCE_REPORT),"Set an absolute HOMA_HOURS_ACCEPTANCE_REPORT path");
const child=spawn(process.execPath,["--import","../../node_modules/tsx/dist/loader.mjs","evals/hours-capture-acceptance/run.ts"],{env:environment,stdio:"inherit"});
const interrupt=()=>child.kill("SIGTERM");
process.on("SIGINT",interrupt);process.on("SIGTERM",interrupt);
child.on("error",error=>{console.error(error.message);process.exitCode=1;});
child.on("close",code=>{process.off("SIGINT",interrupt);process.off("SIGTERM",interrupt);process.exitCode=code??1;});

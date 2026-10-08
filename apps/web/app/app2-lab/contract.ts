import { z } from "zod";

export const planSchema = z.object({
  title: z.string().min(1).max(100),
  introduction: z.string().max(600),
  activities: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    title: z.string().max(100),
    minutes: z.number().int().min(1).max(60),
    instructions: z.string().max(1000),
    materials: z.array(z.string().max(80)).max(6),
    alternative: z.object({ title: z.string().max(100), instructions: z.string().max(1000) }),
  })).min(2).max(5),
}).refine(p => new Set(p.activities.map(a => a.id)).size === p.activities.length, "Activity IDs must be unique");
export const activitySchema = z.object({
  title: z.string().min(1).max(100),
  introduction: z.string().max(600),
  html: z.string().min(100).max(60000),
});
export const requestSchema = z.object({
  mode: z.enum(["plan", "activity"]),
  prompt: z.string().min(8).max(2500),
  previous: z.string().max(65000).optional(),
});
export type Plan = z.infer<typeof planSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Experiment = { id: string; mode: "plan"; result: Plan } | { id: string; mode: "activity"; result: Activity };
export type Interaction = { minutes: number; swapped: string[]; done: string[]; activity: Record<string, string | boolean> };
export const interactionSchema = z.object({ minutes: z.number().int().min(10).max(60), swapped: z.array(z.string()).max(5), done: z.array(z.string()).max(5), activity: z.record(z.string().max(100), z.union([z.string().max(2000), z.boolean()])) });
export const savedSchema = z.object({ version: z.literal(1), id: z.string().max(100), mode: z.enum(["plan", "activity"]), result: z.unknown(), interaction: interactionSchema, prompt: z.string().max(2500) });
export const initialInteraction = (): Interaction => ({ minutes: 30, swapped: [], done: [], activity: {} });

// Allocate whole minutes deterministically and preserve the exact selected total.
export function allocateMinutes(plan: Plan, total: number): number[] {
  const budget = Math.max(plan.activities.length, Math.round(total));
  const weights = plan.activities.map(a => a.minutes);
  const sum = weights.reduce((a, b) => a + b, 0);
  const remaining = budget - weights.length;
  const exact = weights.map(w => w / sum * remaining);
  const values = exact.map(v => 1 + Math.floor(v));
  const order = exact.map((v, i) => ({ i, remainder: v % 1 })).sort((a, b) => b.remainder - a.remainder);
  const extra = budget - values.reduce((a, b) => a + b, 0);
  for (let i = 0; i < extra; i++) values[order[i].i]++;
  return values;
}

export function buildActivityDocument(html: string, channel: string, initialState: Interaction["activity"] = {}): string {
  // Opaque origin isolates parent DOM/cookies. CSP blocks resource loads and fetch.
  // Self-navigation is not covered by CSP, so this lab accepts synthetic data only.
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const seed = JSON.stringify(initialState).replaceAll("<", "\\u003c");
  const bridge = `(()=>{const channel=${JSON.stringify(channel)};let state=${seed};let restored=false;window.lab={getState:()=>state,setState:value=>{if(restored&&value&&typeof value==='object'){state=value;parent.postMessage({channel,type:'state',state},'*')}}};addEventListener('message',e=>{if(e.source!==parent||e.data?.channel!==channel||e.data?.type!=='restore')return;state=e.data.state||{};restored=true;dispatchEvent(new Event('labrestore'));});addEventListener('DOMContentLoaded',()=>parent.postMessage({channel,type:'ready'},'*'));addEventListener('error',()=>parent.postMessage({channel,type:'error'},'*'));})();`;
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{color-scheme:light}body{margin:0;padding:16px;font:16px/1.5 system-ui;background:white;color:#202124}*{box-sizing:border-box}button,input,select{font:inherit}button{min-height:44px}button:focus-visible,input:focus-visible{outline:2px solid #202124;outline-offset:3px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}</style><script>${bridge}</script></head><body>${html}</body></html>`;
}

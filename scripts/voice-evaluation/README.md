# Voice evaluation lab

Run from the repository root on macOS with Node 24:

```
node --env-file=apps/web/.env.local scripts/voice-evaluation/server.mjs
```

Open the printed loopback URL. Select a scenario and press Run scenario. Use
three repeats per configuration before comparing current and concise prompts.
Both variants retain the entire binding Homa persona. The concise transport
instructions are experimental and never used by production.

The lab compiles the actual web VoiceMode and shared conversation code, and
uses the actual Live session route with synthetic auth/context dependencies.
Only OpenAI's Live service and the OIDC-authenticated AI Gateway are contacted.
The backend is a disposable fixture, not Eve or a production material renderer.
No real microphone is captured. macOS speech supplies synthetic adult input;
optional noise is generated locally. The independent caller sees its goal and
captions, not backend outcomes or hidden grading criteria. The grader receives
separate request, result and caption evidence. No recordings of families are
accepted by this runner.

Each call closes in finally, with a 150-second browser deadline. The server
allows at most 24 sessions per launch. Keep the tab open until Scenario complete.
Stop the server after testing. Reports are written privately in the printed
system temporary directory. They contain synthetic text, per-call diagnostics,
model grades, sample counts, response gap P50/P90, and harness failures.
Inspect failures before comparing averages. Browser audio start and non-silent
received audio are separate from transcript evidence and do not establish
physical speaker output or that a parent heard a particular completion.

Deterministic coverage lives in live-voice-evaluation.test.ts, the existing
Live lifecycle suite, and authenticated voice route tests. Run
`pnpm check:voice-persona` and `pnpm check:mobile-voice`.

Human recordings require explicit approval and a separate documented dataset.
Physical devices, Bluetooth, accents, authentic household noise, actual Eve
material effects, and long sessions need additional coverage. Synthetic tests
must never be presented as certification of those paths.

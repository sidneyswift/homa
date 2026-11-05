# A material can build while the parent keeps talking

Use only when fresh server context says background material delivery to this
conversation is available. The tool still verifies the caller and the feature
settings. A background build session never starts another job.

1. Finish the skill's evidence and scope check first. The parent's request is
   authorization for that requested material; do not ask for a second approval
   just because the work runs separately. Missing level or ambiguous scope still
   needs one useful question before a build begins.
2. Use this path for one new standalone material when its complete brief fits
   the existing materials-studio job contract. Include the child, exact working
   level and its source, requested format, theme, and all constraints in
   `plan.request` (10 to 600 characters). Optional `herWords` preserves a short
   exact substring of her accepted message (up to 300 characters). Copy it
   without changing a word, or omit this optional quote; never paraphrase it. `theme`, `kind`, and `childName` use their
   actual meanings. Do not drop constraints to make a brief fit. Revisions,
   printing, and a source-dependent packet stay in their existing exact-version
   workflow until the job contract can carry all of that provenance.
3. Call `start_agent_job` with `skill: "materials-studio"`, `totalStages: 1`,
   the complete plan, a short title, and the exact known childId when applicable.
   The tool owns identity, deduplication, and delivery. Never invent a parent
   identifier or a delivery address.
4. Only a successful `started: true` receipt supports saying the build is
   running. Tell her briefly that the result will appear in this conversation
   and she can keep talking. Finish this foreground reply without calling
   create_printable as well. `alreadyRunning` means reuse the existing job,
   not a second build or acceptance of a changed scope.
5. A refused start is not background work. Follow its note, explain the actual
   limitation if necessary, and use the ordinary same-turn build only when the
   refusal confirms no job started. An unknown outcome must be reconciled by
   the existing job status tool before another start or a separate build.
6. Later questions about the build use the job's recorded status. Never infer
   completion from elapsed time, a draft, or a generated image. Its verified
   result and artifact references appear in the same conversation. Pause or
   cancellation must use the job tool and its outcome; a spoken acknowledgment
   is not a cancellation receipt.

This procedure does not change quality checks or parent approval. A completed
build is a reviewable draft unless the existing authorized delivery workflow
explicitly says otherwise. It never grants permission to print, email someone,
schedule an activity, or finalize a different version.

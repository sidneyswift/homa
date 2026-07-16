import { adminDb } from "../admin/db";

/**
 * Layer 3: Quality Loop (Eval Suite).
 * Closes the signal -> fix -> re-measure -> confirm loop. Records fix
 * attempts against signals, evaluates whether fixes resolved the
 * original signal, and tracks effectiveness over time.
 */

export interface EvalResult {
  id: string;
  signalId: string;
  fixDescription: string | null;
  fixCommit: string | null;
  evalType: string;
  resolved: boolean | null;
  confidence: number | null;
  evaluatedAt: string | null;
  createdAt: string;
}

export interface EffectivenessReport {
  signalType: string;
  totalFixes: number;
  resolvedCount: number;
  avgEffectiveness: number | null;
  avgRecurrence: number;
}

/**
 * Record a fix attempt for a signal. Returns the eval ID.
 */
export async function createEval(
  signalId: string,
  fixDescription: string,
  fixCommit: string | null,
  evalType: "signal_resolved" | "regression_check" | "effectiveness" = "signal_resolved",
): Promise<string> {
  const db = adminDb();

  const [row] = await db<{ id: string }[]>`
    insert into public.eval_results
      (signal_id, fix_description, fix_commit, eval_type)
    values (
      ${signalId}::uuid,
      ${fixDescription},
      ${fixCommit},
      ${evalType}
    )
    returning id::text
  `;

  return row!.id;
}

/**
 * Run an eval: check if the original signal's type still occurs after
 * the fix. Looks at signals created after the fix was recorded.
 */
export async function runEval(evalId: string): Promise<EvalResult> {
  const db = adminDb();

  // Get the eval and its linked signal
  const [evalRow] = await db<
    {
      id: string;
      signal_id: string;
      fix_description: string | null;
      fix_commit: string | null;
      eval_type: string;
      created_at: string;
    }[]
  >`
    select id::text, signal_id::text, fix_description, fix_commit,
           eval_type, created_at::text
    from public.eval_results
    where id = ${evalId}::uuid
  `;

  if (!evalRow) throw new Error(`Eval ${evalId} not found`);

  // Get the original signal's type and family
  const [signal] = await db<
    { signal_type: string; family_id: string }[]
  >`
    select signal_type, family_id::text
    from public.conversation_signals
    where id = ${evalRow.signal_id}::uuid
  `;

  if (!signal) {
    // Signal was deleted, mark as resolved
    await db`
      update public.eval_results
      set resolved = true, confidence = 1.0, evaluated_at = now()
      where id = ${evalId}::uuid
    `;
    return {
      id: evalRow.id,
      signalId: evalRow.signal_id,
      fixDescription: evalRow.fix_description,
      fixCommit: evalRow.fix_commit,
      evalType: evalRow.eval_type,
      resolved: true,
      confidence: 1.0,
      evaluatedAt: new Date().toISOString(),
      createdAt: evalRow.created_at,
    };
  }

  // Count recurrences of the same signal type for the same family
  // after the fix was created
  const [count] = await db<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.conversation_signals
    where family_id = ${signal.family_id}::uuid
      and signal_type = ${signal.signal_type}
      and created_at > (
        select created_at from public.eval_results where id = ${evalId}::uuid
      )
  `;

  const recurrences = count?.cnt ?? 0;
  const resolved = recurrences === 0;
  const confidence = resolved ? 0.8 : Math.max(0.2, 1 - recurrences * 0.2);

  // Update the eval
  await db`
    update public.eval_results
    set resolved = ${resolved},
        confidence = ${confidence},
        evaluated_at = now(),
        post_fix_state = ${JSON.stringify({ recurrences })}::jsonb
    where id = ${evalId}::uuid
  `;

  return {
    id: evalRow.id,
    signalId: evalRow.signal_id,
    fixDescription: evalRow.fix_description,
    fixCommit: evalRow.fix_commit,
    evalType: evalRow.eval_type,
    resolved,
    confidence,
    evaluatedAt: new Date().toISOString(),
    createdAt: evalRow.created_at,
  };
}

/**
 * Track fix effectiveness over time: how often the signal recurs
 * after the fix, and for how many days we have been monitoring.
 */
export async function measureEffectiveness(fixId: string): Promise<void> {
  const db = adminDb();

  // Get the eval and signal info
  const [evalRow] = await db<
    { signal_id: string; created_at: string }[]
  >`
    select signal_id::text, created_at::text
    from public.eval_results
    where id = ${fixId}::uuid
  `;

  if (!evalRow) return;

  const [signal] = await db<
    { signal_type: string; family_id: string }[]
  >`
    select signal_type, family_id::text
    from public.conversation_signals
    where id = ${evalRow.signal_id}::uuid
  `;

  if (!signal) return;

  // Count recurrences since the fix
  const [count] = await db<{ cnt: number }[]>`
    select count(*)::int as cnt
    from public.conversation_signals
    where family_id = ${signal.family_id}::uuid
      and signal_type = ${signal.signal_type}
      and created_at > ${evalRow.created_at}::timestamptz
  `;

  const recurrences = count?.cnt ?? 0;
  const daysSinceFix = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(evalRow.created_at).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const score = Math.max(0, 1 - recurrences / Math.max(1, daysSinceFix));

  // Upsert effectiveness record
  const existing = await db<{ id: string }[]>`
    select id::text from public.fix_effectiveness where fix_id = ${fixId}::uuid
  `;

  if (existing.length > 0) {
    await db`
      update public.fix_effectiveness
      set recurrence_count = ${recurrences},
          days_monitored = ${daysSinceFix},
          effectiveness_score = ${score},
          last_checked_at = now()
      where fix_id = ${fixId}::uuid
    `;
  } else {
    await db`
      insert into public.fix_effectiveness
        (fix_id, signal_type, recurrence_count, days_monitored, effectiveness_score, last_checked_at)
      values (
        ${fixId}::uuid,
        ${signal.signal_type},
        ${recurrences},
        ${daysSinceFix},
        ${score},
        now()
      )
    `;
  }
}

/**
 * Summary of fix effectiveness across all fixes.
 */
export async function getFixReport(): Promise<EffectivenessReport[]> {
  const db = adminDb();

  const rows = await db<
    {
      signal_type: string;
      total_fixes: number;
      resolved_count: number;
      avg_effectiveness: number | null;
      avg_recurrence: number;
    }[]
  >`
    select
      fe.signal_type,
      count(*)::int as total_fixes,
      count(*) filter (where er.resolved = true)::int as resolved_count,
      avg(fe.effectiveness_score) as avg_effectiveness,
      avg(fe.recurrence_count)::int as avg_recurrence
    from public.fix_effectiveness fe
    join public.eval_results er on er.id = fe.fix_id
    group by fe.signal_type
    order by count(*) desc
  `;

  return rows.map((r) => ({
    signalType: r.signal_type,
    totalFixes: r.total_fixes,
    resolvedCount: r.resolved_count,
    avgEffectiveness: r.avg_effectiveness,
    avgRecurrence: r.avg_recurrence,
  }));
}

/** Run ONLY via the existing disposable eval:sandbox --exec harness. No models. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { isEvalIsolationActive } from "../apps/web/lib/eval-isolation";
import { mapDb } from "../apps/web/lib/map/db";
import { loadJournalFamilyChildren } from "../apps/web/lib/child-progress/journal-capture";
import { loadJournalConversationContext, type JournalContextRequest } from "../apps/web/lib/child-progress/journal-context";

const target = process.env.HOMA_EVAL_DATABASE_URL;
if (!isEvalIsolationActive(process.env) || !target || new URL(target).hostname !== "127.0.0.1" || process.env.VERCEL !== undefined) {
  throw new Error("Journal context contract requires the disposable loopback eval sandbox.");
}
const sql = mapDb();
const rollback = new Error("Intentional rollback of synthetic privacy fixtures");
let assertions = 0;
try {
  await sql.begin(async tx => {
    const familyId = randomUUID(), foreignFamily = randomUUID(), actor = randomUUID(), other = randomUUID();
    await tx`insert into auth.users (id) values (${actor}), (${other})`;
    await tx`insert into public.families (id, name) values (${familyId}, 'Context fixture'), (${foreignFamily}, 'Other context fixture')`;
    await tx`insert into public.family_members (family_id, user_id, role) values (${familyId}, ${actor}, 'parent'), (${familyId}, ${other}, 'parent')`;
    const database = tx as unknown as ReturnType<typeof mapDb>;
    const birthDate = '2022-01-06', rosterChild = randomUUID(), foreignChild = randomUUID();
    await tx`update public.families set time_zone = 'America/Los_Angeles' where id = ${familyId}`;
    await tx`update public.families set time_zone = 'Asia/Tokyo' where id = ${foreignFamily}`;
    await tx`insert into public.children (id, family_id, name, birth_month) values
      (${rosterChild}, ${familyId}, 'Maya', ${birthDate}), (${foreignChild}, ${foreignFamily}, 'Foreign fixture', ${birthDate})`;
    const now = new Date('2026-09-06T02:00:00Z');
    const roster = await loadJournalFamilyChildren(familyId, { database, now });
    assert.deepEqual(roster.map(child => [child.childId, child.ageMonths]), [[rosterChild, 55]]); assertions++;
    const foreignRoster = await loadJournalFamilyChildren(foreignFamily, { database, now });
    assert.deepEqual(foreignRoster.map(child => [child.childId, child.ageMonths]), [[foreignChild, 56]]); assertions++;
    assert.deepEqual(await loadJournalFamilyChildren(randomUUID(), { database, now }), []); assertions++;
    for (const timeZone of [null, '']) {
      await tx`update public.families set time_zone = ${timeZone} where id = ${familyId}`;
      assert.equal((await loadJournalFamilyChildren(familyId, { database, now }))[0]?.ageMonths, 55); assertions++;
    }
    async function fixture(channel: "web" | "sms" | "email" = "web", proven = true) {
      const session = `journal-context:${randomUUID()}`;
      const current = randomUUID(), previous = randomUUID(), episode = randomUUID();
      await tx`insert into public.conversation_episodes (id, family_id, scope, member_user_id) values (${episode}, ${familyId}, 'member', ${actor})`;
      // A normal conversation proves the parent before the assistant answers.
      // The existing privacy trigger must still erase an assistant-first claim.
      if (proven) await tx`insert into public.conversation_messages (id, family_id, member_user_id, session_id, sequence, turn_id, role, channel, content, visibility, created_at, episode_id)
        values (${randomUUID()}, ${familyId}, ${actor}, ${session}, 1, 'initial-parent', 'user', ${channel}, 'Ask me about Maya cutting.', 'family', '2026-09-05T11:59:00Z', ${episode})`;
      await tx`insert into public.conversation_messages (id, family_id, member_user_id, session_id, sequence, turn_id, role, channel, content, visibility, created_at, episode_id) values
        (${previous}, ${familyId}, ${actor}, ${session}, 1, 'previous', 'assistant', ${channel}, 'Can Maya cut a straight line?', 'family', '2026-09-05T12:00:00Z', ${episode}),
        (${current}, ${familyId}, ${actor}, ${session}, 1, 'current', 'user', ${channel}, 'She can do all of that.', 'family', '2026-09-05T12:01:00Z', ${episode})`;
      return {previous, episode, request: {familyId, memberUserId: actor, runtimeSessionId: session, inboundMessageId: current, message: 'She can do all of that.', channel} satisfies JournalContextRequest};
    }
    const valid = await fixture();
    const read = (request: JournalContextRequest) => loadJournalConversationContext(request, database);
    const unproven = await fixture("web", false);
    const [unprovenRow] = await tx`select member_user_id from public.conversation_messages where family_id = ${familyId} and id = ${unproven.previous}`;
    assert.equal(unprovenRow.member_user_id, null); assertions++;
    assert.equal(await read(unproven.request), null); assertions++;
    assert.equal((await read(valid.request))?.messageId, valid.previous); assertions++;
    for (const patch of [{familyId: foreignFamily}, {memberUserId: other}, {message: 'different current text'}, {runtimeSessionId: 'different session'}, {inboundMessageId: randomUUID()}, {channel: 'sms' as const}]) {
      assert.equal(await read({...valid.request, ...patch}), null); assertions++;
    }
    // A hidden/user/foreign-actor immediate predecessor does not expose an older visible question.
    for (const patch of ["hidden", "user", "other-actor", "null-actor", "oversize", "tied-predecessor", "tied-current", "mixed-session", "null-user"]) {
      const f = await fixture();
      // An older eligible question must never replace the unavailable immediate one.
      if (patch === "hidden" || patch === "user") await tx`insert into public.conversation_messages (id, family_id, member_user_id, session_id, sequence, turn_id, role, channel, content, visibility, created_at, episode_id)
        values (${randomUUID()}, ${familyId}, ${actor}, ${f.request.runtimeSessionId}, 1, 'older-question', 'assistant', 'web', 'Can Maya hop?', 'family', '2026-09-05T11:59:30Z', ${f.episode})`;
      if (patch === "hidden") await tx`update public.conversation_messages set visibility = 'internal' where id = ${f.previous}`;
      // Roles are immutable. Insert an actual intervening user turn instead.
      if (patch === "user") await tx`insert into public.conversation_messages (id, family_id, member_user_id, session_id, sequence, turn_id, role, channel, content, visibility, created_at, episode_id)
        values (${randomUUID()}, ${familyId}, ${actor}, ${f.request.runtimeSessionId}, 1, 'intervening-parent', 'user', 'web', 'One more thing.', 'family', '2026-09-05T12:00:30Z', ${f.episode})`;
      if (patch === "other-actor") await tx`update public.conversation_messages set member_user_id = ${other} where id = ${f.previous}`;
      if (patch === "null-actor") await tx`update public.conversation_messages set member_user_id = null where id = ${f.previous}`;
      if (patch === "oversize") await tx`update public.conversation_messages set content = ${"🙂".repeat(2_001)} where id = ${f.previous}`;
      if (["tied-predecessor", "tied-current", "mixed-session", "null-user"].includes(patch)) {
        const instant = patch === "tied-current" ? "2026-09-05T12:01:00Z" : patch === "tied-predecessor" ? "2026-09-05T12:00:00Z" : "2026-09-05T11:00:00Z";
        const member = patch === "null-user" ? null : patch === "mixed-session" ? other : actor;
        await tx`insert into public.conversation_messages (id, family_id, member_user_id, session_id, sequence, turn_id, role, channel, content, visibility, created_at, episode_id)
          values (${randomUUID()}, ${familyId}, ${member}, ${f.request.runtimeSessionId}, 2, 'extra', 'user', 'web', 'Synthetic additional message', 'family', ${instant}, ${f.episode})`;
      }
      assert.equal(await read(f.request), null); assertions++;
    }
    for (const channel of ["sms", "email"] as const) {
      const f = await fixture(channel);
      assert.equal(await read(f.request), null); assertions++;
      const delivery = randomUUID();
      await tx`insert into public.conversation_deliveries (id, family_id, episode_id, message_id, recipient_member_user_id, channel, destination_hash, status, sent_at)
        values (${delivery}, ${familyId}, ${f.episode}, ${f.previous}, ${other}, ${channel}, ${'0'.repeat(64)}, 'sent', '2026-09-05T12:00:01Z')`;
      assert.equal(await read(f.request), null); assertions++;
      await tx`update public.conversation_deliveries set recipient_member_user_id = ${actor}, status = 'uncertain' where id = ${delivery}`;
      assert.equal(await read(f.request), null); assertions++;
      await tx`update public.conversation_deliveries set status = 'sent' where id = ${delivery}`;
      assert.equal((await read(f.request))?.messageId, f.previous); assertions++;
    }
    await tx`delete from public.family_members where family_id = ${familyId} and user_id = ${actor}`;
    assert.equal(await read(valid.request), null); assertions++;
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await sql.end(); }
console.log(`PASS ${assertions} actual PostgreSQL context assertions; all fixtures rolled back`);

-- conversation_messages records WHETHER A TURN WAS SPOKEN.
--
-- Additive only (a new column with a default, plus a CHECK on it), so this
-- may lead its deploy under the deploy law in AGENTS.md. Every existing row
-- is text and takes the default.
--
-- Why a new column rather than a new `channel` value. Channel is WHERE the
-- conversation happened: web, sms, email, dispatch. In-app voice happens on
-- the web, in the web app, in the same thread as everything else, so calling
-- it a different channel would be false and would silently change how ~15
-- per-tool channel guards and the usage ledger treat it. Spoken-ness is a
-- different axis, and the codebase already has the word for it:
-- ChatTurnModality in app/app/chat-send-policy.ts is "text" | "voice", and
-- the typed chat.turn_completed event has carried that same enum since
-- dictation shipped. This column is that vocabulary reaching the store.
--
-- What it is for. A voice turn is a real message: it renders in the thread,
-- it survives a refresh, recall finds it, and it becomes context for later
-- turns. But it did not arrive the way a typed message did, and three
-- readers need to know the difference: the transcript renders it with a
-- spoken affordance, recall can say "you said this out loud", and the
-- per-turn context can tell Homa what was said aloud a moment ago without
-- claiming she read it.

alter table public.conversation_messages
  add column if not exists modality text not null default 'text';

alter table public.conversation_messages
  drop constraint if exists conversation_messages_modality_check;

alter table public.conversation_messages
  add constraint conversation_messages_modality_check
  check (modality in ('text', 'voice'));

-- The per-turn context block reads the newest spoken turns for one family.
-- Partial, because voice rows are a small minority and this index should not
-- pay for the text ones.
create index if not exists conversation_messages_voice_idx
  on public.conversation_messages (family_id, created_at desc)
  where modality = 'voice';

comment on column public.conversation_messages.modality is
  'How the turn arrived: typed (text) or spoken (voice, the in-app realtime conversation). Channel stays web for in-app voice, because that is where it happened.';

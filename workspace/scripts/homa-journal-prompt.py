#!/usr/bin/env python3
import json, os, sys, time, random, pathlib, urllib.request, urllib.parse

CHANNEL = "{{JOURNAL_CHANNEL}}"
WORKSPACE = pathlib.Path("/Users/mac/.openclaw/workspace")
PROMPTS_LOG = WORKSPACE / "journal-prompts.jsonl"
ENV_PATH = pathlib.Path("/Users/mac/.openclaw/.env")
CONFIG_PATH = pathlib.Path("/Users/mac/.openclaw/openclaw.json")

QUESTIONS = [
    "Tell me something that happened today.",
    "Anything new with the child?",
    "What did the child do today that surprised you?",
    "Got any updates?",
    "What's something that worked today? What didn't?",
    "What's on your mind?",
    "Anything you want me to remember?",
    "Any wins from today, big or small?",
    "What's something the child said today?",
    "Anything coming up this week I should know about?",
    "What did you do today that you want to remember?",
    "How was today?",
    "Any 'huh, didn't expect that' moments today?",
    "Anything I should pull into the vault?",
]

def get_token():
    # Try .env first
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line.startswith("SLACK_BOT_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    # Fall back to config
    if CONFIG_PATH.exists():
        try:
            cfg = json.loads(CONFIG_PATH.read_text())
            tok = cfg.get("channels", {}).get("slack", {}).get("botToken")
            if tok:
                return tok
        except Exception:
            pass
    return None

def slack_call(method, token, params, post=False):
    url = f"https://slack.com/api/{method}"
    headers = {"Authorization": f"Bearer {token}"}
    if post:
        data = json.dumps(params).encode()
        headers["Content-Type"] = "application/json; charset=utf-8"
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    else:
        url = url + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode())
    if not body.get("ok"):
        raise RuntimeError(f"Slack {method} error: {body.get('error')}")
    return body

def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def append_log(obj):
    with PROMPTS_LOG.open("a") as f:
        f.write(json.dumps(obj) + "\n")

def main():
    token = get_token()
    if not token:
        print("ERROR: no Slack bot token found", file=sys.stderr)
        sys.exit(2)

    if not PROMPTS_LOG.exists():
        PROMPTS_LOG.touch()

    # Step 2: fetch recent history
    hist = slack_call("conversations.history", token, {"channel": CHANNEL, "limit": 20})
    messages = hist.get("messages", [])

    # Step 3: most recent Homa bot message
    last_homa = None
    for m in messages:  # already newest-first
        if m.get("bot_id") or m.get("subtype") == "bot_message" or m.get("app_id"):
            last_homa = m
            break

    if last_homa is not None:
        reply_count = last_homa.get("reply_count", 0)
        last_homa_ts = last_homa.get("ts")
        answered = reply_count and reply_count > 0
        if not answered:
            # double-check via conversations.replies
            try:
                rep = slack_call("conversations.replies", token, {"channel": CHANNEL, "ts": last_homa_ts})
                # replies includes the parent itself
                real_replies = [r for r in rep.get("messages", []) if r.get("ts") != last_homa_ts]
                if len(real_replies) > 0:
                    answered = True
            except Exception as e:
                print(f"WARN replies check: {e}", file=sys.stderr)
            if not answered:
                append_log({"ts": now_iso(), "action": "skipped_unanswered", "last_homa_ts": last_homa_ts})
                print("Skipped: previous question unanswered.")
                return

    # Step 5: pick a question not in last 2 posted
    recent = []
    for line in PROMPTS_LOG.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if obj.get("action") == "posted" and obj.get("question"):
            recent.append(obj["question"])
    last_two = recent[-2:]
    eligible = [q for q in QUESTIONS if q not in last_two]
    if not eligible:
        eligible = QUESTIONS
    question = random.choice(eligible)

    # Step 6: post
    resp = slack_call("chat.postMessage", token, {"channel": CHANNEL, "text": question}, post=True)
    message_ts = resp.get("ts")

    # Step 7: log
    append_log({"ts": now_iso(), "action": "posted", "question": question, "message_ts": message_ts})
    print(f"Posted: {question} (ts={message_ts})")

if __name__ == "__main__":
    main()

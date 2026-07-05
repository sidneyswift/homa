# Runner · how routines execute

Two modes. Mode A is today's mode (DM4, manual-first). Mode B exists so that
flipping to unattended runs later is a one-line human action, not a build
project. Publishing stays manual in both modes, forever (law 1).

## Mode A · manual (current)

The founder says the trigger phrase in a chat session; the agent runs the
routine's `## Prompt` verbatim.

| Trigger phrase | Routine |
|---|---|
| "run tonight's content" | `nightly-content.md` |
| "run the engagement loop" | `weekly-engagement.md` |

## Mode B · scheduled via launchd (not installed)

Do not install until the founder explicitly flips DM4. The pattern: a launchd
job fires the Cursor agent CLI with the routine prompt at the scheduled time.

`~/Library/LaunchAgents/com.homa.marketing.nightly.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.homa.marketing.nightly</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd /Users/sidneyswift/Documents/Projects/Sidney/homa && cursor-agent --print "$(sed -n '/^## Prompt/,$p' marketing/routines/nightly-content.md)"</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>4</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/homa-marketing-nightly.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/homa-marketing-nightly.err</string>
</dict>
</plist>
```

Enable:

```bash
launchctl load ~/Library/LaunchAgents/com.homa.marketing.nightly.plist
```

Disable:

```bash
launchctl unload ~/Library/LaunchAgents/com.homa.marketing.nightly.plist
```

Before enabling: set the routine's frontmatter `enabled: true` in the same
change, so the file state and the scheduler state never disagree. And check the
`cursor-agent` CLI exists (`which cursor-agent`); if the CLI name or flags have
changed, fix this file first.

#!/usr/bin/env python3
"""
Transcribe ANY single audio file via OpenAI Whisper (through the Vercel AI Gateway).

General-purpose transcriber — reuses the proven machinery from transcribe_chunks.py
(the co-op meeting + nightly ambient-voice-note path) but for an arbitrary file passed
on the command line. Auto-chunks anything longer than ~20 min with ffmpeg so a 15-min
recorded lesson (homa-capture-lesson) or a long voice note transcribes cleanly.

Usage:
    python3 scripts/transcribe-audio.py /path/to/lesson.m4a
    python3 scripts/transcribe-audio.py /path/to/lesson.m4a --out transcript.txt

Env: OPENAI_API_KEY (primary; the audio endpoint lives on api.openai.com). Falls back to
OPENAI_BASE_URL if set. NOTE: the Vercel AI Gateway does NOT proxy /audio/transcriptions
(returns 404) — use the real OpenAI base, verified 2026-07-02.
"""
import os, sys, json, subprocess, tempfile, glob, time, argparse
import urllib.request, urllib.error
from pathlib import Path

API_KEY = os.environ.get("OPENAI_API_KEY", "")
BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
MODEL = os.environ.get("WHISPER_MODEL", "whisper-1")
CHUNK_SECONDS = 20 * 60  # 20 min — safely under Whisper's 25MB/file ceiling for speech


def transcribe_one(filepath):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    with open(filepath, "rb") as f:
        file_data = f.read()
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(filepath)}"\r\n'.encode()
    body += b"Content-Type: audio/mp4\r\n\r\n"
    body += file_data + b"\r\n"
    for field, val in (("model", MODEL),
                       ("response_format", "verbose_json"),
                       ("language", "en")):
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{field}"\r\n\r\n'.encode()
        body += f"{val}\r\n".encode()
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE_URL}/audio/transcriptions",
        data=body,
        headers={"Authorization": f"Bearer {API_KEY}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            err = e.read().decode() if hasattr(e, "read") else str(e)
            print(f"  HTTP {e.code}: {err}", file=sys.stderr)
            if e.code == 429:
                time.sleep(30 * (attempt + 1))
            elif attempt < 2:
                time.sleep(5)
            else:
                raise
        except Exception as e:
            print(f"  Error: {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(5)
            else:
                raise


def duration_seconds(filepath):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(filepath)],
            capture_output=True, text=True, timeout=30)
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio", help="path to the audio file")
    ap.add_argument("--out", help="write transcript here (default: <audio>.txt)")
    args = ap.parse_args()

    if not API_KEY:
        print("ERROR: OPENAI_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    src = Path(args.audio)
    if not src.exists():
        print(f"ERROR: not found: {src}", file=sys.stderr)
        sys.exit(1)

    dur = duration_seconds(src)
    parts = []
    if dur > CHUNK_SECONDS + 60:
        print(f"Duration ~{dur/60:.0f}min — chunking into {CHUNK_SECONDS//60}min segments…")
        tmp = tempfile.mkdtemp(prefix="transcribe-")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(src),
             "-f", "segment", "-segment_time", str(CHUNK_SECONDS),
             "-c", "copy", os.path.join(tmp, "chunk_%03d.m4a")],
            check=True)
        parts = sorted(glob.glob(os.path.join(tmp, "chunk_*.m4a")))
    else:
        parts = [str(src)]

    all_text = []
    for i, p in enumerate(parts):
        print(f"[{i+1}/{len(parts)}] transcribing {os.path.basename(p)}…")
        res = transcribe_one(p)
        all_text.append(res.get("text", "").strip())

    transcript = "\n".join(t for t in all_text if t)
    out = Path(args.out) if args.out else src.with_suffix(".txt")
    out.write_text(transcript)
    print(f"\n✓ {len(transcript)} chars → {out}")


if __name__ == "__main__":
    main()

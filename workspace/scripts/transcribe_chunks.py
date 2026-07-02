#!/usr/bin/env python3
"""Transcribe audio chunks via OpenAI Whisper API through Vercel gateway."""
import os, sys, json, glob, time
import urllib.request, urllib.error
from pathlib import Path

API_KEY = os.environ.get("VERCEL_AI_GATEWAY_API_KEY", "")
BASE_URL = "https://ai-gateway.vercel.sh/v1"
CHUNKS_DIR = Path("/Users/mac/.openclaw/workspace/content/sources/meetings/co-op-planning-2026-05-17/co-op-chunks")
OUTPUT_FILE = Path("/Users/mac/.openclaw/workspace/co-op-transcription.txt")

def transcribe_chunk(filepath):
    """Transcribe a single chunk using multipart/form-data upload."""
    import io
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    filename = os.path.basename(filepath)
    with open(filepath, "rb") as f:
        file_data = f.read()
    
    body = b""
    # file field
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    body += b"Content-Type: audio/mp4\r\n\r\n"
    body += file_data
    body += b"\r\n"
    # model field
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="model"\r\n\r\n'
    body += b"openai/whisper-1\r\n"
    # response_format field
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="response_format"\r\n\r\n'
    body += b"verbose_json\r\n"
    # language hint
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="language"\r\n\r\n'
    body += b"en\r\n"
    body += f"--{boundary}--\r\n".encode()
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    
    req = urllib.request.Request(
        f"{BASE_URL}/audio/transcriptions",
        data=body,
        headers=headers,
        method="POST"
    )
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode())
                return result
        except urllib.error.HTTPError as e:
            err_body = e.read().decode() if hasattr(e, 'read') else str(e)
            print(f"  HTTP {e.code}: {err_body}", file=sys.stderr)
            if e.code == 429:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...", file=sys.stderr)
                time.sleep(wait)
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

def main():
    chunks = sorted(glob.glob(str(CHUNKS_DIR / "chunk_*.m4a")))
    print(f"Found {len(chunks)} chunks to transcribe")
    
    all_text = []
    for i, chunk in enumerate(chunks):
        chunk_start_min = i * 10  # each chunk is ~10 min
        print(f"\n[{i+1}/{len(chunks)}] Transcribing {os.path.basename(chunk)} (starts ~{chunk_start_min}min)...")
        result = transcribe_chunk(chunk)
        
        text = result.get("text", "")
        print(f"  Got {len(text)} chars")
        
        # Add timestamp marker
        h, m = divmod(chunk_start_min, 60)
        all_text.append(f"\n--- [{h}:{m:02d}:00] ---\n")
        all_text.append(text)
    
    # Write full transcription
    full = "\n".join(all_text)
    OUTPUT_FILE.write_text(full)
    print(f"\n✅ Full transcription saved to {OUTPUT_FILE} ({len(full)} chars)")

if __name__ == "__main__":
    main()

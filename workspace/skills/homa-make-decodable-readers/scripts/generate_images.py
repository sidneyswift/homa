#!/usr/bin/env python3
"""
Decodable Reader — Image Generator (Nano Banana 2)

TEMPLATE: Copy to your book project directory and customize PAGES.
Usage: BOOK_OUTDIR=/path/to/output python3 generate_images.py
"""
import json, os, time, urllib.request, sys

API_KEY = os.environ["FAL_API_KEY"]
OUTDIR = os.environ.get("BOOK_OUTDIR", os.getcwd())

STYLE = "cartoon watercolor children's picture book illustration, bright vivid colors, soft rounded shapes, gentle textures, expressive characters, professional children's book art quality"
NO_TEXT = "Do not include any text, words, letters, titles, or captions in the image"

# Character — customize per book
STORY_DESC = "a young boy character with shoulder-length wavy blonde hair and bright blue eyes, pale skin, rosy cheeks"

# CUSTOMIZE: Define pages here
PAGES = [
    # {"filename": "page00-cover.jpg", "prompt": f"...{STYLE}. {NO_TEXT}"},
    # {"filename": "page01.jpg", "prompt": f"...{STYLE}. {NO_TEXT}"},
]

def generate(prompt, aspect="16:9", retries=2):
    for attempt in range(retries + 1):
        try:
            payload = json.dumps({
                "prompt": prompt,
                "aspect_ratio": aspect,
                "output_format": "jpeg",
                "resolution": "1K",
                "num_images": 1,
            }).encode()
            req = urllib.request.Request(
                "https://fal.run/fal-ai/nano-banana-2",
                data=payload,
                headers={
                    "Authorization": f"Key {API_KEY}",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.loads(resp.read())
        except Exception as e:
            if attempt < retries:
                print(f"  Retry {attempt+1}/{retries}: {e}")
                time.sleep(3)
            else:
                raise

if not PAGES:
    print("No pages defined — customize PAGES in this script first.")
    sys.exit(1)

os.makedirs(OUTDIR, exist_ok=True)
for page in PAGES:
    filename = page["filename"]
    outpath = os.path.join(OUTDIR, filename)
    if os.path.exists(outpath) and os.path.getsize(outpath) > 50000:
        print(f"SKIP {filename}")
        continue
    print(f"Generating {filename}...")
    sys.stdout.flush()
    try:
        data = generate(page["prompt"])
        img_url = data["images"][0]["url"]
        urllib.request.urlretrieve(img_url, outpath)
        print(f"  OK ({os.path.getsize(outpath):,} bytes)")
    except Exception as e:
        print(f"  FAILED: {e}")
    sys.stdout.flush()
    time.sleep(2)

#!/usr/bin/env python3
"""
Picture Book Image Generator — Nano Banana 2 (text-to-image)

TEMPLATE: Copy this file into your book project directory and customize PAGES.
Usage: python3 generate.py [--outdir /path/to/output]
"""
import json, os, time, urllib.request, sys

API_KEY = os.environ["FAL_API_KEY"]
OUTDIR = os.environ.get("BOOK_OUTDIR", os.getcwd())

STYLE = "cartoon watercolor children's picture book illustration, bright vivid colors, soft rounded shapes, gentle textures, expressive characters, professional children's book art quality"
NO_TEXT = "Do not include any text, words, letters, titles, or captions in the image"

# === CHARACTER SHEET (frozen for this book) ===
# CRITICAL: Keep these EXACT strings on every page for consistency.
# Include outfit — NB2 invents different clothes per page if you don't lock it.
# If a character changes clothes mid-story, define a second constant (e.g., STORY_PJ, STORY_DAY).
STORY = "a young boy character with shoulder-length wavy blonde hair and bright blue eyes, pale skin, rosy cheeks, wearing blue pajamas"
# BRUNO = "a young boy character with short brown hair and brown eyes, light brown skin, round cheeks, wearing a Buzz Lightyear t-shirt and green shorts"
# DOG = "a small white French Bulldog with a black patch over one eye, big bat ears with pink inner ears"

# Define your pages here — each needs a filename and prompt
PAGES = [
    {
        "filename": "page00-cover.jpg",
        "prompt": f"Children's picture book cover. A cozy bedroom at night. {STORY} wearing blue pajamas, sleeping in bed with a peaceful smile. Above him a large dreamy thought bubble shows a sunny birthday party with green and purple space-themed balloons and a birthday cake with a number 2 candle. Stars and golden sparkles float around. {STYLE}",
    },
    {
        "filename": "page01-missing-bruno.jpg",
        "prompt": f"Children's picture book page. {STORY} in blue pajamas sitting on his bed, looking at a framed photo showing two boys together. He looks a little sad but hopeful. Through a window behind him, the Washington DC skyline at dusk with the Washington Monument visible against an orange-pink sky. Warm bedroom lighting. {STYLE}",
    },
    {
        "filename": "page02-falling-asleep.jpg",
        "prompt": f"Children's picture book page. {STORY} in cozy blue pajamas curled up in bed, eyes gently closing, hugging a plush white stuffed cow toy. Magical golden stars and sparkles swirl up from his pillow into the dark blue sky above. A warm nightlight glows in the corner. Peaceful dreamy atmosphere. {STYLE}",
    },
    {
        "filename": "page03-dream-begins.jpg",
        "prompt": f"Children's picture book page. {STORY} in blue pajamas floating joyfully through a magical swirling sky full of stars, planets, and sparkles. Arms spread wide like a superhero flying, huge excited smile on his face. Below him, warm golden Florida sunshine glows. The scene transitions from dark starry night above to warm sunshine below. Dynamic swooping composition. {STYLE}",
    },
    {
        "filename": "page04-arrive-party.jpg",
        "prompt": f"Children's picture book page. {STORY} standing amazed in a sunny Florida backyard decorated for a space-themed birthday party. Green, purple, and white balloons everywhere. A colorful banner reads 'HAPPY BIRTHDAY BRUNO'. Palm trees, bright blue sky. Party tables with space-themed plates and cups. The boy's mouth is open in wonder. {STYLE}",
    },
    {
        "filename": "page05-bruno-hug.jpg",
        "prompt": f"Children's picture book page. Two young boy characters hugging joyfully at an outdoor birthday party. One has shoulder-length blonde hair and blue eyes, the other has short brown hair and brown eyes wearing a Buzz Lightyear t-shirt. Both have huge happy smiles. Green and purple balloons and streamers around them. Warm sunlight, green grass, palm trees in background. Heartwarming reunion moment. {STYLE}",
    },
    {
        "filename": "page06-space-rangers.jpg",
        "prompt": f"Children's picture book page. Two young boy characters playing as space rangers running through a sunny backyard. One has shoulder-length blonde hair, one has short brown hair. Both wear homemade cardboard jetpacks with tinfoil on their backs. Running with arms stretched out like flying, laughing with pure joy. Space-themed party decorations, palm trees, bright blue sky, green grass. Full of energy and movement. {STYLE}",
    },
    {
        "filename": "page07-cake.jpg",
        "prompt": f"Children's picture book page. A beautiful space-themed birthday cake in the center — green, purple, and white frosting with a Buzz Lightyear toy figure on top and a big lit number 2 candle. Two young boy characters stand behind the cake — one with blonde hair, one with brown hair leaning forward to blow out the candle. Colorful confetti falling, party hats. Festive and joyful. {STYLE}",
    },
    {
        "filename": "page08-playing.jpg",
        "prompt": f"Children's picture book page. Two young boy characters — one with blonde hair, one with brown hair — running together through a sunny Florida backyard, laughing with mouths wide open in pure joy. Rainbow bubbles float all around them. Palm trees with space-themed balloons tied to a white picket fence. Late afternoon golden light. Energetic and happy. {STYLE}",
    },
    {
        "filename": "page09-goodbye-dream.jpg",
        "prompt": f"Children's picture book page. Bittersweet dreamy scene. Two young boy characters — one with blonde hair, one with brown hair — facing each other, holding hands. The edges of the image are soft, hazy, sparkly like a dream fading. Golden sparkles and stars swirl around them. Both smile warmly. Background transitions from the sunny party on the left to a starry night sky on the right. Beautiful and emotional. {STYLE}",
    },
    {
        "filename": "page10-wake-up.jpg",
        "prompt": f"Children's picture book page. {STORY} waking up in his cozy bed with a big peaceful smile, morning sunlight streaming through yellow curtains on the left side. On the right side, curtains still show fading stars from the dream. He hugs a small toy rocket. A stuffed white cow sits on the pillow beside him. Washington DC buildings visible through the window. Warm feeling of a wonderful dream lingering. {STYLE}",
    },
]

def generate(prompt, aspect="16:9", retries=2):
    """Generate image using nano-banana-2 text-to-image with retries."""
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
                print(f"  Retry {attempt+1}/{retries} after error: {e}")
                time.sleep(3)
            else:
                raise

for page in PAGES:
    filename = page["filename"]
    outpath = os.path.join(OUTDIR, filename)
    
    if os.path.exists(outpath) and os.path.getsize(outpath) > 50000:
        print(f"SKIP {filename} (already exists, {os.path.getsize(outpath):,} bytes)")
        sys.stdout.flush()
        continue
    
    print(f"Generating {filename}...")
    sys.stdout.flush()
    
    try:
        data = generate(page["prompt"])
        img_url = data["images"][0]["url"]
        urllib.request.urlretrieve(img_url, outpath)
        size = os.path.getsize(outpath)
        print(f"  Done: {filename} ({size:,} bytes)")
        if size < 20000:
            print(f"  WARNING: File suspiciously small!")
    except Exception as e:
        print(f"  FAILED: {e}")
    
    sys.stdout.flush()
    time.sleep(2)

print("\nDone! Checking results:")
for page in PAGES:
    p = os.path.join(OUTDIR, page["filename"])
    if os.path.exists(p):
        print(f"  OK  {page['filename']} ({os.path.getsize(p):,} bytes)")
    else:
        print(f"  MISSING  {page['filename']}")

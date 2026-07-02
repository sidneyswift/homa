#!/usr/bin/env python3
"""List all image files with sizes, for manual audit."""
import os

OUT_DIR = "/Users/mac/.openclaw/workspace/content/curriculum/art-creative/worksheets/art-images/versions/v1"
# Known correct artworks (verified via image analysis)
CORRECT = {
    "vangogh-starry-night", "vangogh-bedroom", "vangogh-self-portrait", "vangogh-road-cypress",
    "mondrian-composition", "gehry-disney-hall", "maya-lin-memorial", "flavin-light",
    "koons-balloon-dog", "bourgeois-maman", "oldenburg-spoonbridge", "marcus-aurelius-equestrian",
    "kapoor-cloud-gate", "whiteread-house", "hockney-bigger-splash",
    "eric-carle-caterpillar", "stained-glass-chartres", "kente-cloth",
    "alma-thomas-resurrection", "alma-thomas-astronauts", "sherald-michelle-obama",
    "homer-breezing-up", "pinata", "japanese-kite", "charley-harper", "butterfield-horse",
    # Fixed and verified
    "calder-wire-sculpture",  # Flamingo
    "okeeffe-from-plains",  # Red Canna
    "noguchi-red-cube",  # Red Cube
    "kelly-spectrum",  # Color Panels
    "eliasson-rainbow",  # Weather Project
    "arp-constellation",  # Constellation
    "gordon-parks",  # American Gothic
    "haring-subway",  # Crack is Wack
    "hadid-architecture",  # Heydar Aliyev Center
    "sherald-portraits",  # Michelle Obama portrait
    "kahlo-self-portrait",  # Self-portrait with Thorn Necklace
    "albers-homage-square",  # Homage to the Square
    "rothko-color-field",  # No. 61
    "rivera-flower-carrier",  # Detroit Industry Murals
    "william-morris-wallpaper",  # Strawberry Thief
    "ringgold-story-quilt",  # Tar Beach
    "rauschenberg-combines",  # Canyon
    "degas-horse",  # Little Dancer
    "hirst-butterflies",  # Shark in formaldehyde
    "wiley-rumors-of-war",  # Rumors of War statue
    "herrera-geometric",  # Hard-edge painting
    "matisse-still-life-pomegranates",  # Woman with a Hat
    # Probably correct but artist-adjacent (artist in studio with work visible)
}

# Known wrong (artist photos, wrong artwork, or garbage)
WRONG = {
    "lewitt-wall-drawing-1136",  # MoCA building exterior
    "basquiat-skull",  # deleted (was loon bird)
    "stella-harran-ii",  # artist photo
    "kusama-pumpkin",  # artist photo
    "murakami-flowers",  # artist photo
    "wiley-napoleon",  # artist photo
    "matisse-snail",  # artist photo
    "kara-walker-silhouette",  # artist photo
    "nevelson-sculpture",  # artist photo
    "thiebaud-streets",  # deleted (was wrong artwork)
    "bearden-collage",  # deleted (was wrong artwork)
    "cindy-sherman",  # artist photo
    "guyton-heidelberg",  # artist photo
    "twombly-untitled-1970",  # artist photo
    "quick-to-see-smith",  # Mona Lisa?!
    "betye-saar",  # artist photo
    "asawa-wire",  # artist photo
    # Also wrong from earlier batches:
    "turrell-skyspace",  # Roden Crater aerial (not an artwork you can see)
    "anni-albers-textile",  # was Amrita Sher-Gil
    "nick-cave-soundsuit",  # artist photo
    "noguchi-red-cube",  # was Picasso - BUT FIXED NOW
}

# Need to verify
UNVERIFIED = set()

for f in sorted(os.listdir(OUT_DIR)):
    if not f.endswith('.jpg'): continue
    slug = f.replace('.jpg', '')
    size = os.path.getsize(os.path.join(OUT_DIR, f))
    status = "✓" if slug in CORRECT else ("✗" if slug in WRONG else "?")
    print(f"{status} {slug} ({size//1024}K)")

print(f"\nCorrect: {len(CORRECT)}")
print(f"Wrong: {len(WRONG)}")

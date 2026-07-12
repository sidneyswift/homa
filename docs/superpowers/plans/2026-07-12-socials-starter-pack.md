# Socials Starter Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build upload-ready Homa profile pictures, platform banners, and transparent lockups from the repository's canonical vector brand assets.

**Architecture:** Add one focused TypeScript generator that reads the existing mark and lockup SVGs, composites them onto exact-size brand backgrounds with Sharp, and verifies each raster after writing it. Keep the finished assets and their usage notes together under `marketing/assets/socials-starter-pack/`.

**Tech Stack:** TypeScript, tsx, Sharp, SVG, PNG

---

### Task 1: Add the deterministic asset generator

**Files:**
- Create: `scripts/socials-starter-pack-assets.mts`
- Modify: `package.json`

- [x] **Step 1: Confirm the command does not exist yet**

Run: `pnpm gen:socials`

Expected: FAIL because `gen:socials` is not yet defined.

- [x] **Step 2: Create the generator**

The generator must:

1. Read `marketing/assets/brand/homa-mark.svg`,
   `marketing/assets/brand/homa-lockup.svg`, and
   `marketing/assets/brand/homa-lockup-dark.svg`.
2. Create cream `#FBF7F0` and navy `#23304F` variants.
3. Use a 780-pixel-wide avatar-safe mark on each 1024×1024 profile picture.
4. Center lockups at these exact sizes:
   - YouTube: 2560×1440 canvas, 700-pixel-wide lockup.
   - X: 1500×500 canvas, 560-pixel-wide lockup.
   - LinkedIn: 4200×700 canvas, 900-pixel-wide lockup.
5. Copy the standard and reversed transparent SVG lockups.
6. Render both transparent lockups at 2400 pixels wide as PNG.
7. Verify dimensions, PNG format, opacity, transparency, background colors,
   and platform file-size limits before reporting success.

Use named types and small functions for rendering, writing, and verification.
Keep imports at the top of the module.

- [x] **Step 3: Register the command**

Add this script to the root `package.json`:

```json
"gen:socials": "tsx scripts/socials-starter-pack-assets.mts"
```

- [x] **Step 4: Run the generator**

Run: `pnpm gen:socials`

Expected: PASS and print one verified line for every generated PNG.

### Task 2: Document the upload-ready files

**Files:**
- Create: `marketing/assets/socials-starter-pack/README.md`

- [x] **Step 1: Add the asset manifest**

Document:

- The purpose of each subfolder.
- Every exact pixel dimension.
- The cream and navy token values.
- YouTube's centered safe-area requirement and 6 MB limit.
- X's possible 60-pixel top and bottom crop.
- LinkedIn Company Page's 3 MB limit.
- Which transparent lockup to use on light and dark backgrounds.
- The regeneration command, `pnpm gen:socials`.

- [x] **Step 2: Check the copy against Homa's rules**

Run:

```bash
rg "—|HOMA" marketing/assets/socials-starter-pack/README.md
```

Expected: no matches.

### Task 3: Verify the complete pack

**Files:**
- Verify: `marketing/assets/socials-starter-pack/**/*.png`
- Verify: `marketing/assets/socials-starter-pack/**/*.svg`

- [x] **Step 1: Regenerate from canonical sources**

Run: `pnpm gen:socials`

Expected: PASS with all ten raster files verified.

- [x] **Step 2: Confirm the file inventory**

Expected inventory:

```text
README.md
banners/linkedin/homa-linkedin-banner-cream-4200x700.png
banners/linkedin/homa-linkedin-banner-navy-4200x700.png
banners/x/homa-x-banner-cream-1500x500.png
banners/x/homa-x-banner-navy-1500x500.png
banners/youtube/homa-youtube-banner-cream-2560x1440.png
banners/youtube/homa-youtube-banner-navy-2560x1440.png
logos/homa-lockup-reversed-transparent-2400.png
logos/homa-lockup-reversed-transparent.svg
logos/homa-lockup-transparent-2400.png
logos/homa-lockup-transparent.svg
pfp/homa-pfp-cream-1024.png
pfp/homa-pfp-navy-1024.png
```

- [x] **Step 3: Visually inspect all raster variants**

Confirm:

- Every mark and lockup is centered.
- Cream assets use the standard clay and dark-ink artwork.
- Navy assets use the brighter clay and white-wordmark artwork.
- Profile marks remain clear inside circular crops.
- Banner lockups have generous empty space and remain inside crop-safe centers.

- [x] **Step 4: Check edited files for lint diagnostics**

Read diagnostics for:

- `scripts/socials-starter-pack-assets.mts`
- `package.json`

Expected: no new diagnostics.

Do not create a git commit unless the user explicitly requests one.

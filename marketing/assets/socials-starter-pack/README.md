# Homa socials starter pack

Upload-ready profile pictures, banners, and transparent lockups for Homa's
social accounts. Every image is generated from the canonical vector assets in
`marketing/assets/brand/`.

## Profile pictures

- `pfp/homa-pfp-cream-1024.png`: 1024×1024, warm cream background.
- `pfp/homa-pfp-navy-1024.png`: 1024×1024, brand navy background.

Both files include avatar-safe spacing for circular platform crops.

## Platform banners

Each platform folder contains matching cream and navy variants:

- `banners/youtube/`: 2560×1440 PNG.
- `banners/x/`: 1500×500 PNG.
- `banners/linkedin/`: 4200×700 PNG for a LinkedIn Company Page.

Upload notes:

- YouTube keeps text and logos safest in the centered 1235×338 area. These
  lockups fit inside that area. YouTube accepts files up to 6 MB.
- X can crop about 60 pixels from the top and bottom on some displays. The
  lockup stays inside the remaining center.
- LinkedIn can crop covers across screen sizes. The lockup is centered and
  clear of the edges. LinkedIn Company Page images must stay under 3 MB.

## Transparent lockups

- `logos/homa-lockup-transparent.svg`: standard lockup for light backgrounds.
- `logos/homa-lockup-transparent-2400.png`: high-resolution standard PNG.
- `logos/homa-lockup-reversed-transparent.svg`: reversed lockup for dark backgrounds.
- `logos/homa-lockup-reversed-transparent-2400.png`: high-resolution reversed PNG.

SVG files are best for design tools because they remain sharp at any size. PNG
files are ready for tools that do not accept SVG.

## Brand colors

- Cream: `#FBF7F0`
- Navy: `#23304F`

## Regenerate

Run:

```bash
pnpm gen:socials
```

The generator writes every raster at its exact platform size, checks
transparency and background colors, and enforces YouTube and LinkedIn file-size
limits.

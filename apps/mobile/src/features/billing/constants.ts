/**
 * The one product this app sells today, mirroring
 * APPLE_PRODUCT_TIER_IDS.regular in apps/web/lib/billing/wall.ts (keep
 * both in sync until a shared package exists, M1-17 shape). Plus/Max
 * stay unsold until #293/#297 close (FD-5, regular-tier-only carve-out).
 */
export const REGULAR_WEEKLY_PRODUCT_ID = "com.thankshoma.homa.regular.weekly";

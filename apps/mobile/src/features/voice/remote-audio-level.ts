export interface AudioEnergySample {
  totalAudioEnergy: number;
  totalSamplesDuration: number;
}

export interface RemoteAudioLevelReading {
  level: number | null;
  energy: AudioEnergySample | null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function reportValues(report: unknown): readonly unknown[] {
  if (report instanceof Map) return [...report.values()];
  if (!Array.isArray(report)) return [];
  return report.map((entry) => Array.isArray(entry) ? entry[1] : entry);
}

function energySample(stat: Record<string, unknown>): AudioEnergySample | null {
  const totalAudioEnergy = finiteNumber(stat.totalAudioEnergy);
  const totalSamplesDuration = finiteNumber(stat.totalSamplesDuration);
  if (
    totalAudioEnergy === null
    || totalAudioEnergy < 0
    || totalSamplesDuration === null
    || totalSamplesDuration < 0
  ) return null;
  return { totalAudioEnergy, totalSamplesDuration };
}

/**
 * Reads Homa's received audio level from standardized inbound WebRTC stats.
 * `audioLevel` is preferred. Cumulative energy is the cross-implementation
 * fallback, using the RMS formula defined by the WebRTC Stats specification.
 */
export function readRemoteAudioLevel(
  report: unknown,
  previousEnergy: AudioEnergySample | null = null,
): RemoteAudioLevelReading {
  for (const value of reportValues(report)) {
    if (typeof value !== "object" || value === null) continue;
    const stat = value as Record<string, unknown>;
    const kind = stat.kind ?? stat.mediaType;
    if (stat.type !== "inbound-rtp" || kind !== "audio") continue;

    const energy = energySample(stat);
    const directLevel = finiteNumber(stat.audioLevel);
    if (directLevel !== null) {
      return { level: clamp01(directLevel), energy };
    }

    if (energy && previousEnergy) {
      const energyDelta = energy.totalAudioEnergy - previousEnergy.totalAudioEnergy;
      const durationDelta = energy.totalSamplesDuration - previousEnergy.totalSamplesDuration;
      if (energyDelta >= 0 && durationDelta > 0) {
        return {
          level: clamp01(Math.sqrt(energyDelta / durationDelta)),
          energy,
        };
      }
    }
    return { level: null, energy };
  }

  return { level: null, energy: null };
}

/**
 * Speech levels cluster near zero. A small gate removes codec floor noise,
 * then a square-root curve gives ordinary words useful visual range without
 * letting peaks turn the glow into a flash.
 */
export function visualVoiceLevel(rawLevel: number): number {
  const noiseFloor = 0.012;
  const conversationalPeak = 0.16;
  if (rawLevel <= noiseFloor) return 0;
  const normalized = clamp01(
    (rawLevel - noiseFloor) / (conversationalPeak - noiseFloor),
  );
  return Math.sqrt(normalized);
}

/** Fast attack catches syllables; slower release joins them into calm phrases. */
export function smoothVoiceLevel(previous: number, next: number): number {
  const weight = next > previous ? 0.68 : 0.22;
  return previous + (next - previous) * weight;
}

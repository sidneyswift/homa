import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "homa:device-calendar-export:v1";

function ledgerKey(familyId: string, fingerprint: string): string {
  return `${PREFIX}:${familyId}:${fingerprint}`;
}

export async function exportedFingerprints(
  familyId: string,
  fingerprints: readonly string[],
): Promise<Set<string>> {
  const rows = await AsyncStorage.multiGet(fingerprints.map((fingerprint) => ledgerKey(familyId, fingerprint)));
  return new Set(
    rows
      .filter(([, value]) => value !== null)
      .map(([key]) => key.slice(`${PREFIX}:${familyId}:`.length)),
  );
}

export async function rememberCalendarExport(
  familyId: string,
  fingerprint: string,
  deviceEventId: string | null,
): Promise<void> {
  await AsyncStorage.setItem(
    ledgerKey(familyId, fingerprint),
    JSON.stringify({ exportedAt: new Date().toISOString(), deviceEventId }),
  );
}

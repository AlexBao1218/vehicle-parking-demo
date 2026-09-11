export type SyncMode = 'test' | 'production';

export function getSyncMode(): SyncMode {
  const raw = (process.env.SYNC_MODE ?? 'test').trim().toLowerCase();
  if (raw === 'production') return 'production';
  return 'test';
}

export function getTestVehicleLicenses(): string[] {
  const raw = (process.env.TEST_VEHICLE_LICENSES ?? '').trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);
}

export function isTestVehicle(license: string): boolean {
  const normalized = (license ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return getTestVehicleLicenses().some(
    (l: string) => l.toLowerCase() === normalized,
  );
}
const VALID_ROTATIONS = new Set([0, 90, 180, 270]);

export function normalizeRotationDegrees(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;

  const normalized = ((Math.round(numeric) % 360) + 360) % 360;
  return VALID_ROTATIONS.has(normalized) ? normalized : 0;
}

export function rotatedDimensions(width: number | null | undefined, height: number | null | undefined, rotationDegrees: unknown) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: null, height: null };
  }

  const rotation = normalizeRotationDegrees(rotationDegrees);
  if (rotation === 90 || rotation === 270) {
    return { width: Math.round(h), height: Math.round(w) };
  }
  return { width: Math.round(w), height: Math.round(h) };
}

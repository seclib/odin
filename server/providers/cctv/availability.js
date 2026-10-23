/** Map proxy observations to user-facing availability; never infer from catalog presence. */
export function cctvAvailability({ status = 'unknown', sourceKind = '' } = {}) {
  const normalized = String(status).toLowerCase();
  if (normalized === 'ok') return 'available';
  if (normalized === 'unknown') return 'unknown';
  if (['streetview', 'synthetic'].includes(String(sourceKind).toLowerCase()))
    return 'fallback';
  return 'unavailable';
}

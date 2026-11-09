/** Return an actionable, privacy-safe message for microphone acquisition failures. */
export function microphoneAccessMessage(
  error,
  { secureContext = globalThis.isSecureContext } = {},
) {
  const name = String(error?.name || '');
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return secureContext === false
      ? 'Voice requires a secure page (HTTPS or localhost). Open Odin securely, then allow microphone access.'
      : 'Microphone access was denied. Allow microphone access for this site in browser settings, then retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'No microphone was found. Connect or enable a microphone, then retry.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'The microphone is unavailable or already in use. Close other apps using it, then retry.';
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError')
    return 'No microphone satisfies the requested audio settings. Check the selected device and retry.';
  if (name === 'AbortError')
    return 'The microphone request was interrupted. Retry voice input.';
  if (name === 'TypeError')
    return 'Microphone access is unavailable in this browser context. Use HTTPS or localhost and a supported browser.';
  return null;
}

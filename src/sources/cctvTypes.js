/**
 * Canonicalize a CCTV feed type string to one of:
 * 'image', 'mjpeg', 'mp4', 'webm', 'hls', or pass-through.
 *
 * @param {string} value - Raw feed type (e.g. 'jpeg', 'mjpg', 'video', 'stream').
 * @returns {string} Normalized feed type.
 */
export function normalizeFeedType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'image';
  if (raw === 'jpeg' || raw === 'jpg' || raw === 'png') return 'image';
  if (raw === 'mjpg') return 'mjpeg';
  if (raw === 'video') return 'mp4';
  if (raw === 'stream') return 'hls';
  return raw;
}

/**
 * Check whether a normalized feed type represents streaming video.
 *
 * @param {string} feedType
 * @returns {boolean}
 */
export function isVideoFeedType(feedType) {
  return feedType === 'mp4' || feedType === 'webm' || feedType === 'hls';
}

const MEDIA_MODES = new Set([
  'continuous-video',
  'still-image',
  'periodic-image',
  'periodic-loop',
  'video-clip',
  'external-embed',
]);

/** Describe the delivery mode without inferring that a URL is currently live. */
export function normalizeCctvMediaMode(value, feedType, externalUrl = '') {
  const explicit = String(value || '')
    .trim()
    .toLowerCase();
  if (externalUrl) return 'external-embed';
  if (MEDIA_MODES.has(explicit)) return explicit;
  const type = normalizeFeedType(feedType);
  if (type === 'hls' || type === 'mjpeg') return 'continuous-video';
  if (type === 'image') return 'still-image';
  if (type === 'mp4' || type === 'webm') return 'video-clip';
  return 'still-image';
}

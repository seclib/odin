/** Satellite and launch-feed middleware for Node development servers. */
export { celestrakProxy } from './space/celestrak.js';
export {
  nasaImagesProxy,
  NASA_IMAGES_CACHE_TTL_MS,
} from './space/nasa-images.js';
export {
  rocketLaunchesProxy,
  LL2_CACHE_TTL_MS,
  launchLibraryRequestHeaders,
} from './space/launch-library.js';

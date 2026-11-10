/** Normalize 3D tileset source creation across providers.
 *
 * This utility standardizes the *contract* (input/output shape) for creating
 * a Cesium3DTileset, without merging implementation logic or creating a new
 * provider abstraction layer. The actual creation logic stays in each provider.
 *
 * @module sourceNormalizer
 */

/** Result shape of a normalized tileset creation. */
export const NormalizedResult = {
  /** True if a tileset was created successfully. */
  success: false,
  /** The created Cesium3DTileset, if any. */
  tileset: null,
  /** Error message, if creation failed. */
  error: null,
};

/**
 * Validate that a value is a plausible Cesium3DTileset instance.
 * A tileset must have `maximumScreenSpaceError` defined as a number.
 */
export function isCesium3DTileset(value) {
  if (!value || typeof value !== 'object') return false;
  try {
    return typeof value.maximumScreenSpaceError === 'number';
  } catch {
    return false;
  }
}

/** Normalize an error value to an Error instance, or null if no error. */
function normalizeError(error) {
  if (error === null || error === undefined) return null;
  if (error instanceof Error) return error;
  return new Error(String(error));
}

/** Normalize a provider's tileset creation result into a common shape.
 *
 * Google paths return { tileset, errors: Error[] }.
 * MapSourceController paths may throw or return a tileset.
 *
 * @param {object} result - Raw result from the provider.
 * @param {Cesium3DTileset} [result.tileset] - The created tileset.
 * @param {Error[]} [result.errors] - Creation errors (Google path).
 * @param {Error} [result.error] - Single error (throw path).
 * @returns {import('./sourceNormalizer.js').NormalizedResult} Normalized result.
 */
export function normalizeCreationResult(result) {
  let error = normalizeError(result?.error);
  let tileset = null;
  if (result?.tileset && isCesium3DTileset(result.tileset)) {
    tileset = result.tileset;
  }

  // If tileset is missing/invalid and no error was provided, synthesize one
  if (!tileset && error == null) {
    error = new Error('Tileset creation failed');
  }

  return {
    success: !!(tileset && error == null),
    tileset,
    error,
  };
}

/** Normalize Google's loadPhotorealisticTileset result.
 *
 * Google returns { tileset, route, errors } from loadPhotorealisticTileset.
 *
 * @param {{tileset: Cesium3DTileset|null, route: string, errors: Error[]}} result
 * @returns {import('./sourceNormalizer.js').NormalizedResult}
 */
export function normalizeGoogleResult(result) {
  return normalizeCreationResult({
    tileset: result.tileset,
    errors: result.errors || [],
    error: result.errors?.[0] || null,
  });
}

/** Normalize MapSourceController tileset creation result.
 *
 * The controller may resolve a tileset asynchronously via source.createTileset()
 * or the _cached factory. This wrapper assumes the caller has already awaited
 * the creation and holds the resulting tileset.
 *
 * @param {{tileset: Cesium3DTileset|null}} result - Result object expected to
 *     contain a tileset property.
 * @returns {import('./sourceNormalizer.js').NormalizedResult}
 */
export function normalizeExternalResult(result) {
  return normalizeCreationResult({
    tileset: result?.tileset,
    error: result?.error,
  });
}

/** Return the "creation failed" normalizable result. */
export function creationFailed() {
  return {
    success: false,
    tileset: null,
    error: new Error('Tileset creation failed'),
  };
}
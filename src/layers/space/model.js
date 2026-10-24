const NASA_IMAGE_HOST = 'images-assets.nasa.gov';

/** Convert one NASA Images API item into display-safe archive metadata. */
export function normalizeNASAImageItem(item) {
  const data = item?.data?.[0];
  const nasaId = typeof data?.nasa_id === 'string' ? data.nasa_id.trim() : '';
  const preview = item?.links?.find(
    (link) => link?.render === 'image' && link?.rel === 'alternate',
  )?.href;
  let previewUrl;
  try {
    const parsed = new URL(preview);
    if (parsed.protocol !== 'https:' || parsed.hostname !== NASA_IMAGE_HOST)
      return null;
    previewUrl = parsed.href;
  } catch {
    return null;
  }
  if (!nasaId || data?.media_type !== 'image') return null;
  return {
    id: nasaId,
    title: typeof data.title === 'string' ? data.title : null,
    previewUrl,
    catalogDate:
      typeof data.date_created === 'string' ? data.date_created : null,
    center: typeof data.center === 'string' ? data.center : null,
    credit:
      typeof data.photographer === 'string' && data.photographer.trim()
        ? data.photographer.trim()
        : typeof data.center === 'string' && data.center.trim()
          ? data.center.trim()
          : 'Credit not provided in NASA catalog record',
    description: typeof data.description === 'string' ? data.description : '',
    sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
  };
}

/** Validate and normalize the NASA Images API search response. */
export function normalizeNASAImageSearch(payload) {
  const collection = payload?.collection;
  if (!collection || !Array.isArray(collection.items))
    throw new Error('Malformed NASA Images response');
  const items = collection.items
    .map(normalizeNASAImageItem)
    .filter(Boolean)
    .slice(0, 12);
  const totalHits = Number(collection.metadata?.total_hits);
  return {
    items,
    totalHits: Number.isFinite(totalHits) && totalHits >= 0 ? totalHits : null,
  };
}

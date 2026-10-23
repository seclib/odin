import { createSpaceImageSource } from '../layers/space/source.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Bind the NASA archive gallery inside the existing Space Missions context. */
export function initSpaceGallery({
  root = document,
  source = createSpaceImageSource(),
} = {}) {
  const form = root.querySelector('#space-gallery-form');
  const input = root.querySelector('#space-gallery-query');
  const status = root.querySelector('#space-gallery-status');
  const results = root.querySelector('#space-gallery-results');
  if (!form || !input || !status || !results) return { destroy() {} };

  let controller = null;
  let destroyed = false;
  const render = (items) => {
    results.replaceChildren();
    for (const item of items) {
      const card = element('article', 'space-gallery-card');
      const link = element('a', 'space-gallery-image-link');
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute(
        'aria-label',
        `Open NASA archive record: ${item.title}`,
      );
      const image = element('img', 'space-gallery-image');
      image.src = item.previewUrl;
      image.alt = item.title;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      link.append(image);
      card.append(link, element('strong', 'space-gallery-title', item.title));
      const metadata = element('div', 'space-gallery-meta');
      metadata.append(element('span', '', `Credit: ${item.credit}`));
      if (item.catalogDate)
        metadata.append(
          element('span', '', `NASA catalog date: ${item.catalogDate}`),
        );
      card.append(metadata);
      if (item.description)
        card.append(
          element('p', 'space-gallery-description', item.description),
        );
      const provenance = element(
        'a',
        'space-gallery-record',
        'NASA source record',
      );
      provenance.href = item.sourceUrl;
      provenance.target = '_blank';
      provenance.rel = 'noopener noreferrer';
      card.append(provenance);
      results.append(card);
    }
  };

  const search = async (query) => {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    status.textContent = 'Searching NASA archive…';
    results.replaceChildren();
    try {
      const response = await source.search(query, {
        signal: requestController.signal,
      });
      if (destroyed || requestController.signal.aborted) return;
      render(response.items);
      status.textContent = response.items.length
        ? `${response.items.length} archive image${response.items.length === 1 ? '' : 's'} shown${response.totalHits === null ? '' : ` · ${response.totalHits} catalog matches`}.`
        : 'No NASA archive images found for this search.';
    } catch (error) {
      if (destroyed || requestController.signal.aborted) return;
      status.textContent =
        error?.message || 'NASA image archive is unavailable.';
    }
  };
  const onSubmit = (event) => {
    event.preventDefault();
    void search(input.value);
  };
  const onPreset = (event) => {
    const button = event.target.closest('[data-space-query]');
    if (!button || !root.contains(button)) return;
    input.value = button.dataset.spaceQuery;
    void search(input.value);
  };
  form.addEventListener('submit', onSubmit);
  root
    .querySelector('.space-gallery-presets')
    ?.addEventListener('click', onPreset);

  return {
    search,
    destroy() {
      destroyed = true;
      controller?.abort();
      form.removeEventListener('submit', onSubmit);
      root
        .querySelector('.space-gallery-presets')
        ?.removeEventListener('click', onPreset);
      results.replaceChildren();
    },
  };
}

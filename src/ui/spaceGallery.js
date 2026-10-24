import { createSpaceImageSource } from '../layers/space/source.js';
import { t, tn } from '../i18n/index.js';

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
      const title = item.title || t('Untitled NASA image');
      const card = element('article', 'space-gallery-card');
      const link = element('a', 'space-gallery-image-link');
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute(
        'aria-label',
        t('Open NASA archive record: {title}', { title }),
      );
      const image = element('img', 'space-gallery-image');
      image.src = item.previewUrl;
      image.alt = title;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      link.append(image);
      card.append(link, element('strong', 'space-gallery-title', title));
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
    status.textContent = t('Searching NASA archive…');
    results.replaceChildren();
    try {
      const response = await source.search(query, {
        signal: requestController.signal,
      });
      if (destroyed || requestController.signal.aborted) return;
      render(response.items);
      status.textContent = response.items.length
        ? `${tn(response.items.length, '{count} archive image shown.', '{count} archive images shown.')} ${response.totalHits === null ? '' : t('({count} catalog matches)', { count: response.totalHits })}`.trim()
        : t('No NASA archive images found for this search.');
    } catch (error) {
      if (destroyed || requestController.signal.aborted) return;
      status.textContent =
        error?.message || t('NASA image archive is unavailable.');
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

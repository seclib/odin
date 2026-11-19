/**
 * ODIN — "Local data management" settings rubrique (content only).
 *
 * This module owns the category registry and its DOM rendering. The shell
 * (dialog, top-dock entry, focus and Escape handling) lives in
 * `src/generalSettings.js`: local data is a rubrique of the general settings,
 * never an independent dock icon. No storage operation is wired here yet.
 *
 * Adding a category later means adding one entry to LOCAL_DATA_CATEGORIES and,
 * if needed, a renderer branch in `renderCategoryDetail`. Nothing else changes.
 */
import { t, msg } from './i18n/index.js';

/** @typedef {'available'|'upcoming'} CategoryState */

/**
 * The initial category registry. Pure data: no DOM, no side effects, no calls
 * to the local-data server. `planned` entries are informational only and must
 * never render as active controls.
 * @type {ReadonlyArray<{id:string,title:string,description:string,state:CategoryState,planned:ReadonlyArray<string>,note:string|null}>}
 */
export const LOCAL_DATA_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'storage',
    title: msg('Storage and locations'),
    description: msg(
      'Choose where ODIN keeps local data, enable or disable retention, and manage existing folders.',
    ),
    state: 'upcoming',
    planned: Object.freeze([
      msg('Choosing the storage location'),
      msg('Enabling or disabling local retention'),
      msg('Displaying occupied volume'),
      msg('Changing the folder'),
      msg('Managing existing data'),
    ]),
    note: msg(
      'Folder paths must be managed by the local ODIN server: a browser cannot write to arbitrary host directories.',
    ),
  }),
  Object.freeze({
    id: 'buildings',
    title: msg('3D buildings'),
    description: msg(
      'Microsoft GMLFP footprints, IGN altitude enrichment and generated 3D Tiles.',
    ),
    state: 'available',
    planned: Object.freeze([]),
    note: msg(
      'The 3D buildings layer is operational. Storage management will be connected here after the full dataset is validated.',
    ),
  }),
  Object.freeze({
    id: 'terrain',
    title: msg('Terrain models'),
    description: msg(
      'Local elevation data and terrain tiles kept on this machine.',
    ),
    state: 'upcoming',
    planned: Object.freeze([]),
    note: null,
  }),
  Object.freeze({
    id: 'imagery',
    title: msg('Imagery and maps'),
    description: msg('Cartographic data and imagery cached locally.'),
    state: 'upcoming',
    planned: Object.freeze([]),
    note: null,
  }),
  Object.freeze({
    id: 'integrity',
    title: msg('Integrity and maintenance'),
    description: msg('Checksums, versions, cleanup and backups of local data.'),
    state: 'upcoming',
    planned: Object.freeze([]),
    note: null,
  }),
]);

/** @returns {{label:string,tone:string}} */
export function categoryStateMeta(state) {
  return state === 'available'
    ? { label: t(msg('AVAILABLE')), tone: 'ok' }
    : { label: t(msg('UPCOMING')), tone: 'off' };
}

/**
 * Localized, DOM-free view model. Kept separate so the registry contract and
 * state labels can be unit-tested without a browser.
 * @returns {Array<{id:string,title:string,description:string,state:string,label:string,tone:string,planned:string[],note:string|null}>}
 */
export function localDataHubCategories(registry = LOCAL_DATA_CATEGORIES) {
  return registry.map((category) => ({
    id: category.id,
    title: t(category.title),
    description: t(category.description),
    state: category.state,
    ...categoryStateMeta(category.state),
    planned: category.planned.map((entry) => t(entry)),
    note: category.note ? t(category.note) : null,
  }));
}

/** Create a labelled DOM node without ever injecting text as HTML. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderMain(container, categories, openCategory) {
  container.replaceChildren();
  container.append(el('h2', 'ldh-title', t(msg('Local data management'))));
  container.append(
    el(
      'p',
      'ldh-intro',
      t(
        msg(
          'Data kept by ODIN on this machine is organized below. Each category evolves independently.',
        ),
      ),
    ),
  );
  const list = el('div', 'ldh-categories');
  list.dataset.localDataHubList = 'true';
  for (const category of categories) {
    const card = el('button', 'ldh-card');
    card.type = 'button';
    card.dataset.category = category.id;
    const head = el('div', 'ldh-card-head');
    head.append(el('span', 'ldh-card-title', category.title));
    const chip = el('span', `ld-chip ld-chip-${category.tone}`, category.label);
    chip.dataset.state = category.state;
    head.append(chip);
    card.append(head, el('p', 'ldh-card-desc', category.description));
    card.addEventListener('click', () => openCategory(category.id));
    list.append(card);
  }
  container.append(list);
}

function renderCategoryDetail(container, categories, id, goBack) {
  const category = categories.find((entry) => entry.id === id);
  container.replaceChildren();
  if (!category) return;
  const back = el('button', 'ldh-back');
  back.type = 'button';
  back.dataset.role = 'back';
  const icon = el('span', 'material-symbols-outlined', 'arrow_left');
  icon.setAttribute('aria-hidden', 'true');
  back.append(icon, document.createTextNode(t(msg('Back'))));
  back.addEventListener('click', goBack);
  container.append(back);

  const head = el('div', 'ldh-card-head');
  head.append(el('h2', 'ldh-title', category.title));
  const chip = el('span', `ld-chip ld-chip-${category.tone}`, category.label);
  chip.dataset.state = category.state;
  head.append(chip);
  container.append(head, el('p', 'ldh-intro', category.description));
  if (category.note) container.append(el('p', 'ldh-note', category.note));

  if (category.planned.length) {
    container.append(el('h3', 'ldh-subtitle', t(msg('Planned features'))));
    const list = el('ul', 'ldh-planned');
    for (const item of category.planned) list.append(el('li', null, item));
    container.append(list);
  }
  // Upcoming categories intentionally have no action buttons: an inert button
  // would suggest the feature already exists.
  container.append(
    el(
      'p',
      'ldh-footnote',
      t(
        msg(
          'No interactive controls are shown for categories that are not implemented yet.',
        ),
      ),
    ),
  );
}

/**
 * Render this rubrique into a container owned by the general settings dialog.
 * @param {HTMLElement} container
 * @param {{documentRef?:Document}} [options]
 * @returns {{render():void, goBack():void, active():string|null}}
 */
export function mountLocalDataRubrique(
  container,
  { categories = localDataHubCategories() } = {},
) {
  const main = el('div', 'ldh-main');
  main.dataset.localDataHubSection = 'main';
  const detail = el('div', 'ldh-detail');
  detail.dataset.localDataHubSection = 'detail';
  detail.hidden = true;
  container.replaceChildren(main, detail);

  let active = null;
  const goBack = () => {
    active = null;
    detail.hidden = true;
    main.hidden = false;
    renderMain(main, categories, openCategory);
  };
  const openCategory = (id) => {
    active = id;
    main.hidden = true;
    detail.hidden = false;
    renderCategoryDetail(detail, categories, id, goBack);
    detail
      .querySelector('[data-role="back"]')
      ?.focus?.({ preventScroll: true });
  };
  renderMain(main, categories, openCategory);
  return {
    render: goBack,
    goBack,
    active: () => active,
  };
}

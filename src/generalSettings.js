/**
 * ODIN — general settings shell.
 *
 * The top dock's gear opens ONE settings dialog. Local data management is a
 * rubrique inside it, not another dock icon. The shell owns focus, Escape, the
 * active state of the gear and navigation between rubriques; each rubrique
 * owns only its content.
 */
import { t, msg } from './i18n/index.js';
import { mountLocalDataRubrique } from './localDataHub.js';
import { createSurfaceKeyboard } from './ui/surfaceKeyboard.js';

/**
 * Declarative rubrique registry. Adding a settings page = one entry here plus
 * a renderer branch in `renderRubrique`.
 * @type {ReadonlyArray<{id:string,title:string}>}
 */
export const SETTINGS_RUBRIQUES = Object.freeze([
  Object.freeze({ id: 'local-data', title: msg('Local data management') }),
  Object.freeze({ id: 'providers', title: msg('Providers') }),
]);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let _keySetupOriginalParent = null;

function restoreKeySetup() {
  const ks = document.getElementById('key-setup');
  if (!ks) return;
  ks.classList.remove('gs-embedded', 'visible');
  ks.hidden = true;
  if (_keySetupOriginalParent && ks.parentElement !== _keySetupOriginalParent) {
    _keySetupOriginalParent.appendChild(ks);
  }
}

function renderProviders(content, doc, closeSettings) {
  content.replaceChildren();
  content.append(el('h2', 'gs-title', t(msg('Providers'))));
  content.append(
    el('p', 'gs-intro', t(msg('Provider keys and credentials configured for this ODIN installation.'))),
  );
  const ks = doc.getElementById('key-setup');
  if (!ks) {
    content.append(
      el('p', 'gs-note', t(msg('Provider settings are not available in this build.'))),
    );
    return;
  }
  if (!_keySetupOriginalParent) _keySetupOriginalParent = ks.parentElement;
  // Embed the existing key-setup manager inline so configuration happens here.
  ks.classList.add('gs-embedded');
  ks.hidden = false;
  ks.classList.add('visible');
  content.appendChild(ks);
}

/**
 * Mount the general settings dialog.
 * @param {{documentRef?:Document, signal?:AbortSignal}} [options]
 */
export function initGeneralSettings({ documentRef = document, signal } = {}) {
  const doc = documentRef;
  const button = doc.getElementById('settings-btn');
  const dialog = doc.getElementById('general-settings');
  if (!button || !dialog) return { open() {}, render() {}, destroy() {} };
  if (dialog.dataset.initialized === 'true') return { open() {}, render() {}, destroy() {} };
  dialog.dataset.initialized = 'true';

  let destroyed = false;
  let activeRubrique = null;
  let rubriqueHandle = null;
  const nav = dialog.querySelector('[data-role="rubriques"]');
  const content = dialog.querySelector('[data-role="content"]');
  const close = dialog.querySelector('[data-role="close"]');

  const setActive = (value) => {
    button.setAttribute('aria-pressed', String(value));
    dialog.classList.toggle('visible', value);
    dialog.hidden = !value;
  };
  const hide = () => {
    if (dialog.hidden) return;
    keyboard.deactivate({ restoreFocus: true });
    setActive(false);
  };
  // Reuse ODIN's surface keyboard: Tab stays inside the dialog and Escape is
  // arbitrated with the other surfaces instead of closing them all at once.
  const keyboard = createSurfaceKeyboard({
    root: dialog,
    documentRef: doc,
    isActive: () => !dialog.hidden && !destroyed,
    onEscape: hide,
    fallbackFocus: () => button,
  });
  const open = () => {
    if (destroyed || !dialog.hidden) return;
    setActive(true);
    keyboard.activate();
    close?.focus?.({ preventScroll: true });
  };

  const renderRubrique = (id) => {
    activeRubrique = id;
    rubriqueHandle = null;
    // Restore the key-setup dialog to its home when leaving Providers.
    if (id !== 'providers') restoreKeySetup();
    for (const item of nav.querySelectorAll('[data-rubrique]')) {
      if (item.dataset.rubrique === id) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
    if (id === 'local-data') rubriqueHandle = mountLocalDataRubrique(content);
    else renderProviders(content, doc, hide);
  };

  nav.replaceChildren();
  for (const rubrique of SETTINGS_RUBRIQUES) {
    const item = el('button', 'gs-rubrique', t(rubrique.title));
    item.type = 'button';
    item.dataset.rubrique = rubrique.id;
    item.addEventListener('click', () => renderRubrique(rubrique.id));
    nav.append(item);
  }
  renderRubrique('local-data');

  button.addEventListener('click', () => (dialog.hidden ? open() : hide()));
  close?.addEventListener('click', hide);
  setActive(false);

  const destroy = () => {
    destroyed = true;
    restoreKeySetup();
    keyboard.destroy();
    dialog.dataset.initialized = 'false';
    setActive(false);
  };
  if (signal?.aborted) destroy();
  else signal?.addEventListener('abort', destroy, { once: true });
  return {
    open,
    render: () => renderRubrique(activeRubrique ?? 'local-data'),
    destroy,
    activeRubrique: () => activeRubrique,
    localData: () => rubriqueHandle,
  };
}

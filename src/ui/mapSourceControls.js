import { renderMapStackChips, syncMapStackChips } from '../mapStackChips.js';
import { t } from '../i18n/index.js';

/**
 * Own Map Source presentation and selection without constructing map providers.
 * The supplied controller remains authoritative for availability and active state.
 */
export function createMapSourceControls({
  container,
  statusElement,
  controller,
  subscribe,
  claimSelection = () => {},
  onStateChanged = () => {},
  onError = () => {},
}) {
  let destroyed = false;
  let generation = 0;
  /** Last error already surfaced; avoids a duplicate toast per switch. */
  let shownError = null;
  const removers = [];
  const bind = (element, type, listener) => {
    element.addEventListener(type, listener);
    removers.push(() => element.removeEventListener(type, listener));
  };
  function render(state) {
    if (destroyed || !state) return;
    syncMapStackChips(container, state.activeId);
    if (statusElement) {
      const stack = state.activeStack;
      statusElement.textContent =
        state.status === 'switching'
          ? '...'
          : stack?.shortLabel || stack?.label || t('MAP');
      statusElement.classList.toggle('warn', !!state.lastError);
    }
  }
  async function select(stackId, { syncShare = true } = {}) {
    if (destroyed) return null;
    const current = ++generation;
    shownError = null;
    if (syncShare) claimSelection();
    render(controller.getState('switching'));
    let state;
    try {
      state = await controller.setStack(stackId);
    } catch (error) {
      if (!destroyed && current === generation) {
        render(controller.getState());
        onError(error?.message || String(error));
      }
      throw error;
    }
    if (destroyed || current !== generation) return state;
    const settled = controller.getState();
    render(settled);
    // A failure is worth reporting even when the controller landed on a
    // fallback stack: the lit chip tells WHERE we landed, the toast tells WHY.
    const message = settled.lastError || state?.lastError;
    if (message && message !== shownError) {
      shownError = message;
      onError(message);
    }
    if (syncShare) onStateChanged();
    return state;
  }
  function refresh() {
    if (destroyed) return;
    for (const remove of removers.splice(0)) remove();
    renderMapStackChips(container, controller.getStacks(), {
      activeId: controller.getActiveId(),
      onSelect: (id) => {
        void select(id).catch(() => {});
      },
      bind,
    });
    render(controller.getState());
  }
  const unsubscribe = subscribe(() => {
    if (destroyed) return;
    const state = controller.getState();
    render(state);
    // Automatic fallbacks never pass through select(): report their error on
    // the same status feed that keeps the chips in sync with the controller.
    if (!state.lastError) shownError = null;
    else if (state.lastError !== shownError) {
      shownError = state.lastError;
      onError(state.lastError);
    }
    onStateChanged();
  });
  refresh();
  return {
    render,
    select,
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      unsubscribe?.();
      for (const remove of removers.splice(0)) remove();
    },
  };
}

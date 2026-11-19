import { UiLifetime } from './uiLifetime.js';
import { t, msg, onLocaleChange } from '../i18n/index.js';
import { displayPanelScroller } from './displayPanelScroll.js';
import { PanelPositionControls } from './panelPositionControls.js';
import { PanelLayoutController } from './panelLayoutController.js';
import {
  bindPanelDisclosure,
  collapsePanelOnEscape,
  createHoverDisclosure,
} from './panelDisclosure.js';
const SHARE_PANEL_STATE_SPECS = Object.freeze([
  { id: 'control-panel', pinnable: true },
  { id: 'location-bar', pinnable: true },
  { id: 'data-panel' },
  { id: 'cctv-panel' },
  { id: 'weather-panel' },
  { id: 'recent-imagery-panel' },
  { id: 'street-level-panel' },
  { id: 'radio-panel' },
  { id: 'scene-panel' },
  { id: 'global-context-panel' },
  { id: 'pp-toggles' },
  { id: 'param-slider-panel' },
]);
/** Standard map-view panels cleared out of the way on a fresh Cockpit entry. */
const COCKPIT_ENTRY_COLLAPSE_PANEL_IDS = Object.freeze([
  'data-panel',
  'cctv-panel',
  'weather-panel',
  'recent-imagery-panel',
  'street-level-panel',
  'scene-panel',
  'pp-toggles',
  'global-context-panel',
  'radio-panel',
]);

/** Own panel disclosure, docking, persistence and Cockpit rail restoration. */
export class PanelChrome {
  constructor({
    elements,
    operations,
    readHud,
    readCockpit,
    readShareLinks,
    readInitialShare,
    readScrollRestoreOwner,
    readDisplayScrollTop,
  }) {
    Object.assign(this, elements, operations, {
      readHud,
      readCockpit,
      readShareLinks,
      readInitialShare,
      readScrollRestoreOwner,
      readDisplayScrollTop,
    });
    this._disposed = false;
    this._lifetime = new UiLifetime();
    this._cockpitPanelRestore = null;
    this._cockpitContextCollapsedForDataPanel = false;
    this._panelPosition = new PanelPositionControls({
      syncPanelCollapseButton: (panel) => this._syncPanelCollapseButton(panel),
      layoutRightPanels: () => this._layoutRightPanels(),
      syncCctvPanelViewport: () => this._syncCctvPanelViewport(),
      showToast: (message) => this._showToast(message),
      onPanelResized: (panelId) => this._onPanelResized(panelId),
    });
    this._panelLayout = new PanelLayoutController({
      readHud: () => ({
        visible: this.hud.visible,
        variant: this.hud.getVariant(),
      }),
      scheduleCockpitLayout: () => this.cockpitView?.scheduleContextLayout(),
      syncPanelCollapseButton: (panel) => this._syncPanelCollapseButton(panel),
      readDisplayScrollTop: () =>
        this._displayPortalScrollRestoreOwner === 'standard'
          ? this._standardDisplayScrollTop
          : displayPanelScroller(this._ppToggles)?.scrollTop || 0,
    });
  }
  get hud() {
    return this.readHud();
  }
  get cockpitView() {
    return this.readCockpit();
  }
  get shareLinkManager() {
    return this.readShareLinks();
  }
  get _initialShareState() {
    return this.readInitialShare();
  }
  get _displayPortalScrollRestoreOwner() {
    return this.readScrollRestoreOwner();
  }
  get _standardDisplayScrollTop() {
    return this.readDisplayScrollTop();
  }

  _initPanelChrome() {
    this._leftPanelStack = document.getElementById('left-panel-stack');
    this._rightPanelStack = document.getElementById('right-context-rail');
    this._ensureRailFlyoutMode?.() || (() => {
      for (const stack of [this._leftPanelStack, this._rightPanelStack]) {
        if (stack) stack.dataset.railMode = 'flyout';
      }
    })();
    for (const control of this._panelDisclosureControls || [])
      control.destroy();
    this._panelDisclosureControls = [];
    const targets = new Map();
    document
      .querySelectorAll('.panel-collapse-btn[data-collapse-target]')
      .forEach((button) => {
        const targetId = button.dataset.collapseTarget;
        if (!targetId) return;
        if (!targets.has(targetId)) targets.set(targetId, []);
        targets.get(targetId).push(button);
      });
    for (const [targetId, buttons] of targets) {
      const panel = document.getElementById(targetId);
      if (!panel) continue;
      this._panelDisclosureControls.push(
        bindPanelDisclosure({
          panel,
          buttons,
          onChange: (collapsed, options) =>
            this.setPanelCollapsed(targetId, collapsed, options),
          onEscape: (event) => this._collapsePanelOnEscape(event, targetId),
        }),
      );
      this._restorePanelCollapsedState(targetId, {
        allowStored: !this._initialShareState,
      });
    }
    // The command dock always starts compact; either wing reveals on hover,
    // focus, or click and collapses again after the interaction moves away.
    this.setPanelCollapsed('control-panel', true, {
      syncShare: false,
      persist: false,
    });
    this.setPanelCollapsed('location-bar', true, {
      syncShare: false,
      persist: false,
    });
    this._initAutoHoverPanel('control-panel', {
      openDelayMs: 140,
      closeDelayMs: 420,
    });
    this._initAutoHoverPanel('location-bar', {
      openDelayMs: 140,
      closeDelayMs: 420,
    });
    this._initCommandDockPins();
    this._initCommandDockTrayMetrics();
    this._maybeNotifyLayoutReset();
    this._panelPosition._initPanelDrag();
    // Rail flyouts: keep at most one open panel per side after restore.
    for (const side of ['left', 'right']) {
      const open = this._openRailPanels(side);
      if (open.length > 1) {
        for (const panel of open.slice(1)) {
          this.setPanelCollapsed(panel.id, true, {
            persist: false,
            syncShare: false,
          });
        }
      }
    }
    this._initRailFlyoutBehavior();
    this._lifetime.frame(() => this._positionAllOpenRailFlyouts());
  }

  _collapsePanelOnEscape(event, panelId) {
    return collapsePanelOnEscape(event, {
      panel: document.getElementById(panelId),
      onChange: (collapsed, options) =>
        this.setPanelCollapsed(panelId, collapsed, options),
      beforeCollapse: () => {
        if (panelId !== 'location-bar' || !this._locationSearch) return;
        this._locationSearch.classList.remove('expanded');
        this._locationSearch.value = '';
        this._locationSearch.blur();
      },
    });
  }

  _initCommandDockPins() {
    document
      .querySelectorAll('.dock-pin-btn[data-pin-target]')
      .forEach((button) => {
        this._lifetime.listen(button, 'click', (event) => {
          event.stopPropagation();
          const panelId = button.dataset.pinTarget;
          this._setCommandDockPanelPinState(panelId);
        });
      });
  }

  _setCommandDockPanelPinState(
    panelId,
    pin,
    { restore = false, persist = true, syncShare = true } = {},
  ) {
    const panelEl = document.getElementById(panelId);
    const button = document.querySelector(
      `.dock-pin-btn[data-pin-target="${panelId}"]`,
    );
    if (!panelEl || !button) return undefined;
    const shouldPin =
      typeof pin === 'boolean'
        ? pin
        : !panelEl.classList.contains('dock-pinned');
    panelEl.classList.toggle('dock-pinned', shouldPin);
    button.setAttribute('aria-pressed', String(shouldPin));
    document
      .querySelectorAll('#command-dock .dock-pinned-top')
      .forEach((pinnedPanel) => {
        pinnedPanel.classList.remove('dock-pinned-top');
      });
    if (shouldPin) {
      panelEl.classList.add('dock-pinned-top');
      this.setPanelCollapsed(panelId, false, {
        explicit: !restore,
        restore,
        persist,
        syncShare: false,
      });
    } else {
      const remainingPinnedPanel = document.querySelector(
        '#command-dock .dock-pinned',
      );
      remainingPinnedPanel?.classList.add('dock-pinned-top');
      if (!restore && !panelEl.matches(':hover')) {
        this.setPanelCollapsed(panelId, true, {
          explicit: true,
          persist,
          syncShare: false,
        });
      }
    }
    this._updateCommandDockTrayStack();
    if (syncShare) {
      if (!restore) this.shareLinkManager?.claimRestoreLane?.('panel', panelId);
      this.shareLinkManager?.onPanelStateChange?.();
    }
    return shouldPin;
  }

  _initCommandDockTrayMetrics() {
    return this._panelLayout._initCommandDockTrayMetrics();
  }

  _updateCommandDockTrayStack() {
    return this._panelLayout._updateCommandDockTrayStack();
  }

  _maybeNotifyLayoutReset() {
    return this._panelPosition._maybeNotifyLayoutReset();
  }

  _initAutoHoverPanel(
    panelId,
    { openDelayMs = 850, closeDelayMs = 1000 } = {},
  ) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    this._hoverPanelControls ??= new Map();
    this._hoverPanelControls.get(panelId)?.destroy();
    const controller = createHoverDisclosure({
      panel,
      documentRef: document,
      disclosure: panel.querySelector(`[data-dock-toggle-target="${panelId}"]`),
      openDelayMs,
      closeDelayMs,
      isActive: () => !this._disposed,
      onChange: (collapsed, options) =>
        this.setPanelCollapsed(panelId, collapsed, options),
      onEscape: (event) => this._collapsePanelOnEscape(event, panelId),
      focusTarget:
        panelId === 'control-panel'
          ? () =>
              panel.querySelector('.map-stack-chip.active') ||
              panel.querySelector('.map-stack-chip')
          : null,
    });
    this._hoverPanelControls.set(panelId, controller);
    if (panelId === 'control-panel') {
      this._cancelMapSourceFocus?.();
      this._cancelMapSourceFocus = controller.cancelPendingFocus;
    }
  }

  _restorePanelCollapsedState(panelId, options1) {
    return this._panelPosition._restorePanelCollapsedState(panelId, options1);
  }

  _savePanelCollapsedState(panelId, collapsed) {
    return this._panelPosition._savePanelCollapsedState(panelId, collapsed);
  }

  _scheduleRightPanelLayout(options0) {
    return this._panelLayout._scheduleRightPanelLayout(options0);
  }

  _scheduleLeftPanelLayout(options0) {
    return this._panelLayout._scheduleLeftPanelLayout(options0);
  }

  _syncPanelCollapseButton(panelEl) {
    const isRightRail = [
      'pp-toggles',
      'cctv-panel',
      'weather-panel',
      'recent-imagery-panel',
      'street-level-panel',
      'global-context-panel',
    ].includes(panelEl?.id);
    const collapsed = panelEl.classList.contains('collapsed');
    panelEl
      .querySelectorAll('.panel-collapse-btn[data-collapse-target]')
      .forEach((btn) => {
        const owner = btn.closest('[data-panel-id], #param-slider-panel');
        if (owner !== panelEl) return;
        if (isRightRail) {
          btn.textContent = collapsed ? '◀' : '▶';
        } else {
          btn.textContent = collapsed ? '+' : '−';
        }
        btn.setAttribute('aria-expanded', String(!collapsed));
        const panelName =
          panelEl
            .querySelector('.panel-title, .pp-header-label')
            ?.textContent?.trim() || t('panel');
        const titleKey = collapsed
          ? msg('Expand {name}')
          : msg('Collapse {name}');
        btn.title = t(titleKey, { name: panelName });
        btn.setAttribute('aria-label', t(titleKey, { name: panelName }));
        if (panelEl.id === 'radio-panel') {
          // Radio keeps the wording of its static button (context.html).
          btn.title = t(
            collapsed ? msg('Expand Radio') : msg('Collapse Radio'),
          );
          btn.setAttribute(
            'aria-label',
            t(
              collapsed
                ? msg('Expand Radio section')
                : msg('Collapse Radio section'),
            ),
          );
        }
      });
    const dockToggle = panelEl.querySelector(
      `[data-dock-toggle-target="${panelEl.id}"]`,
    );
    if (dockToggle) {
      const panelName =
        panelEl
          .querySelector('.panel-title, .location-toolbar-label')
          ?.textContent?.trim() || t('panel');
      const titleKey = collapsed
        ? msg('Expand {name}')
        : msg('Collapse {name}');
      dockToggle.setAttribute('aria-expanded', String(!collapsed));
      dockToggle.setAttribute('aria-label', t(titleKey, { name: panelName }));
      dockToggle.title = t(titleKey, { name: panelName });
    }
    if (panelEl.id === 'radio-panel' && this._contextRadioDetailsBtn) {
      this._contextRadioDetailsBtn.setAttribute(
        'aria-expanded',
        String(!collapsed),
      );
    }
    if (panelEl.id === 'radio-panel' || panelEl.id === 'global-context-panel') {
      this._syncContextRadioLauncherState();
    }
  }

  _buildSharePanelState() {
    const specs = [];
    for (const spec of SHARE_PANEL_STATE_SPECS) {
      const panelEl = document.getElementById(spec.id);
      if (!panelEl) continue;
      // Responsive auto-collapse is presentation only; the recipient should
      // restore the user's explicit expanded preference at its own viewport.
      const collapsed =
        panelEl.classList.contains('layout-auto-collapsed') ||
        panelEl.classList.contains('cyber-accordion-collapsed')
          ? false
          : panelEl.classList.contains('collapsed');
      const entry = { id: spec.id, collapsed };
      if (spec.pinnable)
        entry.pinned = panelEl.classList.contains('dock-pinned');
      specs.push(entry);
    }
    return specs.length ? { specs } : null;
  }

  _restorePanelState(panelState) {
    if (!panelState || !Array.isArray(panelState.specs)) return;
    const specsById = new Map(panelState.specs.map((spec) => [spec.id, spec]));
    for (const spec of SHARE_PANEL_STATE_SPECS) {
      const state = specsById.get(spec.id);
      if (!state || typeof state.collapsed !== 'boolean') continue;
      if (spec.pinnable && typeof state.pinned === 'boolean') {
        this._setCommandDockPanelPinState(spec.id, state.pinned, {
          restore: true,
          persist: false,
          syncShare: false,
        });
      }
      const nextCollapsed =
        state.pinned && spec.pinnable ? false : state.collapsed;
      this.setPanelCollapsed(spec.id, nextCollapsed, {
        restore: true,
        persist: false,
        syncShare: false,
      });
    }
    this.shareLinkManager?.onPanelStateChange?.();
  }

  /** @returns {boolean} Whether the panel was floating and is now docked. */
  dockPanel(panelId) {
    return this._panelPosition?.dockPanel?.(panelId) === true;
  }

  setPanelCollapsed(
    panelId,
    collapsed,
    {
      explicit = false,
      restore = false,
      persist = true,
      syncShare = true,
    } = {},
  ) {
    if (panelId === 'control-panel' && collapsed)
      this._cancelMapSourceFocus?.();
    const panelEl = document.getElementById(panelId);
    if (!panelEl) return;
    if (explicit && !restore)
      this.shareLinkManager?.claimRestoreLane?.('panel', panelId);
    const nextCollapsed = Boolean(collapsed);
    const wasAutoCollapsed =
      panelEl.classList.contains('layout-auto-collapsed') ||
      panelEl.classList.contains('cyber-accordion-collapsed');
    // A user opening a Cyber rail panel owns the whole accordion, including
    // peers that were only presentation-collapsed during a saved-state restore.
    // A floating window is outside the accordion both ways.
    if (
      explicit &&
      !restore &&
      !nextCollapsed &&
      document.documentElement?.dataset.uiTheme === 'cyber' &&
      panelEl.parentElement === this._rightPanelStack &&
      !panelEl.classList.contains('panel-floating')
    ) {
      for (const peer of this._rightPanelStack.children) {
        if (
          peer !== panelEl &&
          peer.matches('[data-panel-id]') &&
          !peer.classList.contains('panel-floating') &&
          !peer.hidden
        ) {
          this.setPanelCollapsed(peer.id, true, {
            explicit,
            persist,
            syncShare: false,
          });
        }
      }
    }
    const leftOwnerPanel = this._leftPanelStack?.contains(panelEl)
      ? panelEl
      : null;
    const rightOwnerPanel =
      panelId === 'radio-panel'
        ? document.getElementById('global-context-panel')
        : this._rightPanelStack?.contains(panelEl)
          ? panelEl
          : null;
    const priorLeftOwner = this._panelLayout._leftStackPreferredPanelId;
    const priorRightOwner = this._panelLayout._rightStackPreferredPanelId;
    if (explicit && !restore && !nextCollapsed && leftOwnerPanel) {
      this._panelLayout._leftStackPreferredPanelId = leftOwnerPanel.id;
    } else if (
      explicit &&
      !restore &&
      nextCollapsed &&
      leftOwnerPanel?.id === this._panelLayout._leftStackPreferredPanelId
    ) {
      this._panelLayout._leftStackPreferredPanelId = null;
    }
    if (explicit && !restore && !nextCollapsed && rightOwnerPanel) {
      this._panelLayout._rightStackPreferredPanelId = rightOwnerPanel.id;
    } else if (
      explicit &&
      !restore &&
      nextCollapsed &&
      rightOwnerPanel?.id === this._panelLayout._rightStackPreferredPanelId
    ) {
      this._panelLayout._rightStackPreferredPanelId = null;
    }
    // Rail flyouts: one open panel per side, aligned beside the persistent bar.
    if (!nextCollapsed && this._isRailFlyoutPanel(panelId)) {
      this._closeOtherRailPanels(panelId, { persist, syncShare: false });
      // Keep dock menus from overlapping side flyouts.
      this._closeDockPopovers({ persist, syncShare: false });
    } else if (
      !nextCollapsed &&
      (panelId === 'location-bar' || panelId === 'control-panel')
    ) {
      // Avoid simultaneous dock/sidebar flyout overlap.
      this._closeOpenRailFlyouts({ persist, syncShare: false });
    }
    // Reveal Radio's owner before the no-op check: the nested section may
    // already be expanded while its Context parent is closed.
    if (
      document.documentElement?.dataset.uiTheme === 'cyber' &&
      !nextCollapsed &&
      panelId === 'radio-panel' &&
      document
        .getElementById('global-context-panel')
        ?.classList.contains('collapsed')
    ) {
      this.setPanelCollapsed('global-context-panel', false, {
        explicit,
        restore,
        persist,
        syncShare,
      });
    }
    if (
      panelEl.classList.contains('collapsed') === nextCollapsed &&
      !wasAutoCollapsed
    ) {
      this._syncPanelCollapseButton(panelEl);
      if (priorLeftOwner !== this._panelLayout._leftStackPreferredPanelId) {
        this._scheduleLeftPanelLayout({ reconsiderAutoCollapse: true });
      }
      if (priorRightOwner !== this._panelLayout._rightStackPreferredPanelId) {
        this._scheduleRightPanelLayout({ reconsiderAutoCollapse: true });
      }
      return;
    }
    panelEl.classList.remove(
      'layout-auto-collapsed',
      'cyber-accordion-collapsed',
    );
    if (
      !nextCollapsed &&
      this.cockpitView?.active &&
      panelId === 'data-panel'
    ) {
      this._cockpitContextCollapsedForDataPanel =
        !this.cockpitView.contextCollapsed;
      if (this._cockpitContextCollapsedForDataPanel) {
        this.cockpitView.setContextCollapsed(true);
      }
    }
    if (
      !nextCollapsed &&
      panelId === 'global-context-panel' &&
      this._contextRadioDock?.classList.contains('disclosure-open')
    ) {
      this._setRadioDisclosure?.(false);
    }
    if (
      !nextCollapsed &&
      panelId === 'radio-panel' &&
      document.documentElement?.dataset.uiTheme !== 'cyber' &&
      document
        .getElementById('global-context-panel')
        ?.classList.contains('collapsed')
    ) {
      this.setPanelCollapsed('global-context-panel', false, {
        restore,
        persist,
        syncShare,
      });
    }
    if (!nextCollapsed && !restore && panelId === 'location-bar') {
      const otherPanel = document.getElementById('control-panel');
      if (otherPanel && !otherPanel.classList.contains('dock-pinned')) {
        this.setPanelCollapsed('control-panel', true, {
          restore,
          persist,
          syncShare,
        });
      }
    } else if (!nextCollapsed && !restore && panelId === 'control-panel') {
      const otherPanel = document.getElementById('location-bar');
      if (otherPanel && !otherPanel.classList.contains('dock-pinned')) {
        this.setPanelCollapsed('location-bar', true, {
          restore,
          persist,
          syncShare,
        });
      }
    }
    panelEl.classList.toggle('collapsed', nextCollapsed);
    // Only a user's own collapse docks a floating window; restores, cockpit
    // entry and accordion peers keep its place.
    if (explicit && !restore)
      this._panelPosition?.onPanelCollapsed?.(panelId, nextCollapsed);
    if (
      nextCollapsed &&
      this.cockpitView?.active &&
      panelId === 'data-panel' &&
      this._cockpitContextCollapsedForDataPanel
    ) {
      this._cockpitContextCollapsedForDataPanel = false;
      this.cockpitView.setContextCollapsed(false);
    }
    this._syncPanelCollapseButton(panelEl);
    if (persist !== false)
      this._savePanelCollapsedState(panelId, nextCollapsed);
    if (panelId === 'pp-toggles') {
      this._layoutRightPanels();
    }
    if (this._rightPanelStack?.contains(panelEl)) {
      this._scheduleRightPanelLayout({ reconsiderAutoCollapse: true });
    }
    if (panelId === 'cctv-panel') {
      this._syncCctvPanelViewport();
    }
    this._lifetime.frame(() => this._updateCommandDockTrayStack());
    this._scheduleLeftPanelLayout({
      reconsiderAutoCollapse: this._leftPanelStack?.contains(panelEl) === true,
    });
    if (this._isRailFlyoutPanel(panelId)) this._syncRailTabA11y();
    if (!nextCollapsed && this._isRailFlyoutPanel(panelId)) {
      // Position once synchronously so the flyout never paints at its static
      // position; the rAF pass then re-anchors after late content sizing.
      this._positionRailFlyout(panelEl);
      this._scheduleRailFlyoutPosition(panelId);
    } else if (nextCollapsed && this._isRailFlyoutPanel(panelId)) {
      // Only a rail flyout owns a detached, JS-positioned body, so only that
      // body carries inline placement state to release on close.
      const body = panelEl.querySelector(':scope > .panel-flyout-body');
      if (body) {
        body.style.removeProperty('position');
        body.style.removeProperty('left');
        body.style.removeProperty('top');
        body.style.removeProperty('right');
        body.style.removeProperty('max-height');
        body.style.removeProperty('visibility');
        body.style.removeProperty('display');
      }
    }
    if (syncShare) this.shareLinkManager?.onPanelStateChange?.();
  }

  _isRailFlyoutPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel || panel.classList.contains('panel-floating')) return false;
    // The exclusive "one open panel per side" behaviour belongs to flyout
    // mode only. Legacy rail compositions keep their own accordion policy, so
    // the mode must be part of the test rather than implied by rail ownership.
    const stack = this._leftPanelStack?.contains(panel)
      ? this._leftPanelStack
      : this._rightPanelStack?.contains(panel)
        ? this._rightPanelStack
        : null;
    return stack?.dataset?.railMode === 'flyout';
  }

  _railSideForPanel(panel) {
    if (!panel) return null;
    if (this._leftPanelStack?.contains(panel)) return 'left';
    if (this._rightPanelStack?.contains(panel)) return 'right';
    return null;
  }

  _openRailPanels(side) {
    const stack = side === 'left' ? this._leftPanelStack : this._rightPanelStack;
    if (!stack) return [];
    return [...stack.querySelectorAll(':scope > [data-panel-id]')].filter(
      (panel) => !panel.hidden && !panel.classList.contains('collapsed'),
    );
  }

  _closeOtherRailPanels(panelId, { persist = true, syncShare = true } = {}) {
    const panel = document.getElementById(panelId);
    const side = this._railSideForPanel(panel);
    if (!side) return;
    for (const other of this._openRailPanels(side)) {
      if (other.id === panelId) continue;
      this.setPanelCollapsed(other.id, true, {
        persist,
        syncShare,
      });
    }
  }

  _closeOpenRailFlyouts({
    exceptPanelId = null,
    side = null,
    persist = true,
    syncShare = true,
  } = {}) {
    const sides = side ? [side] : ['left', 'right'];
    for (const s of sides) {
      for (const panel of this._openRailPanels(s)) {
        if (panel.id === exceptPanelId) continue;
        this.setPanelCollapsed(panel.id, true, { persist, syncShare });
      }
    }
  }

  _closeDockPopovers({ persist = true, syncShare = false } = {}) {
    for (const panelId of ['location-bar', 'control-panel']) {
      const panel = document.getElementById(panelId);
      if (!panel || panel.classList.contains('collapsed')) continue;
      if (panel.classList.contains('dock-pinned')) continue;
      this.setPanelCollapsed(panelId, true, { persist, syncShare });
    }
  }

  _dockPopoverOpen(panelId) {
    const panel = document.getElementById(panelId);
    return !!panel && !panel.classList.contains('collapsed');
  }

  _positionRailFlyout(panelEl) {
    if (!panelEl || panelEl.classList.contains('collapsed')) return;
    if (panelEl.classList.contains('panel-floating')) return;
    const side = this._railSideForPanel(panelEl);
    if (!side) return;
    const tab =
      panelEl.querySelector(':scope > .panel-tab') ||
      panelEl.querySelector('.panel-tab') ||
      panelEl.querySelector(':scope > .panel-header') ||
      panelEl.querySelector('.panel-header');
    const body = panelEl.querySelector(':scope > .panel-flyout-body');
    if (!tab || !body) return;

    const tabRect = tab.getBoundingClientRect();
    const railRect = (side === 'left' ? this._leftPanelStack : this._rightPanelStack)?.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;
    const gap = 8;

    // Ensure measurable
    body.style.position = 'fixed';
    body.style.visibility = 'hidden';
    body.style.display = 'flex';
    body.style.maxHeight = '';
    body.style.top = '0px';
    body.style.left = '0px';
    body.style.right = 'auto';

    const bodyRect = body.getBoundingClientRect();
    const width = Math.min(bodyRect.width || 360, Math.max(220, viewportW - margin * 2));
    let left;
    if (side === 'left') {
      const anchorRight = (railRect?.right ?? tabRect.right);
      left = anchorRight + gap;
      if (left + width > viewportW - margin) {
        left = Math.max(margin, viewportW - margin - width);
      }
    } else {
      const anchorLeft = (railRect?.left ?? tabRect.left);
      left = anchorLeft - gap - width;
      if (left < margin) left = margin;
      if (left + width > viewportW - margin) {
        left = Math.max(margin, viewportW - margin - width);
      }
    }

    // The command dock now lives at the bottom edge. When a flyout sits above
    // its horizontal span, stop the body at the dock instead of letting the
    // two surfaces cover each other; other flyouts keep the full viewport.
    const dockRect = document.getElementById('command-dock')?.getBoundingClientRect();
    const dockCrossesBody =
      dockRect &&
      dockRect.width > 0 &&
      left < dockRect.right &&
      left + width > dockRect.left;

    // Both rails share one vertical model, mirrored around the viewport
    // centre: the panel is centred on 50vh regardless of the clicked tab,
    // with a safety inset at both edges. A dock crossing shortens the panel
    // instead of shifting it, so centring and clearance both hold.
    const safeInset = Math.max(margin, 24);
    const centre = viewportH / 2;
    const floor = dockCrossesBody
      ? Math.min(viewportH - safeInset, dockRect.top - gap)
      : viewportH - safeInset;
    const half = Math.min(centre - safeInset, floor - centre);
    const band = Math.max(120, 2 * half);
    // Left flyouts stay proportionate to their short lists: they use at most
    // 70vh / 560px while right panels keep the full band. The cap feeds the
    // same centring calculation, so the panel stays on 50vh.
    const available =
      side === 'left' ? Math.min(band, 560, Math.round(viewportH * 0.7)) : band;
    const natural = bodyRect.height || available;
    const top = centre - Math.min(natural, available) / 2;
    body.style.left = `${Math.round(left)}px`;
    body.style.top = `${Math.round(top)}px`;
    body.style.right = 'auto';
    body.style.maxHeight = `${Math.round(available)}px`;
    body.style.visibility = '';
    body.style.display = '';
  }

  _scheduleRailFlyoutPosition(panelId) {
    if (this._disposed) return;
    const run = () => this._positionRailFlyout(document.getElementById(panelId));
    requestAnimationFrame(run);
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  _positionAllOpenRailFlyouts() {
    for (const side of ['left', 'right']) {
      for (const panel of this._openRailPanels(side)) {
        this._positionRailFlyout(panel);
      }
    }
  }

  _ensureRailFlyoutMode() {
    for (const stack of [this._leftPanelStack, this._rightPanelStack]) {
      if (stack) stack.dataset.railMode = 'flyout';
    }
    const right = this._rightPanelStack;
    const pp = document.getElementById('pp-toggles');
    if (right && pp && !right.contains(pp) && !pp.classList.contains('panel-floating')) {
      right.prepend(pp);
      pp.style.removeProperty('top');
      pp.style.removeProperty('left');
      pp.style.removeProperty('right');
      pp.style.removeProperty('bottom');
      pp.style.removeProperty('position');
      pp.style.removeProperty('width');
      pp.style.removeProperty('height');
      pp.style.removeProperty('z-index');
      pp.classList.remove('panel-draggable', 'panel-portable');
    }
    // Hidden rail panels must not remain "open" in flyout mode.
    for (const side of ['left', 'right']) {
      const stack = side === 'left' ? this._leftPanelStack : this._rightPanelStack;
      if (!stack) continue;
      for (const panel of stack.querySelectorAll(':scope > [data-panel-id]')) {
        if (panel.hidden && !panel.classList.contains('collapsed')) {
          panel.classList.add('collapsed');
        }
      }
    }
    this._syncRailTabA11y();
  }

  /**
   * A rail tab shows only its icon, so its name lives in attributes: the
   * hover tooltip, the accessible name, and the expanded state. The label is
   * read from the tab's own (translated) title node, which stays in the DOM
   * even while CSS hides it.
   */
  _syncRailTabA11y() {
    for (const stack of [this._leftPanelStack, this._rightPanelStack]) {
      if (!stack) continue;
      for (const panel of stack.querySelectorAll(':scope > [data-panel-id]')) {
        const tab = panel.querySelector(':scope > .panel-tab');
        if (!tab) continue;
        const labelEl = tab.querySelector('.panel-title, .pp-header-label');
        const label = labelEl?.textContent?.trim() || panel.id;
        tab.dataset.railTooltip = label;
        tab.setAttribute('aria-label', label);
        tab.setAttribute('aria-controls', panel.id);
        tab.setAttribute(
          'aria-expanded',
          String(!panel.classList.contains('collapsed')),
        );
        tab.setAttribute('role', 'button');
        tab.setAttribute('tabindex', '0');
      }
    }
  }

  _railTabForPanel(panelEl) {
    return (
      panelEl?.querySelector(':scope > .panel-tab') ??
      panelEl?.querySelector('.panel-tab') ??
      null
    );
  }

  /** Enter/Space on a focused rail tab toggles its flyout like a click. */
  _onRailTabKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar')
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest('.panel-tab');
    if (!tab) return;
    const panel = tab.closest('[data-panel-id]');
    if (!panel || !this._isRailFlyoutPanel(panel.id)) return;
    // The collapse chevron keeps its own disclosure handler.
    if (target !== tab && target.closest('button, a, input, select, textarea'))
      return;
    event.preventDefault();
    this.setPanelCollapsed(panel.id, !panel.classList.contains('collapsed'), {
      explicit: true,
    });
  }

  /**
   * Escape closes every rail flyout and returns focus to the tab that owned
   * it, so a keyboard user is never left on a hidden control.
   */
  _onRailFlyoutEscape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const open = [...this._openRailPanels('left'), ...this._openRailPanels('right')];
    if (!open.length) return;
    const active = document.activeElement;
    const owner =
      active instanceof Element ? active.closest('[data-panel-id]') : null;
    event.preventDefault();
    event.stopPropagation();
    this._closeOpenRailFlyouts({ persist: true, syncShare: true });
    const focusPanel = owner && open.includes(owner) ? owner : open[0];
    this._railTabForPanel(focusPanel)?.focus?.({ preventScroll: true });
  }

  _initRailFlyoutBehavior() {
    if (this._railFlyoutBehaviorInitialized || this._disposed) return;
    this._railFlyoutBehaviorInitialized = true;
    this._ensureRailFlyoutMode();
    this._syncRailTabA11y();
    this._unsubscribeRailLocale = onLocaleChange(() => this._syncRailTabA11y());
    const reposition = () => this._positionAllOpenRailFlyouts();
    this._lifetime.listen(window, 'resize', reposition, { passive: true });
    this._lifetime.listen(window, 'scroll', reposition, {
      passive: true,
      capture: true,
    });
    // A theme switch moves both rails (Cyber pulls them inward and lowers the
    // anchor). An open flyout carries viewport-fixed coordinates, so without
    // this it keeps its old position and can cover its own tab, making the tab
    // unclickable until another resize happens.
    if (typeof MutationObserver === 'function') {
      this._railThemeObserver = new MutationObserver(() => {
        if (this._disposed) return;
        reposition();
        this._lifetime.frame(reposition);
      });
      this._railThemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-ui-theme'],
      });
    }
    // Click on tab area toggles flyout panel (except interactive controls already handled).
    this._lifetime.listen(document, 'click', (event) => {
      if (this._disposed) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const tab = target.closest('.panel-tab, [data-panel-tab]');
      if (!tab) return;
      const panel = tab.closest('[data-panel-id]');
      if (!panel || !this._isRailFlyoutPanel(panel.id)) return;
      const control = target.closest(
        'button, a, input, select, textarea, label, [role="button"]',
      );
      // The tab itself now carries role="button"; only a nested control
      // (the hidden collapse chevron) owns its own activation.
      if (control && control !== tab) {
        // collapse button and other controls have their own handlers
        return;
      }
      const collapsed = panel.classList.contains('collapsed');
      this.setPanelCollapsed(panel.id, !collapsed, { explicit: true });
    });
    this._lifetime.listen(document, 'keydown', (event) => {
      this._onRailFlyoutEscape(event);
    }, true);
    this._lifetime.listen(document, 'keydown', (event) => {
      this._onRailTabKeydown(event);
    }, true);
    this._lifetime?.listen?.(document, 'pointerdown', (event) => {
      if (this._disposed) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const inDock = document.getElementById('command-dock')?.contains(target);
      const inFloating = target.closest('.panel-floating');
      if (inFloating) return;
      // clicks inside open flyout bodies or tabs are internal
      const openFlyoutBody = target.closest('.panel-flyout-body');
      if (openFlyoutBody) {
        const owner = openFlyoutBody.closest('[data-panel-id]');
        if (owner && !owner.classList.contains('collapsed')) return;
      }
      const tab = target.closest('.panel-tab, [data-panel-tab], .panel-header');
      if (tab) {
        const owner = tab.closest('[data-panel-id]');
        if (owner && this._isRailFlyoutPanel(owner.id)) return;
      }
      if (inDock) {
        // Dock has its own hover/pin/popover interactions; outside-click on dock internals should not close dock.
        return;
      }
      // Clicked outside rail/dock interactive areas: close open flyouts/popovers.
      this._closeOpenRailFlyouts({ persist: true, syncShare: true });
      this._closeDockPopovers({ persist: true, syncShare: false });
    }, true);
  }

  _layoutRightPanels() {
    this._scheduleRightPanelLayout();
  }
  enterCockpit() {
    // A new Cockpit session owns both side rails. Clear standard map-view
    // panels once on entry; NEXT/PREVIOUS never reaches this callback, so
    // panels the operator opens while already inside remain untouched.
    this._cockpitPanelRestore = new Map();
    this._cockpitContextCollapsedForDataPanel = false;
    for (const panelId of COCKPIT_ENTRY_COLLAPSE_PANEL_IDS) {
      const panel = document.getElementById(panelId);
      if (panel) {
        this._cockpitPanelRestore.set(
          panelId,
          panel.classList.contains('collapsed'),
        );
      }
      this.setPanelCollapsed(panelId, true, {
        persist: false,
        syncShare: false,
      });
    }
    this.cockpitView?.setContextCollapsed(false);
    this.cockpitView?.setSignalCollapsed(false, { user: true });
  }
  exitCockpit() {
    const restore = this._cockpitPanelRestore;
    this._cockpitPanelRestore = null;
    this._cockpitContextCollapsedForDataPanel = false;
    if (!restore) return;
    for (const [panelId, wasCollapsed] of restore) {
      this.setPanelCollapsed(panelId, wasCollapsed, {
        persist: false,
        syncShare: false,
      });
    }
  }
  destroy() {
    if (this._disposed) return;
    this._disposed = true;
    this._lifetime.destroy();
    this._panelPosition.destroy();
    this._panelLayout.destroy();
    for (const control of this._panelDisclosureControls || [])
      control.destroy();
    this._panelDisclosureControls = [];
    this._hoverPanelControls?.forEach((control) => control.destroy());
    this._hoverPanelControls?.clear();
    this._unsubscribeRailLocale?.();
    this._railThemeObserver?.disconnect();
    this._cancelMapSourceFocus?.();
  }
}

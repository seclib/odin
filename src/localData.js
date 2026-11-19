/**
 * Local 3D buildings — user-managed storage (browser half).
 *
 * Renders the "Local data" section of the POWER UP dialog: where the GMLFP
 * source footprints, their IGN-enriched counterparts and the generated 3D
 * Tiles live, whether they are present, how big they are, and what can be
 * done about it. Storage stays entirely on this machine — nothing is uploaded
 * anywhere — and the 3D buildings layer never activates on its own; the map
 * layer is a separate toggle in the Data Layers panel.
 *
 * Folder selection honesty: browsers cannot pick arbitrary host directories,
 * and a FileSystemDirectoryHandle cannot drive the Node server. The path is
 * therefore typed into a text field and validated server-side — the same
 * pattern CODEX_HOME and the key-setup env vars use. This panel never fakes
 * a native folder picker.
 *
 * When the local server does not answer (static hosting, LAN visitor, prod
 * build without the middleware), the section removes itself silently — there
 * is nothing a browser can do about the store from that context.
 */

import { t, tn, msg } from './i18n/index.js';

/* ── server response → view model ─────────────────────────────────────── */

export const LOCAL_DATA_STATES = Object.freeze([
  'ready',
  'partial',
  'absent',
  'empty',
  'error',
  'disabled',
  'configured',
]);

/** Bytes → compact human string (KB/MB/GB), test-friendly. */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function localDataStateMeta(state) {
  switch (state) {
    case 'ready':
      return { key: 'ld-available', label: msg('AVAILABLE'), tone: 'ok' };
    case 'partial':
      return { key: 'ld-incomplete', label: msg('INCOMPLETE'), tone: 'warn' };
    case 'absent':
      return { key: 'ld-missing', label: msg('MISSING'), tone: 'warn' };
    case 'empty':
      return { key: 'ld-missing', label: msg('MISSING'), tone: 'warn' };
    case 'error':
      return { key: 'ld-error', label: msg('ERROR'), tone: 'bad' };
    case 'disabled':
      return { key: 'ld-disabled', label: msg('DISABLED'), tone: 'off' };
    case 'configured':
      return { key: 'ld-configured', label: msg('CONFIGURED'), tone: 'ok' };
    default:
      return { key: 'ld-unknown', label: msg('UNKNOWN'), tone: 'off' };
  }
}

/**
 * Pure view of the three data families. Keeping this out of the DOM renderer
 * means the storage contract (what is counted, what is provenance) can be
 * tested without a browser, while the browser only formats the lines.
 * @param {Record<string, unknown> | null} status
 * @returns {string[]}
 */
export function localDataBreakdown(status) {
  if (!status || status.enabled !== true) return [];
  const counts = status.counts ?? null;
  if (!counts) return [];
  const lines = [
    `${msg('Sources (original)')}: ${counts.sourceFiles ?? 0}`,
    `${msg('Enriched (IGN)')}: ${counts.enrichedLines ?? 0} ${msg('records')}`,
    `${msg('Generated (3D Tiles)')}: ${counts.tiles ?? 0} ${msg('tiles')} · ${counts.buildings ?? 0} ${msg('buildings')}`,
    `${msg('Total volume')}: ${formatBytes(counts.bytes ?? 0)}`,
  ];
  const meta = status.manifest ?? {};
  if (meta.scope || meta.license || meta.tilesGeneratedAt) {
    lines.push(
      `${msg('Provenance')}: ${[meta.scope, meta.license, meta.tilesGeneratedAt]
        .filter(Boolean)
        .join(' · ')}`,
    );
  }
  if (meta.schemaVersion)
    lines.push(`${msg('Manifest schema')}: v${meta.schemaVersion}`);
  if (status.checksumsPresent === true)
    lines.push(
      t(msg('Integrity: {count} SHA-256 hashes'), {
        count: status.checksumsCount ?? 0,
      }),
    );
  return lines;
}

/* ── rendering ─────────────────────────────────────────────────────────── */

const CONFIRM_PHRASES = Object.freeze({
  tiles: 'DELETE TILES',
  enriched: 'DELETE ENRICHED',
  source: 'DELETE SOURCE',
});

function chip(text, tone) {
  const span = document.createElement('span');
  span.className = `ld-chip ld-chip-${tone ?? 'off'}`;
  span.textContent = text;
  return span;
}

function button({ label, primary, danger, attrs }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = [
    'ld-btn',
    primary ? 'ld-btn-primary' : '',
    danger ? 'ld-btn-danger' : '',
  ]
    .filter(Boolean)
    .join(' ');
  el.textContent = label;
  if (attrs) Object.assign(el, attrs);
  return el;
}

/** Build the DOM once; `render()` then patches text/attrs. */
function buildSection() {
  const section = document.createElement('section');
  section.className = 'key-setup-locald';
  section.dataset.localDataSection = 'true';
  section.innerHTML = `
    <div class="ld-head">
      <span class="ld-kicker" data-i18n>${msg('GROUND STATION · LOCAL DATA')}</span>
      <span class="ld-chip ld-chip-off" data-role="state">${msg('DISABLED')}</span>
      <span class="ld-chip ld-chip-ok" data-role="configured" hidden>${msg('CONFIGURED')}</span>
    </div>
    <h3 class="ld-title">${msg('Local 3D buildings — La Réunion')}</h3>
    <p class="ld-desc">${msg('Microsoft GMLFP footprints, IGN-enriched altitudes and the generated 3D Tiles are cached on this machine. Nothing is uploaded anywhere. The map layer stays off until you enable it from the Data Layers panel.')}</p>
    <div class="ld-row ld-row-path">
      <label class="ld-label" for="ld-path">${msg('Storage path')}</label>
      <div class="ld-pathline">
        <input id="ld-path" class="ld-input" type="text" spellcheck="false" autocomplete="off" aria-label="${msg('Storage path')}" />
        <button type="button" class="ld-btn" data-action="apply">${msg('APPLY')}</button>
      </div>
    </div>
    <div class="ld-row ld-row-toggle">
      <label class="ld-toggle">
        <input type="checkbox" data-role="enabled" />
        <span class="ld-toggle-track" aria-hidden="true"></span>
        <span class="ld-toggle-label">${msg('Keep buildings data on this machine')}</span>
      </label>
      <span class="ld-hint">${msg('Disabling keeps the map working without the layer.')}</span>
    </div>
    <div class="ld-stats" data-role="stats" role="status" aria-live="polite"></div>
    <div class="ld-breakdown" data-role="breakdown"></div>
    <div class="ld-actions">
      <button type="button" class="ld-btn" data-action="rescan">${msg('RESCAN')}</button>
      <button type="button" class="ld-btn" data-action="verify">${msg('VERIFY CHECKSUMS')}</button>
      <button type="button" class="ld-btn" data-action="deploy">${msg('COPY TO DIST')}</button>
      <button type="button" class="ld-btn" data-action="delete-tiles">${msg('DELETE GENERATED TILES')}</button>
      <button type="button" class="ld-btn" data-action="delete-enriched">${msg('DELETE ENRICHED DATA')}</button>
      <button type="button" class="ld-btn ld-btn-danger" data-action="delete-source">${msg('DELETE ORIGINAL SOURCES')}</button>
    </div>
    <p class="ld-note" data-role="note" role="status" aria-live="polite"></p>
    <p class="ld-footnote"><span data-role="height-note"></span>${' '}${msg('Footprints © Microsoft (CDLA-Permissive-2.0). Bases from IGN RGE ALTI®.')}</p>
  `;
  return section;
}

/** Extract the status payload from a fetch response, or null on any failure. */
export async function readLocalDataStatus(fetchImpl) {
  try {
    const res = await fetchImpl('/api/local-data/status', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || typeof body !== 'object') return null;
    return body;
  } catch {
    return null;
  }
}

/* ── mount & wire ─────────────────────────────────────────────────────── */

const noopHandle = () => ({
  open: () => {},
  render: () => {},
  destroy: () => {},
});

/* ── mounting ───────────────────────────────────────────────────────────
 * The POWER UP dialog only survives when the dev server answers
 * /api/setup/status; in a preview or static production build the key-setup
 * chrome removes itself by design. Blindly inserting our section into
 * #key-setup would therefore vanish without a trace there. The order is
 * pinned instead:
 *
 *   1. probe /api/local-data/status — the store cannot exist server-side
 *      without this answer, so a failure means: stay out of the way;
 *   2. probe /api/setup/status — ok means "the settings system is alive,
 *      integrate the section inside it" (dev server);
 *   3. otherwise mount a self-contained chip + dialog (production preview).
 *
 * Both probes are loopback-local and one-shot per page load; the panel
 * re-probes itself on every refresh from the RENDER path.
 */
function mountSectionInto(keySetup, doc) {
  const section = buildSection();
  const rows = keySetup.querySelector('[data-key-setup-rows]');
  if (rows?.parentNode) rows.parentNode.insertBefore(section, rows.nextSibling);
  else keySetup.append(section);
  return section;
}

function mountStandalone(doc) {
  const corner = doc.getElementById('corner-actions') ?? doc.body;
  const chip = doc.createElement('button');
  chip.id = 'local-data-chip';
  chip.type = 'button';
  chip.className = 'key-setup-chip';
  chip.setAttribute('aria-haspopup', 'dialog');
  chip.setAttribute('aria-controls', 'local-data');
  chip.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">database</span><span>${msg('LOCAL DATA')}</span>`;
  const dialog = doc.createElement('aside');
  dialog.id = 'local-data';
  dialog.className = 'ld-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'false');
  dialog.setAttribute('aria-label', msg('Local 3D buildings storage'));
  dialog.hidden = true;
  dialog.innerHTML = `
    <header class="key-setup-header">
      <span class="key-setup-kicker">${msg('GROUND STATION · LOCAL DATA')}</span>
      <button type="button" class="key-setup-close" aria-label="${msg('Close')}" data-ld-close>
        <span class="material-symbols-outlined" aria-hidden="true">close</span>
      </button>
    </header>`;
  const section = buildSection();
  dialog.append(section);
  corner.append(chip);
  corner.append(dialog);
  return { dialog, section, chip, standalone: true };
}

export function initLocalData({ documentRef = document, signal } = {}) {
  const doc = documentRef;
  const fetchImpl = globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) return noopHandle();
  if (
    doc.getElementById('local-data-chip') ||
    doc.querySelector('[data-local-data-section]')
  )
    return noopHandle(); // idempotent

  let destroyed = false;
  let mounted = null;
  const destroyMounted = () => {
    if (!mounted) return;
    const { dialog, section, chip, standalone } = mounted;
    section.remove();
    if (standalone) {
      chip?.remove();
      dialog?.remove();
    }
    mounted = null;
  };

  const wireAndRender = (mode) => {
    // Local data management lives in Settings; never duplicate it inside the
    // Providers (key-setup) dialog. When the server is available, Settings
    // already provides it, so do not mount a second copy.
    if (mode === 'settings') return null;
    const mount = mountStandalone(doc);
    if (destroyed) {
      mount.section.remove();
      if (mount.standalone) {
        mount.chip.remove();
        mount.dialog.remove();
      }
      return null;
    }
    mounted = mount;
    wire(mounted);
    mounted.refresh().catch(() => {});
    return mount;
  };

  const wire = ({ dialog, section, chip, standalone }) => {
    const $ = (sel) => section.querySelector(sel);
    const stateEl = $('[data-role="state"]');
    const configuredEl = $('[data-role="configured"]');
    const breakdownEl = $('[data-role="breakdown"]');
    const statsEl = $('[data-role="stats"]');
    const noteEl = $('[data-role="note"]');
    const pathInput = $('#ld-path');
    const enabledToggle = $('[data-role="enabled"]');
    const applyBtn = $('[data-action="apply"]');
    const rescanBtn = $('[data-action="rescan"]');
    const verifyBtn = $('[data-action="verify"]');
    const deployBtn = $('[data-action="deploy"]');
    const delTilesBtn = $('[data-action="delete-tiles"]');
    const delEnrichedBtn = $('[data-action="delete-enriched"]');
    const delSourceBtn = $('[data-action="delete-source"]');

    let busy = false;
    const setBusy = (value) => {
      busy = value;
      for (const el of [
        applyBtn,
        rescanBtn,
        verifyBtn,
        deployBtn,
        delTilesBtn,
        delEnrichedBtn,
        delSourceBtn,
      ])
        el.setAttribute('aria-disabled', String(value));
    };

    const post = async (pathname, payload) => {
      const res = await fetchImpl(pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload ?? {}),
      });
      return res.json().catch(() => ({}));
    };

    const render = (status) => {
      if (destroyed || !section.isConnected) return;
      if (!status) {
        stateEl.textContent = msg('UNAVAILABLE');
        stateEl.className = 'ld-chip ld-chip-off';
        configuredEl.hidden = true;
        breakdownEl.textContent = '';
        statsEl.textContent = msg(
          'The local server did not answer. The buildings layer stays off until the server can serve the tileset.',
        );
        pathInput.value = '';
        enabledToggle.checked = false;
        for (const el of section.querySelectorAll('button'))
          el.setAttribute('aria-disabled', 'true');
        return;
      }
      for (const el of section.querySelectorAll('button'))
        el.removeAttribute('aria-disabled');
      // "Configured" is an independent fact from "data available": a path can
      // be saved and writable while the store is still missing or partial.
      configuredEl.hidden = status.configured !== true;
      breakdownEl.textContent = localDataBreakdown({
        enabled: status.enabled,
        ...(status.summary ?? {}),
      }).join('\n');
      const meta = localDataStateMeta(
        status.summary?.state ?? (status.enabled ? 'absent' : 'disabled'),
      );
      stateEl.textContent = meta.label;
      stateEl.className = `ld-chip ld-chip-${meta.tone}`;

      const counts = status.summary?.counts ?? null;
      if (!status.enabled) {
        statsEl.textContent = msg(
          'Storage disabled. Toggle it on to keep the buildings data on this machine.',
        );
      } else if (
        !counts ||
        (counts.tiles === 0 &&
          counts.sourceFiles === 0 &&
          counts.enrichedLines === 0)
      ) {
        statsEl.textContent = msg(
          'No data yet. Run the offline toolchain (tools/buildings/) to build the local store.',
        );
      } else {
        const parts = [];
        if (counts.buildings)
          parts.push(
            tn(
              counts.buildings,
              msg('{count} building'),
              msg('{count} buildings'),
              { count: counts.buildings },
            ),
          );
        if (counts.tiles)
          parts.push(t(msg('{count} tiles'), { count: counts.tiles }));
        if (counts.sourceFiles)
          parts.push(
            t(msg('{count} source files'), { count: counts.sourceFiles }),
          );
        if (counts.bytes) parts.push(formatBytes(counts.bytes));
        statsEl.textContent = parts.join(' · ');
      }
      pathInput.value = status.path ?? status.defaultPath ?? '';
      enabledToggle.checked = status.enabled === true;

      if (status.error?.error) {
        noteEl.textContent = String(status.error.error);
      } else if (status.summary?.state === 'ready') {
        noteEl.textContent = msg(
          'Ready. Enable the layer from Data Layers to use it on the map.',
        );
      } else if (status.summary?.state === 'partial') {
        noteEl.textContent = msg(
          'Partial data — re-run the offline toolchain to complete it, or delete the generated tiles and rebuild.',
        );
      } else if (status.summary?.state === 'error') {
        noteEl.textContent = status.summary?.reason
          ? String(status.summary.reason)
          : msg('Storage error — the directory could not be read.');
      }

      const heightNote = $('[data-role="height-note"]');
      const h = status.summary?.manifest?.defaultHeightM ?? 6.0;
      heightNote.textContent = t(
        msg('Heights are a constant default of {height} m — not measured.'),
        { height: h },
      );
    };

    const refresh = async () => {
      setBusy(true);
      try {
        const status = await readLocalDataStatus(fetchImpl);
        render(status);
      } catch {
        render(null);
      } finally {
        setBusy(false);
      }
    };

    // expose for the handle
    mounted && (mounted.refresh = refresh);

    const apply = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const body = {
          enabled: enabledToggle.checked,
          path: pathInput.value.trim() || undefined,
        };
        const result = await post('/api/local-data/configure', body);
        if (result && result.ok) render(result);
        else
          noteEl.textContent = result?.error
            ? String(result.error)
            : msg('Could not save the storage settings.');
      } finally {
        setBusy(false);
      }
    };

    const toggleEnabled = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const body = {
          enabled: enabledToggle.checked,
          path: pathInput.value.trim() || undefined,
        };
        const result = await post('/api/local-data/configure', body);
        if (result && result.ok) render(result);
        else {
          noteEl.textContent = result?.error
            ? String(result.error)
            : msg('Could not update the storage settings.');
          enabledToggle.checked = !enabledToggle.checked;
        }
      } finally {
        setBusy(false);
      }
    };

    const verify = async () => {
      if (busy) return;
      setBusy(true);
      try {
        noteEl.textContent = msg('Verifying checksums…');
        const result = await post('/api/local-data/verify', {});
        if (result?.present === false) {
          noteEl.textContent = msg('No checksums recorded for this store.');
        } else if (result?.ok) {
          noteEl.textContent = t(
            msg('Checksums OK — {count} files verified.'),
            { count: result.verified ?? 0 },
          );
        } else {
          noteEl.textContent = t(msg('Checksum mismatch in {count} file(s).'), {
            count: (result?.mismatches ?? []).length,
          });
        }
      } catch {
        noteEl.textContent = msg('Checksum verification failed.');
      } finally {
        setBusy(false);
      }
    };

    const deploy = async () => {
      if (busy) return;
      if (typeof globalThis.prompt !== 'function') return;
      const typed = globalThis.prompt(
        msg(
          'Copy the generated tiles into dist/ for deployment? Type exactly "COPY TO DIST" to confirm.',
        ),
      );
      if (typed !== 'COPY TO DIST') {
        noteEl.textContent = msg(
          'Deployment cancelled — confirmation phrase did not match.',
        );
        return;
      }
      setBusy(true);
      try {
        noteEl.textContent = msg('Copying tiles to dist/…');
        const result = await post('/api/local-data/deploy', {
          confirm: 'COPY TO DIST',
        });
        if (result?.ok) {
          noteEl.textContent = t(
            msg(
              'Copied {count} files ({bytes}) to dist/odin-local-buildings/ — the master store is unchanged.',
            ),
            { count: result.files ?? 0, bytes: formatBytes(result.bytes ?? 0) },
          );
        } else {
          noteEl.textContent = result?.error
            ? String(result.error)
            : msg('Deployment failed.');
        }
      } catch {
        noteEl.textContent = msg('Deployment failed.');
      } finally {
        setBusy(false);
      }
    };

    const CONFIRM_PHRASES = Object.freeze({
      tiles: 'DELETE TILES',
      enriched: 'DELETE ENRICHED',
      source: 'DELETE SOURCE',
    });

    const del = async (scope) => {
      if (busy) return;
      const phrase = CONFIRM_PHRASES[scope];
      const confirmText =
        scope === 'source'
          ? msg(
              'This deletes the original GMLFP downloads. Type exactly "DELETE SOURCE" to confirm.',
            )
          : t(msg('Type exactly "{phrase}" to confirm.'), { phrase });
      if (typeof globalThis.prompt !== 'function') return;
      const typed = globalThis.prompt(confirmText);
      if (typed !== phrase) {
        noteEl.textContent = msg(
          'Deletion cancelled — confirmation phrase did not match.',
        );
        return;
      }
      setBusy(true);
      try {
        const result = await post('/api/local-data/delete', {
          scope,
          confirm: phrase,
        });
        if (result?.ok) {
          noteEl.textContent = t(msg('Freed {bytes}.'), {
            bytes: formatBytes(result.freedBy ?? 0),
          });
          await refresh();
        } else {
          noteEl.textContent = result?.error
            ? String(result.error)
            : msg('Deletion failed.');
        }
      } catch {
        noteEl.textContent = msg('Deletion failed.');
      } finally {
        setBusy(false);
      }
    };

    applyBtn.addEventListener('click', apply);
    rescanBtn.addEventListener('click', refresh);
    verifyBtn.addEventListener('click', verify);
    deployBtn.addEventListener('click', deploy);
    delTilesBtn.addEventListener('click', () => del('tiles'));
    delEnrichedBtn.addEventListener('click', () => del('enriched'));
    delSourceBtn.addEventListener('click', () => del('source'));
    enabledToggle.addEventListener('change', toggleEnabled);

    if (standalone && chip) {
      let isOpen = false;
      const show = () => {
        isOpen = true;
        dialog.hidden = false;
        dialog.classList.add('visible');
        dialog.querySelector('input')?.focus?.({ preventScroll: true });
      };
      const hide = () => {
        if (!isOpen) return;
        isOpen = false;
        dialog.classList.remove('visible');
        dialog.hidden = true;
      };
      chip.addEventListener('click', show);
      dialog.querySelector('[data-ld-close]')?.addEventListener('click', hide);
      const onKeydown = (event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          hide();
        }
      };
      doc.addEventListener('keydown', onKeydown, true);
      mounted && (mounted.show = show);
    }
  };

  const abort = () => {
    destroyed = true;
    destroyMounted();
  };

  const handle = {
    open: () => mounted?.show?.(),
    render: () => mounted?.refresh?.(),
    destroy: abort,
  };

  if (signal?.aborted) return handle;
  signal?.addEventListener('abort', abort, { once: true });

  // Probe in parallel; mount once the verdict is in.
  (async () => {
    try {
      const [setupRes, localRes] = await Promise.all([
        fetchImpl('/api/setup/status', { cache: 'no-store' }).catch(() => null),
        fetchImpl('/api/local-data/status', { cache: 'no-store' }).catch(
          () => null,
        ),
      ]);
      if (destroyed || signal?.aborted) return;
      if (!localRes || !localRes.ok) return; // local server cannot serve — stay invisible
      wireAndRender(setupRes && setupRes.ok ? 'settings' : 'standalone');
    } catch {
      /* never invent UI when the probes fail */
    }
  })();

  return handle;
}

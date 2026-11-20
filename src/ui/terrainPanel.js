/**
 * TERRAIN & ELEVATION panel renderer.
 *
 * Renders the multi-provider terrain catalog (src/maps/terrainCatalog.js) into
 * the `#terrain-provider-list` container of the layer-panels template, plus a
 * "Configuration des fournisseurs" section for API keys (reusing the existing
 * /api/setup/status and /api/setup/keys endpoints — keys are stored server-side
 * in .env, never in localStorage, never displayed in clear after save).
 *
 * Pure presentation: no network at import time, no globe mutation.
 * Auto-initializes on DOMContentLoaded when the container is present.
 *
 * @module ui/terrainPanel
 */

import { TERRAIN_PROVIDERS, listTerrainProviders } from '../maps/terrainCatalog.js';

const KIND_META = Object.freeze({
  terrain: { icon: 'terrain', label: 'Terrain global' },
  elevation: { icon: 'height', label: 'MNT / MNS / MNH' },
  hybrid: { icon: 'layers', label: 'LiDAR & hybride' },
});

const TYPE_LABELS = Object.freeze({
  'cesium-ion': 'Cesium ion',
  'cesium-quantized-mesh': 'Maillage quantifié',
  'ellipsoid': 'Ellipsoïde',
  'arcgis-terrain': 'ArcGIS',
  'raster-elevation': 'Élévation raster',
  'rest-elevation': 'REST élévation',
  'wms-raster': 'WMS raster',
});

const STATUS_META = Object.freeze({
  available: { icon: 'check_circle', color: '#00d4aa', label: 'Disponible' },
  'needs-key': { icon: 'vpn_key', color: '#ffaa00', label: 'Clé API requise' },
  'needs-infrastructure': { icon: 'dns', color: '#808090', label: 'Infrastructure requise' },
  experimental: { icon: 'science', color: '#ff6b6b', label: 'Expérimental' },
});

/**
 * Callback appelé quand l'utilisateur sélectionne un provider dans le panneau.
 * Doit être branché depuis l'application (standalone/application.js) vers
 * terrainEngine.createProvider(id, options).
 */
let onProviderSelect = null;

/**
 * Enregistre un callback appelé quand l'utilisateur sélectionne un provider
 * dans le panneau Terrain.
 * @param {(providerId: string, opts: {cesiumToken?: string, googleApiKey?: string, arcgisApiKey?: string}) => void} handler
 */
export function setOnProviderSelect(handler) {
  onProviderSelect = handler;
  console.log('[terrainPanel] setOnProviderSelect called');
}

/**
 * Fetch provider key status from the setup endpoint.
 * @returns {Promise<Record<string, {set: boolean, envVars: string[]}>>}
 */
async function fetchKeyStatus() {
  try {
    const res = await fetch('/api/setup/status', { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    const status = {};
    for (const k of data.keys || []) {
      status[k.id] = { set: k.set === true, envVars: k.envVars || [] };
    }
    return status;
  } catch {
    return {};
  }
}

/**
 * Save a key via the setup API.
 * @param {string} envVar
 * @param {string} value
 * @returns {Promise<boolean>}
 */
async function saveKey(envVar, value) {
  try {
    const res = await fetch('/api/setup/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [envVar]: value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a key via the setup API.
 * @param {string} envVar
 * @returns {Promise<boolean>}
 */
async function deleteKey(envVar) {
  try {
    const res = await fetch('/api/setup/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [envVar]: null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Render the provider list into a container element, grouped by kind.
 * @param {HTMLElement} container
 * @returns {void}
 */
export function renderTerrainPanel(container) {
  if (!container) return;
  container.replaceChildren();

  const providers = listTerrainProviders()
    .map((id) => TERRAIN_PROVIDERS[id])
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  // Group by kind
  const groups = new Map();
  for (const p of providers) {
    const kind = p.kind || 'terrain';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(p);
  }

  let keyStatus = {};
  let keyInputs = {};   // envVar -> current input value
  let keyStates = {};   // envVar -> 'idle' | 'saving' | 'saved' | 'error'
  let providerStates = {}; // providerId -> 'idle' | 'selecting' | 'selected' | 'error'
  let providerErrors = {}; // providerId -> error message

  fetchKeyStatus().then((s) => {
    keyStatus = s;
    render();
  });

  function render() {
    container.replaceChildren();

    const providers = listTerrainProviders()
      .map((id) => TERRAIN_PROVIDERS[id])
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

    const groups = new Map();
    for (const p of providers) {
      const kind = p.kind || 'terrain';
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(p);
    }

    for (const [kind, items] of groups) {
      const meta = KIND_META[kind] || { icon: 'help', label: kind };

      const group = document.createElement('div');
      group.className = 'terrain-group';

      const header = document.createElement('div');
      header.className = 'terrain-group-header';

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined terrain-group-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = meta.icon;

      const title = document.createElement('span');
      title.className = 'terrain-group-title';
      title.textContent = meta.label;

      const count = document.createElement('span');
      count.className = 'terrain-group-count';
      count.textContent = String(items.length);

      header.append(icon, title, count);
      group.appendChild(header);

      for (const p of items) {
        const sm = STATUS_META[p.status] || STATUS_META.experimental;
        const keyStatusEntry = keyStatus[p.id];
        const isKeySet = keyStatusEntry?.set === true;
        const isActive = providerStates[p.id] === 'selected';
        const isError = providerStates[p.id] === 'error';
        const isSelecting = providerStates[p.id] === 'selecting';
        const providerError = providerErrors[p.id] || '';
        const keyInputVal = keyInputs[p.auth?.envVar] || '';
        const keyState = keyStates[p.auth?.envVar] || 'idle';

        const card = document.createElement('div');
        card.className = 'terrain-provider-card';
        card.dataset.providerId = p.id;
        if (isActive) card.classList.add('active');
        if (isError) card.classList.add('error');

        const top = document.createElement('div');
        top.className = 'terrain-card-top';

        const pIcon = document.createElement('span');
        pIcon.className = 'material-symbols-outlined terrain-card-icon';
        pIcon.setAttribute('aria-hidden', 'true');
        pIcon.textContent = meta.icon;

        const name = document.createElement('span');
        name.className = 'terrain-card-name';
        name.textContent = p.label;

        const statusDot = document.createElement('span');
        statusDot.className = 'terrain-status-dot';
        statusDot.style.backgroundColor = sm.color;
        statusDot.title = sm.label;
        statusDot.setAttribute('aria-label', sm.label);

        const statusLabel = document.createElement('span');
        statusLabel.className = 'terrain-status-label';
        statusLabel.textContent = sm.label;
        statusLabel.style.color = sm.color;

        top.append(pIcon, name, statusDot, statusLabel);
        card.appendChild(top);

        const details = document.createElement('div');
        details.className = 'terrain-card-details';

        const typeEl = document.createElement('span');
        typeEl.className = 'terrain-detail';
        typeEl.textContent = TYPE_LABELS[p.type] || p.type;

        const coverageEl = document.createElement('span');
        coverageEl.className = 'terrain-detail';
        coverageEl.textContent = p.coverage;

        const resEl = document.createElement('span');
        resEl.className = 'terrain-detail';
        resEl.textContent = `SSE ${p.resolution?.maxScreenSpaceError ?? '—'}`;

        const productsEl = document.createElement('span');
        productsEl.className = 'terrain-detail terrain-detail--products';
        productsEl.textContent = (p.products || []).join(', ');

        details.append(typeEl, coverageEl, resEl, productsEl);
        card.appendChild(details);

        if (isError && providerError) {
          const errorEl = document.createElement('div');
          errorEl.className = 'terrain-error';
          errorEl.setAttribute('role', 'alert');
          errorEl.textContent = providerError;
          card.appendChild(errorEl);
        }

        const footer = document.createElement('div');
        footer.className = 'terrain-card-footer';

        const license = document.createElement('span');
        license.className = 'terrain-license';
        license.textContent = p.license;

        // Key input section for providers requiring auth
        if (p.auth?.required) {
          const keyGroup = document.createElement('div');
          keyGroup.className = 'terrain-key-group';

          const keyLabel = document.createElement('span');
          keyLabel.className = 'terrain-key-label';
          keyLabel.textContent = p.auth.envVar;

          const keyInput = document.createElement('input');
          keyInput.type = 'password';
          keyInput.className = 'terrain-key-input';
          keyInput.value = '';
          keyInput.placeholder = keyState === 'idle' && !isKeySet ? 'Saisir la clé API' : '••••••••';
          keyInput.autocomplete = 'off';
          keyInput.spellcheck = false;
          keyInput.addEventListener('input', (e) => {
            keyInputs[p.auth.envVar] = e.target.value;
            keyStates[p.auth.envVar] = 'idle';
          });

          const keyStatusSpan = document.createElement('span');
          keyStatusSpan.className = `terrain-key-status ${keyState === 'idle' ? (isKeySet ? 'terrain-key-status--ok' : 'terrain-key-status--missing') : 'terrain-key-status--' + keyState}`;
          keyStatusSpan.textContent = keyState === 'idle' ? (isKeySet ? 'Configuré' : 'Clé manquante') : keyState === 'saving' ? 'Enregistrement...' : keyState === 'saved' ? 'Enregistré' : keyState === 'error' ? 'Erreur' : 'Inconnu';

          const keyButtons = document.createElement('div');
          keyButtons.className = 'terrain-key-buttons';

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'terrain-key-save';
          saveBtn.textContent = 'Enregistrer';
          saveBtn.disabled = keyState === 'saving';
          saveBtn.addEventListener('click', async () => {
            const value = keyInputs[p.auth.envVar];
            if (!value) return;
            keyStates[p.auth.envVar] = 'saving';
            render();
            const ok = await saveKey(p.auth.envVar, value);
            if (ok) {
              keyStates[p.auth.envVar] = 'saved';
            } else {
              keyStates[p.auth.envVar] = 'error';
            }
            render();
          });

          const deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'terrain-key-delete';
          deleteBtn.textContent = 'Supprimer';
          deleteBtn.disabled = !isKeySet;
          deleteBtn.addEventListener('click', async () => {
            keyStates[p.auth.envVar] = 'saving';
            render();
            const ok = await deleteKey(p.auth.envVar);
            if (ok) {
              keyInputs[p.auth.envVar] = '';
              keyStates[p.auth.envVar] = 'idle';
            } else {
              keyStates[p.auth.envVar] = 'error';
            }
            render();
          });

          const testBtn = document.createElement('button');
          testBtn.type = 'button';
          testBtn.className = 'terrain-key-test';
          testBtn.textContent = 'Tester';
          testBtn.disabled = keyState === 'testing' || !keyInputs[p.auth.envVar];
          testBtn.addEventListener('click', async () => {
            const value = keyInputs[p.auth.envVar];
            if (!value) return;
            keyStates[p.auth.envVar] = 'testing';
            render();
            try {
              await scene.terrainEngine.createProvider(p.id, { [p.auth.envVar]: value });
              keyStates[p.auth.envVar] = 'saved';
              providerStates[p.id] = 'selected';
              providerErrors[p.id] = null;
            } catch (e) {
              keyStates[p.auth.envVar] = 'error';
              providerErrors[p.id] = e.message;
            }
            render();
          });

          keyButtons.append(saveBtn, deleteBtn, testBtn);
          keyGroup.append(keyLabel, keyInput, keyStatusSpan, keyButtons);
          footer.append(keyGroup);
        }

        const selectBtn = document.createElement('button');
        selectBtn.className = 'terrain-select-btn';
        selectBtn.type = 'button';
        selectBtn.textContent = isActive
          ? 'Actif'
          : isSelecting
            ? 'Chargement...'
            : 'Sélectionner';
        selectBtn.disabled =
          isSelecting || Boolean(p.auth?.required) && !isKeySet;
        selectBtn.addEventListener('click', () => {
          if (selectBtn.disabled) return;
          providerStates[p.id] = 'selecting';
          providerErrors[p.id] = null;
          selectBtn.disabled = true;
          selectBtn.textContent = 'Chargement...';
          render();
          const opts = {
            cesiumToken: keyInputs['CESIUS_ION_TOKEN'] || '',
            googleApiKey: keyInputs['GOOGLE_MAPS_API_KEY'] || '',
            arcgisApiKey: keyInputs['ARCGIS_API_KEY'] || '',
          };
          console.log('[terrainPanel] Calling onProviderSelect with id:', p.id, 'and opts:', opts);
          console.log('[terrainPanel] opts:', opts);
          onProviderSelect?.(p.id, opts).then(() => {
            console.log('[terrainPanel] onProviderSelect resolved for', p.id);
            providerStates[p.id] = 'selected';
            providerErrors[p.id] = null;
            selectBtn.textContent = 'Actif';
            selectBtn.disabled = true;
            render();
          }).catch((err) => {
            console.log('[terrainPanel] onProviderSelect rejected for', p.id, ':', err);
            providerStates[p.id] = 'error';
            providerErrors[p.id] = err.message;
            selectBtn.disabled = false;
            selectBtn.textContent = 'Sélectionner';
            render();
          });
        });

        footer.append(license, selectBtn);
        card.appendChild(footer);

        group.appendChild(card);
      }

      container.appendChild(group);
    }
  }

  render();
}

/**
 * Auto-init: render the provider list into the panel.
 */
export function initTerrainPanel() {
  const container = document.getElementById('terrain-provider-list');
  if (container) renderTerrainPanel(container);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void initTerrainPanel(); }, { once: true });
  } else {
    void initTerrainPanel();
  }
}
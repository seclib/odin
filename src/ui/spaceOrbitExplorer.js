import { sampleCataloguedOrbit } from '../layers/space/orbit.js';
import { createMpcOrbitSource } from '../layers/space/orbitSource.js';
import { t } from '../i18n/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgElement(document, tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, String(value));
  return node;
}

function fixed(value, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : t('NOT PROVIDED');
}

/** Search one MPC asteroid/comet and show its catalogued 2D orbit geometry. */
export function initSpaceOrbitExplorer({
  root = document,
  source = createMpcOrbitSource(),
} = {}) {
  const form = root.querySelector('#space-orbit-form');
  const input = root.querySelector('#space-orbit-query');
  const status = root.querySelector('#space-orbit-status');
  const details = root.querySelector('#space-orbit-details');
  const plot = root.querySelector('#space-orbit-plot');
  if (!form || !input || !status || !details || !plot) return { destroy() {} };
  const document = root.ownerDocument || root;
  let controller = null;
  let destroyed = false;

  const render = (orbit) => {
    details.replaceChildren();
    plot.replaceChildren();
    const title = element(document, 'strong', '', orbit.designation);
    details.append(title);
    const epoch = orbit.epoch;
    const epochText = Number.isFinite(epoch?.value)
      ? `${epoch.format || 'MJD'} ${epoch.value}${epoch.timeSystem ? ` (${epoch.timeSystem})` : ''}`
      : t('Orbit epoch not provided by source');
    details.append(
      element(
        document,
        'span',
        '',
        `${t('MPC orbit elements epoch')}: ${epochText}`,
      ),
      element(
        document,
        'span',
        '',
        `${t('Reference system')}: ${orbit.reference?.system || t('NOT PROVIDED')} · ${t('Frame')}: ${orbit.reference?.frame || t('NOT PROVIDED')}`,
      ),
      element(
        document,
        'span',
        '',
        `${t('Perihelion distance')}: ${fixed(orbit.elements.qAu)} AU · ${t('Eccentricity')}: ${fixed(orbit.elements.eccentricity, 6)} · ${t('Inclination')}: ${fixed(orbit.elements.inclinationDeg, 3)}°`,
      ),
      element(
        document,
        'span',
        '',
        `${t('Orbit fit')}: ${orbit.fit?.observations ?? t('NOT PROVIDED')} ${t('observations')} · ${t('Arc')}: ${orbit.fit?.arc || t('NOT PROVIDED')}`,
      ),
      element(
        document,
        'span',
        '',
        `${t('Orbit fit updated')}: ${orbit.fit?.fitUpdatedAt || t('NOT PROVIDED')}`,
      ),
      element(
        document,
        'span',
        '',
        `${t('Retrieved from MPC')}: ${Number.isFinite(orbit.provenance?.retrievedAt) ? new Date(orbit.provenance.retrievedAt).toISOString() : t('NOT PROVIDED')}`,
      ),
    );
    const uncertainty = orbit.elements.uncertainties?.qAu;
    if (Number.isFinite(uncertainty))
      details.append(
        element(
          document,
          'span',
          '',
          `${t('MPC perihelion uncertainty')}: ±${fixed(uncertainty, 7)} AU · ${t('not propagated into a position uncertainty')}`,
        ),
      );

    const points = sampleCataloguedOrbit(orbit);
    const width = 960;
    const height = 440;
    const padding = 34;
    const maxAbs = Math.max(
      1,
      ...points.flatMap((point) => [Math.abs(point.xAu), Math.abs(point.yAu)]),
    );
    const scale = (Math.min(width, height) / 2 - padding) / maxAbs;
    const centerX = width / 2;
    const centerY = height / 2;
    const path = points
      .map((point, index) => {
        const x = (centerX + point.xAu * scale).toFixed(2);
        const y = (centerY - point.yAu * scale).toFixed(2);
        return `${index === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
    const xLabel = svgElement(document, 'text', {
      x: width - padding,
      y: centerY - 8,
      'text-anchor': 'end',
      class: 'space-orbit-axis-label',
    });
    // i18n-ignore: Standard Cartesian axis and astronomical-unit symbols.
    xLabel.textContent = 'X · AU';
    const yLabel = svgElement(document, 'text', {
      x: centerX + 8,
      y: padding + 10,
      class: 'space-orbit-axis-label',
    });
    // i18n-ignore: Standard Cartesian axis and astronomical-unit symbols.
    yLabel.textContent = 'Y · AU';
    const svg = svgElement(document, 'svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': t(
        'Catalogued orbit of {name}; 2D heliocentric ecliptic projection in astronomical units',
        { name: orbit.designation },
      ),
    });
    svg.append(
      svgElement(document, 'line', {
        x1: padding,
        y1: centerY,
        x2: width - padding,
        y2: centerY,
        class: 'space-orbit-axis',
      }),
      svgElement(document, 'line', {
        x1: centerX,
        y1: padding,
        x2: centerX,
        y2: height - padding,
        class: 'space-orbit-axis',
      }),
      svgElement(document, 'path', {
        d: path,
        class: 'space-orbit-path',
      }),
      svgElement(document, 'circle', {
        cx: centerX,
        cy: centerY,
        r: 5,
        class: 'space-orbit-sun',
      }),
      xLabel,
      yLabel,
    );
    plot.append(svg);
  };

  const search = async (designation) => {
    controller?.abort();
    const requestController = new AbortController();
    controller = requestController;
    status.textContent = t('Looking up one MPC orbit…');
    details.replaceChildren();
    plot.replaceChildren();
    try {
      const orbit = await source.lookup(designation, {
        signal: requestController.signal,
      });
      if (destroyed || requestController.signal.aborted) return;
      render(orbit);
      status.textContent = t(
        'Catalogued orbit geometry only; no position at the current time is available.',
      );
    } catch (error) {
      if (destroyed || requestController.signal.aborted) return;
      status.textContent = error?.message || t('MPC orbit data unavailable.');
    }
  };
  const onSubmit = (event) => {
    event.preventDefault();
    void search(input.value);
  };
  form.addEventListener('submit', onSubmit);
  return {
    search,
    destroy() {
      destroyed = true;
      controller?.abort();
      form.removeEventListener('submit', onSubmit);
      details.replaceChildren();
      plot.replaceChildren();
    },
  };
}

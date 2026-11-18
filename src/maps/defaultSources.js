import { MAP_STACKS } from './catalog.js';
import { photorealUnavailableReason } from './availability.js';
import { keySetupRequirementEnvVars } from '../keySetupCore.mjs';
import { t } from '../i18n/index.js';
import {
  createOsmImagery,
  createEsriImagery,
  createCartoDarkImagery,
  createIonImagery,
  ESRI_ATTRIBUTION_HTML,
} from './imagery.js';
import {
  createIgnPlanImagery,
  createIgnOrthoHrImagery,
  createIgnBdOrthoImagery,
  createIgnLidarHillshadeImagery,
  IGN_ATTRIBUTION_HTML,
} from './ignImagery.js';
import {
  createOpenFreeMapImagery,
  OPENFREEMAP_EXPERIMENTAL_REASON,
} from './openFreeMapImagery.js';
import { createWorldTerrain, createKeylessTerrain } from './terrain.js';

/** Select sources and setup guidance without putting provider branches in the controller. */
export function createDefaultMapSources({
  googleTileset = null,
  cesiumToken = '',
  googleApiKey = '',
} = {}) {
  const ionToken = String(cesiumToken || '').trim();
  const hasIon = Boolean(ionToken);
  const hasGoogle = Boolean(String(googleApiKey || '').trim());
  const terrain = {
    id: hasIon ? 'world' : 'keyless',
    create: hasIon
      ? (request) => createWorldTerrain(ionToken, request)
      : createKeylessTerrain,
  };
  return {
    defaultId: googleTileset ? 'photoreal' : 'esri-imagery',
    unknownId: 'photoreal',
    recoveryId: googleTileset ? 'photoreal' : null,
    state: { hasCesiumIonToken: hasIon },
    sources: MAP_STACKS.map((descriptor) => {
      const common = {
        descriptor,
        available: !descriptor.requiresIon || hasIon,
        unavailableReason: descriptor.requiresIon
          ? t('Needs {envVars} — add it in Provider Settings', {
              envVars: keySetupRequirementEnvVars('cesium-ion'),
            })
          : null,
      };
      if (descriptor.kind === 'photoreal')
        return {
          ...common,
          available: Boolean(googleTileset),
          unavailableReason: photorealUnavailableReason(hasIon || hasGoogle),
          tileset: googleTileset,
        };
      const imagery =
        descriptor.kind === 'ion'
          ? () => createIonImagery(descriptor.style, ionToken)
          : descriptor.id === 'osm'
            ? createOsmImagery
            : descriptor.id === 'carto-dark'
              ? createCartoDarkImagery
              : descriptor.id === 'plan-ign'
                ? createIgnPlanImagery
                : descriptor.id === 'ortho-ign'
                  ? createIgnOrthoHrImagery
                  : descriptor.id === 'bd-ortho'
                    ? createIgnBdOrthoImagery
                    : descriptor.id === 'lidar-shade'
                      ? createIgnLidarHillshadeImagery
                    : descriptor.id === 'openfreemap'
                      ? createOpenFreeMapImagery
                      : createEsriImagery;
      if (descriptor.id === 'openfreemap') {
        const enabled =
          typeof import.meta !== 'undefined' &&
          Boolean(import.meta.env && import.meta.env.VITE_OPENFREEMAP === '1');
        return {
          ...common,
          available: enabled,
          unavailableReason: enabled ? null : OPENFREEMAP_EXPERIMENTAL_REASON,
          imagery,
          terrain,
        };
      }
      return {
        ...common,
        imagery,
        terrain,
        ...(descriptor.id === 'esri-imagery'
          ? {
              credit: ESRI_ATTRIBUTION_HTML,
              constructionFallback: {
                id: 'osm',
                message: 'Esri Satellite is unavailable; using OSM',
              },
              tileFailureFallback: {
                id: 'osm',
                threshold: 2,
                message: 'Esri Satellite tile requests failed; using OSM',
              },
            }
          : {}),
      };
    }),
  };
}

import * as Cesium from 'cesium';
export const MAP_STACKS = [
  {
    id: 'photoreal',
    label: 'Google 3D', // i18n-ignore: imagery product name
    shortLabel: '3D',
    kind: 'photoreal',
    requiresIon: false,
  },
  {
    id: 'bing-aerial',
    label: 'Bing Aerial', // i18n-ignore: imagery product name
    shortLabel: 'Aerial',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL,
    requiresIon: true,
  },
  {
    id: 'bing-labels',
    label: 'Bing Labels', // i18n-ignore: imagery product name
    shortLabel: 'Labels',
    kind: 'ion',
    style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
    requiresIon: true,
  },
  {
    id: 'esri-imagery',
    label: 'Esri Satellite', // i18n-ignore: imagery product name
    shortLabel: 'SAT',
    kind: 'esri-imagery',
    requiresIon: false,
  },
  {
    id: 'osm',
    label: 'OSM', // i18n-ignore: imagery product name
    shortLabel: 'OSM',
    kind: 'osm',
    requiresIon: false,
  },
  {
    id: 'carto-dark',
    label: 'CARTO Dark', // i18n-ignore: imagery product name
    shortLabel: 'DARK',
    kind: 'carto-dark',
    requiresIon: false,
  },
  {
    id: 'plan-ign',
    label: 'Plan IGN', // i18n-ignore: imagery product name (French national map)
    shortLabel: 'IGN',
    kind: 'ign-plan',
    requiresIon: false,
  },
  {
    id: 'ortho-ign',
    label: 'Ortho IGN', // i18n-ignore: imagery product name (French national imagery)
    shortLabel: 'ORTHO',
    kind: 'ign-ortho-hr',
    requiresIon: false,
  },
  {
    id: 'bd-ortho',
    label: 'BD ORTHO 50 cm', // i18n-ignore: imagery product name
    shortLabel: 'BDO',
    kind: 'ign-bd-ortho',
    requiresIon: false,
  },
  {
    id: 'openfreemap',
    label: 'OFM Exp.', // i18n-ignore: OpenFreeMap product name, marks experimental
    shortLabel: 'OFM',
    kind: 'openfreemap',
    requiresIon: false,
  },
  {
    id: 'lidar-shade',
    label: 'LiDAR HD relief', // i18n-ignore: IGN LiDAR product name
    shortLabel: 'RELIEF',
    kind: 'ign-lidar-hillshade',
    requiresIon: false,
  },
];

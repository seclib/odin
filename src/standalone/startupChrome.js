import { startApplicationChrome } from '../app/startupChrome.js';
import { initKeySetup } from '../keySetup.js';
import { initLocalData } from '../localData.js';
import { initGeneralSettings } from '../generalSettings.js';

export function startStandaloneChrome(options) {
  return startApplicationChrome({
    initializeSettings: initKeySetup,
    initializeLocalData: initLocalData,
    initializeGeneralSettings: initGeneralSettings,
    ...options,
  });
}

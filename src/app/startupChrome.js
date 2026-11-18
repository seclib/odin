import { initFirstRunExperience } from '../firstRunExperience.js';

/** Reveal welcome controls only after restoration and the loading transition. */
export function startApplicationChrome({
  loadingScreen,
  styleManager,
  dataManager,
  signal,
  initializeWelcome = initFirstRunExperience,
  initializeSettings,
  initializeLocalData,
  initializeGeneralSettings,
}) {
  let disposed = false;
  let firstRun;
  let revealTimer;
  let resolveDelay;
  const minimumDelay = new Promise((resolve) => {
    resolveDelay = resolve;
  });
  const delayTimer = setTimeout(resolveDelay, 1000);
  const revealFirstRun = () => {
    if (disposed || signal.aborted || firstRun) return;
    firstRun = initializeWelcome?.({ styleManager, dataManager });
    clearTimeout(revealTimer);
    loadingScreen.removeEventListener('transitionend', revealFirstRun);
  };
  void Promise.all([styleManager.initialRestorePromise, minimumDelay])
    .catch(() => {
      /* Restoration reports its own outcome through the controls. */
    })
    .then(() => {
      if (disposed || signal.aborted) return;
      loadingScreen.classList.add('hidden');
      loadingScreen.addEventListener('transitionend', revealFirstRun, {
        once: true,
      });
      revealTimer = setTimeout(revealFirstRun, 900);
    });
  const keySetup = Promise.resolve(
    signal.aborted ? null : initializeSettings?.({ signal }),
  );
  const localData = Promise.resolve(
    signal.aborted ? null : initializeLocalData?.({ signal }),
  );
  // Keep the bottom POWER UP chip hidden: Providers is now managed inside Settings.
  void keySetup
    .then((handle) => {
      if (disposed || signal.aborted) return;
      const chip = document.getElementById('key-setup-chip');
      if (chip) chip.style.display = 'none';
    })
    .catch(() => {});
  // General settings are opened from the top dock; local data is one rubrique
  // inside them, independent of the optional server-backed storage panel.
  const generalSettings = Promise.resolve(
    signal.aborted ? null : initializeGeneralSettings?.({ signal }),
  );
  // Own the pending initializers too; they must not reveal dialogs after abort.
  void keySetup.catch(() =>
    console.error('Provider settings initialization failed'),
  );
  void localData.catch(() =>
    console.error('Local data settings initialization failed'),
  );
  void generalSettings.catch(() =>
    console.error('General settings initialization failed'),
  );
  return async () => {
    disposed = true;
    clearTimeout(delayTimer);
    clearTimeout(revealTimer);
    resolveDelay();
    loadingScreen.removeEventListener('transitionend', revealFirstRun);
    firstRun?.destroy();
    (await keySetup.catch(() => null))?.destroy();
    (await localData.catch(() => null))?.destroy();
    (await generalSettings.catch(() => null))?.destroy();
  };
}

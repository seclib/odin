
export function createLiveSourceController({
  id = "live-source",
  fetchEntities,
  signal = null,
  pollIntervalMs = 10000,
  applyBatch,
  onError = null,
  now = () => Date.now(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  if (typeof fetchEntities !== "function") {
    throw new TypeError("fetchEntities must be a function");
  }
  if (typeof applyBatch !== "function") {
    throw new TypeError("applyBatch must be a function");
  }

  let running = false;
  let pauseRequested = false;
  let timer = null;
  let inFlight = null;
  let attempts = 0;
  let lastSuccessAt = null;
  let lastError = null;
  let destroyed = false;
  let abortController = null;

  async function loadOnce() {
    if (destroyed) return;
    const controller = new AbortController();
    abortController = controller;
    try {
      const batch = await fetchEntities({ signal: controller.signal, now: now() });
      if (controller.signal.aborted || destroyed) return;
      await applyBatch(batch, controller.signal);
      lastSuccessAt = now();
      lastError = null;
      attempts = 0;
    } catch (error) {
      if (controller.signal.aborted || destroyed) return;
      attempts += 1;
      lastError = error instanceof Error ? error : new Error(String(error));
      if (typeof onError === "function") onError(lastError);
    } finally {
      abortController = null;
      if (!pauseRequested && running && !destroyed) schedule();
    }
  }

  function schedule() {
    if (timer !== null) clearIntervalFn(timer);
    if (destroyed || !running || pauseRequested) return;
    timer = setIntervalFn(() => {
      if (!pauseRequested && running && !destroyed) void loadOnce();
    }, pollIntervalMs);
  }

  function start() {
    if (destroyed || running) return;
    running = true;
    pauseRequested = false;
    void loadOnce();
  }

  function stop() {
    if (destroyed) return;
    pauseRequested = true;
    running = false;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    if (abortController) abortController.abort();
    abortController = null;
  }

  function dispose() {
    if (destroyed) return;
    destroyed = true;
    pauseRequested = true;
    running = false;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    if (abortController) abortController.abort();
    abortController = null;
    inFlight = null;
  }

  function status() {
    return Object.freeze({
      id,
      connected: running && !pauseRequested,
      healthy: lastError === null && lastSuccessAt !== null,
      lastSuccessAt,
      lastError,
      attempts,
    });
  }

  function manualRefresh() {
    if (destroyed) return;
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    void loadOnce();
  }

  return { start, stop, manualRefresh, dispose, status };
}

/**
 * Explicitly answer the optional Google tile-token endpoint when this
 * deployment does not mint server-side tokens.
 *
 * The browser contract in `src/maps/googleTokens.js` is: a server that offers
 * short-lived tokens answers GET /api/google/tiles-token with
 * `{ accessToken, expiresAt }`; every other answer means "no token here" and
 * the client carries on with the key/ion route. A bare 404 was indistinguishable
 * from a broken route and filled the console; a 204 with no body states the
 * same outcome without pretending a token service exists.
 *
 * Installed before `apiNotFoundPlugin()` so the explicit answer wins.
 */
export function googleTokenUnavailablePlugin() {
  const install = (server) => {
    server.middlewares.use((req, res, next) => {
      const pathname = String(req.url || '').split('?')[0];
      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        pathname !== '/api/google/tiles-token'
      ) {
        next();
        return;
      }
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
    });
  };

  return {
    name: 'google-token-unavailable',
    configureServer: install,
    configurePreviewServer: install,
  };
}

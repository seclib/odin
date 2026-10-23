import {
  HUD_SUMMARY_INSTRUCTIONS,
  keylessHudSummaryResponse,
} from '../../../src/hudSummaryResponse.js';
import { enforceRateLimit, openAiRateLimiter } from './rate-limit.js';
import { readRequestBody } from '../common/request.js';

function ethanBaseUrl() {
  const raw = process.env.GEV_ETHAN_API_URL || 'http://127.0.0.1:8000';
  return String(raw).trim().replace(/\/+$/, '');
}

function ethanCredential() {
  const key = process.env.GEV_ETHAN_API_KEY;
  if (key && String(key).trim()) return String(key).trim();
  const token = process.env.GEV_ETHAN_TOKEN;
  if (token && String(token).trim()) return String(token).trim();
  return '';
}

function ethanTimeoutMs() {
  const n = Number(process.env.GEV_ETHAN_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

function extractOpenAiResponseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (!Array.isArray(data?.output)) return '';
  return data.output
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((part) => part?.text || part?.output_text || '')
    .join(' ')
    .trim();
}

function toFiveWordHudSummary(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ');
}

async function handleHudSummary(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const credential = ethanCredential();
  const keyless = keylessHudSummaryResponse(credential);
  if (keyless) {
    res.statusCode = keyless.statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(keyless.payload));
    return;
  }

  // Per-IP throttle (GEV_RATELIMIT_OPENAI_PER_MIN). On by default; 0 disables.
  if (!enforceRateLimit(openAiRateLimiter(), req, res)) return;

  try {
    const body = await readRequestBody(req, 64 * 1024);
    const context = JSON.parse(body || '{}');
    const headers = { 'Content-Type': 'application/json' };
    if (credential.startsWith('ethan_')) {
      headers['X-API-Key'] = credential;
    } else {
      headers['Authorization'] = `Bearer ${credential}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ethanTimeoutMs());
    let response;
    let data = {};
    try {
      response = await fetch(`${ethanBaseUrl()}/v1/plugins/odin/ai/hud-summary`, {
        method: 'POST',
        headers,
        body: JSON.stringify(context),
        signal: controller.signal,
      });
      data = await response.json().catch(() => ({}));
    } finally {
      clearTimeout(timer);
    }
    const summary = toFiveWordHudSummary(
      (typeof data?.summary === 'string' && data.summary) || '',
    );
    res.statusCode = response.ok && summary ? 200 : response.status || 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (!response.ok)
      console.warn(`[hud-summary] upstream HTTP ${response.status}`);
    res.end(
      JSON.stringify({
        summary: summary || null,
        error: response.ok
          ? null
          : (typeof data?.error === 'string' && data.error) ||
            'ETHAN HUD summary request failed',
        model: data?.model || 'ethan',
      }),
    );
  } catch {
    console.warn('[hud-summary] request failed');
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(
      JSON.stringify({
        error: 'ETHAN HUD summary request failed',
      }),
    );
  }
}

export { handleHudSummary };

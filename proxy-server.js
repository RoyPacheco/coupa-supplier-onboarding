/**
 * ═══════════════════════════════════════════════════════════════
 *  Coupa API CORS Proxy  —  server.js
 *  Forwards requests from the browser form to Coupa's API,
 *  bypassing browser CORS restrictions entirely.
 *
 *  Usage:
 *    1.  npm install          (installs express + http-proxy-middleware)
 *    2.  node server.js
 *    3.  Open supplier-onboarding.html in your browser
 *        (the form already points to http://localhost:3000/api/...)
 * ═══════════════════════════════════════════════════════════════
 */

const express               = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path                  = require('path');

const app  = express();
const PORT = 3000;

// ── Target Coupa instance (fallback if header is not sent) ───────
const COUPA_BASE_URL = 'https://alo-bellacanvas.coupahost.com';

// ── 1. CORS headers — allow the browser to talk to this proxy ───
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-COUPA-API-KEY, Accept, X-Coupa-Target-URL');

  // Pre-flight OPTIONS request — respond immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ── 2. Serve the form HTML as a static file ──────────────────────
//    Place supplier-onboarding.html in the same folder as server.js
app.use(express.static(path.join(__dirname)));

// ── 3. Proxy all /api/* requests → Coupa ────────────────────────
app.use(
  '/api',
  createProxyMiddleware({
    target:             COUPA_BASE_URL,
    changeOrigin:       true,   // rewrites the Host header to match Coupa
    secure:             true,   // enforce HTTPS to Coupa
    selfHandleResponse: true,   // we pipe the response manually so we can intercept redirects
    pathRewrite:        { '^/': '/api/' }, // Express strips /api prefix; put it back

    // Use the Coupa instance URL sent by the browser (set via the Settings modal)
    // Falls back to the hardcoded COUPA_BASE_URL if the header is absent.
    // Strip any trailing slash(es) — a target ending in "/" plus the "/api/..."
    // path below would produce a literal "//api/..." on the outgoing request,
    // which some Coupa routes reject/redirect instead of normalizing.
    router: (req) => (req.headers['x-coupa-target-url'] || COUPA_BASE_URL).replace(/\/+$/, ''),

    // Log every proxied request so you can debug easily
    on: {
      proxyReq: (proxyReq, req) => {
        const target = (req.headers['x-coupa-target-url'] || COUPA_BASE_URL).replace(/\/+$/, '');
        console.log(`[PROXY] ${req.method} ${req.url}  →  ${target}${proxyReq.path}`);
        console.log(`[PROXY] Authorization header received: ${req.headers['authorization'] ? req.headers['authorization'].substring(0, 30) + '...' : 'MISSING'}`);
        console.log(`[PROXY] Authorization header forwarded: ${proxyReq.getHeader('authorization') ? proxyReq.getHeader('authorization').substring(0, 30) + '...' : 'MISSING'}`);
      },
      proxyRes: (proxyRes, req, res) => {
        // Always add CORS headers on whatever we send back to the browser
        res.setHeader('Access-Control-Allow-Origin',  '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-COUPA-API-KEY, Accept, X-Coupa-Target-URL');

        // Coupa redirected (invalid / expired token → /sessions/new).
        // Convert to a 401 so the browser gets a clear JSON error instead of
        // chasing a cross-origin redirect.
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400) {
          const location = proxyRes.headers['location'] || '(unknown)';
          console.log(`[PROXY] Redirect ${proxyRes.statusCode} → ${location} — returning 401`);
          res.status(401).json({ error: 'Unauthorized', detail: 'Invalid or expired bearer token — Coupa redirected to login.' });
          return;
        }

        console.log(`[PROXY] Response: ${proxyRes.statusCode}  ←  ${req.url}`);

        // Forward upstream headers (skip Coupa's CORS headers; we already set our own)
        const skipHeaders = new Set(['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (!skipHeaders.has(key.toLowerCase())) res.setHeader(key, value);
        });

        res.writeHead(proxyRes.statusCode);
        proxyRes.pipe(res);
      },
      error: (err, req, res) => {
        console.error('[PROXY ERROR]', err.message);
        res.status(502).json({ error: 'Proxy error', detail: err.message });
      },
    },
  })
);

// ── 4. Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log(`  │  Coupa CORS Proxy running                     │`);
  console.log(`  │  Local:   http://localhost:${PORT}            │`);
  console.log(`  │  Target:  ${COUPA_BASE_URL}                   │`);            
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Open: http://localhost:${PORT}/supplier-onboarding.html`);
  console.log('');
});

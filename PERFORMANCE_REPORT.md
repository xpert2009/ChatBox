# Dream Chat Performance Report

**Tested:** 2026-11-25 (IST)<br>
**Frontend:** https://chatbox-frontend-xpert2009.vercel.app<br>
**Backend:** https://chatbox-pgpf.onrender.com<br>
**Commit:** `9b43826` — pushed to `main`

## Changes

- The frontend sends an unauthenticated `GET /api/health` immediately before React renders, then repeats every 10 minutes while the page remains open. Overlapping pings are skipped, and failures are logged.
- The Google sign-in page shows a delayed “Connecting…” status if the Firebase-to-backend session exchange takes over three seconds.
- Vite splits React, Firebase, and Socket.IO into cacheable chunks. Emoji picker code remains lazy-loaded.
- Aurora movement now uses compositor-friendly transforms, and its animation pauses while the tab is hidden. Status-ring animation uses a transformed gradient layer.
- Backend, Google/Firebase, and font origins are preconnected or DNS-prefetched. Google Fonts load with `display=swap`; non-critical avatar images use native lazy loading.

## Bundle sizes

Baseline and final figures are from Vite production-build output. Sizes are kB; gzip sizes are shown separately.

| Asset | Before | After |
|---|---:|---:|
| Main app JavaScript | 525.76 kB (166.29 gzip) | 167.35 kB (56.69 gzip) |
| React vendor chunk | — | 218.74 kB (68.27 gzip) |
| Firebase vendor chunk | — | 98.50 kB (29.86 gzip) |
| Socket.IO vendor chunk | — | 41.18 kB (12.86 gzip) |
| Rolldown runtime | — | 0.72 kB (0.42 gzip) |
| Lazy emoji picker | 332.98 kB (82.51 gzip) | 333.03 kB (82.53 gzip) |

The final build completed without a large-chunk warning. Five JavaScript assets were observed in the initial live page load; the emoji picker remains a separate lazy chunk.

## Verification

- `npm run build` in `client/`: **PASS**, 1.86 seconds; no chunk-size warning.
- Focused Oxlint: **PASS with two existing `react(set-state-in-effect)` warnings** in `App.jsx` (lines 393 and 426).
- Local browser startup: observed the `/api/health` request on initial load and verified the URL/status with a CORS-compatible test response. Direct browser requests from localhost are not in the backend’s production CORS allowlist.
- Live browser startup: actual `GET https://chatbox-pgpf.onrender.com/api/health` returned **200**.
- Live Vercel navigation: **1,898 ms** to `loadEventEnd` (1,892 ms to DOMContentLoaded; one browser run).
- Live initial network: five JavaScript assets loaded; no JavaScript or health-request failures.
- Animation state: visible tabs run the aurora; hidden tabs pause it. Reduced-motion styling remains enabled.
- Backend endpoint check: `/api/health` returned **200**.

## Before / after notes

- **Before:** the user reported 30–50 second Render cold starts. The baseline main JavaScript chunk exceeded Vite’s 500 kB warning threshold.
- **After:** the app wakes the backend on load and pings every 10 minutes while open; the main JavaScript chunk is 167.35 kB and vendor code is split into separate files.
- The Render free tier can still sleep when nobody has the app open. A browser keep-alive cannot prevent that idle-period sleep, and actual startup time may vary with network conditions.

No server files or environment files were changed or staged.

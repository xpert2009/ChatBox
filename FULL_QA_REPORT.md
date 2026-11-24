# Full QA Report

- **Date/time:** 2026-11-24 19:46:34 +05:30
- **App:** https://chatbox-frontend-xpert2009.vercel.app
- **API:** https://chatbox-pgpf.onrender.com
- **Browser:** Playwright 1.65.1, Chromium, headful (`headless: false`)
- **Final verdict:** **NEEDS ATTENTION**

## Live browser checks

| Check | Result | Reason |
|---|---|---|
| Browser opens live frontend | PASS ✅ | HTTP 200; page title was recorded before the Dream Chat rebrand |
| Login UI renders | PASS ✅ | Login heading and enabled Google button are visible |
| Page is not blank | PASS ✅ | Main login UI is visible |
| Google sign-in popup opens | PASS ✅ | Popup reached `accounts.google.com`, title “Sign in - Google Accounts,” with email sign-in form |
| CSP blocks on landing/login | PASS ✅ | No CSP violations observed |
| JavaScript page errors | PASS ✅ | None observed |
| Google OAuth completion | BLOCKED | No test Gmail account was available; no credentials were entered |
| Browser console | NOTE | One non-fatal cross-origin `window.closed` warning appeared from the Google popup; no app or CSP error was observed |
| Legacy auth token storage | PASS ✅ | `chatbox-token` absent from localStorage and sessionStorage |

## API health and unauthenticated access

| Request | Expected | Result | Notes |
|---|---:|---|---|
| `GET /api/health` | 200 | PASS ✅ 200 | Render service responded `ok` |
| `GET /api/auth/me` | 401 | PASS ✅ 401 | No token supplied |
| `GET /api/messages/test-room` | 401 | PASS ✅ 401 | No token supplied |
| `GET /api/notifications` | 401 | PASS ✅ 401 | No token supplied |
| `GET /api/status` | 401 | PASS ✅ 401 | No token supplied |
| `POST /api/auth/login` | 400/401 | FAIL ❌ 404 | This route is not implemented; the frontend uses Firebase and exchanges tokens at `/api/auth/google` |
| `POST /api/auth/google` with no body | 400 | PASS ✅ 400 | Rechecked live after the Render redeploy trigger |
| `DELETE /api/auth/delete-account` | 401 | PASS ✅ 401 | No token supplied; no deletion attempted |
| `POST /api/upload` | 401 | PASS ✅ 401 | No token supplied; no upload attempted |

## Feature review

Authenticated actions were not executed against production. The browser had no signed-in test user, and no fabricated JWT or production writes were used. The following reflects source/route checks; it is not an end-to-end user acceptance test.

| Feature | Result | Source/route evidence and limitation |
|---|---|---|
| Profile photo upload | PASS ✅ (code review); BLOCKED (E2E) | Profile has a photo picker and upload handler; `/api/upload` is auth-protected and uses Cloudinary. A real upload was not made. |
| Unique Dream Chat ID | PASS ✅ (code review); BLOCKED (E2E) | Username is uniquely indexed in MongoDB and displayed as `@username` in Profile. No user account was available to inspect. |
| Private chat | PASS ✅ (code review); BLOCKED (E2E) | Search, conversation view, REST message send, and Socket.IO updates are implemented. No authenticated peer or real message was used. |
| Group chat | PASS ✅ (code review); BLOCKED (E2E) | Create-group UI, member search, and authenticated create/add-member routes exist. No group was created in production. |
| File sharing | PASS ✅ (code review); BLOCKED (E2E) | Attachment controls connect to authenticated upload and message APIs. Cloudinary upload was not attempted without a test account. |
| Inline photo preview, download, and reactions | FIXED ✅; BLOCKED (E2E) | Photos now preview in-chat and in an app modal; Cloudinary download uses `fl_attachment`; reactions persist through an authenticated API and update over Socket.IO. The frontend bundle is live, but no signed-in conversation was available for interaction testing. |
| Voice calls | PASS ✅ (code review); BLOCKED (E2E) | Call controls, signaling events, and STUN configuration exist. No microphone permission or peer call was initiated. |
| Video calls | PASS ✅ (code review); BLOCKED (E2E) | Video controls, camera permission flow, ICE candidate signaling, and STUN configuration exist. No camera permission or peer call was initiated. |
| Online/offline status | PASS ✅ (code review); BLOCKED (E2E) | Socket connection/disconnection updates presence and the UI displays online/last-seen state. No authenticated second user was available. |
| Read receipts | FIXED ✅; BLOCKED (E2E) | UI now displays one tick for sent, double grey for delivered, and double blue for read. Fix is present in the deployed Vercel JS/CSS bundles; no live conversation was available to exercise it. |
| 24-hour status | PASS ✅ (code review); BLOCKED (E2E) | Status creation sets a 24-hour expiry, MongoDB has a TTL index, and reads filter expired posts. No status was created in production. |
| Logout | PASS ✅ (code review); BLOCKED (E2E) | Logout revokes the API session, clears the in-memory token, signs out of Firebase, and redirects to login. No authenticated session was available. |

## Fixes and validation

- **Google login CSP:** Earlier fix `7001dad` is live. The popup reached Google sign-in without CSP blocks or `auth/internal-error`.
- **Empty Google auth request:** Fixed `req.body` handling in `server/routes/auth.js`; added a regression test in `server/tests/authRouteValidation.test.js`. The local test verifies HTTP 400, now also confirmed live. Backend suite: **14 passed** after adding reaction tests; backend syntax lint passed.
- **Read-receipt ticks:** Updated `client/src/App.jsx` and `client/src/App.css` to distinguish sent/delivered/read. Frontend production build passed. Vercel serves the updated JS and CSS.
- **Photo chat actions:** Added inline and modal previews, working Cloudinary attachment download, authorized persistent reactions, and realtime reaction updates. Cloudinary download returned HTTP 200 with `Content-Disposition: attachment`; frontend build passed.
- **Frontend lint:** Completed with two existing `react(set-state-in-effect)` warnings in `client/src/App.jsx`.
- **Playwright audit:** The existing project Playwright dependency is installed; no extra install was needed.
- **Latest pushed commit:** `a024b83` — `Fix legacy message reaction route`.

## Deployment status and remaining checks

- **Vercel:** Photo preview/download/reaction UI and delivery-status bundles verified live. Login popup was also verified live.
- **Render:** Latest deployment is live: `GET /api/health` returned HTTP 200 and empty `POST /api/auth/google` returned HTTP 400. Both `PUT /api/messages/:id/reaction` and the legacy `PUT /api/messages/:id` are protected and returned HTTP 401 without a token.
- **Screenshots:** `screenshots/01_landing.png`, `screenshots/02_login_popup.png`, and `screenshots/final_01_login.png` were captured. Chat, group, status, profile, and video-call screenshots were not fabricated because those screens require an authenticated user.
- **Legacy reaction route compatibility:** Added a guarded alias for clients that send a supported reaction to `PUT /api/messages/:id`; both the new and legacy routes share the same participant authorization, supported-emoji validation, persistence, and realtime updates.
- **Next verification needed:** Complete an authenticated reaction in a test chat to verify the successful write and realtime UI end-to-end.

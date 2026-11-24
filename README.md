# Dream Chat

Dream Chat is a responsive messaging app built with React, Vite, Tailwind CSS, Express, MongoDB, Firebase Google sign-in, Socket.IO, Cloudinary, and browser WebRTC.

## What works

- Google sign-in exchanged for a signed API session; first-time users choose a unique username.
- User search, profile editing, private conversations, text and file messages, replies, delete-for-me/delete-for-everyone, unread counts, and read receipts.
- Live message delivery, typing indicators, and online presence through authenticated Socket.IO connections.
- Group creation and messaging, text statuses that expire after 24 hours, and responsive light/dark layouts.
- Voice and video call signaling and media using WebRTC and the configured public STUN server.

This is a working starter application, not a feature-complete WhatsApp replacement. Browser push notifications, call history, production TURN relays, full group administration, contact/camera sharing, status media/story playback, account deletion, and complete privacy/notification settings still need implementation. Calls may fail on restrictive networks without a TURN service. Cloud features cannot be tested until the environment variables below are supplied.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB (local or Atlas)
- A Firebase project with Google Authentication enabled
- Cloudinary account for file attachments

## Local setup

1. Copy `client/.env.example` to `client/.env` and add the Firebase web app configuration and API URL.
2. Copy `server/.env.example` to `server/.env`. Set MongoDB connection details, a random JWT secret of at least 32 characters, Firebase Admin service-account values, and Cloudinary credentials.
3. In the Firebase console, enable Google as a sign-in provider and add `localhost` to Authorized domains.
4. Install and start each app in separate terminals:

   ```powershell
   cd server
   npm install
   npm run dev
   ```

   ```powershell
   cd client
   npm install
   npm run dev
   ```

5. Open the Vite URL (normally `http://localhost:5173`). Check `http://localhost:5000/api/health` to verify the API is listening.

For `FIREBASE_PRIVATE_KEY`, preserve the service account key's newline escapes (`\n`) in the environment value. Never commit `.env` files.

## Deployment notes

- Deploy `server/` as a Node web service and `client/` as a static Vite site.
- Set `CLIENT_URL` to the deployed client origin and `VITE_API_URL` to the server origin.
- Set every required server/client variable in the hosting provider's secret/environment settings; do not put server secrets in Vite variables.
- Add the deployed client domain to Firebase Authorized domains.
- Use HTTPS for deployed sites. Configure a TURN service if calls must work across restrictive NATs/firewalls.

## Project layout

- `client/` — React app and responsive UI
- `server/` — Express API, MongoDB models, authentication, and Socket.IO signaling

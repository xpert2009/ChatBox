# Dream Chat deployment

The client and API are deployed from the same GitHub repository (`main`) as two services.

## Backend on Render

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Keep the existing production environment variables configured in Render. They include MongoDB Atlas, Firebase Admin, Cloudinary, `JWT_SECRET`, `NODE_ENV=production`, and the frontend `CLIENT_URL`.
- The health check is `https://chatbox-pgpf.onrender.com/api/health`.

## Frontend on Vercel

- Root directory: `client`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` and `VITE_BACKEND_URL` to the Render API URL, and configure the Firebase web-app variables in Vercel.
- The current deployment is `https://chatbox-frontend-xpert2009.vercel.app`.

Deployments are triggered by pushes to `main`. After changing either provider's environment variables, redeploy the corresponding service. The Vercel domain must be allowed by Render CORS and Firebase Authentication.

## Persistent data and retention

- MongoDB stores users, direct messages, groups, `group_messages`, media metadata, sessions, notifications, and statuses.
- Direct and group messages are retained; the API does not provide message deletion. Group records remain when their last member leaves.
- Uploaded files are stored in Cloudinary; MongoDB stores their URLs and metadata. No media deletion endpoint is provided.
- Sessions expire after 30 days and are revocable on sign-out.
- Statuses are visible for 24 hours and use a MongoDB TTL index; status viewers are recorded with each status.
- Existing group messages remain readable from the legacy `messages` collection while new group messages use `group_messages`.

After a deployment, verify `/api/health`, Google sign-in, direct and group messaging, uploads, and history pagination. For the cross-device check, sign into the same account on a phone and a computer, send a message on one, and confirm it appears on the other.

For WebRTC across restrictive networks, configure a TURN server from a hosted provider.

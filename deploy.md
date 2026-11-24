# Deploy ChatBox

## Backend on Render

1. Create a GitHub repository for the `server` folder.
2. Open Render and create a Node Web Service from that repository.
3. Set Build Command to `npm install`.
4. Set Start Command to `node server.js`.
5. Add every required `server/.env` variable under Environment.
6. Set `NODE_ENV=production`.
7. Set `CLIENT_URL` after deploying the frontend.
8. Copy the Render service URL.

## Frontend on Vercel

1. Create a GitHub repository for the `client` folder.
2. Import it into Vercel with the Vite framework preset.
3. Add all `client/.env` Firebase values.
4. Set `VITE_API_URL` and `VITE_BACKEND_URL` to the Render backend URL.
5. Deploy and copy the Vercel URL.

## Final configuration

1. Update Render `CLIENT_URL` to the Vercel URL.
2. Redeploy the backend.
3. In Firebase Authentication → Settings → Authorized Domains, add the Vercel domain.
4. Test Google sign-in, messaging, uploads, and WebRTC.

For WebRTC across restrictive networks, add a TURN server such as a hosted coturn provider or Twilio Network Traversal service.

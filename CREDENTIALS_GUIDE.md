# Dream Chat Credentials Guide

## Firebase

1. Open https://firebase.google.com and add a project named `Dream Chat`.
2. Disable Google Analytics for this project.
3. Open Authentication, choose Get Started, enable Google, and select a support email.
4. Open Project Settings, register a Web app, and copy:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `VITE_FIREBASE_PROJECT_ID`
   - `storageBucket` → `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`
5. Open Project Settings → Service Accounts → Generate New Private Key.
6. Copy `project_id`, `private_key`, and `client_email` into `server/.env`.

## MongoDB Atlas

1. Create a free cluster at https://mongodb.com/atlas.
2. Add a database user with only the permissions the app needs. Under Network Access, add your current IP for local testing. For deployment, allow only the backend's documented outbound IP ranges; avoid `0.0.0.0/0`.
3. Choose Connect → Drivers → copy the connection string.
4. Replace `<password>` and `<dbname>`, for example:
   `mongodb+srv://chatboxuser:PASSWORD@cluster.example/chatbox?retryWrites=true&w=majority`
5. Set the result as `MONGODB_URI` in `server/.env`.

## Cloudinary

1. Sign up at https://cloudinary.com.
2. Copy Cloud Name, API Key, and API Secret from the Dashboard.
3. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `server/.env`.

## Local verification

- Keep all placeholder values empty until real credentials are available.
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

# Deploying Clairity Backend to Render

### Prerequisites
- Ensure your GitHub repository containing the Clairity project is connected to your Render account.
- The `typecheck` and `test` commands should be passing on `main`.

### 1. Create a Web Service
1. Go to the Render Dashboard and click **New+** -> **Web Service**.
2. Select your repository.
3. Fill out the configuration:
   - **Name**: `clairity-backend`
   - **Environment**: `Node`
   - **Region**: Recommend `Oregon (US West)` or closest target.
   - **Branch**: `main`
   - **Root Directory**: `backend`

### 2. Configuration Commands
Set the exact commands required to build and start the backend:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`

### 3. Environment Variables
Under the "Environment Variables" section, add the following (all required):
- `NODE_ENV`: `production`
- `SESSION_SECRET`: `<YOUR_32_CHARACTER_CRYPTOGRAPHIC_KEY>` *(If missing, server will crash)*
- `CORS_ORIGIN`: `chrome-extension://<YOUR_PUBLISHED_EXTENSION_ID>` 
  - *(Note: Set this immediately after the Chrome Web Store grants you a fixed extension ID. A wildcard `*` is explicitly blocked in production.)*

### 4. Health Check
Once deployed, verify the service is running correctly by pinging:
`https://clairity-backend.onrender.com/v1/health`

### 5. Troubleshooting (Rate Limiting)
**Important Note:** The current backend utilizes an in-memory sliding window rate limiter. Render often scales horizontally or reboots services. 
- **Effect**: During a horizontal spike or deployment restart, the rate limits are zeroed out across instances. This limits its effectiveness as an absolute DDOS protection. For strict enterprise scaling, migrate this to a Redis backing store in the future.

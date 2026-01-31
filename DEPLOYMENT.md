# Deployment Configuration for Render

## Backend Service Configuration

**Service Type:** Web Service

### Build Settings
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Root Directory:** `backend`

### Environment Variables
Add these in Render dashboard:
```
MONGO_URI=<your-mongodb-atlas-connection-string>
NODE_ENV=production
FRONTEND_URL=https://auction-game-phi.vercel.app (optional - already hardcoded in server.js)
```

**Note:** The Vercel frontend URL is already hardcoded in the CORS configuration, but you can override it with the FRONTEND_URL environment variable if needed.

### Auto-Deploy
- Branch: `main`
- Auto-Deploy: Yes

---

## Frontend Static Site Configuration

**Service Type:** Static Site

### Build Settings
- **Build Command:** `cd frontend && npm install && npm run build`
- **Publish Directory:** `frontend/dist`
- **Root Directory:** `/` (leave as root)

### Environment Variables
Add these in Render dashboard:
```
VITE_API_URL=<your-backend-url>
```

Example: `https://ipl-auction-backend.onrender.com`

### Auto-Deploy
- Branch: `main`
- Auto-Deploy: Yes

---

## Important Notes

1. **Deploy Backend First** - Get the backend URL before deploying frontend
2. **Update CORS** - Add your frontend URL to backend's `FRONTEND_URL` environment variable
3. **MongoDB Atlas** - Whitelist `0.0.0.0/0` in Network Access or add Render's IP addresses
4. **Free Tier Limitations** - Render free tier services spin down after inactivity. First request may take 30-60 seconds.

---

## Quick Deploy Steps

1. Push code to GitHub
2. Create MongoDB Atlas cluster and get connection string
3. Deploy backend on Render with MongoDB URI
4. Copy backend URL
5. Deploy frontend on Render with backend URL as `VITE_API_URL`
6. Update backend's `FRONTEND_URL` with frontend URL
7. Test the application!

---

## Troubleshooting

**Socket.io not connecting:**
- Verify CORS settings in backend
- Check that `VITE_API_URL` is set correctly
- Ensure WebSocket support is enabled (Render supports this by default)

**Database connection failed:**
- Verify MongoDB connection string
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

**Build fails:**
- Check Node.js version (should be 18+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

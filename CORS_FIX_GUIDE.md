# CORS Error Fix Guide

## What Was the Problem?

Your frontend (deployed on Vercel at `https://auction-game-phi.vercel.app`) was trying to connect to your backend (deployed on Render at `https://auction-game-2.onrender.com`), but the browser blocked the connection due to CORS (Cross-Origin Resource Sharing) policy.

**Error Message:**
```
Access to XMLHttpRequest at 'https://auction-game-2.onrender.com/socket.io/...' 
from origin 'https://auction-game-phi.vercel.app' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## What Causes CORS Errors?

CORS is a browser security feature that prevents websites from making requests to a different domain than the one that served the web page. Your backend needs to explicitly tell the browser: "Yes, I allow requests from this frontend domain."

## The Solution

### ✅ Step 1: Code Changes (Already Done!)

I've updated your `backend/server.js` to:
- Explicitly allow your Vercel frontend URL: `https://auction-game-phi.vercel.app`
- Support local development URLs
- Handle dynamic origins via environment variables

### ✅ Step 2: Deploy the Updated Backend

You need to push these changes and redeploy your backend on Render:

```bash
# Commit the changes
git add .
git commit -m "Fix CORS configuration for Vercel frontend"
git push origin main
```

Render will automatically redeploy your backend if you have auto-deploy enabled.

### ✅ Step 3: Verify Environment Variables on Render

Go to your Render dashboard for the backend service and ensure these environment variables are set:

**Required:**
- `MONGO_URI` = Your MongoDB Atlas connection string
- `NODE_ENV` = `production`

**Optional (but recommended):**
- `FRONTEND_URL` = `https://auction-game-phi.vercel.app`

### ✅ Step 4: Test the Connection

After the backend redeploys:

1. Open your frontend: `https://auction-game-phi.vercel.app`
2. Open browser DevTools (F12)
3. Go to the Console tab
4. Try to join/create a room
5. You should see Socket.IO connection messages instead of CORS errors

## Understanding the Fix

### Before (Problematic Code):
```javascript
app.use(cors()); // Too permissive, doesn't work in production
```

### After (Fixed Code):
```javascript
const allowedOrigins = [
    'http://localhost:5173',           // Local dev
    'http://localhost:3000',           // Alternative local dev
    'https://auction-game-phi.vercel.app', // Production frontend
    process.env.FRONTEND_URL           // Dynamic via env var
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

## What If I Change My Frontend URL?

If you deploy to a different Vercel URL or custom domain:

1. **Option A:** Update the `allowedOrigins` array in `backend/server.js`
2. **Option B:** Set the `FRONTEND_URL` environment variable on Render to your new URL

## Common Issues & Solutions

### Issue: Still getting CORS errors after deployment
**Solution:** 
- Clear browser cache and hard reload (Ctrl+Shift+R)
- Check Render logs to ensure the new code deployed
- Verify the frontend URL matches exactly (no trailing slash)

### Issue: Works locally but not in production
**Solution:**
- Ensure `NODE_ENV=production` is set on Render
- Check that your frontend is using the correct backend URL (HTTPS, not HTTP)

### Issue: Socket.IO connects but then disconnects
**Solution:**
- This is likely a different issue (not CORS)
- Check your MongoDB connection
- Verify Render service isn't sleeping (free tier spins down after inactivity)

## Additional Notes

- **WebSocket Support:** Render supports WebSockets by default, so Socket.IO should work fine
- **Free Tier:** Render free services spin down after 15 minutes of inactivity. First request may take 30-60 seconds
- **HTTPS Required:** Vercel only serves HTTPS, so your backend must also use HTTPS (Render provides this automatically)

## Need More Help?

Check the browser console for specific error messages and the Render logs for backend errors.

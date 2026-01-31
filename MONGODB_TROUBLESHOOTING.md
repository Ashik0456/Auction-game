# MongoDB Connection Troubleshooting Guide

## Current Status
❌ MongoDB: **DISCONNECTED**
✅ Backend: **ONLINE**
✅ CORS: **FIXED**

## Problem
The backend can't connect to MongoDB, which means:
- Can't create rooms
- Can't join rooms
- Can't save auction data

## Step-by-Step Fix

### 1. Check Render Environment Variables

Go to your Render dashboard:
1. Open your backend service
2. Click "Environment" in the left sidebar
3. Verify `MONGO_URI` exists and is correct

**Expected format:**
```
MONGO_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/ipl-auction?retryWrites=true&w=majority
```

**Common mistakes:**
- ❌ Missing the variable entirely
- ❌ Extra spaces before/after the value
- ❌ Wrong password (special characters need URL encoding)
- ❌ Wrong database name
- ❌ Using `mongodb://` instead of `mongodb+srv://`

### 2. Check MongoDB Atlas Network Access

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Select your project
3. Click "Network Access" in the left sidebar
4. Verify you have one of these:

**Option A (Recommended for testing):**
```
IP Address: 0.0.0.0/0
Comment: Allow from anywhere
```

**Option B (More secure):**
Add Render's IP ranges (check Render docs for current IPs)

### 3. Check MongoDB Atlas Database User

1. Go to "Database Access" in MongoDB Atlas
2. Verify your user exists
3. Check the password is correct
4. Ensure the user has "Read and write to any database" permissions

### 4. Test Your Connection String Locally

Update your local `.env` file with the MongoDB Atlas connection string:

```bash
MONGO_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/ipl-auction?retryWrites=true&w=majority
```

Then test locally:
```bash
cd backend
npm start
```

If it connects locally, the connection string is correct. The issue is with Render configuration.

### 5. Check Render Logs

1. Go to Render dashboard
2. Select your backend service
3. Click "Logs"
4. Look for error messages like:
   - `❌ MongoDB Connection Error:`
   - `MongoServerError`
   - `Authentication failed`
   - `Network timeout`

**Common error messages and fixes:**

| Error | Fix |
|-------|-----|
| `Authentication failed` | Wrong username/password |
| `Network timeout` | IP not whitelisted in Atlas |
| `MONGO_URI is not defined` | Environment variable not set |
| `Invalid connection string` | Check the format |

### 6. URL Encode Special Characters in Password

If your MongoDB password contains special characters like `@`, `#`, `$`, `%`, etc., you need to URL encode them:

| Character | Encoded |
|-----------|---------|
| @ | %40 |
| # | %23 |
| $ | %24 |
| % | %25 |
| & | %26 |

**Example:**
```
Password: MyP@ss#123
Encoded: MyP%40ss%23123
```

### 7. Force Redeploy on Render

After updating environment variables:
1. Go to Render dashboard
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete
4. Check `/health` endpoint again

### 8. Verify the Fix

After making changes, test:

**Check health endpoint:**
```
https://auction-game-2.onrender.com/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "mongodb": "connected",  // ← Should say "connected"
  "uptime": 123.456
}
```

## Quick Checklist

- [ ] MongoDB Atlas cluster is running
- [ ] Database user created with correct password
- [ ] Network access allows `0.0.0.0/0`
- [ ] `MONGO_URI` environment variable set on Render
- [ ] Connection string format is correct
- [ ] Special characters in password are URL encoded
- [ ] Render service redeployed after env var changes
- [ ] Render logs show "✅ MongoDB Connected"
- [ ] `/health` endpoint shows `"mongodb": "connected"`

## Still Not Working?

If you've tried everything above and it's still not working:

1. **Copy your Render logs** (last 50 lines)
2. **Copy your MONGO_URI** (hide the password like: `mongodb+srv://user:****@cluster...`)
3. **Share the error message** from Render logs

I can help debug further with this information.

## Alternative: Use a Different MongoDB Provider

If MongoDB Atlas isn't working, you can try:
- [Railway](https://railway.app) - Free MongoDB hosting
- [Clever Cloud](https://www.clever-cloud.com) - Free tier available
- Local MongoDB (for testing only)

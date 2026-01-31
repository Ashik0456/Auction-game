---
description: Deploy the IPL Auction Application
---

# IPL Auction Application Deployment Guide

This guide covers deploying your IPL Auction application to production. The app consists of:
- **Backend**: Node.js + Express + Socket.io server
- **Frontend**: React + Vite application
- **Database**: MongoDB

## Deployment Options

### Option 1: Deploy to Render (Recommended - Free Tier Available)

#### Backend Deployment on Render

1. **Prepare Backend for Production**
   - Ensure `package.json` has the correct start script
   - Add environment variable support

2. **Create Render Account**
   - Go to [render.com](https://render.com) and sign up
   - Connect your GitHub account (you'll need to push code to GitHub first)

3. **Deploy Backend as Web Service**
   - Click "New +" → "Web Service"
   - Connect your repository
   - Configure:
     - **Name**: `ipl-auction-backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment Variables**:
       - `MONGO_URI`: Your MongoDB connection string (see MongoDB Atlas setup below)
       - `PORT`: 5000 (Render will override this)
       - `NODE_ENV`: production

4. **Note the Backend URL** (e.g., `https://ipl-auction-backend.onrender.com`)

#### MongoDB Atlas Setup (Free Tier)

1. **Create MongoDB Atlas Account**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for free tier

2. **Create a Cluster**
   - Choose free tier (M0)
   - Select a region close to your users

3. **Configure Database Access**
   - Create a database user with username and password
   - Note these credentials

4. **Configure Network Access**
   - Add IP: `0.0.0.0/0` (allow access from anywhere)
   - Or add Render's IP addresses

5. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database password
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ipl-auction?retryWrites=true&w=majority`

#### Frontend Deployment on Render

1. **Update Frontend API URL**
   - Create `.env.production` in frontend folder
   - Add: `VITE_API_URL=https://ipl-auction-backend.onrender.com`

2. **Deploy Frontend as Static Site**
   - Click "New +" → "Static Site"
   - Connect your repository
   - Configure:
     - **Name**: `ipl-auction-frontend`
     - **Build Command**: `cd frontend && npm install && npm run build`
     - **Publish Directory**: `frontend/dist`
     - **Environment Variables**:
       - `VITE_API_URL`: Your backend URL from step 4 above

3. **Access Your App**
   - Frontend URL: `https://ipl-auction-frontend.onrender.com`

---

### Option 2: Deploy to Vercel (Frontend) + Render (Backend)

#### Backend on Render
Follow the same steps as Option 1 for backend and MongoDB.

#### Frontend on Vercel

1. **Install Vercel CLI**
// turbo
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy Frontend**
```bash
cd frontend
vercel
```

4. **Configure Environment Variables**
   - In Vercel dashboard, add:
     - `VITE_API_URL`: Your backend URL

5. **Deploy to Production**
```bash
vercel --prod
```

---

### Option 3: Deploy to Railway (Alternative to Render)

#### Backend + MongoDB on Railway

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add MongoDB**
   - Click "New" → "Database" → "Add MongoDB"
   - Railway will provide connection string automatically

4. **Configure Backend Service**
   - Select your backend folder
   - Add environment variables:
     - `MONGO_URI`: Use Railway's MongoDB connection string
     - `NODE_ENV`: production

5. **Deploy Frontend**
   - Add another service for frontend
   - Configure build command: `npm run build`
   - Configure start command: `npm run preview`

---

### Option 4: Self-Hosted VPS (DigitalOcean, AWS, etc.)

#### Prerequisites
- VPS with Ubuntu 20.04+ or similar
- Domain name (optional but recommended)
- SSH access to server

#### Server Setup

1. **Connect to Server**
```bash
ssh user@your-server-ip
```

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install MongoDB**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

4. **Install PM2 (Process Manager)**
```bash
sudo npm install -g pm2
```

5. **Clone Your Repository**
```bash
git clone <your-repo-url>
cd play-auction-prj
```

6. **Setup Backend**
```bash
cd backend
npm install
# Create .env file with production settings
pm2 start server.js --name ipl-auction-backend
pm2 save
pm2 startup
```

7. **Setup Frontend**
```bash
cd ../frontend
npm install
npm run build
sudo npm install -g serve
pm2 start "serve -s dist -l 3000" --name ipl-auction-frontend
```

8. **Configure Nginx (Reverse Proxy)**
```bash
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/ipl-auction
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/ipl-auction /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

9. **Setup SSL with Let's Encrypt (Optional but Recommended)**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Pre-Deployment Checklist

Before deploying, ensure you've completed these steps:

### 1. Update Backend for Production

- [ ] Add CORS configuration for production frontend URL
- [ ] Add environment variable for PORT
- [ ] Update Socket.io CORS settings
- [ ] Add error handling and logging

### 2. Update Frontend for Production

- [ ] Create environment variable for API URL
- [ ] Update Socket.io connection to use production backend URL
- [ ] Test build locally: `npm run build && npm run preview`
- [ ] Optimize images and assets

### 3. Security

- [ ] Use environment variables for all sensitive data
- [ ] Enable HTTPS
- [ ] Set secure headers
- [ ] Implement rate limiting
- [ ] Validate all user inputs

### 4. Testing

- [ ] Test locally in production mode
- [ ] Test all Socket.io real-time features
- [ ] Test with multiple users/rooms
- [ ] Test on mobile devices

---

## Quick Start: GitHub + Render Deployment

This is the fastest way to deploy for free:

1. **Push to GitHub**
```bash
cd "c:\Users\muniy\Desktop\play auction prj"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

2. **Setup MongoDB Atlas** (follow steps above)

3. **Deploy Backend on Render**
   - Connect GitHub repo
   - Deploy as Web Service
   - Add MongoDB connection string

4. **Deploy Frontend on Render**
   - Connect same GitHub repo
   - Deploy as Static Site
   - Add backend URL as environment variable

5. **Done!** Your app is live.

---

## Monitoring and Maintenance

- **Render**: Check logs in dashboard
- **Railway**: Built-in metrics and logs
- **VPS**: Use `pm2 logs` and `pm2 monit`
- **MongoDB Atlas**: Monitor database performance in dashboard

## Troubleshooting

**Socket.io not connecting:**
- Check CORS settings in backend
- Verify WebSocket support on hosting platform
- Check firewall rules

**Database connection failed:**
- Verify MongoDB connection string
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

**Build fails:**
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Check build logs for specific errors

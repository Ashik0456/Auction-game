# IPL Auction "Autopilot"

This project is a MERN stack application simulating a real-time IPL auction.

## Prerequisites
- Node.js (v18 or higher)
- MongoDB (Ensure it is running locally or update `.env` in backend with your URI)

## Installation & Setup

### 1. Backend Server
The backend handles the auction logic, timer loops, and database connections.
```bash
cd backend
npm install
npm run dev
```
Server will start on **http://localhost:5000**.

### 2. Frontend Application
The frontend is built with React + Vite + Tailwind CSS.
```bash
cd frontend
npm install
npm run dev
```
App will open on **http://localhost:5173** (or similar).

## How to use
1. **Open the frontend** in your browser.
2. **Create a Room**: Enter a username (e.g., "Ashik") and a Room Code (e.g., "IPL2026").
   - The first person to join a room becomes the **Creator (Admin)**.
3. **Join as Bidder**: Open a new tab/window, enter a different username (e.g., "CSK") and the **same Room Code**.
4. **Start Auction**: On the Creator's screen, you will see a "Start Auction" button. Click it to begin the automated loop.
5. **Bidding**:
   - The server will display a player.
   - The timer (10s/15s) will count down.
   - Click "RAISE BID" to place a bid. This resets the timer.
   - If timer hits 0, the player is SOLD to the highest bidder or UNSOLD.
   - After a 3-second result pause, the next player appears automatically.

## Tech Stack
- **MongoDB**: Database for Rooms and Players.
- **Express + Node.js**: Backend server & Auction Loop Logic.
- **Socket.io**: Real-time communication (Timer sync, Bids).
- **React + Tailwind**: Frontend UI with Glassmorphism design and Animations.

## Deployment

This application is production-ready and can be deployed to various platforms:

### Quick Deploy (Recommended)
Deploy to **Render** (free tier available):
1. See `DEPLOYMENT.md` for detailed Render configuration
2. Or use the deployment workflow: Run `/deploy` command

### Other Options
- **Vercel** (Frontend) + **Render/Railway** (Backend)
- **Railway** (Full-stack)
- **Self-hosted VPS** (DigitalOcean, AWS, etc.)

For complete deployment instructions, see:
- **DEPLOYMENT.md** - Render-specific configuration
- **.agent/workflows/deploy.md** - Comprehensive deployment guide

### Environment Variables

**Backend (.env):**
```
MONGO_URI=mongodb://localhost:27017/ipl-auction
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env.production):**
```
VITE_API_URL=https://your-backend-url.com
```

## Production Checklist
- [ ] MongoDB Atlas cluster created
- [ ] Backend deployed with correct environment variables
- [ ] Frontend deployed with backend URL
- [ ] CORS configured properly
- [ ] Socket.io connections tested
- [ ] Multi-user auction tested

## Support
For deployment issues, check the troubleshooting section in `DEPLOYMENT.md`.


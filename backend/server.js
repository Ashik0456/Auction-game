import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Room from './models/Room.js';

dotenv.config();

const app = express();

/* ✅ FIX 1: Express CORS (CHANGED) */
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("IPL Auction Backend is live 🚀");
});

const server = http.createServer(app);

/* ✅ FIX 2: Socket.IO CORS (CHANGED) */
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ipl-auction')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// In-memory store for active timers to avoid DB spam
const activeAuctions = new Map();

// Default Players Data
import { ALL_IPL_PLAYERS } from './data/players.js';
const DEFAULT_PLAYERS = ALL_IPL_PLAYERS;

// API Route to check room availability (for Landing Page)
app.get('/api/room/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ exists: false, takenTeams: [] });
    }

    const takenTeams = room.participants.map(p => {
      if (p.teamName) return p.teamName;
      const match = p.username.match(/\(([^)]+)\)$/);
      return match ? match[1] : null;
    }).filter(Boolean);

    res.json({ exists: true, takenTeams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper: Shuffle Array
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', async ({ username, roomCode, create, teamId }) => {
    try {
      let room = await Room.findOne({ roomCode });
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

      if (!room) {
        if (!create) {
          socket.emit('room_error', 'No rooms available with this ID');
          return;
        }

        const initialPool = shuffleArray(
          DEFAULT_PLAYERS.map(p => ({ ...p, isSold: false }))
        );

        room = new Room({
          roomCode,
          creatorName: username,
          participants: [{ username, isCreator: true, avatar, budget: 100, teamName: teamId }],
          playersPool: initialPool,
        });
        await room.save();
      } else {
        if (!room.playersPool || room.playersPool.length === 0) {
          room.playersPool = shuffleArray(
            DEFAULT_PLAYERS.map(p => ({ ...p, isSold: false }))
          );
          room.isAuctionStarted = false;
          room.currentPlayerIndex = 0;
          room.currentBid = 0;
          room.highestBidder = null;
          await room.save();
        }

        const exists = room.participants.find(p => p.username === username);
        if (!exists) {
          const teamTaken = room.participants.some(
            p => p.teamName === teamId || (p.username && p.username.includes(`(${teamId})`))
          );

          if (teamTaken) {
            socket.emit('room_error', `The team ${teamId} is already taken!`);
            return;
          }

          room.participants.push({
            username,
            isCreator: false,
            avatar,
            budget: 100,
            teamName: teamId
          });
          await room.save();
        }
      }

      socket.join(roomCode);
      io.to(roomCode).emit('room_data', room);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('update_timer', async ({ roomCode, timer }) => {
    await Room.findOneAndUpdate({ roomCode }, { timerPreference: timer });
    const room = await Room.findOne({ roomCode });
    io.to(roomCode).emit('room_data', room);
  });

  socket.on('remove_player', async ({ roomCode, playerId }) => {
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    const pIndex = room.playersPool.findIndex(p => p.id === playerId);
    if (pIndex !== -1 && (!room.isAuctionStarted || pIndex > room.currentPlayerIndex)) {
      room.playersPool = room.playersPool.filter(p => p.id !== playerId);
      await room.save();
      io.to(roomCode).emit('room_data', room);
    }
  });

  socket.on('start_auction', async ({ roomCode }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return;

      room.isAuctionStarted = true;
      room.currentPlayerIndex = 0;
      room.playersPool = shuffleArray(room.playersPool);
      room.playersPool.forEach(p => p.isSold = false);

      await room.save();
      io.to(roomCode).emit('auction_started', room);

      stopTimer(roomCode);
      startTimerLoop(roomCode);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('pause_auction', async ({ roomCode }) => {
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    if (activeAuctions.has(roomCode)) {
      room.timeLeft = activeAuctions.get(roomCode).timeLeft;
    }
    room.isPaused = true;
    stopTimer(roomCode);
    await room.save();
    io.to(roomCode).emit('auction_paused', room);
  });

  socket.on('resume_auction', async ({ roomCode }) => {
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    room.isPaused = false;
    await room.save();
    io.to(roomCode).emit('auction_resumed', room);

    if (!room.playersPool[room.currentPlayerIndex]?.isSold) {
      startTimerLoop(roomCode, room.timeLeft);
    }
  });

  socket.on('end_auction', async ({ roomCode }) => {
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    room.isAuctionStarted = false;
    room.isPaused = false;
    stopTimer(roomCode);

    io.to(roomCode).emit('auction_ended', room);
    await Room.deleteOne({ roomCode });
  });

  socket.on('place_bid', async ({ roomCode, username, amount }) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room || room.isPaused) return;

      const participant = room.participants.find(p => p.username === username);
      if (!participant || participant.budget < amount) return;
      if (room.highestBidder === username) return;

      if (amount > room.currentBid) {
        room.currentBid = amount;
        room.highestBidder = username;
        await room.save();

        io.to(roomCode).emit('bid_update', {
          currentBid: amount,
          highestBidder: username
        });

        resetTimer(roomCode, room.timerPreference);
      }
    } catch (e) {
      console.error(e);
    }
  });
});

/* ===== TIMER HELPERS (UNCHANGED) ===== */

async function startTimerLoop(roomCode, resumeTime = null) {
  stopTimer(roomCode);
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  if (room.currentPlayerIndex >= room.playersPool.length) {
    io.to(roomCode).emit('auction_ended');
    return;
  }

  const currentPlayer = room.playersPool[room.currentPlayerIndex];
  let timeLeft = resumeTime && resumeTime > 0 ? resumeTime : room.timerPreference;

  io.to(roomCode).emit('new_player', {
    player: currentPlayer,
    currentBid: room.currentBid || currentPlayer.basePrice,
    highestBidder: room.highestBidder
  });

  io.to(roomCode).emit('timer_update', timeLeft);

  const intervalId = setInterval(async () => {
    timeLeft--;
    io.to(roomCode).emit('timer_update', timeLeft);

    if (timeLeft <= 0) {
      clearInterval(intervalId);
      activeAuctions.delete(roomCode);
      await resolveRound(roomCode);
    }
  }, 1000);

  activeAuctions.set(roomCode, { intervalId, timeLeft });
}

function stopTimer(roomCode) {
  if (activeAuctions.has(roomCode)) {
    clearInterval(activeAuctions.get(roomCode).intervalId);
    activeAuctions.delete(roomCode);
  }
}

function resetTimer(roomCode, duration) {
  stopTimer(roomCode);
  startTimerLoop(roomCode, duration);
}

async function resolveRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const player = room.playersPool[room.currentPlayerIndex];
  if (!player) return;

  if (room.highestBidder) {
    player.isSold = true;
    player.soldTo = room.highestBidder;
    player.soldPrice = room.currentBid;

    const buyer = room.participants.find(p => p.username === room.highestBidder);
    if (buyer) buyer.budget -= room.currentBid;
  }

  room.currentPlayerIndex++;
  room.currentBid = 0;
  room.highestBidder = null;

  room.markModified('playersPool');
  room.markModified('participants');
  await room.save();

  io.to(roomCode).emit('player_result', {
    player,
    updatedParticipants: room.participants
  });

  setTimeout(() => startTimerLoop(roomCode), 1000);
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

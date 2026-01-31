import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Room from './models/Room.js';

dotenv.config();

const app = express();

// ✅ Production-ready CORS configuration with explicit Vercel URL
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://auction-game-phi.vercel.app',  // Explicit Vercel URL
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [])
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

// Health check endpoint for deployment platforms
app.get("/", (req, res) => {
    res.status(200).json({
        status: "online",
        message: "IPL Auction Backend is live 🚀",
        timestamp: new Date().toISOString()
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

const server = http.createServer(app);

// ✅ Production-ready Socket.IO CORS
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    // Production optimizations
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling']
});

// ✅ MongoDB Connection with retry logic
const connectDB = async () => {
    const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    };

    try {
        await mongoose.connect(process.env.MONGO_URI, options);
        console.log('✅ MongoDB Connected Successfully');
        console.log('📊 Database:', mongoose.connection.db.databaseName);
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

connectDB();

// Handle MongoDB disconnection
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
});

// In-memory store for active timers
const activeAuctions = new Map();

// Default Players Data with error handling
let DEFAULT_PLAYERS = [];
try {
    const { ALL_IPL_PLAYERS } = await import('./data/players.js');
    DEFAULT_PLAYERS = ALL_IPL_PLAYERS;
    console.log(`✅ Loaded ${DEFAULT_PLAYERS.length} players`);
} catch (err) {
    console.error('⚠️ Warning: Could not load players data:', err.message);
    console.log('Server will start but rooms cannot be created until players are loaded');
    DEFAULT_PLAYERS = [];
}

// API Route to check room availability
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
        console.error('Room check error:', err);
        res.status(500).json({ error: "Server error" });
    }
});

// Helper: Shuffle Array
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('join_room', async ({ username, roomCode, create, teamId }) => {
        try {
            let room = await Room.findOne({ roomCode });
            const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

            if (!room) {
                if (!create) {
                    socket.emit('room_error', 'No rooms available with this ID');
                    return;
                }

                if (DEFAULT_PLAYERS.length === 0) {
                    socket.emit('room_error', 'Players data not available. Please try again later.');
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
                    timerPreference: 30
                });
                await room.save();
                console.log(`📝 Room created: ${roomCode}`);
            } else {
                if (!room.playersPool || room.playersPool.length === 0) {
                    if (DEFAULT_PLAYERS.length === 0) {
                        socket.emit('room_error', 'Players data not available');
                        return;
                    }

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
                    console.log(`👤 User joined ${roomCode}: ${username}`);
                }
            }

            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.username = username;
            io.to(roomCode).emit('room_data', room);
        } catch (err) {
            console.error('Join room error:', err);
            socket.emit('room_error', 'Failed to join room. Please try again.');
        }
    });

    socket.on('update_timer', async ({ roomCode, timer }) => {
        try {
            await Room.findOneAndUpdate({ roomCode }, { timerPreference: timer });
            const room = await Room.findOne({ roomCode });
            if (room) {
                io.to(roomCode).emit('room_data', room);
            }
        } catch (err) {
            console.error('Update timer error:', err);
        }
    });

    socket.on('remove_player', async ({ roomCode, playerId }) => {
        try {
            const room = await Room.findOne({ roomCode });
            if (!room) return;

            const pIndex = room.playersPool.findIndex(p => p.id === playerId);
            if (pIndex !== -1 && (!room.isAuctionStarted || pIndex > room.currentPlayerIndex)) {
                room.playersPool = room.playersPool.filter(p => p.id !== playerId);
                await room.save();
                io.to(roomCode).emit('room_data', room);
            }
        } catch (err) {
            console.error('Remove player error:', err);
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
            console.log(`🎯 Auction started in room: ${roomCode}`);
            io.to(roomCode).emit('auction_started', room);

            stopTimer(roomCode);
            startTimerLoop(roomCode);
        } catch (err) {
            console.error('Start auction error:', err);
        }
    });

    socket.on('pause_auction', async ({ roomCode }) => {
        try {
            const room = await Room.findOne({ roomCode });
            if (!room) return;

            if (activeAuctions.has(roomCode)) {
                room.timeLeft = activeAuctions.get(roomCode).timeLeft;
            }
            room.isPaused = true;
            stopTimer(roomCode);
            await room.save();
            io.to(roomCode).emit('auction_paused', room);
            console.log(`⏸️ Auction paused in room: ${roomCode}`);
        } catch (err) {
            console.error('Pause auction error:', err);
        }
    });

    socket.on('resume_auction', async ({ roomCode }) => {
        try {
            const room = await Room.findOne({ roomCode });
            if (!room) return;

            room.isPaused = false;
            await room.save();
            io.to(roomCode).emit('auction_resumed', room);
            console.log(`▶️ Auction resumed in room: ${roomCode}`);

            if (!room.playersPool[room.currentPlayerIndex]?.isSold) {
                startTimerLoop(roomCode, room.timeLeft);
            }
        } catch (err) {
            console.error('Resume auction error:', err);
        }
    });

    socket.on('end_auction', async ({ roomCode }) => {
        try {
            const room = await Room.findOne({ roomCode });
            if (!room) return;

            room.isAuctionStarted = false;
            room.isPaused = false;
            stopTimer(roomCode);

            io.to(roomCode).emit('auction_ended', room);
            await Room.deleteOne({ roomCode });
            console.log(`🏁 Auction ended and room deleted: ${roomCode}`);
        } catch (err) {
            console.error('End auction error:', err);
        }
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
        } catch (err) {
            console.error('Place bid error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        const roomCode = socket.data.roomCode;
        if (roomCode) {
            console.log(`User left room: ${roomCode}`);
            // Optional: Implement participant removal logic here
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

/* ===== TIMER HELPERS ===== */

async function startTimerLoop(roomCode, resumeTime = null) {
    stopTimer(roomCode);
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    if (room.currentPlayerIndex >= room.playersPool.length) {
        io.to(roomCode).emit('auction_ended');
        return;
    }

    const currentPlayer = room.playersPool[room.currentPlayerIndex];
    let timeLeft = resumeTime && resumeTime > 0 ? resumeTime : (room.timerPreference || 30);

    io.to(roomCode).emit('new_player', {
        player: currentPlayer,
        currentBid: room.currentBid || currentPlayer.basePrice,
        highestBidder: room.highestBidder
    });

    io.to(roomCode).emit('timer_update', timeLeft);

    const intervalId = setInterval(async () => {
        timeLeft--;

        if (activeAuctions.has(roomCode)) {
            activeAuctions.get(roomCode).timeLeft = timeLeft;
        }

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
    try {
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
    } catch (err) {
        console.error('Resolve round error:', err);
    }
}

// ✅ Graceful shutdown handlers
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');

        // Clear all active timers
        activeAuctions.forEach((auction, roomCode) => {
            clearInterval(auction.intervalId);
            console.log(`Cleared timer for room: ${roomCode}`);
        });
        activeAuctions.clear();

        // Close MongoDB connection
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   🚀 IPL Auction Server Running       ║
║   Port: ${PORT}                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}     ║
║   MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⏳ Connecting...'}      ║
╚════════════════════════════════════════╝
  `);
});

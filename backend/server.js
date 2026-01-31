import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Room from './models/Room.js';

dotenv.config();

const app = express();

// CORS Configuration - Allow multiple origins
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://auction-game-phi.vercel.app',
    process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ipl-auction')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

// In-memory store for active timers to avoid DB spam
// key: roomCode, value: { timer: number, intervalId: fn, pauseTimeout: fn }
const activeAuctions = new Map();

// Default Players Data
import { ALL_IPL_PLAYERS } from './data/players.js';

// Default Players Data
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
            // Fallback for older style "Name (TEAM)"
            const match = p.username.match(/\(([^)]+)\)$/);
            return match ? match[1] : null;
        }).filter(Boolean);

        res.json({ exists: true, takenTeams });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


// Helper: Shuffle Array (Fisher-Yates)
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join Room
    socket.on('join_room', async ({ username, roomCode, create, teamId }) => {
        try {
            let room = await Room.findOne({ roomCode });

            const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

            if (!room) {
                if (!create) {
                    socket.emit('room_error', 'No rooms available with this ID');
                    return;
                }

                // Create new room
                // Shuffle players for the new room
                const initialPool = shuffleArray(DEFAULT_PLAYERS.map(p => ({ ...p, isSold: false })));

                room = new Room({
                    roomCode,
                    creatorName: username,
                    participants: [{ username, isCreator: true, avatar, budget: 100, teamName: teamId }],
                    playersPool: initialPool,
                });
                await room.save();
            } else {
                // Fix for stale rooms with empty players
                if (!room.playersPool || room.playersPool.length === 0) {
                    room.playersPool = shuffleArray(DEFAULT_PLAYERS.map(p => ({ ...p, isSold: false })));
                    // Reset auction state if we are resetting players
                    room.isAuctionStarted = false;
                    room.currentPlayerIndex = 0;
                    room.currentBid = 0;
                    room.highestBidder = null;
                    await room.save();
                    console.log(`Repopulated players for room ${roomCode}`);
                }

                // Add user if not exists
                const exists = room.participants.find(p => p.username === username);
                if (!exists) {
                    // Check if team is already taken
                    const teamTaken = room.participants.some(p => p.teamName === teamId || (p.username && p.username.includes(`(${teamId})`)));

                    if (teamTaken) {
                        socket.emit('room_error', `The team ${teamId} is already taken!`);
                        return;
                    }

                    room.participants.push({ username, isCreator: false, avatar, budget: 100, teamName: teamId });
                    await room.save();
                }
            }

            socket.join(roomCode);
            // Send initial state
            io.to(roomCode).emit('room_data', room);
        } catch (err) {
            console.error(err);
        }
    });

    // Creator Controls: Update Timer
    socket.on('update_timer', async ({ roomCode, timer }) => {
        await Room.findOneAndUpdate({ roomCode }, { timerPreference: timer });
        const room = await Room.findOne({ roomCode });
        io.to(roomCode).emit('room_data', room);
    });

    // Creator Controls: Remove Player
    socket.on('remove_player', async ({ roomCode, playerId }) => {
        const room = await Room.findOne({ roomCode });
        if (room) {
            // Allow removing if auction hasn't started OR if the player is upcoming (not current/sold)
            // finding index of player
            const pIndex = room.playersPool.findIndex(p => p.id === playerId);

            // Only allow if player is valid and is "upcoming" (active index < player index)
            // OR if auction not started yet
            if (pIndex !== -1 && (!room.isAuctionStarted || pIndex > room.currentPlayerIndex)) {
                room.playersPool = room.playersPool.filter(p => p.id !== playerId);
                await room.save();
                io.to(roomCode).emit('room_data', room);
            }
        }
    });


    // Start Auction
    socket.on('start_auction', async ({ roomCode }) => {
        try {
            console.log(`Starting auction for room: ${roomCode}`);
            const room = await Room.findOne({ roomCode });

            if (room) {
                // Reset state for a fresh start or restart
                room.isAuctionStarted = true;
                room.currentPlayerIndex = 0;

                // Shuffle players and reset sold status for a fresh game
                room.playersPool = shuffleArray(room.playersPool);
                room.playersPool.forEach(p => p.isSold = false); // Ensure clean slate

                await room.save();

                io.to(roomCode).emit('auction_started', room);
                console.log('Auction started event emitted');

                // Stop any existing timers
                stopTimer(roomCode);
                startTimerLoop(roomCode);
            }
        } catch (e) {
            console.error("Error starting auction:", e);
        }
    });

    // Pause Auction
    socket.on('pause_auction', async ({ roomCode }) => {
        const room = await Room.findOne({ roomCode });
        if (room) {
            if (activeAuctions.has(roomCode)) {
                const { timeLeft } = activeAuctions.get(roomCode);
                room.timeLeft = timeLeft;
            }
            room.isPaused = true;
            stopTimer(roomCode); // Stop the timer loop
            await room.save();
            io.to(roomCode).emit('auction_paused', room);
        }
    });

    // Resume Auction
    // Resume Auction
    socket.on('resume_auction', async ({ roomCode }) => {
        const room = await Room.findOne({ roomCode });
        if (room) {
            room.isPaused = false;
            await room.save();
            io.to(roomCode).emit('auction_resumed', room);
            // Resume timer if not sold yet
            if (!room.playersPool[room.currentPlayerIndex]?.isSold) {
                startTimerLoop(roomCode, room.timeLeft);
            }
        }
    });

    // End Auction manually
    socket.on('end_auction', async ({ roomCode }) => {
        const room = await Room.findOne({ roomCode });
        if (room) {
            room.isAuctionStarted = false;
            room.isPaused = false;
            stopTimer(roomCode);

            // Emit final state before deletion so clients can show summary
            io.to(roomCode).emit('auction_ended', room);

            // Delete the room so it cannot be accessed again
            await Room.deleteOne({ roomCode });
            console.log(`Room ${roomCode} deleted after auction end.`);
        }
    });

    // Place Bid
    socket.on('place_bid', async ({ roomCode, username, amount }) => {
        try {
            const room = await Room.findOne({ roomCode });
            if (!room) return;

            // Prevent bidding if paused
            if (room.isPaused) return;

            const participant = room.participants.find(p => p.username === username);
            if (!participant || participant.budget < amount) return;

            if (room.highestBidder === username) return;

            if (amount > room.currentBid || (room.highestBidder === null && amount >= room.currentBid)) {
                room.currentBid = amount;
                room.highestBidder = username;
                await room.save();

                io.to(roomCode).emit('bid_update', { currentBid: amount, highestBidder: username });
                resetTimer(roomCode, room.timerPreference);
            }
        } catch (e) {
            console.error("Error placing bid:", e);
        }
    });
});

// Helper: Start/Reset Timer

async function startTimerLoop(roomCode, resumeTime = null) {
    stopTimer(roomCode); // Clear existing

    try {
        const room = await Room.findOne({ roomCode });
        if (!room) return;

        // Check if auction over
        if (room.currentPlayerIndex >= room.playersPool.length) {
            io.to(roomCode).emit('auction_ended');
            console.log("Auction Ended");
            return;
        }

        const currentPlayer = room.playersPool[room.currentPlayerIndex];

        // Safety check if player is somehow undefined
        if (!currentPlayer) {
            console.error(`Error: Player at index ${room.currentPlayerIndex} is undefined!`);
            return;
        }

        if (currentPlayer.isSold) {
            // Logic to skip sold players could go here
        }

        console.log(`Starting round for ${currentPlayer.name}`);

        // Set initial bid state for new player
        if (room.highestBidder === null) {
            // Reset/Init current bid to base price
            if (room.currentBid === 0 || room.currentBid < currentPlayer.basePrice) {
                room.currentBid = currentPlayer.basePrice;
                // We need to save this initial state
                await Room.updateOne({ roomCode }, { $set: { currentBid: currentPlayer.basePrice } });
            }
        }

        // Broadcast new player (or current status)
        io.to(roomCode).emit('new_player', {
            player: currentPlayer,
            currentBid: room.currentBid || currentPlayer.basePrice,
            highestBidder: room.highestBidder
        });

        // Use resumeTime if valid (and strictly positive), otherwise default preference
        let timeLeft = (resumeTime !== null && resumeTime > 0) ? resumeTime : room.timerPreference;
        io.to(roomCode).emit('timer_update', timeLeft);

        const intervalId = setInterval(async () => {
            timeLeft--;
            io.to(roomCode).emit('timer_update', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(intervalId);
                await resolveRound(roomCode);
            }
        }, 1000);

        activeAuctions.set(roomCode, { intervalId, timeLeft }); // Store timeLeft ref (though primitive value won't update in map automatically, we don't read it back from map for pausing really, wait... we DO need it)

        // We need to update the map entry on every tick if we want accurate pause? 
        // No, `activeAuctions.get(roomCode).timeLeft` will remain static unless we update it.
        // Better approach: Store the START timestamp and calculate diff? Or just existing Interval approach.
        // For simplicity in this `setInterval` structure, we should update the map's timeLeft.

        // Actually, let's update the map inside the interval
        activeAuctions.set(roomCode, { intervalId, timeLeft });

        // Updating the interval to update the map value
        clearInterval(intervalId); // Stop the one we just made? No wait.

        // Let's rewrite the interval slightly to update the map
        const newIntervalId = setInterval(async () => {
            timeLeft--;
            // Update the map so pause can read it
            if (activeAuctions.has(roomCode)) {
                activeAuctions.get(roomCode).timeLeft = timeLeft;
            }

            io.to(roomCode).emit('timer_update', timeLeft);

            if (timeLeft <= 0) {
                clearInterval(newIntervalId);
                activeAuctions.delete(roomCode);
                await resolveRound(roomCode);
            }
        }, 1000);

        activeAuctions.set(roomCode, { intervalId: newIntervalId, timeLeft });

    } catch (err) {
        console.error("Timer Loop Error:", err);
    }
}

function stopTimer(roomCode) {
    if (activeAuctions.has(roomCode)) {
        const { intervalId } = activeAuctions.get(roomCode);
        clearInterval(intervalId);
        activeAuctions.delete(roomCode);
    }
}

function resetTimer(roomCode, duration) {
    if (activeAuctions.has(roomCode)) {
        const { intervalId } = activeAuctions.get(roomCode);
        clearInterval(intervalId);
    }

    let timeLeft = duration;
    io.to(roomCode).emit('timer_update', timeLeft);

    const intervalId = setInterval(async () => {
        timeLeft--;
        io.to(roomCode).emit('timer_update', timeLeft);

        if (timeLeft <= 0) {
            clearInterval(intervalId);
            await resolveRound(roomCode);
        }
    }, 1000);

    activeAuctions.set(roomCode, { intervalId, timeLeft });
}

async function resolveRound(roomCode) {
    try {
        const room = await Room.findOne({ roomCode });
        if (!room) return;

        const playerIndex = room.currentPlayerIndex;
        const player = room.playersPool[playerIndex];

        if (!player) {
            console.error(`ResolveRound Error: Player at index ${playerIndex} not found.`);
            return;
        }

        const winner = room.highestBidder;
        const finalPrice = room.currentBid;

        let resultMsg = "";

        if (winner) {
            player.isSold = true;
            player.soldTo = winner;
            player.soldPrice = finalPrice;
            room.auctionHistory.push(player);

            const buyerArrIndex = room.participants.findIndex(p => p.username === winner);
            if (buyerArrIndex !== -1) {
                room.participants[buyerArrIndex].budget -= finalPrice;
            }

            resultMsg = `SOLD to ${winner} for ${finalPrice} Cr`;
        } else {
            player.isSold = false;
            resultMsg = "UNSOLD";
        }

        // Explicitly update the player in the pool array
        room.playersPool[playerIndex] = player;
        room.markModified('playersPool'); // IMPORTANT for mixed types/subdocs
        room.markModified('participants');

        room.currentPlayerIndex += 1;
        room.currentBid = 0;
        room.highestBidder = null;

        await room.save();
        console.log(`Round resolved: ${resultMsg}`);

        io.to(roomCode).emit('player_result', {
            player,
            winner,
            price: finalPrice,
            message: resultMsg,
            updatedParticipants: room.participants
        });

        setTimeout(() => {
            startTimerLoop(roomCode);
        }, 1000); // Reduced to 1s as per user request

    } catch (err) {
        console.error("Resolve Round Error:", err);
    }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

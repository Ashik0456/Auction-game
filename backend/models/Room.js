import mongoose from 'mongoose';

const PlayerSchema = new mongoose.Schema({
  id: String, // Unique ID for React keys
  name: String,
  role: String, // Batsman, Bowler, All-Rounder, Wicket Keeper
  image: String,
  basePrice: Number,
  isSold: { type: Boolean, default: false },
  soldTo: { type: String, default: null }, // Team Name / Username
  soldPrice: { type: Number, default: 0 },
});

const ParticipantSchema = new mongoose.Schema({
  username: String,
  isCreator: { type: Boolean, default: false },
  budget: { type: Number, default: 100 }, // 100 Cr default
  avatar: String,
  teamName: String, // Or just use username as team name
});

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  creatorName: String,
  timerPreference: { type: Number, default: 15 }, // 10 or 15
  participants: [ParticipantSchema],
  playersPool: [PlayerSchema],
  auctionHistory: [PlayerSchema], // Explicitly storing sold players here as requested

  // Auction State
  isAuctionStarted: { type: Boolean, default: false },
  currentPlayerIndex: { type: Number, default: 0 }, // Pointer to playersPool
  currentBid: { type: Number, default: 0 },
  highestBidder: { type: String, default: null },
  isPaused: { type: Boolean, default: false },
  timeLeft: { type: Number, default: 30 }, // To store remaining time on pause
});

export default mongoose.model('Room', RoomSchema);

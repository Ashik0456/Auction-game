
import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import PlayerCard from '../components/PlayerCard';
import API_URL from '../config/api';

let socket;

export default function AuctionRoom() {
    const { roomCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const username = location.state?.username || 'Guest';

    const [room, setRoom] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [activeTab, setActiveTab] = useState('arena'); // arena, squads, sold, unsold, upcoming
    const [logs, setLogs] = useState([]);
    const [roundResult, setRoundResult] = useState(null);
    const [showSummary, setShowSummary] = useState(false);

    // Auto-scroll logs
    const logsEndRef = useRef(null);
    const prevAuctionStarted = useRef(false); // Track previous auction state

    const scrollToBottom = () => logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [logs]);

    const addLog = (msg) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Auto-switch to Arena when auction starts
    useEffect(() => {
        if (room?.isAuctionStarted && !prevAuctionStarted.current) {
            setActiveTab('arena');
        }
        if (room) {
            prevAuctionStarted.current = room.isAuctionStarted;
        }
    }, [room?.isAuctionStarted]);

    useEffect(() => {
        socket = io(API_URL);

        socket.on('connect', () => {
            setIsConnected(true);
            addLog('Connected to server');
            socket.emit('join_room', { username, roomCode, teamId: location.state?.teamId, create: location.state?.create });
        });

        socket.on('room_error', (msg) => {
            alert(msg);
            navigate('/');
        });

        socket.on('disconnect', () => setIsConnected(false));

        socket.on('room_data', (data) => {
            setRoom(data);
            addLog('Room data synced');
        });

        socket.on('auction_started', (data) => {
            setRoom(data);
            setActiveTab('arena');
            addLog('Auction has STARTED!');
            setRoundResult(null);
        });

        socket.on('new_player', (data) => {
            addLog(`Next player: ${data.player.name}`);
            setRoundResult(null);
            setRoom(prev => {
                if (!prev) return prev;
                const idx = prev.playersPool.findIndex(p => p.id === data.player.id);
                return {
                    ...prev,
                    currentPlayerIndex: idx,
                    currentBid: data.currentBid,
                    highestBidder: data.highestBidder
                };
            });
        });

        socket.on('timer_update', (t) => setTimeLeft(t));

        socket.on('bid_update', ({ currentBid, highestBidder }) => {
            setRoom(prev => ({ ...prev, currentBid, highestBidder }));
            addLog(`Bid raised to ${currentBid} Cr by ${highestBidder}`);
        });

        socket.on('player_result', ({ player, winner, price, message, updatedParticipants }) => {
            addLog(message);
            setRoundResult({ player, winner, price, message });

            setRoom(prev => {
                const newPool = [...prev.playersPool];
                const idx = newPool.findIndex(p => p.id === player.id);
                if (idx !== -1) {
                    newPool[idx] = { ...player, isSold: !!winner, soldTo: winner, soldPrice: price };
                }
                return {
                    ...prev,
                    playersPool: newPool,
                    participants: updatedParticipants,
                    highestBidder: winner,
                    currentBid: price,
                };
            });
        });

        socket.on('auction_paused', (updatedRoom) => {
            setRoom(updatedRoom);
            addLog('Auction Paused by Host');
        });

        socket.on('auction_resumed', (updatedRoom) => {
            setRoom(updatedRoom);
            addLog('Auction Resumed');
        });

        socket.on('auction_ended', (updatedRoom) => {
            setRoom(updatedRoom);
            addLog('Auction Ended manually!');
            setShowSummary(true);
        });

        return () => socket.disconnect();
    }, [roomCode, username]);



    // Optimized bid handler with debouncing for faster response
    const bidTimeoutRef = useRef(null);
    const handleBid = () => {
        if (!room || !canBid) return;

        // Clear any pending bid timeout
        if (bidTimeoutRef.current) {
            clearTimeout(bidTimeoutRef.current);
        }

        // Immediate UI feedback - optimistic update
        const newBid = room.currentBid + 0.5;
        setRoom(prev => ({ ...prev, currentBid: newBid, highestBidder: username }));

        // Send to server
        socket.emit('place_bid', { roomCode, username, amount: newBid });
    };

    if (!room) return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0b0e11] text-white font-bold p-4 text-center">
            <div className="w-16 h-16 border-4 border-t-blue-500 border-slate-700 rounded-full animate-spin mb-6"></div>
            <div className="text-2xl mb-2 font-black tracking-tight">CONNECTING TO ARENA</div>
            <div className="text-sm text-slate-500 font-mono">Room: {roomCode}</div>
        </div>
    );

    const handleStart = () => {
        socket.emit('start_auction', { roomCode });
    };

    const handlePause = () => {
        socket.emit('pause_auction', { roomCode });
    };

    const handleResume = () => {
        socket.emit('resume_auction', { roomCode });
    };

    const handleEndAuction = () => {
        if (window.confirm("Are you sure you want to forcibly END the auction?")) {
            socket.emit('end_auction', { roomCode });
        }
    };

    const currentPlayer = room.isAuctionStarted && room.currentPlayerIndex >= 0 && room.currentPlayerIndex < room.playersPool.length
        ? room.playersPool[room.currentPlayerIndex]
        : null;

    const myParticipant = room.participants.find(p => p.username === username);
    const myBudget = myParticipant?.budget || 0;
    const isCreator = myParticipant?.isCreator;
    const canBid = room.isAuctionStarted && currentPlayer && !currentPlayer.isSold && myBudget >= (room.currentBid + 0.5) && room.highestBidder !== username;

    // Derived Lists - Fixed unsold filter to exclude current bidding player
    const soldPlayers = room.playersPool?.filter(p => p.isSold) || [];
    const unsoldPlayers = room.playersPool?.filter((p, idx) => {
        // Exclude sold players
        if (p.isSold) return false;
        // Exclude current player being bid on
        if (p.id === currentPlayer?.id) return false;
        // Exclude upcoming players
        if (idx >= room.currentPlayerIndex) return false;
        // Include only past players that weren't sold
        return idx < room.currentPlayerIndex;
    }) || [];
    const upcomingPlayers = room.playersPool?.filter((p, idx) => idx > room.currentPlayerIndex) || [];

    // Helper to get a team's squad
    const getTeamSquad = (teamName) => soldPlayers.filter(p => p.soldTo === teamName);

    const handleUpdateTimer = (e) => {
        const val = parseInt(e.target.value);
        if (val >= 5 && val < 500) {
            socket.emit('update_timer', { roomCode, timer: val });
        }
    };

    const handleRemovePlayer = (playerId) => {
        if (confirm('Are you sure you want to remove this player?')) {
            socket.emit('remove_player', { roomCode, playerId });
        }
    };

    return (
        <div className="flex h-screen bg-noble-black text-white font-sans overflow-hidden">
            {/* Left Sidebar: Franchise Leaderboard */}
            <div className="w-80 bg-[#1a0b2e] border-r border-pl-pink/20 flex flex-col shadow-2xl z-20 shrink-0">
                <div className="p-5 border-b border-pl-pink/20 bg-[#1a0b2e]">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Auction</span>
                    </div>
                    <div className="flex justify-start items-center gap-3">
                        <h2 className="text-xl font-black italic tracking-tighter text-white">
                            ROOM <span className="text-transparent bg-clip-text bg-gradient-to-r from-pl-purple to-pl-pink">{room.roomCode}</span>
                        </h2>
                        {isCreator && (
                            <button
                                onClick={() => {
                                    const link = `${window.location.origin}/join/${room.roomCode}`;
                                    navigator.clipboard.writeText(link);
                                    alert(`Invite Link Copied: ${link}`);
                                }}
                                className="bg-pl-pink/10 hover:bg-pl-pink/20 text-pl-pink p-1.5 rounded-lg transition-all"
                                title="Copy Invite Link"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {room.participants?.sort((a, b) => b.budget - a.budget).map((p, index) => {
                        const squadCount = getTeamSquad(p.username).length;
                        return (
                            <div key={p.username} className={`p-4 rounded-xl transition-all border relative overflow-hidden group ${p.username === room.highestBidder ? 'bg-gradient-to-r from-pl-purple/20 to-pl-pink/20 border-pl-pink' : 'bg-[#25103f] border-white/5 hover:border-pl-purple/50'}`}>
                                {index === 0 && <div className="absolute top-0 right-0 bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">LEADER</div>}

                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div>
                                        <div className={`font-bold text-sm ${p.username === username ? "text-blue-400" : "text-white"}`}>{p.username.split(' (')[0].substring(0, 18)}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">{p.username.includes('(') ? p.username.split('(')[1].replace(')', '') : 'User'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 uppercase">Purse</div>
                                        <div className="text-sm font-black font-mono text-green-400">₹{p.budget}</div>
                                    </div>
                                </div>

                                {/* Mini Stats */}
                                <div className="flex items-center gap-2 pt-2 border-t border-white/5 relative z-10">
                                    <div className="flex-1 bg-[#0b0e11] rounded px-2 py-1 flex justify-between items-center">
                                        <span className="text-[10px] text-slate-500 uppercase">Players</span>
                                        <span className="text-xs font-bold text-white">{squadCount}</span>
                                    </div>
                                    {p.username === room.highestBidder && (
                                        <div className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse">
                                            BIDDING
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Logs */}
                <div className="h-40 bg-black/40 border-t border-white/5 p-3 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1">
                    {logs.map((l, i) => <div key={i} className="opacity-70 hover:opacity-100 transition-opacity">{l}</div>)}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* Main Center Area */}
            <div className="flex-1 flex flex-col relative bg-[#0b0e11]">
                {/* Navbar */}
                <div className="h-16 flex items-center justify-between px-8 bg-[#141518]/80 backdrop-blur-md border-b border-white/5 z-30">
                    <div className="flex gap-1 bg-[#1e2025] p-1 rounded-lg">
                        {[
                            { id: 'arena', label: 'Arena', icon: '⚡' },
                            { id: 'squads', label: 'Squads', icon: '👥' },
                            { id: 'sold', label: 'Sold', icon: '🔨' },
                            { id: 'unsold', label: 'Unsold', icon: '❌' },
                            { id: 'upcoming', label: 'Upcoming', icon: '📅' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2
                                    ${activeTab === tab.id
                                        ? 'bg-gradient-to-r from-pl-purple to-pl-pink text-white shadow-lg shadow-pl-pink/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                <span>{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        {isCreator && (
                            <div className="flex items-center gap-2 bg-[#1e2025] px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="text-[10px] uppercase font-bold text-slate-500">Timer</span>
                                <input
                                    type="number"
                                    defaultValue={room.timerPreference || 30}
                                    onBlur={handleUpdateTimer}
                                    className="w-12 bg-black border border-white/10 rounded px-1 py-0.5 text-center text-sm font-bold text-white focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-xs font-bold text-slate-600">sec</span>
                                <div className="flex gap-1 ml-1">
                                    {[5, 10, 15, 30].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => socket.emit('update_timer', { roomCode, timer: t })}
                                            className="text-[10px] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded text-slate-400 hover:text-white transition-colors border border-white/5"
                                        >
                                            {t}s
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isCreator && (
                            <div className="flex gap-2">
                                {!room.isAuctionStarted ? (
                                    <button onClick={handleStart} className="px-6 py-2 bg-gradient-to-r from-pl-purple to-pl-pink text-white font-bold rounded-lg shadow-lg hover:brightness-110 transition-all text-sm">
                                        START AUCTION
                                    </button>
                                ) : (
                                    <>
                                        {room.isPaused ? (
                                            <button onClick={handleResume} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 text-xs">
                                                ▶ RESUME
                                            </button>
                                        ) : (
                                            <button onClick={handlePause} className="px-4 py-2 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-500 text-xs">
                                                ⏸ PAUSE
                                            </button>
                                        )}
                                        <button onClick={handleEndAuction} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 text-xs">
                                            ⏹ END
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        {room.isAuctionStarted && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 text-xs font-bold uppercase tracking-wider animate-pulse">
                                Live
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                    {/* Result Overlay */}
                    {roundResult && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in zoom-in duration-300">
                            <div className="text-center">
                                {roundResult.winner ? (
                                    <>
                                        <div className="text-8xl mb-4 animate-bounce">🎉</div>
                                        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pl-purple to-pl-pink mb-2 italic uppercase">SOLD!</h1>
                                        <div className="text-2xl text-white font-bold">{roundResult.player.name}</div>
                                        <div className="text-slate-400 mt-2">Sold to <span className="text-pl-pink font-bold">{roundResult.winner}</span> for <span className="text-green-400 font-bold font-mono text-xl">₹{roundResult.price} Cr</span></div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-8xl mb-4 opacity-50">❌</div>
                                        <h1 className="text-6xl font-black text-slate-600 mb-2 italic uppercase">UNSOLD</h1>
                                        <div className="text-2xl text-slate-500 font-bold">{roundResult.player.name}</div>
                                    </>
                                )}
                                <div className="mt-8 w-64 h-1 bg-slate-800 rounded-full mx-auto overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-pl-purple to-pl-pink animate-[progress_1s_linear_forward]"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'arena' && (
                        room.isAuctionStarted ? (
                            <div className="flex flex-col items-center max-w-4xl mx-auto pt-8 animate-in fade-in slide-in-from-bottom-4">
                                <PlayerCard
                                    player={currentPlayer}
                                    currentBid={room.currentBid}
                                    highestBidder={room.highestBidder}
                                    timeLeft={timeLeft}
                                />
                                <div className="mt-8 w-full max-w-md">
                                    <button
                                        disabled={!canBid || room.isPaused}
                                        onClick={handleBid}
                                        className={`w-full py-5 rounded-2xl font-black text-2xl uppercase tracking-tighter transition-all transform active:scale-95 shadow-2xl relative overflow-hidden group
                                            ${canBid
                                                ? 'bg-gradient-to-r from-pl-purple to-pl-pink text-white hover:brightness-110'
                                                : room.highestBidder === username ? 'bg-pl-purple/20 text-pl-pink border border-pl-pink/50 cursor-default' : 'bg-[#1e2025] text-slate-600 cursor-not-allowed border border-white/5'}
                                        `}
                                    >
                                        <span className="relative z-10">{room.isPaused ? "AUCTION PAUSED" : (canBid ? `BID ₹ ${room.currentBid + 0.5} Cr` : (room.highestBidder === username ? 'YOU ARE LEADING' : 'WAITING...'))}</span>
                                        {canBid && !room.isPaused && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                                    </button>
                                </div>

                                {isCreator && (
                                    <button
                                        onClick={() => handleRemovePlayer(currentPlayer.id)}
                                        className="mt-4 text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest border border-red-500/20 hover:bg-red-500/10 px-4 py-2 rounded-lg transition-all"
                                    >
                                        ⚠️ Skip This Player
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center pb-20">
                                <div className="w-24 h-24 bg-[#1e2025] rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                                    <span className="text-4xl">🏆</span>
                                </div>
                                <h2 className="text-4xl font-black text-white mb-2 tracking-tight">WELCOME TO THE AUCTION</h2>
                                <p className="text-slate-500 max-w-sm mx-auto">Wait for the host to start the proceedings. Check the "Squads" tab to see your opponents.</p>
                            </div>
                        )
                    )}

                    {activeTab === 'squads' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                            {room.participants.map(p => {
                                const squad = getTeamSquad(p.username);
                                return (
                                    <div key={p.username} className="bg-[#141518] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                        <div className="p-4 bg-[#1e2025] border-b border-white/5 flex justify-between items-center">
                                            <div className="font-bold text-lg text-white">{p.username.split(' (')[0]}</div>
                                            <div className="text-xs font-bold text-green-400 font-mono bg-green-900/20 px-2 py-1 rounded">₹{p.budget} Cr Left</div>
                                        </div>
                                        <div className="p-4 min-h-[200px]">
                                            <div className="text-xs font-bold text-slate-500 uppercase mb-3">SQUAD ({squad.length})</div>
                                            {squad.length > 0 ? (
                                                <div className="space-y-2">
                                                    {squad.map(player => (
                                                        <div key={player.id} className="flex justify-between items-center text-sm p-2 bg-[#0b0e11] rounded border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <img src={player.image} className="w-6 h-6 rounded-full bg-slate-700 object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://www.iplt20.com/assets/images/default-headshot.png'; }} />
                                                                <span className="text-slate-300 font-medium">{player.name}</span>
                                                            </div>
                                                            <span className="font-mono text-xs text-slate-500">₹{player.soldPrice}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-600 text-sm py-8 italic">No players bought yet</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {(activeTab === 'sold' || activeTab === 'unsold' || activeTab === 'upcoming') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
                            {(activeTab === 'sold' ? soldPlayers : activeTab === 'unsold' ? unsoldPlayers : upcomingPlayers).map(player => (
                                <div key={player.id} className="bg-[#1a0b2e] rounded-xl overflow-hidden border border-pl-pink/20 group hover:border-pl-pink hover:shadow-[0_0_20px_rgba(237,30,121,0.3)] hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="h-32 bg-gradient-to-b from-[#25103f] to-[#1a0b2e] relative overflow-hidden flex items-center justify-center">
                                        {/* Background Pattern */}
                                        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

                                        <img src={player.image} className="h-full object-contain group-hover:scale-110 transition-transform duration-500 relative z-10" onError={(e) => { e.target.onerror = null; e.target.src = 'https://www.iplt20.com/assets/images/default-headshot.png'; }} />
                                        {activeTab === 'sold' && <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded z-20 shadow-lg">SOLD</div>}
                                    </div>
                                    <div className="p-4 relative">
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pl-pink/20 to-transparent"></div>
                                        <div className="text-[10px] text-pl-pink/80 font-bold uppercase tracking-widest mb-1">{player.role}</div>
                                        <div className="font-bold text-white text-lg leading-tight mb-3 group-hover:text-pl-pink transition-colors">{player.name}</div>
                                        <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                            <span className="text-xs text-slate-400 font-medium">Price</span>
                                            <span className="font-mono font-black text-white text-xl group-hover:text-pl-pink transition-colors">₹{player.soldPrice || player.basePrice} <span className="text-sm">Cr</span></span>
                                        </div>
                                        {player.soldTo && <div className="mt-2 text-[10px] text-slate-400 text-right uppercase tracking-wider">Owner: <span className="text-white font-bold">{player.soldTo.split(' (')[0]}</span></div>}
                                    </div>

                                    {/* Remove Player Button for Creator */}
                                    {isCreator && activeTab === 'upcoming' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemovePlayer(player.id); }}
                                            className="absolute top-2 right-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove Player from Auction"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                            {(activeTab === 'sold' ? soldPlayers : activeTab === 'unsold' ? unsoldPlayers : upcomingPlayers).length === 0 && (
                                <div className="col-span-full text-center py-20 text-slate-600 font-bold uppercase tracking-widest">
                                    No players in this category
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
            {/* Auction Summary Overlay */}
            {showSummary && room && (
                <div className="fixed inset-0 z-[100] bg-[#0b0e11] overflow-y-auto animate-in fade-in duration-500">
                    <div className="max-w-7xl mx-auto p-8">
                        <div className="text-center mb-12">
                            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pl-purple to-pl-pink mb-4 italic uppercase">
                                Auction Results
                            </h1>
                            <p className="text-slate-400 uppercase tracking-widest font-bold">Summary of All Teams</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {room.participants.filter(p => !p.isCreator || p.role !== 'host').map(team => {
                                const squad = getTeamSquad(team.username);
                                const totalSpent = squad.reduce((sum, p) => sum + p.soldPrice, 0);

                                return (
                                    <div key={team.username} className="bg-[#1a0b2e] rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                                        <div className="p-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${team.username}`} className="w-12 h-12 rounded-full bg-white/10" alt="" />
                                                <div>
                                                    <h3 className="font-bold text-white text-xl">{team.username.split(' (')[0]}</h3>
                                                    <p className="text-xs text-green-400 font-mono font-bold mt-1">Spent: ₹{totalSpent} Cr</p>
                                                </div>
                                            </div>
                                            <div className="text-right bg-black/20 px-3 py-1 rounded-lg">
                                                <div className="text-3xl font-black text-white">{squad.length}</div>
                                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Players</div>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 bg-[#141518]">
                                            {squad.length === 0 ? (
                                                <div className="text-slate-600 text-center text-sm py-8 italic">No players purchased</div>
                                            ) : (
                                                <ul className="space-y-3">
                                                    {squad.map(p => (
                                                        <li key={p.id} className="flex justify-between items-center text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                            <div>
                                                                <span className="text-slate-300 font-bold block">{p.name}</span>
                                                                <span className="text-[10px] text-slate-500 uppercase">{p.role}</span>
                                                            </div>
                                                            <span className="text-pl-pink font-mono font-bold text-lg">₹{p.soldPrice}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="text-center mt-12 mb-8">
                            <button onClick={() => navigate('/')} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-red-500/25">
                                Exit to Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 bg-[#0b0e11]/80 backdrop-blur-sm border-t border-white/5 py-3 px-6 z-10">
                <div className="text-center">
                    <p className="text-xs text-slate-500">
                        Developed with <span className="text-red-500 animate-pulse">❤</span> by{' '}
                        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-pl-purple to-pl-pink">Muhamed Ashik</span>
                    </p>
                </div>
            </footer>
        </div >
    );
}

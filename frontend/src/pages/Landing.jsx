import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API_URL from '../config/api';

const TEAMS = [
    { id: 'CSK', name: 'Chennai Super Kings', color: 'from-yellow-400 to-yellow-600' },
    { id: 'MI', name: 'Mumbai Indians', color: 'from-blue-600 to-blue-800' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', color: 'from-red-600 to-black' },
    { id: 'KKR', name: 'Kolkata Knight Riders', color: 'from-purple-700 to-purple-900' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', color: 'from-orange-500 to-orange-700' },
    { id: 'RR', name: 'Rajasthan Royals', color: 'from-pink-600 to-blue-800' },
    { id: 'DC', name: 'Delhi Capitals', color: 'from-blue-500 to-red-500' },
    { id: 'PBKS', name: 'Punjab Kings', color: 'from-red-500 to-gray-300' },
    { id: 'LSG', name: 'Lucknow Super Giants', color: 'from-cyan-500 to-blue-600' },
    { id: 'GT', name: 'Gujarat Titans', color: 'from-slate-700 to-yellow-400' },
];

export default function Landing() {
    const navigate = useNavigate();
    const { inviteCode } = useParams();

    const [view, setView] = useState('join'); // 'join' or 'host'
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [takenTeams, setTakenTeams] = useState([]);

    useEffect(() => {
        if (inviteCode) {
            setRoomCode(inviteCode);
            setView('join');
        }
    }, [inviteCode]);

    useEffect(() => {
        if (view === 'join' && roomCode.length > 2) {
            const timer = setTimeout(() => {
                fetch(`${API_URL}/api/room/${roomCode}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.exists) {
                            setTakenTeams(data.takenTeams);
                        } else {
                            setTakenTeams([]);
                        }
                    })
                    .catch(() => setTakenTeams([]));
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setTakenTeams([]);
        }
    }, [roomCode, view]);

    const handleJoin = (e) => {
        e.preventDefault();

        if (!name.trim()) {
            alert("Please enter your name.");
            return;
        }
        if (!roomCode.trim()) {
            alert("Please enter a Room ID.");
            return;
        }
        if (!selectedTeam) {
            alert("Please select a team franchise.");
            return;
        }

        // Combine name and team for the backend
        const fullName = `${name} (${selectedTeam.id})`;
        navigate(`/room/${roomCode}`, { state: { username: fullName, teamId: selectedTeam.id, create: view === 'host' } });
    };

    return (
        <div className="min-h-screen bg-noble-black text-white font-sans selection:bg-pl-pink selection:text-white flex items-center justify-center p-4 relative overflow-hidden">

            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pl-purple/20 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pl-pink/20 blur-[120px] rounded-full"></div>
            </div>

            <div className="w-full max-w-5xl z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

                {/* Left Side: Hero Text */}
                <div className="space-y-6 text-center md:text-left">
                    <div className="inline-block px-4 py-1.5 rounded-full border border-pl-pink/20 bg-pl-purple/10 backdrop-blur-md text-sm font-medium text-pl-pink mb-2">
                        🔴 LIVE AUCTION PLATFORM
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter leading-tight">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pl-purple via-fuchsia-500 to-pl-pink">NEXT GEN</span><br />
                        SPORTS AUCTION
                    </h1>
                    <p className="text-lg text-slate-400 max-w-md mx-auto md:mx-0 leading-relaxed">
                        Experience the thrill of the auction table. Bid in real-time, build your dream squad, and dominate the league.
                    </p>

                    <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-bold text-slate-300">Real-time Socket.io</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm font-bold text-slate-300">Live Bidding</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Action Card */}
                <div className="bg-[#1a0b2e]/60 backdrop-blur-xl border border-pl-pink/20 p-1 rounded-3xl shadow-2xl">
                    <div className="bg-noble-black/80 rounded-[20px] p-6 md:p-8 border border-pl-purple/20">

                        {/* Tabs */}
                        <div className="flex gap-2 mb-8 bg-slate-800/50 p-1 rounded-xl">
                            <button
                                onClick={() => !inviteCode && setView('join')}
                                disabled={!!inviteCode}
                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all duration-300 ${view === 'join' ? 'bg-gradient-to-r from-pl-purple to-pl-pink text-white shadow-lg shadow-pl-pink/20' : 'text-slate-400 hover:text-white'} ${inviteCode ? 'cursor-not-allowed opacity-80' : ''}`}
                            >
                                JOIN ROOM
                            </button>
                            <button
                                onClick={() => !inviteCode && setView('host')}
                                disabled={!!inviteCode}
                                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all duration-300 ${view === 'host' ? 'bg-gradient-to-r from-pl-purple to-pl-pink text-white shadow-lg shadow-pl-pink/20' : 'text-slate-400 hover:text-white'} ${inviteCode ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                                CREATE ROOM
                            </button>
                        </div>

                        {view === 'join' ? (
                            <form onSubmit={handleJoin} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Your Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-[#0f0518] border border-pl-purple/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pl-pink focus:ring-1 focus:ring-pl-pink transition-all font-medium"
                                        placeholder="Enter your display name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Room ID</label>
                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={e => setRoomCode(e.target.value)}
                                        readOnly={!!inviteCode}
                                        className={`w-full bg-[#0f0518] border border-pl-purple/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pl-pink focus:ring-1 focus:ring-pl-pink transition-all font-mono text-lg uppercase placeholder:normal-case ${inviteCode ? 'text-slate-400 cursor-not-allowed' : ''}`}
                                        placeholder="e.g. IPL2025"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Select Franchise</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {TEAMS.map(team => {
                                            const isTaken = takenTeams.includes(team.id);
                                            return (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    disabled={isTaken}
                                                    onClick={() => !isTaken && setSelectedTeam(team)}
                                                    className={`aspect-square rounded-full flex items-center justify-center border-2 transition-all relative group
                                                        ${selectedTeam?.id === team.id
                                                            ? 'border-pl-pink bg-pl-purple/20 scale-110 shadow-lg z-10'
                                                            : (isTaken
                                                                ? 'border-transparent bg-slate-900 opacity-20 cursor-not-allowed grayscale'
                                                                : 'border-transparent bg-[#1e2025]/50 hover:bg-[#1e2025] hover:scale-105')
                                                        }
                                                    `}
                                                    title={isTaken ? `${team.name} (Taken)` : team.name}
                                                >
                                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${team.color} opacity-80 group-hover:opacity-100 flex items-center justify-center text-[8px] font-black text-white`}>
                                                        {team.id}
                                                    </div>
                                                    {selectedTeam?.id === team.id && (
                                                        <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>
                                                    )}
                                                    {isTaken && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-20">
                                                            <div className="w-full h-[2px] bg-red-500 rotate-45 absolute"></div>
                                                            <div className="w-full h-[2px] bg-red-500 -rotate-45 absolute"></div>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-right text-xs text-slate-500 mt-2 h-4">
                                        {selectedTeam ? selectedTeam.name : 'Choose a team'}
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-pl-purple to-pl-pink hover:brightness-110 rounded-xl font-bold text-lg shadow-lg shadow-pl-pink/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    ENTER AUCTION
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleJoin} className="space-y-5 animate-in fade-in duration-300">
                                <div className="p-4 bg-pl-pink/10 border border-pl-pink/20 rounded-xl mb-4 text-center">
                                    <h3 className="text-pl-pink font-bold mb-1">Create New Auction</h3>
                                    <p className="text-xs text-slate-400">You will be the Host/Admin of this room.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Creator Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full bg-[#0f0518] border border-pl-purple/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pl-pink focus:ring-1 focus:ring-pl-pink transition-all font-medium"
                                        placeholder="Enter your name (e.g. Host/Admin)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">New Room ID</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={roomCode}
                                            onChange={e => setRoomCode(e.target.value)}
                                            className="w-full bg-[#0f0518] border border-pl-purple/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pl-pink focus:ring-1 focus:ring-pl-pink transition-all font-mono text-lg uppercase placeholder:normal-case"
                                            placeholder="Create a code (e.g. MEGA2026)"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setRoomCode(`IPL${Math.floor(Math.random() * 10000)}`)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded text-slate-300 transition-colors"
                                        >
                                            Auto-Generate
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Your Team (Optional)</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {TEAMS.map(team => (
                                            <button
                                                key={team.id}
                                                type="button"
                                                onClick={() => setSelectedTeam(team)}
                                                className={`aspect-square rounded-full flex items-center justify-center border-2 transition-all relative group
                                                    ${selectedTeam?.id === team.id
                                                        ? 'border-pl-pink bg-pl-purple/20 scale-110 shadow-lg z-10'
                                                        : 'border-transparent bg-[#1e2025]/50 hover:bg-[#1e2025] hover:scale-105'
                                                    }
                                                `}
                                                title={team.name}
                                            >
                                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${team.color} opacity-80 group-hover:opacity-100 flex items-center justify-center text-[8px] font-black text-white`}>
                                                    {team.id}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-right text-xs text-slate-500 mt-2 h-4">
                                        {selectedTeam ? selectedTeam.name : 'Playing as Auctioneer?'}
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-gradient-to-r from-pl-purple to-pl-pink hover:brightness-110 rounded-xl font-bold text-lg shadow-lg shadow-pl-pink/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    INITIALIZE AUCTION
                                </button>
                            </form>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

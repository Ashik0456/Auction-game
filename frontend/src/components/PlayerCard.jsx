export default function PlayerCard({ player, currentBid, highestBidder, timeLeft }) {
    if (!player) return (
        <div className="flex flex-col items-center justify-center p-12 text-center animate-pulse gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-pl-pink animate-spin"></div>
            <div className="text-xl font-bold text-slate-500 tracking-widest uppercase">Initializing Stream...</div>
        </div>
    );

    return (
        <div className="relative w-full max-w-sm mx-auto bg-[#1a0b2e] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(237,30,121,0.2)] border border-pl-pink/20 group">

            {/* Live Indicator Timer */}
            <div className="absolute top-4 right-4 z-20 flex flex-col items-end pointer-events-none">
                {timeLeft !== null && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md border shadow-lg transition-all duration-300 ${timeLeft <= 5 ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-black/40 border-green-500/50 text-green-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-green-500 animate-ping'}`}></div>
                        <span className="font-mono font-bold text-xl">{timeLeft}s</span>
                    </div>
                )}
            </div>

            {/* Role Badge */}
            <div className="absolute top-4 left-4 z-20">
                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg shadow-lg">
                    {player.role || 'Player'}
                </span>
            </div>

            {/* Image Section */}
            <div className="h-64 relative flex items-end justify-center overflow-hidden bg-gradient-to-b from-[#25103f] to-[#1a0b2e] pt-6">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

                {/* Glow Effect */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-pl-pink/20 blur-[60px] rounded-full group-hover:bg-pl-pink/30 transition-all duration-500"></div>

                {/* Player Image */}
                <img
                    src={player.image}
                    alt={player.name}
                    className="relative z-10 h-full w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-2"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://www.iplt20.com/assets/images/default-headshot.png';
                    }}
                />

                {/* Gradient Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#1a0b2e] via-[#1a0b2e]/90 to-transparent z-20"></div>
            </div>

            {/* Content Section */}
            <div className="relative z-20 px-6 pb-6 -mt-8">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg mb-1">{player.name}</h2>
                    <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">IPL Auction 2026</p>
                </div>

                {/* Bid Stats Card */}
                <div className="bg-[#0b0e11] rounded-2xl p-1 border border-white/5 shadow-inner">
                    <div className="bg-[#1a0b2e] rounded-xl p-4 border border-pl-purple/20 flex flex-col gap-4">

                        <div className="flex justify-between items-end border-b border-dashed border-white/10 pb-4">
                            <div className="text-left">
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Base Price</p>
                                <p className="text-lg font-bold text-slate-400 font-mono">₹{player.basePrice} Cr</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-pl-pink uppercase font-bold tracking-wider mb-1 animate-pulse">Current Bid</p>
                                <p className="text-4xl font-black text-white font-mono tracking-tighter bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                                    {currentBid} <span className="text-sm text-slate-500 align-top mt-1 inline-block">Cr</span>
                                </p>
                            </div>
                        </div>

                        {/* Bidder Info */}
                        <div className={`rounded-lg p-3 flex items-center justify-between transition-colors duration-300 ${highestBidder ? 'bg-pl-purple/10 border border-pl-pink/20' : 'bg-slate-800/30 border border-white/5'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${highestBidder ? 'bg-pl-pink animate-pulse' : 'bg-slate-600'}`}></div>
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    {highestBidder ? 'Winning' : 'Status'}
                                </span>
                            </div>
                            <span className={`font-bold ${highestBidder ? 'text-pl-pink' : 'text-slate-500'}`}>
                                {highestBidder || 'No Bids'}
                            </span>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

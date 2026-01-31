import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import AuctionRoom from './pages/AuctionRoom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join/:inviteCode" element={<Landing />} />
        <Route path="/room/:roomCode" element={<AuctionRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

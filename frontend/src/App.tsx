import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import GameResult from './pages/GameResult';


import CreateGame from './pages/CreateGame';

function App() {
    return (
        <ToastProvider>
            <div className="min-h-screen bg-surface-0 flex flex-col">
                <Navbar />
                <main className="flex-1 flex flex-col">
                    <AnimatePresence mode="wait">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/lobby" element={<Lobby />} />
                            <Route path="/create" element={<CreateGame />} />
                            <Route path="/game/:gameId" element={<Game />} />
                            <Route path="/game/:gameId/result" element={<GameResult />} />

                        </Routes>
                    </AnimatePresence>
                </main>
            </div>
        </ToastProvider>
    );
}

export default App;

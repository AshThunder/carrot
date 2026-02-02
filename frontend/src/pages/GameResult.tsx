import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import Icon from '../components/Icon';
import { CARROT_GAME_ADDRESS, CARROT_GAME_ABI } from '../lib/abis';
import { useMemo } from 'react';

function GameResult() {
    const { gameId } = useParams();
    const { address } = useAccount();

    const { data: gameData } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'getGame',
        args: gameId ? [BigInt(gameId)] : undefined,
    });

    const game = useMemo(() => {
        if (!gameData) return null;
        return gameData as any;
    }, [gameData]);

    // Derive winner and carrot location from booleans for maximum reliability
    const { isWinner, carrotInA, carrotInB, potWon, opponent } = useMemo(() => {
        if (!game) return { isWinner: false, carrotInA: false, carrotInB: false, potWon: '0', opponent: '' };

        const hadCarrot = game.playerAHasCarrotRevealed;
        const tookBox = game.playerBDecision;

        // Final positions:
        // A has carrot + B kept (F) = A has it
        // A has carrot + B took (T) = B has it
        // A empty + B kept (F) = B has it
        // A empty + B took (T) = A has it
        const inA = (hadCarrot && !tookBox) || (!hadCarrot && tookBox);
        const inB = !inA;

        const isPlayerA = address === game.playerA;
        const isPlayerB = address === game.playerB;

        const won = (inA && isPlayerA) || (inB && isPlayerB);
        const pot = formatEther(game.stake * 2n);
        const opp = isPlayerA ? game.playerB : game.playerA;

        return { isWinner: won, carrotInA: inA, carrotInB: inB, potWon: pot, opponent: opp };
    }, [game, address]);

    if (!game) return <div className="py-20 text-center text-white">Loading results...</div>;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-3xl mx-auto space-y-6 md:space-y-8 px-4 pb-12"
        >
            {/* Result Badge */}
            <div className="text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.5, delay: 0.2 }}
                    className="inline-block"
                >
                    <span className="badge-encrypted text-sm md:text-lg px-4 py-1.5 md:px-6 md:py-2">
                        <Icon name="bolt" size="sm" /> GAME RESOLVED
                    </span>
                </motion.div>

                {/* Winner Title */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-4 md:mt-6"
                >
                    <h1 className={`text-4xl md:text-6xl font-black italic uppercase tracking-tighter ${isWinner ? 'text-success shadow-glow-sm' : 'text-red-500'}`}>
                        {isWinner ? 'WINNER!' : 'YOU LOST'}
                    </h1>
                    <p className="text-neutral-tan text-sm md:text-base mt-2 max-w-md mx-auto leading-relaxed">
                        The box has been opened. coFHE has decrypted the truth.
                        <br className="hidden sm:block" />
                        {isWinner ? 'You found the glowing carrot!' : 'The carrot was in the other box.'}
                    </p>
                </motion.div>
            </div>

            {/* Box Reveal */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="grid grid-cols-1 xs:grid-cols-2 gap-4 md:gap-6"
            >
                {/* Box A */}
                <div className={`glass-luxe p-5 md:p-6 flex flex-col items-center border border-white/5 relative overflow-hidden rounded-[240px] md:rounded-[32px] ${carrotInA ? 'border-success shadow-glow-success bg-success/5' : 'opacity-30'}`}>
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-black/40 rounded-2xl md:rounded-3xl flex items-center justify-center border border-white/10 mb-4 overflow-hidden shadow-inner">
                        {carrotInA ? (
                            <img src="/assets/carrot.png" alt="Carrot" className="w-12 h-12 md:w-16 md:h-16 object-contain animate-bounce mix-blend-screen" />
                        ) : (
                            <Icon name="inventory_2" size="lg" className="text-white/10" />
                        )}
                    </div>
                    <p className="text-[10px] text-neutral-tan uppercase font-black tracking-widest text-center">Box A (Creator)</p>
                    <p className="font-bold text-white mt-1 text-xs md:text-sm">{carrotInA ? 'THE CARROT' : 'EMPTY'}</p>
                </div>

                {/* Box B */}
                <div className={`glass-luxe p-5 md:p-6 flex flex-col items-center border border-white/5 relative overflow-hidden rounded-[24px] md:rounded-[32px] ${carrotInB ? 'border-success shadow-glow-success bg-success/5' : 'opacity-30'}`}>
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-black/40 rounded-2xl md:rounded-3xl flex items-center justify-center border border-white/10 mb-4 overflow-hidden shadow-inner">
                        {carrotInB ? (
                            <motion.div
                                animate={{ rotate: [0, -10, 10, 0] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            >
                                <img src="/assets/carrot.png" alt="Carrot" className="w-12 h-12 md:w-16 md:h-16 object-contain mix-blend-screen" />
                            </motion.div>
                        ) : (
                            <Icon name="inventory_2" size="lg" className="text-white/10" />
                        )}
                    </div>
                    <p className="text-[10px] text-neutral-tan uppercase font-black tracking-widest text-center">Box B (Challenger)</p>
                    <p className="font-bold text-white mt-1 text-xs md:text-sm">{carrotInB ? 'THE CARROT' : 'EMPTY'}</p>
                </div>
            </motion.div>

            {/* Stats */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-1 xs:grid-cols-2 gap-3 md:gap-4"
            >
                <div className="glass-card p-4 text-center border-white/5 bg-white/2">
                    <p className="text-[10px] text-neutral-tan uppercase tracking-widest font-bold">Pot Won</p>
                    <p className="text-xl md:text-2xl font-black text-primary">{potWon} CARROT</p>
                </div>
                <div className="glass-card p-4 text-center border-white/5 bg-white/2">
                    <p className="text-[10px] text-neutral-tan uppercase tracking-widest font-bold">Opponent</p>
                    <p className="text-xs md:text-sm font-mono text-white truncate px-2 mt-1">{opponent}</p>
                </div>
            </motion.div>

            {/* Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center"
            >
                <Link to="/lobby" className="btn-primary flex-1 sm:flex-none px-8 py-4 flex items-center justify-center gap-2 font-black uppercase text-sm tracking-widest">
                    <Icon name="sports_esports" size="sm" />
                    Play Again
                </Link>
                <Link to="/lobby" className="btn-secondary flex-1 sm:flex-none px-8 py-4 flex items-center justify-center gap-2 font-black uppercase text-sm tracking-widest">
                    <Icon name="arrow_back" size="sm" />
                    <span>Back to Lobby</span>
                </Link>
            </motion.div>
        </motion.div>
    );
}

export default GameResult;

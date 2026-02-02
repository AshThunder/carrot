import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { parseEther, maxUint256, decodeEventLog } from 'viem';
import Icon from '../components/Icon';
import { GameCreationModal } from '../components/GameCreationModal';
import type { CreationState } from '../components/GameCreationModal';
import { CARROT_GAME_ADDRESS, CARROT_GAME_ABI, CARROT_TOKEN_ADDRESS, CARROT_TOKEN_ABI } from '../lib/abis';
import { encryptEbool, encryptEuint64, pushLog, subscribeToCofheLogs } from '../lib/cofhe';
import { generateGameKeys, splitKey, publicKeyToHex } from '../lib/chat';

function CreateGame() {
    const navigate = useNavigate();
    const { isConnected, address } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    // Removed useSignMessage

    // Fetch user balance
    const { data: userBalance } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
    });

    const [hasCarrot, setHasCarrot] = useState(() => Math.random() > 0.5);
    const [stake, setStake] = useState("1"); // Default bet amount to 1
    const [showRules, setShowRules] = useState(false);

    const [createdGameId, setCreatedGameId] = useState<string>('');

    // Modal state
    const [creationState, setCreationState] = useState<CreationState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState({ step: 0, message: '' });
    const [syncLogs, setSyncLogs] = useState<string[]>([]);

    // Subscribe to coFHE logs
    useEffect(() => {
        return subscribeToCofheLogs((msg) => {
            setSyncLogs(prev => [...prev, msg].slice(-5)); // Keep last 5 logs for modal
        });
    }, []);

    const handleCreateGame = async () => {
        if (!isConnected) {
            setErrorMessage('Please connect your wallet first');
            setCreationState('failure');
            return;
        }

        setCreationState('processing');
        setProgress({ step: 1, message: 'Initializing...' });

        try {
            const stakeWei = parseEther(stake.toString());

            // Step 1: Check Public Balance (Game uses public tokens)
            // We re-check here to be sure, using the value from the hook or refetching if needed
            if (!userBalance || (userBalance as bigint) < stakeWei) {
                setErrorMessage('Insufficient balance. Claim from Faucet.');
                setCreationState('failure');
                return;
            }

            // Step 2: Generate Game Keys (Ephemeral Shared Key)
            setProgress({ step: 1, message: 'Generating Secure Game Keys...' });
            pushLog('Step 0: Generating shared game key...');
            // const signature = await signMessageAsync({ message: "Login to Carrot Game" }); // Not needed for creator
            const gameKeys = generateGameKeys();
            const gamePubKeyHex = publicKeyToHex(gameKeys.publicKey);

            // Split Secret Key into 4 shards
            const shards = splitKey(gameKeys.secretKey);

            // Step 0.5: Encrypt Shards (for Async Key Exchange)
            pushLog('Step 0.5: Encrypting key shards...');

            // Sequential encryption for better UX feedback
            const encryptedShards = [];
            for (let i = 0; i < shards.length; i++) {
                setProgress({ step: 2, message: `Encrypting Access Key Shard ${i + 1}/4...` });
                const enc = await encryptEuint64(shards[i]);
                encryptedShards.push(enc);
            }

            // Step 1: Check Allowance
            pushLog('Step 1: Checking allowance...');
            if (!publicClient || !address) throw new Error('Wallet not initialized');

            const currentAllowance = await publicClient.readContract({
                address: CARROT_TOKEN_ADDRESS,
                abi: CARROT_TOKEN_ABI,
                functionName: 'allowance',
                args: [address, CARROT_GAME_ADDRESS],
            });

            pushLog(`Current allowance: ${currentAllowance.toString()} Required: ${stakeWei.toString()}`);

            if (currentAllowance < stakeWei) {
                pushLog('Insufficient allowance. Requesting approval...');
                const hash = await writeContractAsync({
                    address: CARROT_TOKEN_ADDRESS,
                    abi: CARROT_TOKEN_ABI,
                    functionName: 'approve',
                    args: [CARROT_GAME_ADDRESS, maxUint256],
                });
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash });
                }
            } else {
                pushLog('✅ Allowance sufficient. Skipping approval.');
            }

            // Step 2: Encrypt choice (Player A has carrot if hasCarrot is true)
            pushLog('Step 2: Encrypting carrot location...');
            setProgress({ step: 3, message: 'Encrypting Your Hidden Choice...' });
            const encryptedChoice = await encryptEbool(hasCarrot);

            // Step 3: Create Game
            pushLog('Step 3: Creating game...');
            setProgress({ step: 4, message: 'Broadcasting to Fhenix Network...' });
            const txHash = await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'createGame',
                args: [
                    encryptedChoice,
                    stakeWei,
                    gamePubKeyHex,
                    encryptedShards[0],
                    encryptedShards[1],
                    encryptedShards[2],
                    encryptedShards[3]
                ] as any,
            });

            // Step 4: Wait for receipt and parse Game ID
            setProgress({ step: 5, message: 'Finalizing & Fetching Room ID...' });
            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

            // Extract gameId from logs
            let gameId = '';
            for (const log of receipt.logs) {
                try {
                    const event = decodeEventLog({
                        abi: CARROT_GAME_ABI,
                        eventName: 'GameCreated',
                        data: log.data,
                        topics: log.topics,
                    });
                    if (event.eventName === 'GameCreated') {
                        gameId = event.args.gameId.toString();
                        break;
                    }
                } catch (e) {
                    // Not a GameCreated event or failed to decode
                }
            }

            setCreatedGameId(gameId || 'Unknown');
            setCreationState('success');
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.shortMessage || err.message || 'Transaction failed');
            setCreationState('failure');
        }
    };

    const handleRetry = () => {
        handleCreateGame();
    };

    const handleModalClose = () => {
        if (creationState === 'success') {
            navigate('/lobby');
        } else {
            setCreationState('idle');
        }
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto space-y-8"
            >
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 md:gap-4 px-4 sm:px-0">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight">Create New Match</h1>
                        <p className="text-neutral-tan text-sm mt-1">Place the carrot and set the stakes.</p>
                    </div>
                    <button
                        onClick={() => setShowRules(true)}
                        className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full flex items-center justify-center gap-2 text-xs font-bold transition-all w-full sm:w-auto"
                    >
                        <Icon name="info" size="sm" />
                        GAME RULES
                    </button>
                </div>

                {/* Box Assignment Stage */}
                <div className="flex flex-col items-center justify-center py-4 md:py-8 px-4">
                    <div className="w-full max-w-md">
                        <ChoiceCard
                            hasCarrot={hasCarrot}
                            onShuffle={() => setHasCarrot(!hasCarrot)}
                        />
                    </div>
                    <p className="text-neutral-tan text-xs md:text-sm mt-6 max-w-lg text-center font-medium italic leading-relaxed">
                        "Player B will be presented with two boxes. Your carrot has been placed in an anonymous container. You can shuffle to change the outcome before locking it in."
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 px-4 sm:px-0 pb-12">
                    {/* Left Column: Stake & Bluff */}
                    <div className="space-y-6">
                        {/* Match Stake */}
                        <div className="glass-card p-5 md:p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Icon name="payments" className="text-primary" />
                                    <h3 className="font-bold text-white uppercase tracking-wide text-sm md:text-base">Match Stake</h3>
                                </div>
                                <div className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-lg font-bold text-xs md:text-sm">
                                    {Number(stake).toLocaleString()} CARROT
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max="10000"
                                        step="1"
                                        value={stake}
                                        onChange={(e) => setStake(e.target.value)}
                                        className="input-field w-full pr-24 text-xl md:text-2xl font-mono py-3 md:py-3.5"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        <img src="/assets/carrot.png" alt="Carrot" className="w-5 h-5 md:w-6 md:h-6 object-contain mix-blend-screen drop-shadow-[0_0_5px_rgba(242,127,13,0.4)]" />
                                        <span className="text-xs md:text-sm text-neutral-tan font-bold">CARROT</span>
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10000"
                                    step="1"
                                    value={stake}
                                    onChange={(e) => setStake(e.target.value)}
                                    className="w-full h-2 bg-border-dark rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-[9px] md:text-[10px] text-neutral-tan uppercase font-bold tracking-widest">
                                    <span>Min 1</span>
                                    <span>Max 10,000</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:gap-3">
                                <button
                                    onClick={() => setStake((prev) => (Number(prev) + 500).toString())}
                                    className="bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all border border-white/5"
                                >
                                    +500
                                </button>
                                <button
                                    onClick={() => setStake((prev) => (Number(prev) + 1000).toString())}
                                    className="bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all border border-white/5"
                                >
                                    +1K
                                </button>
                                <button
                                    onClick={() => setStake("10000")}
                                    className="bg-white/5 hover:bg-white/10 text-white/70 py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-all border border-white/5 uppercase"
                                >
                                    Max
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Info & Action */}
                    <div className="flex flex-col justify-between pt-2 md:pt-0">
                        <div className="glass-card p-6 md:p-8 border-dashed border-primary/30 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Icon name="verified_user" className="text-primary" size="sm" />
                                </div>
                                <h3 className="font-bold text-white uppercase tracking-wide text-sm md:text-base">On-Chain Encryption</h3>
                            </div>
                            <div className="space-y-4">
                                <p className="text-xs md:text-sm text-neutral-tan leading-relaxed">
                                    Your choice and your bluff are processed via <span className="text-white font-bold">Fhenix FHE</span>. This means they are encrypted end-to-end. Your choice remains private on-chain.
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-success uppercase tracking-wider">
                                        <Icon name="check_circle" size="xs" />
                                        Carrot Location: Encrypted
                                    </li>
                                    <li className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-success uppercase tracking-wider">
                                        <Icon name="check_circle" size="xs" />
                                        Bluff Content: Encrypted
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8 lg:mt-0 space-y-4">
                            <button
                                onClick={handleCreateGame}
                                className="btn-primary w-full py-5 md:py-6 text-lg md:text-xl flex items-center justify-center gap-3 uppercase tracking-wider font-black shadow-glow-lg active:scale-[0.98]"
                            >
                                <Icon name="lock" size="sm" filled className="text-black" />
                                Lock In & Create
                            </button>
                            <div className="text-center space-y-1">
                                <p className="text-[8px] text-neutral-tan/50 uppercase tracking-widest font-bold">
                                    Powered by Fhenix
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div >

            <GameCreationModal
                state={creationState}
                onClose={handleModalClose}
                onRetry={handleRetry}
                gameId={createdGameId}
                stake={Number(stake)}
                error={errorMessage}
                progress={progress}
                syncLogs={syncLogs}
            />

            <GameRulesModal
                isOpen={showRules}
                onClose={() => setShowRules(false)}
            />
        </>
    );
}

function GameRulesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-2xl glass-luxe rounded-[32px] border border-white/10 overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Icon name="menu_book" className="text-primary" size="sm" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">The Code of Conduct</h2>
                    </div>
                    <button onClick={onClose} className="text-neutral-tan hover:text-white transition-colors">
                        <Icon name="close" size="md" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto space-y-8 custom-scrollbar">
                    <section className="space-y-4">
                        <h3 className="text-primary font-bold uppercase tracking-widest text-xs">01. The Setup</h3>
                        <p className="text-neutral-tan text-sm leading-relaxed">
                            Two players, two boxes, and one single CARROT. Player A (The Creator) starts by placing the carrot in one of the boxes and setting the stake.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-primary font-bold uppercase tracking-widest text-xs">02. On-Chain Encryption</h3>
                        <p className="text-neutral-tan text-sm leading-relaxed">
                            Powered by <span className="text-white font-bold">Fhenix coFHE</span>, your choice is cryptographically sealed. Even the network validators cannot see which box holds the carrot until the final reveal.
                        </p>
                    </section>

                    <section className="space-y-4 relative">
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
                        <h3 className="text-primary font-bold uppercase tracking-widest text-xs">03. The Bluffing Phase</h3>
                        <p className="text-neutral-tan text-sm leading-relaxed">
                            Once Player B (The Challenger) joins, the psychological warfare begins. Player A can send encrypted messages to Player B. Your goal? Convince them to make the wrong choice.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-primary font-bold uppercase tracking-widest text-xs">04. The Decision</h3>
                        <p className="text-neutral-tan text-sm leading-relaxed font-medium text-white italic">
                            Challenger, listen closely:
                        </p>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <li className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="text-white font-bold block mb-1">STAY</span>
                                <span className="text-[11px] text-neutral-tan uppercase tracking-wider">Keep your original box.</span>
                            </li>
                            <li className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                                <span className="text-primary font-bold block mb-1">SWAP</span>
                                <span className="text-[11px] text-neutral-tan uppercase tracking-wider">Take Player A's box.</span>
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-primary font-bold uppercase tracking-widest text-xs">05. The Reveal</h3>
                        <p className="text-neutral-tan text-sm leading-relaxed">
                            Whoever holds the box with the carrot at the end takes the entire pot. If no decision is made within 1 hour, the creator can refund the match.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 md:p-8 bg-white/[0.02] border-t border-white/5 flex justify-center">
                    <button
                        onClick={onClose}
                        className="btn-primary px-12 py-3 text-sm font-black uppercase tracking-widest"
                    >
                        Got It
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

interface ChoiceCardProps {
    hasCarrot: boolean;
    onShuffle: () => void;
}

function ChoiceCard({ hasCarrot, onShuffle }: ChoiceCardProps) {
    return (
        <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="cursor-pointer p-8 rounded-3xl flex flex-col items-center justify-center min-h-[350px] transition-all relative overflow-hidden bg-[var(--color-background-card)] border-2 border-primary shadow-[0_0_60px_rgba(242,127,13,0.1)] bg-gradient-to-t from-primary/10 to-transparent"
        >
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/30">
                MAKE A CHOICE
            </div>

            <div className="relative mb-6 transition-all duration-500 scale-110">
                <motion.div
                    key={hasCarrot ? 'carrot' : 'empty'}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="flex flex-col items-center justify-center min-h-[200px]"
                >
                    {hasCarrot ? (
                        <div className="flex flex-col items-center justify-center">
                            <img src="/assets/carrot.png" alt="Carrot" className="w-32 h-32 object-contain drop-shadow-[0_0_25px_rgba(242,127,13,0.5)] mix-blend-screen" />
                            <div className="mt-8 text-primary font-black uppercase text-sm tracking-[0.3em] text-center">
                                Carrot Inside
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-32 h-32 flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-white/5 rounded-full blur-2xl opacity-50" />
                                <Icon name="inventory_2" className="text-8xl text-neutral-tan opacity-20 relative z-10" />
                            </div>
                            <div className="mt-8 text-neutral-tan font-black uppercase text-sm tracking-[0.3em] text-center">
                                Box is Empty
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onShuffle();
                }}
                className="mt-6 flex items-center gap-2 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-2xl text-xs font-black text-white uppercase tracking-widest border border-white/10 transition-all hover:border-primary group"
            >
                <Icon name="shuffle" size="sm" className="group-hover:rotate-180 transition-transform duration-500" />
                Relocate Carrot
            </button>
        </motion.div>
    );
}

export default CreateGame;

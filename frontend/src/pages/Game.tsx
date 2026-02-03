import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import Icon from '../components/Icon';
import { CARROT_GAME_ADDRESS, CARROT_GAME_ABI, CARROT_TOKEN_ADDRESS, CARROT_TOKEN_ABI } from '../lib/abis';
import { encryptMessage, decryptMessage, hexToPublicKey, type ChatKeys, joinKey } from '../lib/chat';
import { unsealValue, FheTypes, subscribeToCofheLogs } from '../lib/cofhe';
import { useToast } from '../context/ToastContext';

const GameState: Record<number, string> = {
    0: 'Open',
    1: 'Active',
    2: 'Decided',
    3: 'Resolved',
    4: 'Cancelled'
};

const GameStateIdx = {
    Open: 0,
    Active: 1,
    Decided: 2,
    Resolved: 3,
    Cancelled: 4
};

const DECISION_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in ms

function Game() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [chatKeys, setChatKeys] = useState<ChatKeys | null>(null);
    const { showToast } = useToast();

    const { data: userBalance, refetch: refetchBalance } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address as `0x${string}`] : undefined,
        query: {
            refetchInterval: 5000,
        }
    });

    const [faucetHash, setFaucetHash] = useState<`0x${string}` | undefined>();
    const { isLoading: isFaucetPending, isSuccess: isFaucetSuccess } = useWaitForTransactionReceipt({ hash: faucetHash });

    const [bluffInput, setBluffInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [creatorCarrotPeek, setCreatorCarrotPeek] = useState<boolean | null>(null);
    const [showPeek, setShowPeek] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<string>('--:--');
    const [isExpired, setIsExpired] = useState(false);
    const [syncLogs, setSyncLogs] = useState<string[]>([]);

    // Fetch game data
    const { data: gameData, refetch: refetchGame } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'getGame',
        args: gameId ? [BigInt(gameId)] : undefined,
        query: {
            refetchInterval: 5000,
        }
    });

    // Fetch bluffs
    const { data: bluffsData, refetch: refetchBluffs } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'getBluffs',
        args: gameId ? [BigInt(gameId)] : undefined,
        query: {
            refetchInterval: 3000,
        }
    });

    // Check if decryption is ready
    const { data: decryptionReady } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'isDecrypted',
        args: gameId ? [BigInt(gameId)] : undefined,
        query: {
            refetchInterval: 5000,
            enabled: gameData !== undefined && (gameData as any).state === 2, // Decided state
        }
    });

    // Refetch balance when faucet succeeds
    useEffect(() => {
        if (isFaucetSuccess) {
            refetchBalance();
            showToast("CARROT tokens claimed! Your balance will update shortly.", "success");
        }
    }, [isFaucetSuccess, refetchBalance, showToast]);

    const game = useMemo(() => {
        if (!gameData) return null;
        return gameData as any;
    }, [gameData]);

    const bluffs = useMemo(() => {
        if (!bluffsData) return [];
        return bluffsData as any[];
    }, [bluffsData]);

    const isPlayerA = address === game?.playerA;
    const isPlayerB = address === game?.playerB;
    const isParticipant = isPlayerA || isPlayerB;

    // Timer logic for Active games
    useEffect(() => {
        if (!game || game.state !== GameStateIdx.Active) {
            setTimeRemaining('--:--');
            setIsExpired(false);
            return;
        }

        const updateTimer = () => {
            const joinedAt = Number(game.joinedAt) * 1000;
            const deadline = joinedAt + DECISION_TIMEOUT_MS;
            const now = Date.now();
            const remaining = deadline - now;

            if (remaining <= 0) {
                setTimeRemaining('EXPIRED');
                setIsExpired(true);
            } else {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                setTimeRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `);
                setIsExpired(false);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [game]);



    // Subscribe to coFHE logs
    useEffect(() => {
        return subscribeToCofheLogs((msg) => {
            setSyncLogs(prev => [...prev, msg].slice(-8)); // Keep last 8 logs
        });
    }, []);

    // Auto-derive keys for participants if not set (Retrieve Shared Key)
    useEffect(() => {
        let retryCount = 0;
        const maxRetries = 3;

        const deriveKeys = async () => {
            // Only derive if participant, connected, and keys missing
            if (isConnected && address && isParticipant && !chatKeys && !isProcessing && game) {
                try {
                    const statusLog = `Unsealing Shared Game Key(Attempt ${retryCount + 1})...`;
                    setSyncLogs(prev => [...prev, statusLog]);

                    if (!game.k1 || !game.k2 || !game.k3 || !game.k4) {
                        console.warn("Looking for keys...", game);
                        return;
                    }

                    // Use standard uint64 index for Fhenix (usually 4 or 5 depending on SDK version)
                    const utype = FheTypes.Uint64 || (FheTypes as any).uint64 || 4;

                    // Unseal all 4 shards in parallel for better speed and fewer timeouts
                    const shardResults = await Promise.all([
                        unsealValue(game.k1, utype, address),
                        unsealValue(game.k2, utype, address),
                        unsealValue(game.k3, utype, address),
                        unsealValue(game.k4, utype, address)
                    ]);

                    const shards = shardResults.map(val => BigInt(val));
                    const secretKey = joinKey(shards);
                    const publicKey = hexToPublicKey(game.gamePubKey);

                    setChatKeys({ publicKey, secretKey });
                    const successLog = "✅ Shared Key Unsealed & Reconstructed";
                    setSyncLogs(prev => [...prev, successLog]);
                } catch (e: any) {
                    console.error("Key unsealing failed:", e);
                    // Retry if it's an authorization/propagation issue
                    if (retryCount < maxRetries && (e.message?.includes('authorized') || e.message?.includes('Forbidden'))) {
                        retryCount++;
                        console.log(`Retrying key synchronization in 2s... (${retryCount}/${maxRetries})`);
                        setTimeout(deriveKeys, 2000);
                    }
                }
            }
        };

        if (game && address) deriveKeys();
    }, [isConnected, address, isParticipant, chatKeys, game]);

    // Creator Peek: Unseal the choice for Player A
    useEffect(() => {
        const peekChoice = async () => {
            if (isPlayerA && game?.playerAHasCarrot && creatorCarrotPeek === null && address) {
                try {
                    const utype = FheTypes.Bool || (FheTypes as any).bool || 0;
                    const result = await unsealValue(game.playerAHasCarrot, utype, address);
                    setCreatorCarrotPeek(Boolean(result));
                    const log = `🔍 Creator Peek successful: ${result}`;
                    setSyncLogs(prev => [...prev, log]);
                } catch (e: any) {
                    console.error("Peek failed:", e);
                }
            }
        };
        peekChoice();
    }, [isPlayerA, game?.playerAHasCarrot, creatorCarrotPeek, address]);

    const handleClaim = async () => {
        if (!isConnected) {
            showToast("Connect your wallet to claim tokens", "warning");
            return;
        }
        try {
            const txHash = await writeContractAsync({
                address: CARROT_TOKEN_ADDRESS,
                abi: CARROT_TOKEN_ABI,
                functionName: 'dailyMint'
            });
            setFaucetHash(txHash);
            showToast("Claiming CARROT tokens...", "info");
        } catch (err: any) {
            console.error("Faucet claim failed:", err);
            showToast(err.shortMessage || "Claim failed. Check cooldown.", "error");
        }
    };

    const ensureKeys = async () => {
        if (chatKeys) return chatKeys;
        showToast("Please wait for key synchronization...", "info");
        return null; // Key derivation is auto-triggered via effect now
    };

    const handleJoin = async () => {
        if (!isConnected) {
            showToast("Please connect your wallet first", "warning");
            return;
        }
        if (!gameId) return;

        // No need to ensure keys BEFORE join, because Join grants permission!

        if (userBalance !== undefined && game && (userBalance as bigint) < game.stake) {
            const required = formatEther(game.stake);
            showToast(`Insufficient balance. You need ${required} CARROT to join. Claim from Faucet if needed.`, "error");
            return;
        }

        setIsProcessing(true);
        try {
            const hash = await writeContractAsync({
                address: CARROT_TOKEN_ADDRESS,
                abi: CARROT_TOKEN_ABI,
                functionName: 'approve' as any,
                args: [CARROT_GAME_ADDRESS, game.stake] as any,
            });

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
            }

            await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'joinGame',
                args: [BigInt(gameId)],
            });
            refetchGame();
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDecision = async (takeOpponentBox: boolean) => {
        if (!isConnected || !gameId) return;
        setIsProcessing(true);
        try {
            await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'makeDecision',
                args: [BigInt(gameId), takeOpponentBox],
            });
            refetchGame();
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinalize = async () => {
        if (!isConnected || !gameId) return;
        setIsProcessing(true);
        try {
            await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'finalizeGame',
                args: [BigInt(gameId)],
            });
            navigate(`/game/${gameId}/result`);
        } catch (err) {
            console.error(err);
            showToast("Oracle is still calculating. Please wait a few more moments.", "warning");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCancel = async () => {
        if (!isConnected || !gameId) return;
        setIsProcessing(true);
        try {
            await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'cancelGame',
                args: [BigInt(gameId)],
            });
            showToast("Game cancelled. Funds refunded!", "success");
            navigate('/lobby');
        } catch (err) {
            console.error(err);
            showToast("Cannot cancel game yet.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSendBluff = async () => {
        if (!isConnected || !gameId || !bluffInput.trim()) return;

        let keys = chatKeys;
        if (!keys) {
            keys = await ensureKeys();
            if (!keys) return;
        }

        // Use Shared Game Key for encryption
        // Since both players possess the same keypair, we encrypt for the shared public key using the shared secret key.
        // This allows both to decrypt it.

        const recipientPubKey = hexToPublicKey(game.gamePubKey);
        const encryptedMsg = encryptMessage(bluffInput.trim(), recipientPubKey, keys.secretKey);

        setIsProcessing(true);
        try {
            await writeContractAsync({
                address: CARROT_GAME_ADDRESS,
                abi: CARROT_GAME_ABI,
                functionName: 'sendBluff',
                args: [BigInt(gameId), encryptedMsg],
            });
            setBluffInput('');
            refetchBluffs();
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };



    if (!game) return <div className="py-20 text-center text-white">Loading game data...</div>;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 max-w-5xl mx-auto px-4 pb-12"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3 md:gap-4">
                    <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Game #{gameId}</h1>
                    <span className="badge-encrypted">
                        <span className={`w-2 h-2 rounded-full ${game.state === GameStateIdx.Resolved ? 'bg-gray-500' : 'bg-success'} animate-pulse`}></span>
                        {GameState[game.state].toUpperCase()}
                    </span>
                </div>
                <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
                    {/* Timer for Active games */}
                    {game.state === GameStateIdx.Active && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex-1 sm:flex-none justify-center ${isExpired ? 'bg-red-500/20 border border-red-500/50' : 'bg-green-500/20 border border-green-500/50'}`}>
                            <Icon name="timer" size="sm" className={isExpired ? 'text-red-400' : 'text-green-400'} />
                            <span className={`font-mono font-bold text-base md:text-lg ${isExpired ? 'text-red-400' : 'text-green-400'}`}>
                                {timeRemaining}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Current Pot & Status Message */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="order-2 sm:order-1">
                    <p className="text-[10px] md:text-xs text-neutral-tan italic">
                        {game.state === GameStateIdx.Open ? "Waiting for a challenger to step up..." :
                            game.state === GameStateIdx.Active ? "Awaiting player decision" :
                                game.state === GameStateIdx.Decided ? "Finalizing encrypted result" : "Match concluded"}
                    </p>
                </div>
                <div className="text-left sm:text-right order-1 sm:order-2">
                    <p className="text-[10px] md:text-xs text-neutral-tan uppercase tracking-widest font-bold">Total Pot</p>
                    <p className="text-2xl md:text-3xl font-black text-primary">
                        {formatEther(game.stake * 2n)} <span className="text-sm md:text-lg">CARROT</span>
                    </p>
                </div>
            </div>

            {/* Game Stage */}
            <div className="glass-card p-4 md:p-8 border-white/5 bg-surface-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-3xl mx-auto">
                    {/* Box A */}
                    <motion.div className={`glass-card p-6 md:p-8 flex flex-col items-center justify-center min-h-[240px] md:min-h-[300px] border-2 rounded-3xl relative transition-all ${isPlayerA ? 'border-primary' : 'border-white/5 opacity-80'}`}>
                        <p className="absolute top-4 text-[9px] font-black text-neutral-tan/50 uppercase tracking-[0.3em]">BOX A</p>
                        <div className="relative mb-5 md:mb-6">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-background-card rounded-2xl md:rounded-3xl overflow-hidden flex items-center justify-center border border-white/10 shadow-glow bg-black/40">
                                {(game.state === GameStateIdx.Resolved && game.playerAHasCarrotRevealed) || (isPlayerA && showPeek && creatorCarrotPeek) ? (
                                    <div className="relative flex flex-col items-center justify-center p-2">
                                        <img src="/assets/carrot.png" alt="Carrot" className="w-12 h-12 md:w-16 md:h-16 object-contain animate-bounce" />
                                        {game.state !== GameStateIdx.Resolved && (
                                            <span className="absolute -bottom-1 text-[8px] font-black text-primary uppercase tracking-[0.2em] animate-pulse bg-black/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                CARROT INSIDE
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center group h-full w-full relative">
                                        {(isPlayerA && showPeek && creatorCarrotPeek === false) ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <Icon name="inventory_2" size="lg" className="text-neutral-tan/20 animate-pulse" />
                                                <span className="mt-2 text-[8px] font-black text-neutral-tan uppercase tracking-[0.2em] bg-black/80 px-2 py-0.5 rounded-full">
                                                    BOX EMPTY
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <img src="/assets/player_a.png" alt="Creator" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Icon name="lock" size="sm" className="text-primary" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="font-bold text-white text-sm md:text-base uppercase tracking-widest">Creator (A) {isPlayerA && "(YOU)"}</p>
                        {isPlayerA && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <button
                                    onClick={() => setShowPeek(!showPeek)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${showPeek ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
                                        }`}
                                >
                                    <Icon name={showPeek ? "visibility_off" : "visibility"} size="xs" />
                                    {showPeek ? "CLOSE CONTENT" : "PEEK INSIDE"}
                                </button>
                            </div>
                        )}
                    </motion.div>

                    {/* Box B */}
                    <motion.div className={`glass-card p-6 md:p-8 flex flex-col items-center justify-center min-h-[240px] md:min-h-[300px] border-2 rounded-3xl relative transition-all ${isPlayerB ? 'border-primary' : 'border-white/5 opacity-80'}`}>
                        <p className="absolute top-4 text-[9px] font-black text-neutral-tan/50 uppercase tracking-[0.3em]">BOX B</p>
                        <div className="relative mb-5 md:mb-6">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-surface-3 rounded-2xl md:rounded-3xl overflow-hidden flex items-center justify-center border border-white/10 bg-black/40">
                                {game.state === GameStateIdx.Resolved && !game.playerAHasCarrotRevealed ? (
                                    <img src="/assets/carrot.png" alt="Carrot" className="w-12 h-12 md:w-16 md:h-16 object-contain animate-bounce" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center group h-full w-full relative">
                                        <img src="/assets/player_b.png" alt="Challenger" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Icon name="lock" size="sm" className="text-primary" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <p className="font-bold text-white text-sm md:text-base uppercase tracking-widest">Challenger (B) {isPlayerB && "(YOU)"}</p>
                        {isPlayerB && <span className="text-[10px] text-primary mt-2 font-black uppercase tracking-widest">YOUR BOX</span>}
                    </motion.div>
                </div>
            </div>

            {/* Decision Buttons - Above Chat for priority */}
            {game.state === GameStateIdx.Active && isPlayerB && !isExpired && (
                <div className="flex flex-col xs:flex-row gap-3 md:gap-4 w-full max-w-xl mx-auto mb-2">
                    <button onClick={() => handleDecision(true)} disabled={isProcessing} className="btn-primary flex-1 py-4 md:py-5 text-base md:text-lg font-black tracking-widest uppercase">SWAP BOXES</button>
                    <button onClick={() => handleDecision(false)} disabled={isProcessing} className="btn-secondary flex-1 py-4 md:py-5 text-base md:text-lg font-black tracking-widest uppercase">KEEP MY BOX</button>
                </div>
            )}

            {/* Bluff Chat - Only for participants and active/open games */}
            {isParticipant && (game.state === GameStateIdx.Open || game.state === GameStateIdx.Active) && (
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon name="chat" size="md" className="text-primary" />
                        <h3 className="font-bold text-white">Bluff Chat</h3>
                        <span className="text-xs text-neutral-tan">(End-to-End Encrypted)</span>
                    </div>
                    {!chatKeys && (
                        <button onClick={ensureKeys} className="w-full mb-2 py-2 btn-secondary text-xs">
                            🔐 UNLOCK ENCRYPTED CHAT
                        </button>
                    )}

                    {/* Messages */}
                    <div className="max-h-48 overflow-y-auto space-y-2 mb-3 p-2 bg-black/20 rounded-lg">
                        {bluffs.length === 0 ? (
                            <p className="text-neutral-tan text-sm text-center py-4">No messages yet. Send the first bluff!</p>
                        ) : (
                            bluffs.map((bluff, i) => (
                                <div key={i} className={`flex ${bluff.sender === address ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] px-3 py-2 rounded-lg ${bluff.sender === address ? 'bg-primary/20 text-white' : 'bg-white/10 text-white'}`}>
                                        <p className="text-sm">
                                            {(() => {
                                                // Try decrypt using shared game public key (since both players have the shared secret)
                                                if (!chatKeys || !game.gamePubKey) return "🔒 Unlock chat to view";

                                                const sharedPubKey = hexToPublicKey(game.gamePubKey);
                                                const decrypted = decryptMessage(bluff.message, sharedPubKey, chatKeys.secretKey);

                                                return decrypted || "🔒 Decryption Failed";
                                            })()}
                                        </p>
                                        <p className="text-[10px] text-neutral-tan mt-1">
                                            {bluff.sender === address ? 'You' : 'Opponent'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={bluffInput}
                            onChange={(e) => setBluffInput(e.target.value)}
                            placeholder="Send a bluff..."
                            className="input-field flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && handleSendBluff()}
                        />
                        <button
                            onClick={handleSendBluff}
                            disabled={isProcessing || !bluffInput.trim()}
                            className={`btn-primary px-4 flex items-center justify-center transition-all ${isProcessing ? 'opacity-80' : ''}`}
                        >
                            <div className={isProcessing ? 'animate-spin' : ''}>
                                <Icon name={isProcessing ? "refresh" : "send"} size="sm" />
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* FHE Status Console */}
            {isParticipant && (game.state === GameStateIdx.Open || game.state === GameStateIdx.Active) && syncLogs.length > 0 && (
                <div className="max-w-xl mx-auto w-full">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-[10px] md:text-xs overflow-hidden relative">
                        <div className="absolute top-2 right-4 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[9px] text-primary/50 font-black uppercase tracking-widest">Pipeline Live</span>
                        </div>
                        <div className="space-y-1 opacity-70">
                            {syncLogs.map((log, i) => (
                                <div key={i} className="flex gap-2">
                                    <span className="text-primary/40">[{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                                    <span className={log.startsWith('❌') ? 'text-red-400' : log.startsWith('✅') ? 'text-success' : 'text-neutral-tan'}>
                                        {log}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Actions Section */}
            <div className="flex flex-col items-center gap-6 max-w-xl mx-auto">
                {/* Join Button */}
                {game.state === GameStateIdx.Open && !isPlayerA && (
                    <div className="w-full flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <img src="/assets/carrot.png" alt="Carrot" className="w-4 h-4 object-contain" />
                            <span className="text-[10px] text-neutral-tan uppercase font-black tracking-widest">Your Balance:</span>
                            <span className={`text-xs font-bold ${userBalance !== undefined && game && (userBalance as bigint) < game.stake ? 'text-red-400' : 'text-primary'}`}>
                                {userBalance !== undefined ? Number(formatEther(userBalance as bigint)).toLocaleString() : '---'} CARROT
                            </span>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={isProcessing}
                            className={`btn-primary w-full py-4 text-xl ${userBalance !== undefined && game && (userBalance as bigint) < game.stake ? 'opacity-50 brightness-50' : ''}`}
                        >
                            {isProcessing ? "PROCESSING..." : "JOIN & CHALLENGE"}
                        </button>

                        {userBalance !== undefined && game && (userBalance as bigint) < game.stake && (
                            <div className="flex flex-col items-center gap-3 w-full">
                                <p className="text-[10px] text-red-400 uppercase font-bold tracking-wider animate-pulse text-center">
                                    Insufficient balance to match stake
                                </p>
                                <button
                                    onClick={handleClaim}
                                    disabled={isFaucetPending}
                                    className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-5 py-2.5 rounded-2xl border border-primary/20 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <Icon name={isFaucetPending ? "refresh" : "faucet"} size="xs" className={isFaucetPending ? "animate-spin" : ""} />
                                    {isFaucetPending ? "CLAIMING..." : "CLAIM CARROT FROM FAUCET"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Cancel Button for Open games (creator only) */}
                {game.state === GameStateIdx.Open && isPlayerA && (
                    <button onClick={handleCancel} disabled={isProcessing} className="btn-secondary w-full py-3">
                        CANCEL GAME & REFUND
                    </button>
                )}


                {/* Expired - Refund Button */}
                {game.state === GameStateIdx.Active && isExpired && isParticipant && (
                    <div className="text-center space-y-4 w-full">
                        <p className="text-red-400 font-bold">⏱️ TIME EXPIRED!</p>
                        <button onClick={handleCancel} disabled={isProcessing} className="btn-secondary w-full py-4">
                            {isProcessing ? "PROCESSING..." : "RECLAIM YOUR FUNDS"}
                        </button>
                    </div>
                )}

                {/* Waiting message for Player A during active */}
                {game.state === GameStateIdx.Active && isPlayerA && !isExpired && (
                    <div className="text-center glass-card p-4 w-full">
                        <p className="text-neutral-tan">Waiting for opponent to make their decision...</p>
                        <p className="text-sm text-primary mt-2">Keep bluffing in the chat!</p>
                    </div>
                )}

                {/* Finalize Button */}
                {game.state === GameStateIdx.Decided && (
                    <div className="text-center space-y-4">
                        <div className="flex flex-col items-center gap-2">
                            <p className={`text-sm font-black uppercase tracking-[0.2em] ${decryptionReady ? 'text-success animate-pulse' : 'text-primary/50'}`}>
                                {decryptionReady ? 'Decryption Proof Ready' : 'Awaiting Oracle Confirmation...'}
                            </p>
                            {!decryptionReady && (
                                <p className="text-[10px] text-neutral-tan uppercase opacity-70">
                                    The decentralised oracle is verifying the encrypted game state.
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleFinalize}
                            disabled={isProcessing || !decryptionReady}
                            className={`px-10 py-4 text-lg font-black tracking-widest uppercase transition-all ${decryptionReady
                                ? 'btn-primary hover:scale-105 active:scale-95'
                                : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed'
                                }`}
                        >
                            {isProcessing ? "PROCESSING REVEAL..." : decryptionReady ? "REVEAL WINNER & CLAIM POT" : "WAITING FOR ORACLE"}
                        </button>
                    </div>
                )}

                {/* Resolved State */}
                {game.state === GameStateIdx.Resolved && (
                    <div className="text-center glass-card p-6 border-primary bg-primary/10 w-full">
                        <h2 className="text-2xl font-black text-white uppercase">Game Resolved</h2>
                        <p className="text-primary font-bold mt-2">WINNER: {game.winner?.toLowerCase() === address?.toLowerCase() ? "YOU! 🎉" : game.winner}</p>

                        <button onClick={() => navigate('/lobby')} className="mt-4 btn-secondary px-6 py-2">BACK TO LOBBY</button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center py-4 text-neutral-tan text-xs">
                <p>Fully Homomorphic Encryption ensures fairness. No one, including the creator, can tamper with the result.</p>
            </div>
        </motion.div>
    );
}

export default Game;

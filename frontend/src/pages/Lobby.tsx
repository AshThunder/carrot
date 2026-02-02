import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { CARROT_GAME_ADDRESS, CARROT_GAME_ABI, CARROT_TOKEN_ADDRESS, CARROT_TOKEN_ABI } from '../lib/abis';
import { formatEther, parseEther } from 'viem';
import { useToast } from '../context/ToastContext';

const GameStateLabels: Record<number, string> = {
    0: 'WAITING',
    1: 'IN PROGRESS',
    2: 'AWAITING REVEAL',
    3: 'RESOLVED',
    4: 'CANCELLED'
};

const GameStateColors: Record<number, string> = {
    0: 'text-yellow-400',
    1: 'text-green-400',
    2: 'text-blue-400',
    3: 'text-gray-400',
    4: 'text-red-400'
};

function Lobby() {
    const navigate = useNavigate();
    const { isConnected, address } = useAccount();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');

    // Fetch open games
    const { data: openGamesData, isLoading: isLoadingGames } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'getOpenGames',
        args: [0n, 20n],
        query: {
            refetchInterval: 10000,
        }
    });

    // Fetch user's games
    const { data: myGameIds } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'getMyGames',
        args: address ? [address] : undefined,
        query: {
            refetchInterval: 10000,
            enabled: !!address,
        }
    });

    // Batch fetch user game data
    const myGamesQuery = useMemo(() => {
        if (!myGameIds || !(myGameIds as any).length) return [];
        return (myGameIds as bigint[]).map(id => ({
            address: CARROT_GAME_ADDRESS as `0x${string}`,
            abi: CARROT_GAME_ABI,
            functionName: 'getGame',
            args: [id],
        }));
    }, [myGameIds]);

    const { data: myGamesRawData } = useReadContracts({
        contracts: myGamesQuery,
        query: {
            enabled: myGamesQuery.length > 0,
            refetchInterval: 10000,
        }
    });

    // Fetch user balance
    const { data: balanceData, refetch: refetchBalance, isFetching: isFetchingBalance } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    // Fetch Protocol Metrics
    const { data: totalBattles } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'nextGameId',
    });

    const { data: grandTotalVolume } = useReadContract({
        address: CARROT_GAME_ADDRESS,
        abi: CARROT_GAME_ABI,
        functionName: 'totalVolume',
    });

    const { data: currentlyEnclosed } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [CARROT_GAME_ADDRESS],
    });

    // Faucet Logic
    const { data: hash, writeContractAsync } = useWriteContract();
    const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash });

    const { data: lastMintTime, isLoading: isLoadingMintTime, refetch: refetchLastMint } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'lastMintTime',
        args: address ? [address] : undefined,
    });

    const [countdown, setCountdown] = useState<string | null>(null);
    const [cooldownExpired, setCooldownExpired] = useState(false);

    // Final claim status: 
    // Is true if we have data AND (it's 0 OR the cooldown has passed)
    const canClaim = useMemo(() => {
        if (lastMintTime === undefined || lastMintTime === null) return false;
        try {
            const lastMint = BigInt(lastMintTime.toString());
            if (lastMint === 0n) return true;
            return cooldownExpired;
        } catch (e) {
            return false;
        }
    }, [lastMintTime, cooldownExpired]);

    // Refetch when transaction succeeds
    useEffect(() => {
        if (isTxSuccess) {
            refetchLastMint();
            // Immediate refetch
            refetchBalance();
            // Delayed refetch for eventual consistency on nodes
            const timer = setTimeout(() => refetchBalance(), 5000);
            return () => clearTimeout(timer);
        }
    }, [isTxSuccess, refetchLastMint, refetchBalance]);

    useEffect(() => {
        if (lastMintTime === undefined || lastMintTime === null) return;

        const lastMint = BigInt(lastMintTime.toString());
        if (lastMint === 0n) {
            setCooldownExpired(true);
            setCountdown(null);
            return;
        }

        const updateTimer = () => {
            const nextMintAllowed = (Number(lastMint) + 24 * 60 * 60) * 1000;
            const now = Date.now();
            const diff = nextMintAllowed - now;

            if (diff <= 0) {
                setCooldownExpired(true);
                setCountdown(null);
            } else {
                setCooldownExpired(false);
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setCountdown(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [lastMintTime]);

    const handleClaim = async () => {
        try {
            await writeContractAsync({
                address: CARROT_TOKEN_ADDRESS,
                abi: CARROT_TOKEN_ABI,
                functionName: 'dailyMint'
            });
        } catch (err) {
            console.error("Mint failed:", err);
        }
    };

    const games = useMemo(() => {
        if (!openGamesData) return [];
        const [ids, stakes, creators] = openGamesData as any as [readonly bigint[], readonly bigint[], readonly string[]];
        return ids.map((id, index) => ({
            id: Number(id),
            stake: Number(formatEther(stakes[index])),
            creator: creators[index],
        }));
    }, [openGamesData]);

    const filteredGames = useMemo(() => {
        if (!searchQuery) return games;
        return games.filter(g => g.id.toString().includes(searchQuery));
    }, [games, searchQuery]);

    const myGames = useMemo(() => {
        if (!myGamesRawData || !myGameIds) return { active: [], concluded: [] };

        const ids = myGameIds as bigint[];
        const games = myGamesRawData
            .map((res, idx) => res.result ? { ...(res.result as any), id: Number(ids[idx]) } : null)
            .filter(Boolean);

        return {
            active: games.filter(g => (g as any).state < 3),
            concluded: games.filter(g => (g as any).state >= 3).sort((a, b) => Number((b as any).id) - Number((a as any).id))
        };
    }, [myGamesRawData, myGameIds]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
        >
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 md:gap-4">
                <div className="w-full">
                    <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">Game Lobby</h1>
                    <p className="text-neutral-tan text-sm font-light mt-1">Find a challenge or create your own</p>
                </div>

                <div className="flex flex-col xs:flex-row items-center gap-3 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative w-full xs:w-48">
                        <input
                            type="text"
                            placeholder="Find Game ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-field w-full pr-10 py-2.5 text-sm"
                        />
                        <Icon name="search" size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-tan" />
                    </div>

                    {/* Create Game Button */}
                    <Link to="/create" className="btn-primary flex items-center justify-center gap-2 w-full xs:w-auto px-6 py-2.5">
                        <span className="text-xs font-black uppercase whitespace-nowrap">Create Game</span>
                        <Icon name="bolt" size="sm" />
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    title="ACTIVE SESSIONS"
                    value={isLoadingGames ? "..." : `${games.length} LIVE`}
                    subtitle="LOBBY ACTIVITY"
                    icon="sports_esports"
                    statusColor="success"
                />
                <StatsCard
                    title="WALLET BALANCE"
                    value={isConnected && balanceData !== undefined ? Number(formatEther(balanceData as bigint)).toLocaleString() : "---"}
                    subtitle="TOTAL CARROT"
                    unit="CARROT"
                    imageIcon="/assets/carrot.png"
                    onRefresh={() => refetchBalance()}
                    isRefreshing={isFetchingBalance}
                    action={
                        <button
                            onClick={handleClaim}
                            disabled={!canClaim || isTxPending || isLoadingMintTime || !isConnected}
                            className={`px-3 py-1.5 text-[10px] rounded-lg font-bold transition-all ${canClaim && !isTxPending ? 'btn-secondary shadow-glow-sm' : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'}`}
                        >
                            {isTxPending || isLoadingMintTime ? '...' : canClaim ? 'CLAIM' : 'CLAIMED'}
                        </button>
                    }
                    footer={
                        countdown && (
                            <span className="text-[9px] text-primary font-mono tracking-widest mt-2 block">
                                NEXT: {countdown}
                            </span>
                        )
                    }
                />
                <StatsCard
                    title="NETWORK STATUS"
                    value="Sepolia coFHE"
                    subtitle="ENCRYPTED ORACLE ONLINE"
                    icon="verified_user"
                    statusColor="success"
                />
            </div>

            {/* Main Content Area - 3-Tab System */}
            <div className="space-y-6">
                {/* Tab Switcher */}
                <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 w-full md:max-w-2xl mx-auto backdrop-blur-xl">
                    <TabButton
                        active={activeTab === 'available'}
                        onClick={() => setActiveTab('available')}
                        icon="sports_esports"
                        label="Available"
                        count={filteredGames.length}
                    />
                    <TabButton
                        active={activeTab === 'active'}
                        onClick={() => setActiveTab('active')}
                        icon="bolt"
                        label="Active"
                        count={myGames.active.length}
                        color="text-primary"
                    />
                    <TabButton
                        active={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                        icon="history"
                        label="History"
                        count={myGames.concluded.length}
                    />
                </div>

                {/* Tab Content */}
                <div className="min-h-[400px]">
                    {activeTab === 'available' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isLoadingGames && (
                                    <>
                                        <SkeletonGameCard />
                                        <SkeletonGameCard />
                                        <SkeletonGameCard />
                                    </>
                                )}
                                {!isLoadingGames && filteredGames.length > 0 && (
                                    filteredGames.map((game) => (
                                        <GameCard key={game.id} game={game} />
                                    ))
                                )}
                                {!isLoadingGames && filteredGames.length === 0 && (
                                    <div className="col-span-full py-20 text-center glass-card border-dashed">
                                        <Icon name="search_off" size="xl" className="text-white/10 mb-4" />
                                        <p className="text-neutral-tan font-bold uppercase tracking-widest text-sm">No challenges found</p>
                                        <p className="text-neutral-tan/60 text-xs mt-1">Be the one to start the battle!</p>
                                    </div>
                                )}
                                <motion.div
                                    whileHover={{ scale: 1.02 }}
                                    onClick={() => navigate('/create')}
                                    className="glass-card p-6 flex flex-col items-center justify-center min-h-[200px] border-dashed border-2 cursor-pointer hover:border-primary transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-3">
                                        <Icon name="add" size="lg" className="text-white" />
                                    </div>
                                    <span className="font-semibold text-white">CREATE NEW LOBBY</span>
                                    <span className="text-sm text-neutral-tan mt-1 text-center">Set your stake and hide your carrot</span>
                                </motion.div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'active' && (
                        <div className="space-y-4">
                            {isConnected ? (
                                myGames.active.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {myGames.active.map((game: any) => (
                                            <MyGameCard key={game.id} game={game} userAddress={address!} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center glass-card border-dashed border-white/5 bg-white/2">
                                        <Icon name="swords" size="xl" className="text-primary/20 mb-4" />
                                        <p className="text-[var(--color-neutral-tan)] font-bold uppercase tracking-widest text-sm">No active battles</p>
                                        <p className="text-[var(--color-neutral-tan)]/60 text-xs mt-1">Accept a challenge to see it here</p>
                                    </div>
                                )
                            ) : (
                                <div className="py-20 text-center glass-card border-dashed">
                                    <p className="text-[var(--color-neutral-tan)]">Please connect your wallet to view your battles</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {isConnected ? (
                                myGames.concluded.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {myGames.concluded.map((game: any) => (
                                            <ConcludedGameCard key={game.id} game={game} userAddress={address!} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center glass-card border-dashed border-white/5 bg-white/2">
                                        <Icon name="history" size="xl" className="text-white/10 mb-4" />
                                        <p className="text-[var(--color-neutral-tan)] font-bold uppercase tracking-widest text-sm">History is empty</p>
                                        <p className="text-[var(--color-neutral-tan)]/60 text-xs mt-1">Your past matches will be recorded here</p>
                                    </div>
                                )
                            ) : (
                                <div className="py-20 text-center glass-card border-dashed">
                                    <p className="text-[var(--color-neutral-tan)]">Please connect your wallet to view your history</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Protocol Protocol Metrics */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Icon name="analytics" size="md" className="text-[var(--color-primary)]" />
                    <h3 className="font-bold text-white tracking-widest uppercase text-sm">Protocol Protocol Metrics</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <MetricItem
                        label="TOTAL BATTLES"
                        value={totalBattles ? (Number(totalBattles) - 1).toString() : "0"}
                        subtitle="INITIATED ON-CHAIN"
                        icon="swords"
                    />
                    <MetricItem
                        label="GRAND TOTAL STAKED"
                        value={grandTotalVolume ? formatEther(grandTotalVolume as bigint) : "0"}
                        subtitle="HISTORICAL VOLUME"
                        unit="CARROT"
                        isCurrency
                    />
                    <MetricItem
                        label="CURRENTLY ENCLOSED"
                        value={currentlyEnclosed ? formatEther(currentlyEnclosed as bigint) : "0"}
                        subtitle="ACTIVE TOKENS IN PLAY"
                        unit="CARROT"
                        isCurrency
                    />
                </div>
            </div>
        </motion.div>
    );
}

interface StatsCardProps {
    title: string;
    value: string;
    subtitle: string;
    unit?: string;
    icon?: string;
    imageIcon?: string;
    statusColor?: 'success' | 'primary';
    action?: React.ReactNode;
    footer?: React.ReactNode;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

function StatsCard({ title, value, subtitle, unit, icon, imageIcon, statusColor = 'primary', action, footer, onRefresh, isRefreshing }: StatsCardProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card p-5"
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-[var(--color-neutral-tan)] tracking-wide">{title}</p>
                        {onRefresh && (
                            <button
                                onClick={(e) => { e.preventDefault(); onRefresh(); }}
                                className={`p-1 rounded-md hover:bg-white/5 transition-colors ${isRefreshing ? 'animate-spin text-primary' : 'text-neutral-tan'}`}
                            >
                                <Icon name="refresh" size="xs" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-white">{value}</span>
                        {unit && <span className="text-sm text-[var(--color-primary)]">{unit}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <span className={`w-2 h-2 rounded-full ${statusColor === 'success' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]'} animate-pulse`}></span>
                        <p className="text-xs text-[var(--color-primary)]">{subtitle}</p>
                    </div>
                    {footer}
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-border-dark)] flex items-center justify-center overflow-hidden border border-white/5">
                        {imageIcon ? (
                            <img src={imageIcon} alt="Stat" className="w-7 h-7 object-contain mix-blend-screen drop-shadow-[0_0_8px_rgba(242,127,13,0.3)]" />
                        ) : icon && (
                            <Icon name={icon} size="md" className="text-[var(--color-primary)]" />
                        )}
                    </div>
                    {action}
                </div>
            </div>
        </motion.div>
    );
}

interface MyGameCardProps {
    game: any;
    userAddress: string;
}

function MyGameCard({ game, userAddress }: MyGameCardProps) {
    const { isConnected } = useAccount();
    const navigate = useNavigate();
    const { showToast } = useToast();

    // We need balance to check if user can join/play
    const { data: userBalance } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress as `0x${string}`] : undefined,
    });

    const isPlayerA = game?.playerA === userAddress;
    const opponent = isPlayerA ? game?.playerB : game?.playerA;
    const state = game?.state ?? 0;
    const gameId = game.id;
    const [timeRemaining, setTimeRemaining] = useState<string>('--:--');

    // Calculate time remaining for active games
    useEffect(() => {
        if (!game || state !== 1) return; // Only for Active games

        const updateTimer = () => {
            const joinedAt = Number(game.joinedAt) * 1000;
            const deadline = joinedAt + (60 * 60 * 1000); // 1 hour
            const now = Date.now();
            const remaining = deadline - now;

            if (remaining <= 0) {
                setTimeRemaining('EXPIRED');
            } else {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                setTimeRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [game, state]);

    const handleAction = (e: React.MouseEvent) => {
        e.preventDefault();

        // If state is 0 (Open) and user is NOT the creator (so they are about to Join)
        // We must check if they have enough balance to match the stake
        if (state === 0 && !isPlayerA) {
            if (!isConnected) {
                showToast("Connect wallet to play", "warning");
                return;
            }
            if (userBalance === undefined) return;

            if ((userBalance as bigint) < game.stake) {
                showToast("Insufficient balance. Claim from Faucet.", "error");
                return;
            }
        }

        navigate(`/game/${gameId}`);
    };

    if (!game) return null;

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card p-4 border border-[var(--color-primary)]/30"
        >
            <div className="flex items-center justify-between mb-3">
                <span className="badge-encrypted">
                    <Icon name="tag" size="sm" />
                    #{gameId}
                </span>
                <span className={`text-xs font-bold ${GameStateColors[state]}`}>
                    {GameStateLabels[state]}
                </span>
            </div>

            <div className="flex items-center gap-4 mb-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-primary/30 shadow-glow bg-black">
                    <img src={isPlayerA ? "/assets/player_a.png" : "/assets/player_b.png"} alt="Avatar" className="w-full h-full object-cover mix-blend-screen" />
                </div>
                <div>
                    <p className="text-[10px] text-neutral-tan uppercase font-black tracking-widest">Role</p>
                    <p className="text-white font-bold">{isPlayerA ? 'CREATOR' : 'CHALLENGER'}</p>
                </div>
            </div>

            <div className="space-y-2 mb-3 px-1">
                {opponent && opponent !== '0x0000000000000000000000000000000000000000' && (
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-neutral-tan)]">Opponent</span>
                        <span className="text-white font-mono text-xs">{opponent.slice(0, 6)}...{opponent.slice(-4)}</span>
                    </div>
                )}
                <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-neutral-tan)]">Stake</span>
                    <span className="text-[var(--color-primary)] font-bold">{formatEther(game.stake)} CARROT</span>
                </div>
                {state === 1 && (
                    <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-neutral-tan)]">Time Left</span>
                        <span className={`font-mono font-bold ${timeRemaining === 'EXPIRED' ? 'text-red-400' : 'text-green-400'}`}>
                            {timeRemaining}
                        </span>
                    </div>
                )}
            </div>

            <button onClick={handleAction} className="btn-secondary w-full text-center text-sm py-2">
                {state === 0 ? 'VIEW LOBBY' : state === 1 ? 'PLAY NOW' : state === 2 ? 'REVEAL' : 'VIEW RESULT'}
            </button>
        </motion.div>
    );
}

function ConcludedGameCard({ game, userAddress }: { game: any, userAddress: string }) {
    const isWinner = game.winner?.toLowerCase() === userAddress?.toLowerCase();
    const isCancelled = game.state === 4;
    const isPlayerA = game.playerA?.toLowerCase() === userAddress?.toLowerCase();
    const opponent = isPlayerA ? game.playerB : game.playerA;

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card p-4 bg-white/5 border-white/5 opacity-80 hover:opacity-100 transition-opacity"
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-neutral-tan font-mono">#{game.id}</span>
                {isCancelled ? (
                    <span className="bg-red-500/10 text-red-500 text-[10px] px-2 py-0.5 rounded font-black uppercase">Cancelled</span>
                ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${isWinner ? 'bg-success/10 text-success' : 'bg-red-500/10 text-red-500'}`}>
                        {isWinner ? 'WON' : 'LOST'}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg overflow-hidden border ${isWinner ? 'border-success/30' : 'border-red-500/30'} bg-black`}>
                    <img src={isPlayerA ? "/assets/player_a.png" : "/assets/player_b.png"} alt="Avatar" className="w-full h-full object-cover mix-blend-screen" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-neutral-tan uppercase font-black tracking-tight truncate">
                        vs {opponent.slice(0, 6)}...
                    </p>
                    <p className="text-white font-bold text-xs">
                        {formatEther(game.stake)} CARROT
                    </p>
                </div>
                {isWinner && !isCancelled && (
                    <Icon name="emoji_events" className="text-primary" size="sm" />
                )}
            </div>

            <Link
                to={`/game/${game.id}`}
                className="text-[10px] text-neutral-tan hover:text-white uppercase font-black tracking-widest text-center block w-full border-t border-white/5 pt-2 transition-colors"
            >
                View Match Summary
            </Link>
        </motion.div>
    );
}

interface GameCardProps {
    game: {
        id: number;
        creator: string;
        stake: number;
    };
}

// GameCard Component for the "Available" tab
function GameCard({ game }: GameCardProps) {
    const navigate = useNavigate();
    const { address, isConnected } = useAccount();
    const { showToast } = useToast();

    const { data: userBalance } = useReadContract({
        address: CARROT_TOKEN_ADDRESS,
        abi: CARROT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const isCreator = address && game.creator.toLowerCase() === address.toLowerCase();

    const handleChallenge = (e: React.MouseEvent) => {
        e.preventDefault();

        if (isCreator) {
            navigate(`/game/${game.id}`);
            return;
        }

        if (!isConnected) {
            showToast("Connect wallet to play", "warning");
            return;
        }

        if (userBalance === undefined) return;

        const stakeWei = parseEther(game.stake.toString());

        if ((userBalance as bigint) < stakeWei) {
            showToast("Insufficient balance. Claim from Faucet.", "error");
            return;
        }

        navigate(`/game/${game.id}`);
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02, borderColor: 'var(--color-primary)' }}
            className="glass-card p-5 space-y-4 border border-[var(--color-border-dark)] transition-all"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="badge-encrypted">
                    <Icon name="tag" size="sm" />
                    #{game.id}
                </span>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md overflow-hidden border border-white/10 bg-black">
                        <img src="/assets/player_a.png" alt="Creator" className="w-full h-full object-cover mix-blend-screen" />
                    </div>
                    <span className="text-xs text-[var(--color-neutral-tan)] font-mono">{game.creator.slice(0, 6)}...{game.creator.slice(-4)}</span>
                </div>
            </div>

            {/* Stake */}
            <div className="text-center py-4">
                <p className="text-xs text-[var(--color-neutral-tan)]">ENTRY STAKE</p>
                <p className="text-3xl font-bold text-[var(--color-primary)] mt-1">
                    {game.stake.toLocaleString()} <span className="text-lg">CARROT</span>
                </p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 text-sm">
                <Icon name="lock" size="sm" className="text-[var(--color-success)]" />
                <span className="text-[var(--color-neutral-tan)]">BOX CONTENT: ENCRYPTED</span>
            </div>

            {/* Action */}
            <button
                onClick={handleChallenge}
                className="btn-primary w-full flex items-center justify-center gap-2"
            >
                <span>{isCreator ? 'VIEW WAITING ROOM' : 'CHALLENGE'}</span>
                <Icon name="bolt" size="sm" />
            </button>
        </motion.div>
    );
}

function SkeletonGameCard() {
    return (
        <div className="glass-card p-5 space-y-4 border border-border-dark animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="skeleton h-6 w-16" />
                <div className="skeleton h-6 w-24" />
            </div>
            {/* Stake skeleton */}
            <div className="text-center py-4 space-y-2">
                <div className="skeleton h-4 w-20 mx-auto" />
                <div className="skeleton h-10 w-32 mx-auto" />
            </div>
            {/* Status skeleton */}
            <div className="flex items-center justify-center gap-2">
                <div className="skeleton h-5 w-40" />
            </div>
            {/* Button skeleton */}
            <div className="skeleton h-12 w-full rounded-full" />
        </div>
    );
}

interface MetricItemProps {
    label: string;
    value: string;
    subtitle: string;
    icon?: string;
    unit?: string;
    isCurrency?: boolean;
}

function MetricItem({ label, value, subtitle, icon, unit, isCurrency }: MetricItemProps) {
    return (
        <div className="bg-black/20 p-5 rounded-2xl border border-white/5 space-y-3">
            <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-neutral-tan uppercase tracking-[0.2em]">{label}</span>
                {icon ? (
                    <Icon name={icon} size="sm" className="text-primary/50" />
                ) : (
                    <img src="/assets/carrot.png" alt="Metric" className="w-5 h-5 object-contain mix-blend-screen opacity-50" />
                )}
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">{isCurrency ? Number(value).toLocaleString() : value}</span>
                    {unit && <span className="text-xs font-bold text-primary">{unit}</span>}
                </div>
                <p className="text-[10px] text-primary/70 font-bold mt-1 tracking-wider uppercase">{subtitle}</p>
            </div>
        </div>
    );
}

interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
    count?: number;
    color?: string;
}

function TabButton({ active, onClick, icon, label, count, color = "text-white" }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black uppercase tracking-wider text-[10px] transition-all relative overflow-hidden ${active ? `${color} bg-white/10 shadow-glow-sm border border-white/10` : 'text-neutral-tan hover:text-white hover:bg-white/5'}`}
        >
            <Icon name={icon} size="sm" className={active ? '' : 'opacity-50'} />
            {label}
            {count !== undefined && (
                <span className={`ml-1 text-[8px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary text-white' : 'bg-white/5 text-neutral-tan'}`}>
                    {count}
                </span>
            )}
            {active && (
                <motion.div
                    layoutId="tab-active"
                    className="absolute inset-0 bg-primary/5 active-glow-border pointer-events-none"
                    initial={false}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}
        </button>
    );
}

export default Lobby;

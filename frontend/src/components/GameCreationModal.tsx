import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import Icon from './Icon';

export type CreationState = 'idle' | 'processing' | 'success' | 'failure';

interface ProgressState {
    step: number;
    message: string;
}

interface GameCreationModalProps {
    state: CreationState;
    onClose: () => void;
    onRetry?: () => void;
    gameId?: string;
    stake?: number;
    error?: string;
    progress?: ProgressState;
    syncLogs?: string[];
}

export function GameCreationModal({ state, onClose, onRetry, gameId, stake, error, progress, syncLogs }: GameCreationModalProps) {
    if (state === 'idle') return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="w-full max-auto overflow-hidden"
                >
                    {state === 'processing' && <ProcessingUI progress={progress} syncLogs={syncLogs} />}
                    {state === 'success' && <SuccessUI gameId={gameId} stake={stake} onClose={onClose} />}
                    {state === 'failure' && <FailureUI error={error} onRetry={onRetry} onClose={onClose} />}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function ProcessingUI({ progress, syncLogs }: { progress?: ProgressState, syncLogs?: string[] }) {
    const currentStep = progress?.step || 1;
    const message = progress?.message || "Processing...";

    // Calculate percentages and active states based on step
    // Steps: 1=Init/Keys, 2=Encrypting Shards, 3=Encrypting Choice, 4=Broadcasting
    const percent = Math.min(100, Math.max(10, currentStep * 25));

    return (
        <div className="max-w-md mx-auto glass-card border-[1px] border-vault-purple/50 p-6 md:p-8 flex flex-col items-center bg-[#1a1425]/90">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4 md:mb-6 relative">
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                <Icon name="lock" size="md" className="text-primary" filled />
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white mb-2 text-center">Securing Your Carrot...</h2>
            <p className="text-xs md:text-sm text-neutral-tan text-center mb-6 md:mb-8">{message}</p>

            <div className="w-full mb-6 md:mb-8">
                <div className="flex justify-center mb-4">
                    <div className="px-4 md:px-6 py-2 rounded-2xl bg-primary/10 border border-primary/20 text-center">
                        <p className="text-[9px] md:text-[10px] text-neutral-tan uppercase tracking-widest mb-1">Status</p>
                        <p className="text-base md:text-lg font-black text-primary font-mono animate-pulse">{message}</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] md:text-[11px] font-bold text-white uppercase tracking-wider">
                        <span>Generating FHE Proof</span>
                        <span className="text-primary">{percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="h-full bg-primary"
                        />
                    </div>
                </div>
            </div>

            <div className="w-full space-y-3 md:space-y-4">
                <StepItem
                    icon="vpn_key"
                    title="Generating Keys"
                    status={currentStep > 1 ? "Completed" : (currentStep === 1 ? "Processing..." : "Pending")}
                    statusColor={currentStep > 1 ? "text-success" : (currentStep === 1 ? "text-primary" : "text-neutral-tan/60")}
                    active={currentStep === 1}
                />
                <StepItem
                    icon="enhanced_encryption"
                    title="Encrypting Data"
                    status={currentStep > 3 ? "Completed" : (currentStep >= 2 ? "Processing..." : "Pending")}
                    statusColor={currentStep > 3 ? "text-success" : (currentStep >= 2 ? "text-primary" : "text-neutral-tan/60")}
                    active={currentStep >= 2 && currentStep <= 3}
                />
                <StepItem
                    icon="sensors"
                    title="Broadcasting"
                    status={currentStep >= 4 ? "Processing..." : "Pending"}
                    statusColor={currentStep >= 4 ? "text-primary" : "text-neutral-tan/60"}
                    active={currentStep === 4}
                />
            </div>

            {/* Pipeline Logs */}
            {syncLogs && syncLogs.length > 0 && (
                <div className="w-full mt-6 bg-black/40 border border-white/5 rounded-xl p-3 font-mono text-[9px] overflow-hidden">
                    <div className="flex items-center gap-1.5 mb-2 opacity-50">
                        <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        <span className="uppercase tracking-[0.2em] font-black">FHE Pipeline</span>
                    </div>
                    <div className="space-y-1 opacity-60">
                        {syncLogs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-primary/40 flex-shrink-0">›</span>
                                <span className="text-neutral-tan truncate">{log}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 flex items-center gap-2 text-[9px] md:text-[10px] text-neutral-tan uppercase tracking-widest font-bold">
                <Icon name="verified_user" size="sm" filled />
                End-to-end encrypted with FHE
            </div>
        </div>
    );
}

function SuccessUI({ gameId, stake = 1, onClose }: { gameId?: string, stake?: number, onClose: () => void }) {
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/game/${gameId}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-xl mx-auto glass-card p-6 md:p-12 flex flex-col items-center bg-[#1a1612]/95 border-primary/20">
            <div className="w-20 h-20 md:w-32 md:h-32 bg-primary/10 rounded-2xl md:rounded-3xl border-2 border-primary/20 flex items-center justify-center mb-6 md:mb-8 shadow-[0_0_50px_rgba(242,127,13,0.15)]">
                <Icon name="inventory_2" key="box-icon" className="text-primary text-4xl md:text-6xl" filled />
            </div>

            <h2 className="text-2xl md:text-4xl font-black text-white mb-2 md:mb-3 tracking-tight text-center">Game Created Successfully!</h2>
            <p className="text-xs md:text-sm text-neutral-tan text-center mb-6 md:mb-10 max-w-sm">
                Your bluffing arena is ready. Time to see who can find the carrot.
            </p>

            <div className="w-full space-y-4 mb-8 md:mb-10">
                <div className="glass-card bg-white/5 border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl">
                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-2">Your Private Room</p>
                    <h3 className="text-2xl md:text-3xl font-black text-white tracking-wider">#{gameId || '...'}</h3>

                    <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 bg-black/40 border border-white/5 rounded-xl md:rounded-2xl px-4 py-3 text-xs md:text-sm text-neutral-tan truncate">
                            {window.location.origin}/game/{gameId}
                        </div>
                        <button
                            onClick={handleCopyLink}
                            className={`${copied ? 'bg-success text-white' : 'bg-primary text-black'} font-bold px-6 py-3 rounded-xl md:rounded-2xl flex items-center gap-2 hover:brightness-110 transition-all font-bold uppercase text-[10px] md:text-xs sm:min-w-[140px] justify-center`}
                        >
                            <Icon name={copied ? "check" : "content_copy"} size="sm" filled={!copied} />
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="glass-card bg-white/5 border-white/5 p-4 md:p-5 flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-neutral-tan uppercase font-bold tracking-widest">
                            <Icon name="payments" size="sm" />
                            Total Stake
                        </div>
                        <p className="text-lg md:text-xl font-black text-primary uppercase">{stake} CARROT</p>
                    </div>
                    <div className="glass-card bg-white/5 border-white/5 p-4 md:p-5 flex flex-col items-start gap-1">
                        <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-neutral-tan uppercase font-bold tracking-widest">
                            <Icon name="adjust" size="sm" />
                            Status
                        </div>
                        <p className="text-sm md:text-xl font-black text-white">Waiting for challenger...</p>
                    </div>
                </div>
            </div>

            <div className="w-full space-y-3 md:space-y-4">
                <button
                    onClick={() => {
                        onClose();
                        if (gameId) navigate(`/game/${gameId}`);
                    }}
                    className="btn-primary w-full py-4 md:py-5 text-base md:text-lg font-black uppercase tracking-widest shadow-glow-lg"
                >
                    Go to Game Room
                </button>
                <button
                    onClick={onClose}
                    className="w-full text-neutral-tan hover:text-white transition-colors text-[10px] md:text-xs font-bold uppercase tracking-widest py-2"
                >
                    Back to Dashboard
                </button>
            </div>

            <div className="mt-8 flex items-center gap-2 text-[9px] md:text-[10px] text-neutral-tan uppercase tracking-widest font-bold">
                <Icon name="verified_user" size="sm" filled />
                Secured by Fhenix FHE
            </div>
        </div>
    );
}

function FailureUI({ error = "Something went wrong", onRetry, onClose }: { error?: string, onRetry?: () => void, onClose: () => void }) {
    const isBalanceError = error.toLowerCase().includes('balance');

    return (
        <div className="max-w-md mx-auto glass-card p-6 md:p-10 flex flex-col items-center bg-[#1a0a0a]/95 border-red-500/20 shadow-[0_0_80px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/10 rounded-full border-2 border-red-500/20 flex items-center justify-center mb-6 md:mb-8 relative">
                <div className="absolute inset-0 rounded-full bg-red-500/5 animate-pulse" />
                <Icon name="history" size="md" className="text-red-500 relative z-10" />
            </div>

            <p className="text-[9px] md:text-[10px] text-red-500 font-black uppercase tracking-[0.3em] mb-2">Transmission Interrupted</p>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 md:mb-4 text-center">Game Creation Failed</h2>
            <p className="text-neutral-tan text-center text-xs md:text-sm mb-6 md:mb-8 leading-relaxed">
                The show must go on, but we hit a snag. The Fhenix network was unable to finalize your secret box selection.
            </p>

            <div className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-4 md:p-5 mb-6 md:mb-8 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <Icon name="error" size="sm" className="text-red-500" />
                    </div>
                    <div>
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mb-1">Reason for Failure</p>
                        <p className="text-xs md:text-sm text-white font-medium leading-normal">{error}</p>
                    </div>
                </div>
            </div>

            <div className="w-full space-y-3">
                {isBalanceError && (
                    <Link
                        to="/lobby"
                        onClick={onClose}
                        className="w-full bg-primary text-black font-black uppercase py-4 rounded-full flex items-center justify-center gap-2 tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow text-xs"
                    >
                        <Icon name="faucet" size="sm" filled />
                        Go to Faucet
                    </Link>
                )}
                <button
                    onClick={onRetry}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase py-4 rounded-full flex items-center justify-center gap-2 tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] text-xs"
                >
                    <Icon name="refresh" size="sm" />
                    Retry Creation
                </button>
                <button
                    onClick={onClose}
                    className="w-full bg-black/40 border border-white/5 text-white font-black uppercase py-4 rounded-full flex items-center justify-center gap-2 tracking-widest transition-all hover:bg-white/5 text-xs"
                >
                    <Icon name="door_open" size="sm" />
                    Back to Lobby
                </button>
            </div>

            <div className="mt-8 flex items-center gap-3">
                <span className="text-[9px] text-neutral-tan/50 uppercase tracking-[0.3em] font-bold">Secured by Fhenix FHE</span>
                <div className="flex gap-1.5 grayscale opacity-30">
                    <Icon name="security" size="xs" />
                    <Icon name="verified_user" size="xs" />
                    <Icon name="lock" size="xs" />
                </div>
            </div>
        </div>
    );
}

function StepItem({ icon, title, status, statusColor, active = false }: { icon: string, title: string, status: string, statusColor: string, active?: boolean }) {
    return (
        <div className="flex gap-4 items-start relative">
            <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center relative z-10 ${active ? 'bg-primary text-black' : 'bg-white/5 text-neutral-tan'}`}>
                    <Icon name={icon} size="xs" />
                </div>
                {/* Vertical Line */}
                <div className="w-[1px] h-6 bg-white/5 my-1" />
            </div>
            <div className="flex-1 -mt-0.5">
                <p className="text-[13px] font-bold text-white tracking-wide">{title}</p>
                <p className={`text-[11px] font-medium ${statusColor}`}>{status}</p>
            </div>
        </div>
    );
}

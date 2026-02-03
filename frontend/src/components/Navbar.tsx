import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { motion } from 'framer-motion';
import Icon from './Icon';
import { useState } from 'react';

function Navbar() {
    const location = useLocation();
    const { address, isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const navItems = [
        { path: '/', label: 'HOME', icon: 'home' },
        { path: '/lobby', label: 'LOBBY', icon: 'casino' },
    ];

    const truncateAddress = (addr: string) =>
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <nav className="bg-surface-2 border-b border-border-dark sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo / Branding */}
                    <Link to="/" className="flex items-center gap-3 group py-1.5 focus:outline-none">
                        <motion.div
                            className="w-10 h-10 md:w-11 md:h-11 bg-surface-3 rounded-xl flex items-center justify-center border border-white/10 relative overflow-hidden flex-shrink-0"
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        >
                            <img
                                src="/assets/carrot.png"
                                alt="Carrot"
                                className="w-6 h-6 md:w-7 md:h-7 object-contain"
                            />
                        </motion.div>

                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-primary font-black text-sm md:text-xl tracking-tight uppercase">Carrot</span>
                                <span className="text-primary font-bold text-[10px] md:text-sm opacity-70 uppercase italic">In A</span>
                                <span className="text-white font-black text-sm md:text-xl tracking-tight uppercase">Box</span>
                            </div>

                            {isConnected && (
                                <div className="flex items-center gap-1.5 -mt-0.5">
                                    <span className="text-[9px] md:text-[10px] text-neutral-tan font-mono tabular-nums opacity-60">
                                        {truncateAddress(address!)}
                                    </span>
                                    <button
                                        onClick={(e) => { e.preventDefault(); copyAddress(); }}
                                        className="text-neutral-tan/40 hover:text-primary transition-colors p-0.5"
                                    >
                                        <Icon name={copied ? 'check' : 'content_copy'} size="xs" className="scale-75" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </Link>

                    {/* Navigation Links - Desktop */}
                    <div className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`relative flex items-center gap-2 font-semibold text-sm tracking-wide px-4 py-2 rounded-lg transition-all ${location.pathname === item.path
                                    ? 'text-primary bg-primary/10'
                                    : 'text-neutral-tan hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon name={item.icon} size="sm" />
                                {item.label}
                                {location.pathname === item.path && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* Wallet & Menu - Right Side */}
                    <div className="flex items-center gap-1.5 md:gap-3">
                        {isConnected ? (
                            <button
                                onClick={() => disconnect()}
                                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-tan hover:text-red-400 transition-colors flex items-center justify-center border border-white/10"
                                title="Disconnect Wallet"
                            >
                                <Icon name="logout" size="sm" />
                            </button>
                        ) : (
                            <button
                                onClick={() => connect({ connector: connectors[0] })}
                                className="btn-primary text-xs md:text-sm h-9 md:h-10 px-4 md:px-6 flex items-center gap-2 whitespace-nowrap"
                            >
                                <Icon name="account_balance_wallet" size="sm" />
                                <span className="hidden xs:inline">Connect Wallet</span>
                                <span className="xs:hidden">Connect</span>
                            </button>
                        )}

                        {/* Mobile Menu Toggle */}
                        <button
                            className="md:hidden w-9 h-9 flex items-center justify-center text-neutral-tan hover:text-white bg-white/5 rounded-xl border border-white/10"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            <Icon name={isMenuOpen ? 'close' : 'menu'} size="md" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <motion.div
                initial={false}
                animate={isMenuOpen ? "open" : "closed"}
                variants={{
                    open: { height: 'auto', opacity: 1, display: 'block' },
                    closed: { height: 0, opacity: 0, transitionEnd: { display: 'none' } }
                }}
                className="md:hidden border-t border-[var(--color-border-dark)] bg-surface-2 overflow-hidden"
            >
                <div className="p-4 space-y-2">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center gap-3 font-semibold text-sm tracking-wide p-3 rounded-xl transition-all ${location.pathname === item.path
                                ? 'text-primary bg-primary/10 border border-primary/20'
                                : 'text-neutral-tan border border-transparent'
                                }`}
                        >
                            <Icon name={item.icon} size="md" />
                            {item.label}
                        </Link>
                    ))}
                </div>
            </motion.div>
        </nav>
    );
}

export default Navbar;

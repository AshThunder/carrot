import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';
import Icon from '../components/Icon';
import { useRef } from 'react';

function HomePage() {
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);
    const y = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

    return (
        <div ref={containerRef} className="min-h-screen bg-mesh-luxe flex flex-col relative">
            {/* Simple Background Layer */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-surface-0" />

            {/* Hero Section */}
            <section className="flex flex-col items-center justify-center text-center relative z-10 px-4 pt-4 md:pt-6 pb-8 md:pb-12">
                <motion.div
                    style={{ opacity, scale, y }}
                    className="max-w-5xl mx-auto w-full"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 md:mb-8"
                    >
                        <div className="relative w-full h-full bg-surface-2 rounded-[24px] md:rounded-[32px] border border-white/10 flex items-center justify-center overflow-hidden">
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <img
                                    src="/assets/carrot.png"
                                    alt="Carrot"
                                    className="w-12 h-12 md:w-16 md:h-16 object-contain"
                                />
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="text-4xl md:text-6xl lg:text-8xl font-black mb-6 tracking-tighter leading-none md:leading-tight"
                    >
                        <span className="text-reveal">CARROT IN A </span>
                        <span className="text-primary italic relative">
                            BOX
                            <motion.span
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ delay: 1, duration: 0.8 }}
                                className="absolute bottom-1 md:bottom-2 left-0 h-1 md:h-2 bg-primary/20 -skew-x-12 z-[-1]"
                            />
                        </span>
                    </motion.h1>

                    {/* Subheadline with better hierarchy */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 1 }}
                        className="space-y-2 mb-6 md:mb-8"
                    >
                        <p className="text-lg md:text-2xl lg:text-3xl text-neutral-tan font-light tracking-wide uppercase px-4">
                            The Ultimate On-Chain <span className="font-bold text-white">Bluffing</span> Game
                        </p>
                        <div className="flex items-center justify-center gap-2 md:gap-4 text-[10px] md:text-sm text-neutral-tan/60 font-mono tracking-widest">
                            <span className="w-6 md:w-10 h-[1px] bg-white/10" />
                            <span>POWERED BY FHENIX FHE</span>
                            <span className="w-6 md:w-10 h-[1px] bg-white/10" />
                        </div>
                    </motion.div>

                    {/* CTA Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.8 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 px-4"
                    >
                        {isConnected ? (
                            <Link
                                to="/lobby"
                                className="w-full sm:w-auto btn-primary text-base md:text-xl py-4 md:py-5 px-8 md:px-12 flex items-center justify-center gap-4 group relative overflow-hidden"
                            >
                                <span className="relative z-10 uppercase">Enter Lobby</span>
                                <Icon name="arrow_forward" size="sm" className="group-hover:translate-x-1 transition-transform relative z-10" />
                            </Link>
                        ) : (
                            <button
                                onClick={() => connect({ connector: connectors[0] })}
                                className="w-full sm:w-auto btn-primary text-base md:text-xl py-4 md:py-5 px-8 md:px-12 flex items-center justify-center gap-4 group"
                            >
                                <Icon name="account_balance_wallet" size="sm" />
                                <span className="uppercase">Connect Wallet</span>
                            </button>
                        )}
                        <Link
                            to="/lobby"
                            className="w-full sm:w-auto btn-secondary text-base md:text-xl py-4 md:py-5 px-8 md:px-10 flex items-center justify-center gap-4 group"
                        >
                            <Icon name="explore" size="sm" className="group-hover:rotate-12 transition-transform" />
                            <span className="uppercase">Explore</span>
                        </Link>
                    </motion.div>
                </motion.div>
            </section>

            {/* Feature Highlights - Dynamic Grid */}
            <section className="py-4 md:py-6 relative z-10">
                <div className="max-w-6xl mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <FeatureCard
                            icon="shield"
                            title="FHE Privacy"
                            desc="Your strategy is encrypted on-chain. No one sees your move."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon="bolt"
                            title="Fast Settlement"
                            desc="Instant encrypted wins with automated prize distribution."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon="visibility_off"
                            title="Zero Leakage"
                            desc="Public inputs, private computations. True Game Theory."
                            delay={0.3}
                        />
                        <FeatureCard
                            icon="emoji_events"
                            title="High Stakes"
                            desc="Scale your bluffs and dominate the leaderboard."
                            delay={0.4}
                        />
                    </div>
                </div>
            </section>

            {/* How It Works - Visual Timeline */}
            <section className="py-4 md:py-8 bg-black/20 backdrop-blur-sm relative border-y border-white/5">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-6 md:mb-10">
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6">The Game Flow</h2>
                        <div className="w-16 md:w-24 h-1 bg-primary mx-auto rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[60px] left-[10%] right-[10%] h-[1px] bg-white/10" />

                        <StepItem
                            num="01"
                            title="The Setup"
                            desc="Hide the carrot in a box using FHE. Your selection is cryptographically sealed."
                            icon="add_box"
                        />
                        <StepItem
                            num="02"
                            title="The Bluff"
                            desc="Your opponent must decide: do you have it? Or are you playing the double-bluff?"
                            icon="psychology"
                        />
                        <StepItem
                            num="03"
                            title="The Reveal"
                            desc="FHE comparison determines the winner. The prize is instantly sent to your vault."
                            icon="stars"
                        />
                    </div>
                </div>
            </section>

            {/* Video Section - Premium Frame */}
            <section className="py-4 md:py-6 relative overflow-hidden">
                <div className="max-w-3xl mx-auto px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="space-y-6"
                    >
                        <div className="inline-block px-4 py-1 glass-luxe rounded-full border border-white/10 text-[10px] tracking-[0.3em] text-neutral-tan uppercase">
                            Original Inspiration
                        </div>
                        <h2 className="text-4xl font-bold text-white">The Legend of Sean Lock</h2>

                        <div className="relative group">
                            <div className="relative bg-surface-2 p-2 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden aspect-video">
                                <iframe
                                    src="https://www.youtube.com/embed/0UGuPvrsG3E"
                                    title="Carrot in a Box - Original Game"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-full h-full rounded-[30px]"
                                />
                            </div>
                        </div>

                        <blockquote className="text-2xl italic text-neutral-tan leading-relaxed max-w-2xl mx-auto font-light">
                            "It's the greatest game show format ever invented. It's pure psychological warfare."
                        </blockquote>
                    </motion.div>
                </div>
            </section>

            {/* Tech Specs Section */}
            <section className="py-4 md:py-6 bg-surface-1 border-t border-white/5">
                <div className="max-w-6xl mx-auto px-4 flex flex-col lg:flex-row items-center justify-between gap-12">
                    <div className="w-full lg:w-1/2">
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Cutting-Edge Web3 Stack</h2>
                        <p className="text-neutral-tan mb-8 leading-relaxed text-sm md:text-base">
                            Carrot in a Box isn't just a game; it's a demonstration of state-of-the-art cryptography.
                            By leveraging **Fhenix's coFHE**, we enable gameplay possibilities that were previously impossible
                            on transparent blockchains.
                        </p>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                            <TechPill label="Fhenix FHEVM" />
                            <TechPill label="coFHE Oracle" />
                            <TechPill label="Encrypted State" />
                            <TechPill label="Zero Leakage" />
                        </div>
                    </div>
                    <div className="w-full lg:w-1/2 grid grid-cols-2 gap-3 md:gap-4">
                        <StatBox label="Network" value="Sepolia" />
                        <StatBox label="Protocol" value="Fhenix coFHE" />
                        <StatBox label="Security" value="Homomorphic" />
                        <StatBox label="Speed" value="Instant" />
                    </div>
                </div>
            </section>

            {/* Final CTA - Floating Luxury Card */}
            <section className="py-4 md:py-8 relative">
                <div className="max-w-4xl mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="glass-card p-8 md:p-16 rounded-[32px] md:rounded-[48px] border border-primary/20 text-center relative overflow-hidden bg-surface-2"
                    >

                        <div className="relative z-10 space-y-6 md:space-y-8">
                            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase">Ready to Bluff?</h2>
                            <p className="text-base md:text-xl text-neutral-tan max-w-lg mx-auto leading-relaxed">
                                Join the underground of on-chain psychology. Your CARROTS are waiting.
                            </p>
                            <Link
                                to="/lobby"
                                className="w-full sm:w-auto btn-primary text-sm md:text-xl py-3.5 md:py-6 px-8 md:px-16 inline-flex items-center justify-center gap-3 md:gap-4 group"
                            >
                                <Icon name="casino" size="sm" className="md:hidden" />
                                <Icon name="casino" size="md" className="hidden md:block" />
                                <span className="uppercase tracking-wider font-black">Start Your Journey</span>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 md:py-12 border-t border-white/5 bg-black/20">
                <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 text-center md:text-left">
                    <div className="flex items-center gap-3">
                        <img src="/assets/carrot.png" alt="Carrot" className="w-8 h-8" />
                        <span className="text-lg md:text-xl font-bold tracking-tighter text-white uppercase">Carrot <span className="text-primary italic">Game</span></span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-neutral-tan/60 text-[10px] md:text-sm font-medium uppercase tracking-[0.2em]">
                        <a href="https://fhenix.io" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Fhenix</a>
                        <a href="https://x.com/ChrisGold__" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Twitter</a>
                        <a href="https://github.com/ashThunder/carrot" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">GitHub</a>
                    </div>
                    <p className="text-[10px] text-neutral-tan/40 uppercase tracking-widest font-mono">
                        © 2026 • Encrypted on Fhenix
                    </p>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string, delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5 }}
            whileHover={{ y: -5 }}
            className="glass-luxe p-8 rounded-[32px] border border-white/5 hover:border-primary/20 group"
        >
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                <Icon name={icon} size="md" className="text-neutral-tan group-hover:text-primary transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-sm text-neutral-tan leading-relaxed">{desc}</p>
        </motion.div>
    );
}

function StepItem({ num, title, desc, icon }: { num: string; title: string; desc: string, icon: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col items-center text-center group"
        >
            <div className="relative mb-8">
                <div className="text-8xl font-black text-white/5 select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:text-primary/5 transition-colors">
                    {num}
                </div>
                <div className="relative w-20 h-20 glass-luxe rounded-full flex items-center justify-center border border-white/10 group-hover:border-primary/40 transition-colors shadow-xl">
                    <Icon name={icon} size="md" className="text-white group-hover:text-primary transition-colors" />
                </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 italic tracking-tight">{title}</h3>
            <p className="text-neutral-tan text-sm max-w-[240px] leading-relaxed font-light">{desc}</p>
        </motion.div>
    );
}

function TechPill({ label }: { label: string }) {
    return (
        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono tracking-[1px] text-neutral-tan uppercase">
            {label}
        </div>
    );
}

function StatBox({ label, value }: { label: string, value: string }) {
    return (
        <div className="glass-luxe p-6 rounded-2xl border border-white/5">
            <p className="text-[10px] text-neutral-tan/50 uppercase tracking-[2px] mb-1">{label}</p>
            <p className="text-xl font-bold text-white tracking-tight italic">{value}</p>
        </div>
    );
}

export default HomePage;

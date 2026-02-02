import { useState, createContext, useContext, useCallback, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from '../components/Icon';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 50, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95, transition: { duration: 0.2 } }}
                            className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[320px] max-w-md ${toast.type === 'success' ? 'bg-success/10 border-success/40 text-success' :
                                toast.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-500' :
                                    toast.type === 'warning' ? 'bg-primary/10 border-primary/40 text-primary' :
                                        'bg-white/10 border-white/20 text-white'
                                }`}
                        >
                            <div className={`p-2 rounded-xl bg-current/10`}>
                                <Icon
                                    name={
                                        toast.type === 'success' ? 'check_circle' :
                                            toast.type === 'error' ? 'error' :
                                                toast.type === 'warning' ? 'warning' : 'info'
                                    }
                                    size="sm"
                                />
                            </div>
                            <p className="flex-1 text-sm font-bold tracking-tight uppercase leading-tight">
                                {toast.message}
                            </p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="opacity-40 hover:opacity-100 transition-opacity"
                            >
                                <Icon name="close" size="xs" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
}

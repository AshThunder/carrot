import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Fhenix Helium Testnet Chain Definition
// Fhenix Helium removed (using Sepolia)

// WalletConnect Project ID (you should replace this with your own)
const walletConnectProjectId = 'YOUR_PROJECT_ID';

export const config = createConfig({
    chains: [sepolia],
    connectors: [
        injected(),
        walletConnect({ projectId: walletConnectProjectId }),
    ],
    transports: {
        [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    },
});

declare module 'wagmi' {
    interface Register {
        config: typeof config;
    }
}

import { BrowserProvider } from 'ethers';
import { cofhejs, Encryptable, FheTypes } from 'cofhejs/web';

export { FheTypes };
export const MAX_EUINT64 = BigInt("18446744073709551615");

// Global singleton to hold the SDK instance
let cofheInstance: any = null;
let initializationPromise: Promise<any> | null = null;
type CofheSDK = typeof cofhejs;

// Log subscriber system
type LogCallback = (msg: string) => void;
const subscribers: LogCallback[] = [];

export function subscribeToCofheLogs(cb: LogCallback) {
    subscribers.push(cb);
    return () => {
        const idx = subscribers.indexOf(cb);
        if (idx !== -1) subscribers.splice(idx, 1);
    };
}

export function pushLog(msg: string) {
    console.log(msg); // Keep console log too
    subscribers.forEach(cb => cb(msg));
}

/**
 * Initialize the coFHE client using static imports
 */
export async function getCofheClient(): Promise<CofheSDK> {
    if (cofheInstance) return cofheInstance;
    if (initializationPromise) return initializationPromise;

    if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('No ethereum provider found');
    }

    initializationPromise = (async () => {
        try {
            pushLog('🚀 Initializing coFHE SDK...');
            const provider = new BrowserProvider((window as any).ethereum);

            // Switch to Sepolia
            try {
                await (window as any).ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0xaa36a7" }],
                });
            } catch (e) {
                console.warn("Chain switch failed/rejected", e);
            }

            const signer = await provider.getSigner();

            const result = await cofhejs.initializeWithEthers({
                ethersProvider: provider,
                ethersSigner: signer,
                environment: "TESTNET",
                generatePermit: true,
                securityZones: [0],
            });

            const activePermit = await cofhejs.getPermit();
            const sdkState = cofhejs.store.getState();

            pushLog(`✅ coFHE SDK Initialized {chainId: '${sdkState.chainId}', permit: '${result.data ? 'Generated' : 'Not generated'}', activePermit: '${activePermit.success ? 'Ready' : 'Missing'}'}`);

            if (activePermit.success && activePermit.data.issuer.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
                console.warn('⚠️ Permit issuer mismatch! Clearing permits...');
                const hash = activePermit.data.getHash();
                cofhejs.removePermit(hash, true);
            }

            cofheInstance = cofhejs;
            return cofhejs;
        } catch (err) {
            console.error('❌ coFHE Init Failed:', err);
            initializationPromise = null;
            throw err;
        }
    })();

    return initializationPromise;
}

/**
 * Manually trigger permit generation
 */
export async function reauthorize() {
    const cofhe = await getCofheClient();
    console.log('🔄 Requesting fresh permit...');

    // Clear existing permits for this account to be safe
    const currentPermits = cofhe.getAllPermits();
    if (currentPermits.success) {
        Object.keys(currentPermits.data).forEach(hash => {
            console.log('🗑️ Removing old permit:', hash);
            cofhe.removePermit(hash, true);
        });
    }

    const result = await cofhe.createPermit();
    if (!result.success) {
        console.error('❌ Reauthorization failed:', result.error);
        throw result.error;
    }
    console.log('✅ Fresh permit obtained');
    return result.data;
}

/**
 * Encrypt a value for coFHE input
 */
export async function encryptEbool(value: boolean) {
    await getCofheClient();
    const item = Encryptable.bool(value);
    const result = await cofhejs.encrypt([item]);
    if (!result.success) throw result.error;
    return result.data[0];
}

export async function encryptEuint64(value: number | bigint) {
    await getCofheClient();
    const item = Encryptable.uint64(BigInt(value));
    const result = await cofhejs.encrypt([item]);
    if (!result.success) throw result.error;
    return result.data[0];
}

/**
 * Unseal a ciphertext hash
 */
export async function unsealValue(ctHash: bigint | string, utype: number, account?: string) {
    const cofhe = await getCofheClient();
    const hash = typeof ctHash === 'string' ? BigInt(ctHash) : ctHash;
    pushLog(`[coFHE] Unsealing Hash: ${hash.toString()}`);

    try {
        const result = await cofhe.unseal(hash, utype, account);

        if (!result.success) {
            console.error('[coFHE] Unseal Failed:', result.error);
            if (result.error.message?.includes('Forbidden') || result.error.message?.includes('authorized')) {
                console.error('💡 TIP: Check if you have the Fhenix Browser Extension installed and authorized for this site.');
            }
            throw result.error;
        }
        return result.data;
    } catch (err) {
        throw err;
    }
}

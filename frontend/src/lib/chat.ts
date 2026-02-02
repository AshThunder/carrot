import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { keccak256, toHex, fromHex, type Hex } from 'viem';

export interface ChatKeys {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}

// Convert Uint8Array to Hex string (0x...) for contract interactions
export function publicKeyToHex(publicKey: Uint8Array): Hex {
    return toHex(publicKey);
}

// Convert Hex string to Uint8Array for encryption
export function hexToPublicKey(hex: string): Uint8Array {
    return fromHex(hex as Hex, 'bytes');
}

// Derive keys from a signature (deterministic)
export function deriveKeysFromSignature(signature: string): ChatKeys {
    // Hash signature to get 32 bytes of entropy
    const entropy = keccak256(signature as Hex);
    // Remove 0x and convert to Uint8Array
    const secretKeySeed = fromHex(entropy, 'bytes');
    return nacl.box.keyPair.fromSecretKey(secretKeySeed);
}

// Encrypt a message
export function encryptMessage(
    message: string,
    theirPublicKey: Uint8Array,
    mySecretKey: Uint8Array
): string {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = decodeUTF8(message);
    const encryptedBox = nacl.box(messageBytes, nonce, theirPublicKey, mySecretKey);

    // Combine nonce and box for transport
    const fullMessage = new Uint8Array(nonce.length + encryptedBox.length);
    fullMessage.set(nonce);
    fullMessage.set(encryptedBox, nonce.length);

    return encodeBase64(fullMessage);
}

// Decrypt a message
export function decryptMessage(
    encodedMessage: string,
    theirPublicKey: Uint8Array,
    mySecretKey: Uint8Array
): string | null {
    try {
        const fullMessage = decodeBase64(encodedMessage);
        const nonce = fullMessage.slice(0, nacl.box.nonceLength);
        const box = fullMessage.slice(nacl.box.nonceLength);

        const decrypted = nacl.box.open(box, nonce, theirPublicKey, mySecretKey);

        if (!decrypted) return null;
        return encodeUTF8(decrypted);
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}

// Split 32-byte key into 4x64-bit shards for FHE storage
export function splitKey(key: Uint8Array): bigint[] {
    if (key.length !== 32) throw new Error("Key must be 32 bytes");
    const view = new DataView(key.buffer, key.byteOffset, key.byteLength);
    const shards: bigint[] = [];
    for (let i = 0; i < 4; i++) {
        shards.push(view.getBigUint64(i * 8, true)); // Little Endian
    }
    return shards;
}

// Reconstruct 32-byte key from 4x64-bit shards
export function joinKey(shards: bigint[]): Uint8Array {
    if (shards.length !== 4) throw new Error("Must provide 4 shards");
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    shards.forEach((shard, i) => {
        view.setBigUint64(i * 8, shard, true);
    });
    return new Uint8Array(buffer);
}

// Generate a random game keypair (ephemeral)
export function generateGameKeys(): ChatKeys {
    return nacl.box.keyPair();
}

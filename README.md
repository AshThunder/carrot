# 🥕 Carrot In A Box - Fhenix Edition

A high-fidelity, privacy-preserving bluffing game powered by **Fhenix coFHE**. This project demonstrates the power of Fully Homomorphic Encryption (FHE) on-chain, allowing players to make secret moves and bluff without revealing their actual state to the public or the network until the final resolution.

<img src="frontend/public/assets/carrot.png" width="300" alt="Carrot Game" />

## 🎮 The Game Concept
Based on the classic "Carrot in a Box" game, this version adds a layer of cryptographic security.
- **Creator**: Hides a carrot in one of two boxes. This choice is **encrypted** using FHE and stored on-chain.
- **Challenger**: Joins the match, matching the stake. They see their own box but don't know where the carrot is.
- **The Bluff**: Players exchange messages in an encrypted chat. The Creator tries to convince the Challenger to swap (or not), while the Challenger tries to read the Creator's bluff.
- **The Reveal**: The final outcome is unsealed using coFHE, and the winner (whoever ends up with the carrot) takes the pot.

---

## 🛠️ Technical Stack

### **Smart Contracts (Solidity)**
- **@fhenixprotocol/contracts**: Core library for handled encrypted types (`ebool`, `euint64`).
- **State Confidentiality**: The `playerAHasCarrot` state is stored as an encrypted boolean.
- **coFHE Integration**: Optimized for the Fhenix Gateway unsealing process running on the Sepolia network.

### **Frontend (Vite + React)**
- **coFHE.js**: Client-side SDK for encrypting user inputs and managing unsealing permissions (Permits).
- **Wagmi & Viem**: Robust Ethereum hooks and utilities for Sepolia interaction.
- **Framer Motion**: Premium "Cyber-Luxury" animations and transitions.
- **Tailwind CSS**: Custom design system for a dark, high-tech aesthetic.


---

## 🚀 Installation & Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Browser Wallet**: MetaMask or any EIP-1193 compatible wallet.

### 2. Network Configuration
The project is currently deployed on the **Sepolia** testnet. Ensure your wallet is connected to Sepolia:
- **Network Name**: Sepolia
- **RPC URL**: `https://rpc.ankr.com/eth_sepolia` (or any Sepolia RPC)
- **Chain ID**: `11155111`
- **Currency Symbol**: `ETH`
- **Block Explorer**: [sepolia.etherscan.io](https://sepolia.etherscan.io)

### 3. Get Testnet Funds
- **Native Gas (ETH)**: Use any Sepolia faucet such as:
  - [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
  - [Google Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- **Game Tokens (CARROT)**: Once connected to the dApp, use the **daily faucet** in the Lobby or directly within a Game Room if your balance is low.

### 4. Local Development
```bash
# Clone and install
npm install
cd frontend && npm install

# Start the dev server
npm run dev
```

---

## 📑 Project Structure
- `/contracts`: Hardhat environment for FHE smart contracts.
- `/frontend`: The React dApp.
  - `src/lib/cofhe.ts`: coFHE SDK initialization and unsealing logic.
  - `src/lib/chat.ts`: P2P encryption utilities for the bluff chat.
  - `src/pages/Game.tsx`: The core game loop and unsealing orchestrator.
- `.env.example`: Template for environment variables.

---

## 🛡️ Privacy & Security Features
- **Input Encryption**: Your choice (Carrot location) is encrypted *locally* before being sent to the blockchain.
- **coFHE Permits**: The dApp uses a permission-based unsealing system. Only the dApp, authorized by the user, can request an unseal from the Fhenix Gateway.
- **Pipeline Visibility**: The **FHE Pipeline Console** in-game provides real-time logs of the encryption handshake, ensuring technical transparency.

---

## 🌐 The Vision: Privacy as a DeFi Standard
Carrot In A Box is more than just a game; it is a demonstration that **on-chain privacy is ready for all DeFi projects.**

Traditional DeFi often forces users to leak their strategies and intents to the public mempool, inviting front-running and exploitation. By utilizing Fhenix's coFHE technology, we prove that:
1. **Confidential Transactions** can be fast, reliable, and user-friendly.
2. **Hidden State** (like a hidden carrot or a secret swap) allows for more complex, game-theoretic financial instruments that were previously impossible.


## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

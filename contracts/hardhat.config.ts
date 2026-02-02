import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const INFURA_API_KEY = process.env.INFURA_API_KEY || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.25",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
            evmVersion: "cancun",
        },
    },
    networks: {
        hardhat: {
            chainId: 31337,
        },
        sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
        fhenixHelium: {
            url: "https://api.helium.fhenix.zone",
            chainId: 8008135,
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;

import { ethers } from "hardhat";

async function main() {
    console.log("Deploying contracts...");

    // 1. Deploy CarrotToken
    const CarrotToken = await ethers.getContractFactory("CarrotToken");
    const carrotToken = await CarrotToken.deploy();
    await carrotToken.waitForDeployment();
    const carrotTokenAddress = await carrotToken.getAddress();
    console.log(`CarrotToken deployed to: ${carrotTokenAddress}`);

    // 2. Deploy CarrotInABoxGame
    const CarrotInABoxGame = await ethers.getContractFactory("CarrotInABoxGame");
    const game = await CarrotInABoxGame.deploy(carrotTokenAddress);
    await game.waitForDeployment();
    const gameAddress = await game.getAddress();
    console.log(`CarrotInABoxGame deployed to: ${gameAddress}`);

    console.log("\nDeployment Summary:");
    console.log("-------------------");
    console.log(`CarrotToken: ${carrotTokenAddress}`);
    console.log(`CarrotInABoxGame: ${gameAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

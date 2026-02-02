// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CarrotToken
 * @notice Standard ERC-20 token with a 24h faucet.
 * @dev Simplified version: Removed all private coFHE balance logic.
 */
contract CarrotToken is ERC20, Ownable {
    // Daily mint tracking
    mapping(address => uint256) public lastMintTime;
    
    // Constants
    uint256 public constant DAILY_MINT_AMOUNT = 100 * 10**18;
    uint256 public constant MINT_COOLDOWN = 24 hours;
    
    // Events
    event DailyMintClaimed(address indexed user, uint256 amount);
    
    constructor() ERC20("Carrot Token", "CARROT") Ownable(msg.sender) {}
    
    /**
     * @notice Claim daily CARROT tokens from the faucet
     */
    function dailyMint() external {
        require(canMint(msg.sender), "CarrotToken: Must wait 24 hours between mints");
        lastMintTime[msg.sender] = block.timestamp;
        _mint(msg.sender, DAILY_MINT_AMOUNT);
        emit DailyMintClaimed(msg.sender, DAILY_MINT_AMOUNT);
    }
    
    function canMint(address user) public view returns (bool) {
        return block.timestamp >= lastMintTime[user] + MINT_COOLDOWN;
    }
}

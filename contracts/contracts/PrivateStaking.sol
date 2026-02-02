// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint64, InEuint64, ebool} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICarrotToken {
    function addPrivateBalance(address user, euint64 amount) external;
    function subtractPrivateBalance(address user, euint64 amount) external;
    function getPrivateBalanceEncrypted(address user) external view returns (euint64);
}

/**
 * @title PrivateStaking
 * @notice inflation-based staking with coFHE-encrypted stake amounts
 * @dev Re-implemented for coFHE on standard networks.
 */
contract PrivateStaking is Ownable, ReentrancyGuard {
    ICarrotToken public carrotToken;
    
    // User stakes (encrypted hashes)
    mapping(address => euint64) private _stakes;
    mapping(address => uint256) private _stakeTimestamp;
    
    // Pool tracking
    euint64 private _totalStaked;
    uint256 public totalStakers; // Approximation (users who called stake)
    mapping(address => bool) public isStaker;
    
    // APR settings (basis points)
    uint256 public constant BASE_APR = 12480; // 124.8%
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Events
    event Staked(address indexed user, uint256 timestamp);
    event Unstaked(address indexed user, uint256 timestamp);
    
    constructor(address _carrotToken) Ownable(msg.sender) {
        carrotToken = ICarrotToken(_carrotToken);
        _totalStaked = FHE.asEuint64(0);
        FHE.allowThis(_totalStaked);
    }
    
    /**
     * @notice Stake private CARROT tokens
     */
    function stakePrivate(InEuint64 calldata encryptedAmount) external nonReentrant {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        FHE.allowThis(amount);
        
        // Compound pending rewards first (in FHE space)
        _compoundRewards(msg.sender);
        
        // Transfer from user's private balance to staking
        carrotToken.subtractPrivateBalance(msg.sender, amount);
        
        // Add to stake
        if (!isStaker[msg.sender]) {
            isStaker[msg.sender] = true;
            totalStakers++;
        }
        
        _stakes[msg.sender] = FHE.add(_stakes[msg.sender], amount);
        FHE.allowThis(_stakes[msg.sender]);
        FHE.allow(_stakes[msg.sender], msg.sender);
        
        _totalStaked = FHE.add(_totalStaked, amount);
        FHE.allowThis(_totalStaked);
        
        _stakeTimestamp[msg.sender] = block.timestamp;
        
        emit Staked(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Unstake private CARROT tokens
     */
    function unstakePrivate(InEuint64 calldata encryptedAmount) external nonReentrant {
        euint64 amount = FHE.asEuint64(encryptedAmount);
        FHE.allowThis(amount);
        
        // Compound rewards first
        _compoundRewards(msg.sender);
        
        // Verify sufficient stake (using FHE branchless logic)
        euint64 currentStake = _stakes[msg.sender];
        euint64 amountToUnstake = FHE.select(FHE.lte(amount, currentStake), amount, FHE.asEuint64(0));
        FHE.allowThis(amountToUnstake);
        
        // Subtract from stake
        _stakes[msg.sender] = FHE.sub(currentStake, amountToUnstake);
        FHE.allowThis(_stakes[msg.sender]);
        FHE.allow(_stakes[msg.sender], msg.sender);
        
        _totalStaked = FHE.sub(_totalStaked, amountToUnstake);
        FHE.allowThis(_totalStaked);
        
        // Return to user's private balance
        carrotToken.addPrivateBalance(msg.sender, amountToUnstake);
        
        emit Unstaked(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Internal function to compound rewards in FHE space
     */
    function _compoundRewards(address user) internal {
        if (_stakeTimestamp[user] == 0) return;
        
        uint256 timeElapsed = block.timestamp - _stakeTimestamp[user];
        if (timeElapsed == 0) return;
        
        // Calculate reward: (stake * APR * time) / (year * 10000)
        euint64 eAPR = FHE.asEuint64(uint64(BASE_APR));
        euint64 eTime = FHE.asEuint64(uint64(timeElapsed));
        FHE.allowThis(eAPR);
        FHE.allowThis(eTime);
        
        // mul(mul(stake, apr), time)
        euint64 product = FHE.mul(FHE.mul(_stakes[user], eAPR), eTime);
        FHE.allowThis(product);
        
        // product / (seconds_per_year * 10000)
        euint64 denominator = FHE.asEuint64(uint64(SECONDS_PER_YEAR * 10000));
        FHE.allowThis(denominator);
        
        euint64 reward = FHE.div(product, denominator);
        FHE.allowThis(reward);
        
        _stakes[user] = FHE.add(_stakes[user], reward);
        FHE.allowThis(_stakes[user]);
        FHE.allow(_stakes[user], user);
        
        _totalStaked = FHE.add(_totalStaked, reward);
        FHE.allowThis(_totalStaked);
        
        _stakeTimestamp[user] = block.timestamp;
    }
    
    /**
     * @notice Get encrypted stake hash for frontend use
     */
    function encryptedStakeOf(address user) external view returns (euint64) {
        return _stakes[user];
    }
    
    function getTotalStakedEncrypted() external view returns (euint64) {
        return _totalStaked;
    }
}

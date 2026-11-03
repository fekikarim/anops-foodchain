// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  FoodChainToken (FCT)
 * @author Karim Feki
 * @notice ERC-20 reward token for supply chain actors.
 *         Only authorised callers (the NFT contract) can issue rewards.
 *         Each unique operationId can only be rewarded once.
 */
contract FoodChainToken is ERC20, Ownable, Pausable {

    // ─── Events ────────────────────────────────────────────────────────────
    event RewardIssued(
        address indexed actor,
        uint256 amount,
        bytes32 indexed operationId
    );
    event RewardAmountUpdated(bytes32 indexed actionType, uint256 newAmount);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // ─── State ─────────────────────────────────────────────────────────────
    mapping(address => bool)   public authorizedCallers;
    mapping(bytes32  => bool)  public rewardedOperations;   // anti-double reward
    mapping(bytes32  => uint256) public rewardAmounts;      // FCT per action type

    // ─── Action type constants ──────────────────────────────────────────────
    bytes32 public constant ACTION_REGISTER = keccak256("REGISTER_BATCH");
    bytes32 public constant ACTION_SHIP     = keccak256("SHIP_BATCH");
    bytes32 public constant ACTION_RECEIVE  = keccak256("RECEIVE_BATCH");
    bytes32 public constant ACTION_DELIVER  = keccak256("DELIVER_BATCH");

    // 1,000,000 FCT (18 decimals)
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor() ERC20("FoodChainToken", "FCT") {
        // In OZ v4, Ownable() sets owner = msg.sender automatically
        _mint(msg.sender, INITIAL_SUPPLY);

        // Default reward amounts
        rewardAmounts[ACTION_REGISTER] = 10 * 10 ** 18;  // 10 FCT
        rewardAmounts[ACTION_SHIP]     =  3 * 10 ** 18;  //  3 FCT
        rewardAmounts[ACTION_RECEIVE]  =  5 * 10 ** 18;  //  5 FCT
        rewardAmounts[ACTION_DELIVER]  =  5 * 10 ** 18;  //  5 FCT
    }

    // ─── Modifier ──────────────────────────────────────────────────────────
    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || authorizedCallers[msg.sender],
            "FCT: Caller not authorized"
        );
        _;
    }

    // ─── Core reward function ──────────────────────────────────────────────

    /**
     * @notice Transfer FCT from the owner reward pool to an actor.
     * @param actor       Address to receive the reward.
     * @param amount      Amount of FCT (with 18 decimals).
     * @param operationId Unique bytes32 ID for this operation (prevents duplicates).
     */
    function rewardActor(
        address actor,
        uint256 amount,
        bytes32 operationId
    ) external onlyAuthorized whenNotPaused {
        require(actor != address(0),              "FCT: Invalid actor address");
        require(amount > 0,                       "FCT: Amount must be positive");
        require(!rewardedOperations[operationId], "FCT: Operation already rewarded");
        require(balanceOf(owner()) >= amount,     "FCT: Reward pool insufficient");

        rewardedOperations[operationId] = true;      // mark BEFORE transfer
        _transfer(owner(), actor, amount);            // internal ERC-20 transfer

        emit RewardIssued(actor, amount, operationId);
    }

    // ─── Admin functions ───────────────────────────────────────────────────

    /// @notice Update the FCT reward for a given action type.
    function setRewardAmount(bytes32 actionType, uint256 amount)
        external onlyOwner
    {
        rewardAmounts[actionType] = amount;
        emit RewardAmountUpdated(actionType, amount);
    }

    /// @notice Authorize or revoke an address (e.g., the NFT contract).
    function setAuthorizedCaller(address caller, bool authorized)
        external onlyOwner
    {
        require(caller != address(0), "FCT: Invalid caller address");
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── View helpers ──────────────────────────────────────────────────────

    function getRewardAmount(bytes32 actionType)
        external view returns (uint256)
    {
        return rewardAmounts[actionType];
    }

    function isOperationRewarded(bytes32 operationId)
        external view returns (bool)
    {
        return rewardedOperations[operationId];
    }
}
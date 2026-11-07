// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  FoodChainToken (FCT)
 * @author Karim Feki
 * @notice ERC-20 reward token (points) for supply-chain actors.
 *
 *  Design
 *  ──────
 *  • Standard ERC-20 (OpenZeppelin) – transfer / approve / transferFrom work for everybody.
 *  • Rewards are paid from the *reward pool* = the owner's balance.
 *  • The NFT contract is an "authorized caller": it can only call `rewardForAction`,
 *    which looks the amount up in the on-chain reward schedule – it can NEVER choose
 *    an arbitrary amount. Free-form payouts (`rewardActor`) are owner-only.
 *  • Every operationId can be rewarded once (anti double-reward).
 *  • The owner can top-up the pool with `mint`, hard-capped by MAX_SUPPLY.
 *
 *  FCT are demo loyalty points – they are not money.
 */
contract FoodChainToken is ERC20, Ownable, Pausable {

    // ─── Events ────────────────────────────────────────────────────────────
    event RewardIssued(address indexed actor, uint256 amount, bytes32 indexed operationId);
    /// @dev Companion of RewardIssued: tells the UI *why* a reward was paid.
    event RewardAction(bytes32 indexed operationId, bytes32 indexed actionType, address indexed caller);
    event RewardAmountUpdated(bytes32 indexed actionType, uint256 newAmount);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event PoolToppedUp(address indexed by, uint256 amount, uint256 newTotalSupply);

    // ─── Storage ───────────────────────────────────────────────────────────
    mapping(address => bool)    public authorizedCallers;
    mapping(bytes32 => bool)    public rewardedOperations;   // anti-double reward
    mapping(bytes32 => uint256) public rewardAmounts;        // FCT per action type

    mapping(address => uint256) public rewardsReceived;      // lifetime FCT rewarded
    mapping(address => uint256) public rewardCount;          // number of rewards
    uint256 public totalRewarded;

    // ─── Action types ──────────────────────────────────────────────────────
    bytes32 public constant ACTION_REGISTER = keccak256("REGISTER_BATCH");
    bytes32 public constant ACTION_SHIP     = keccak256("SHIP_BATCH");
    bytes32 public constant ACTION_RECEIVE  = keccak256("RECEIVE_BATCH");
    bytes32 public constant ACTION_DELIVER  = keccak256("DELIVER_BATCH");

    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;
    uint256 public constant MAX_SUPPLY     = 5_000_000 * 10 ** 18;

    constructor() ERC20("FoodChainToken", "FCT") {
        _mint(msg.sender, INITIAL_SUPPLY);

        rewardAmounts[ACTION_REGISTER] = 10 * 10 ** 18;
        rewardAmounts[ACTION_SHIP]     =  3 * 10 ** 18;
        rewardAmounts[ACTION_RECEIVE]  =  5 * 10 ** 18;
        rewardAmounts[ACTION_DELIVER]  =  5 * 10 ** 18;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || authorizedCallers[msg.sender],
            "FCT: Caller not authorized to issue rewards"
        );
        _;
    }

    // ─── Rewards ───────────────────────────────────────────────────────────

    /**
     * @notice Pay the scheduled reward of `actionType` to `actor`.
     *         This is the function the NFT contract uses.
     */
    function rewardForAction(address actor, bytes32 actionType, bytes32 operationId)
        external onlyAuthorized whenNotPaused
    {
        uint256 amount = rewardAmounts[actionType];
        require(amount > 0, "FCT: No reward configured for this action");
        _reward(actor, amount, operationId);
        emit RewardAction(operationId, actionType, msg.sender);
    }

    /**
     * @notice Free-form reward (custom amount). Owner only.
     */
    function rewardActor(address actor, uint256 amount, bytes32 operationId)
        external onlyOwner whenNotPaused
    {
        require(amount > 0, "FCT: Amount must be positive");
        _reward(actor, amount, operationId);
        emit RewardAction(operationId, bytes32(0), msg.sender);
    }

    function _reward(address actor, uint256 amount, bytes32 operationId) internal {
        require(actor != address(0),               "FCT: Invalid actor address");
        require(!rewardedOperations[operationId],  "FCT: Operation already rewarded");
        require(balanceOf(owner()) >= amount,      "FCT: Reward pool insufficient");

        rewardedOperations[operationId] = true;     // effects before interaction
        rewardsReceived[actor] += amount;
        rewardCount[actor]     += 1;
        totalRewarded          += amount;
        _transfer(owner(), actor, amount);

        emit RewardIssued(actor, amount, operationId);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────

    function setRewardAmount(bytes32 actionType, uint256 amount) external onlyOwner {
        rewardAmounts[actionType] = amount;
        emit RewardAmountUpdated(actionType, amount);
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "FCT: Invalid caller address");
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /// @notice Top-up the reward pool (minted to the owner), capped by MAX_SUPPLY.
    function mint(uint256 amount) external onlyOwner {
        require(amount > 0, "FCT: Amount must be positive");
        require(totalSupply() + amount <= MAX_SUPPLY, "FCT: Max supply exceeded");
        _mint(owner(), amount);
        emit PoolToppedUp(msg.sender, amount, totalSupply());
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getRewardAmount(bytes32 actionType) external view returns (uint256) {
        return rewardAmounts[actionType];
    }

    function isOperationRewarded(bytes32 operationId) external view returns (bool) {
        return rewardedOperations[operationId];
    }

    function rewardPool() public view returns (uint256) {
        return balanceOf(owner());
    }

    function getRewardSchedule()
        external view returns (bytes32[] memory actionTypes, uint256[] memory amounts)
    {
        actionTypes = new bytes32[](4);
        amounts     = new uint256[](4);
        actionTypes[0] = ACTION_REGISTER; amounts[0] = rewardAmounts[ACTION_REGISTER];
        actionTypes[1] = ACTION_SHIP;     amounts[1] = rewardAmounts[ACTION_SHIP];
        actionTypes[2] = ACTION_RECEIVE;  amounts[2] = rewardAmounts[ACTION_RECEIVE];
        actionTypes[3] = ACTION_DELIVER;  amounts[3] = rewardAmounts[ACTION_DELIVER];
    }

    /// @notice One-call snapshot for dashboards.
    function getOverview() external view returns (
        uint256 supply,
        uint256 maxSupply,
        uint256 pool,
        uint256 rewarded,
        bool    isPaused,
        address admin
    ) {
        return (totalSupply(), MAX_SUPPLY, rewardPool(), totalRewarded, paused(), owner());
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title  FoodBatchNFT (FBP)
 * @author Nesrine Derouiche
 * @notice ERC-721 digital passport for food batches.
 *         Each NFT = one unique food lot tracked through the supply chain.
 *         Calls FoodChainToken to reward actors after validated steps.
 */

// ─── Minimal interface so NFT can call FCT ─────────────────────────────────
interface IFoodChainToken {
    function rewardActor(address actor, uint256 amount, bytes32 operationId) external;
    function getRewardAmount(bytes32 actionType) external view returns (uint256);
    function ACTION_REGISTER() external view returns (bytes32);
    function ACTION_SHIP()     external view returns (bytes32);
    function ACTION_RECEIVE()  external view returns (bytes32);
    function ACTION_DELIVER()  external view returns (bytes32);
}

contract FoodBatchNFT is ERC721, Ownable {
    using Counters for Counters.Counter;

    // ─── Token ID counter ──────────────────────────────────────────────────
    Counters.Counter private _tokenIdCounter;

    // ─── FCT contract ──────────────────────────────────────────────────────
    IFoodChainToken public foodChainToken;

    // ─── Roles ─────────────────────────────────────────────────────────────
    uint8 public constant ROLE_NONE        = 0;
    uint8 public constant ROLE_FARMER      = 1;
    uint8 public constant ROLE_TRANSPORTER = 2;
    uint8 public constant ROLE_WHOLESALER  = 3;
    uint8 public constant ROLE_RETAILER    = 4;
    uint8 public constant ROLE_ADMIN       = 5;

    mapping(address => uint8) public actorRoles;

    // ─── Batch status ──────────────────────────────────────────────────────
    enum BatchStatus {
        Created,    // 0
        InTransit,  // 1
        Received,   // 2
        Delivered,  // 3  (final — retailer confirmed)
        Flagged,    // 4
        Recalled,   // 5  (terminal)
        Cancelled   // 6  (terminal)
    }

    // ─── Batch data stored on-chain ────────────────────────────────────────
    struct BatchInfo {
        bytes32     batchCode;          // e.g. keccak("TOM-TN-001") via formatBytes32String
        string      productType;        // "Tomatoes"
        string      producerName;       // "Ferme Nabeul"
        string      originRegion;       // "Nabeul, Tunisia"
        uint256     harvestDate;        // Unix timestamp
        uint256     quantity;           // e.g. 500000 for 500 kg (store in grams)
        string      quantityUnit;       // "kg"
        uint256     registrationDate;
        BatchStatus status;
        address     currentHolder;
        address     expectedRecipient;  // set during shipBatch
        string      metadataURI;        // optional off-chain URI
    }

    // ─── History entry ─────────────────────────────────────────────────────
    struct HistoryEntry {
        uint256     timestamp;
        address     actor;
        string      actionType;    // "REGISTERED" / "SHIPPED" / "RECEIVED" / "DELIVERED" / ...
        string      details;
        BatchStatus statusAfter;
    }

    // ─── Storage ───────────────────────────────────────────────────────────
    mapping(uint256 => BatchInfo)       private batches;
    mapping(bytes32  => uint256)        public  batchCodeToTokenId;
    mapping(bytes32  => bool)           public  usedBatchCodes;
    mapping(uint256  => HistoryEntry[]) private batchHistory;

    // ─── Transfer guard: only internal business logic can move NFTs ─────────
    bool private _businessTransfer;

    // ─── Events ────────────────────────────────────────────────────────────
    event BatchRegistered(uint256 indexed tokenId, bytes32 indexed batchCode, address indexed producer);
    event BatchShipped   (uint256 indexed tokenId, address indexed from,      address indexed to);
    event BatchReceived  (uint256 indexed tokenId, address indexed recipient);
    event BatchDelivered (uint256 indexed tokenId, address indexed recipient);
    event BatchFlagged   (uint256 indexed tokenId, address indexed actor, bytes32 reasonCode);
    event BatchRecalled  (uint256 indexed tokenId, address indexed actor);
    event ActorRoleSet   (address indexed actor, uint8 role);

    // ─── Constructor ───────────────────────────────────────────────────────
    constructor(address fctAddress) ERC721("Food Batch Passport", "FBP") {
        require(fctAddress != address(0), "NFT: Invalid FCT address");
        foodChainToken = IFoodChainToken(fctAddress);
        actorRoles[msg.sender] = ROLE_ADMIN;   // deployer is admin
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(
            actorRoles[msg.sender] == ROLE_ADMIN || msg.sender == owner(),
            "NFT: Admin role required"
        );
        _;
    }

    modifier batchExists(uint256 tokenId) {
        require(_exists(tokenId), "NFT: Batch does not exist");
        _;
    }

    modifier notTerminal(uint256 tokenId) {
        BatchStatus s = batches[tokenId].status;
        require(
            s != BatchStatus.Recalled  &&
            s != BatchStatus.Cancelled &&
            s != BatchStatus.Delivered,
            "NFT: Batch in terminal state"
        );
        _;
    }

    // ─── Role management ───────────────────────────────────────────────────

    /**
     * @notice Assign a role to an actor address. Admin only.
     * @param actor Address of the actor.
     * @param role  One of ROLE_* constants (0–5).
     */
    function setActorRole(address actor, uint8 role) external onlyAdmin {
        require(actor != address(0), "NFT: Invalid actor address");
        require(role <= ROLE_ADMIN,  "NFT: Invalid role value");
        actorRoles[actor] = role;
        emit ActorRoleSet(actor, role);
    }

    // ─── Core batch lifecycle ──────────────────────────────────────────────

    /**
     * @notice Register a new food batch and mint its NFT passport.
     *         Caller must have FARMER role (or be owner).
     *         batchCode must be unique — use ethers.utils.formatBytes32String()
     *         from the frontend.
     * @return tokenId The NFT token ID.
     */
    function registerBatch(
        bytes32 batchCode,
        string  calldata productType,
        string  calldata producerName,
        string  calldata originRegion,
        uint256 harvestDate,
        uint256 quantity,
        string  calldata quantityUnit,
        string  calldata metadataURI
    ) external returns (uint256) {
        require(
            actorRoles[msg.sender] == ROLE_FARMER || msg.sender == owner(),
            "NFT: Farmer role required"
        );
        require(batchCode  != bytes32(0),           "NFT: Batch code required");
        require(!usedBatchCodes[batchCode],          "NFT: Batch code already exists");
        require(bytes(productType).length  > 0,     "NFT: Product type required");
        require(bytes(producerName).length > 0,     "NFT: Producer name required");
        require(bytes(originRegion).length > 0,     "NFT: Origin region required");
        require(harvestDate > 0 && harvestDate <= block.timestamp,
                                                    "NFT: Invalid harvest date");
        require(quantity > 0,                       "NFT: Quantity must be positive");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        batches[tokenId] = BatchInfo({
            batchCode:        batchCode,
            productType:      productType,
            producerName:     producerName,
            originRegion:     originRegion,
            harvestDate:      harvestDate,
            quantity:         quantity,
            quantityUnit:     quantityUnit,
            registrationDate: block.timestamp,
            status:           BatchStatus.Created,
            currentHolder:    msg.sender,
            expectedRecipient: address(0),
            metadataURI:      metadataURI
        });

        usedBatchCodes[batchCode]     = true;
        batchCodeToTokenId[batchCode] = tokenId;

        _safeMint(msg.sender, tokenId);  // mint NFT to farmer

        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  "REGISTERED",
            details:     string(abi.encodePacked(productType, " | ", originRegion)),
            statusAfter: BatchStatus.Created
        }));

        emit BatchRegistered(tokenId, batchCode, msg.sender);

        // Reward the farmer for registration
        _tryReward(
            msg.sender,
            foodChainToken.ACTION_REGISTER(),
            keccak256(abi.encodePacked("REG", tokenId, msg.sender))
        );

        return tokenId;
    }

    /**
     * @notice Ship a batch to a recipient.
     *         Only the current holder can ship.
     *         Batch must be in Created or Received state.
     */
    function shipBatch(
        uint256 tokenId,
        address recipient,
        string  calldata details
    ) external batchExists(tokenId) notTerminal(tokenId) {
        BatchInfo storage b = batches[tokenId];

        require(b.currentHolder == msg.sender, "NFT: Only current holder can ship");
        require(
            b.status == BatchStatus.Created || b.status == BatchStatus.Received,
            "NFT: Can only ship Created or Received batch"
        );
        require(recipient != address(0), "NFT: Invalid recipient address");
        require(recipient != msg.sender, "NFT: Cannot ship to yourself");

        b.status            = BatchStatus.InTransit;
        b.expectedRecipient = recipient;

        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  "SHIPPED",
            details:     details,
            statusAfter: BatchStatus.InTransit
        }));

        emit BatchShipped(tokenId, msg.sender, recipient);
    }

    /**
     * @notice Confirm receipt of a batch in transit.
     *         ONLY the expectedRecipient can call this.
     *         If the recipient is a Retailer, status moves to Delivered (final).
     *         NFT ownership is transferred to the new holder.
     */
    function confirmReceipt(
        uint256 tokenId,
        string  calldata details
    ) external batchExists(tokenId) notTerminal(tokenId) {
        BatchInfo storage b = batches[tokenId];

        require(b.status == BatchStatus.InTransit,  "NFT: Batch not in transit");
        require(b.expectedRecipient == msg.sender,  "NFT: Caller is not expected recipient");

        address previousHolder  = b.currentHolder;
        bool    isFinalDelivery = (actorRoles[msg.sender] == ROLE_RETAILER);

        b.status            = isFinalDelivery ? BatchStatus.Delivered : BatchStatus.Received;
        b.currentHolder     = msg.sender;
        b.expectedRecipient = address(0);

        // Transfer NFT to the new holder (using business transfer flag)
        _businessTransfer = true;
        _transfer(ownerOf(tokenId), msg.sender, tokenId);
        _businessTransfer = false;

        string memory action = isFinalDelivery ? "DELIVERED" : "RECEIVED";

        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  action,
            details:     details,
            statusAfter: b.status
        }));

        if (isFinalDelivery) {
            emit BatchDelivered(tokenId, msg.sender);
            _tryReward(
                msg.sender,
                foodChainToken.ACTION_DELIVER(),
                keccak256(abi.encodePacked("DELIVER", tokenId, msg.sender))
            );
        } else {
            emit BatchReceived(tokenId, msg.sender);
            _tryReward(
                msg.sender,
                foodChainToken.ACTION_RECEIVE(),
                keccak256(abi.encodePacked("RECEIVE", tokenId, msg.sender))
            );
        }

        // Also reward the shipper for a confirmed delivery
        _tryReward(
            previousHolder,
            foodChainToken.ACTION_SHIP(),
            keccak256(abi.encodePacked("SHIP_CONFIRM", tokenId, previousHolder, msg.sender))
        );
    }

    /**
     * @notice Flag a batch as suspicious. Admin only.
     */
    function flagBatch(
        uint256 tokenId,
        bytes32 reasonCode
    ) external onlyAdmin batchExists(tokenId) {
        BatchStatus s = batches[tokenId].status;
        require(
            s != BatchStatus.Recalled && s != BatchStatus.Cancelled,
            "NFT: Already in terminal state"
        );
        batches[tokenId].status = BatchStatus.Flagged;

        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  "FLAGGED",
            details:     "Batch flagged by admin",
            statusAfter: BatchStatus.Flagged
        }));

        emit BatchFlagged(tokenId, msg.sender, reasonCode);
    }

    /**
     * @notice Recall a batch. Admin only. This is a terminal state.
     */
    function recallBatch(uint256 tokenId)
        external onlyAdmin batchExists(tokenId)
    {
        batches[tokenId].status = BatchStatus.Recalled;

        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  "RECALLED",
            details:     "Batch recalled by admin",
            statusAfter: BatchStatus.Recalled
        }));

        emit BatchRecalled(tokenId, msg.sender);
    }

    // ─── View functions ────────────────────────────────────────────────────

    function getBatch(uint256 tokenId)
        external view batchExists(tokenId)
        returns (BatchInfo memory)
    {
        return batches[tokenId];
    }

    function getBatchByCode(bytes32 batchCode)
        external view
        returns (uint256 tokenId, BatchInfo memory info)
    {
        require(usedBatchCodes[batchCode], "NFT: Batch code not found");
        tokenId = batchCodeToTokenId[batchCode];
        info    = batches[tokenId];
    }

    function getBatchHistory(uint256 tokenId)
        external view batchExists(tokenId)
        returns (HistoryEntry[] memory)
    {
        return batchHistory[tokenId];
    }

    function totalBatches() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function getActorRole(address actor) external view returns (uint8) {
        return actorRoles[actor];
    }

    // ─── ERC-721 overrides ─────────────────────────────────────────────────

    /**
     * @dev Block all direct ERC-721 transfers.
     *      Only confirmReceipt() can move an NFT (via _businessTransfer flag).
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        // Allow minting (from == address(0)) but block all other external transfers
        if (from != address(0) && to != address(0)) {
            require(
                _businessTransfer,
                "NFT: Use shipBatch/confirmReceipt for transfers"
            );
        }
    }

    function tokenURI(uint256 tokenId)
        public view override batchExists(tokenId)
        returns (string memory)
    {
        return batches[tokenId].metadataURI;
    }

    // ─── Internal reward helper ────────────────────────────────────────────

    /**
     * @dev Attempt to issue a reward. Uses try/catch so that a failed
     *      reward (e.g., empty pool) does NOT revert the main operation.
     */
    function _tryReward(
        address actor,
        bytes32 actionType,
        bytes32 operationId
    ) internal {
        uint256 amount = foodChainToken.getRewardAmount(actionType);
        if (amount == 0) return;
        try foodChainToken.rewardActor(actor, amount, operationId) {
            // success
        } catch {
            // reward failed — main operation continues
        }
    }
}
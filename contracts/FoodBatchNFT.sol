// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @dev Minimal interface of the reward token.
interface IFoodChainToken {
    function rewardForAction(address actor, bytes32 actionType, bytes32 operationId) external;
    function ACTION_REGISTER() external view returns (bytes32);
    function ACTION_SHIP()     external view returns (bytes32);
    function ACTION_RECEIVE()  external view returns (bytes32);
    function ACTION_DELIVER()  external view returns (bytes32);
}

/**
 * @title  FoodBatchNFT (FBP)
 * @author Nesrine Derouiche
 * @notice ERC-721 digital passport for food batches. One NFT = one batch.
 *
 *  Lifecycle:  Created → InTransit → Received → InTransit → … → Delivered
 *  Exceptional: Flagged (reversible by admin), Recalled / Cancelled (terminal)
 *
 *  Ownership rule: the NFT is held by the responsible actor. It only moves when the
 *  intended recipient confirms receipt – standard ERC-721 transfers/approvals are
 *  disabled so the traceability rules cannot be bypassed.
 *
 *  Guidance helpers (`getAvailableActions`, `getStats`, `getActors`, `getBatchesPage`…)
 *  let a front-end explain to each user what they can do next.
 */
contract FoodBatchNFT is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    IFoodChainToken public foodChainToken;

    // ─── Roles ─────────────────────────────────────────────────────────────
    uint8 public constant ROLE_NONE        = 0;
    uint8 public constant ROLE_FARMER      = 1;
    uint8 public constant ROLE_TRANSPORTER = 2;
    uint8 public constant ROLE_WHOLESALER  = 3;
    uint8 public constant ROLE_RETAILER    = 4;
    uint8 public constant ROLE_ADMIN       = 5;

    mapping(address => uint8) public actorRoles;
    address[] private _actors;
    mapping(address => bool) private _knownActor;

    // ─── Status ────────────────────────────────────────────────────────────
    enum BatchStatus { Created, InTransit, Received, Delivered, Flagged, Recalled, Cancelled }

    struct BatchInfo {
        uint256     tokenId;
        bytes32     batchCode;
        string      productType;
        string      producerName;
        string      originRegion;
        uint256     harvestDate;
        uint256     quantity;
        string      quantityUnit;
        uint256     registrationDate;
        BatchStatus status;
        address     currentHolder;
        address     expectedRecipient;
        string      metadataURI;
    }

    struct HistoryEntry {
        uint256     timestamp;
        address     actor;
        string      actionType;
        string      details;
        BatchStatus statusAfter;
    }

    /// @dev What `user` may do on a batch right now (used by the UI to show only valid buttons).
    struct ActionFlags {
        bool canShip;
        bool canConfirmReceipt;
        bool canFlag;
        bool canClearFlag;
        bool canRecall;
        bool canCancel;
    }

    uint256 private constant MAX_FIELD_LEN = 64;

    mapping(uint256 => BatchInfo)       private batches;
    mapping(bytes32 => uint256)         public  batchCodeToTokenId;
    mapping(bytes32 => bool)            public  usedBatchCodes;
    mapping(uint256 => HistoryEntry[])  private batchHistory;
    mapping(uint256 => BatchStatus)     private statusBeforeFlag;
    uint256[7] private _statusCounts;

    bool private _businessTransfer;

    // ─── Events ────────────────────────────────────────────────────────────
    event BatchRegistered(uint256 indexed tokenId, bytes32 indexed batchCode, address indexed producer);
    event BatchShipped   (uint256 indexed tokenId, address indexed from, address indexed to);
    event BatchReceived  (uint256 indexed tokenId, address indexed recipient);
    event BatchDelivered (uint256 indexed tokenId, address indexed recipient);
    event BatchFlagged   (uint256 indexed tokenId, address indexed actor, bytes32 reasonCode);
    event BatchFlagCleared(uint256 indexed tokenId, address indexed actor);
    event BatchRecalled  (uint256 indexed tokenId, address indexed actor);
    event BatchCancelled (uint256 indexed tokenId, address indexed actor);
    event ActorRoleSet   (address indexed actor, uint8 role);
    /// @dev Emitted instead of reverting when the FCT reward could not be paid.
    event RewardSkipped  (uint256 indexed tokenId, address indexed actor, bytes32 indexed actionType, string reason);

    constructor(address fctAddress) ERC721("Food Batch Passport", "FBP") {
        require(fctAddress != address(0), "NFT: Invalid FCT address");
        foodChainToken = IFoodChainToken(fctAddress);
        _grant(msg.sender, ROLE_ADMIN);
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(_isAdmin(msg.sender), "NFT: Admin role required");
        _;
    }

    modifier batchExists(uint256 tokenId) {
        require(_exists(tokenId), "NFT: Batch does not exist");
        _;
    }

    function _isAdmin(address a) internal view returns (bool) {
        return actorRoles[a] == ROLE_ADMIN || a == owner();
    }

    // ─── Roles ─────────────────────────────────────────────────────────────

    /// @notice Assign (or revoke with ROLE_NONE) a role. Admin only.
    function setActorRole(address actor, uint8 role) external onlyAdmin {
        require(actor != address(0), "NFT: Invalid actor address");
        require(role <= ROLE_ADMIN,  "NFT: Invalid role value");
        require(actor != owner() || role == ROLE_ADMIN, "NFT: Cannot demote the contract owner");
        _grant(actor, role);
    }

    function _grant(address actor, uint8 role) internal {
        if (!_knownActor[actor]) {
            _knownActor[actor] = true;
            _actors.push(actor);
        }
        actorRoles[actor] = role;
        emit ActorRoleSet(actor, role);
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────

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
            "NFT: Only a Farmer can register batches"
        );
        require(batchCode != bytes32(0),        "NFT: Batch code required");
        require(!usedBatchCodes[batchCode],     "NFT: Batch code already exists");
        require(bytes(productType).length  > 0, "NFT: Product type required");
        require(bytes(producerName).length > 0, "NFT: Producer name required");
        require(bytes(originRegion).length > 0, "NFT: Origin region required");
        require(bytes(quantityUnit).length > 0, "NFT: Quantity unit required");
        require(
            bytes(productType).length  <= MAX_FIELD_LEN &&
            bytes(producerName).length <= MAX_FIELD_LEN &&
            bytes(originRegion).length <= MAX_FIELD_LEN &&
            bytes(quantityUnit).length <= 16,
            "NFT: Text field too long"
        );
        require(harvestDate > 0 && harvestDate <= block.timestamp, "NFT: Harvest date must be in the past");
        require(quantity > 0,                   "NFT: Quantity must be positive");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        batches[tokenId] = BatchInfo({
            tokenId:           tokenId,
            batchCode:         batchCode,
            productType:       productType,
            producerName:      producerName,
            originRegion:      originRegion,
            harvestDate:       harvestDate,
            quantity:          quantity,
            quantityUnit:      quantityUnit,
            registrationDate:  block.timestamp,
            status:            BatchStatus.Created,
            currentHolder:     msg.sender,
            expectedRecipient: address(0),
            metadataURI:       metadataURI
        });
        _statusCounts[uint8(BatchStatus.Created)]++;

        usedBatchCodes[batchCode]     = true;
        batchCodeToTokenId[batchCode] = tokenId;

        _safeMint(msg.sender, tokenId);

        _log(tokenId, "REGISTERED", string(abi.encodePacked(productType, " | ", originRegion)), BatchStatus.Created);
        emit BatchRegistered(tokenId, batchCode, msg.sender);

        _tryReward(tokenId, msg.sender, foodChainToken.ACTION_REGISTER(),
                   keccak256(abi.encodePacked("REG", tokenId, msg.sender)));
        return tokenId;
    }

    function shipBatch(uint256 tokenId, address recipient, string calldata details)
        external batchExists(tokenId)
    {
        BatchInfo storage b = batches[tokenId];

        require(b.currentHolder == msg.sender, "NFT: Only the current holder can ship");
        require(
            b.status == BatchStatus.Created || b.status == BatchStatus.Received,
            "NFT: Only Created or Received batches can be shipped"
        );
        require(recipient != address(0), "NFT: Invalid recipient address");
        require(recipient != msg.sender, "NFT: Cannot ship to yourself");
        uint8 rr = actorRoles[recipient];
        require(
            rr == ROLE_TRANSPORTER || rr == ROLE_WHOLESALER || rr == ROLE_RETAILER,
            "NFT: Recipient must be a Transporter, Wholesaler or Retailer"
        );

        _setStatus(tokenId, BatchStatus.InTransit);
        b.expectedRecipient = recipient;

        _log(tokenId, "SHIPPED", details, BatchStatus.InTransit);
        emit BatchShipped(tokenId, msg.sender, recipient);
    }

    function confirmReceipt(uint256 tokenId, string calldata details)
        external batchExists(tokenId)
    {
        BatchInfo storage b = batches[tokenId];

        require(b.status == BatchStatus.InTransit, "NFT: Batch is not in transit");
        require(b.expectedRecipient == msg.sender, "NFT: You are not the expected recipient");

        address previousHolder = b.currentHolder;
        bool isFinal = (actorRoles[msg.sender] == ROLE_RETAILER);

        _setStatus(tokenId, isFinal ? BatchStatus.Delivered : BatchStatus.Received);
        b.currentHolder     = msg.sender;
        b.expectedRecipient = address(0);

        _businessTransfer = true;
        _transfer(previousHolder, msg.sender, tokenId);
        _businessTransfer = false;

        _log(tokenId, isFinal ? "DELIVERED" : "RECEIVED", details, b.status);

        if (isFinal) {
            emit BatchDelivered(tokenId, msg.sender);
            _tryReward(tokenId, msg.sender, foodChainToken.ACTION_DELIVER(),
                       keccak256(abi.encodePacked("DELIVER", tokenId, msg.sender)));
        } else {
            emit BatchReceived(tokenId, msg.sender);
            _tryReward(tokenId, msg.sender, foodChainToken.ACTION_RECEIVE(),
                       keccak256(abi.encodePacked("RECEIVE", tokenId, msg.sender)));
        }
        // The shipper is rewarded only now that delivery is confirmed by the recipient.
        _tryReward(tokenId, previousHolder, foodChainToken.ACTION_SHIP(),
                   keccak256(abi.encodePacked("SHIP_CONFIRM", tokenId, previousHolder, msg.sender)));
    }

    /// @notice Flag a batch as suspicious. Any registered actor or admin.
    function flagBatch(uint256 tokenId, bytes32 reasonCode, string calldata details)
        external batchExists(tokenId)
    {
        require(actorRoles[msg.sender] != ROLE_NONE || msg.sender == owner(), "NFT: Only registered actors can flag");
        BatchStatus s = batches[tokenId].status;
        require(
            s != BatchStatus.Flagged && s != BatchStatus.Recalled && s != BatchStatus.Cancelled,
            "NFT: Batch cannot be flagged in its current state"
        );
        require(reasonCode != bytes32(0), "NFT: Reason code required");

        statusBeforeFlag[tokenId] = s;
        _setStatus(tokenId, BatchStatus.Flagged);
        _log(tokenId, "FLAGGED", details, BatchStatus.Flagged);
        emit BatchFlagged(tokenId, msg.sender, reasonCode);
    }

    /// @notice Admin dismisses a flag; the batch returns to the status it had before.
    function clearFlag(uint256 tokenId, string calldata details)
        external onlyAdmin batchExists(tokenId)
    {
        require(batches[tokenId].status == BatchStatus.Flagged, "NFT: Batch is not flagged");
        BatchStatus prev = statusBeforeFlag[tokenId];
        _setStatus(tokenId, prev);
        _log(tokenId, "FLAG_CLEARED", details, prev);
        emit BatchFlagCleared(tokenId, msg.sender);
    }

    /// @notice Recall a batch (terminal). Admin only.
    function recallBatch(uint256 tokenId, string calldata details)
        external onlyAdmin batchExists(tokenId)
    {
        BatchStatus s = batches[tokenId].status;
        require(s != BatchStatus.Recalled && s != BatchStatus.Cancelled, "NFT: Batch already closed");
        _setStatus(tokenId, BatchStatus.Recalled);
        batches[tokenId].expectedRecipient = address(0);
        _log(tokenId, "RECALLED", details, BatchStatus.Recalled);
        emit BatchRecalled(tokenId, msg.sender);
    }

    /// @notice Cancel a batch registered by mistake (terminal). Holder while "Created", or admin.
    function cancelBatch(uint256 tokenId, string calldata details)
        external batchExists(tokenId)
    {
        BatchInfo storage b = batches[tokenId];
        bool holderOk = (b.currentHolder == msg.sender && b.status == BatchStatus.Created);
        require(holderOk || _isAdmin(msg.sender), "NFT: Only the holder (Created) or an admin can cancel");
        require(
            b.status != BatchStatus.Recalled && b.status != BatchStatus.Cancelled && b.status != BatchStatus.Delivered,
            "NFT: Batch already closed"
        );
        _setStatus(tokenId, BatchStatus.Cancelled);
        b.expectedRecipient = address(0);
        _log(tokenId, "CANCELLED", details, BatchStatus.Cancelled);
        emit BatchCancelled(tokenId, msg.sender);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function getBatch(uint256 tokenId) external view batchExists(tokenId) returns (BatchInfo memory) {
        return batches[tokenId];
    }

    function getBatchByCode(bytes32 batchCode) external view returns (uint256 tokenId, BatchInfo memory info) {
        require(usedBatchCodes[batchCode], "NFT: Batch code not found");
        tokenId = batchCodeToTokenId[batchCode];
        info    = batches[tokenId];
    }

    function getBatchHistory(uint256 tokenId) external view batchExists(tokenId) returns (HistoryEntry[] memory) {
        return batchHistory[tokenId];
    }

    function isBatchCodeAvailable(bytes32 batchCode) external view returns (bool) {
        return batchCode != bytes32(0) && !usedBatchCodes[batchCode];
    }

    function totalBatches() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function getActorRole(address actor) external view returns (uint8) {
        return actorRoles[actor];
    }

    /// @notice Batches by id range [offset+1 … offset+limit] (ids start at 1).
    function getBatchesPage(uint256 offset, uint256 limit) external view returns (BatchInfo[] memory page) {
        uint256 total = _tokenIdCounter.current();
        if (offset >= total) return new BatchInfo[](0);
        uint256 n = total - offset;
        if (n > limit) n = limit;
        page = new BatchInfo[](n);
        for (uint256 i = 0; i < n; i++) page[i] = batches[offset + i + 1];
    }

    function getBatchesByHolder(address holder) external view returns (uint256[] memory ids) {
        uint256 total = _tokenIdCounter.current();
        uint256 c;
        for (uint256 i = 1; i <= total; i++) if (batches[i].currentHolder == holder) c++;
        ids = new uint256[](c);
        c = 0;
        for (uint256 i = 1; i <= total; i++) if (batches[i].currentHolder == holder) ids[c++] = i;
    }

    /// @notice Batches currently waiting for `recipient` to confirm receipt.
    function getIncomingBatches(address recipient) external view returns (uint256[] memory ids) {
        uint256 total = _tokenIdCounter.current();
        uint256 c;
        for (uint256 i = 1; i <= total; i++) {
            if (batches[i].status == BatchStatus.InTransit && batches[i].expectedRecipient == recipient) c++;
        }
        ids = new uint256[](c);
        c = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (batches[i].status == BatchStatus.InTransit && batches[i].expectedRecipient == recipient) ids[c++] = i;
        }
    }

    /// @notice Dashboard counters straight from storage.
    function getStats() external view returns (uint256 total, uint256[7] memory byStatus, uint256 actorCount) {
        return (_tokenIdCounter.current(), _statusCounts, _actors.length);
    }

    function getActors() external view returns (address[] memory actors, uint8[] memory roles) {
        actors = _actors;
        roles  = new uint8[](actors.length);
        for (uint256 i = 0; i < actors.length; i++) roles[i] = actorRoles[actors[i]];
    }

    /// @notice Which buttons should `user` see for this batch?
    function getAvailableActions(uint256 tokenId, address user)
        external view batchExists(tokenId) returns (ActionFlags memory f)
    {
        BatchInfo storage b = batches[tokenId];
        BatchStatus s = b.status;
        bool admin = _isAdmin(user);
        bool registered = actorRoles[user] != ROLE_NONE || user == owner();

        f.canShip = b.currentHolder == user && (s == BatchStatus.Created || s == BatchStatus.Received);
        f.canConfirmReceipt = s == BatchStatus.InTransit && b.expectedRecipient == user;
        f.canFlag = registered && s != BatchStatus.Flagged && s != BatchStatus.Recalled && s != BatchStatus.Cancelled;
        f.canClearFlag = admin && s == BatchStatus.Flagged;
        f.canRecall = admin && s != BatchStatus.Recalled && s != BatchStatus.Cancelled;
        f.canCancel = (admin && s != BatchStatus.Recalled && s != BatchStatus.Cancelled && s != BatchStatus.Delivered)
                   || (b.currentHolder == user && s == BatchStatus.Created);
    }

    // ─── ERC-721 restrictions ──────────────────────────────────────────────

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize)
        internal override
    {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        if (from != address(0) && to != address(0)) {
            require(_businessTransfer, "NFT: Use shipBatch/confirmReceipt for transfers");
        }
    }

    function approve(address, uint256) public pure override {
        revert("NFT: Approvals are disabled - use shipBatch/confirmReceipt");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("NFT: Approvals are disabled - use shipBatch/confirmReceipt");
    }

    function tokenURI(uint256 tokenId) public view override batchExists(tokenId) returns (string memory) {
        return batches[tokenId].metadataURI;
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    function _setStatus(uint256 tokenId, BatchStatus s) internal {
        BatchStatus old = batches[tokenId].status;
        _statusCounts[uint8(old)]--;
        _statusCounts[uint8(s)]++;
        batches[tokenId].status = s;
    }

    function _log(uint256 tokenId, string memory action, string memory details, BatchStatus after_) internal {
        batchHistory[tokenId].push(HistoryEntry({
            timestamp:   block.timestamp,
            actor:       msg.sender,
            actionType:  action,
            details:     details,
            statusAfter: after_
        }));
    }

    /// @dev A failing reward never blocks the traceability operation; it is reported via RewardSkipped.
    function _tryReward(uint256 tokenId, address actor, bytes32 actionType, bytes32 operationId) internal {
        try foodChainToken.rewardForAction(actor, actionType, operationId) {
        } catch Error(string memory reason) {
            emit RewardSkipped(tokenId, actor, actionType, reason);
        } catch {
            emit RewardSkipped(tokenId, actor, actionType, "FCT: reward call failed");
        }
    }
}

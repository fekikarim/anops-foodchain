// test/FoodBatchNFT.test.js
const FoodChainToken = artifacts.require("FoodChainToken");
const FoodBatchNFT   = artifacts.require("FoodBatchNFT");
const { expectRevert, expectEvent, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("FoodBatchNFT", (accounts) => {
  const [admin, farmer, transporter, wholesaler, retailer, unauthorized] = accounts;

  let fct, nft;
  const BATCH_CODE = web3.utils.fromAscii("TOM-TN-001").padEnd(66, "0"); // bytes32
  const BATCH_CODE2 = web3.utils.fromAscii("ORG-TN-002").padEnd(66, "0");

  // Helper to get a valid harvest date (1 day ago)
  const pastDate = () => Math.floor(Date.now() / 1000) - 86400;

  beforeEach(async () => {
    fct = await FoodChainToken.new({ from: admin });
    nft = await FoodBatchNFT.new(fct.address, { from: admin });

    await fct.setAuthorizedCaller(nft.address, true, { from: admin });

    // Set roles
    await nft.setActorRole(farmer,      1, { from: admin }); // FARMER
    await nft.setActorRole(transporter, 2, { from: admin }); // TRANSPORTER
    await nft.setActorRole(wholesaler,  3, { from: admin }); // WHOLESALER
    await nft.setActorRole(retailer,    4, { from: admin }); // RETAILER
  });

  async function registerTomatoes(caller = farmer, code = BATCH_CODE) {
    return nft.registerBatch(
      code,
      "Tomatoes", "Ferme Nabeul", "Nabeul, Tunisia",
      pastDate(), 500000, "g", "",
      { from: caller }
    );
  }

  // ── Deployment ─────────────────────────────────────────────────
  it("sets correct name, symbol and FCT address", async () => {
    assert.equal(await nft.name(),   "Food Batch Passport");
    assert.equal(await nft.symbol(), "FBP");
    assert.equal(await nft.foodChainToken(), fct.address);
  });

  it("deployer has ADMIN role", async () => {
    assert.equal(await nft.actorRoles(admin), 5);
  });

  // ── Roles ──────────────────────────────────────────────────────
  it("admin can set actor roles", async () => {
    assert.equal(await nft.actorRoles(farmer),      1);
    assert.equal(await nft.actorRoles(transporter), 2);
    assert.equal(await nft.actorRoles(wholesaler),  3);
    assert.equal(await nft.actorRoles(retailer),    4);
  });

  it("non-admin cannot set roles", async () => {
    await expectRevert(
      nft.setActorRole(unauthorized, 1, { from: unauthorized }),
      "NFT: Admin role required"
    );
  });

  // ── Register batch ─────────────────────────────────────────────
  it("farmer can register a batch and receives NFT", async () => {
    const tx = await registerTomatoes();
    expectEvent(tx, "BatchRegistered", { tokenId: "1", producer: farmer });
    assert.equal(await nft.ownerOf(1), farmer);
    assert.equal(await nft.totalBatches(), 1);
  });

  it("reverts on duplicate batch code", async () => {
    await registerTomatoes();
    await expectRevert(registerTomatoes(), "NFT: Batch code already exists");
  });

  it("reverts for non-farmer trying to register", async () => {
    await expectRevert(registerTomatoes(unauthorized), "NFT: Farmer role required");
  });

  it("reverts with empty product type", async () => {
    await expectRevert(
      nft.registerBatch(BATCH_CODE, "", "Name", "Region", pastDate(), 100, "kg", "", { from: farmer }),
      "NFT: Product type required"
    );
  });

  // ── Ship batch ─────────────────────────────────────────────────
  it("current holder can ship batch", async () => {
    await registerTomatoes();
    const tx = await nft.shipBatch(1, wholesaler, "Shipped to wholesaler", { from: farmer });
    expectEvent(tx, "BatchShipped", { tokenId: "1", from: farmer, to: wholesaler });
    const b = await nft.getBatch(1);
    assert.equal(b.status, 1); // InTransit
    assert.equal(b.expectedRecipient, wholesaler);
  });

  it("reverts when non-holder tries to ship", async () => {
    await registerTomatoes();
    await expectRevert(
      nft.shipBatch(1, wholesaler, "hack", { from: transporter }),
      "NFT: Only current holder can ship"
    );
  });

  // ── Confirm receipt ────────────────────────────────────────────
  it("expected recipient can confirm receipt", async () => {
    await registerTomatoes();
    await nft.shipBatch(1, wholesaler, "Shipped", { from: farmer });
    const tx = await nft.confirmReceipt(1, "Received at warehouse", { from: wholesaler });
    expectEvent(tx, "BatchReceived", { tokenId: "1", recipient: wholesaler });
    const b = await nft.getBatch(1);
    assert.equal(b.status, 2); // Received
    assert.equal(b.currentHolder, wholesaler);
    assert.equal(await nft.ownerOf(1), wholesaler); // NFT transferred
  });

  it("reverts when wrong address tries to confirm receipt", async () => {
    await registerTomatoes();
    await nft.shipBatch(1, wholesaler, "Shipped", { from: farmer });
    await expectRevert(
      nft.confirmReceipt(1, "hack", { from: retailer }),
      "NFT: Caller is not expected recipient"
    );
  });

  it("reverts on direct ERC-721 transfer attempt", async () => {
    await registerTomatoes();
    await expectRevert(
      nft.transferFrom(farmer, wholesaler, 1, { from: farmer }),
      "NFT: Use shipBatch/confirmReceipt for transfers"
    );
  });

  // ── Status transitions ─────────────────────────────────────────
  it("retailer confirmation produces Delivered status", async () => {
    await registerTomatoes();
    await nft.shipBatch(1, retailer, "Direct to retailer", { from: farmer });
    const tx = await nft.confirmReceipt(1, "Final delivery", { from: retailer });
    expectEvent(tx, "BatchDelivered", { tokenId: "1", recipient: retailer });
    const b = await nft.getBatch(1);
    assert.equal(b.status, 3); // Delivered
  });

  it("recalled batch cannot be shipped", async () => {
    await registerTomatoes();
    await nft.recallBatch(1, { from: admin });
    await expectRevert(
      nft.shipBatch(1, wholesaler, "try", { from: farmer }),
      "NFT: Batch in terminal state"
    );
  });

  // ── History ────────────────────────────────────────────────────
  it("history records all steps", async () => {
    await registerTomatoes();
    await nft.shipBatch(1, wholesaler, "Shipped", { from: farmer });
    await nft.confirmReceipt(1, "Received", { from: wholesaler });
    const hist = await nft.getBatchHistory(1);
    assert.equal(hist.length, 3);
    assert.equal(hist[0].actionType, "REGISTERED");
    assert.equal(hist[1].actionType, "SHIPPED");
    assert.equal(hist[2].actionType, "RECEIVED");
  });

  // ── Flag / Recall ───────────────────────────────────────────────
  it("admin can flag a batch", async () => {
    await registerTomatoes();
    const tx = await nft.flagBatch(1, web3.utils.soliditySha3("CONTAMINATED"), { from: admin });
    expectEvent(tx, "BatchFlagged", { tokenId: "1" });
    assert.equal((await nft.getBatch(1)).status, 4); // Flagged
  });

  it("non-admin cannot recall", async () => {
    await registerTomatoes();
    await expectRevert(
      nft.recallBatch(1, { from: farmer }),
      "NFT: Admin role required"
    );
  });
});
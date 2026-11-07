// Tests for the guidance/UX helpers and the extra lifecycle rules.
const FoodChainToken = artifacts.require("FoodChainToken");
const FoodBatchNFT   = artifacts.require("FoodBatchNFT");
const { expectRevert, expectEvent, BN } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("FoodBatchNFT – guidance & extra rules", (accounts) => {
  const [admin, farmer, transporter, wholesaler, retailer, stranger] = accounts;
  const code = (s) => web3.utils.padRight(web3.utils.asciiToHex(s), 64);
  const past = () => Math.floor(Date.now() / 1000) - 86400;
  let fct, nft;

  const reg = (c = "TOM-001", from = farmer) =>
    nft.registerBatch(code(c), "Tomatoes", "Ferme A", "Nabeul", past(), 500, "kg", "", { from });

  beforeEach(async () => {
    fct = await FoodChainToken.new({ from: admin });
    nft = await FoodBatchNFT.new(fct.address, { from: admin });
    await fct.setAuthorizedCaller(nft.address, true, { from: admin });
    await nft.setActorRole(farmer, 1); await nft.setActorRole(transporter, 2);
    await nft.setActorRole(wholesaler, 3); await nft.setActorRole(retailer, 4);
  });

  it("getStats tracks status counters through the lifecycle", async () => {
    await reg("A-1"); await reg("A-2");
    let s = await nft.getStats();
    assert.equal(s.total.toString(), "2"); assert.equal(s.byStatus[0].toString(), "2");
    assert.equal(s.actorCount.toString(), "5");
    await nft.shipBatch(1, wholesaler, "go", { from: farmer });
    s = await nft.getStats();
    assert.equal(s.byStatus[0].toString(), "1"); assert.equal(s.byStatus[1].toString(), "1");
    await nft.confirmReceipt(1, "ok", { from: wholesaler });
    await nft.shipBatch(1, retailer, "go", { from: wholesaler });
    await nft.confirmReceipt(1, "ok", { from: retailer });
    s = await nft.getStats();
    assert.equal(s.byStatus[3].toString(), "1");
    await nft.recallBatch(1, "late recall", { from: admin });
    s = await nft.getStats();
    assert.equal(s.byStatus[3].toString(), "0"); assert.equal(s.byStatus[5].toString(), "1");
  });

  it("getActors lists everyone who ever got a role (revoked = role 0)", async () => {
    await nft.setActorRole(transporter, 0, { from: admin });
    const a = await nft.getActors();
    assert.equal(a.actors.length, 5);
    assert.equal(a.roles[a.actors.indexOf(transporter)].toString(), "0");
    await expectRevert(nft.setActorRole(admin, 1, { from: admin }), "NFT: Cannot demote the contract owner");
  });

  it("getAvailableActions tells each user what they can do", async () => {
    await reg();
    let f = await nft.getAvailableActions(1, farmer);
    assert(f.canShip && f.canCancel && f.canFlag && !f.canConfirmReceipt && !f.canRecall);
    f = await nft.getAvailableActions(1, admin);
    assert(f.canRecall && f.canCancel && !f.canShip);
    await nft.shipBatch(1, wholesaler, "go", { from: farmer });
    f = await nft.getAvailableActions(1, wholesaler);
    assert(f.canConfirmReceipt && !f.canShip);
    f = await nft.getAvailableActions(1, farmer);
    assert(!f.canShip && !f.canCancel);
    f = await nft.getAvailableActions(1, stranger);
    assert(!f.canFlag && !f.canConfirmReceipt);
  });

  it("incoming / holder / page views", async () => {
    await reg("P-1"); await reg("P-2"); await reg("P-3");
    await nft.shipBatch(2, wholesaler, "go", { from: farmer });
    assert.deepEqual((await nft.getIncomingBatches(wholesaler)).map(String), ["2"]);
    assert.deepEqual((await nft.getBatchesByHolder(farmer)).map(String), ["1", "2", "3"]);
    const page = await nft.getBatchesPage(1, 5);
    assert.deepEqual(page.map((b) => b.tokenId.toString()), ["2", "3"]);
    assert.equal((await nft.getBatchesPage(10, 5)).length, 0);
    assert.equal(await nft.isBatchCodeAvailable(code("P-1")), false);
    assert.equal(await nft.isBatchCodeAvailable(code("NEW")), true);
  });

  it("recipient must have a delivery role", async () => {
    await reg();
    await expectRevert(nft.shipBatch(1, stranger, "x", { from: farmer }),
      "NFT: Recipient must be a Transporter, Wholesaler or Retailer");
    await expectRevert(nft.shipBatch(1, farmer, "x", { from: farmer }), "NFT: Cannot ship to yourself");
  });

  it("transporter relay: farmer → transporter → wholesaler → retailer", async () => {
    await reg();
    await nft.shipBatch(1, transporter, "pickup", { from: farmer });
    await nft.confirmReceipt(1, "loaded", { from: transporter });
    await nft.shipBatch(1, wholesaler, "drop", { from: transporter });
    await nft.confirmReceipt(1, "ok", { from: wholesaler });
    await nft.shipBatch(1, retailer, "drop", { from: wholesaler });
    await nft.confirmReceipt(1, "ok", { from: retailer });
    assert.equal(await nft.ownerOf(1), retailer);
    assert.equal((await nft.getBatchHistory(1)).length, 7);
  });

  it("flag → clearFlag restores the previous status (even InTransit)", async () => {
    await reg();
    await nft.shipBatch(1, wholesaler, "go", { from: farmer });
    await nft.flagBatch(1, web3.utils.soliditySha3("TEMP"), "too warm", { from: transporter });
    assert.equal((await nft.getBatch(1)).status.toString(), "4");
    await expectRevert(nft.confirmReceipt(1, "x", { from: wholesaler }), "NFT: Batch is not in transit");
    await expectRevert(nft.clearFlag(1, "x", { from: farmer }), "NFT: Admin role required");
    await nft.clearFlag(1, "false alarm", { from: admin });
    assert.equal((await nft.getBatch(1)).status.toString(), "1");
    await nft.confirmReceipt(1, "ok", { from: wholesaler });
  });

  it("stranger cannot flag; flag needs a reason; double flag rejected", async () => {
    await reg();
    await expectRevert(nft.flagBatch(1, web3.utils.soliditySha3("X"), "", { from: stranger }), "NFT: Only registered actors can flag");
    await expectRevert(nft.flagBatch(1, "0x" + "00".repeat(32), "", { from: farmer }), "NFT: Reason code required");
    await nft.flagBatch(1, web3.utils.soliditySha3("X"), "", { from: farmer });
    await expectRevert(nft.flagBatch(1, web3.utils.soliditySha3("X"), "", { from: farmer }), "NFT: Batch cannot be flagged in its current state");
  });

  it("cancelBatch: holder while Created, admin otherwise; terminal afterwards", async () => {
    await reg("C-1"); await reg("C-2");
    const tx = await nft.cancelBatch(1, "typo", { from: farmer });
    expectEvent(tx, "BatchCancelled", { tokenId: "1" });
    await expectRevert(nft.shipBatch(1, wholesaler, "x", { from: farmer }), "NFT: Only Created or Received batches can be shipped");
    await expectRevert(nft.cancelBatch(1, "again", { from: admin }), "NFT: Batch already closed");
    await nft.shipBatch(2, wholesaler, "go", { from: farmer });
    await expectRevert(nft.cancelBatch(2, "x", { from: farmer }), "NFT: Only the holder (Created) or an admin can cancel");
    await nft.cancelBatch(2, "admin cancels", { from: admin });
  });

  it("ERC-721 approvals are disabled; direct transfers blocked", async () => {
    await reg();
    await expectRevert(nft.approve(stranger, 1, { from: farmer }), "NFT: Approvals are disabled");
    await expectRevert(nft.setApprovalForAll(stranger, true, { from: farmer }), "NFT: Approvals are disabled");
    await expectRevert(nft.transferFrom(farmer, stranger, 1, { from: farmer }), "NFT: Use shipBatch/confirmReceipt for transfers");
  });

  it("input validation: unit, length, future harvest date, quantity", async () => {
    const long = "x".repeat(65);
    await expectRevert(nft.registerBatch(code("V1"), "T", "P", "O", past(), 5, "", "", { from: farmer }), "NFT: Quantity unit required");
    await expectRevert(nft.registerBatch(code("V2"), long, "P", "O", past(), 5, "kg", "", { from: farmer }), "NFT: Text field too long");
    await expectRevert(nft.registerBatch(code("V3"), "T", "P", "O", Math.floor(Date.now()/1000) + 99999, 5, "kg", "", { from: farmer }), "NFT: Harvest date must be in the past");
    await expectRevert(nft.registerBatch(code("V4"), "T", "P", "O", past(), 0, "kg", "", { from: farmer }), "NFT: Quantity must be positive");
  });

  it("emits RewardSkipped (and still succeeds) when the FCT reward is refused", async () => {
    await fct.setAuthorizedCaller(nft.address, false, { from: admin });
    const tx = await reg();
    expectEvent(tx, "RewardSkipped", { tokenId: "1", actor: farmer, reason: "FCT: Caller not authorized to issue rewards" });
    assert.equal((await nft.totalBatches()).toString(), "1");
  });

  it("rewards: registration, ship-confirm and delivery pay exactly once", async () => {
    const bal = async (a) => (await fct.balanceOf(a)).toString();
    await reg();
    assert.equal(await bal(farmer), web3.utils.toWei("10"));
    await nft.shipBatch(1, retailer, "go", { from: farmer });
    await nft.confirmReceipt(1, "ok", { from: retailer });
    assert.equal(await bal(farmer), web3.utils.toWei("13"));
    assert.equal(await bal(retailer), web3.utils.toWei("5"));
    assert.equal((await fct.totalRewarded()).toString(), web3.utils.toWei("18"));
  });
});

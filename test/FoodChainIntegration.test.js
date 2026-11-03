// test/FoodChainIntegration.test.js
const FoodChainToken = artifacts.require("FoodChainToken");
const FoodBatchNFT   = artifacts.require("FoodBatchNFT");
const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("Integration: FT + NFT", (accounts) => {
  const [admin, farmer, wholesaler, retailer] = accounts;
  let fct, nft;

  const TEN  = new BN("10000000000000000000");
  const FIVE = new BN("5000000000000000000");
  const THREE= new BN("3000000000000000000");

  const pastDate = () => Math.floor(Date.now() / 1000) - 86400;
  const BATCH_CODE = web3.utils.fromAscii("INT-001").padEnd(66, "0");

  beforeEach(async () => {
    fct = await FoodChainToken.new({ from: admin });
    nft = await FoodBatchNFT.new(fct.address, { from: admin });
    await fct.setAuthorizedCaller(nft.address, true, { from: admin });
    await nft.setActorRole(farmer,     1, { from: admin });
    await nft.setActorRole(wholesaler, 3, { from: admin });
    await nft.setActorRole(retailer,   4, { from: admin });
  });

  it("farmer receives 10 FCT after registering a batch", async () => {
    const before = await fct.balanceOf(farmer);
    await nft.registerBatch(
      BATCH_CODE, "Tomatoes", "Ferme A", "Nabeul",
      pastDate(), 100, "kg", "", { from: farmer }
    );
    const after = await fct.balanceOf(farmer);
    assert(after.sub(before).eq(TEN), "Farmer should receive 10 FCT");
  });

  it("wholesaler receives 5 FCT + farmer receives 3 FCT on confirmReceipt", async () => {
    await nft.registerBatch(
      BATCH_CODE, "Tomatoes", "Ferme A", "Nabeul",
      pastDate(), 100, "kg", "", { from: farmer }
    );
    await nft.shipBatch(1, wholesaler, "Shipped", { from: farmer });

    const farmerBefore     = await fct.balanceOf(farmer);
    const wholesalerBefore = await fct.balanceOf(wholesaler);

    await nft.confirmReceipt(1, "Received", { from: wholesaler });

    const farmerAfter     = await fct.balanceOf(farmer);
    const wholesalerAfter = await fct.balanceOf(wholesaler);

    assert(wholesalerAfter.sub(wholesalerBefore).eq(FIVE),  "Wholesaler: 5 FCT");
    assert(farmerAfter.sub(farmerBefore).eq(THREE),         "Farmer ship confirm: 3 FCT");
  });

  it("retailer receives 5 FCT on final delivery", async () => {
    await nft.registerBatch(
      BATCH_CODE, "Tomatoes", "Ferme A", "Nabeul",
      pastDate(), 100, "kg", "", { from: farmer }
    );
    await nft.shipBatch(1, retailer, "Direct ship", { from: farmer });

    const before = await fct.balanceOf(retailer);
    await nft.confirmReceipt(1, "Final delivery", { from: retailer });
    const after = await fct.balanceOf(retailer);

    assert(after.sub(before).eq(FIVE), "Retailer: 5 FCT");
    assert.equal((await nft.getBatch(1)).status, 3); // Delivered
  });

  it("same operationId cannot be rewarded twice", async () => {
    // Directly test anti-double via the FCT
    const opId = web3.utils.soliditySha3("unique-op-123");
    await fct.rewardActor(farmer, TEN, opId, { from: admin });
    await expectRevert(
      fct.rewardActor(farmer, TEN, opId, { from: admin }),
      "FCT: Operation already rewarded"
    );
  });

  it("failed reward does not revert the main operation", async () => {
    // Drain the owner's balance so rewards fail
    const ownerBal = await fct.balanceOf(admin);
    await fct.transfer(wholesaler, ownerBal, { from: admin }); // owner has 0 FCT now

    // registerBatch should still work even though reward will fail
    await nft.registerBatch(
      BATCH_CODE, "Oranges", "Ferme B", "Cap Bon",
      pastDate(), 200, "kg", "", { from: farmer }
    );
    // Batch was created
    assert.equal(await nft.totalBatches(), 1);
    // Farmer didn't receive reward (pool empty), but no revert
    assert((await fct.balanceOf(farmer)).eq(new BN(0)));
  });

  it("NFT owner changes correctly through full lifecycle", async () => {
    await nft.registerBatch(
      BATCH_CODE, "Tomatoes", "Ferme A", "Nabeul",
      pastDate(), 100, "kg", "", { from: farmer }
    );
    assert.equal(await nft.ownerOf(1), farmer,     "NFT owner = farmer");

    await nft.shipBatch(1, wholesaler, "S1", { from: farmer });
    assert.equal(await nft.ownerOf(1), farmer,     "NFT still with farmer during transit");

    await nft.confirmReceipt(1, "R1", { from: wholesaler });
    assert.equal(await nft.ownerOf(1), wholesaler, "NFT transferred to wholesaler");

    await nft.shipBatch(1, retailer, "S2", { from: wholesaler });
    await nft.confirmReceipt(1, "R2", { from: retailer });
    assert.equal(await nft.ownerOf(1), retailer,   "NFT transferred to retailer (final)");
  });
});
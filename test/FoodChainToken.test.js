// test/FoodChainToken.test.js
const FoodChainToken = artifacts.require("FoodChainToken");
const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("FoodChainToken", (accounts) => {
  const [owner, authorized, alice, bob] = accounts;
  let fct;

  const TEN_FCT  = new BN("10000000000000000000");   // 10 FCT
  const FIVE_FCT = new BN("5000000000000000000");    //  5 FCT
  const ONE_M    = new BN("1000000000000000000000000"); // 1,000,000 FCT

  beforeEach(async () => {
    fct = await FoodChainToken.new({ from: owner });
  });

  // ── Deployment ────────────────────────────────────────────────
  it("has correct name, symbol and decimals", async () => {
    assert.equal(await fct.name(),     "FoodChainToken");
    assert.equal(await fct.symbol(),   "FCT");
    assert.equal(await fct.decimals(), 18);
  });

  it("mints 1,000,000 FCT to owner on deploy", async () => {
    const supply = await fct.totalSupply();
    const ownerBal = await fct.balanceOf(owner);
    assert(supply.eq(ONE_M),    "total supply wrong");
    assert(ownerBal.eq(ONE_M),  "owner balance wrong");
  });

  // ── ERC-20 standard ───────────────────────────────────────────
  it("allows owner to transfer tokens", async () => {
    await fct.transfer(alice, TEN_FCT, { from: owner });
    const bal = await fct.balanceOf(alice);
    assert(bal.eq(TEN_FCT), "transfer failed");
  });

  it("supports approve + transferFrom", async () => {
    await fct.transfer(alice, TEN_FCT, { from: owner });
    await fct.approve(bob, FIVE_FCT, { from: alice });
    const allowance = await fct.allowance(alice, bob);
    assert(allowance.eq(FIVE_FCT), "allowance wrong");
    await fct.transferFrom(alice, bob, FIVE_FCT, { from: bob });
    assert((await fct.balanceOf(bob)).eq(FIVE_FCT), "transferFrom failed");
  });

  // ── Reward mechanism ──────────────────────────────────────────
  it("owner can call rewardActor", async () => {
    const opId = web3.utils.soliditySha3("op001");
    const tx = await fct.rewardActor(alice, TEN_FCT, opId, { from: owner });
    expectEvent(tx, "RewardIssued", { actor: alice, amount: TEN_FCT });
    assert((await fct.balanceOf(alice)).eq(TEN_FCT), "reward not received");
  });

  it("authorised caller can only pay the SCHEDULED amount (rewardForAction)", async () => {
    await fct.setAuthorizedCaller(authorized, true, { from: owner });
    const opId = web3.utils.soliditySha3("op002");
    const tx = await fct.rewardForAction(alice, await fct.ACTION_REGISTER(), opId, { from: authorized });
    expectEvent(tx, "RewardAction", { operationId: opId, caller: authorized });
    assert((await fct.balanceOf(alice)).eq(TEN_FCT));
    assert((await fct.rewardsReceived(alice)).eq(TEN_FCT));
    assert((await fct.rewardCount(alice)).toNumber() === 1);
    assert((await fct.totalRewarded()).eq(TEN_FCT));
  });

  it("authorised caller can NOT choose a custom amount (rewardActor is owner-only)", async () => {
    await fct.setAuthorizedCaller(authorized, true, { from: owner });
    await expectRevert(
      fct.rewardActor(alice, TEN_FCT, web3.utils.soliditySha3("op002b"), { from: authorized }),
      "Ownable: caller is not the owner"
    );
  });

  it("rewardForAction rejects unconfigured action types and strangers", async () => {
    await expectRevert(
      fct.rewardForAction(alice, web3.utils.soliditySha3("NOPE"), web3.utils.soliditySha3("x1"), { from: owner }),
      "FCT: No reward configured for this action"
    );
    await expectRevert(
      fct.rewardForAction(alice, await fct.ACTION_SHIP(), web3.utils.soliditySha3("x2"), { from: alice }),
      "FCT: Caller not authorized to issue rewards"
    );
  });

  it("reward pool is insufficient -> revert", async () => {
    await fct.transfer(bob, ONE_M, { from: owner });
    await expectRevert(
      fct.rewardActor(alice, TEN_FCT, web3.utils.soliditySha3("pool"), { from: owner }),
      "FCT: Reward pool insufficient"
    );
  });

  it("owner can top up the pool but never beyond MAX_SUPPLY; others cannot mint", async () => {
    await fct.mint(TEN_FCT, { from: owner });
    assert((await fct.totalSupply()).eq(ONE_M.add(TEN_FCT)));
    await expectRevert(fct.mint(TEN_FCT, { from: alice }), "Ownable: caller is not the owner");
    await expectRevert(fct.mint(await fct.MAX_SUPPLY(), { from: owner }), "FCT: Max supply exceeded");
  });

  it("getOverview and getRewardSchedule expose dashboard data", async () => {
    const o = await fct.getOverview();
    assert(o.supply.eq(ONE_M)); assert(o.pool.eq(ONE_M)); assert.equal(o.isPaused, false);
    assert.equal(o.admin, owner);
    const sch = await fct.getRewardSchedule();
    assert.equal(sch.actionTypes.length, 4);
    assert(sch.amounts[0].eq(TEN_FCT));
  });

  it("emits RewardAmountUpdated and AuthorizedCallerUpdated", async () => {
    let tx = await fct.setRewardAmount(await fct.ACTION_SHIP(), FIVE_FCT, { from: owner });
    expectEvent(tx, "RewardAmountUpdated", { newAmount: FIVE_FCT });
    tx = await fct.setAuthorizedCaller(authorized, true, { from: owner });
    expectEvent(tx, "AuthorizedCallerUpdated", { caller: authorized, authorized: true });
  });

  it("reverts when unauthorized caller tries rewardActor", async () => {
    const opId = web3.utils.soliditySha3("op003");
    await expectRevert(
      fct.rewardActor(alice, TEN_FCT, opId, { from: alice }),
      "Ownable: caller is not the owner"
    );
  });

  it("reverts on duplicate operationId (anti-double reward)", async () => {
    const opId = web3.utils.soliditySha3("op004");
    await fct.rewardActor(alice, TEN_FCT, opId, { from: owner });
    await expectRevert(
      fct.rewardActor(alice, TEN_FCT, opId, { from: owner }),
      "FCT: Operation already rewarded"
    );
  });

  it("reverts with zero actor address", async () => {
    const opId = web3.utils.soliditySha3("op005");
    await expectRevert(
      fct.rewardActor("0x0000000000000000000000000000000000000000", TEN_FCT, opId, { from: owner }),
      "FCT: Invalid actor address"
    );
  });

  // ── Admin ─────────────────────────────────────────────────────
  it("only owner can setAuthorizedCaller", async () => {
    await expectRevert(
      fct.setAuthorizedCaller(alice, true, { from: alice }),
      "Ownable: caller is not the owner"
    );
  });

  it("owner can update reward amounts", async () => {
    const ACTION = await fct.ACTION_REGISTER();
    await fct.setRewardAmount(ACTION, FIVE_FCT, { from: owner });
    assert((await fct.getRewardAmount(ACTION)).eq(FIVE_FCT));
  });

  it("pause prevents rewardActor", async () => {
    await fct.pause({ from: owner });
    const opId = web3.utils.soliditySha3("op006");
    await expectRevert(
      fct.rewardActor(alice, TEN_FCT, opId, { from: owner }),
      "Pausable: paused"
    );
    await fct.unpause({ from: owner });
  });
});
// migrations/2_deploy_food_batch_nft.js
const FoodChainToken = artifacts.require("FoodChainToken");
const FoodBatchNFT   = artifacts.require("FoodBatchNFT");

module.exports = async function (deployer, network, accounts) {
  const admin      = accounts[0];
  const farmer     = accounts[1];
  const transporter= accounts[2];
  const wholesaler = accounts[3];
  const retailer   = accounts[4];

  // 1. Get the already-deployed FCT contract
  const fct = await FoodChainToken.deployed();

  // 2. Deploy the NFT contract, passing FCT address in constructor
  await deployer.deploy(FoodBatchNFT, fct.address);
  const nft = await FoodBatchNFT.deployed();

  console.log("\n✅ FoodBatchNFT deployed at:  ", nft.address);

  // 3. CRITICAL: Authorize the NFT contract to call rewardActor on FCT
  await fct.setAuthorizedCaller(nft.address, true, { from: admin });
  console.log("✅ NFT contract authorized in FCT");

  // 4. Set actor roles for demo (convenient for quick testing)
  //    Admin = accounts[0] (already set in constructor)
  await nft.setActorRole(farmer,      1, { from: admin }); // ROLE_FARMER
  await nft.setActorRole(transporter, 2, { from: admin }); // ROLE_TRANSPORTER
  await nft.setActorRole(wholesaler,  3, { from: admin }); // ROLE_WHOLESALER
  await nft.setActorRole(retailer,    4, { from: admin }); // ROLE_RETAILER
  console.log("✅ Demo roles assigned");

  console.log("\n────────────────────────────────────────");
  console.log(" FoodChainToken :", fct.address);
  console.log(" FoodBatchNFT   :", nft.address);
  console.log(" Network ID     :", await web3.eth.net.getId());
  console.log("────────────────────────────────────────\n");
};
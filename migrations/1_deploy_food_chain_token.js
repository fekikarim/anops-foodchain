// migrations/1_deploy_food_chain_token.js
const FoodChainToken = artifacts.require("FoodChainToken");

module.exports = async function (deployer) {
  await deployer.deploy(FoodChainToken);
  const fct = await FoodChainToken.deployed();
  console.log("\n✅ FoodChainToken deployed at:", fct.address);
};
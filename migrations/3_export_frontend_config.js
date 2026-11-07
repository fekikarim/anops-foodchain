// Writes the real deployed addresses + ABIs to the frontend (single source of truth).
const fs   = require("fs");
const path = require("path");
const FoodChainToken = artifacts.require("FoodChainToken");
const FoodBatchNFT   = artifacts.require("FoodBatchNFT");

module.exports = async function (deployer, network, accounts) {
  if (network === "test" || network.endsWith("-fork")) return;
  const fct = await FoodChainToken.deployed();
  const nft = await FoodBatchNFT.deployed();
  const chainId = Number(await web3.eth.getChainId());
  const cfg = truffleConfigRpc(network);

  const out = {
    generatedAt: new Date().toISOString(),
    network,
    chainId,
    rpcUrl: cfg,
    deployer: accounts[0],
    addresses: { FoodChainToken: fct.address, FoodBatchNFT: nft.address },
    deployBlocks: {
      FoodChainToken: (await web3.eth.getTransactionReceipt(FoodChainToken.networks[await web3.eth.net.getId()].transactionHash)).blockNumber,
      FoodBatchNFT:   (await web3.eth.getTransactionReceipt(FoodBatchNFT.networks[await web3.eth.net.getId()].transactionHash)).blockNumber,
    },
    demoAccounts: {
      admin: accounts[0], farmer: accounts[1], transporter: accounts[2],
      wholesaler: accounts[3], retailer: accounts[4], unauthorized: accounts[5],
    },
    abi: { FoodChainToken: FoodChainToken.abi, FoodBatchNFT: FoodBatchNFT.abi },
  };
  const file = path.join(__dirname, "..", "frontend", "src", "blockchain", "deployment.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("✅ Frontend config written:", path.relative(process.cwd(), file), `(chainId ${chainId})`);
};

function truffleConfigRpc(network) {
  const n = require("../truffle-config.js").networks[network];
  return n ? `http://${n.host}:${n.port}` : "http://127.0.0.1:7545";
}

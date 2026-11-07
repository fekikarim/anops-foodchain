/**
 * truffle-config.js
 * AnOps FoodChain — Truffle configuration
 */
module.exports = {
  networks: {
    development: {
      host: process.env.GANACHE_HOST || "127.0.0.1",
      port: Number(process.env.GANACHE_PORT || 7545), // Ganache Desktop default. Change to 8545 for Ganache CLI.
      network_id: "*",     // Match any network ID
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",   // Fixed version — do not use "^0.8.x" here
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        viaIR: true
      }
    }
  }
};
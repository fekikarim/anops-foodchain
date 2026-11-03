// frontend/src/blockchain/contracts.js
import { ethers } from "ethers";
import FoodChainTokenArtifact from "./FoodChainToken.json";
import FoodBatchNFTArtifact   from "./FoodBatchNFT.json";

// ⚠ IMPORTANT: Replace these addresses after every 'npx truffle migrate'
// Get them from the console output or from build/contracts/*.json > networks > [chainId] > address
export const ADDRESSES = {
  FoodChainToken: "0x989861F12370DB88C142F3c698C5E4e6bd2f9444",  // ← paste here
  FoodBatchNFT:   "0x5b91B2c05467585a83679898Ed445eb9f1F2bb38",  // ← paste here
};

export const FCT_ABI = FoodChainTokenArtifact.abi;
export const NFT_ABI = FoodBatchNFTArtifact.abi;

/**
 * Returns ethers contract instances connected to a signer.
 */
export function getContracts(signer) {
  const fct = new ethers.Contract(ADDRESSES.FoodChainToken, FCT_ABI, signer);
  const nft = new ethers.Contract(ADDRESSES.FoodBatchNFT,   NFT_ABI, signer);
  return { fct, nft };
}

// Role name helper
export const ROLE_NAMES = {
  0: "None",
  1: "Farmer",
  2: "Transporter",
  3: "Wholesaler",
  4: "Retailer",
  5: "Admin"
};

// Status name helper
export const STATUS_NAMES = {
  0: "Created",
  1: "In Transit",
  2: "Received",
  3: "Delivered",
  4: "Flagged",
  5: "Recalled",
  6: "Cancelled"
};

export const STATUS_COLORS = {
  0: "#22c55e",
  1: "#3b82f6",
  2: "#a78bfa",
  3: "#10b981",
  4: "#f59e0b",
  5: "#ef4444",
  6: "#6b7280"
};
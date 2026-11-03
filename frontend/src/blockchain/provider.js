// frontend/src/blockchain/provider.js
import { ethers } from "ethers";

export const GANACHE_CHAIN_ID = 1337; // Must match your Ganache Chain ID

/**
 * Connect to MetaMask and return { provider, signer, address, chainId }
 * Throws an error with a clear message if something is wrong.
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install the MetaMask browser extension.");
  }

  // Ask MetaMask to connect
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const network  = await provider.getNetwork();

  if (network.chainId !== GANACHE_CHAIN_ID) {
    throw new Error(
      `Wrong network. Please switch MetaMask to Ganache Local (Chain ID ${GANACHE_CHAIN_ID}). Current: ${network.chainId}`
    );
  }

  const signer  = provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address, chainId: network.chainId };
}

/**
 * Listen for account or network changes in MetaMask.
 * Pass a callback that reloads the app state.
 */
export function setupMetaMaskListeners(onAccountChange, onNetworkChange) {
  if (!window.ethereum) return;
  window.ethereum.on("accountsChanged", (accounts) => {
    onAccountChange(accounts[0] || null);
  });
  window.ethereum.on("chainChanged", () => {
    // Reload the page when the network changes
    window.location.reload();
  });
}
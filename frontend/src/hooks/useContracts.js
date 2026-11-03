// frontend/src/hooks/useContracts.js
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { connectWallet, setupMetaMaskListeners } from "../blockchain/provider";
import { getContracts, ROLE_NAMES } from "../blockchain/contracts";

export function useContracts() {
  const [state, setState] = useState({
    provider: null,
    signer:   null,
    address:  null,
    contracts: null,
    role:      "None",
    isAdmin:   false,
    error:     null,
    loading:   false,
  });

  const connect = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { provider, signer, address } = await connectWallet();
      const contracts = getContracts(signer);

      // Read the role of the connected account
      const roleNum  = await contracts.nft.getActorRole(address);
      const role     = ROLE_NAMES[roleNum] || "None";
      const isAdmin  = roleNum >= 5 || address === (await contracts.nft.owner());

      setState({ provider, signer, address, contracts, role, isAdmin, error: null, loading: false });
    } catch (err) {
      setState(s => ({ ...s, error: err.message, loading: false }));
    }
  }, []);

  useEffect(() => {
    // Auto-connect if MetaMask is already connected
    if (window.ethereum?.selectedAddress) connect();

    setupMetaMaskListeners(
      () => connect(),       // re-connect on account change
      () => {}               // chainChanged reloads page (see provider.js)
    );
  }, [connect]);

  return { ...state, connect };
}
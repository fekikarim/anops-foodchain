import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { D, RPC_URL, same, toBatch, ZERO } from "../blockchain/config";
import { humanizeError } from "../blockchain/errors";

const Ctx = createContext(null);
export const useChain = () => useContext(Ctx);

// Ganache can report an absurd gas price (e.g. 20 000 gwei) which wallets trust blindly -> pin a sane one.
const GAS = { gasPrice: ethers.utils.parseUnits("1", "gwei") };
const hexChain = "0x" + D.chainId.toString(16);

// Read-only provider (works before a wallet is connected).
const rpc = new ethers.providers.JsonRpcProvider(RPC_URL);
rpc.pollingInterval = 1500;
const reader = {
  fct: new ethers.Contract(D.addresses.FoodChainToken, D.abi.FoodChainToken, rpc),
  nft: new ethers.Contract(D.addresses.FoodBatchNFT, D.abi.FoodBatchNFT, rpc),
};

let toastSeq = 1;

export function ChainProvider({ children }) {
  const [snap, setSnap] = useState(null);          // latest on-chain snapshot
  const [offline, setOffline] = useState(null);    // RPC error message
  const [address, setAddress] = useState(null);
  const [walletChain, setWalletChain] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const addressRef = useRef(null);
  const blockTs = useRef(new Map());
  const txFrom = useRef(new Map());
  const running = useRef(false);
  const again = useRef(false);
  const lastBlock = useRef(-1);
  const loadRef = useRef(null);
  const evCache = useRef({ block: -1, events: [] });

  const hasWallet = typeof window !== "undefined" && !!window.ethereum;
  const wrongNetwork = !!address && walletChain !== null && walletChain !== D.chainId;

  // ── Toasts ──────────────────────────────────────────────────────────────
  const pushToast = useCallback((t) => {
    const id = toastSeq++;
    setToasts((x) => [...x.slice(-3), { id, tone: "info", ...t }]);
    return id;
  }, []);
  const updateToast = useCallback((id, patch) => setToasts((x) => x.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);
  const dismissToast = useCallback((id) => setToasts((x) => x.filter((t) => t.id !== id)), []);
  useEffect(() => {
    const live = toasts.filter((t) => t.tone !== "loading");
    if (!live.length) return;
    const timers = live.map((t) => setTimeout(() => dismissToast(t.id), t.tone === "error" ? 9000 : 6000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);

  // ── Snapshot ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (running.current) { again.current = true; return; }
    running.current = true;
    setSyncing(true);
    try {
      const me = addressRef.current;
      const { fct, nft } = reader;
      const block = await rpc.getBlockNumber();

      const [stats, actorsRaw, page, ov, sched, authorized, nftOwner, name, symbol] = await Promise.all([
        nft.getStats(), nft.getActors(), nft.getBatchesPage(0, 500), fct.getOverview(), fct.getRewardSchedule(),
        fct.authorizedCallers(D.addresses.FoodBatchNFT), nft.owner(), fct.name(), fct.symbol(),
      ]);
      const unlocked = await rpc.listAccounts().catch(() => []);
      const mine = me
        ? await Promise.all([nft.getActorRole(me), fct.balanceOf(me), nft.getIncomingBatches(me), nft.getBatchesByHolder(me), rpc.getBalance(me)])
        : null;

      // Events are only re-read when a new block arrived.
      if (evCache.current.block !== block) {
        const from = Math.min(D.deployBlocks.FoodChainToken, D.deployBlocks.FoodBatchNFT);
        const [nl, fl] = await Promise.all([
          rpc.getLogs({ address: D.addresses.FoodBatchNFT, fromBlock: from, toBlock: block }),
          rpc.getLogs({ address: D.addresses.FoodChainToken, fromBlock: from, toBlock: block }),
        ]);
        const parse = (logs, c, kind) => logs.map((l) => {
          try {
            const p = c.interface.parseLog(l);
            return { kind, name: p.name, args: p.args, tx: l.transactionHash, block: l.blockNumber, idx: l.logIndex };
          } catch { return null; }
        }).filter(Boolean);
        const events = [...parse(nl, nft, "nft"), ...parse(fl, fct, "fct")].sort((a, b) => a.block - b.block || a.idx - b.idx);
        const blocks = [...new Set(events.map((e) => e.block))].filter((b) => !blockTs.current.has(b));
        await Promise.all(blocks.map(async (b) => { blockTs.current.set(b, (await rpc.getBlock(b)).timestamp); }));
        events.forEach((e) => { e.ts = blockTs.current.get(e.block); });
        evCache.current = { block, events };
      }

      setSnap({
        block,
        loadedAt: Date.now(),
        stats: { total: stats.total.toNumber(), byStatus: stats.byStatus.map((x) => x.toNumber()), actorCount: stats.actorCount.toNumber() },
        actors: actorsRaw.actors.map((a, i) => ({ address: a, role: Number(actorsRaw.roles[i]) })),
        batches: page.map(toBatch),
        token: {
          name, symbol, supply: ov.supply, max: ov.maxSupply, pool: ov.pool, rewarded: ov.rewarded,
          paused: ov.isPaused, owner: ov.admin,
        },
        schedule: sched.actionTypes.map((t, i) => ({ type: t, amount: sched.amounts[i] })),
        nftAuthorized: authorized,
        nftOwner,
        devAdmin: unlocked.some((a) => a.toLowerCase() === nftOwner.toLowerCase()),
        me: mine && {
          role: Number(mine[0]), balance: mine[1], incoming: mine[2].map((x) => x.toNumber()),
          held: mine[3].map((x) => x.toNumber()), eth: mine[4],
        },
        events: evCache.current.events,
      });
      setOffline(null);
      lastBlock.current = block;
    } catch (e) {
      console.error(e);
      setOffline(humanizeError(e));
    } finally {
      running.current = false;
      setSyncing(false);
      if (again.current) { again.current = false; setTimeout(() => loadRef.current?.(), 0); }
    }
  }, []);

  useEffect(() => { loadRef.current = load; }, [load]);

  // Live sync: every new block triggers a refresh (polling the Ganache RPC).
  useEffect(() => {
    load();
    const onBlock = () => load();
    rpc.on("block", onBlock);
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 8000);
    return () => { rpc.off("block", onBlock); clearInterval(t); };
  }, [load]);

  // ── Wallet ──────────────────────────────────────────────────────────────
  const applyAccounts = useCallback((accs) => {
    const a = accs && accs[0] ? ethers.utils.getAddress(accs[0]) : null;
    addressRef.current = a;
    setAddress(a);
    load();
  }, [load]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then(applyAccounts).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setWalletChain(parseInt(c, 16))).catch(() => {});
    const onAcc = (a) => applyAccounts(a);
    const onChain = (c) => setWalletChain(parseInt(c, 16));
    eth.on?.("accountsChanged", onAcc);
    eth.on?.("chainChanged", onChain);
    return () => { eth.removeListener?.("accountsChanged", onAcc); eth.removeListener?.("chainChanged", onChain); };
  }, [applyAccounts]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      pushToast({ tone: "error", title: "MetaMask not found", text: "Install the MetaMask extension, then reload this page." });
      return;
    }
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      applyAccounts(accs);
      setWalletChain(parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16));
    } catch (e) {
      pushToast({ tone: "error", title: "Wallet not connected", text: humanizeError(e) });
    }
  }, [applyAccounts, pushToast]);

  const disconnect = useCallback(() => { addressRef.current = null; setAddress(null); load(); }, [load]);

  const switchAccount = useCallback(async () => {
    try {
      await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      applyAccounts(await window.ethereum.request({ method: "eth_accounts" }));
    } catch (e) { pushToast({ tone: "error", title: "Could not switch account", text: humanizeError(e) }); }
  }, [applyAccounts, pushToast]);

  const switchNetwork = useCallback(async () => {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChain }] });
    } catch (e) {
      if (e.code === 4902 || /Unrecognized chain/i.test(e.message || "")) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: hexChain, chainName: "Ganache Local", rpcUrls: [RPC_URL], nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }],
          });
        } catch (e2) { pushToast({ tone: "error", title: "Network not added", text: humanizeError(e2) }); }
      } else pushToast({ tone: "error", title: "Could not switch network", text: humanizeError(e) });
    }
  }, [pushToast]);

  const watchToken = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address: D.addresses.FoodChainToken, symbol: "FCT", decimals: 18 } },
      });
    } catch (e) { pushToast({ tone: "error", title: "Token not added", text: humanizeError(e) }); }
  }, [pushToast]);

  // ── Writes ──────────────────────────────────────────────────────────────
  const writer = useMemo(() => {
    if (!address || wrongNetwork || !window.ethereum) return null;
    const signer = new ethers.providers.Web3Provider(window.ethereum, "any").getSigner();
    return {
      fct: new ethers.Contract(D.addresses.FoodChainToken, D.abi.FoodChainToken, signer),
      nft: new ethers.Contract(D.addresses.FoodBatchNFT, D.abi.FoodBatchNFT, signer),
    };
  }, [address, wrongNetwork]);

  /**
   * Sends a transaction with a full, honest lifecycle:
   * simulate (friendly revert reason, no MetaMask popup) → sign → mined → refresh.
   */
  const send = useCallback(async ({ title, on, method, args = [], success, asAdmin }) => {
    const adminW = asAdmin && snap?.devAdmin ? { fct: reader.fct.connect(rpc.getSigner(snap.nftOwner)), nft: reader.nft.connect(rpc.getSigner(snap.nftOwner)) } : null;
    const w = adminW || writer;
    if (!w) {
      pushToast({ tone: "error", title: "Wallet required", text: !address ? "Connect MetaMask first." : "Switch MetaMask to the Ganache network." });
      return null;
    }
    setBusy(true);
    const id = pushToast({ tone: "loading", title, text: "Checking the transaction against the contract…" });
    try {
      const c = w[on];
      await c.callStatic[method](...args);
      updateToast(id, { text: adminW ? "Signing with the local Ganache admin account…" : "Waiting for your signature in MetaMask…" });
      const tx = await c[method](...args, GAS);
      updateToast(id, { text: "Submitted - waiting for the block to be mined…", hash: tx.hash });
      const rc = await tx.wait();
      updateToast(id, {
        tone: "success", title: success || `${title} - confirmed`, hash: tx.hash,
        text: `Mined in block #${rc.blockNumber} · ${rc.gasUsed.toString()} gas`,
      });
      await load();
      return rc;
    } catch (e) {
      console.error(e);
      updateToast(id, { tone: "error", title: `${title} - failed`, text: humanizeError(e), hash: undefined });
      return null;
    } finally {
      setBusy(false);
    }
  }, [writer, address, snap, pushToast, updateToast, load]);

  /** One-click fix for local demos: fund the connected account with test ETH and give it a role, signed by Ganache's unlocked admin. */
  const quickSetup = useCallback(async (role, target, opts = {}) => {
    const me = target || addressRef.current;
    if (!me || !snap?.devAdmin) return false;
    setBusy(true);
    const id = pushToast({ tone: "loading", title: "Setting up your account", text: "Using the local Ganache admin account…" });
    try {
      const signer = rpc.getSigner(snap.nftOwner);
      const nft = reader.nft.connect(signer);
      if ((await rpc.getBalance(me)).lt(ethers.utils.parseEther("1"))) {
        updateToast(id, { text: "Sending 10 test ETH for gas fees…" });
        await (await signer.sendTransaction({ to: me, value: ethers.utils.parseEther("10"), ...GAS })).wait();
      }
      if (role != null && Number(await nft.getActorRole(me)) !== role) {
        updateToast(id, { text: "Assigning your role on-chain…" });
        await (await nft.setActorRole(me, role, GAS)).wait();
      }
      if (opts.fct) {
        updateToast(id, { text: `Sending ${opts.fct} test FCT from the reward pool…` });
        await (await reader.fct.connect(signer).transfer(me, ethers.utils.parseUnits(String(opts.fct), 18), GAS)).wait();
      }
      updateToast(id, { tone: "success", title: opts.fct ? `Your account now has ${opts.fct} test FCT` : "Account ready", text: opts.fct ? "Plus test ETH for gas. Try a transfer now." : "It has test ETH for gas and the role you picked." });
      await load();
      return true;
    } catch (e) {
      console.error(e);
      updateToast(id, { tone: "error", title: "Setup failed", text: humanizeError(e) });
      return false;
    } finally { setBusy(false); }
  }, [snap, pushToast, updateToast, load]);

  /** Sender of a tx (cached) - used by the activity feed. */
  const senderOf = useCallback(async (hash) => {
    if (txFrom.current.has(hash)) return txFrom.current.get(hash);
    const t = await rpc.getTransaction(hash);
    txFrom.current.set(hash, t?.from || null);
    return t?.from || null;
  }, []);

  const me = snap?.me || null;
  const isAdmin = !!me && (me.role === 5 || same(address, snap?.nftOwner));

  const value = {
    snap, offline, address, walletChain, hasWallet, wrongNetwork, syncing, busy,
    role: me?.role ?? 0, isAdmin, me,
    connect, disconnect, switchAccount, switchNetwork, watchToken, send, quickSetup, reload: load, senderOf,
    toasts, dismissToast, pushToast, reader, rpc, ZERO,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

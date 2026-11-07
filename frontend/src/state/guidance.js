import { D, ROLES, same, short, demoLabel } from "../blockchain/config";

/**
 * "What should I do now?" - derived only from on-chain state + the connected account.
 * Returns [{ tone, title, text, to?, cta?, action? }]
 */
export function nextSteps({ snap, address, hasWallet, wrongNetwork, role, isAdmin }) {
  const out = [];
  if (!snap) return out;
  if (!hasWallet) return [{ tone: "amber", title: "Install MetaMask", text: "A wallet is needed to sign transactions. You can still browse all data without it." }];
  if (!address) return [{ tone: "blue", title: "Connect your wallet", text: "Connect MetaMask to act on the supply chain. Browsing works without it.", action: "connect", cta: "Connect MetaMask" }];
  if (wrongNetwork) return [{ tone: "amber", title: "Switch to the Ganache network", text: `MetaMask must be on Chain ID ${D.chainId}.`, action: "network", cta: "Switch network" }];

  const me = snap.me;
  if (!me) return [{ tone: "blue", title: "Reading your account from the chain…", text: "One moment." }];
  const batches = snap.batches;
  const mineHeld = batches.filter((b) => me.held.includes(b.tokenId));
  const incoming = batches.filter((b) => me.incoming.includes(b.tokenId));
  const flagged = batches.filter((b) => b.status === 4);

  if (me.eth.isZero()) out.push({ tone: "amber", title: "This account has no ETH for gas", text: snap.devAdmin ? "One click sends it test ETH and a role." : "Import a funded Ganache account into MetaMask.", ...(snap.devAdmin ? { action: "setup", cta: "Fix my account" } : {}) });

  if (role === 0 && !isAdmin) {
    out.push({
      tone: "amber", title: "Your account has no role yet",
      text: `Ask the Admin to assign a role to ${short(address)}${demoLabel(address) ? ` (${demoLabel(address)} demo account)` : ""}. Until then you can only view data.`,
      ...(snap.devAdmin ? { action: "setup", cta: "Make me a Farmer" } : { to: "guide", cta: "Open the demo guide" }),
    });
    return out;
  }

  if (incoming.length) {
    out.push({
      tone: "blue", title: `${incoming.length} batch${incoming.length > 1 ? "es are" : " is"} waiting for you`,
      text: `Confirm receipt of ${incoming.map((b) => b.code).join(", ")} to take ownership${role === 4 ? " and complete the delivery" : ""}.`,
      to: "batches", cta: "Confirm receipt", open: incoming[0].tokenId,
    });
  }

  const shippable = mineHeld.filter((b) => b.status === 0 || b.status === 2);
  if (shippable.length && role !== 4) {
    out.push({
      tone: "green", title: `Ship ${shippable[0].code} to the next actor`,
      text: "You hold this batch. Pick a recipient with a Transporter, Wholesaler or Retailer role.",
      to: "batches", cta: "Ship batch", open: shippable[0].tokenId,
    });
  }

  if (role === 1 || (isAdmin && role !== 1 && snap.stats.total === 0)) {
    if (role === 1 && !shippable.length) {
      out.push({ tone: "green", title: "Register a new batch", text: "Mint the NFT passport of a harvested lot. You earn 10 FCT.", to: "batches", cta: "Register batch", action: "register" });
    }
    if (role !== 1 && snap.stats.total === 0) {
      out.push({ tone: "blue", title: "Start the demo as the Farmer", text: `Switch MetaMask to the Farmer account (${short(D.demoAccounts.farmer)}) to register the first batch.`, action: "switch", cta: "Switch account" });
    }
  }

  if (isAdmin) {
    const missing = [1, 3, 4].filter((r) => !snap.actors.some((a) => a.role === r));
    if (missing.length) out.push({ tone: "violet", title: "Assign the missing roles", text: `No ${missing.map((r) => ROLES[r].name).join(", ")} yet. Use the Actors page (demo accounts are pre-filled).`, to: "actors", cta: "Manage actors" });
    if (!snap.nftAuthorized) out.push({ tone: "rose", title: "NFT contract is not authorised to pay rewards", text: "Authorise it on the Rewards page, otherwise no FCT will be issued.", to: "rewards", cta: "Open Rewards" });
    if (flagged.length) out.push({ tone: "amber", title: `${flagged.length} flagged batch${flagged.length > 1 ? "es" : ""} to review`, text: "Clear the flag or recall the batch.", to: "batches", cta: "Review", open: flagged[0].tokenId });
  }

  if (!out.length) {
    out.push({
      tone: "green", title: "You are all set",
      text: role === 4 ? "Nothing waiting. Delivered batches appear in the list." : "Nothing to do right now - you will be notified here when a batch needs you.",
      to: "batches", cta: "Browse batches",
    });
  }
  return out;
}

/** Demo walkthrough progress, detected from chain state. */
export function demoProgress(snap) {
  if (!snap) return [];
  const ev = (n) => snap.events.filter((e) => e.name === n).length;
  const roles = (r) => snap.actors.some((a) => a.role === r);
  return [
    { id: "deploy", done: true, who: "Setup", title: "Contracts deployed", text: "FoodChainToken and FoodBatchNFT answer on Ganache." },
    { id: "auth", done: snap.nftAuthorized, who: "Admin", account: D.demoAccounts.admin, title: "NFT contract can reward actors", text: "The migration authorises the NFT in the FCT contract. Check the Rewards page.", to: "rewards" },
    { id: "roles", done: roles(1) && roles(3) && roles(4), who: "Admin", account: D.demoAccounts.admin, title: "Roles assigned", text: "Farmer, Transporter, Wholesaler and Retailer accounts get a role on the Actors page.", to: "actors" },
    { id: "reg", done: ev("BatchRegistered") > 0, who: "Farmer", account: D.demoAccounts.farmer, title: "Register a batch (mint the NFT)", text: "Example: TOM-TN-001, Tomatoes, Nabeul, 500 kg. The farmer instantly receives 10 FCT.", to: "batches", action: "register" },
    { id: "ship", done: ev("BatchShipped") > 0, who: "Farmer", account: D.demoAccounts.farmer, title: "Ship it to the transporter", text: "Open the batch and pick the transporter as recipient. Status becomes In transit.", to: "batches" },
    { id: "recv", done: ev("BatchReceived") > 0, who: "Transporter", account: D.demoAccounts.transporter, title: "Transporter confirms receipt", text: "Only the intended recipient can confirm. The NFT moves to the transporter; the farmer earns 3 FCT, the receiver 5 FCT.", to: "batches" },
    { id: "ship2", done: ev("BatchShipped") > 1, who: "Transporter", account: D.demoAccounts.transporter, title: "Ship on to the wholesaler", text: "The relay continues. You can also ship straight to the retailer.", to: "batches" },
    { id: "recv2", done: ev("BatchReceived") > 1, who: "Wholesaler", account: D.demoAccounts.wholesaler, title: "Wholesaler confirms, then ships to the retailer", text: "Confirm receipt, then ship to the retailer account.", to: "batches" },
    { id: "deliv", done: ev("BatchDelivered") > 0, who: "Retailer", account: D.demoAccounts.retailer, title: "Retailer confirms the final delivery", text: "Status becomes Delivered. Everyone along the chain has been rewarded once.", to: "batches" },
    { id: "hist", done: snap.stats.byStatus[3] > 0, who: "Anyone", title: "Read the full history", text: "Open the batch: every step has its actor, time, block and transaction hash.", to: "batches" },
    { id: "neg", done: null, who: "Unauthorized", account: D.demoAccounts.unauthorized, title: "Negative test: try to register a batch", text: "With the unauthorized account the app explains the refusal before anything is sent (the contract enforces it too).", to: "batches", action: "register" },
    { id: "rew", done: snap.token.rewarded.gt(0), who: "Anyone", title: "Check the FCT rewards", text: "Balances, reward reasons and transaction hashes are on the Rewards page. Try an ERC-20 transfer too.", to: "rewards" },
  ];
}

export { same };

/** Where a demo step happens ("page" or "page/arg"), picking the batch that is really at that stage. */
export function stepRoute(id, snap) {
  const find = (...sts) => snap?.batches.find((b) => sts.includes(b.status))?.tokenId;
  const any = () => find(0, 1, 2) ?? snap?.batches[0]?.tokenId;
  const open = (x) => (x ? `batches/${x}` : "batches");
  switch (id) {
    case "auth": case "rew": return "rewards";
    case "roles": return "actors";
    case "reg": case "neg": return "batches/new";
    case "ship": return open(find(0) ?? any());
    case "recv": case "deliv": return open(find(1) ?? any());
    case "ship2": return open(find(2) ?? any());
    case "recv2": return open(find(1, 2) ?? any());
    case "hist": return open(find(3) ?? snap?.batches[0]?.tokenId);
    default: return null;
  }
}

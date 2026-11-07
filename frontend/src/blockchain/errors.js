const HINTS = [
  ["Only a Farmer can register", "This account is not a Farmer. Switch to the Farmer account in MetaMask (or ask the admin to assign the role)."],
  ["Batch code already exists", "That batch code is already used. Every batch needs a unique code."],
  ["Only the current holder can ship", "Only the account that currently holds the batch can ship it. Check the 'Holder' field."],
  ["Recipient must be a", "The recipient needs a Transporter, Wholesaler or Retailer role. Assign it first in the Actors page."],
  ["Cannot ship to yourself", "Choose a different recipient than your own account."],
  ["You are not the expected recipient", "Only the address this batch was shipped to can confirm receipt. Switch accounts in MetaMask."],
  ["Batch is not in transit", "This batch is not waiting for a receipt right now."],
  ["Admin role required", "Only an Admin can do this. Switch to the Admin account."],
  ["Only registered actors can flag", "Only accounts with a role can flag a batch."],
  ["Reward pool insufficient", "The reward pool (owner balance) is empty. The admin can top it up from the Rewards page."],
  ["Operation already rewarded", "This operation was already rewarded - double rewards are blocked by the contract."],
  ["Caller not authorized", "This account may not issue rewards."],
  ["Max supply exceeded", "That would go beyond the FCT maximum supply."],
  ["exceeds balance", "Insufficient FCT balance for this transfer."],
  ["insufficient allowance", "Allowance too low - approve a larger amount first."],
  ["Pausable: paused", "Rewards are paused by the admin."],
  ["insufficient funds", "This account has no ETH for gas on Ganache."],
  ["Harvest date must be in the past", "Pick a harvest date that is today or earlier."],
  ["Approvals are disabled", "Batch NFTs cannot be approved or transferred directly - use Ship / Confirm receipt."],
  ["Use shipBatch/confirmReceipt", "Batch NFTs cannot be transferred directly - use Ship / Confirm receipt."],
];

export function humanizeError(e) {
  if (!e) return "Unknown error.";
  if (e.code === 4001 || e.code === "ACTION_REJECTED" || /user (rejected|denied)/i.test(e.message || ""))
    return "You rejected the request in MetaMask. Nothing was sent.";
  if (e.code === -32002) return "MetaMask already has a pending request - open the extension and answer it.";
  if (e.code === "NETWORK_ERROR" || /could not detect network|failed to fetch/i.test(e.message || ""))
    return "Cannot reach Ganache. Is it running on the expected RPC URL?";
  const raw = [e.reason, e.error?.message, e.data?.message, e.error?.data?.message, e.message]
    .filter(Boolean).join(" | ");
  const hit = HINTS.find(([k]) => raw.includes(k));
  if (hit) return hit[1];
  const m = raw.match(/revert(?:ed with reason string)?:? '?([^'|]+)/i);
  return (m ? m[1] : raw).trim().slice(0, 220) || "Transaction failed.";
}

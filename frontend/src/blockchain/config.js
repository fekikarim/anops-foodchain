import { ethers } from "ethers";
import deployment from "./deployment.json";

export const D = deployment;
export const RPC_URL = import.meta.env.VITE_RPC_URL || deployment.rpcUrl;
export const ZERO = ethers.constants.AddressZero;

export const ROLES = {
  0: { name: "No role", tone: "muted", can: "Can only view public traceability data." },
  1: { name: "Farmer", tone: "green", can: "Registers batches (mints the NFT passport) and ships them." },
  2: { name: "Transporter", tone: "blue", can: "Receives batches from the farmer and carries them onward." },
  3: { name: "Wholesaler", tone: "violet", can: "Confirms receipts and ships batches to retailers." },
  4: { name: "Retailer", tone: "amber", can: "Confirms the final delivery (batch becomes Delivered)." },
  5: { name: "Admin", tone: "rose", can: "Assigns roles, flags / recalls / cancels batches, manages rewards." },
};
export const ASSIGNABLE_ROLES = [1, 2, 3, 4, 5, 0];
export const RECIPIENT_ROLES = [2, 3, 4];

export const STATUS = [
  { name: "Created",    tone: "green",  hint: "Registered, waiting to be shipped." },
  { name: "In transit", tone: "blue",   hint: "On its way - the recipient must confirm receipt." },
  { name: "Received",   tone: "violet", hint: "Received by an intermediary, can be shipped on." },
  { name: "Delivered",  tone: "teal",   hint: "Final delivery confirmed by the retailer." },
  { name: "Flagged",    tone: "amber",  hint: "Reported as suspicious - frozen until an admin clears it." },
  { name: "Recalled",   tone: "rose",   hint: "Recalled - the journey is closed." },
  { name: "Cancelled",  tone: "muted",  hint: "Cancelled - the journey is closed." },
];
export const STEPPER = [0, 1, 2, 3];

const h = (s) => ethers.utils.id(s);
export const REWARD_ACTIONS = {
  [h("REGISTER_BATCH")]: { key: "REGISTER_BATCH", label: "Batch registration", who: "Farmer" },
  [h("SHIP_BATCH")]:     { key: "SHIP_BATCH",     label: "Shipment confirmed by recipient", who: "Shipper" },
  [h("RECEIVE_BATCH")]:  { key: "RECEIVE_BATCH",  label: "Receipt confirmed", who: "Receiver" },
  [h("DELIVER_BATCH")]:  { key: "DELIVER_BATCH",  label: "Final delivery", who: "Retailer" },
};

export const FLAG_REASONS = ["TEMPERATURE", "CONTAMINATION", "QUALITY", "DOCUMENTS", "OTHER"];
export const UNITS = ["kg", "t", "crates"];
export const PRODUCTS = ["Tomatoes", "Oranges", "Potatoes", "Apples", "Lettuce", "Strawberries"];

export const bytes32 = (s) => ethers.utils.formatBytes32String(s);
export const unbytes32 = (b) => { try { return ethers.utils.parseBytes32String(b); } catch { return b.slice(0, 10) + "…"; } };
export const short = (a, l = 6, r = 4) => (a ? `${a.slice(0, l)}…${a.slice(-r)}` : "");
export const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function fmtFct(v, max = 2) {
  const n = Number(ethers.utils.formatUnits(v, 18));
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}
export const fmtDate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
export const fmtDateTime = (ts) => new Date(Number(ts) * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - Number(ts)));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const demoLabel = (addr) => {
  const hit = Object.entries(D.demoAccounts).find(([, a]) => same(a, addr));
  if (!hit) return null;
  return hit[0] === "unauthorized" ? "Unauthorized" : hit[0][0].toUpperCase() + hit[0].slice(1);
};

/** Normalise an ethers Result BatchInfo into a plain object. */
export function toBatch(b) {
  return {
    tokenId: b.tokenId.toNumber(),
    code: unbytes32(b.batchCode),
    productType: b.productType,
    producerName: b.producerName,
    originRegion: b.originRegion,
    harvestDate: b.harvestDate.toNumber(),
    quantity: b.quantity.toString(),
    unit: b.quantityUnit,
    registrationDate: b.registrationDate.toNumber(),
    status: Number(b.status),
    holder: b.currentHolder,
    recipient: b.expectedRecipient === ZERO ? null : b.expectedRecipient,
    uri: b.metadataURI,
  };
}

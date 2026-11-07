import { useChain } from "../state/ChainContext";
import { ROLES, short } from "../blockchain/config";
import { Btn, Card, Icon } from "./ui";
import { ethers } from "ethers";

const PICK = [1, 2, 3, 4, 5];

/** Local-demo shortcut: no admin account, keys or ETH juggling needed. */
export default function QuickSetup({ compact }) {
  const c = useChain();
  const { snap } = c;
  if (!snap?.devAdmin || !c.address || !snap.me) return null;
  const eth = Number(ethers.utils.formatEther(snap.me.eth));
  const broken = snap.me.role === 0 || eth < 0.1;
  if (compact && !broken) return null;
  return (
    <Card title={broken ? "Fix my account in one click" : "Change my role"} sub={`${short(c.address)} · ${ROLES[snap.me.role].name} · ${eth.toFixed(2)} ETH`} className="quick">
      <p className="muted">
        {broken
          ? "This account has no test ETH or no role, so MetaMask transactions would fail. Pick the role you want to try - the app sends test ETH and assigns it for you (local Ganache shortcut, no MetaMask popup)."
          : "Local Ganache shortcut: switch your connected account to another role instantly."}
      </p>
      <div className="chips wrapchips">
        {PICK.map((r) => (
          <Btn key={r} tone={r === snap.me.role ? "primary" : "soft"} tx icon={r === snap.me.role ? "check" : "users"} onClick={() => c.quickSetup(r)}>
            {r === snap.me.role ? `${ROLES[r].name} (current)` : `Make me ${ROLES[r].name}`}
          </Btn>
        ))}
      </div>
      <small><Icon n="help" size={13} /> Works only because Ganache keeps its accounts unlocked. On a real network only the Admin could do this.</small>
    </Card>
  );
}

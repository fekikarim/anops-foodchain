import { useState } from "react";
import { ethers } from "ethers";
import { useChain } from "../state/ChainContext";
import { D, ROLES, ASSIGNABLE_ROLES, same, demoLabel } from "../blockchain/config";
import { Addr, Btn, Card, Empty, Field, RoleBadge, Icon } from "../components/ui";
import QuickSetup from "../components/QuickSetup";

export default function Actors() {
  const c = useChain();
  const { snap } = c;
  const [addr, setAddr] = useState("");
  const [role, setRole] = useState(1);
  const valid = ethers.utils.isAddress(addr);

  const assign = async (a, r) => {
    const label = r === 0 ? "Revoking role" : "Assigning role";
    if (!c.isAdmin && snap?.devAdmin) { // local shortcut: also tops up gas so the account can really transact
      const ok = await c.quickSetup(r, a);
      if (ok && a === addr) setAddr("");
      return;
    }
    const ok = await c.send({ title: label, on: "nft", method: "setActorRole", args: [a, r], asAdmin: !c.isAdmin, success: r === 0 ? "Role revoked" : `${ROLES[r].name} role assigned` });
    if (ok && a === addr) setAddr("");
  };

  return (
    <div className="stack">
      <div className="page-h"><div><h1>Actors</h1><p>Roles live in the NFT contract - hiding a button is never the only protection.</p></div></div>

      <QuickSetup />

      <div className="grid roles">
        {[1, 2, 3, 4, 5].map((r) => (
          <div key={r} className="role-card"><RoleBadge role={r} /><p>{ROLES[r].can}</p></div>
        ))}
      </div>

      <div className="grid two">
        <Card title="Registered actors" sub={snap ? `${snap.actors.filter((a) => a.role).length} active` : ""}>
          {!snap ? <div className="skel sk-block" /> : snap.actors.length === 0 ? <Empty icon="users" title="No actors" /> : (
            <ul className="actor-list">
              {snap.actors.map((a) => (
                <li key={a.address}>
                  <div><Addr a={a.address} me={same(a.address, c.address)} /></div>
                  <RoleBadge role={a.role} />
                  {(c.isAdmin || snap.devAdmin) && !same(a.address, snap.nftOwner) && a.role !== 0 && (
                    <Btn tone="ghost" tx onClick={() => assign(a.address, 0)} aria-label="Revoke role">Revoke</Btn>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div data-tour="assign"><Card title="Assign a role" sub={c.isAdmin ? "You are the Admin" : snap?.devAdmin ? "Local shortcut: signed by the Ganache admin for you" : "Only the Admin can change roles"}>
          {!c.isAdmin && !snap?.devAdmin && (
            <div className="callout info"><Icon n="help" /><div><p>{c.address ? "Your account is not the Admin, so the contract would refuse this." : "Connect the Admin account to manage roles."} Admin demo account: <span className="mono">{D.demoAccounts.admin}</span></p></div></div>
          )}
          <Field label="Quick pick">
            <div className="chips">
              {c.address && <button type="button" className={`chip-f ${same(c.address, addr) ? "on" : ""}`} onClick={() => setAddr(c.address)}>My connected account</button>}
              {Object.entries(D.demoAccounts).map(([k, a]) => (
                <button key={k} type="button" className={`chip-f ${same(a, addr) ? "on" : ""}`} onClick={() => setAddr(a)}>{k[0].toUpperCase() + k.slice(1)}</button>
              ))}
            </div>
          </Field>
          <Field label="Address" error={addr && !valid ? "Not a valid address" : ""}>
            <input value={addr} onChange={(e) => setAddr(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
          </Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(Number(e.target.value))}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].name}{r === 0 ? " (revoke)" : ""}</option>)}
            </select>
          </Field>
          {valid && demoLabel(addr) && <p className="note">This is the <b>{demoLabel(addr)}</b> demo account.</p>}
          <Btn tx busy={c.busy} disabled={!valid} icon="users" onClick={() => assign(addr, role)}>Save role</Btn>
        </Card></div>
      </div>
    </div>
  );
}

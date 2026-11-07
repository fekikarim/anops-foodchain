import { useChain } from "../state/ChainContext";
import { go } from "../state/route";
import { demoProgress, stepRoute } from "../state/guidance";
import { D, ROLES, same, short, RPC_URL } from "../blockchain/config";
import { Card, Icon, Btn, CopyText, Badge } from "../components/ui";

export default function Guide() {
  const c = useChain();
  const steps = demoProgress(c.snap);
  const doneN = steps.filter((s) => s.done).length;
  const nextIdx = steps.findIndex((s) => s.done === false);
  const pct = steps.length ? Math.round((doneN / (steps.filter((s) => s.done !== null).length || 1)) * 100) : 0;

  return (
    <div className="stack">
      <div className="page-h">
        <div><h1>Demo guide</h1><p>A guided end-to-end test of both contracts. Progress is detected from the blockchain, never faked.</p></div>
        <div className="row"><Btn tone="soft" icon="book" onClick={() => window.dispatchEvent(new Event("foodchain:tour"))}>Start guided tour</Btn><div className="ring" style={{ "--p": Math.min(pct, 100) }}><b>{Math.min(pct, 100)}%</b></div></div>
      </div>

      <Card title="1 · Prepare MetaMask" sub="Once per session">
        <ol className="prep">
          <li>Add the network: <b>Ganache Local</b> · RPC <CopyText value={RPC_URL}>{RPC_URL}</CopyText> · Chain ID <b>{D.chainId}</b> · symbol ETH. <Btn tone="soft" onClick={c.switchNetwork}>Add / switch automatically</Btn></li>
          <li>Import the six Ganache test accounts below (private keys are shown in Ganache, never paste them anywhere else).</li>
          <li>Pick an account in MetaMask, then press <b>Connect wallet</b>. Use <b>Switch account</b> in the wallet menu to change role during the demo.</li>
        </ol>
        <div className="acct-grid">
          {Object.entries(D.demoAccounts).map(([k, a]) => {
            const role = c.snap?.actors.find((x) => same(x.address, a))?.role ?? 0;
            const mine = same(a, c.address);
            return (
              <div key={k} className={`acct ${mine ? "mine" : ""}`}>
                <div className="acct-h"><b>{k[0].toUpperCase() + k.slice(1)}</b>{mine && <span className="you">connected</span>}</div>
                <CopyText value={a}>{short(a, 8, 6)}</CopyText>
                <Badge tone={ROLES[role].tone}>{ROLES[role].name}</Badge>
              </div>
            );
          })}
        </div>
        <p className="note">Account order follows Ganache: #1 admin/deployer, #2 farmer, #3 transporter, #4 wholesaler, #5 retailer, #6 has no role.</p>
      </Card>

      <Card title="2 · Run the scenario" sub="Follow the steps in order - each one switches to done when the chain confirms it">
        {!c.snap ? <div className="skel sk-block" /> : (
          <ol className="journey">
            {steps.map((s, i) => {
              const state = s.done === true ? "done" : i === nextIdx ? "now" : "todo";
              const mine = s.account && same(s.account, c.address);
              return (
                <li key={s.id} className={state}>
                  <span className="j-dot">{s.done ? <Icon n="check" size={14} /> : i + 1}</span>
                  <div className="j-body">
                    <div className="j-h">
                      <b>{s.title}</b>
                      <Badge tone={s.who === "Setup" || s.who === "Anyone" ? "muted" : "blue"}>{s.who}</Badge>
                      {s.done === null && <Badge tone="amber">manual check</Badge>}
                    </div>
                    <p>{s.text}</p>
                    {s.account && (
                      <p className="who">Use account <CopyText value={s.account}>{short(s.account, 8, 6)}</CopyText>
                        {c.address && (mine ? <span className="ok"> · you are on it</span> : <span className="warn"> · switch to it in MetaMask</span>)}
                      </p>
                    )}
                    {s.to && state !== "done" && (
                      <Btn tone={state === "now" ? "primary" : "ghost"} onClick={() => { const [pg, arg] = (stepRoute(s.id, c.snap) || s.to).split("/"); go(pg, arg); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Show me</Btn>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card title="3 · What to check at the end">
        <ul className="checks">
          <li><Icon n="check" size={16} /> Ganache shows the transactions (and the same hashes appear in the Activity page).</li>
          <li><Icon n="check" size={16} /> Each actor earned FCT exactly once per operation; replaying an operation is refused by the contract.</li>
          <li><Icon n="check" size={16} /> The NFT holder follows the batch; direct NFT transfers and approvals revert.</li>
          <li><Icon n="check" size={16} /> A flagged batch is frozen until an admin clears it; a recalled one is closed for good.</li>
        </ul>
      </Card>
    </div>
  );
}

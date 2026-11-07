import { useEffect, useState } from "react";
import { useChain } from "../state/ChainContext";
import { go } from "../state/route";
import { ago, fmtDateTime, short, demoLabel } from "../blockchain/config";
import { Card, CopyText, Empty, Icon } from "../components/ui";
import { describeEvent, feedOf } from "./Overview";

function Sender({ hash }) {
  const { senderOf } = useChain();
  const [a, setA] = useState(null);
  useEffect(() => { let on = true; senderOf(hash).then((x) => on && setA(x)).catch(() => {}); return () => { on = false; }; }, [hash, senderOf]);
  return a ? <span>{demoLabel(a) || short(a)}</span> : <span className="muted">…</span>;
}

const FN = {
  BatchRegistered: "registerBatch", BatchShipped: "shipBatch", BatchReceived: "confirmReceipt", BatchDelivered: "confirmReceipt",
  BatchFlagged: "flagBatch", BatchFlagCleared: "clearFlag", BatchRecalled: "recallBatch", BatchCancelled: "cancelBatch",
  ActorRoleSet: "setActorRole", RewardIssued: "rewardForAction", RewardAmountUpdated: "setRewardAmount",
  AuthorizedCallerUpdated: "setAuthorizedCaller", PoolToppedUp: "mint", Transfer: "transfer", Approval: "approve",
};

export default function Activity() {
  const c = useChain();
  const { snap } = c;
  const rows = snap ? feedOf(snap).slice(0, 80) : [];
  return (
    <div className="stack">
      <div className="page-h"><div><h1>Blockchain activity</h1><p>Transactions and events read straight from the two contracts, newest first. Compare the hashes with Ganache's Transactions tab.</p></div></div>
      <Card>
        {!snap ? <div className="skel sk-block" /> : rows.length === 0 ? <Empty icon="pulse" title="No activity yet" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Event</th><th>Function</th><th>From</th><th>Block</th><th>Time</th><th>Tx hash</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((e) => {
                  const d = describeEvent(e, snap);
                  if (!d) return null;
                  const tid = e.args?.tokenId !== undefined ? Number(e.args.tokenId) : null;
                  return (
                    <tr key={`${e.tx}-${e.idx}`}>
                      <td data-l="Event"><div className="ev"><span className={`feed-i tone-${d.tone}`}><Icon n={d.icon} size={14} /></span><span>{d.text}</span></div></td>
                      <td data-l="Function" className="mono">{FN[e.name] || e.name}()</td>
                      <td data-l="From"><Sender hash={e.tx} /></td>
                      <td data-l="Block" className="mono">#{e.block}</td>
                      <td data-l="Time" title={fmtDateTime(e.ts)}>{ago(e.ts)}</td>
                      <td data-l="Tx"><CopyText value={e.tx}>{short(e.tx, 8, 6)}</CopyText></td>
                      <td data-l="Status">{tid ? <button className="link" onClick={() => go("batches", tid)}>Confirmed · open batch</button> : <span className="ok">Confirmed</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

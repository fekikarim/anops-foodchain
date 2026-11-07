import { useChain } from "../state/ChainContext";
import { go } from "../state/route";
import { nextSteps } from "../state/guidance";
import { STATUS, fmtFct, ago, short, unbytes32, REWARD_ACTIONS, demoLabel } from "../blockchain/config";
import { Card, Stat, Icon, Btn, Empty, Badge } from "../components/ui";
import QuickSetup from "../components/QuickSetup";

export function describeEvent(e, snap) {
  const a = e.args;
  const code = (id) => snap?.batches.find((b) => b.tokenId === Number(id))?.code || `#${id}`;
  const who = (x) => demoLabel(x) || short(x);
  switch (e.name) {
    case "BatchRegistered": return { icon: "plus", tone: "green", text: <>Batch <b>{code(a.tokenId)}</b> registered by {who(a.producer)}</> };
    case "BatchShipped": return { icon: "arrow", tone: "blue", text: <><b>{code(a.tokenId)}</b> shipped {who(a.from)} → {who(a.to)}</> };
    case "BatchReceived": return { icon: "check", tone: "violet", text: <><b>{code(a.tokenId)}</b> received by {who(a.recipient)}</> };
    case "BatchDelivered": return { icon: "check", tone: "teal", text: <><b>{code(a.tokenId)}</b> delivered to {who(a.recipient)}</> };
    case "BatchFlagged": return { icon: "flag", tone: "amber", text: <><b>{code(a.tokenId)}</b> flagged ({unbytes32(a.reasonCode)}) by {who(a.actor)}</> };
    case "BatchFlagCleared": return { icon: "check", tone: "green", text: <>Flag cleared on <b>{code(a.tokenId)}</b></> };
    case "BatchRecalled": return { icon: "alert", tone: "rose", text: <><b>{code(a.tokenId)}</b> recalled</> };
    case "BatchCancelled": return { icon: "x", tone: "muted", text: <><b>{code(a.tokenId)}</b> cancelled</> };
    case "ActorRoleSet": return { icon: "users", tone: "violet", text: <>{who(a.actor)} role set to <b>{["None", "Farmer", "Transporter", "Wholesaler", "Retailer", "Admin"][Number(a.role)]}</b></> };
    case "RewardIssued": return { icon: "coin", tone: "amber", text: <>{who(a.actor)} earned <b>{fmtFct(a.amount)} FCT</b></> };
    case "RewardSkipped": return { icon: "alert", tone: "rose", text: <>Reward skipped for {who(a.actor)}: {a.reason}</> };
    case "RewardAmountUpdated": return { icon: "coin", tone: "muted", text: <>Reward amount updated to {fmtFct(a.newAmount)} FCT</> };
    case "AuthorizedCallerUpdated": return { icon: "check", tone: "muted", text: <>{who(a.caller)} {a.authorized ? "authorised" : "revoked"} as reward caller</> };
    case "PoolToppedUp": return { icon: "coin", tone: "muted", text: <>Reward pool topped up by {fmtFct(a.amount)} FCT</> };
    case "Transfer": return { icon: "arrow", tone: "muted", text: <>{fmtFct(a.value)} FCT: {who(a.from)} → {who(a.to)}</> };
    case "Approval": return { icon: "check", tone: "muted", text: <>{who(a.owner)} approved {who(a.spender)} for {fmtFct(a.value)} FCT</> };
    default: return null;
  }
}

const HIDE = new Set(["RewardAction", "Paused", "Unpaused", "OwnershipTransferred", "ApprovalForAll"]);
export function feedOf(snap) {
  const rewardTx = new Set(snap.events.filter((e) => e.name === "RewardIssued").map((e) => e.tx));
  return snap.events.filter((e) => {
    if (HIDE.has(e.name)) return false;
    if (e.name === "Transfer") return !rewardTx.has(e.tx) && e.args.from !== "0x0000000000000000000000000000000000000000";
    if (e.kind === "nft" && e.name === "Transfer") return false;
    return true;
  }).reverse();
}

export function NextSteps() {
  const c = useChain();
  const steps = nextSteps(c);
  const act = (s) => {
    if (s.action === "connect") return c.connect();
    if (s.action === "network") return c.switchNetwork();
    if (s.action === "switch") return c.switchAccount();
    if (s.action === "setup") return c.quickSetup(1);
    if (s.to === "batches") return go("batches", s.action === "register" ? "new" : s.open);
    if (s.to) return go(s.to);
  };
  if (!steps.length) return null;
  return (
    <Card title="What should I do now?" sub="Based on your account and the current on-chain state" className="next">
      <ul className="steps">
        {steps.map((s, i) => (
          <li key={i} className={`tone-${s.tone}`}>
            <span className="bar" />
            <div><b>{s.title}</b><p>{s.text}</p></div>
            {s.cta && <Btn tone="soft" onClick={() => act(s)}>{s.cta}</Btn>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Overview() {
  const c = useChain();
  const { snap } = c;
  const loading = !snap;
  const st = snap?.stats;
  const feed = snap ? feedOf(snap).slice(0, 7) : [];
  const total = st?.total || 0;

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <Badge tone="green" dot>Live from Ganache</Badge>
          <h1>Know exactly where every batch has been.</h1>
          <p>Each batch of fresh produce is an ERC-721 passport. Every step is signed, timestamped and rewarded with ERC-20 <b>FCT</b> points once the next actor confirms it.</p>
        </div>
        <div className="hero-cta">
          <Btn icon="plus" onClick={() => go("batches", "new")}>Register a batch</Btn>
          <Btn tone="ghost" icon="book" onClick={() => window.dispatchEvent(new Event("foodchain:tour"))}>Start the guided tour</Btn>
        </div>
      </section>

      <QuickSetup compact />

      <div className="grid stats">
        <Stat loading={loading} label="Batches" value={st?.total} tone="green" note="NFT passports minted" />
        <Stat loading={loading} label="In transit" value={st?.byStatus[1]} tone="blue" note="Waiting for confirmation" />
        <Stat loading={loading} label="Received / delivered" value={st && st.byStatus[2] + st.byStatus[3]} tone="violet" note={st && `${st.byStatus[3]} fully delivered`} />
        <Stat loading={loading} label="Flagged / recalled" value={st && st.byStatus[4] + st.byStatus[5]} tone="rose" note="Needs attention" />
        <Stat loading={loading} label="Actors" value={st?.actorCount} tone="amber" note="Addresses with a role" />
        <Stat loading={loading} label="FCT rewarded" value={snap && fmtFct(snap.token.rewarded)} tone="teal" note={snap && `Pool: ${fmtFct(snap.token.pool, 0)} FCT`} />
      </div>

      <div className="grid two">
        <NextSteps />
        <Card title="Batches by status" sub="Counted by the NFT contract">
          {loading ? <div className="skel sk-block" /> : total === 0 ? (
            <Empty icon="box" title="No batch yet">Register the first batch to see the distribution.</Empty>
          ) : (
            <>
              <div className="dist" role="img" aria-label="Distribution of batches by status">
                {STATUS.map((s, i) => st.byStatus[i] > 0 && <i key={s.name} className={`tone-${s.tone}`} style={{ flexGrow: st.byStatus[i] }} title={`${s.name}: ${st.byStatus[i]}`} />)}
              </div>
              <ul className="legend">
                {STATUS.map((s, i) => (
                  <li key={s.name}><i className={`dot tone-${s.tone}`} />{s.name}<b>{st.byStatus[i]}</b></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Recent activity" sub="Every line is a real on-chain event" action={<Btn tone="ghost" onClick={() => go("activity")}>See all</Btn>}>
        {loading ? <div className="skel sk-block" /> : feed.length === 0 ? (
          <Empty icon="pulse" title="Nothing has happened yet">Actions you take will show up here within a block.</Empty>
        ) : (
          <ul className="feed">
            {feed.map((e) => {
              const d = describeEvent(e, snap);
              return d && (
                <li key={`${e.tx}-${e.idx}`}>
                  <span className={`feed-i tone-${d.tone}`}><Icon n={d.icon} size={15} /></span>
                  <span className="feed-t">{d.text}</span>
                  <span className="feed-m">{ago(e.ts)} · #{e.block}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export { REWARD_ACTIONS };

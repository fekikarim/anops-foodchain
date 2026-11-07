import { useState } from "react";
import { ethers } from "ethers";
import { useChain } from "../state/ChainContext";
import { D, REWARD_ACTIONS, ago, demoLabel, fmtFct, same, short } from "../blockchain/config";
import { Addr, Badge, Btn, Card, CopyText, Empty, Field, Icon, Stat } from "../components/ui";

const parseAmt = (s) => { try { return s && Number(s) > 0 ? ethers.utils.parseUnits(s, 18) : null; } catch { return null; } };
const validAddr = (a) => ethers.utils.isAddress(a);

export default function Rewards() {
  const c = useChain();
  const { snap } = c;
  const t = snap?.token;
  const pct = t ? Math.min(100, Number((t.supply.mul(1000).div(t.max)).toString()) / 10) : 0;

  const history = (snap?.events || []).filter((e) => e.name === "RewardIssued").map((e) => {
    const act = snap.events.find((x) => x.name === "RewardAction" && x.tx === e.tx && x.args.operationId === e.args.operationId);
    return { ...e, action: act ? REWARD_ACTIONS[act.args.actionType] : null, custom: !!act && !REWARD_ACTIONS[act.args.actionType] };
  }).reverse();

  return (
    <div className="stack">
      <div className="page-h">
        <div><h1>Rewards · FoodChainToken</h1><p>FCT is an ERC-20 points token that rewards validated steps. It is a demo token with no monetary value.</p></div>
        {c.address && <Btn tone="ghost" icon="plus" onClick={c.watchToken}>Add FCT to MetaMask</Btn>}
      </div>

      <div className="grid stats" data-tour="balance">
        <Stat loading={!snap} label="Your FCT balance" value={snap?.me ? fmtFct(snap.me.balance) : "-"} tone="green" note={c.address ? undefined : "Connect to see it"} />
        <Stat loading={!snap} label="Reward pool" value={t && fmtFct(t.pool, 0)} tone="blue" note="Admin balance paying rewards" />
        <Stat loading={!snap} label="Total rewarded" value={t && fmtFct(t.rewarded)} tone="amber" />
        <Stat loading={!snap} label="Total supply" value={t && fmtFct(t.supply, 0)} tone="violet" note={t && `Max ${fmtFct(t.max, 0)} · ${pct.toFixed(0)}% minted`} />
      </div>

      {snap && (
        <div className="grid two">
          <Card title="Reward schedule" sub="Paid once per operation, only after the next actor validates it">
            <ul className="plain">
              {snap.schedule.map((s) => {
                const a = REWARD_ACTIONS[s.type];
                return <li key={s.type}><span>{a?.label}<small> · {a?.who}</small></span><b>{fmtFct(s.amount)} FCT</b></li>;
              })}
            </ul>
            <div className="status-rows">
              <div><Icon n={snap.nftAuthorized ? "check" : "alert"} size={16} /> NFT contract {snap.nftAuthorized ? "is authorised to pay rewards" : "is NOT authorised - no rewards will be paid"}</div>
              <div><Icon n={t.paused ? "alert" : "check"} size={16} /> Rewards are {t.paused ? "paused" : "active"}</div>
              <div className="mono"><small>Token</small> <CopyText value={D.addresses.FoodChainToken} /></div>
            </div>
          </Card>
          <Wallet />
        </div>
      )}

      {snap?.devAdmin && c.address && snap.me && (
        <Card title="Get test funds" sub="Local Ganache shortcut - no MetaMask popup" className="quick">
          <p className="muted">You have <b>{fmtFct(snap.me.balance)} FCT</b> and <b>{Number(ethers.utils.formatEther(snap.me.eth)).toFixed(2)} ETH</b>. FCT is earned by completing steps (register, ship, receive…). To try transfers right now, take some from the reward pool:</p>
          <div className="row">
            <Btn tx busy={c.busy} icon="coin" onClick={() => c.quickSetup(null, undefined, { fct: 100 })}>Get 100 test FCT</Btn>
            <Btn tone="soft" tx busy={c.busy} onClick={() => c.quickSetup(null, undefined, { fct: 1000 })}>Get 1,000</Btn>
          </div>
        </Card>
      )}

      {(c.isAdmin || snap?.devAdmin) && snap && <Admin />}

      <Card title="Reward history" sub="Each reward is linked to the operation that triggered it">
        {!snap ? <div className="skel sk-block" /> : history.length === 0 ? <Empty icon="coin" title="No reward paid yet">Register a batch as a Farmer to earn the first 10 FCT.</Empty> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Actor</th><th>Reason</th><th>Amount</th><th>When</th><th>Tx hash</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.tx}${h.idx}`}>
                    <td data-l="Actor"><Addr a={h.args.actor} me={same(h.args.actor, c.address)} /></td>
                    <td data-l="Reason">{h.action ? <Badge tone="green">{h.action.label}</Badge> : <Badge tone="muted">{h.custom ? "Custom reward" : "Manual reward"}</Badge>}</td>
                    <td data-l="Amount"><b>+{fmtFct(h.args.amount)} FCT</b></td>
                    <td data-l="When">{ago(h.ts)} · #{h.block}</td>
                    <td data-l="Tx"><CopyText value={h.tx}>{short(h.tx, 8, 6)}</CopyText></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** ERC-20 playground: transfer / approve / allowance / transferFrom. */
function Wallet() {
  const c = useChain();
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [mode, setMode] = useState("transfer");
  const [from, setFrom] = useState("");
  const [allow, setAllow] = useState(null);
  const amount = parseAmt(amt);
  const sym = c.snap.token.symbol;

  const needFrom = mode === "transferFrom";
  const bal = c.snap.me?.balance;
  const tooMuch = !needFrom && mode !== "approve" && !!amount && !!bal && amount.gt(bal);
  const noGas = !!c.snap.me && c.snap.me.eth.isZero();
  const ok = validAddr(to) && amount && !tooMuch && (!needFrom || validAddr(from));
  const quick = Object.entries(D.demoAccounts).filter(([, a]) => !same(a, c.address));

  const submit = async () => {
    const cfg = {
      transfer: { title: "Transferring FCT", method: "transfer", args: [to, amount], success: `${amt} FCT sent` },
      approve: { title: "Approving spender", method: "approve", args: [to, amount], success: `Spender approved for ${amt} FCT` },
      transferFrom: { title: "Transferring on behalf", method: "transferFrom", args: [from, to, amount], success: `${amt} FCT moved` },
    }[mode];
    const r = await c.send({ ...cfg, on: "fct" });
    if (r) { setAmt(""); }
  };
  const checkAllow = async () => {
    if (!c.address || !validAddr(to)) return;
    const v = await c.reader.fct.allowance(c.address, to);
    setAllow(v);
  };

  return (
    <Card title="Use your FCT" sub="Standard ERC-20 functions - try them with another demo account">
      <div className="seg" role="tablist">
        {[["transfer", "Transfer"], ["approve", "Approve"], ["transferFrom", "Transfer from"]].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? "on" : ""} onClick={() => { setMode(id); setAllow(null); }}>{l}</button>
        ))}
      </div>
      {needFrom && <Field label="From (owner who approved you)" error={from && !validAddr(from) ? "Invalid address" : ""}><input value={from} onChange={(e) => setFrom(e.target.value.trim())} placeholder="0x…" spellCheck={false} /></Field>}
      <Field label={mode === "approve" ? "Spender" : "To"} error={to && !validAddr(to) ? "Invalid address" : ""}>
        <input value={to} onChange={(e) => { setTo(e.target.value.trim()); setAllow(null); }} placeholder="0x…" spellCheck={false} />
      </Field>
      <div className="chips tight">{quick.map(([k, a]) => <button key={k} type="button" className="chip-f" onClick={() => setTo(a)}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
      <Field label={`Amount (${sym})`} error={amt && !amount ? "Enter a positive number" : tooMuch ? `You only have ${fmtFct(bal)} ${sym}${c.snap.devAdmin ? " - use \"Get test funds\" below" : ""}` : noGas ? "This account has 0 ETH for gas - use the Fix my account card on Overview" : ""}>
        <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="5" />
      </Field>
      <div className="row">
        <Btn tx busy={c.busy} disabled={!ok} icon="arrow" onClick={submit}>{mode === "transfer" ? "Send FCT" : mode === "approve" ? "Approve" : "Move FCT"}</Btn>
        {mode !== "transfer" && <Btn tone="ghost" disabled={!c.address || !validAddr(to)} onClick={checkAllow}>Check my allowance for this address</Btn>}
      </div>
      {allow && <p className="note">Allowance you granted to {demoLabel(to) || short(to)}: <b>{fmtFct(allow, 4)} FCT</b></p>}
      {c.snap.me && <p className="note">Gas is paid in ETH (balance {Number(ethers.utils.formatEther(c.snap.me.eth)).toFixed(3)} ETH).</p>}
    </Card>
  );
}

function Admin() {
  const c = useChain();
  const { snap } = c;
  const t = snap.token;
  const isTokenOwner = same(c.address, t.owner) || !!snap.devAdmin;
  const sendA = (cfg) => sendA({ ...cfg, asAdmin: !same(c.address, t.owner) });
  const [top, setTop] = useState("");
  const [edit, setEdit] = useState({});

  return (
    <Card title="Admin controls" sub={isTokenOwner ? "You own the FoodChainToken contract" : `Only the token owner (${short(t.owner)}) can use these`}>
      <div className="grid two">
        <div className="stack tight">
          <Field label="Top up the reward pool (FCT)"><input inputMode="decimal" value={top} onChange={(e) => setTop(e.target.value)} placeholder="1000" /></Field>
          <Btn tx busy={c.busy} disabled={!parseAmt(top) || !isTokenOwner} onClick={() => sendA({ title: "Topping up pool", on: "fct", method: "mint", args: [parseAmt(top)], success: "Reward pool topped up" }).then((r) => r && setTop(""))}>Mint to pool</Btn>
          <div className="row">
            <Btn tone="soft" tx disabled={!isTokenOwner} onClick={() => sendA({ title: t.paused ? "Resuming rewards" : "Pausing rewards", on: "fct", method: t.paused ? "unpause" : "pause" })}>{t.paused ? "Resume rewards" : "Pause rewards"}</Btn>
            <Btn tone="soft" tx disabled={!isTokenOwner} onClick={() => sendA({ title: "Updating authorisation", on: "fct", method: "setAuthorizedCaller", args: [D.addresses.FoodBatchNFT, !snap.nftAuthorized] })}>{snap.nftAuthorized ? "Revoke NFT contract" : "Authorise NFT contract"}</Btn>
          </div>
        </div>
        <div className="stack tight">
          <small className="muted">Reward amounts (FCT)</small>
          {snap.schedule.map((s) => {
            const a = REWARD_ACTIONS[s.type];
            const v = edit[s.type] ?? ethers.utils.formatUnits(s.amount, 18);
            return (
              <div key={s.type} className="row edit">
                <span>{a.label}</span>
                <input inputMode="decimal" value={v} onChange={(e) => setEdit((x) => ({ ...x, [s.type]: e.target.value }))} aria-label={a.label} />
                <Btn tone="ghost" tx disabled={!isTokenOwner || edit[s.type] === undefined || !parseAmt(v)} onClick={() => sendA({ title: "Updating reward", on: "fct", method: "setRewardAmount", args: [s.type, parseAmt(v)], success: "Reward amount updated" }).then((r) => r && setEdit((x) => { const n = { ...x }; delete n[s.type]; return n; }))}>Save</Btn>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

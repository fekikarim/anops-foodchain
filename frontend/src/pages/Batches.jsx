import { useEffect, useMemo, useState } from "react";
import { useChain } from "../state/ChainContext";
import { go, useRoute } from "../state/route";
import {
  D, FLAG_REASONS, PRODUCTS, RECIPIENT_ROLES, ROLES, STATUS, STEPPER, UNITS,
  ago, bytes32, demoLabel, fmtDate, fmtDateTime, same, short, toBatch,
} from "../blockchain/config";
import QuickSetup from "../components/QuickSetup";
import { Addr, Badge, Btn, Card, Drawer, Empty, Field, Icon, RoleBadge, StatusBadge } from "../components/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "mine", label: "Mine" },
  { id: "incoming", label: "Incoming" },
  ...STATUS.map((s, i) => ({ id: String(i), label: s.name })),
];

export default function Batches() {
  const c = useChain();
  const { snap } = c;
  const { arg } = useRoute();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const list = useMemo(() => {
    if (!snap) return [];
    const t = q.trim().toLowerCase();
    return [...snap.batches].reverse().filter((b) => {
      if (t && ![b.code, b.productType, b.originRegion, b.producerName, `#${b.tokenId}`, String(b.tokenId)].some((x) => x.toLowerCase().includes(t))) return false;
      if (filter === "all") return true;
      if (filter === "mine") return !!snap.me && snap.me.held.includes(b.tokenId);
      if (filter === "incoming") return !!snap.me && snap.me.incoming.includes(b.tokenId);
      return b.status === Number(filter);
    });
  }, [snap, q, filter]);

  const openId = arg && arg !== "new" ? Number(arg) : null;

  return (
    <div className="stack">
      <div className="page-h">
        <div><h1>Batches</h1><p>Every batch is an NFT passport. Select one to see its journey and act on it.</p></div>
        <Btn icon="plus" onClick={() => go("batches", "new")}>Register batch</Btn>
      </div>

      <div className="toolbar">
        <label className="search"><Icon n="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, product, origin or NFT id…" aria-label="Search batches" />
        </label>
        <div className="chips" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip-f ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.id === "incoming" && snap?.me?.incoming.length > 0 && <i className="count">{snap.me.incoming.length}</i>}
            </button>
          ))}
        </div>
      </div>

      {!snap ? (
        <div className="grid cards">{[0, 1, 2].map((i) => <div key={i} className="skel sk-card" />)}</div>
      ) : list.length === 0 ? (
        <Card>
          <Empty icon="box" title={snap.batches.length ? "No batch matches" : "No batch registered yet"}
            action={!snap.batches.length ? <Btn icon="plus" onClick={() => go("batches", "new")}>Register the first batch</Btn> : <Btn tone="ghost" onClick={() => { setQ(""); setFilter("all"); }}>Clear filters</Btn>}>
            {snap.batches.length ? "Try another search or filter." : "A Farmer account mints the first NFT passport."}
          </Empty>
        </Card>
      ) : (
        <div className="grid cards">
          {list.map((b) => {
            const mine = snap.me?.held.includes(b.tokenId);
            const inc = snap.me?.incoming.includes(b.tokenId);
            return (
              <button key={b.tokenId} className={`batch ${inc ? "incoming" : ""}`} onClick={() => go("batches", b.tokenId)}>
                <div className="batch-h"><span className="nft-id">NFT #{b.tokenId}</span><StatusBadge status={b.status} /></div>
                <h4>{b.productType}</h4>
                <div className="code mono">{b.code}</div>
                <dl>
                  <div><dt>Origin</dt><dd>{b.originRegion}</dd></div>
                  <div><dt>Quantity</dt><dd>{Number(b.quantity).toLocaleString()} {b.unit}</dd></div>
                  <div><dt>Holder</dt><dd>{demoLabel(b.holder) || short(b.holder)}</dd></div>
                </dl>
                <div className="batch-f">
                  <Progress status={b.status} />
                  {inc ? <Badge tone="blue" dot>Waiting for you</Badge> : mine ? <Badge tone="green">You hold it</Badge> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Drawer open={arg === "new"} onClose={() => go("batches")} title="Register a batch"><RegisterForm onDone={(id) => go("batches", id)} /></Drawer>
      <Drawer open={!!openId} onClose={() => go("batches")} title={openId ? `Batch passport #${openId}` : ""}>{openId && <Detail tokenId={openId} />}</Drawer>
    </div>
  );
}

function Progress({ status }) {
  const step = status === 3 ? 3 : status === 2 ? 2 : status === 1 ? 1 : 0;
  const dead = status >= 4;
  return (
    <span className={`prog ${dead ? "dead" : ""}`} aria-hidden="true">
      {STEPPER.map((s) => <i key={s} className={s <= step && !dead ? "on" : ""} />)}
    </span>
  );
}

/* ───────────────────────── Register ───────────────────────── */

const OTHER = "__other";
const todayStr = () => new Date().toISOString().slice(0, 10);

function RegisterForm({ onDone }) {
  const c = useChain();
  const [f, setF] = useState({ code: "", product: "", producer: "", origin: "", date: todayStr(), qty: "", unit: "kg", uri: "" });
  const [availRes, setAvailRes] = useState({ code: "", ok: null });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [otherMode, setOtherMode] = useState(false);
  const pickProduct = (e) => {
    const v = e.target.value;
    if (v === OTHER) { setOtherMode(true); setF((x) => ({ ...x, product: PRODUCTS.includes(x.product) ? "" : x.product })); }
    else { setOtherMode(false); setF((x) => ({ ...x, product: v })); }
  };

  const canRegister = c.snap && c.address && (c.role === 1 || same(c.address, c.snap.nftOwner));
  const codeLen = new TextEncoder().encode(f.code).length;
  const errs = {
    code: !f.code ? "" : codeLen > 31 ? "Max 31 characters" : /\s/.test(f.code) ? "No spaces - use dashes" : "",
    date: f.date > todayStr() ? "Harvest date cannot be in the future" : "",
    qty: f.qty && !/^[1-9]\d*$/.test(f.qty) ? "Whole number above 0" : "",
  };

  useEffect(() => {
    if (!f.code || errs.code) return;
    const code = f.code;
    const t = setTimeout(async () => {
      try { setAvailRes({ code, ok: await c.reader.nft.isBatchCodeAvailable(bytes32(code)) }); } catch { setAvailRes({ code, ok: null }); }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.code, c.snap?.block]);
  const avail = !f.code || errs.code ? null : availRes.code === f.code ? availRes.ok : undefined;

  const valid = f.code && f.product && f.producer && f.origin && f.date && f.qty && !errs.code && !errs.date && !errs.qty && avail !== false;

  const fill = () => { setOtherMode(false); setF({
    code: `TOM-TN-${String((c.snap?.stats.total || 0) + 1).padStart(3, "0")}`, product: "Tomatoes", producer: "Ferme Nabeul",
    origin: "Nabeul, Tunisia", date: todayStr(), qty: "500", unit: "kg", uri: "",
  }); };

  const submit = async (e) => {
    e.preventDefault();
    const harvest = Math.floor(new Date(`${f.date}T00:00:00`).getTime() / 1000);
    const before = c.snap.stats.total;
    const rc = await c.send({
      title: "Registering batch", on: "nft", method: "registerBatch",
      args: [bytes32(f.code), f.product.trim(), f.producer.trim(), f.origin.trim(), harvest, f.qty, f.unit, f.uri.trim()],
      success: `Batch ${f.code} registered - NFT minted`,
    });
    if (rc) onDone(before + 1);
  };

  return (
    <form className="form" onSubmit={submit} noValidate data-tour="reg-form">
      {c.snap && !canRegister && (
        <div className="callout warn"><Icon n="alert" /><div>
          <b>{c.address ? "This account can't register batches." : "Connect a Farmer account first."}</b>
          <p>{c.address ? <>It has the role <RoleBadge role={c.role} />. The contract only accepts a Farmer. Switch to <span className="mono">{short(D.demoAccounts.farmer)}</span> (Farmer demo account) - the transaction would be refused.</> : "Only an account with the Farmer role can mint a batch passport."}</p>
          {c.address ? (
            <div className="row">
              <Btn tone="soft" type="button" onClick={c.switchAccount}>Switch account</Btn>
              <Btn tone="ghost" type="button" onClick={() => { navigator.clipboard?.writeText(c.address); go("actors"); }}>Copy my address &amp; ask the Admin</Btn>
            </div>
          ) : <Btn tone="soft" type="button" onClick={c.connect}>Connect wallet</Btn>}
        </div></div>
      )}
      {c.snap?.devAdmin && c.address && !canRegister && <QuickSetup />}
      <div className="form-top"><p className="muted">Reward: <b>10 FCT</b> are paid to you automatically once the NFT is minted.</p><Btn tone="ghost" type="button" onClick={fill}>Fill demo data</Btn></div>

      <Field label="Batch code" error={errs.code} ok={avail === true ? "Available" : ""} hint={avail === false ? undefined : "Unique business id, e.g. TOM-TN-001"}>
        <input value={f.code} onChange={set("code")} placeholder="TOM-TN-001" maxLength={40} autoComplete="off" className={avail === false ? "bad" : ""} />
        {avail === false && <span className="field-e">This code is already used</span>}
      </Field>
      <div className="row2">
        <Field label="Product">
          <select value={otherMode || (f.product && !PRODUCTS.includes(f.product)) ? OTHER : f.product} onChange={pickProduct} aria-label="Product">
            <option value="" disabled>Choose a product…</option>
            {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={OTHER}>Other (type your own)…</option>
          </select>
          {(otherMode || (f.product && !PRODUCTS.includes(f.product))) && <input autoFocus value={f.product} onChange={set("product")} placeholder="Type the product name" maxLength={64} />}
        </Field>
        <Field label="Producer / farm"><input value={f.producer} onChange={set("producer")} placeholder="Ferme Nabeul" maxLength={64} /></Field>
      </div>
      <Field label="Origin"><input value={f.origin} onChange={set("origin")} placeholder="Nabeul, Tunisia" maxLength={64} /></Field>
      <div className="row3">
        <Field label="Harvest date" error={errs.date}><input type="date" value={f.date} max={todayStr()} onChange={set("date")} /></Field>
        <Field label="Quantity" error={errs.qty}><input inputMode="numeric" value={f.qty} onChange={set("qty")} placeholder="500" /></Field>
        <Field label="Unit"><select value={f.unit} onChange={set("unit")}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
      </div>
      <Field label="Metadata URI (optional)" hint="Photos / certificates stay off-chain - paste an IPFS or https link."><input value={f.uri} onChange={set("uri")} placeholder="ipfs://…" /></Field>

      {valid && (
        <div className="passport mini">
          <small>Passport preview</small><b>{f.product}</b><span className="mono">{f.code}</span>
          <span>{f.qty} {f.unit} · {f.origin}</span>
        </div>
      )}
      <Btn type="submit" tx busy={c.busy} disabled={!valid || (c.snap && !canRegister)} icon="plus">Mint batch passport</Btn>
      <p className="note">Stored on-chain: code, product, producer, origin, dates, quantity, status, holder. Documents are not stored on-chain.</p>
    </form>
  );
}

/* ───────────────────────── Detail ───────────────────────── */

const LIFE = new Set(["BatchRegistered", "BatchShipped", "BatchReceived", "BatchDelivered", "BatchFlagged", "BatchFlagCleared", "BatchRecalled", "BatchCancelled"]);
const ACTION_ICON = { REGISTERED: "plus", SHIPPED: "arrow", RECEIVED: "check", DELIVERED: "check", FLAGGED: "flag", FLAG_CLEARED: "check", RECALLED: "alert", CANCELLED: "x" };
const ACTION_TONE = { REGISTERED: "green", SHIPPED: "blue", RECEIVED: "violet", DELIVERED: "teal", FLAGGED: "amber", FLAG_CLEARED: "green", RECALLED: "rose", CANCELLED: "muted" };

function Detail({ tokenId }) {
  const c = useChain();
  const { snap } = c;
  const batch = snap?.batches.find((b) => b.tokenId === tokenId);
  const [history, setHistory] = useState(null);
  const [flags, setFlags] = useState(null);
  const [missing, setMissing] = useState(false);
  const block = snap?.block;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [h, fl] = await Promise.all([
          c.reader.nft.getBatchHistory(tokenId),
          c.address ? c.reader.nft.getAvailableActions(tokenId, c.address) : null,
        ]);
        if (!live) return;
        setHistory(h.map((x) => ({ ts: x.timestamp.toNumber(), actor: x.actor, action: x.actionType, details: x.details, status: Number(x.statusAfter) })));
        setFlags(fl);
      } catch { if (live) setMissing(true); }
    })();
    return () => { live = false; };
  }, [tokenId, block, c.address, c.reader]);

  const txs = useMemo(() => (snap?.events || []).filter((e) => e.kind === "nft" && LIFE.has(e.name) && Number(e.args.tokenId) === tokenId), [snap?.events, tokenId]);
  const rewards = useMemo(() => {
    const set = new Set(txs.map((e) => e.tx));
    return (snap?.events || []).filter((e) => e.name === "RewardIssued" && set.has(e.tx));
  }, [snap?.events, txs]);

  if (missing) return <Empty icon="alert" title="Batch not found">There is no batch with id #{tokenId}.</Empty>;
  if (!batch || !history) return <div className="stack"><div className="skel sk-block" /><div className="skel sk-block" /></div>;

  const s = batch.status;
  return (
    <div className="stack">
      <div className="passport">
        <div className="passport-h"><span className="nft-id">Food Batch Passport · FBP #{batch.tokenId}</span><StatusBadge status={s} /></div>
        <h2>{batch.productType}</h2>
        <div className="mono code">{batch.code}</div>
        <p className="muted">{STATUS[s].hint}</p>
        <Journey status={s} />
        <dl className="facts">
          <div><dt>Origin</dt><dd>{batch.originRegion}</dd></div>
          <div><dt>Producer</dt><dd>{batch.producerName}</dd></div>
          <div><dt>Harvested</dt><dd>{fmtDate(batch.harvestDate)}</dd></div>
          <div><dt>Quantity</dt><dd>{Number(batch.quantity).toLocaleString()} {batch.unit}</dd></div>
          <div><dt>Registered</dt><dd>{fmtDateTime(batch.registrationDate)}</dd></div>
          <div><dt>Current holder</dt><dd><Addr a={batch.holder} me={same(batch.holder, c.address)} /></dd></div>
          {batch.recipient && <div><dt>Waiting for</dt><dd><Addr a={batch.recipient} me={same(batch.recipient, c.address)} /></dd></div>}
          {batch.uri && <div><dt>Metadata</dt><dd className="mono wrap">{batch.uri}</dd></div>}
        </dl>
        <p className="note">On-chain data is declared by the actors - the blockchain proves who recorded what and when, not that the goods are fresh.</p>
      </div>

      <div data-tour="actions"><Actions batch={batch} flags={flags} /></div>

      <div data-tour="timeline"><Card title="Journey" sub={`${history.length} recorded step${history.length > 1 ? "s" : ""}`}>
        <ol className="timeline">
          {history.map((h, i) => {
            const ev = txs[i];
            const tone = ACTION_TONE[h.action] || "muted";
            return (
              <li key={i}>
                <span className={`tl-dot tone-${tone}`}><Icon n={ACTION_ICON[h.action] || "check"} size={14} /></span>
                <div className="tl-b">
                  <div className="tl-h"><b>{h.action.replace("_", " ")}</b><Badge tone={STATUS[h.status].tone}>{STATUS[h.status].name}</Badge></div>
                  <small>{fmtDateTime(h.ts)} · {ago(h.ts)} · by <Addr a={h.actor} me={same(h.actor, c.address)} /></small>
                  {h.details && <p>{h.details}</p>}
                  {ev && <small className="mono tx">block #{ev.block} · tx {short(ev.tx, 10, 8)}</small>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card></div>

      {rewards.length > 0 && (
        <Card title="FCT rewards for this batch">
          <ul className="plain">
            {rewards.map((r) => <li key={`${r.tx}${r.idx}`}><Addr a={r.args.actor} me={same(r.args.actor, c.address)} /> <b>+{Number(r.args.amount) / 1e18} FCT</b></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Journey({ status }) {
  const names = ["Created", "In transit", "Received", "Delivered"];
  const cur = status === 3 ? 3 : status === 2 ? 2 : status === 1 ? 1 : 0;
  const dead = status >= 4;
  return (
    <ol className={`journey-bar ${dead ? "dead" : ""}`} aria-label="Progress">
      {names.map((n, i) => <li key={n} className={i < cur ? "past" : i === cur ? "cur" : ""}><i />{n}</li>)}
    </ol>
  );
}

function Actions({ batch, flags }) {
  const c = useChain();
  const { snap } = c;
  const id = batch.tokenId;
  const [details, setDetails] = useState("");
  const [recipient, setRecipient] = useState("");
  const [reason, setReason] = useState(FLAG_REASONS[0]);

  const candidates = (snap?.actors || []).filter((a) => RECIPIENT_ROLES.includes(a.role) && !same(a.address, c.address));
  const rcpt = recipient || candidates[0]?.address || "";

  const run = async (method, args, title, success) => {
    const ok = await c.send({ title, on: "nft", method, args, success });
    if (ok) setDetails("");
  };

  const none = !flags || !(flags.canShip || flags.canConfirmReceipt || flags.canFlag || flags.canClearFlag || flags.canRecall || flags.canCancel);
  const why = () => {
    if (!c.address) return "Connect your wallet to act on this batch.";
    if (c.wrongNetwork) return "Switch MetaMask to the Ganache network.";
    if (batch.status === 1 && batch.recipient) return `Waiting for ${demoLabel(batch.recipient) || short(batch.recipient)} to confirm receipt. Only that account can.`;
    if (batch.status >= 5) return `This batch is ${STATUS[batch.status].name.toLowerCase()} - the journey is closed.`;
    if (batch.status === 3) return "Delivered. Nothing more to do - admins can still flag or recall it.";
    return `Only the current holder (${demoLabel(batch.holder) || short(batch.holder)}) can ship it. Your role: ${ROLES[c.role].name}.`;
  };

  return (
    <Card title="What you can do" sub={c.address ? `As ${demoLabel(c.address) || short(c.address)} · ${ROLES[c.role].name}` : "Not connected"}>
      {none && <div className="callout info"><Icon n="help" /><div><p>{why()}</p>{!c.address && <Btn tone="soft" onClick={c.connect}>Connect wallet</Btn>}</div></div>}

      {flags && (flags.canShip || flags.canConfirmReceipt || flags.canFlag || flags.canClearFlag || flags.canRecall || flags.canCancel) && (
        <Field label="Note for the history (optional)"><input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Truck TN-123, 4°C, 12 crates" maxLength={140} /></Field>
      )}

      {flags?.canShip && (
        <div className="act">
          <Field label="Ship to" hint={candidates.length ? undefined : "No Transporter / Wholesaler / Retailer exists yet - assign roles on the Actors page."}>
            <select value={rcpt} onChange={(e) => setRecipient(e.target.value)}>
              {candidates.map((a) => <option key={a.address} value={a.address}>{ROLES[a.role].name} · {demoLabel(a.address) || short(a.address)} · {short(a.address)}</option>)}
            </select>
          </Field>
          <Btn tx busy={c.busy} icon="arrow" disabled={!rcpt} onClick={() => run("shipBatch", [id, rcpt, details || "Shipped"], "Shipping batch", "Batch shipped - waiting for the recipient")}>Ship batch</Btn>
        </div>
      )}
      {flags?.canConfirmReceipt && (
        <div className="act">
          <p className="muted">You are the expected recipient. Confirming moves the NFT to your account and pays rewards{c.role === 4 ? " (final delivery)" : ""}.</p>
          <Btn tx busy={c.busy} icon="check" onClick={() => run("confirmReceipt", [id, details || "Received"], "Confirming receipt", "Receipt confirmed - NFT transferred to you")}>Confirm receipt</Btn>
        </div>
      )}
      {flags?.canFlag && (
        <div className="act row">
          <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Flag reason">{FLAG_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          <Btn tone="warn" tx busy={c.busy} icon="flag" onClick={() => run("flagBatch", [id, bytes32(reason), details], "Flagging batch", "Batch flagged")}>Flag as suspicious</Btn>
        </div>
      )}
      {flags?.canClearFlag && <Btn tone="soft" tx busy={c.busy} icon="check" onClick={() => run("clearFlag", [id, details || "Flag dismissed"], "Clearing flag", "Flag cleared - batch restored")}>Clear flag</Btn>}
      <div className="act row">
        {flags?.canRecall && <Btn tone="danger" tx busy={c.busy} icon="alert" onClick={() => run("recallBatch", [id, details || "Recalled"], "Recalling batch", "Batch recalled")}>Recall batch</Btn>}
        {flags?.canCancel && <Btn tone="ghost" tx busy={c.busy} icon="x" onClick={() => run("cancelBatch", [id, details || "Cancelled"], "Cancelling batch", "Batch cancelled")}>Cancel batch</Btn>}
      </div>
    </Card>
  );
}

export { toBatch };

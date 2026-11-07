import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChain } from "../state/ChainContext";
import { go } from "../state/route";
import { demoProgress, stepRoute } from "../state/guidance";
import { ROLES, same, short } from "../blockchain/config";
import { Btn, Icon } from "./ui";

const LS = "foodchain.tour";
const read = () => { try { return localStorage.getItem(LS); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(LS, v); } catch { /* ignore */ } };

/** Live tour: every step's "done" is read from the chain, so it follows the user until everything is finished. */
function buildSteps(c) {
  const { snap, address, wrongNetwork, role, isAdmin } = c;
  const prog = Object.fromEntries(demoProgress(snap).map((p) => [p.id, p]));
  const copyAddr = { label: "Copy my address", run: () => navigator.clipboard?.writeText(address) };

  const steps = [
    { id: "welcome", done: null, modal: true, title: "Welcome to AnOps FoodChain", text: "In a few minutes you will trace a batch of tomatoes from the farm to the shelf, and watch every step get recorded on the blockchain and rewarded in FCT. This tour follows what really happens on-chain - it ticks each step off by itself." },
    { id: "connect", done: !!address, route: "overview", target: "wallet", title: "1 · Connect your wallet", text: "Press Connect and approve it in MetaMask. You can browse everything without a wallet, but you need one to sign transactions.", actions: !address ? [{ label: "Connect MetaMask", run: c.connect, primary: true }] : [] },
    { id: "network", done: !!address && !wrongNetwork, target: "wallet", title: "2 · Use the Ganache network", text: "MetaMask must be on your local Ganache network. One click can add or switch it.", actions: [{ label: "Switch to Ganache", run: c.switchNetwork, primary: true }] },
    {
      id: "role", done: role > 0 || isAdmin, route: "actors", target: "wallet", title: "3 · Your role decides what you can do",
      text: !address ? "Connect first." : role > 0 ? `You are a ${ROLES[role].name}.` : `The account ${short(address)} has no role yet. The Admin assigns roles on the Actors page - either switch to the Admin account, or copy this address and send it to them.`,
      actions: address ? [...(snap?.devAdmin && role === 0 ? [{ label: "Fix my account (make me a Farmer)", run: () => c.quickSetup(1), primary: true }] : []), copyAddr, { label: "Switch account", run: c.switchAccount }] : [],
    },
  ];

  const add = (id, extra) => { const p = prog[id]; if (p) steps.push({ id, done: p.done, who: p.who, account: p.account, title: extra.title, text: p.text, ...extra }); };
  if (prog.auth && prog.auth.done === false) add("auth", { route: stepRoute("auth", snap), target: "balance", title: "Authorise the NFT contract" });
  add("roles", { route: stepRoute("roles", snap), target: "assign", title: "4 · Admin: give each actor a role", actionsGo: "actors" });
  add("reg", { route: stepRoute("reg", snap), target: "reg-form", title: "5 · Farmer: register the batch" });
  add("ship", { route: stepRoute("ship", snap), target: "actions", title: "6 · Farmer: ship it" });
  add("recv", { route: stepRoute("recv", snap), target: "actions", title: "7 · Transporter: confirm receipt" });
  add("ship2", { route: stepRoute("ship2", snap), target: "actions", title: "8 · Transporter: ship on" });
  add("recv2", { route: stepRoute("recv2", snap), target: "actions", title: "9 · Wholesaler: confirm, then ship to the retailer" });
  add("deliv", { route: stepRoute("deliv", snap), target: "actions", title: "10 · Retailer: confirm final delivery" });
  add("hist", { route: stepRoute("hist", snap), target: "timeline", title: "11 · Read the full journey" });
  add("rew", { route: stepRoute("rew", snap), target: "balance", title: "12 · Check the FCT rewards" });
  steps.push({ id: "finish", done: null, modal: true, finish: true, title: "You've traced a batch end to end", text: "Both contracts did their job: the NFT recorded every hand-over and the FCT token rewarded each actor exactly once. Try the negative tests from the Guide page (unauthorized account, wrong recipient, direct NFT transfer)." });
  return steps;
}

function useTargetRect(sel, key) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!sel) return;
    let raf; let last = ""; let scrolled = false;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${sel}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (!scrolled && r.width > 0) {
          scrolled = true;
          const off = r.top < 70 || r.bottom > window.innerHeight - 160;
          if (off) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const k = `${r.x}|${r.y}|${r.width}|${r.height}`;
        if (k !== last) { last = k; setRect({ x: r.x, y: r.y, w: r.width, h: r.height }); }
      } else if (last) { last = ""; setRect(null); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sel, key]);
  return sel ? rect : null;
}

const Confetti = () => (
  <div className="confetti" aria-hidden="true">
    {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i % 7) * 0.12}s`, "--h": `${(i * 47) % 360}`, "--r": `${(i * 53) % 360}deg` }} />)}
  </div>
);

export default function Tour() {
  const c = useChain();
  const [open, setOpen] = useState(() => read() === null);
  const [cur, setCur] = useState(0);
  const [flash, setFlash] = useState(false);
  const prev = useRef(new Map());
  const started = useRef(false);
  const timer = useRef(false);
  const stepsRef = useRef([]);
  const toStepRef = useRef(() => {});
  const [nudge, setNudge] = useState(0);

  const steps = useMemo(() => buildSteps(c), [c]);
  const step = steps[Math.min(cur, steps.length - 1)];
  const total = steps.filter((s) => s.done !== null).length;
  const doneN = steps.filter((s) => s.done === true).length;
  const rect = useTargetRect(open && !step.modal ? step.target : null, `${step.id}-${nudge}`);

  const close = useCallback((finished) => { setOpen(false); write(finished ? "done" : "seen"); }, []);
  const toStep = useCallback((i) => {
    const n = Math.max(0, Math.min(i, steps.length - 1));
    setCur(n);
    const r = steps[n].route;
    if (r && window.location.hash.replace(/^#\/?/, "") !== r) { const [pg, arg] = r.split("/"); go(pg, arg); }
  }, [steps]);

  useEffect(() => { stepsRef.current = steps; toStepRef.current = toStep; });

  // "Show me": always navigates to the right page (re-opening the drawer if needed) and re-highlights the target
  const showMe = useCallback(() => {
    const r = step.route;
    const here = window.location.hash.replace(/^#\/?/, "");
    const [pg, arg] = (r || "").split("/");
    if (r && here === r) { go(pg); setTimeout(() => { go(pg, arg); setNudge((n) => n + 1); }, 60); }
    else { if (r) go(pg, arg); setTimeout(() => setNudge((n) => n + 1), 80); }
  }, [step]);

  // external "start tour" trigger
  useEffect(() => {
    const f = () => { prev.current = new Map(); setOpen(true); setCur(Math.max(0, steps.findIndex((s) => s.done === false))); started.current = true; };
    window.addEventListener("foodchain:tour", f);
    return () => window.removeEventListener("foodchain:tour", f);
  }, [steps]);

  // follow the chain: when the current step flips to done, celebrate and move on
  useEffect(() => {
    if (!c.snap) return;
    const s = steps[Math.min(cur, steps.length - 1)];
    const was = prev.current.get(s.id);
    steps.forEach((x) => prev.current.set(x.id, x.done));
    if (!open || !started.current) { started.current = true; return; }
    if (was === false && s.done === true && !timer.current) {
      const from = cur;
      timer.current = true;
      setTimeout(() => setFlash(true), 0);
      setTimeout(() => {
        setFlash(false);
        timer.current = false;
        const st = stepsRef.current;
        const n = st.findIndex((x, i) => i > from && x.done !== true);
        toStepRef.current(n === -1 ? st.length - 1 : n);
      }, 1300);
    }
  }, [steps, cur, open, c.snap, toStep]);

  // the first time the chain loads, jump to the first unfinished step
  const init = useRef(false);
  useEffect(() => {
    if (init.current || !c.snap) return;
    init.current = true;
    if (read() === null) return; // first visit: begin with the welcome card
    const t = setTimeout(() => setCur(Math.max(0, steps.findIndex((s) => s.done === false))), 0);
    return () => clearTimeout(t);
  }, [c.snap, steps]);

  if (!c.snap) return null;

  if (!open) {
    const pct = total ? Math.round((doneN / total) * 100) : 0;
    return (
      <button className="coach" onClick={() => { setOpen(true); setCur(Math.max(0, steps.findIndex((s) => s.done === false))); }} aria-label="Open guided tour">
        <span className="ring sm" style={{ "--p": pct }}><b>{pct}%</b></span>
        <span className="coach-t"><b>Guided tour</b><small>{doneN}/{total} steps done</small></span>
      </button>
    );
  }

  const onAcct = step.account && same(step.account, c.address);
  const last = cur >= steps.length - 1;
  const W = typeof window !== "undefined" ? window.innerWidth : 1024;
  const H = typeof window !== "undefined" ? window.innerHeight : 768;
  const mobile = W < 640;
  const tall = !!rect && rect.h > H * 0.55; // big forms: don't dim them, just dock the card
  let style;
  if (rect && !mobile && !tall) {
    const cw = 360; const pad = 14;
    const below = rect.y + rect.h + 260 < H;
    const left = Math.max(12, Math.min(rect.x, W - cw - 12));
    style = below ? { left, top: rect.y + rect.h + pad, width: cw } : rect.y > 300 ? { left, bottom: H - rect.y + pad, width: cw } : { right: 20, bottom: 20, width: cw };
  }
  const cls = `tour-card ${step.modal ? "modal" : rect && !tall ? "anch" : "dock"} ${flash ? "ok" : ""}`;

  return (
    <div className="tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      {step.modal && <div className="tour-back" onClick={() => !step.finish || close(true)} />}
      {rect && !step.modal && !tall && (
        <div className="spot" style={{ transform: `translate(${rect.x - 8}px, ${rect.y - 8}px)`, width: rect.w + 16, height: rect.h + 16 }} />
      )}
      <div key={step.id} className={cls} style={style}>
        {step.finish && <Confetti />}
        <div className="tour-top">
          <span className="tour-prog" aria-label={`${doneN} of ${total} done`}>
            {steps.filter((s) => s.done !== null).map((s) => <i key={s.id} className={s.done ? "on" : s.id === step.id ? "cur" : ""} />)}
          </span>
          <button className="icon-btn sm" onClick={() => close(last)} aria-label="Minimise tour"><Icon n="x" size={14} /></button>
        </div>
        {flash ? (
          <div className="tour-ok"><span><Icon n="check" size={22} /></span><b>Step complete</b><small>Confirmed on-chain</small></div>
        ) : (
          <>
            {step.who && <span className="tour-who">{step.who}</span>}
            <h4>{step.title}</h4>
            <p>{step.text}</p>
            {step.account && (
              <p className="tour-acct">
                Account <span className="mono">{short(step.account, 8, 6)}</span>{" "}
                {c.address ? (onAcct ? <b className="ok">· you are on it ✓</b> : <b className="warn">· switch to it in MetaMask</b>) : null}
              </p>
            )}
            <div className="tour-act">
              {(step.actions || []).map((a) => <Btn key={a.label} tone={a.primary ? "primary" : "ghost"} onClick={a.run}>{a.label}</Btn>)}
              {step.account && c.address && !onAcct && <Btn tone="soft" onClick={c.switchAccount}>Switch account</Btn>}
              {(step.route || step.target) && !step.modal && <Btn tone="soft" icon="search" onClick={showMe}>Show me</Btn>}
            </div>
            <div className="tour-nav">
              <button className="link" onClick={() => toStep(cur - 1)} disabled={cur === 0}>Back</button>
              <span className="muted">{step.modal ? "" : step.done ? "Done" : "Waiting for you…"}</span>
              {last ? <Btn onClick={() => close(true)}>Finish</Btn> : <Btn tone={step.done === false ? "ghost" : "primary"} onClick={() => toStep(cur + 1)}>{step.done === false ? "Skip" : cur === 0 ? "Let's go" : "Next"}</Btn>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

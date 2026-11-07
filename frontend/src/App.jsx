import { useEffect, useState } from "react";
import { useChain } from "./state/ChainContext";
import { useRoute, go } from "./state/route";
import { D, ROLES, short, demoLabel } from "./blockchain/config";
import { Btn, Icon, Toasts, RoleBadge } from "./components/ui";
import Overview from "./pages/Overview";
import Guide from "./pages/Guide";
import Batches from "./pages/Batches";
import Actors from "./pages/Actors";
import Rewards from "./pages/Rewards";
import Activity from "./pages/Activity";
import Tour from "./components/Tour";

const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "guide", label: "Guide", icon: "book" },
  { id: "batches", label: "Batches", icon: "box" },
  { id: "actors", label: "Actors", icon: "users" },
  { id: "rewards", label: "Rewards", icon: "coin" },
  { id: "activity", label: "Activity", icon: "pulse" },
];
const PAGES = { overview: Overview, guide: Guide, batches: Batches, actors: Actors, rewards: Rewards, activity: Activity };

function useTheme() {
  const [t, setT] = useState(() => { try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; } });
  useEffect(() => {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
  }, [t]);
  const dark = t === "dark" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return [dark, () => setT(dark ? "light" : "dark")];
}

function WalletChip() {
  const c = useChain();
  const [open, setOpen] = useState(false);
  if (!c.address) {
    return <span data-tour="wallet"><Btn icon="wallet" onClick={c.connect}>{c.hasWallet ? "Connect wallet" : "Install MetaMask"}</Btn></span>;
  }
  return (
    <div className="wallet" data-tour="wallet">
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`pulse-dot ${c.wrongNetwork ? "bad" : ""}`} />
        <span className="chip-main">
          <b>{demoLabel(c.address) || short(c.address)}</b>
          <small>{c.wrongNetwork ? "Wrong network" : ROLES[c.role].name}</small>
        </span>
      </button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          <div className="menu-i"><small>Account</small><span className="mono">{c.address}</span></div>
          <div className="menu-i"><small>Role</small><RoleBadge role={c.role} /></div>
          <button onClick={() => { setOpen(false); c.switchAccount(); }}><Icon n="users" size={15} /> Switch account</button>
          <button onClick={() => { setOpen(false); c.disconnect(); }}><Icon n="x" size={15} /> Disconnect from app</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const c = useChain();
  const { page } = useRoute();
  const [dark, toggleTheme] = useTheme();
  const Page = PAGES[page] || Overview;
  const active = PAGES[page] ? page : "overview";
  useEffect(() => { window.scrollTo({ top: 0 }); }, [active]);

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="#/overview">
          <span className="logo"><Icon n="leaf" size={20} /></span>
          <span><b>AnOps FoodChain</b><small>Farm-to-shelf traceability</small></span>
        </a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} className={active === n.id ? "on" : ""} aria-current={active === n.id ? "page" : undefined}>
              <Icon n={n.icon} /> <span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="live">
            <span className={`pulse-dot ${c.offline ? "bad" : ""}`} />
            {c.offline ? "Ganache unreachable" : c.snap ? <>Synced · block <b>#{c.snap.block}</b></> : "Connecting…"}
          </div>
          <small>Chain {D.chainId} · {short(D.addresses.FoodBatchNFT)}</small>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <a className="brand compact" href="#/overview"><span className="logo"><Icon n="leaf" size={18} /></span><b>FoodChain</b></a>
          <div className="top-r">
            <span className={`sync ${c.syncing ? "on" : ""}`} title="Live sync with the blockchain"><i /></span>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme"><Icon n={dark ? "sun" : "moon"} /></button>
            <WalletChip />
          </div>
        </header>

        {c.offline && (
          <div className="banner bad"><Icon n="alert" /> <div><b>Cannot read the blockchain.</b> {c.offline} Start Ganache and run <code>npm run deploy</code>.</div></div>
        )}
        {c.wrongNetwork && (
          <div className="banner warn"><Icon n="alert" /> <div><b>MetaMask is on the wrong network.</b> Switch to Ganache (Chain ID {D.chainId}) to send transactions.</div>
            <Btn tone="ghost" onClick={c.switchNetwork}>Switch network</Btn></div>
        )}

        <main key={active} className="page"><Page /></main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.filter((n) => n.id !== "activity").map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={active === n.id ? "on" : ""}><Icon n={n.icon} size={20} /><span>{n.label}</span></a>
        ))}
        <a href="#/activity" className={active === "activity" ? "on" : ""}><Icon n="pulse" size={20} /><span>Activity</span></a>
      </nav>
      <Tour />
      <Toasts />
    </div>
  );
}

export { go };

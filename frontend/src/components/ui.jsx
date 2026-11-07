import { useEffect, useState } from "react";
import { useChain } from "../state/ChainContext";
import { ROLES, STATUS, short, demoLabel } from "../blockchain/config";

const P = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  book: "M4 5a2 2 0 012-2h13v17H6a2 2 0 00-2 2V5zM4 20h15",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12.5l8.7-5M12 22V12.5",
  users: "M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.9M16 4.2a3.5 3.5 0 010 6.6",
  coin: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v10M9.5 9.5c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.8S9.5 12.4 9.5 13.5s1 1.7 2.5 1.7 2.5-.7 2.5-1.7",
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  alert: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  link: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
  wallet: "M3 7a2 2 0 012-2h13v4M3 7v11a2 2 0 002 2h15a1 1 0 001-1v-9a1 1 0 00-1-1H5a2 2 0 01-2-2zM17 14.5h.01",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  leaf: "M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19c3-5 6-8 10-10",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2M12 17h.01",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

export function Icon({ n, size = 18, className = "" }) {
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  );
}

export const Badge = ({ tone = "muted", children, dot }) => (
  <span className={`badge tone-${tone}`}>{dot && <i className="dot" />}{children}</span>
);
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status].tone} dot>{STATUS[status].name}</Badge>;
export const RoleBadge = ({ role }) => <Badge tone={ROLES[role].tone}>{ROLES[role].name}</Badge>;

export function CopyText({ value, children, className = "" }) {
  const [ok, setOk] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ }
  };
  return (
    <button type="button" className={`copy mono ${className}`} onClick={copy} title="Copy">
      {children ?? short(value)} <Icon n={ok ? "check" : "copy"} size={13} />
    </button>
  );
}

export function Addr({ a, me }) {
  const lbl = demoLabel(a);
  return (
    <span className="addr">
      <CopyText value={a} />
      {lbl && <span className="demo-tag">{lbl}</span>}
      {me && <span className="you">you</span>}
    </span>
  );
}

export function Card({ title, sub, action, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-h">
          <div><h3>{title}</h3>{sub && <p className="sub">{sub}</p>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export const Stat = ({ label, value, tone = "green", note, loading }) => (
  <div className={`stat tone-${tone}`}>
    <span className="stat-l">{label}</span>
    {loading ? <span className="skel sk-lg" /> : <span className="stat-v">{value}</span>}
    {note && <span className="stat-n">{note}</span>}
  </div>
);

export const Empty = ({ icon = "box", title, children, action }) => (
  <div className="empty">
    <span className="empty-i"><Icon n={icon} size={26} /></span>
    <h4>{title}</h4>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export function Field({ label, hint, error, ok, children }) {
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      {children}
      {error ? <span className="field-e">{error}</span> : ok ? <span className="field-ok">{ok}</span> : hint ? <span className="field-h">{hint}</span> : null}
    </label>
  );
}

export function Drawer({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.classList.add("lock");
    return () => { window.removeEventListener("keydown", k); document.body.classList.remove("lock"); };
  }, [open, onClose]);
  return (
    <div className={`drawer-wrap ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-h">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" /></button>
        </header>
        <div className="drawer-b">{open && children}</div>
      </aside>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useChain();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast t-${t.tone}`}>
          <span className="t-ico">{t.tone === "loading" ? <i className="spin" /> : <Icon n={t.tone === "success" ? "check" : t.tone === "error" ? "alert" : "help"} size={16} />}</span>
          <div className="t-body">
            <strong>{t.title}</strong>
            {t.text && <p>{t.text}</p>}
            {t.hash && <code className="mono">{short(t.hash, 10, 8)}</code>}
          </div>
          {t.tone !== "loading" && <button className="icon-btn sm" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><Icon n="x" size={14} /></button>}
        </div>
      ))}
    </div>
  );
}

export function Btn({ children, tone = "primary", busy, icon, tx, ...p }) {
  const { busy: g } = useChain();
  return (
    <button {...p} className={`btn btn-${tone} ${p.className || ""}`} disabled={p.disabled || busy || (tx && g)}>
      {busy ? <i className="spin" /> : icon ? <Icon n={icon} size={16} /> : null}{children}
    </button>
  );
}

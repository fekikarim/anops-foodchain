// frontend/src/App.jsx
import { useState } from "react";
import { useContracts } from "./hooks/useContracts";
import Dashboard from "./pages/Dashboard";
import Batches   from "./pages/Batches";
import Actors    from "./pages/Actors";
import Rewards   from "./pages/Rewards";

const NAV = [
  { id:"dashboard", label:"🏠 Dashboard" },
  { id:"batches",   label:"📦 Batches" },
  { id:"actors",    label:"👤 Actors" },
  { id:"rewards",   label:"🪙 Rewards" }
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const { signer, address, contracts, role, isAdmin, error, loading, connect } = useContracts();

  const styles = {
    app:  { minHeight:"100vh", background:"#0d1117", color:"#e2e8f0", fontFamily:"system-ui,sans-serif", display:"flex" },
    side: { width:220, background:"#161b22", borderRight:"1px solid #30363d", padding:"24px 0", display:"flex", flexDirection:"column" },
    logo: { padding:"0 20px 20px", borderBottom:"1px solid #30363d", marginBottom:12 },
    main: { flex:1, padding:"40px 48px" },
    nav:  { display:"block", padding:"8px 20px", textDecoration:"none", color:"#8b949e", fontSize:14, borderLeft:"2px solid transparent", cursor:"pointer", background:"none", border:"none", width:"100%", textAlign:"left" },
    act:  { borderLeft:"2px solid #22c55e", background:"rgba(34,197,94,.07)", color:"#e2e8f0" },
    wallet: { margin:"auto 20px 0", padding:"16px 0 0", borderTop:"1px solid #30363d" }
  };

  return (
    <div style={styles.app}>
      <nav style={styles.side}>
        <div style={styles.logo}>
          <div style={{ color:"#22c55e", fontWeight:700, fontSize:14 }}>🌿 AnOps FoodChain</div>
          <div style={{ color:"#8b949e", fontSize:11, marginTop:4 }}>Supply Chain DApp</div>
        </div>
        {NAV.map(n => (
          <button key={n.id} style={{ ...styles.nav, ...(page === n.id ? styles.act : {}) }}
            onClick={() => setPage(n.id)}>{n.label}</button>
        ))}
        <div style={styles.wallet}>
          {address ? (
            <>
              <div style={{ fontSize:11, color:"#8b949e", marginBottom:4 }}>Connected</div>
              <div style={{ fontSize:12, color:"#22c55e", wordBreak:"break-all" }}>{address.slice(0,10)}…</div>
              <div style={{ fontSize:11, color:"#8b949e", marginTop:4 }}>Role: <strong style={{ color:"#c9d1d9" }}>{role}</strong></div>
            </>
          ) : (
            <button onClick={connect} disabled={loading}
              style={{ background:"#22c55e", color:"#000", border:"none", borderRadius:6, padding:"8px 14px", cursor:"pointer", fontWeight:700, fontSize:13, width:"100%" }}>
              {loading ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
          {error && <div style={{ marginTop:8, fontSize:11, color:"#fca5a5" }}>{error}</div>}
        </div>
      </nav>

      <main style={styles.main}>
        {!contracts
          ? <div style={{ color:"#8b949e", paddingTop:40 }}>
              <h2 style={{ color:"#e2e8f0", marginBottom:12 }}>Welcome to AnOps FoodChain</h2>
              <p>Connect your MetaMask wallet to interact with the supply chain contracts.</p>
              <p style={{ fontSize:13, marginTop:8 }}>Make sure MetaMask is on <strong style={{ color:"#22c55e" }}>Ganache Local (Chain ID 1337)</strong>.</p>
              <button onClick={connect} style={{ marginTop:16, background:"#22c55e", color:"#000", border:"none", borderRadius:6, padding:"10px 24px", cursor:"pointer", fontWeight:700, fontSize:14 }}>
                Connect Wallet
              </button>
            </div>
          : <>
              {page === "dashboard" && <Dashboard contracts={contracts} address={address} />}
              {page === "batches"   && <Batches   contracts={contracts} address={address} role={role} />}
              {page === "actors"    && <Actors    contracts={contracts} address={address} isAdmin={isAdmin} />}
              {page === "rewards"   && <Rewards   contracts={contracts} address={address} />}
            </>
        }
      </main>
    </div>
  );
}
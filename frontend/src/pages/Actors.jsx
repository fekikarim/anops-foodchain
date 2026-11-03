// frontend/src/pages/Actors.jsx
import { useState } from "react";
import { ROLE_NAMES } from "../blockchain/contracts";

export default function Actors({ contracts, address, isAdmin }) {
  const [query,  setQuery]  = useState("");
  const [result, setResult] = useState(null);
  const [setAddr, setSetAddr] = useState("");
  const [setRole, setSetRole] = useState("1");
  const [msg, setMsg] = useState("");

  async function lookupRole() {
    if (!ethers || !query) return;
    try {
      const role = await contracts.nft.actorRoles(query);
      setResult({ address: query, role: ROLE_NAMES[role] || "None" });
    } catch (e) { setResult({ error: e.message }); }
  }

  async function assignRole() {
    setMsg("⏳ Sending...");
    try {
      const tx = await contracts.nft.setActorRole(setAddr, parseInt(setRole));
      await tx.wait();
      setMsg("✅ Role assigned!");
    } catch (e) { setMsg("❌ " + (e.reason || e.message)); }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:"#e2e8f0", marginBottom:24 }}>Actors & Roles</h2>

      <div style={card}>
        <h3 style={{ color:"#3b82f6", marginBottom:12 }}>Look up Actor Role</h3>
        <input style={inp} placeholder="Ethereum address (0x...)" value={query} onChange={e => setQuery(e.target.value)} />
        <button style={btn("#3b82f6")} onClick={lookupRole}>Look up</button>
        {result && !result.error && (
          <div style={{ marginTop:12, color:"#c9d1d9", fontSize:13 }}>
            Role of <code>{result.address.slice(0,10)}…</code>: <strong style={{ color:"#22c55e" }}>{result.role}</strong>
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ ...card, marginTop:16 }}>
          <h3 style={{ color:"#22c55e", marginBottom:12 }}>Assign Role (Admin)</h3>
          <input style={{ ...inp, marginBottom:8 }} placeholder="Actor address (0x...)" value={setAddr} onChange={e => setSetAddr(e.target.value)} />
          <select style={{ ...inp, marginBottom:8 }} value={setRole} onChange={e => setSetRole(e.target.value)}>
            <option value="0">0 — None</option>
            <option value="1">1 — Farmer</option>
            <option value="2">2 — Transporter</option>
            <option value="3">3 — Wholesaler</option>
            <option value="4">4 — Retailer</option>
            <option value="5">5 — Admin</option>
          </select>
          <button style={btn("#22c55e")} onClick={assignRole}>Assign Role</button>
          {msg && <div style={{ marginTop:10, fontSize:13, color: msg.startsWith("✅") ? "#86efac" : "#fca5a5" }}>{msg}</div>}
        </div>
      )}

      <div style={{ ...card, marginTop:16 }}>
        <h3 style={{ color:"#8b949e", marginBottom:12 }}>Role Reference</h3>
        <table style={{ width:"100%", fontSize:13, borderCollapse:"collapse" }}>
          {[["0","None","Can only view public data"],
            ["1","Farmer","Register batches, ship lots"],
            ["2","Transporter","Ship lots"],
            ["3","Wholesaler","Receive and re-ship lots"],
            ["4","Retailer","Confirm final delivery"],
            ["5","Admin","Full access + manage roles"]
          ].map(([id, name, desc]) => (
            <tr key={id} style={{ borderBottom:"1px solid #30363d" }}>
              <td style={{ padding:"6px 12px", color:"#8b949e" }}>{id}</td>
              <td style={{ padding:"6px 12px", color:"#22c55e" }}>{name}</td>
              <td style={{ padding:"6px 12px", color:"#c9d1d9" }}>{desc}</td>
            </tr>
          ))}
        </table>
      </div>
    </div>
  );
}

const card = { background:"#1c2230", border:"1px solid #30363d", borderRadius:8, padding:20 };
const inp  = { width:"100%", background:"#0d1117", border:"1px solid #30363d", borderRadius:6, padding:"8px 12px", color:"#e2e8f0", fontSize:13, outline:"none", display:"block" };
const btn  = (c) => ({ background: c + "22", border:"1px solid " + c, color: c, padding:"8px 18px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:600, marginTop:8 });
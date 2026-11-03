// frontend/src/pages/Batches.jsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { STATUS_NAMES, STATUS_COLORS } from "../blockchain/contracts";

const toBytes32 = (s) => ethers.utils.formatBytes32String(s);
const fromBytes32 = (b) => ethers.utils.parseBytes32String(b);

export default function Batches({ contracts, address, role }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txMsg,   setTxMsg]   = useState("");
  const [form, setForm] = useState({
    code:"", product:"", producer:"", origin:"", quantity:"", unit:"kg", uri:""
  });
  const [shipForm, setShipForm] = useState({ tokenId:"", recipient:"", details:"" });
  const [receiveForm, setReceiveForm] = useState({ tokenId:"", details:"" });
  const [view, setView] = useState("list"); // "list" | "register" | "ship" | "receive"
  const [detail, setDetail] = useState(null);

  useEffect(() => { if (contracts) loadBatches(); }, [contracts]);

  async function loadBatches() {
    setLoading(true);
    const { nft } = contracts;
    const total = (await nft.totalBatches()).toNumber();
    const list = [];
    for (let i = 1; i <= total; i++) {
      try {
        const b = await nft.getBatch(i);
        list.push({ tokenId: i, ...b });
      } catch {}
    }
    setBatches(list);
    setLoading(false);
  }

  async function registerBatch() {
    if (!form.code || !form.product || !form.producer || !form.origin || !form.quantity) {
      return setTxMsg("❌ All fields required.");
    }
    setTxMsg("⏳ Sending transaction...");
    try {
      const harvestDate = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const tx = await contracts.nft.registerBatch(
        toBytes32(form.code),
        form.product, form.producer, form.origin,
        harvestDate, parseInt(form.quantity), form.unit, form.uri || ""
      );
      setTxMsg("⏳ Waiting for confirmation...");
      await tx.wait();
      setTxMsg("✅ Batch registered! Tx: " + tx.hash.slice(0,20) + "…");
      setForm({ code:"", product:"", producer:"", origin:"", quantity:"", unit:"kg", uri:"" });
      setView("list");
      loadBatches();
    } catch (err) {
      setTxMsg("❌ Error: " + (err.reason || err.message));
    }
  }

  async function shipBatch() {
    setTxMsg("⏳ Sending...");
    try {
      const tx = await contracts.nft.shipBatch(
        parseInt(shipForm.tokenId), shipForm.recipient, shipForm.details || "Shipped"
      );
      await tx.wait();
      setTxMsg("✅ Shipped! Tx: " + tx.hash.slice(0,20) + "…");
      setShipForm({ tokenId:"", recipient:"", details:"" });
      setView("list");
      loadBatches();
    } catch (err) {
      setTxMsg("❌ Error: " + (err.reason || err.message));
    }
  }

  async function confirmReceipt() {
    setTxMsg("⏳ Sending...");
    try {
      const tx = await contracts.nft.confirmReceipt(
        parseInt(receiveForm.tokenId), receiveForm.details || "Received"
      );
      await tx.wait();
      setTxMsg("✅ Receipt confirmed! Tx: " + tx.hash.slice(0,20) + "…");
      setReceiveForm({ tokenId:"", details:"" });
      setView("list");
      loadBatches();
    } catch (err) {
      setTxMsg("❌ Error: " + (err.reason || err.message));
    }
  }

  async function showDetail(tokenId) {
    const b = await contracts.nft.getBatch(tokenId);
    const h = await contracts.nft.getBatchHistory(tokenId);
    setDetail({ tokenId, batch: b, history: h });
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:"#e2e8f0", flex:1 }}>Batches</h2>
        {(role === "Farmer" || role === "Admin") &&
          <button style={btnStyle("#22c55e")} onClick={() => setView("register")}>+ Register Batch</button>}
        <button style={btnStyle("#3b82f6")} onClick={() => setView("ship")}>Ship Batch</button>
        <button style={btnStyle("#a78bfa")} onClick={() => setView("receive")}>Confirm Receipt</button>
        <button style={btnStyle("#30363d")} onClick={() => { setView("list"); setDetail(null); loadBatches(); }}>Refresh</button>
      </div>

      {txMsg && <div style={msgStyle(txMsg)}>{txMsg}</div>}

      {view === "register" && (
        <div style={formCard}>
          <h3 style={{ color:"#22c55e", marginBottom:16 }}>Register New Batch</h3>
          {[
            ["Batch Code (e.g. TOM-TN-001)", "code"],
            ["Product Type (e.g. Tomatoes)", "product"],
            ["Producer Name", "producer"],
            ["Origin Region", "origin"],
            ["Quantity (in grams)", "quantity"],
            ["Unit (kg, g, t)", "unit"],
            ["Metadata URI (optional)", "uri"]
          ].map(([label, key]) => (
            <div key={key} style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, color:"#8b949e", marginBottom:4 }}>{label}</label>
              <input
                style={inputStyle}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={label}
              />
            </div>
          ))}
          <button style={btnStyle("#22c55e")} onClick={registerBatch}>Register</button>
          <button style={{ ...btnStyle("#30363d"), marginLeft:8 }} onClick={() => setView("list")}>Cancel</button>
        </div>
      )}

      {view === "ship" && (
        <div style={formCard}>
          <h3 style={{ color:"#3b82f6", marginBottom:16 }}>Ship Batch</h3>
          {[["Token ID", "tokenId"], ["Recipient Address (0x...)", "recipient"], ["Details", "details"]].map(([l,k]) => (
            <div key={k} style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, color:"#8b949e", marginBottom:4 }}>{l}</label>
              <input style={inputStyle} value={shipForm[k]} onChange={e => setShipForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <button style={btnStyle("#3b82f6")} onClick={shipBatch}>Ship</button>
          <button style={{ ...btnStyle("#30363d"), marginLeft:8 }} onClick={() => setView("list")}>Cancel</button>
        </div>
      )}

      {view === "receive" && (
        <div style={formCard}>
          <h3 style={{ color:"#a78bfa", marginBottom:16 }}>Confirm Receipt</h3>
          {[["Token ID", "tokenId"], ["Details", "details"]].map(([l,k]) => (
            <div key={k} style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:12, color:"#8b949e", marginBottom:4 }}>{l}</label>
              <input style={inputStyle} value={receiveForm[k]} onChange={e => setReceiveForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <button style={btnStyle("#a78bfa")} onClick={confirmReceipt}>Confirm</button>
          <button style={{ ...btnStyle("#30363d"), marginLeft:8 }} onClick={() => setView("list")}>Cancel</button>
        </div>
      )}

      {detail && (
        <div style={{ ...formCard, marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <h3 style={{ color:"#22c55e" }}>Batch #{detail.tokenId} Detail</h3>
            <button style={btnStyle("#30363d")} onClick={() => setDetail(null)}>✕ Close</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, margin:"12px 0", fontSize:13 }}>
            <Field label="Product"   value={detail.batch.productType} />
            <Field label="Producer"  value={detail.batch.producerName} />
            <Field label="Origin"    value={detail.batch.originRegion} />
            <Field label="Quantity"  value={detail.batch.quantity.toString() + " " + detail.batch.quantityUnit} />
            <Field label="Status"    value={STATUS_NAMES[detail.batch.status]} />
            <Field label="Holder"    value={detail.batch.currentHolder.slice(0,10) + "…"} />
          </div>
          <h4 style={{ color:"#8b949e", fontSize:13, marginBottom:8 }}>History</h4>
          {detail.history.map((h, i) => (
            <div key={i} style={{ padding:"8px 12px", background:"#161b22", borderRadius:6, marginBottom:6, fontSize:12 }}>
              <span style={{ color:"#22c55e", marginRight:8 }}>{h.actionType}</span>
              <span style={{ color:"#8b949e" }}>{h.actor.slice(0,8)}… · {new Date(h.timestamp.toNumber() * 1000).toLocaleString()}</span>
              {h.details && <div style={{ color:"#c9d1d9", marginTop:4 }}>{h.details}</div>}
            </div>
          ))}
        </div>
      )}

      {loading ? <p style={{ color:"#8b949e" }}>Loading...</p> : (
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr>{["ID","Code (bytes32)","Product","Status","Holder"].map(h => (
              <th key={h} style={{ padding:"8px 12px", textAlign:"left", background:"#242a38", color:"#8b949e", fontSize:11 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b.tokenId} style={{ borderBottom:"1px solid #30363d", cursor:"pointer" }}
                  onClick={() => showDetail(b.tokenId)}>
                <td style={td}>#{b.tokenId}</td>
                <td style={td}>{truncBytes32(b.batchCode)}</td>
                <td style={td}>{b.productType}</td>
                <td style={td}><span style={{ color: STATUS_COLORS[b.status] }}>{STATUS_NAMES[b.status]}</span></td>
                <td style={td}>{b.currentHolder.slice(0,10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ color:"#8b949e", fontSize:11, marginBottom:2 }}>{label}</div>
      <div style={{ color:"#c9d1d9" }}>{value}</div>
    </div>
  );
}

function truncBytes32(b) {
  try { return ethers.utils.parseBytes32String(b); } catch { return b.slice(0,16) + "…"; }
}

const td = { padding:"8px 12px", color:"#c9d1d9" };
const formCard = { background:"#1c2230", border:"1px solid #30363d", borderRadius:8, padding:"20px", marginBottom:24 };
const inputStyle = { width:"100%", background:"#0d1117", border:"1px solid #30363d", borderRadius:6, padding:"8px 12px", color:"#e2e8f0", fontSize:13, outline:"none" };
const btnStyle = (c) => ({ background: c + "22", border:"1px solid " + c + "55", color: c, padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:600 });
const msgStyle = (m) => ({ padding:"10px 14px", borderRadius:6, marginBottom:16, fontSize:13, background: m.startsWith("✅") ? "rgba(34,197,94,.1)" : m.startsWith("❌") ? "rgba(239,68,68,.1)" : "rgba(59,130,246,.1)", color: m.startsWith("✅") ? "#86efac" : m.startsWith("❌") ? "#fca5a5" : "#93c5fd", border:"1px solid currentColor" });
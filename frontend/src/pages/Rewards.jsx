// frontend/src/pages/Rewards.jsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";

export default function Rewards({ contracts, address }) {
  const [balance, setBalance]  = useState("0");
  const [symbol,  setSymbol]   = useState("FCT");
  const [rewards, setRewards]  = useState([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => { if (contracts) loadRewards(); }, [contracts]);

  async function loadRewards() {
    setLoading(true);
    const { fct } = contracts;
    const bal = ethers.utils.formatEther(await fct.balanceOf(address));
    const sym = await fct.symbol();
    setBalance(bal);
    setSymbol(sym);

    // Fetch RewardIssued events for connected address
    const filter = fct.filters.RewardIssued(address);
    const events = await fct.queryFilter(filter, 0, "latest");
    const list = await Promise.all(events.map(async e => ({
      amount:      ethers.utils.formatEther(e.args.amount),
      operationId: e.args.operationId,
      block:       e.blockNumber,
      txHash:      e.transactionHash
    })));
    setRewards(list.reverse());
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontSize:22, fontWeight:700, color:"#e2e8f0", marginBottom:24 }}>Rewards — FoodChainToken</h2>

      <div style={{ background:"linear-gradient(135deg,rgba(34,197,94,.15),rgba(59,130,246,.1))", border:"1px solid rgba(34,197,94,.3)", borderRadius:12, padding:24, marginBottom:24, textAlign:"center" }}>
        <div style={{ fontSize:12, color:"#8b949e", marginBottom:4 }}>Your {symbol} Balance</div>
        <div style={{ fontSize:40, fontWeight:800, color:"#22c55e" }}>{parseFloat(balance).toFixed(2)}</div>
        <div style={{ fontSize:14, color:"#8b949e" }}>FCT tokens</div>
      </div>

      <h3 style={{ color:"#8b949e", marginBottom:12, fontSize:15 }}>Reward History</h3>
      {loading && <p style={{ color:"#8b949e" }}>Loading...</p>}
      {!loading && rewards.length === 0 && <p style={{ color:"#8b949e", fontSize:13 }}>No rewards yet. Register or receive a batch to earn FCT.</p>}
      {rewards.map((r, i) => (
        <div key={i} style={{ background:"#1c2230", border:"1px solid #30363d", borderRadius:8, padding:"12px 16px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13 }}>
          <div>
            <span style={{ color:"#22c55e", fontWeight:700, marginRight:12 }}>+{r.amount} FCT</span>
            <span style={{ color:"#8b949e" }}>Block #{r.block}</span>
          </div>
          <span style={{ color:"#8b949e", fontSize:11 }}>{r.txHash.slice(0,20)}…</span>
        </div>
      ))}
    </div>
  );
}
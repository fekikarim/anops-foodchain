// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { STATUS_NAMES, STATUS_COLORS } from "../blockchain/contracts";

export default function Dashboard({ contracts, address }) {
  const [stats, setStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contracts) return;
    loadStats();
  }, [contracts]);

  async function loadStats() {
    setLoading(true);
    try {
      const { fct, nft } = contracts;

      const total   = (await nft.totalBatches()).toNumber();
      const fctBal  = ethers.utils.formatEther(await fct.balanceOf(address));
      const supply  = ethers.utils.formatEther(await fct.totalSupply());

      // Count batches by status (read each NFT)
      const counts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0 };
      for (let i = 1; i <= total; i++) {
        try {
          const b = await nft.getBatch(i);
          counts[b.status] = (counts[b.status] || 0) + 1;
        } catch {}
      }

      // Fetch recent BatchRegistered events
      const filter = nft.filters.BatchRegistered();
      const events = await nft.queryFilter(filter, -100);
      const recent = events.slice(-5).reverse().map(e => ({
        type: "Registered",
        tokenId: e.args.tokenId.toString(),
        producer: e.args.producer,
        block: e.blockNumber
      }));

      setStats({ total, fctBal, supply, counts });
      setRecentEvents(recent);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  if (loading) return <div style={styles.loading}>Loading blockchain data...</div>;
  if (!stats)  return <div style={styles.loading}>No data yet.</div>;

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Dashboard</h2>

      <div style={styles.grid}>
        <StatCard label="Total Batches" value={stats.total} color="#22c55e" />
        <StatCard label="In Transit"    value={stats.counts[1]} color="#3b82f6" />
        <StatCard label="Delivered"     value={stats.counts[3]} color="#10b981" />
        <StatCard label="Flagged/Recalled" value={stats.counts[4] + stats.counts[5]} color="#ef4444" />
        <StatCard label="Your FCT Balance" value={parseFloat(stats.fctBal).toFixed(2) + " FCT"} color="#a78bfa" />
        <StatCard label="Total FCT Supply" value={parseFloat(stats.supply).toLocaleString() + " FCT"} color="#fbbf24" />
      </div>

      <h3 style={styles.sub}>Recent Registrations</h3>
      {recentEvents.length === 0
        ? <p style={styles.muted}>No batches registered yet.</p>
        : recentEvents.map((e, i) => (
          <div key={i} style={styles.event}>
            <span style={styles.badge}>NFT #{e.tokenId}</span>
            <span>Producer: {e.producer.slice(0,8)}…  Block #{e.block}</span>
          </div>
        ))
      }
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={{ color, fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#8b949e", fontSize: 13, marginTop: 4 }}>{label}</div>
    </div>
  );
}

const styles = {
  wrap:    { maxWidth: 900 },
  title:   { fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#e2e8f0" },
  sub:     { fontSize: 16, fontWeight: 600, color: "#22c55e", margin: "32px 0 12px" },
  grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 },
  card:    { background: "#1c2230", border: "1px solid #30363d", borderRadius: 8, padding: "20px 16px" },
  event:   { background: "#1c2230", border: "1px solid #30363d", borderRadius: 6, padding: "10px 14px", marginBottom: 8, fontSize: 13, display: "flex", gap: 12, alignItems: "center" },
  badge:   { background: "rgba(34,197,94,.15)", color: "#22c55e", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 },
  muted:   { color: "#8b949e", fontSize: 13 },
  loading: { color: "#8b949e", padding: 40 }
};
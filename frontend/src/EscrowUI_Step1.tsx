import React, { useCallback, useState, useMemo, useEffect } from "react";
import { ethers } from "ethers";

/**
 * STEP 3 — Connect • Initiate • Fund • Complete (Local Hardhat)
 * + Shareable links, reload persistence, viewer mode, balances, reset
 * ----------------------------------------------------------------
 * One-file UI that:
 *  - Connects MetaMask (chain 31337)
 *  - Lets you paste local contract addresses (Escrow, USDT mock, WBNB mock, BNB/USD feed, USDT/USD feed)
 *  - Creates a $-quoted escrow deal (A = BNB/WBNB, B = USDT)
 *  - Computes required amounts from your mock feeds
 *  - Funds as A (send BNB) and as B (approve+fund USDT)
 *  - Shows live status chips until the deal completes
 *  - Persists state to URL + localStorage; auto-fills addresses from escrow getters
 *  - NEW: hides Initiate section when a `deal` param is present (viewer mode for Party B)
 *  - NEW: "New Deal" reset clears URL/localStorage and UI
 *  - NEW: Balances panel for A/B after settlement (and manual refresh)
 *
 * Deps: `npm i ethers` and Tailwind v4 (@import "tailwindcss" in index.css)
 */

// -----------------------------
// Minimal ABIs
// -----------------------------
const ESCROW_ABI = [
  // actions
  "function createDeal(address partyB, uint64 deadline, uint96 usdA_8d, uint96 usdB_8d, bool unwrapToBNB) returns (uint256)",
  "function fundA_withBNB(uint256 id) payable",
  "function fundA_withWBNB(uint256 id)",
  "function fundB_withUSDT(uint256 id)",
  // views
  "function deals(uint256) view returns (address partyA, address partyB, uint64 deadline, bool unwrapToBNB, uint96 usdA_8d, uint96 usdB_8d, bool priceLocked, uint64 priceTime, uint128 bnbUsd, uint128 usdtUsd, uint256 needWBNB, uint256 needUSDT, bool fundedA, bool fundedB, bool settled, bool canceled)",
  "function getDealsCount() view returns (uint256)",
  // public immutables on your contract (auto-generated getters)
  "function USDT() view returns (address)",
  "function WBNB() view returns (address)",
  "function BNB_USD() view returns (address)",
  "function USDT_USD() view returns (address)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const FEED_ABI = [
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

// -----------------------------
// Helpers
// -----------------------------
const toBigInt = (v: ethers.BigNumberish) => BigInt(v.toString());
const E8 = (n: number) => BigInt(Math.round(n * 1e8));
const fmt = (v: bigint, d = 18) => ethers.formatUnits(v, d);
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

// Mirror contract math: tokens = ceil( usd(8d)->priceDecs * 1eTokenDecs / price )
function usdToToken(usd8d: bigint, price: bigint, priceDecs: number, tokenDecs: number) {
  const usdScaled = priceDecs >= 8
    ? usd8d * 10n ** BigInt(priceDecs - 8)
    : usd8d / 10n ** BigInt(8 - priceDecs);
  const numerator = usdScaled * 10n ** BigInt(tokenDecs);
  return ceilDiv(numerator, price);
}

function short(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// -----------------------------
// Main Component
// -----------------------------
export default function EscrowUI_Step1() {
  // ---- web3 basics ----
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  // ---- addresses (paste your local deploy outputs) ----
  const [escrowAddr, setEscrowAddr] = useState<string>("");
  const [usdtAddr, setUsdtAddr] = useState<string>("");
  const [wbnbAddr, setWbnbAddr] = useState<string>("");
  const [bnbUsdFeed, setBnbUsdFeed] = useState<string>("");
  const [usdtUsdFeed, setUsdtUsdFeed] = useState<string>("");

  // URL/link sharing & persistence
  const [copied, setCopied] = useState<boolean>(false);
  const [viewOnly, setViewOnly] = useState<boolean>(false); // hide initiate when true (Party B view)

  // ---- initiate escrow form ----
  const [partyB, setPartyB] = useState<string>("");
  const [usdAmount, setUsdAmount] = useState<number>(20);
  const [deadlineHrs, setDeadlineHrs] = useState<number>(72);
  const [unwrapToBNB, setUnwrapToBNB] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // ---- deal & funding state ----
  const [dealId, setDealId] = useState<number | null>(null);
  const [status, setStatus] = useState<{priceLocked:boolean; fundedA:boolean; fundedB:boolean; settled:boolean}>({priceLocked:false,fundedA:false,fundedB:false,settled:false});
  const [needWBNB, setNeedWBNB] = useState<bigint | null>(null);
  const [needUSDT, setNeedUSDT] = useState<bigint | null>(null);
  const [computing, setComputing] = useState<boolean>(false);
  const [fundingA, setFundingA] = useState<boolean>(false);
  const [fundingB, setFundingB] = useState<boolean>(false);

  // balances panel
  const [partyAOnchain, setPartyAOnchain] = useState<string>("");
  const [partyBOnchain, setPartyBOnchain] = useState<string>("");
  const [bal, setBal] = useState<{A_USDT?: bigint; A_WBNB?: bigint; A_BNB?: bigint; B_USDT?: bigint; B_WBNB?: bigint; B_BNB?: bigint; usdtD?: number; wbnbD?: number;}>({});

  // derived role banner
  const role = useMemo(() => {
    if (!account || !partyAOnchain || !partyBOnchain) return 'Unknown';
    const acc = account.toLowerCase();
    if (partyAOnchain && acc === partyAOnchain.toLowerCase()) return 'Party A';
    if (partyBOnchain && acc === partyBOnchain.toLowerCase()) return 'Party B';
    return 'Observer';
  }, [account, partyAOnchain, partyBOnchain]);

  // connect wallet
  const connect = useCallback(async () => {
    try {
      const anyWin = window as any;
      if (!anyWin.ethereum) { setError("MetaMask not found. Please install it."); return; }
      const prov = new ethers.BrowserProvider(anyWin.ethereum);
      await prov.send("eth_requestAccounts", []);
      const sg = await prov.getSigner();
      const acc = await sg.getAddress();
      const net = await prov.getNetwork();
      setProvider(prov); setSigner(sg); setAccount(acc); setChainId(Number(net.chainId)); setError("");
      anyWin.ethereum?.on?.("accountsChanged", async () => { const s = await prov.getSigner(); setSigner(s); setAccount(await s.getAddress()); });
      anyWin.ethereum?.on?.("chainChanged", async () => { const n = await prov.getNetwork(); setChainId(Number(n.chainId)); });
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to connect wallet"); }
  }, []);

  // instances
  const escrow = useMemo(() => (signer && escrowAddr && ethers.isAddress(escrowAddr)) ? new ethers.Contract(escrowAddr, ESCROW_ABI, signer) : null, [signer, escrowAddr]);
  const usdt = useMemo(() => (signer && usdtAddr && ethers.isAddress(usdtAddr)) ? new ethers.Contract(usdtAddr, ERC20_ABI, signer) : null, [signer, usdtAddr]);
  const wbnb = useMemo(() => (signer && wbnbAddr && ethers.isAddress(wbnbAddr)) ? new ethers.Contract(wbnbAddr, ERC20_ABI, signer) : null, [signer, wbnbAddr]);
  const feedBNB = useMemo(() => (provider && bnbUsdFeed && ethers.isAddress(bnbUsdFeed)) ? new ethers.Contract(bnbUsdFeed, FEED_ABI, provider) : null, [provider, bnbUsdFeed]);
  const feedUSDT = useMemo(() => (provider && usdtUsdFeed && ethers.isAddress(usdtUsdFeed)) ? new ethers.Contract(usdtUsdFeed, FEED_ABI, provider) : null, [provider, usdtUsdFeed]);

  // ---- URL <-> state sync ----
  const syncToURL = useCallback(() => {
    const u = new URL(window.location.href);
    const p = u.searchParams;
    ["escrow","usdt","wbnb","bnbUsdFeed","usdtUsdFeed","deal","chain"].forEach(k => p.delete(k));
    if (escrowAddr) p.set("escrow", escrowAddr);
    if (usdtAddr) p.set("usdt", usdtAddr);
    if (wbnbAddr) p.set("wbnb", wbnbAddr);
    if (bnbUsdFeed) p.set("bnbUsdFeed", bnbUsdFeed);
    if (usdtUsdFeed) p.set("usdtUsdFeed", usdtUsdFeed);
    if (dealId !== null) p.set("deal", String(dealId));
    if (chainId) p.set("chain", String(chainId));
    window.history.replaceState({}, "", `${u.pathname}?${p.toString()}`);
    localStorage.setItem("escrow-demo:last", p.toString());
  }, [escrowAddr, usdtAddr, wbnbAddr, bnbUsdFeed, usdtUsdFeed, dealId, chainId]);

  const copyShare = useCallback(async () => {
    syncToURL();
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }, [syncToURL]);

  const resetAll = useCallback(() => {
    // clear URL & storage
    const u = new URL(window.location.href); u.search = ""; window.history.replaceState({}, "", u.pathname);
    localStorage.removeItem("escrow-demo:last");
    // reset state
    setEscrowAddr(""); setUsdtAddr(""); setWbnbAddr(""); setBnbUsdFeed(""); setUsdtUsdFeed("");
    setPartyB(""); setUsdAmount(20); setDeadlineHrs(72); setUnwrapToBNB(false);
    setDealId(null); setStatus({priceLocked:false,fundedA:false,fundedB:false,settled:false});
    setNeedWBNB(null); setNeedUSDT(null); setViewOnly(false); setCopied(false);
    setPartyAOnchain(""); setPartyBOnchain(""); setBal({}); setError("");
  }, []);

  // on first load, hydrate from URL or localStorage
  useEffect(() => {
    const q = new URL(window.location.href).searchParams;
    const fromStore = localStorage.getItem("escrow-demo:last");
    const ps = q.toString() ? q : (fromStore ? new URLSearchParams(fromStore) : null);
    if (!ps) return;
    const e = ps.get("escrow"); if (e) setEscrowAddr(e);
    const u = ps.get("usdt"); if (u) setUsdtAddr(u);
    const w = ps.get("wbnb"); if (w) setWbnbAddr(w);
    const bf = ps.get("bnbUsdFeed"); if (bf) setBnbUsdFeed(bf);
    const uf = ps.get("usdtUsdFeed"); if (uf) setUsdtUsdFeed(uf);
    const d = ps.get("deal"); if (d) { setDealId(Number(d)); setViewOnly(true); }
  }, []);

  // whenever important fields change, update URL/localStorage
  useEffect(() => { syncToURL(); }, [syncToURL]);

  // If only escrow is known, auto-fill the other contract addresses from escrow getters
  const loadFromEscrow = useCallback(async () => {
    if (!escrow) return;
    try {
      const [usdtA, wbnbA, bnbF, usdtF] = await Promise.all([
        escrow.USDT(), escrow.WBNB(), escrow.BNB_USD(), escrow.USDT_USD()
      ]);
      if (!usdtAddr) setUsdtAddr(usdtA);
      if (!wbnbAddr) setWbnbAddr(wbnbA);
      if (!bnbUsdFeed) setBnbUsdFeed(bnbF);
      if (!usdtUsdFeed) setUsdtUsdFeed(usdtF);
    } catch (e) { console.warn("Failed to load addresses from escrow", e); }
  }, [escrow, usdtAddr, wbnbAddr, bnbUsdFeed, usdtUsdFeed]);

  // auto-try loading addresses whenever escrow instance changes
  useEffect(() => { loadFromEscrow(); }, [loadFromEscrow]);

  // create a deal
  const onInitiate = useCallback(async () => {
    if (!escrow) { setError("Escrow address or signer missing"); return; }
    if (!ethers.isAddress(partyB)) { setError("Invalid Party B address"); return; }
    try {
      setCreating(true); setError("");
      const deadline = BigInt(Math.floor(Date.now()/1000) + deadlineHrs * 3600);
      const usd8d = E8(usdAmount);
      const tx = await escrow.createDeal(partyB, deadline, usd8d, usd8d, unwrapToBNB);
      await tx.wait();
      // pull the last index
      let id: number | null = null;
      try { const count: bigint = await escrow.getDealsCount(); id = Number(count - 1n); } catch {}
      if (id === null) id = 0; // fallback for first deal
      setDealId(id);
      setViewOnly(true); // after creating, hide initiate to mimic shared viewer
      syncToURL();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to create deal"); }
    finally { setCreating(false); }
  }, [escrow, partyB, deadlineHrs, usdAmount, unwrapToBNB, syncToURL]);

  // compute required token amounts from feeds (off-chain mirror of contract math)
  const computeNeeds = useCallback( async () => {
    if (!feedBNB || !feedUSDT || !usdt || !wbnb) { setError("Paste all 5 addresses first"); return; }
    try {
      setComputing(true); setError("");
      const [bnbDecs, bnbRound, usdtDecs, uRound, wbnbDecs, usdtTokDecs] = await Promise.all([
        feedBNB.decimals(), feedBNB.latestRoundData(), feedUSDT.decimals(), feedUSDT.latestRoundData(), wbnb.decimals(), usdt.decimals()
      ]);
      const bnbPrice = toBigInt(bnbRound[1]);
      const uPrice = toBigInt(uRound[1]);
      const priceDecBNB = Number(bnbDecs.toString());
      const priceDecUSDT = Number(usdtDecs.toString());
      const wbnbD = Number(wbnbDecs.toString());
      const usdtD = Number(usdtTokDecs.toString());
      const usd8d = E8(usdAmount);
      const wNeed = usdToToken(usd8d, bnbPrice, priceDecBNB, wbnbD);
      const uNeed = usdToToken(usd8d, uPrice,  priceDecUSDT, usdtD);
      setNeedWBNB(wNeed); setNeedUSDT(uNeed);
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to compute amounts"); }
    finally { setComputing(false); }
  }, [feedBNB, feedUSDT, usdt, wbnb, usdAmount]);

  // fund as A (send native BNB; contract wraps to WBNB)
  const fundA = useCallback( async () => {
    if (!escrow || dealId === null || needWBNB === null) { setError("Compute amounts first"); return; }
    try {
      setFundingA(true); setError("");
      const tx = await escrow.fundA_withBNB(dealId, { value: needWBNB });
      await tx.wait();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Funding A failed"); }
    finally { setFundingA(false); }
  }, [escrow, dealId, needWBNB]);

  // fund as B (approve + fund USDT)
  const fundB = useCallback( async () => {
    if (!escrow || !usdt || dealId === null || needUSDT === null) { setError("Compute amounts first"); return; }
    try {
      setFundingB(true); setError("");
      await (await usdt.approve(escrowAddr, needUSDT)).wait();
      await (await escrow.fundB_withUSDT(dealId)).wait();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Funding B failed"); }
    finally { setFundingB(false); }
  }, [escrow, usdt, dealId, needUSDT, escrowAddr]);

  // poll deal status (and track parties)
  useEffect(() => {
    let t: any; const tick = async () => {
      if (!escrow || dealId === null) return;
      try {
        const d = await escrow.deals(dealId);
        setStatus({ priceLocked: d.priceLocked, fundedA: d.fundedA, fundedB: d.fundedB, settled: d.settled });
        setPartyAOnchain(d.partyA); setPartyBOnchain(d.partyB);
      } catch {}
    };
    if (dealId !== null) { tick(); t = setInterval(tick, 1200); }
    return () => { if (t) clearInterval(t); };
  }, [escrow, dealId]);

  // balances refresher
  const refreshBalances = useCallback(async () => {
    if (!escrow || dealId === null || !usdt || !wbnb || !provider) return;
    const d = await escrow.deals(dealId);
    const [usdtD, wbnbD, aUsdt, bUsdt, aW, bW, aBNB, bBNB] = await Promise.all([
      usdt.decimals(), wbnb.decimals(),
      usdt.balanceOf(d.partyA), usdt.balanceOf(d.partyB),
      wbnb.balanceOf(d.partyA), wbnb.balanceOf(d.partyB),
      provider.getBalance(d.partyA), provider.getBalance(d.partyB)
    ]);
    setBal({ usdtD: Number(usdtD.toString()), wbnbD: Number(wbnbD.toString()), A_USDT: aUsdt, B_USDT: bUsdt, A_WBNB: aW, B_WBNB: bW, A_BNB: aBNB, B_BNB: bBNB });
  }, [escrow, dealId, usdt, wbnb, provider]);

  // auto-refresh balances upon settlement
  useEffect(() => { if (status.settled) { refreshBalances(); } }, [status.settled, refreshBalances]);

  const connected = !!account && !!provider;
  const onLocal = chainId === 31337 || chainId === 1337;
  const activeStep = !connected ? 1 : dealId === null ? 2 : !status.settled ? 3 : 4;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* background ornaments */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0))] opacity-40" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Header onLocal={onLocal} chainId={chainId} activeStep={activeStep} />

        {/* Connect Card */}
        <ConnectCard connected={connected} onConnect={connect} account={account} chainId={chainId} onLocal={onLocal} error={error} />

        {dealId !== null && connected && (
          <div className="mt-3"><RoleBadge role={role} /></div>
        )}

        {/* Addresses + Initiate + Compute + Fund */}
        <div className="mt-6 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
          <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6 grid gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Contracts & Feeds</h2>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={resetAll} className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5">New Deal</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Escrow address" value={escrowAddr} onChange={setEscrowAddr} placeholder="0x... (UsdEscrow_BNB_USDT)" />
              <Input label="USDT address (mock)" value={usdtAddr} onChange={setUsdtAddr} placeholder="0x... (MockERC20Dec)" />
              <Input label="WBNB address (mock)" value={wbnbAddr} onChange={setWbnbAddr} placeholder="0x... (WrappedNativeMock)" />
              <Input label="BNB/USD feed" value={bnbUsdFeed} onChange={setBnbUsdFeed} placeholder="0x... (PriceFeedMock)" />
              <Input label="USDT/USD feed" value={usdtUsdFeed} onChange={setUsdtUsdFeed} placeholder="0x... (PriceFeedMock)" />
            </div>
            <div className="flex flex-wrap items-center gap-3 -mt-1">
              <button onClick={loadFromEscrow} disabled={!escrow} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs disabled:opacity-50">Auto-fill from Escrow</button>
              <button onClick={copyShare} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs">{copied ? "Link Copied!" : "Copy Share Link"}</button>
              <span className="text-[11px] text-slate-500">Shareable URL includes escrow, deal, and contract addresses. Party B can open and just “Approve + Fund”.</span>
            </div>

            {/* Initiate section hidden in viewer mode */}
            {!viewOnly && (
              <>
                <h2 className="text-sm font-semibold text-slate-300">Initiate Escrow</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  <Input label="Party B address" value={partyB} onChange={setPartyB} placeholder="0x... (the counterparty)" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="$ Amount (each side)" type="number" value={String(usdAmount)} onChange={(v)=> setUsdAmount(Number(v || 0))} placeholder="20" />
                    <Input label="Deadline (hours)" type="number" value={String(deadlineHrs)} onChange={(v)=> setDeadlineHrs(Number(v || 0))} placeholder="72" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm mt-1">
                  <input type="checkbox" checked={unwrapToBNB} onChange={(e)=> setUnwrapToBNB(e.target.checked)} />
                  Payout B in native BNB (unwrap)
                </label>
                <div className="flex items-center gap-3">
                  <button disabled={!connected || !escrow} onClick={onInitiate} className="rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium disabled:opacity-50">
                    {creating ? "Creating…" : "Initiate Escrow"}
                  </button>
                  {dealId !== null && <span className="text-xs text-slate-300">Deal ID: <b>#{dealId}</b></span>}
                </div>
              </>
            )}

            {/* Compute and Fund */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-semibold mb-3">Compute Required Amounts</h3>
                <p className="text-xs text-slate-400 mb-3">Read feeds to mirror contract math. Run before funding.</p>
                <button
                  onClick={computeNeeds}
                  disabled={computing || !(feedBNB && feedUSDT && usdt && wbnb)}
                  className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {computing ? "Computing…" : "Compute"}
                </button>

                <div className="mt-3 text-sm">
                  <p>Need WBNB for A: <b>{needWBNB ? fmt(needWBNB, 18) : "-"}</b></p>
                  <p>Need USDT for B: <b>{needUSDT ? fmt(needUSDT, 18) : "-"}</b></p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-semibold mb-3">Fund Actions</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                  {role === 'Party A' && (
                    <button
                      onClick={fundA}
                      disabled={dealId === null || needWBNB === null || fundingA}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {fundingA ? "Funding A…" : "Fund as A (send BNB)"}
                    </button>
                  )}

                  {role === 'Party B' && (
                    <button
                      onClick={fundB}
                      disabled={dealId === null || needUSDT === null || fundingB}
                      className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {fundingB ? "Funding B…" : "Approve + Fund as B (USDT)"}
                    </button>
                  )}

                  {role !== 'Party A' && role !== 'Party B' && (
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>To fund as A, switch to {partyAOnchain ? short(partyAOnchain) : 'Party A'}.</div>
                      <div>To fund as B, switch to {partyBOnchain ? short(partyBOnchain) : 'Party B'}.</div>
                    </div>
                  )}

                  {role === 'Party A' && (
                    <div className="text-xs text-slate-400">
                      Party B must connect as {partyBOnchain ? short(partyBOnchain) : 'Party B'} to fund.
                    </div>
                  )}

                  {role === 'Party B' && (
                    <div className="text-xs text-slate-400">
                      Party A must connect as {partyAOnchain ? short(partyAOnchain) : 'Party A'} to fund.
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2"></p>
              </div>
            </div>

            {/* Status chips */}
            {dealId !== null && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-white/10">
                <Chip ok={status.priceLocked} label={status.priceLocked ? "Prices Locked" : "Prices Not Locked"} />
                <Chip ok={status.fundedA} label={status.fundedA ? "A Funded" : "A Not Funded"} />
                <Chip ok={status.fundedB} label={status.fundedB ? "B Funded" : "B Not Funded"} />
                <Chip ok={status.settled} label={status.settled ? "Contract Complete" : "Waiting…"} />
              </div>
            )}

            {/* Balances */}
            {dealId !== null && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 grid gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Balances</h3>
                  <button onClick={refreshBalances} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs">Refresh Balances</button>
                </div>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Party A {partyAOnchain ? `(${short(partyAOnchain)})` : ""}</div>
                    <div className="space-y-1">
                      <div>USDT: <b>{bal.A_USDT !== undefined && bal.usdtD !== undefined ? fmt(bal.A_USDT, bal.usdtD) : "-"}</b></div>
                      <div>WBNB: <b>{bal.A_WBNB !== undefined && bal.wbnbD !== undefined ? fmt(bal.A_WBNB, bal.wbnbD) : "-"}</b></div>
                      <div>BNB: <b>{bal.A_BNB !== undefined ? ethers.formatEther(bal.A_BNB) : "-"}</b></div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Party B {partyBOnchain ? `(${short(partyBOnchain)})` : ""}</div>
                    <div className="space-y-1">
                      <div>USDT: <b>{bal.B_USDT !== undefined && bal.usdtD !== undefined ? fmt(bal.B_USDT, bal.usdtD) : "-"}</b></div>
                      <div>WBNB: <b>{bal.B_WBNB !== undefined && bal.wbnbD !== undefined ? fmt(bal.B_WBNB, bal.wbnbD) : "-"}</b></div>
                      <div>BNB: <b>{bal.B_BNB !== undefined ? ethers.formatEther(bal.B_BNB) : "-"}</b></div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">After settlement: A should hold USDT, B should hold WBNB or native BNB depending on the unwrap toggle.</div>
              </div>
            )}

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">{error}</div>}

            <p className="text-[11px] text-slate-500">If a button reverts, double-check the 5 addresses and re-run Compute to refresh amounts. Share this page URL with Party B after creating the deal.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-[11px] text-slate-500">Copyright VesselWallet 2025</div>
      </div>
    </div>
  );
}

// ---------- UI bits ----------
function Header({ onLocal, chainId, activeStep }: { onLocal: boolean; chainId: number | null; activeStep: number }) {
  const Step = ({ n, label }: { n: number; label: string }) => (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 text-[12px] ${activeStep >= n ? "ring-indigo-400/40 bg-indigo-400/10 text-indigo-200" : "ring-white/10 bg-white/5 text-slate-300"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${activeStep >= n ? "bg-indigo-400" : "bg-slate-400"}`} /> {label}
    </span>
  );
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/20 backdrop-blur-sm flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3m0-14l-3 3M8 16l-3 3"/></svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight"><span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">VesselWallet Escrow dApp</span></h1>
          <p className="text-[12px] text-slate-400">Ethereum Mainnet · Step {activeStep} of 4</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
        <Step n={1} label="Connect" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={2} label="Initiate" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={3} label="Fund" />
        <div className="h-[1px] w-6 bg-white/10" />
        <Step n={4} label="Complete" />
        <div className="h-[1px] w-6 bg-white/10" />
        <span className={`px-2 py-1 rounded-md ${onLocal ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>{onLocal ? "Ethereum Mainnet" : `chain ${chainId}`}</span>
      </div>
    </header>
  );
}

function ConnectCard({ connected, onConnect, account, chainId, onLocal, error }: { connected: boolean; onConnect: ()=>void; account: string; chainId: number | null; onLocal: boolean; error: string; }) {
  return (
    <div className="mt-8 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
      <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6">
        {!connected ? (
          <div className="grid gap-5">
            <div className="text-sm text-slate-300">Connect MetaMask to get started</div>
            <button onClick={onConnect} className="group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-rose-500 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] hover:shadow-[0_10px_38px_-10px_rgba(236,72,153,0.55)] transition-all active:scale-[0.99]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 12h12M12 6v12"/></svg>
              Connect Wallet
            </button>
            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">{error}</div>}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] text-slate-400 font-medium mb-1">Tips</div>
              <ul className="text-[12px] text-slate-400 list-disc ml-5 space-y-1">
                <li>Listening to node: <code className="text-slate-300">Ethereum Mainnet</code></li>
                <li>MetaMask network: RPC <span className="text-slate-300">mainnet.infura.io</span> · Chain ID <span className="text-slate-300">1</span></li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Account" value={short(account)} />
              <Info label="Chain" value={onLocal ? "Ethereum Mainnet" : String(chainId)} highlight={onLocal} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${highlight ? "ring-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "ring-white/10 bg-black/20"}`}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm tracking-tight">{value}</div>
    </div>
  );
}

function Chip({ ok = true, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] ring-1 transition ${ok ? "bg-emerald-400/10 text-emerald-200 ring-emerald-300/20" : "bg-slate-700/40 text-slate-200 ring-white/10"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-400"}`} /> {label}
    </span>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string)=>void; placeholder?: string; type?: string; }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-300">{label}</span>
      <input className="rounded-lg bg-slate-900/60 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={value} onChange={(e)=> onChange(e.target.value)} placeholder={placeholder} type={type} />
    </label>
  );
}

function RoleBadge({ role }: { role: 'Party A' | 'Party B' | 'Observer' | 'Unknown' | string }) {
  const styles = role === 'Party A'
    ? 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/30'
    : role === 'Party B'
    ? 'bg-sky-500/15 text-sky-200 ring-sky-400/30'
    : role === 'Observer'
    ? 'bg-slate-600/20 text-slate-200 ring-white/10'
    : 'bg-amber-500/15 text-amber-200 ring-amber-400/30';
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ring-1 ${styles}`}>
      <span className="h-2 w-2 rounded-full bg-current/70" />
      <span>Role: <b>{role}</b></span>
      <span className="text-xs text-white/60 ml-1">{role === 'Unknown' ? 'Connect wallet to determine' : role === 'Observer' ? 'Address does not match A or B' : ''}</span>
    </div>
  );
}

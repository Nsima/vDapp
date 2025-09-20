import React, { useCallback, useState, useMemo, useEffect } from "react";
import { ethers } from "ethers";
import Header from "../components/Header";
import ConnectCard from "../components/ConnectCard";
import RoleBadge from "../components/RoleBadge";
import Chip from "../components/Chip";
import AddressForm from "../components/AddressForm";
import InitiateForm from "../components/InitiateForm";
import ComputePanel from "../components/ComputePanel";
import FundPanel from "../components/FundPanel";
import BalancesPanel from "../components/BalancesPanel";
import CountdownChip from "../components/CountdownChip";

// -----------------------------
// Minimal ABIs (unchanged)
// -----------------------------
const ESCROW_ABI = [
  "function createDeal(address partyB, uint64 deadline, uint96 usdA_8d, uint96 usdB_8d, bool unwrapToBNB) returns (uint256)",
  "function fundA_withBNB(uint256 id) payable",
  "function fundA_withWBNB(uint256 id)",
  "function fundB_withUSDT(uint256 id)",
  "function deals(uint256) view returns (address partyA, address partyB, uint64 deadline, bool unwrapToBNB, uint96 usdA_8d, uint96 usdB_8d, bool priceLocked, uint64 priceTime, uint128 bnbUsd, uint128 usdtUsd, uint256 needWBNB, uint256 needUSDT, bool fundedA, bool fundedB, bool settled, bool canceled)",
  "function getDealsCount() view returns (uint256)",
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
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
];

// -----------------------------
// Helpers (unchanged)
// -----------------------------
const toBigInt = (v: ethers.BigNumberish) => BigInt(v.toString());
const E8 = (n: number) => BigInt(Math.round(n * 1e8));
const fmt = (v: bigint, d = 18) => ethers.formatUnits(v, d);
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

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
// Main Page (logic unchanged; UI split out)
// -----------------------------
export default function EscrowPage() {
  // web3 basics
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  // addresses
  const [escrowAddr, setEscrowAddr] = useState<string>("");
  const [usdtAddr, setUsdtAddr] = useState<string>("");
  const [wbnbAddr, setWbnbAddr] = useState<string>("");
  const [bnbUsdFeed, setBnbUsdFeed] = useState<string>("");
  const [usdtUsdFeed, setUsdtUsdFeed] = useState<string>("");

  // link/persistence
  const [copied, setCopied] = useState<boolean>(false);
  const [viewOnly, setViewOnly] = useState<boolean>(false);

  // countdowns
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // initiate form
  const [partyB, setPartyB] = useState<string>("");
  const [usdAmount, setUsdAmount] = useState<number>(20);
  const [deadlineHrs, setDeadlineHrs] = useState<number>(72);
  const [unwrapToBNB, setUnwrapToBNB] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);

  // deal & funding
  const [dealId, setDealId] = useState<number | null>(null);
  const [status, setStatus] = useState({ priceLocked: false, fundedA: false, fundedB: false, settled: false });
  const [needWBNB, setNeedWBNB] = useState<bigint | null>(null);
  const [needUSDT, setNeedUSDT] = useState<bigint | null>(null);
  const [computing, setComputing] = useState<boolean>(false);
  const [fundingA, setFundingA] = useState<boolean>(false);
  const [fundingB, setFundingB] = useState<boolean>(false);

  // balances
  const [partyAOnchain, setPartyAOnchain] = useState<string>("");
  const [partyBOnchain, setPartyBOnchain] = useState<string>("");
  const [bal, setBal] = useState<{A_USDT?: bigint; A_WBNB?: bigint; A_BNB?: bigint; B_USDT?: bigint; B_WBNB?: bigint; B_BNB?: bigint; usdtD?: number; wbnbD?: number;}>({});

  const role = useMemo(() => {
    if (!account || !partyAOnchain || !partyBOnchain) return "Unknown";
    const acc = account.toLowerCase();
    if (partyAOnchain && acc === partyAOnchain.toLowerCase()) return "Party A";
    if (partyBOnchain && acc === partyBOnchain.toLowerCase()) return "Party B";
    return "Observer";
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
  const usdt   = useMemo(() => (signer && usdtAddr && ethers.isAddress(usdtAddr)) ? new ethers.Contract(usdtAddr, ERC20_ABI, signer) : null, [signer, usdtAddr]);
  const wbnb   = useMemo(() => (signer && wbnbAddr && ethers.isAddress(wbnbAddr)) ? new ethers.Contract(wbnbAddr, ERC20_ABI, signer) : null, [signer, wbnbAddr]);
  const feedBNB  = useMemo(() => (provider && bnbUsdFeed && ethers.isAddress(bnbUsdFeed)) ? new ethers.Contract(bnbUsdFeed, FEED_ABI, provider) : null, [provider, bnbUsdFeed]);
  const feedUSDT = useMemo(() => (provider && usdtUsdFeed && ethers.isAddress(usdtUsdFeed)) ? new ethers.Contract(usdtUsdFeed, FEED_ABI, provider) : null, [provider, usdtUsdFeed]);

  // URL sync
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
    const u = new URL(window.location.href); u.search = ""; window.history.replaceState({}, "", u.pathname);
    localStorage.removeItem("escrow-demo:last");
    setEscrowAddr(""); setUsdtAddr(""); setWbnbAddr(""); setBnbUsdFeed(""); setUsdtUsdFeed("");
    setPartyB(""); setUsdAmount(20); setDeadlineHrs(72); setUnwrapToBNB(false);
    setDealId(null); setStatus({priceLocked:false,fundedA:false,fundedB:false,settled:false});
    setNeedWBNB(null); setNeedUSDT(null); setViewOnly(false); setCopied(false);
    setPartyAOnchain(""); setPartyBOnchain(""); setBal({}); setError("");
    setDeadlineTs(null); setTimeLeft(null);
  }, []);

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

  useEffect(() => { syncToURL(); }, [syncToURL]);

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

  useEffect(() => { loadFromEscrow(); }, [loadFromEscrow]);

  const onInitiate = useCallback(async () => {
    if (!escrow) { setError("Escrow address or signer missing"); return; }
    if (!ethers.isAddress(partyB)) { setError("Invalid Party B address"); return; }
    try {
      setCreating(true); setError("");
      const deadline = BigInt(Math.floor(Date.now()/1000) + deadlineHrs * 3600);
      const usd8d = E8(usdAmount);
      const tx = await escrow.createDeal(partyB, deadline, usd8d, usd8d, unwrapToBNB);
      await tx.wait();
      let id: number | null = null;
      try { const count: bigint = await escrow.getDealsCount(); id = Number(count - 1n); } catch {}
      if (id === null) id = 0;
      setDealId(id);
      setViewOnly(true);
      syncToURL();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to create deal"); }
    finally { setCreating(false); }
  }, [escrow, partyB, deadlineHrs, usdAmount, unwrapToBNB, syncToURL]);

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

  const fundA = useCallback( async () => {
    if (!escrow || dealId === null || needWBNB === null) { setError("Compute amounts first"); return; }
    try {
      setFundingA(true); setError("");
      const tx = await escrow.fundA_withBNB(dealId, { value: needWBNB });
      await tx.wait();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Funding A failed"); }
    finally { setFundingA(false); }
  }, [escrow, dealId, needWBNB]);

  const fundB = useCallback( async () => {
    if (!escrow || !usdt || dealId === null || needUSDT === null) { setError("Compute amounts first"); return; }
    try {
      setFundingB(true); setError("");
      await (await usdt.approve(escrowAddr, needUSDT)).wait();
      await (await escrow.fundB_withUSDT(dealId)).wait();
    } catch (e:any) { console.error(e); setError(e?.shortMessage || e?.message || "Funding B failed"); }
    finally { setFundingB(false); }
  }, [escrow, usdt, dealId, needUSDT, escrowAddr]);

  // Poll deal (captures deadline)
  useEffect(() => {
    let t: any;
    const tick = async () => {
      if (!escrow || dealId === null) return;
      try {
        const d = await escrow.deals(dealId);
        setStatus({ priceLocked: d.priceLocked, fundedA: d.fundedA, fundedB: d.fundedB, settled: d.settled });
        setPartyAOnchain(d.partyA);
        setPartyBOnchain(d.partyB);
        setDeadlineTs(Number(d.deadline)); // keep deadline updated
      } catch {}
    };
    if (dealId !== null) { tick(); t = setInterval(tick, 1200); }
    return () => { if (t) clearInterval(t); };
  }, [escrow, dealId]);

  // Live countdown from deadlineTs
  useEffect(() => {
    if (deadlineTs === null) { setTimeLeft(null); return; }
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, deadlineTs - now));
    };
    update(); // initial tick
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [deadlineTs]);

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

  useEffect(() => { if (status.settled) { refreshBalances(); } }, [status.settled, refreshBalances]);

  const connected = !!account && !!provider;
  const onLocal = chainId === 31337 || chainId === 1337;
  const activeStep = !connected ? 1 : dealId === null ? 2 : !status.settled ? 3 : 4;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ornaments */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0))] opacity-40" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Header onLocal={onLocal} chainId={chainId} activeStep={activeStep} />

        <ConnectCard connected={connected} onConnect={connect} account={account} chainId={chainId} onLocal={onLocal} error={error} />

        {dealId !== null && connected && (
          <div className="mt-3"><RoleBadge role={role as any} /></div>
        )}

        <div className="mt-6 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
          <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6 grid gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Contracts & Feeds</h2>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={resetAll} className="rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5">New Deal</button>
              </div>
            </div>

            <AddressForm
              escrowAddr={escrowAddr} setEscrowAddr={setEscrowAddr}
              usdtAddr={usdtAddr} setUsdtAddr={setUsdtAddr}
              wbnbAddr={wbnbAddr} setWbnbAddr={setWbnbAddr}
              bnbUsdFeed={bnbUsdFeed} setBnbUsdFeed={setBnbUsdFeed}
              usdtUsdFeed={usdtUsdFeed} setUsdtUsdFeed={setUsdtUsdFeed}
              loadFromEscrow={loadFromEscrow}
              copyShare={copyShare}
              copied={copied}
              escrow={escrow}
            />

            {!viewOnly && (
              <InitiateForm
                partyB={partyB} setPartyB={setPartyB}
                usdAmount={usdAmount} setUsdAmount={setUsdAmount}
                deadlineHrs={deadlineHrs} setDeadlineHrs={setDeadlineHrs}
                unwrapToBNB={unwrapToBNB} setUnwrapToBNB={setUnwrapToBNB}
                onInitiate={onInitiate}
                creating={creating}
                dealId={dealId}
              />
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <ComputePanel
                computeNeeds={computeNeeds}
                computing={computing}
                needWBNB={needWBNB}
                needUSDT={needUSDT}
                feedBNB={!!feedBNB}
                feedUSDT={!!feedUSDT}
                usdt={!!usdt}
                wbnb={!!wbnb}
                fmt={fmt}
              />

              <FundPanel
                role={role}
                fundA={fundA}
                fundB={fundB}
                dealId={dealId}
                needWBNB={needWBNB}
                needUSDT={needUSDT}
                fundingA={fundingA}
                fundingB={fundingB}
                partyAOnchain={partyAOnchain}
                partyBOnchain={partyBOnchain}
                short={short}
                isExpired={timeLeft !== null && timeLeft <= 0} // ⬅️ countdown enforcement
              />
            </div>

            {dealId !== null && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-white/10">
                <Chip ok={status.priceLocked} label={status.priceLocked ? "Prices Locked" : "Prices Not Locked"} />
                <Chip ok={status.fundedA} label={status.fundedA ? "A Funded" : "A Not Funded"} />
                <Chip ok={status.fundedB} label={status.fundedB ? "B Funded" : "B Not Funded"} />
                <Chip ok={status.settled} label={status.settled ? "Contract Complete" : "Waiting…"} />
                <CountdownChip seconds={timeLeft} /> {/* ⬅️ live countdown chip */}
              </div>
            )}

            {dealId !== null && (
              <BalancesPanel
                partyAOnchain={partyAOnchain}
                partyBOnchain={partyBOnchain}
                bal={bal}
                fmt={fmt}
                refreshBalances={refreshBalances}
                ethers={ethers}
              />
            )}

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">{error}</div>}

            <p className="text-[11px] text-slate-500">If a button reverts, double-check the 5 addresses and re-run Compute to refresh amounts. Share this page URL with Party B after creating the deal.</p>
          </div>
        </div>

        <div className="mt-8 text-[11px] text-slate-500">Copyright VesselWallet 2025</div>
      </div>
    </div>
  );
}

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
import AbiPanel from "../components/AbiPanel";

// -----------------------------
// Minimal ABIs
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
// Helpers
// -----------------------------
const toBigInt = (v: ethers.BigNumberish) => BigInt(v.toString());
const E8 = (n: number) => BigInt(Math.round(n * 1e8));
const fmt = (v: bigint, d = 18) => ethers.formatUnits(v, d);
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

function usdToToken(usd8d: bigint, price: bigint, priceDecs: number, tokenDecs: number) {
  const usdScaled =
    priceDecs >= 8 ? usd8d * 10n ** BigInt(priceDecs - 8) : usd8d / 10n ** BigInt(8 - priceDecs);
  const numerator = usdScaled * 10n ** BigInt(tokenDecs);
  return ceilDiv(numerator, price);
}

function short(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// -----------------------------
// Main Page
// -----------------------------
export default function EscrowPage() {
  
  useEffect(() => {
    document.title = "Vessel Wallet — Escrow";
  }, []);
  // read-only provider (works pre-connect)
  const [readProvider, setReadProvider] = useState<ethers.BrowserProvider | ethers.JsonRpcProvider | null>(null);

  // wallet-bound provider/signer (for writes)
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
  const [linkChain, setLinkChain] = useState<number | null>(null);

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
  const [status, setStatus] = useState({
    priceLocked: false,
    fundedA: false,
    fundedB: false,
    settled: false,
  });
  const [needWBNB, setNeedWBNB] = useState<bigint | null>(null);
  const [needUSDT, setNeedUSDT] = useState<bigint | null>(null);
  const [computing, setComputing] = useState<boolean>(false);
  const [fundingA, setFundingA] = useState<boolean>(false);
  const [fundingB, setFundingB] = useState<boolean>(false);

  // balances
  const [partyAOnchain, setPartyAOnchain] = useState<string>("");
  const [partyBOnchain, setPartyBOnchain] = useState<string>("");
  const [bal, setBal] = useState<{
    A_USDT?: bigint;
    A_WBNB?: bigint;
    A_BNB?: bigint;
    B_USDT?: bigint;
    B_WBNB?: bigint;
    B_BNB?: bigint;
    usdtD?: number;
    wbnbD?: number;
  }>({});

  // ---- NEW: locking state for address fields ----
  const [escrowHasCode, setEscrowHasCode] = useState(false);
  const [overrideAddrs, setOverrideAddrs] = useState(false);

  // read provider init: injected → VITE_READ_RPC/localStorage READ_RPC → localhost
  useEffect(() => { 
    const anyWin = window as any;
    (async () => {
      try {
        if (anyWin?.ethereum) {
          setReadProvider(new ethers.BrowserProvider(anyWin.ethereum)); // no account prompt
          return;
        }
      } catch {}
      const FALLBACK_RPC =
        (import.meta as any)?.env?.VITE_READ_RPC ||
        localStorage.getItem("READ_RPC") ||
        "http://127.0.0.1:8545";
      setReadProvider(new ethers.JsonRpcProvider(FALLBACK_RPC));
    })();
  }, []);

  // helper to get current read runner
  const getRunner = useCallback(() => readProvider ?? provider ?? null, [readProvider, provider]);

  // on-chain code existence check
  const hasCode = useCallback(
    async (addr?: string) => {
      try {
        const run: any = getRunner();
        if (!run || !addr || !ethers.isAddress(addr)) return false;
        const code = await run.getCode(addr);
        return code && code !== "0x";
      } catch {
        return false;
      }
    },
    [getRunner]
  );

  // keep escrowHasCode updated
  useEffect(() => {
    (async () => {
      if (!escrowAddr) return setEscrowHasCode(false);
      setEscrowHasCode(await hasCode(escrowAddr));
    })();
  }, [escrowAddr, hasCode]);

  // role
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
      if (!anyWin.ethereum) {
        setError("MetaMask not found. Please install it.");
        return;
      }
      const prov = new ethers.BrowserProvider(anyWin.ethereum);
      await prov.send("eth_requestAccounts", []);
      const sg = await prov.getSigner();
      const acc = await sg.getAddress();
      const net = await prov.getNetwork();
      setProvider(prov);
      setSigner(sg);
      setAccount(acc);
      setChainId(Number(net.chainId));
      setError("");
      anyWin.ethereum?.on?.("accountsChanged", async () => {
        const s = await prov.getSigner();
        setSigner(s);
        setAccount(await s.getAddress());
      });
      anyWin.ethereum?.on?.("chainChanged", async () => {
        const n = await prov.getNetwork();
        setChainId(Number(n.chainId));
      });
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Failed to connect wallet");
    }
  }, []);

  // instances (write-capable)
  const escrow = useMemo(
    () =>
      signer && escrowAddr && ethers.isAddress(escrowAddr)
        ? new ethers.Contract(escrowAddr, ESCROW_ABI, signer)
        : null,
    [signer, escrowAddr]
  );
  const usdt = useMemo(
    () =>
      signer && usdtAddr && ethers.isAddress(usdtAddr)
        ? new ethers.Contract(usdtAddr, ERC20_ABI, signer)
        : null,
    [signer, usdtAddr]
  );
  const wbnb = useMemo(
    () =>
      signer && wbnbAddr && ethers.isAddress(wbnbAddr)
        ? new ethers.Contract(wbnbAddr, ERC20_ABI, signer)
        : null,
    [signer, wbnbAddr]
  );

  // read-only instances (prefer readProvider; fallback to provider)
  const runner = getRunner();

  const escrowRead = useMemo(
    () =>
      runner && escrowAddr && ethers.isAddress(escrowAddr)
        ? new ethers.Contract(escrowAddr, ESCROW_ABI, runner)
        : null,
    [runner, escrowAddr]
  );

  const feedBNB = useMemo(
    () =>
      runner && bnbUsdFeed && ethers.isAddress(bnbUsdFeed)
        ? new ethers.Contract(bnbUsdFeed, FEED_ABI, runner)
        : null,
    [runner, bnbUsdFeed]
  );

  const feedUSDT = useMemo(
    () =>
      runner && usdtUsdFeed && ethers.isAddress(usdtUsdFeed)
        ? new ethers.Contract(usdtUsdFeed, FEED_ABI, runner)
        : null,
    [runner, usdtUsdFeed]
  );

  const usdtRead = useMemo(
    () =>
      runner && usdtAddr && ethers.isAddress(usdtAddr)
        ? new ethers.Contract(usdtAddr, ERC20_ABI, runner)
        : null,
    [runner, usdtAddr]
  );

  const wbnbRead = useMemo(
    () =>
      runner && wbnbAddr && ethers.isAddress(wbnbAddr)
        ? new ethers.Contract(wbnbAddr, ERC20_ABI, runner)
        : null,
    [runner, wbnbAddr]
  );

  // URL sync
  const syncToURL = useCallback(() => {
    const u = new URL(window.location.href);
    const p = u.searchParams;
    ["escrow", "usdt", "wbnb", "bnbUsdFeed", "usdtUsdFeed", "deal", "chain"].forEach((k) =>
      p.delete(k)
    );
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
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [syncToURL]);

  const resetAll = useCallback(() => {
    const u = new URL(window.location.href);
    u.search = "";
    window.history.replaceState({}, "", u.pathname);
    localStorage.removeItem("escrow-demo:last");
    setEscrowAddr("");
    setUsdtAddr("");
    setWbnbAddr("");
    setBnbUsdFeed("");
    setUsdtUsdFeed("");
    setPartyB("");
    setUsdAmount(20);
    setDeadlineHrs(72);
    setUnwrapToBNB(false);
    setDealId(null);
    setStatus({ priceLocked: false, fundedA: false, fundedB: false, settled: false });
    setNeedWBNB(null);
    setNeedUSDT(null);
    setViewOnly(false);
    setCopied(false);
    setPartyAOnchain("");
    setPartyBOnchain("");
    setBal({});
    setError("");
    setDeadlineTs(null);
    setTimeLeft(null);
    setLinkChain(null);
    setOverrideAddrs(false);
    setEscrowHasCode(false);
  }, []);

  // read query string / localStorage
  useEffect(() => {
    const q = new URL(window.location.href).searchParams;
    const fromStore = localStorage.getItem("escrow-demo:last");
    const ps = q.toString() ? q : fromStore ? new URLSearchParams(fromStore) : null;
    if (!ps) return;
    const e = ps.get("escrow");
    if (e) setEscrowAddr(e);
    const u = ps.get("usdt");
    if (u) setUsdtAddr(u);
    const w = ps.get("wbnb");
    if (w) setWbnbAddr(w);
    const bf = ps.get("bnbUsdFeed");
    if (bf) setBnbUsdFeed(bf);
    const uf = ps.get("usdtUsdFeed");
    if (uf) setUsdtUsdFeed(uf);
    const d = ps.get("deal");
    if (d) {
      setDealId(Number(d));
      setViewOnly(true);
    }
    const c = ps.get("chain");
    if (c && !Number.isNaN(Number(c))) setLinkChain(Number(c));
  }, []);

  useEffect(() => {
    syncToURL();
  }, [syncToURL]);

  // OPTIONAL: auto-load addresses from /addresses.json (Vite public/)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/addresses.json");
        if (!res.ok) return;
        const j = await res.json();
        if (!escrowAddr && j.ESCROW) setEscrowAddr(j.ESCROW);
        if (!usdtAddr && j.USDT) setUsdtAddr(j.USDT);
        if (!wbnbAddr && j.WBNB) setWbnbAddr(j.WBNB);
        if (!bnbUsdFeed && j.BNB_USD) setBnbUsdFeed(j.BNB_USD);
        if (!usdtUsdFeed && j.USDT_USD) setUsdtUsdFeed(j.USDT_USD);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-fill from escrow using READ-ONLY instance, but only if code exists
  const loadFromEscrow = useCallback(async () => {
    if (!escrowAddr || !escrowRead) return;
    if (!(await hasCode(escrowAddr))) {
      console.warn("Escrow address has no code on current RPC:", escrowAddr);
      return;
    }
    try {
      const [usdtA, wbnbA, bnbF, usdtF] = await Promise.all([
        escrowRead.USDT(),
        escrowRead.WBNB(),
        escrowRead.BNB_USD(),
        escrowRead.USDT_USD(),
      ]);
      setUsdtAddr((prev) => prev || usdtA);
      setWbnbAddr((prev) => prev || wbnbA);
      setBnbUsdFeed((prev) => prev || bnbF);
      setUsdtUsdFeed((prev) => prev || usdtF);
    } catch (e: any) {
      console.warn("Auto-fill failed (escrow call):", e?.message || e);
    }
  }, [escrowAddr, escrowRead, hasCode]);

  useEffect(() => {
    loadFromEscrow();
  }, [loadFromEscrow]);

  // initiate
  const onInitiate = useCallback(async () => {
    if (!escrow) {
      setError("Escrow address or signer missing");
      return;
    }
    if (!ethers.isAddress(partyB)) {
      setError("Invalid Party B address");
      return;
    }
    try {
      setCreating(true);
      setError("");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineHrs * 3600);
      const usd8d = E8(usdAmount);
      const tx = await escrow.createDeal(partyB, deadline, usd8d, usd8d, unwrapToBNB);
      await tx.wait();
      let id: number | null = null;
      try {
        const count: bigint = await escrow.getDealsCount();
        id = Number(count - 1n);
      } catch {}
      if (id === null) id = 0;
      setDealId(id);
      setViewOnly(true);
      syncToURL();
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Failed to create deal");
    } finally {
      setCreating(false);
    }
  }, [escrow, partyB, deadlineHrs, usdAmount, unwrapToBNB, syncToURL]);

  // compute (can run with read-only feeds/tokens) + on-chain code checks
  const computeNeeds = useCallback(async () => {
    const feedB = feedBNB;
    const feedU = feedUSDT;
    const tUSDT = usdt ?? usdtRead;
    const tWBNB = wbnb ?? wbnbRead;

    // quick structural checks
    if (!escrowAddr || !feedB || !feedU || !tUSDT || !tWBNB) {
      setError("Paste/auto-fill all 5 addresses first");
      return;
    }

    // on-chain code checks
    if (
      !(await hasCode(escrowAddr)) ||
      !(await hasCode(bnbUsdFeed)) ||
      !(await hasCode(usdtUsdFeed)) ||
      !(await hasCode(usdtAddr)) ||
      !(await hasCode(wbnbAddr))
    ) {
      setError("One or more addresses are not deployed on this RPC/network.");
      return;
    }

    try {
      setComputing(true);
      setError("");
      const [bnbDecs, bnbRound, usdtDecs, uRound, wbnbDecs, usdtTokDecs] = await Promise.all([
        feedB.decimals(),
        feedB.latestRoundData(),
        feedU.decimals(),
        feedU.latestRoundData(),
        tWBNB.decimals(),
        tUSDT.decimals(),
      ]);
      const bnbPrice = toBigInt(bnbRound[1]);
      const uPrice = toBigInt(uRound[1]);
      const priceDecBNB = Number(bnbDecs.toString());
      const priceDecUSDT = Number(usdtDecs.toString());
      const wbnbD = Number(wbnbDecs.toString());
      const usdtD = Number(usdtTokDecs.toString());
      const usd8d = E8(usdAmount);
      const wNeed = usdToToken(usd8d, bnbPrice, priceDecBNB, wbnbD);
      const uNeed = usdToToken(usd8d, uPrice, priceDecUSDT, usdtD);
      setNeedWBNB(wNeed);
      setNeedUSDT(uNeed);
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Failed to compute amounts");
    } finally {
      setComputing(false);
    }
  }, [
    feedBNB,
    feedUSDT,
    usdt,
    usdtRead,
    wbnb,
    wbnbRead,
    usdAmount,
    escrowAddr,
    bnbUsdFeed,
    usdtUsdFeed,
    usdtAddr,
    wbnbAddr,
    hasCode,
  ]);

  // fund
  const fundA = useCallback(async () => {
    if (!escrow || dealId === null || needWBNB === null) {
      setError("Compute amounts first");
      return;
    }
    try {
      setFundingA(true);
      setError("");
      const tx = await escrow.fundA_withBNB(dealId, { value: needWBNB });
      await tx.wait();
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Funding A failed");
    } finally {
      setFundingA(false);
    }
  }, [escrow, dealId, needWBNB]);

  const fundB = useCallback(async () => {
    if (!escrow || !usdt || dealId === null || needUSDT === null) {
      setError("Compute amounts first");
      return;
    }
    try {
      setFundingB(true);
      setError("");
      await (await usdt.approve(escrowAddr, needUSDT)).wait();
      await (await escrow.fundB_withUSDT(dealId)).wait();
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Funding B failed");
    } finally {
      setFundingB(false);
    }
  }, [escrow, usdt, dealId, needUSDT, escrowAddr]);

  // Poll deal (READ-ONLY; captures deadline too)
  useEffect(() => {
    let t: any;
    const tick = async () => {
      if (!escrowRead || dealId === null) return;
      try {
        const d = await escrowRead.deals(dealId);
        setStatus({
          priceLocked: d.priceLocked,
          fundedA: d.fundedA,
          fundedB: d.fundedB,
          settled: d.settled,
        });
        setPartyAOnchain(d.partyA);
        setPartyBOnchain(d.partyB);

        // --- NEW: stop countdown when settled, canceled, or Party B funded early ---
        if (d.settled || d.canceled || d.fundedB) {
          setDeadlineTs(null);
          setTimeLeft(null);
        } else {
          setDeadlineTs(Number(d.deadline));
        }
      } catch {}
    };
    if (dealId !== null) {
      tick();
      t = setInterval(tick, 1200);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [escrowRead, dealId]);

  // read network id (for hint)
  const [readChainId, setReadChainId] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const run: any = getRunner();
        if (!run) return;
        const net = await run.getNetwork();
        setReadChainId(Number(net.chainId));
      } catch {}
    })();
  }, [getRunner]);

  // Live countdown
  useEffect(() => {
    if (deadlineTs === null) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, deadlineTs - now));
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [deadlineTs]);

  // balances (prefer wallet provider, fallback to read-only provider)
  const refreshBalances = useCallback(async () => {
    if (!escrowRead || dealId === null || !(usdt || usdtRead) || !(wbnb || wbnbRead) || !(provider || readProvider)) return;
    const d = await escrowRead.deals(dealId);
    const tUSDT = usdt ?? usdtRead!;
    const tWBNB = wbnb ?? wbnbRead!;
    const p: any = provider ?? readProvider;
    const [usdtD, wbnbD, aUsdt, bUsdt, aW, bW, aBNB, bBNB] = await Promise.all([
      tUSDT.decimals(),
      tWBNB.decimals(),
      tUSDT.balanceOf(d.partyA),
      tUSDT.balanceOf(d.partyB),
      tWBNB.balanceOf(d.partyA),
      tWBNB.balanceOf(d.partyB),
      p.getBalance(d.partyA),
      p.getBalance(d.partyB),
    ]);
    setBal({
      usdtD: Number(usdtD.toString()),
      wbnbD: Number(wbnbD.toString()),
      A_USDT: aUsdt,
      B_USDT: bUsdt,
      A_WBNB: aW,
      B_WBNB: bW,
      A_BNB: aBNB,
      B_BNB: bBNB,
    });
  }, [escrowRead, dealId, usdt, usdtRead, wbnb, wbnbRead, provider, readProvider]);

  useEffect(() => {
    if (status.settled) {
      refreshBalances();
    }
  }, [status.settled, refreshBalances]);

  const connected = !!account && !!provider;
  const onLocal = chainId === 31337 || chainId === 1337;
  const activeStep = !connected ? 1 : dealId === null ? 2 : !status.settled ? 3 : 4;

  // mismatch hint: when link specifies a chain and read RPC is different
  const showReadHint = readChainId !== null && linkChain !== null && readChainId !== linkChain;

  // ---- NEW: compute lock states & reason ----
  const lockEscrow = viewOnly; // when arriving via ?deal=
  const lockDeps = (escrowHasCode && !overrideAddrs) || viewOnly;
  const lockReason = viewOnly
    ? "Deal link — addresses locked for audit"
    : escrowHasCode
    ? "Addresses are derived from the escrow. Unlock to override."
    : "";

  // hide countdown when B funded or settled/canceled
  const showCountdown = !status.fundedB && !status.settled;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ornaments */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0))] opacity-40" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <Header 
          onLocal={onLocal} 
          chainId={chainId} 
          activeStep={activeStep}
          title="Vessel Wallet — Escrow" 
        />

        {showReadHint && (
          <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 px-3 py-2 text-xs">
            Reading from chain {readChainId}, but link targets chain {linkChain}. Set <code>VITE_READ_RPC</code> (or <code>localStorage.READ_RPC</code>) to the correct network RPC for read-only mode.
          </div>
        )}

        <ConnectCard connected={connected} onConnect={connect} account={account} chainId={chainId} onLocal={onLocal} error={error} />

        {dealId !== null && connected && (
          <div className="mt-3">
            <RoleBadge role={role as any} />
          </div>
        )}

        <div className="mt-6 rounded-3xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent">
          <div className="rounded-3xl bg-slate-900/60 backdrop-blur-xl ring-1 ring-white/10 p-6 grid gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Contracts & Feeds</h2>
              <div className="flex items-center gap-2 text-[11px]">
              </div>
            </div>

            <AddressForm
              escrowAddr={escrowAddr}
              setEscrowAddr={setEscrowAddr}
              usdtAddr={usdtAddr}
              setUsdtAddr={setUsdtAddr}
              wbnbAddr={wbnbAddr}
              setWbnbAddr={setWbnbAddr}
              bnbUsdFeed={bnbUsdFeed}
              setBnbUsdFeed={setBnbUsdFeed}
              usdtUsdFeed={usdtUsdFeed}
              setUsdtUsdFeed={setUsdtUsdFeed}
              loadFromEscrow={loadFromEscrow}
              copyShare={copyShare}
              copied={copied}
              escrow={escrowRead || escrow} // enable "Auto-fill" even pre-connect

              // NEW props ↓
              readOnlyEscrow={lockEscrow}
              readOnlyDeps={lockDeps}
              disabledReason={lockReason}
              showLockToggle={escrowHasCode && !viewOnly}
              onUnlock={() => setOverrideAddrs(true)}
              onLock={() => setOverrideAddrs(false)}
            />
            <AbiPanel escrowAddr={escrowAddr} chainId={chainId ?? null} />
            {!viewOnly && (
              <InitiateForm
                partyB={partyB}
                setPartyB={setPartyB}
                usdAmount={usdAmount}
                setUsdAmount={setUsdAmount}
                deadlineHrs={deadlineHrs}
                setDeadlineHrs={setDeadlineHrs}
                unwrapToBNB={unwrapToBNB}
                setUnwrapToBNB={setUnwrapToBNB}
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
                usdt={!!(usdt || usdtRead)}
                wbnb={!!(wbnb || wbnbRead)}
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
                isExpired={timeLeft !== null && timeLeft <= 0}
              />
            </div>

            {dealId !== null && (
              <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-white/10">
                <Chip ok={status.priceLocked} label={status.priceLocked ? "Prices Locked" : "Prices Not Locked"} />
                <Chip ok={status.fundedA} label={status.fundedA ? "A Funded" : "A Not Funded"} />
                <Chip ok={status.fundedB} label={status.fundedB ? "B Funded" : "B Not Funded"} />
                <Chip ok={status.settled} label={status.settled ? "Contract Complete" : "Waiting…"} />
                {showCountdown && <CountdownChip seconds={timeLeft} />}
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

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-3 py-2 text-xs">
                {error}
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              If a button reverts, double-check the 5 addresses and re-run Compute to refresh amounts. Share this page URL with Party B after creating the deal.
            </p>
          </div>
        </div>

        <div className="mt-8 text-[11px] text-slate-500">Copyright VesselWallet 2025</div>
      </div>
    </div>
  );
}

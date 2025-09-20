import * as dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env", override: true, debug: true });

import express from "express";
import { ethers } from "ethers";
import cors from "cors";
import bodyParser from "body-parser";
import escrowAbi from "../frontend/abi/escrow.json";

// ------- ENV & CONFIG -------
const {
  RPC_URL, ESCROW, OPS_PRIVKEY, CHAIN_ID, UI_BASE
} = process.env as Record<string, string>;

const PORT = Number(process.env.PORT || "8787");
const HOST = process.env.HOST || "127.0.0.1";

// ------- APP -------
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "32kb" }));

// ------- PROVIDER / SIGNER / CONTRACT -------
let provider: ethers.JsonRpcProvider;
let ops: ethers.Wallet;
let escrow: ethers.Contract;

// helpers
const isAddr = (a: string) => ethers.isAddress(a);
const E8 = (n: number) => BigInt(Math.round(n * 1e8));

async function hasCode(addr?: string) {
  try {
    if (!addr || !isAddr(addr)) return false;
    const code = await provider.getCode(addr);
    return code && code !== "0x";
  } catch {
    return false;
  }
}

// ------- STARTUP GUARDRAIL (env + bytecode + ABI sanity) -------
(async () => {
  try {
    // Basic env checks
    if (!RPC_URL) throw new Error("Missing RPC_URL in .env");
    if (!OPS_PRIVKEY) throw new Error("Missing OPS_PRIVKEY in .env");
    if (!CHAIN_ID || Number.isNaN(Number(CHAIN_ID))) throw new Error("Missing/invalid CHAIN_ID in .env");
    if (!ESCROW || !isAddr(ESCROW)) throw new Error("Missing/invalid ESCROW in .env");

    provider = new ethers.JsonRpcProvider(RPC_URL, Number(CHAIN_ID));
    ops = new ethers.Wallet(OPS_PRIVKEY, provider);
    escrow = new ethers.Contract(ESCROW, escrowAbi as any, ops);

    console.log("POST /deals uses:");
    console.table({
      RPC_URL,
      CHAIN_ID,
      ESCROW,
      OPS: ops.address
    });

    // Ensure escrow bytecode exists on this RPC
    if (!(await hasCode(ESCROW))) {
      console.error("❌ ESCROW has no code on this RPC. Deploy to this network or fix .env ESCROW.");
      process.exit(1);
    }

    // ABI sanity: make a couple of read calls; they must not throw
    const ro = new ethers.Contract(
      ESCROW,
      [
        "function getDealsCount() view returns (uint256)",
        "function USDT() view returns (address)"
      ],
      provider
    );
    await ro.getDealsCount();
    await ro.USDT();
    console.log("✅ ESCROW bytecode & ABI look good.");

    // Optional: ensure ops wallet is funded (helps avoid silent failures)
    const bal = await provider.getBalance(ops.address);
    if (bal === 0n) {
      console.warn("⚠️  Ops wallet has 0 native balance on this chain; createDeal will fail to send tx.");
    }

    app.listen(PORT, HOST, () =>
      console.log(`Vessel Deal Creator running on http://${HOST}:${PORT}`)
    );
  } catch (e: any) {
    console.error("Fatal startup error:", e?.message || e);
    process.exit(1);
  }
})();

// ------- ROUTES -------
app.get("/health", (_req, res) => res.json({ ok: true, service: "vessel-deal-creator" }));

/**
 * POST /deals
 * body: { partyA, partyB, usdAmount, deadlineHours, unwrapToBNB }
 * returns: { dealId, txHash, linkA, linkB }
 */
app.post("/deals", async (req, res) => {
  console.log("POST /deals hit");
  console.table({ using_ESCROW: ESCROW, rpc: RPC_URL, chain: CHAIN_ID });

  try {
    // Per-request guardrail: ensure ESCROW still has code (env might have changed during dev)
    if (!(await hasCode(ESCROW))) {
      throw new Error("ESCROW has no code on this RPC/network. Check your .env or deploy the contract.");
    }

    const { partyA, partyB, usdAmount, deadlineHours = 72, unwrapToBNB = false } = req.body || {};

    // 1) Basic validation (extend as needed)
    if (!isAddr(partyA) || !isAddr(partyB)) throw new Error("Invalid address");
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) throw new Error("Invalid USD amount");
    if (!Number.isFinite(deadlineHours) || deadlineHours < 1 || deadlineHours > 24 * 14)
      throw new Error("Invalid deadline");

    // 2) Create deal on-chain as Vessel (party A will still fund from their wallet)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineHours * 3600);
    const usd8d = E8(usdAmount);

    // (optional) quick static call check to catch obvious reverts before sending gas
    try {
      await escrow.createDeal.staticCall(partyB, deadline, usd8d, usd8d, unwrapToBNB);
    } catch (err: any) {
      throw new Error(`createDeal would revert: ${err?.reason || err?.shortMessage || "unknown reason"}`);
    }

    const tx = await escrow.createDeal(partyB, deadline, usd8d, usd8d, unwrapToBNB);
    const rc = await tx.wait();

    // 3) Try to fetch id from contract counter (or parse from event if you emit one)
    let dealId = 0;
    try {
      const count: bigint = await escrow.getDealsCount();
      dealId = Number(count - 1n);
    } catch {}

    // 4) Generate share links (pre-filled) for both parties
    const base = (UI_BASE?.replace(/\/$/, "") || "http://localhost:5173");
    const params = new URLSearchParams({
      escrow: ESCROW!,
      deal: String(dealId),
      chain: String(CHAIN_ID)
      // Optionally include usdt/wbnb/feeds if you want full auto-fill:
      // usdt: "...", wbnb: "...", bnbUsdFeed: "...", usdtUsdFeed: "..."
    }).toString();

    const link = `${base}/?${params}`;
    const linkA = link + "#role=A";
    const linkB = link + "#role=B";

    res.json({ dealId, txHash: rc?.hash, linkA, linkB });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e?.message || "Failed to create deal" });
  }
});

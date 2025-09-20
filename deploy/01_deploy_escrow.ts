// deploy/01_deploy_escrow.ts
import { ethers } from "hardhat";

const SIX_HOURS = 6 * 60 * 60; // 21600
const E8 = (n: number) => BigInt(Math.round(n * 1e8));

async function hasCode(addr?: string) {
  if (!addr || !ethers.isAddress(addr)) return false;
  const code = await ethers.provider.getCode(addr);
  return code && code !== "0x";
}

async function ensureMocks(): Promise<{
  WBNB: string; USDT: string; BNB_USD: string; USDT_USD: string;
}> {
  let { WBNB, USDT, BNB_USD, USDT_USD } = process.env as Record<string, string>;

  // If any address is missing or empty on this chain, deploy fresh
  if (!(await hasCode(WBNB))) {
    const w = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
    await w.waitForDeployment(); WBNB = await w.getAddress();
    console.log("Deployed WBNB:", WBNB);
  }
  if (!(await hasCode(USDT))) {
    const u = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD","USDT",18);
    await u.waitForDeployment(); USDT = await u.getAddress();
    // seed signer[1] with USDT so Party B can fund later
    const [,B] = await ethers.getSigners();
    await (await u.mint(B.address, ethers.parseUnits("1000000",18))).wait();
    console.log("Deployed USDT:", USDT, " (minted 1,000,000 to", B.address, ")");
  }
  if (!(await hasCode(BNB_USD))) {
    const f = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(600));
    await f.waitForDeployment(); BNB_USD = await f.getAddress();
    console.log("Deployed BNB_USD feed:", BNB_USD, "(600.00)");
  }
  if (!(await hasCode(USDT_USD))) {
    const f = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));
    await f.waitForDeployment(); USDT_USD = await f.getAddress();
    console.log("Deployed USDT_USD feed:", USDT_USD, "(1.00)");
  }

  return { WBNB, USDT, BNB_USD, USDT_USD };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const { WBNB, USDT, BNB_USD, USDT_USD } = await ensureMocks();

  // constructor: (wbnb, usdt, bnbUsdFeed, usdtUsdFeed, maxPriceAgeSeconds)
  const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
  const escrow = await Escrow.deploy(WBNB, USDT, BNB_USD, USDT_USD, SIX_HOURS);
  await escrow.waitForDeployment();
  const ESCROW = await escrow.getAddress();

  console.log("\n--- Escrow Deployed (local) ---");
  console.log("ESCROW    :", ESCROW);
  console.log("WBNB      :", WBNB);
  console.log("USDT      :", USDT);
  console.log("BNB_USD   :", BNB_USD);
  console.log("USDT_USD  :", USDT_USD);
  console.log("MAX_AGE_S :", SIX_HOURS);
  console.log(`
Next:
  export ESCROW=${ESCROW}
  export WBNB=${WBNB}
  export USDT=${USDT}
  export BNB_USD=${BNB_USD}
  export USDT_USD=${USDT_USD}
  npm run frontend:write
`);
}

main().catch((e) => { console.error(e); process.exit(1); });

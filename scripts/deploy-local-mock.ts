import { ethers } from "hardhat";

const E8 = (n: number) => BigInt(Math.round(n * 1e8));

async function main() {
  const [A, B] = await ethers.getSigners(); // A will be creator by default; B can be your Party B
  console.log("Deployer (A):", A.address);
  console.log("Counterparty (B):", B.address);

  // --- Deploy mocks ---
  const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
  const USDT = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD", "USDT", 18);
  const bnbUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(600)); // $600
  const usdtUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));   // $1

  // Mint USDT to B so they can fund later
  await (await USDT.mint(B.address, ethers.parseUnits("1000", 18))).wait();

  // --- Deploy escrow ---
  const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
  const escrow = await Escrow.deploy(
    await WBNB.getAddress(),
    await USDT.getAddress(),
    await bnbUsd.getAddress(),
    await usdtUsd.getAddress(),
    7 * 24 * 3600 // MAX_PRICE_AGE = 1 hour
  );

  // Print everything you need for the UI
  const out = {
    escrow: await escrow.getAddress(),
    usdt: await USDT.getAddress(),
    wbnb: await WBNB.getAddress(),
    bnbUsdFeed: await bnbUsd.getAddress(),
    usdtUsdFeed: await usdtUsd.getAddress(),
    partyA: A.address,
    partyB: B.address,
  };

  console.log("\n=== Local Deploy (copy these into your UI) ===");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

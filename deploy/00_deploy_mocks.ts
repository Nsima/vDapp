import { ethers } from "hardhat";

const E8 = (n: number) => BigInt(Math.round(n * 1e8)); // scale to 8d

async function main() {
  const [A, B] = await ethers.getSigners();
  console.log("Deployer (A):", A.address);
  console.log("Counterparty (B):", B.address);

  // --- WrappedNativeMock: NO constructor args ---
  const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
  await WBNB.waitForDeployment();

  // --- Mock USDT: (name, symbol, decimals) ---
  const USDT = await (await ethers.getContractFactory("MockERC20Dec"))
    .deploy("Tether USD", "USDT", 18);
  await USDT.waitForDeployment();

  // --- Price feeds: (decimals, answer) ---
  // BNB/USD ~ 600.00 (8 decimals) => 600 * 1e8
  const BNB_USD = await (await ethers.getContractFactory("PriceFeedMock"))
    .deploy(8, E8(600));
  await BNB_USD.waitForDeployment();

  // USDT/USD ~ 1.00
  const USDT_USD = await (await ethers.getContractFactory("PriceFeedMock"))
    .deploy(8, E8(1));
  await USDT_USD.waitForDeployment();

  // --- Seed Party B with some USDT for funding the deal ---
  await (await USDT.mint(B.address, ethers.parseUnits("1000000", 18))).wait();

  console.log("\n--- Mocks deployed (local) ---");
  console.log("WBNB     :", await WBNB.getAddress());
  console.log("USDT     :", await USDT.getAddress());
  console.log("BNB_USD  :", await BNB_USD.getAddress());
  console.log("USDT_USD :", await USDT_USD.getAddress());

  console.log("\nPaste these into your UI’s Contracts & Feeds panel.");
}

main().catch((e) => { console.error(e); process.exit(1); });

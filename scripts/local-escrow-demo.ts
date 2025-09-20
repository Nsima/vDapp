import { ethers } from "hardhat";

// helpers
const E8  = (n: number) => BigInt(Math.round(n * 1e8));
const E18 = (n: string) => ethers.parseUnits(n, 18);
const fmt = (v: bigint, d = 18) => ethers.formatUnits(v, d);

// mirror contract math: tokens = ceil( usd(8d)->priceDecs * 1eTokenDecs / price )
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
function usdToToken(usd8d: bigint, price: bigint, priceDecs: number, tokenDecs: number) {
  const usdScaled =
    priceDecs >= 8
      ? usd8d * 10n ** BigInt(priceDecs - 8)
      : usd8d / 10n ** BigInt(8 - priceDecs);
  const numerator = usdScaled * 10n ** BigInt(tokenDecs);
  return ceilDiv(numerator, price);
}

async function main() {
  // two local signers: “Mr A” & “Mr B”
  const [A, B] = await ethers.getSigners();
  console.log("A:", A.address);
  console.log("B:", B.address);

  // --- Deploy mocks ---
  const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
  const USDT = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD", "USDT", 18);

  // price feeds: BNB/USD = 600, USDT/USD = 1 (8 decimals, like Chainlink)
  const bnbUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(600));
  const usdtUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));

  console.log("WBNB:", await WBNB.getAddress());
  console.log("USDT:", await USDT.getAddress());

  // mint B some USDT so B can fund later
  await (await USDT.mint(B.address, E18("1000"))).wait();
  console.log("Minted 1000 mock USDT to B");

  // --- Deploy escrow ---
  const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
  const escrow = await Escrow.deploy(
    await WBNB.getAddress(),
    await USDT.getAddress(),
    await bnbUsd.getAddress(),
    await usdtUsd.getAddress(),
    3600 // MAX_PRICE_AGE
  );
  const escrowAddr = await escrow.getAddress();
  console.log("Escrow:", escrowAddr);

  // --- Create a $20 <-> $20 deal ---
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3 * 24 * 3600);
  const createRc = await (await escrow.connect(A).createDeal(
    B.address,
    deadline,
    E8(20), // A owes $20 (in BNB/WBNB)
    E8(20), // B owes $20 (in USDT)
    false   // unwrapToBNB? false -> B receives WBNB tokens
  )).wait();
  const id: number = Number(createRc!.logs[0].args.id);
  console.log("Deal id:", id);

  // --- Compute exact amounts using same math as contract ---
  const needWBNB = usdToToken(E8(20), E8(600), 8, 18); // ≈ 0.033333333333333333
  const needUSDT = usdToToken(E8(20), E8(1),   8, 18); // = 20.0
  console.log("Need WBNB:", fmt(needWBNB));
  console.log("Need USDT:", fmt(needUSDT));

  // --- A funds with native (ETH on localhost; we treat it like “BNB”) ---
  await (await escrow.connect(A).fundA_withBNB(id, { value: needWBNB })).wait();
  console.log("A funded with native:", fmt(needWBNB));

  // --- B approves & funds USDT: this auto-settles the deal ---
  await (await USDT.connect(B).approve(escrowAddr, needUSDT)).wait();
  await (await escrow.connect(B).fundB_withUSDT(id)).wait();
  console.log("B funded with USDT; settlement executed.");

  // --- Show final balances ---
  const wbnbErc20 = await ethers.getContractAt("IERC20", await WBNB.getAddress());
  const aUsdt = await USDT.balanceOf(A.address);
  const bWbnb = await wbnbErc20.balanceOf(B.address);

  console.log("A USDT balance +20?:", fmt(aUsdt));
  console.log("B WBNB balance +~0.033333..?:", fmt(bWbnb));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

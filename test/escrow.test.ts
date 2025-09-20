import { expect } from "chai";
import { ethers } from "hardhat";

const E18 = (n: number | bigint) => BigInt(n) * 10n ** 18n;
const E8  = (n: number | bigint) => BigInt(n) * 10n ** 8n;

// ceilDiv for BigInt
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** Mirror contract formula: tokens = ceil( usd(8d)->priceDecs  * 1eTokenDecs / price ) */
function usdToToken(
  usd8d: bigint,
  price: bigint,
  priceDecs: number,
  tokenDecs: number
): bigint {
  const usdScaled =
    priceDecs >= 8
      ? usd8d * 10n ** BigInt(priceDecs - 8)
      : usd8d / 10n ** BigInt(8 - priceDecs);
  const numerator = usdScaled * 10n ** BigInt(tokenDecs);
  return ceilDiv(numerator, price);
}

describe("UsdEscrow_BNB_USDT", () => {
  it("happy path: $20 BNB ↔ $20 USDT, settle to WBNB", async () => {
    const [A, B] = await ethers.getSigners();

    // Deploy mocks
    const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
    const USDT = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD", "USDT", 18);
    const bnbUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(600)); // $600.00
    const usdtUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));  // $1.00

    // Mint USDT to B
    await USDT.mint(B.address, E18(1_000_000));

    // Deploy escrow
    const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
    const escrow = await Escrow.deploy(
      await WBNB.getAddress(),
      await USDT.getAddress(),
      await bnbUsd.getAddress(),
      await usdtUsd.getAddress(),
      3600 // max price age 1h
    );

    // Create $20 <-> $20 deal, no unwrap (B receives WBNB to avoid gas math in assertions)
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const tx = await escrow.connect(A).createDeal(
      B.address,
      BigInt(now + 3 * 24 * 3600),
      E8(20), // usdA
      E8(20), // usdB
      false   // unwrapToBNB
    );
    const rc = await tx.wait();
    const id = Number(rc?.logs?.[0]?.args?.id ?? 0);

    // Compute required amounts (what contract will require once it locks price)
    const needWBNB = usdToToken(E8(20), E8(600), 8, 18); // ≈ 0.033333333333333333 WBNB
    const needUSDT = usdToToken(E8(20), E8(1),   8, 18); // = 20 USDT

    // A funds with native BNB (contract wraps to WBNB)
    await expect(escrow.connect(A).fundA_withBNB(id, { value: needWBNB }))
      .to.emit(escrow, "FundedA");

    // B approves & funds with USDT — triggers auto-settlement
    await USDT.connect(B).approve(await escrow.getAddress(), needUSDT);
    await expect(escrow.connect(B).fundB_withUSDT(id))
      .to.emit(escrow, "Settled");

    // Assertions: A received USDT, B received WBNB
    expect(await USDT.balanceOf(A.address)).to.equal(needUSDT);
    expect(await USDT.balanceOf(await escrow.getAddress())).to.equal(0n);

    const WBNB_erc20 = await ethers.getContractAt("IERC20", await WBNB.getAddress());
    expect(await WBNB_erc20.balanceOf(B.address)).to.equal(needWBNB);
    expect(await WBNB_erc20.balanceOf(await escrow.getAddress())).to.equal(0n);
  });

  it("cancel before B funds refunds A", async () => {
    const [A, B] = await ethers.getSigners();
    const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
    const USDT = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD", "USDT", 18);
    const bnbUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(500));
    const usdtUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));

    const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
    const escrow = await Escrow.deploy(
      await WBNB.getAddress(), await USDT.getAddress(),
      await bnbUsd.getAddress(), await usdtUsd.getAddress(),
      3600
    );

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const id = Number((await (await escrow.connect(A).createDeal(B.address, BigInt(now + 3600), E8(20), E8(20), false)).wait())!.logs[0].args.id);

    const needWBNB = usdToToken(E8(20), E8(500), 8, 18);
    await escrow.connect(A).fundA_withBNB(id, { value: needWBNB });

    // A cancels (B hasn't funded)
    await expect(escrow.connect(A).cancel(id)).to.emit(escrow, "Canceled");

    // A's WBNB refunded to A (as WBNB tokens)
    const WBNB_erc20 = await ethers.getContractAt("IERC20", await WBNB.getAddress());
    expect(await WBNB_erc20.balanceOf(A.address)).to.equal(needWBNB);
  });

  it("refundIfExpired after deadline", async () => {
    const [A, B] = await ethers.getSigners();
    const WBNB = await (await ethers.getContractFactory("WrappedNativeMock")).deploy();
    const USDT = await (await ethers.getContractFactory("MockERC20Dec")).deploy("Tether USD", "USDT", 18);
    const bnbUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(400));
    const usdtUsd = await (await ethers.getContractFactory("PriceFeedMock")).deploy(8, E8(1));

    const Escrow = await ethers.getContractFactory("UsdEscrow_BNB_USDT");
    const escrow = await Escrow.deploy(
      await WBNB.getAddress(), await USDT.getAddress(),
      await bnbUsd.getAddress(), await usdtUsd.getAddress(),
      3600
    );

    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const id = Number((await (await escrow.connect(A).createDeal(B.address, BigInt(now + 60), E8(20), E8(20), false)).wait())!.logs[0].args.id);

    const needWBNB = usdToToken(E8(20), E8(400), 8, 18);
    await escrow.connect(A).fundA_withBNB(id, { value: needWBNB });

    // jump past deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine", []);

    await expect(escrow.refundIfExpired(id)).to.emit(escrow, "Refunded");

    const WBNB_erc20 = await ethers.getContractAt("IERC20", await WBNB.getAddress());
    expect(await WBNB_erc20.balanceOf(A.address)).to.equal(needWBNB);
  });
});

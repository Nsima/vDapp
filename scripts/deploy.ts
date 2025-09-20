import { ethers, network } from "hardhat";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Network:", network.name);

  // ---------- Tokens ----------
  const FakeToken = await ethers.getContractFactory("FakeToken");
  const coll = await FakeToken.deploy("Collateral Token", "COL", ethers.parseEther("2000000"));
  await coll.waitForDeployment();
  const stable = await FakeToken.deploy("Stable Token", "USD", ethers.parseEther("4000000"));
  await stable.waitForDeployment();

  const collAddr = await coll.getAddress();
  const stableAddr = await stable.getAddress();
  console.log(`✅ COL @ ${collAddr}`);
  console.log(`✅ USD @ ${stableAddr}`);

  // ---------- AMM ----------
  const AMM = await ethers.getContractFactory("SimpleAMM");
  const amm = await AMM.deploy(collAddr, stableAddr);
  await amm.waitForDeployment();
  const ammAddr = await amm.getAddress();
  console.log(`✅ SimpleAMM @ ${ammAddr}`);

  // Seed liquidity (1,000,000 COL & 1,000,000 USD for a 1:1 starting price)
  const liq = ethers.parseEther("1000000");
  await (await coll.approve(ammAddr, liq)).wait();
  await (await stable.approve(ammAddr, liq)).wait();
  await (await (amm as any).addLiquidity(liq, liq)).wait();
  console.log("💧 AMM liquidity added: 1,000,000 COL / 1,000,000 USD");

  // ---------- Aave-style pool ----------
  const Pool = await ethers.getContractFactory("MockLendingPool");
  const pool = await Pool.deploy();
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`✅ MockLendingPool @ ${poolAddr}`);

  // Fund pool with USD so it can flash-loan in USD
  const poolFunding = ethers.parseEther("1500000");
  await (await stable.transfer(poolAddr, poolFunding)).wait();
  console.log(`💰 Pool funded with ${ethers.formatEther(poolFunding)} USD`);

  // ---------- Vulnerable lending protocol (uses AMM spot price) ----------
  const Proto = await ethers.getContractFactory("VulnerableLendingProtocolOracle");
  const protocol = await Proto.deploy(collAddr, stableAddr, ammAddr);
  await protocol.waitForDeployment();
  const protocolAddr = await protocol.getAddress();
  console.log(`✅ VulnerableLendingProtocolOracle @ ${protocolAddr}`);

  // Protocol needs USD to lend (treasury / liquidity)
  const protoFunding = ethers.parseEther("3000000");
  await (await stable.transfer(protocolAddr, protoFunding)).wait();
  console.log(`🏦 Protocol funded with ${ethers.formatEther(protoFunding)} USD`);

  // ---------- Attacker ----------
  const Attacker = await ethers.getContractFactory("PriceManipulationAttacker");
  const attacker = await Attacker.deploy(poolAddr, ammAddr, protocolAddr, collAddr, stableAddr);
  await attacker.waitForDeployment();
  const attackerAddr = await attacker.getAddress();
  console.log(`⚔️ PriceManipulationAttacker @ ${attackerAddr}`);

  // ---------- Save ----------
  const outDir = path.join(process.cwd(), "deployments");
  await fs.mkdir(outDir, { recursive: true });
  const outfile = path.join(outDir, `${network.name}-oracle.json`);
  const latest = path.join(outDir, `latest-oracle.json`);
  const addrs = {
    coll: collAddr,
    usd: stableAddr,
    amm: ammAddr,
    pool: poolAddr,
    protocol: protocolAddr,
    attacker: attackerAddr,
  };
  await fs.writeFile(outfile, JSON.stringify(addrs, null, 2));
  await fs.writeFile(latest, JSON.stringify({ network: network.name, ...addrs }, null, 2));
  console.log(`\n📝 Saved:\n - ${outfile}\n - ${latest}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

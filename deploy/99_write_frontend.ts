// deploy/99_write_frontend.ts
import { artifacts, ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. export it first.`);
  return v;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const chain = Number(network.chainId);

  const ESCROW   = need("ESCROW");
  const USDT     = need("USDT");
  const WBNB     = need("WBNB");
  const BNB_USD  = need("BNB_USD");
  const USDT_USD = need("USDT_USD");

  const outDir = resolve(__dirname, "../frontend");
  const abiDir = resolve(outDir, "abi");
  mkdirSync(outDir, { recursive: true });
  mkdirSync(abiDir, { recursive: true });

  // ABIs
  const escrowAbi = (await artifacts.readArtifact("UsdEscrow_BNB_USDT")).abi;
  const erc20Abi  = (await artifacts.readArtifact("MockERC20Dec")).abi;
  const feedAbi   = (await artifacts.readArtifact("PriceFeedMock")).abi;

  writeFileSync(
    resolve(outDir, "addresses.local.json"),
    JSON.stringify({ chain, ESCROW, USDT, WBNB, BNB_USD, USDT_USD }, null, 2)
  );
  writeFileSync(resolve(abiDir, "escrow.json"), JSON.stringify(escrowAbi, null, 2));
  writeFileSync(resolve(abiDir, "erc20.json"),  JSON.stringify(erc20Abi,  null, 2));
  writeFileSync(resolve(abiDir, "feed.json"),   JSON.stringify(feedAbi,   null, 2));

  console.log("Wrote:");
  console.log(" - frontend/addresses.local.json");
  console.log(" - frontend/abi/{escrow.json,erc20.json,feed.json}");
}

main().catch((e) => { console.error(e); process.exit(1); });

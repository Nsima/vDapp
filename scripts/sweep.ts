// npx hardhat run scripts/sweep.ts --network localhost
import { ethers } from "hardhat";
import * as fs from "fs/promises";
import * as path from "path";

type DeployedAddresses = {
  token: string;
  pool: string;
  target: string;
  attacker: string;
  network?: string;
};

async function loadAddresses(): Promise<DeployedAddresses> {
  const p = path.join(process.cwd(), "deployments", "latest.json");
  const raw = await fs.readFile(p, "utf8");
  const j = JSON.parse(raw);
  for (const k of ["token", "pool", "target", "attacker"]) {
    if (!j[k]) throw new Error(`Missing '${k}' in ${p}`);
  }
  return j;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const me = signer.address;

  const addrs = await loadAddresses();
  const token = await ethers.getContractAt("FakeToken", addrs.token);
  const attacker = await ethers.getContractAt("AttackerContract", addrs.attacker);

  const before = await token.balanceOf(me);
  await (await attacker.sweep(me)).wait();
  const after = await token.balanceOf(me);

  console.log("Swept profit to:", me);
  console.log("Before:", ethers.formatEther(before), "TST");
  console.log("After: ", ethers.formatEther(after),  "TST");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

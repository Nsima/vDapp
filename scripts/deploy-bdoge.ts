import { ethers } from "hardhat";

async function main() {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get the contract factory
  const BabyDoge = await ethers.getContractFactory("BabyDoge");

  // Deploy the contract
  console.log("Deploying BabyDoge contract...");
  const babyDoge = await BabyDoge.deploy();

  // Wait for the contract to be mined (fully deployed)
  await babyDoge.deployed();

  // Log the contract address
  console.log("BabyDoge contract deployed to:", babyDoge.address);
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    process.exit(1);
  });

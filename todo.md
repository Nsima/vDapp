# 🧪 Flash Loan Exploit Simulation – Local Environment (Hardhat)

## ✅ TO-DO LIST: Simulate a Flash Loan + MEV Exploit Locally (PancakeBunny-style)

---

### 🔧 1. Setup the Development Environment

- [x] Install Node.js and npm (if not already installed)
- [x] Install Hardhat globally (or use `npx`)
  ```bash
  npm install --save-dev hardhat
  ```
- [x] Initialize a Hardhat project
  ```bash
  npx hardhat
  # Choose "Create a basic sample project"
  ```
- [x] Install required dependencies
  ```bash
  npm install @nomicfoundation/hardhat-toolbox dotenv
  ```

---

### 🧱 2. Build the Core Contracts
Directory: `contracts/`

- [x] `FakeToken.sol`: Simple ERC-20 token (e.g., `WETH`, `USDT`)
- [x] `MockLendingPool.sol`: Allows flash loan execution (mock Aave or Uniswap)
- [x] `VulnerableDeFiProtocol.sol`: Fake DeFi contract that is price-manipulatable
- [x] `AttackerContract.sol`: Exploit contract that:
  - Takes flash loan
  - Manipulates price
  - Exploits logic
  - Pays loan
  - Keeps profit

---

### 🧪 3. Write Deployment & Exploit Scripts
Directory: `scripts/`

- [x] `deploy.ts`: Deploy all contracts to the local Hardhat network
- [x] `run-exploit.ts`: Simulate the full exploit (flash loan + manipulation + bribe)

---

### 🔁 4. Execute the Simulation

- [x] Run local Hardhat node:
  ```bash
  npx hardhat node
  ```
- [x] Deploy contracts to local network:
  ```bash
  npx hardhat run scripts/deploy.js --network localhost
  ```
- [x] Run exploit:
  ```bash
  npx hardhat run scripts/run-exploit.js --network localhost
  ```

---

### ⚡ 5. Optional: Simulate MEV (Miner Bribe & Ordering)

- [ ] Manually simulate transaction ordering:
  - Make a victim transaction go first
  - Follow it with your exploit transaction
- [ ] Simulate a bribe by sending ETH to the miner (use `block.coinbase`)
  ```solidity
  payable(block.coinbase).transfer(1 ether);
  ```
- [ ] OR simulate Flashbots-style private tx using a script with controlled bundling

---

### 📊 6. Analyze and Learn

- [ ] Print balances of:
  - Attacker
  - Lending pool
  - DeFi protocol
- [ ] Validate exploit success: attacker ends up with more tokens
- [ ] Trace all internal transactions and logs

---

### 🧹 7. Clean Up and Document

- [ ] Comment every line of smart contracts and scripts
- [ ] Write README explaining the simulation
- [ ] Optionally: simulate similar exploits with new rules (e.g., oracle manipulation, reentrancy)

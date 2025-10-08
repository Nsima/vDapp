# 🧪 Flash Loan Exploit Simulation – Local Environment (Hardhat)

## ✅ TO-DO LIST: Simulate a Flash Loan + MEV Exploit Locally (PancakeBunny-style)

---

### 🔧 1. Setup the Development Environment (Pinned + TypeScript)

- [ ] Install Node.js and npm (nvm recommended)
- [ ] Initialize a Hardhat project
  ```bash
  npx hardhat
  # Choose "Create a TypeScript project"
  ```
- [ ] Install **pinned** dependencies (prevents toolchain drift)
  ```bash
  npm i -D hardhat@^2.22.9 @nomicfoundation/hardhat-toolbox@^5     ethers@^6.13.2 hardhat-deploy@^0.12.6 hardhat-tracer@^3.2.0     ts-node typescript @types/node dotenv@^16.4.5
  ```
- [ ] Create `.env` (RPCs/keys if needed later), add to `.gitignore`
- [ ] Smoke test the toolchain
  ```bash
  npx hardhat compile
  npx hardhat test           # will compile even if there are no tests yet
  ```

---

### 🧱 2. Build the Core Contracts

Directory: `contracts/`

- [ ] `FakeToken.sol` – Simple ERC‑20 (e.g., WETH/USDT test token)
- [ ] `MockAMM.sol` – Minimal xy=k pool for `FakeToken/WETH` (adds liquidity + swap)
- [ ] `BrokenOracle.sol` – Reads spot from `MockAMM` (no TWAP/liquidity checks)
- [ ] `MockLendingPool.sol` – Simple flash loan provider with Aave‑like callback
  ```solidity
  interface IFlashLoanReceiver {
    function executeOperation(address asset, uint256 amount, uint256 fee, bytes calldata params)
      external
      returns (bool);
  }
  ```
- [ ] `VulnerableDeFiProtocol.sol` – Trusts `BrokenOracle` for pricing (target)
- [ ] `AttackerContract.sol` – Orchestrates: take loan → manipulate price → exploit → repay → profit

> Tip: keep constructor args as addresses and **emit** them on deploy for easy tracing.

---

### 🧪 3. Write Deployment & Exploit Scripts (TypeScript)

Directory: `scripts/`

- [ ] `deploy.ts` – Deploy tokens, AMM, oracle, lending pool, target, attacker
  - [ ] Seed AMM liquidity (balanced reserves) and mint initial balances
  - [ ] Log **all deployed addresses** and save them (hardhat‑deploy `deployments/` or a JSON file)
- [ ] `run-exploit.ts` – Full scenario runner
  - [ ] **Never hardcode** addresses; read from artifacts/JSON
  - [ ] Validate with `ethers.isAddress(addr)` before each use
  - [ ] Print pre‑state (balances, oracle price)
  - [ ] Execute exploit (see MEV section for ordering controls)
  - [ ] Print post‑state, compute P&L and gas

---

### 🔁 4. Execute the Simulation

- [ ] Add handy npm scripts in `package.json`
  ```json
  {
    "scripts": {
      "node": "hardhat node",
      "deploy:local": "hardhat run scripts/deploy.ts --network localhost",
      "exploit:local": "hardhat run scripts/run-exploit.ts --network localhost",
      "trace": "HARDHAT_TRACER=1 hardhat test test/exploit.spec.ts"
    }
  }
  ```

- [ ] Run:
  ```bash
  npm run node
  # in a new terminal
  npm run deploy:local
  npm run exploit:local
  ```

---

### ⚡ 5. Optional: Simulate MEV (Miner/Builder Preference & Ordering)

- [ ] Deterministic ordering via Hardhat mining controls
  ```ts
  import { network, ethers } from "hardhat";
  const GWEI = 1_000_000_000n;

  await network.provider.send("evm_setAutomine", [false]);

  // 1) Victim (or target-trigger) tx
  const v = await target.connect(user).doSomething(/* ... */);

  // 2) Attacker tx (optionally higher priority fee)
  const a = await attacker.exploit(ethers.parseUnits("100000", 18), {
    maxPriorityFeePerGas: 2n * GWEI
  });

  // Mine both together (exact ordering submitted them)
  await network.provider.send("evm_mine");
  await network.provider.send("evm_setAutomine", [true]);
  ```

- [ ] Simulate a **bribe** (coinbase tip) from attacker
  ```solidity
  payable(block.coinbase).transfer(1 ether);
  ```

- [ ] (Optional) Emulate “private tx” behavior by skipping mempool assumptions and
      batching txs as above; focus on end‑of‑block ordering and state deltas.

---

### 📊 6. Analyze and Learn (Assertions > Prints)

- [ ] Write `test/exploit.spec.ts` with **assertions**:
  - [ ] Initial oracle price equals expected AMM quote
  - [ ] Attacker profit ≥ threshold
  - [ ] Lending pool repaid principal + fee
  - [ ] Protocol’s accounting moved unfavorably (or collateral mispriced)
- [ ] Compute **PnL** and **gas cost**:
  - Token profit (attacker balances pre/post)
  - Gas = Σ(`gasUsed * effectiveGasPrice`) over attacker calls
- [ ] Use `hardhat-tracer` to print a call trace of the exploit block

---

### 🧹 7. Clean Up and Document

- [ ] Add an **architecture diagram** (Pool ↔ AMM ↔ Oracle ↔ Protocol ↔ Attacker)
- [ ] A short **Runbook** with exact commands and expected key outputs (prices, balances)
- [ ] README notes on why the oracle/AMM setup is unsafe (no TWAP, thin liquidity)
- [ ] (Optional) Extend: reentrancy variant, TWAP‑resistant oracle, collateral caps

---

## 📁 Suggested Directory Structure

```
contracts/
  FakeToken.sol
  MockAMM.sol
  BrokenOracle.sol
  MockLendingPool.sol
  VulnerableDeFiProtocol.sol
  AttackerContract.sol

scripts/
  deploy.ts
  run-exploit.ts

test/
  exploit.spec.ts

hardhat.config.ts
.env
```

---

## 🧩 Minimal Code Stubs (for reference)

**`AttackerContract.sol` (shape)**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IFlashLoanReceiver {
  function executeOperation(address asset, uint256 amount, uint256 fee, bytes calldata params) external returns (bool);
}

interface IERC20 { function approve(address, uint256) external returns (bool); }

contract AttackerContract is IFlashLoanReceiver {
  address public immutable token;
  address public immutable amm;
  address public immutable oracle;
  address public immutable target;
  address public immutable pool;

  constructor(address _t, address _amm, address _o, address _v, address _p) {
    token = _t; amm = _amm; oracle = _o; target = _v; pool = _p;
  }

  function exploit(uint256 amount) external payable {
    // request flash loan; pool will call executeOperation
    (bool ok, ) = pool.call(abi.encodeWithSignature(
      "flashLoan(address,address,uint256,bytes)",
      address(this), token, amount, ""
    ));
    require(ok, "flashLoan failed");
  }

  function executeOperation(address asset, uint256 amount, uint256 fee, bytes calldata) external returns (bool) {
    // 1) manipulate AMM price
    // 2) call vulnerable protocol using inflated oracle price
    // 3) unwind if needed
    // 4) repay loan + fee
    IERC20(asset).approve(pool, amount + fee);
    // Optional miner tip for MEV simulation
    payable(block.coinbase).transfer(1 ether);
    return true;
  }

  receive() external payable {}
}
```

**Mining control snippet for `run-exploit.ts`**
```ts
await network.provider.send("evm_setAutomine", [false]);
const t1 = await victimTx();
const t2 = await attacker.exploit(loanAmount, { maxPriorityFeePerGas: ethers.parseUnits("2", "gwei") });
await network.provider.send("evm_mine");
await network.provider.send("evm_setAutomine", [true]);
```

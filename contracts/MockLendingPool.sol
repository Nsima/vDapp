// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Aave v3-style flash borrower interface (simplified)
interface IAaveFlashBorrowerSimple {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract MockLendingPool {
    // ---- Config ----
    address public owner;
    uint256 public premiumBps = 9; // 9 bps ~ 0.09% (Aave-like default)

    // ---- Simple nonReentrant guard ----
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ---- Events ----
    event FlashLoanSimple(
        address indexed receiver,
        address indexed asset,
        uint256 amount,
        uint256 premium,
        address indexed initiator
    );

    event Funded(address indexed asset, uint256 amount, address indexed from);
    event PremiumUpdated(uint256 oldBps, uint256 newBps);

    constructor() {
        owner = msg.sender;
    }

    // ---- Admin ----
    function setPremiumBps(uint256 newBps) external {
        require(msg.sender == owner, "ONLY_OWNER");
        require(newBps <= 1000, "PREMIUM_TOO_HIGH"); // <= 10% sanity cap
        emit PremiumUpdated(premiumBps, newBps);
        premiumBps = newBps;
    }

    /// @notice Fund the pool with liquidity (uses transferFrom)
    function fund(address asset, uint256 amount) external {
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "FUND_TRANSFER_FAIL");
        emit Funded(asset, amount, msg.sender);
    }

    /// @notice Aave v3-style `flashLoanSimple`
    function flashLoanSimple(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external nonReentrant {
        require(receiver != address(0), "INVALID_RECEIVER");
        require(asset != address(0), "INVALID_ASSET");
        require(amount > 0, "INVALID_AMOUNT");

        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
        require(balanceBefore >= amount, "INSUFFICIENT_LIQUIDITY");

        uint256 premium = (amount * premiumBps) / 10_000;

        // 1) Send funds to the receiver
        require(IERC20(asset).transfer(receiver, amount), "TRANSFER_OUT_FAIL");

        // 2) Callback to receiver
        bool ok = IAaveFlashBorrowerSimple(receiver).executeOperation(
            asset,
            amount,
            premium,
            msg.sender, // initiator (the caller)
            params
        );
        require(ok, "EXECUTE_OPERATION_FAILED");

        // 3) Pull back amount + premium (receiver must have approved this pool)
        uint256 totalOwed = amount + premium;
        require(
            IERC20(asset).transferFrom(receiver, address(this), totalOwed),
            "REPAY_TRANSFER_FROM_FAIL"
        );

        // 4) Invariant: pool should grow by premium
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        require(balanceAfter >= balanceBefore + premium, "BAD_REPAYMENT");

        emit FlashLoanSimple(receiver, asset, amount, premium, msg.sender);
    }
}

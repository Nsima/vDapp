// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISimpleAMM {
    function getSpotPrice(address base, address quote) external view returns (uint256 price1e18);
}

contract VulnerableLendingProtocolOracle {
    IERC20 public immutable coll;   // collateral (COL)
    IERC20 public immutable stable; // debt asset (USD)
    ISimpleAMM public immutable amm;

    // Borrow up to 80% LTV (in USD terms)
    uint256 public constant LTV_BPS = 8000; // 80.00%
    uint256 public constant BPS_DENOM = 10_000;

    mapping(address => uint256) public collateralOf; // amount of COL
    mapping(address => uint256) public debtOf;       // amount of USD borrowed

    constructor(address _coll, address _stable, address _amm) {
        coll = IERC20(_coll);
        stable = IERC20(_stable);
        amm = ISimpleAMM(_amm);
    }

    // -------- Deposit & Borrow --------

    function depositCollateral(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(coll.transferFrom(msg.sender, address(this), amount), "COLL_XFER_FAIL");
        collateralOf[msg.sender] += amount;
    }

    function _collPriceUSD() internal view returns (uint256 price1e18) {
        // VULNERABLE: uses spot price from a single AMM in the same block.
        // This is manipulable with a large swap (flash-loan powered).
        return amm.getSpotPrice(address(coll), address(stable));
    }

    function maxBorrowableUSD(address user) public view returns (uint256) {
        uint256 price = _collPriceUSD(); // 1e18
        uint256 cAmt  = collateralOf[user];
        uint256 cVal  = (cAmt * price) / 1e18;              // collateral value in USD
        uint256 cap   = (cVal * LTV_BPS) / BPS_DENOM;       // 80% of value
        if (cap <= debtOf[user]) return 0;
        return cap - debtOf[user];
    }

    function borrow(uint256 amountUSD) external {
        require(amountUSD > 0, "ZERO_AMOUNT");
        uint256 limit = maxBorrowableUSD(msg.sender);
        require(amountUSD <= limit, "EXCEEDS_LIMIT");
        debtOf[msg.sender] += amountUSD;
        require(stable.transfer(msg.sender, amountUSD), "STABLE_XFER_FAIL");
    }

    // -------- View helpers --------
    function accountData(address user) external view returns (
        uint256 collAmt,
        uint256 priceUSD_1e18,
        uint256 collValueUSD,
        uint256 debtUSD,
        uint256 borrowableUSD
    ) {
        collAmt = collateralOf[user];
        priceUSD_1e18 = _collPriceUSD();
        collValueUSD = (collAmt * priceUSD_1e18) / 1e18;
        debtUSD = debtOf[user];
        borrowableUSD = maxBorrowableUSD(user);
    }
}

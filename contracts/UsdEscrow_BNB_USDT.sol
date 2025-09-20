// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * USD escrow: $X of BNB (via WBNB) from A  <->  $Y of USDT from B
 * - First fund locks oracle prices; both sides then deposit exact token amounts.
 * - When both funded, settlement auto-cross-delivers (A gets USDT, B gets BNB/WBNB).
 * - A may fund with native BNB (contract wraps to WBNB) or with WBNB via allowance.
 * - Optional unwrap to native BNB for B on payout.
 *
 * Constructor expects:
 *  - wbnb (IWBNB)
 *  - usdt (IERC20)
 *  - feeds: bnbUsd, usdtUsd (Chainlink AggregatorV3Interface)
 *  - maxPriceAge seconds (staleness guard, e.g., 1 hours)
 *
 * Notes:
 *  - USDT on BSC is ERC20 but decimals may be 18 (often) — we read decimals dynamically.
 *  - Set feed addresses for BSC mainnet/testnet as appropriate.
 */

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    function decimals() external view returns (uint8);
}

interface IWBNB {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transfer(address to, uint256 value) external returns (bool);
}

contract UsdEscrow_BNB_USDT is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Immutable configuration
    IWBNB public immutable WBNB;
    IERC20 public immutable USDT;
    AggregatorV3Interface public immutable BNB_USD;   // BNB/USD price (8d typical)
    AggregatorV3Interface public immutable USDT_USD;  // USDT/USD price (≈1.00)
    uint256 public immutable MAX_PRICE_AGE;           // e.g., 3600 seconds

    uint8 private immutable _wbnbDecimals;
    uint8 private immutable _usdtDecimals;
    uint8 private immutable _bnbUsdDecimals;   // chainlink feed decimals
    uint8 private immutable _usdtUsdDecimals;  // chainlink feed decimals

    constructor(
        address wbnb,
        address usdt,
        address bnbUsdFeed,
        address usdtUsdFeed,
        uint256 maxPriceAgeSeconds
    ) {
        require(wbnb != address(0) && usdt != address(0), "bad token");
        require(bnbUsdFeed != address(0) && usdtUsdFeed != address(0), "bad feed");
        require(maxPriceAgeSeconds > 0, "bad age");

        WBNB = IWBNB(wbnb);
        USDT = IERC20Metadata(usdt);
        BNB_USD = AggregatorV3Interface(bnbUsdFeed);
        USDT_USD = AggregatorV3Interface(usdtUsdFeed);
        MAX_PRICE_AGE = maxPriceAgeSeconds;

        // decimals
        _wbnbDecimals    = IERC20Metadata(wbnb).decimals();
        _usdtDecimals    = IERC20Metadata(usdt).decimals();
        _bnbUsdDecimals  = BNB_USD.decimals();
        _usdtUsdDecimals = USDT_USD.decimals();
    }

    struct Deal {
        address partyA;          // sends BNB/WBNB, receives USDT
        address partyB;          // sends USDT, receives BNB/WBNB
        uint64  deadline;        // unix time; refunds allowed after if incomplete
        bool    unwrapToBNB;     // if true, B receives native BNB on settle

        // USD intents (8d by convention; we normalize to the feed's decimals on the fly)
        uint96  usdA_8d;         // e.g., $20 => 2_000_000_000
        uint96  usdB_8d;         // typically same as usdA_8d

        // Oracle snapshot (locked at first funding)
        bool    priceLocked;
        uint64  priceTime;       // snapshot time
        uint128 bnbUsd;          // feed-scaled
        uint128 usdtUsd;         // feed-scaled

        // Required token amounts (computed at price lock)
        uint256 needWBNB;        // amount A must fund (in WBNB units)
        uint256 needUSDT;        // amount B must fund

        // Funding flags
        bool    fundedA;
        bool    fundedB;

        bool    settled;
        bool    canceled;
    }

    Deal[] public deals;

    event DealCreated(uint256 indexed id, address indexed A, address indexed B, uint256 usdA_8d, uint256 usdB_8d, uint64 deadline, bool unwrapToBNB);
    event PricesLocked(uint256 indexed id, uint256 bnbUsd, uint256 usdtUsd, uint64 at);
    event FundedA(uint256 indexed id, address indexed A, uint256 amountWBNB, bool viaNativeBNB);
    event FundedB(uint256 indexed id, address indexed B, uint256 amountUSDT);
    event Settled(uint256 indexed id, uint256 paidToA_USDT, uint256 paidToB_WBNB);
    event Refunded(uint256 indexed id, address indexed to, uint256 amount);
    event Canceled(uint256 indexed id);

    // ------------------------
    // Create
    // ------------------------
    function createDeal(
        address partyB,
        uint64  deadline,
        uint96  usdA_8d,     // $ for A->B (BNB side), with 8 decimals
        uint96  usdB_8d,     // $ for B->A (USDT side)
        bool    unwrapToBNB  // if true, B will receive native BNB
    ) external returns (uint256 id) {
        require(partyB != address(0), "partyB=0");
        require(usdA_8d > 0 && usdB_8d > 0, "bad usd");
        require(deadline > block.timestamp, "deadline past");

        deals.push(Deal({
            partyA: msg.sender,
            partyB: partyB,
            deadline: deadline,
            unwrapToBNB: unwrapToBNB,
            usdA_8d: usdA_8d,
            usdB_8d: usdB_8d,
            priceLocked: false,
            priceTime: 0,
            bnbUsd: 0,
            usdtUsd: 0,
            needWBNB: 0,
            needUSDT: 0,
            fundedA: false,
            fundedB: false,
            settled: false,
            canceled: false
        }));
        id = deals.length - 1;
        emit DealCreated(id, msg.sender, partyB, usdA_8d, usdB_8d, deadline, unwrapToBNB);
    }

    function getDealsCount() external view returns (uint256) { return deals.length; }

    // ------------------------
    // Funding (A: BNB/WBNB, B: USDT)
    // ------------------------

    // A funds with native BNB; contract wraps to WBNB
    function fundA_withBNB(uint256 id) external payable nonReentrant {
        Deal storage d = _openDealOf(id);
        require(msg.sender == d.partyA, "not A");
        require(!d.fundedA, "A funded");
        _ensurePricesLockedAndTargets(d);

        require(msg.value == d.needWBNB, "wrong BNB amount");
        WBNB.deposit{value: msg.value}(); // mints WBNB to this contract
        d.fundedA = true;
        emit FundedA(id, msg.sender, msg.value, true);

        if (d.fundedB) { _settle(d, id); }
    }

    // A funds with WBNB via allowance
    function fundA_withWBNB(uint256 id) external nonReentrant {
        Deal storage d = _openDealOf(id);
        require(msg.sender == d.partyA, "not A");
        require(!d.fundedA, "A funded");
        _ensurePricesLockedAndTargets(d);

        uint256 beforeBal = IERC20(address(WBNB)).balanceOf(address(this));
        IERC20(address(WBNB)).safeTransferFrom(msg.sender, address(this), d.needWBNB);
        uint256 got = IERC20(address(WBNB)).balanceOf(address(this)) - beforeBal;
        require(got == d.needWBNB, "wbnb short");
        d.fundedA = true;
        emit FundedA(id, msg.sender, got, false);

        if (d.fundedB) { _settle(d, id); }
    }

    // B funds with USDT via allowance
    function fundB_withUSDT(uint256 id) external nonReentrant {
        Deal storage d = _openDealOf(id);
        require(msg.sender == d.partyB, "not B");
        require(!d.fundedB, "B funded");
        _ensurePricesLockedAndTargets(d);

        uint256 beforeBal = USDT.balanceOf(address(this));
        USDT.safeTransferFrom(msg.sender, address(this), d.needUSDT);
        uint256 got = USDT.balanceOf(address(this)) - beforeBal;
        require(got == d.needUSDT, "usdt short");

        d.fundedB = true;
        emit FundedB(id, msg.sender, got);

        if (d.fundedA) { _settle(d, id); }
    }

    // ------------------------
    // Admin/Users: Cancel & Refunds
    // ------------------------

    // A can cancel before B funds; refunds A if already funded
    function cancel(uint256 id) external nonReentrant {
        Deal storage d = _openDealOf(id);
        require(msg.sender == d.partyA, "only A");
        require(!d.fundedB, "B already funded");

        d.canceled = true;
        if (d.fundedA) {
            // refund A's WBNB
            uint256 amt = d.needWBNB;
            d.fundedA = false;
            IERC20(address(WBNB)).safeTransfer(d.partyA, amt);
            emit Refunded(id, d.partyA, amt);
        }
        emit Canceled(id);
    }

    // After deadline, anyone can trigger refunds for whichever side funded
    function refundIfExpired(uint256 id) external nonReentrant {
        Deal storage d = deals[id];
        require(!d.settled && !d.canceled, "closed");
        require(block.timestamp > d.deadline, "not expired");

        if (d.fundedA) {
            d.fundedA = false;
            IERC20(address(WBNB)).safeTransfer(d.partyA, d.needWBNB);
            emit Refunded(id, d.partyA, d.needWBNB);
        }
        if (d.fundedB) {
            d.fundedB = false;
            USDT.safeTransfer(d.partyB, d.needUSDT);
            emit Refunded(id, d.partyB, d.needUSDT);
        }
        d.canceled = true;
    }

    // ------------------------
    // Internals
    // ------------------------

    function _openDealOf(uint256 id) private view returns (Deal storage d) {
        d = deals[id];
        require(!d.settled && !d.canceled, "closed");
        require(block.timestamp <= d.deadline, "deadline passed");
    }

    function _ensurePricesLockedAndTargets(Deal storage d) private {
        if (d.priceLocked) return;

        (uint256 bnbUsd, uint256 bnbTime) = _freshPrice(BNB_USD);
        (uint256 uUsd,  uint256 uTime )  = _freshPrice(USDT_USD);

        // lock
        d.priceLocked = true;
        d.priceTime = uint64(_min(bnbTime, uTime));
        d.bnbUsd = uint128(bnbUsd);
        d.usdtUsd = uint128(uUsd);
        emit PricesLocked(_dealIdUnsafe(d), bnbUsd, uUsd, d.priceTime);

        // compute required token amounts (ceil to avoid underpay)
        d.needWBNB = _usdToToken(d.usdA_8d, bnbUsd, _bnbUsdDecimals, _wbnbDecimals);
        d.needUSDT = _usdToToken(d.usdB_8d, uUsd,  _usdtUsdDecimals, _usdtDecimals);
        require(d.needWBNB > 0 && d.needUSDT > 0, "zero need");
    }

    // Convert USD(8d) amount to token units with rounding up.
    function _usdToToken(
        uint256 usd_8d,
        uint256 price,           // feed-scaled
        uint8    priceDecimals,  // e.g., 8
        uint8    tokenDecimals   // e.g., 18
    ) private pure returns (uint256) {
        // Normalize USD to the feed's decimals (most USD feeds are 8 already).
        // If your usd_8d is 8d, and price is priceDecimals, bring usd_8d to priceDecimals first.
        uint256 usdScaled = (priceDecimals >= 8)
            ? usd_8d * (10 ** (priceDecimals - 8))
            : usd_8d / (10 ** (8 - priceDecimals));

        // tokens = ceil( usdScaled * 10^tokenDecimals / price )
        uint256 num = usdScaled * (10 ** tokenDecimals);
        return (num + price - 1) / price; // ceilDiv
    }

    function _freshPrice(AggregatorV3Interface feed) private view returns (uint256 price, uint256 updatedAt) {
        (, int256 ans,, uint256 upd,) = feed.latestRoundData();
        require(ans > 0, "bad price");
        require(block.timestamp - upd <= MAX_PRICE_AGE, "stale price");
        price = uint256(ans); // scaled by pDec
        updatedAt = upd;
    }

    function _settle(Deal storage d, uint256 id) private {
        require(d.fundedA && d.fundedB, "both not funded");
        d.settled = true;

        // Payout A: USDT
        USDT.safeTransfer(d.partyA, d.needUSDT);

        // Payout B: WBNB or unwrap to native BNB
        if (d.unwrapToBNB) {
            WBNB.withdraw(d.needWBNB);
            (bool ok, ) = d.partyB.call{value: d.needWBNB}("");
            require(ok, "BNB send fail");
        } else {
            IERC20(address(WBNB)).safeTransfer(d.partyB, d.needWBNB);
        }
        emit Settled(id, d.needUSDT, d.needWBNB);
    }

    // Helper: get array index from storage ref (unsafe but fine for events)
    function _dealIdUnsafe(Deal storage d) private pure returns (uint256 id) {
        assembly { id := d.slot }
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }

    // accept BNB for WBNB.deposit()
    receive() external payable {}
}

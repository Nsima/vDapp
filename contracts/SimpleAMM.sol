// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SimpleAMM
 * @dev Minimal constant-product AMM (Uniswap v2-like), 0.3% fee.
 * token0 = Collateral token (COL)
 * token1 = Stable token (USD)
 */
contract SimpleAMM {
    IERC20 public immutable token0; // COL
    IERC20 public immutable token1; // USD

    uint112 public reserve0; // COL reserve
    uint112 public reserve1; // USD reserve

    event LiquidityAdded(uint256 amount0, uint256 amount1);
    event Swap(address indexed sender, address indexed tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _token0, address _token1) {
        require(_token0 != address(0) && _token1 != address(0), "ZERO_ADDR");
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function _update(uint256 bal0, uint256 bal1) internal {
        require(bal0 <= type(uint112).max && bal1 <= type(uint112).max, "RES_OVERFLOW");
        reserve0 = uint112(bal0);
        reserve1 = uint112(bal1);
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external {
        require(amount0 > 0 && amount1 > 0, "BAD_AMOUNTS");
        require(token0.transferFrom(msg.sender, address(this), amount0), "T0_XFER_FAIL");
        require(token1.transferFrom(msg.sender, address(this), amount1), "T1_XFER_FAIL");
        uint256 newBal0 = token0.balanceOf(address(this));
        uint256 newBal1 = token1.balanceOf(address(this));
        _update(newBal0, newBal1);
        emit LiquidityAdded(amount0, amount1);
    }

    /// @notice Swap exact tokens in for the other token (0.3% fee)
    function swapExactTokensForTokens(address tokenIn, uint256 amountIn, uint256 minOut) external returns (uint256 amountOut) {
        require(amountIn > 0, "AMOUNT_IN_ZERO");
        require(tokenIn == address(token0) || tokenIn == address(token1), "BAD_TOKEN");

        // x*y=k with 0.3% fee
        if (tokenIn == address(token0)) {
            // COL -> USD
            require(token0.transferFrom(msg.sender, address(this), amountIn), "T0_IN_FAIL");
            uint256 x = reserve0;
            uint256 y = reserve1;
            uint256 amountInWithFee = (amountIn * 997) / 1000;
            amountOut = (amountInWithFee * y) / (x + amountInWithFee);
            require(amountOut >= minOut, "SLIPPAGE");
            require(token1.transfer(msg.sender, amountOut), "T1_OUT_FAIL");
        } else {
            // USD -> COL
            require(token1.transferFrom(msg.sender, address(this), amountIn), "T1_IN_FAIL");
            uint256 x = reserve1;
            uint256 y = reserve0;
            uint256 amountInWithFee = (amountIn * 997) / 1000;
            amountOut = (amountInWithFee * y) / (x + amountInWithFee);
            require(amountOut >= minOut, "SLIPPAGE");
            require(token0.transfer(msg.sender, amountOut), "T0_OUT_FAIL");
        }

        // Update reserves to current balances
        _update(token0.balanceOf(address(this)), token1.balanceOf(address(this)));
        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    /// @notice Spot price of base in quote with 1e18 fixed-point
    /// price(COL in USD) = reserve1 / reserve0
    function getSpotPrice(address base, address quote) external view returns (uint256 price1e18) {
        require(
            (base == address(token0) && quote == address(token1)) ||
            (base == address(token1) && quote == address(token0)),
            "PAIR_MISMATCH"
        );
        if (base == address(token0)) {
            require(reserve0 > 0, "NO_LIQ_0");
            return (uint256(reserve1) * 1e18) / uint256(reserve0);
        } else {
            require(reserve1 > 0, "NO_LIQ_1");
            return (uint256(reserve0) * 1e18) / uint256(reserve1);
        }
    }
}

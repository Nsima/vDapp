// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VulnerableDeFiProtocol {
    IERC20 public token;
    mapping(address => uint256) public deposits;

    constructor(IERC20 _token) {
        token = _token;
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
    }

    // Vulnerable reward logic: rewards are based on internal balance only
    function withdrawWithReward() external {
        uint256 amount = deposits[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        uint256 reward = amount * 2; // 🐞 too generous
        deposits[msg.sender] = 0;
        token.transfer(msg.sender, reward);
    }
}

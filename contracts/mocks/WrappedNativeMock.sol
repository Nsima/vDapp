// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract WrappedNativeMock is ERC20("Wrapped BNB Mock", "WBNB") {
    function decimals() public pure override returns (uint8) { return 18; }

    function deposit() public payable { _mint(msg.sender, msg.value); }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "send fail");
    }

    receive() external payable { deposit(); }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PriceFeedMock {
    uint8 private _decs;
    int256 private _answer;
    uint256 private _updatedAt;

    constructor(uint8 decimals_, int256 answer_) {
        _decs = decimals_;
        setAnswer(answer_);
    }

    function decimals() external view returns (uint8) { return _decs; }

    function setAnswer(int256 answer_) public {
        _answer = answer_;
        _updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, _answer, _updatedAt, _updatedAt, 0);
    }
}

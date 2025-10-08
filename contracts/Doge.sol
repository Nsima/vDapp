// SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.12;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        uint256 c = a - b;
        return c;
    }
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}

contract BabyDoge {
    using SafeMath for uint256;

    string public name = "BabyDoge";
    string public symbol = "BabyDoge";
    uint8 public decimals = 9;
    uint256 public totalSupply = 420_000_000_000_000 * (10 ** uint256(decimals));

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public owner;
    address public marketingWallet = 0x…;  // often a specified address
    address public liquidityReceiver = 0x…;  // often another specified address

    uint256 public taxFee = 2;       // 2% reflection / redistribution tax, example
    uint256 public liquidityFee = 3; // 3% liquidity tax, example
    uint256 public marketingFee = 1; // 1% marketing tax, example

    mapping(address => bool) private _isExcludedFromFee;

    constructor() public {
        owner = msg.sender;
        _balances[owner] = totalSupply;
        _isExcludedFromFee[owner] = true;
        _isExcludedFromFee[address(this)] = true;

        emit Transfer(address(0), owner, totalSupply);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner_, address spender) public view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _allowances[sender][msg.sender] = _allowances[sender][msg.sender].sub(amount);
        _transfer(sender, recipient, amount);
        emit Approval(sender, msg.sender, _allowances[sender][msg.sender]);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "Transfer from zero");
        require(recipient != address(0), "Transfer to zero");
        require(_balances[sender] >= amount, "Insufficient balance");

        uint256 feeAmt = 0;
        if (!_isExcludedFromFee[sender] && !_isExcludedFromFee[recipient]) {
            uint256 tFee = amount.mul(taxFee).div(100);
            uint256 lFee = amount.mul(liquidityFee).div(100);
            uint256 mFee = amount.mul(marketingFee).div(100);
            feeAmt = tFee + lFee + mFee;

            // distribute reflection, add liquidity, send marketing
            _takeLiquidity(lFee);
            _takeMarketing(mFee);
            _reflectFee(tFee);
        }

        uint256 transferAmt = amount.sub(feeAmt);
        _balances[sender] = _balances[sender].sub(amount);
        _balances[recipient] = _balances[recipient].add(transferAmt);

        emit Transfer(sender, recipient, transferAmt);
    }

    function _takeLiquidity(uint256 tLiquidity) private {
        _balances[address(this)] = _balances[address(this)].add(tLiquidity);
        emit Transfer(msg.sender, address(this), tLiquidity);
    }

    function _takeMarketing(uint256 tMarketing) private {
        _balances[marketingWallet] = _balances[marketingWallet].add(tMarketing);
        emit Transfer(msg.sender, marketingWallet, tMarketing);
    }

    function _reflectFee(uint256 tFee) private {
        // In many reflection tokens, reflection is done by distributing amongst all holders
        // But this is just a placeholder
        totalSupply = totalSupply.sub(tFee);
    }

    // owner-only functions to change fees etc.
    function setTaxFeePercent(uint256 _taxFee) external onlyOwner {
        taxFee = _taxFee;
    }

    function setLiquidityFeePercent(uint256 _liquidityFee) external onlyOwner {
        liquidityFee = _liquidityFee;
    }

    function setMarketingFeePercent(uint256 _marketingFee) external onlyOwner {
        marketingFee = _marketingFee;
    }

    function excludeFromFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = true;
    }

    function includeInFee(address account) external onlyOwner {
        _isExcludedFromFee[account] = false;
    }
}

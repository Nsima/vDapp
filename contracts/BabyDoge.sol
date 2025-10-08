// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

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

contract BabyDoge {
    string public name = "BabyDoge";
    string public symbol = "BabyDoge";
    uint8 public decimals = 9;
    uint256 public totalSupply = 420_000_000_000_000 * (10 ** uint256(decimals));

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public owner;
    address public marketingWallet = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266; // Example address
    address public liquidityReceiver = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // Example address

    uint256 public taxFee = 2;       // 2% reflection / redistribution tax, example
    uint256 public liquidityFee = 3; // 3% liquidity tax, example
    uint256 public marketingFee = 1; // 1% marketing tax, example

    mapping(address => bool) private _isExcludedFromFee;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() {
        owner = msg.sender;
        _balances[owner] = totalSupply;
        _isExcludedFromFee[owner] = true;
        _isExcludedFromFee[address(this)] = true;

        emit Transfer(address(0), owner, totalSupply); // Emit Transfer event
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
        emit Approval(msg.sender, spender, amount); // Emit Approval event
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
        _allowances[sender][msg.sender] = _allowances[sender][msg.sender] - amount; // Underflow checked automatically
        _transfer(sender, recipient, amount);
        emit Approval(sender, msg.sender, _allowances[sender][msg.sender]); // Emit Approval event
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "Transfer from zero address");
        require(recipient != address(0), "Transfer to zero address");
        require(_balances[sender] >= amount, "Insufficient balance");

        uint256 feeAmt = 0;
        if (!_isExcludedFromFee[sender] && !_isExcludedFromFee[recipient]) {
            uint256 tFee = (amount * taxFee) / 100;
            uint256 lFee = (amount * liquidityFee) / 100;
            uint256 mFee = (amount * marketingFee) / 100;
            feeAmt = tFee + lFee + mFee;

            // distribute reflection, add liquidity, send marketing
            _takeLiquidity(lFee);
            _takeMarketing(mFee);
            _reflectFee(tFee);
        }

        uint256 transferAmt = amount - feeAmt; // Subtraction is safe due to 0.8.x checks
        _balances[sender] -= amount;
        _balances[recipient] += transferAmt;

        emit Transfer(sender, recipient, transferAmt); // Emit Transfer event
    }

    function _takeLiquidity(uint256 tLiquidity) private {
        _balances[address(this)] += tLiquidity;
        emit Transfer(msg.sender, address(this), tLiquidity); // Emit Transfer event
    }

    function _takeMarketing(uint256 tMarketing) private {
        _balances[marketingWallet] += tMarketing;
        emit Transfer(msg.sender, marketingWallet, tMarketing); // Emit Transfer event
    }

    function _reflectFee(uint256 tFee) private {
        totalSupply -= tFee; // Subtract from totalSupply to reduce the total supply (reflections)
    }

    // Owner-only functions to change fees, etc.
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

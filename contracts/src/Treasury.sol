// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";

contract Treasury is Initializable, UUPSUpgradeable, OwnableUpgradeable, ITreasury {
    using SafeERC20 for IERC20;

    IERC20 public usdt;
    address public escrow;
    address public uniswapRouter;

    uint256 public totalCollected;
    uint256 public totalReinvested;
    uint256 public totalEarnings;

    mapping(address => uint256) private _agentEarnings;
    mapping(address => uint256) private _agentClaimed;
    address[] private _agents;
    mapping(address => bool) private _agentRegistered;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address usdt_,
        address escrow_,
        address uniswapRouter_
    ) external initializer {
        __Ownable_init(owner_);
        usdt = IERC20(usdt_);
        escrow = escrow_;
        uniswapRouter = uniswapRouter_;
    }

    function collectFee(uint256 amount) external {
        require(msg.sender == escrow, "Only escrow");
        usdt.safeTransferFrom(msg.sender, address(this), amount);
        totalCollected += amount;
        emit FeeCollected(amount, totalCollected);
    }

    function registerAgentEarnings(address agent, uint256 amount) external onlyOwner {
        if (!_agentRegistered[agent]) {
            _agents.push(agent);
            _agentRegistered[agent] = true;
        }
        _agentEarnings[agent] += amount;
        totalEarnings += amount;
    }

    function reinvest(uint256 amount) external onlyOwner {
        require(amount <= usdt.balanceOf(address(this)), "Insufficient balance");
        totalReinvested += amount;
        emit Reinvested(amount, 0);
    }

    function claimYield(address agent) external {
        uint256 yield_ = getAgentYield(agent);
        require(yield_ > 0, "No yield");
        _agentClaimed[agent] += yield_;
        usdt.safeTransfer(agent, yield_);
        emit YieldClaimed(agent, yield_);
    }

    function getAgentYield(address agent) public view returns (uint256) {
        if (totalEarnings == 0) return 0;
        uint256 share = totalCollected * _agentEarnings[agent] / totalEarnings;
        uint256 claimed = _agentClaimed[agent];
        return share > claimed ? share - claimed : 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}

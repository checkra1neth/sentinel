// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    event FeeCollected(uint256 amount, uint256 totalCollected);
    event Reinvested(uint256 usdtAmount, uint256 okbReceived);
    event YieldClaimed(address indexed agent, uint256 amount);

    function collectFee(uint256 amount) external;
    function reinvest(uint256 amount) external;
    function claimYield(address agent) external;
    function getAgentYield(address agent) external view returns (uint256);
    function totalCollected() external view returns (uint256);
    function totalReinvested() external view returns (uint256);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRegistry {
    struct Service {
        uint256 id;
        address agent;
        string serviceType;
        string endpoint;
        uint256 priceUsdt;
        bool active;
    }

    event ServiceRegistered(uint256 indexed id, address indexed agent, string serviceType, uint256 priceUsdt);
    event ServiceUpdated(uint256 indexed id, string endpoint, uint256 priceUsdt);
    event ServiceDeactivated(uint256 indexed id);

    function registerService(string calldata serviceType, string calldata endpoint, uint256 priceUsdt) external returns (uint256);
    function updateService(uint256 serviceId, string calldata endpoint, uint256 priceUsdt) external;
    function deactivateService(uint256 serviceId) external;
    function getService(uint256 serviceId) external view returns (Service memory);
    function getActiveServices() external view returns (Service[] memory);
    function getServicesByType(string calldata serviceType) external view returns (Service[] memory);
    function getServicesByAgent(address agent) external view returns (Service[] memory);
    function serviceCount() external view returns (uint256);
}

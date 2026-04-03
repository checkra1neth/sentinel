// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEscrow {
    enum OrderStatus { None, Pending, Completed, Refunded, Disputed }

    struct Order {
        uint256 id;
        address client;
        address agent;
        uint256 amount;
        uint256 serviceId;
        uint256 deadline;
        OrderStatus status;
    }

    event OrderCreated(uint256 indexed id, address indexed client, address indexed agent, uint256 amount, uint256 serviceId);
    event OrderCompleted(uint256 indexed id, uint256 agentPayout, uint256 fee);
    event OrderRefunded(uint256 indexed id, uint256 amount);
    event OrderDisputed(uint256 indexed id);
    event DisputeResolved(uint256 indexed id, bool toAgent);

    function deposit(uint256 serviceId, uint256 amount) external returns (uint256);
    function release(uint256 orderId) external;
    function refund(uint256 orderId) external;
    function dispute(uint256 orderId) external;
    function resolveDispute(uint256 orderId, bool toAgent) external;
    function getOrder(uint256 orderId) external view returns (Order memory);
    function getOrdersByClient(address client) external view returns (Order[] memory);
    function getOrdersByAgent(address agent) external view returns (Order[] memory);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

contract Escrow is Initializable, UUPSUpgradeable, OwnableUpgradeable, IEscrow {
    using SafeERC20 for IERC20;

    IRegistry public registry;
    IERC20 public usdt;
    address public treasury;
    uint256 public feeBps;
    uint256 public defaultTimeout;

    uint256 private _nextOrderId;
    mapping(uint256 => Order) private _orders;
    uint256[] private _orderIds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address registry_,
        address usdt_,
        address treasury_,
        uint256 feeBps_,
        uint256 defaultTimeout_
    ) external initializer {
        __Ownable_init(owner_);
        registry = IRegistry(registry_);
        usdt = IERC20(usdt_);
        treasury = treasury_;
        feeBps = feeBps_;
        defaultTimeout = defaultTimeout_;
        _nextOrderId = 1;
    }

    function deposit(uint256 serviceId, uint256 amount) external returns (uint256) {
        IRegistry.Service memory service = registry.getService(serviceId);
        require(service.active, "Service not active");
        require(amount == service.priceUsdt, "Amount != service price");

        uint256 orderId = _nextOrderId++;
        _orders[orderId] = Order({
            id: orderId,
            client: msg.sender,
            agent: service.agent,
            amount: amount,
            serviceId: serviceId,
            deadline: block.timestamp + defaultTimeout,
            status: OrderStatus.Pending
        });
        _orderIds.push(orderId);

        usdt.safeTransferFrom(msg.sender, address(this), amount);

        emit OrderCreated(orderId, msg.sender, service.agent, amount, serviceId);
        return orderId;
    }

    function release(uint256 orderId) external {
        Order storage o = _orders[orderId];
        require(o.client == msg.sender, "Not client");
        require(o.status == OrderStatus.Pending, "Not pending");

        o.status = OrderStatus.Completed;

        uint256 fee = o.amount * feeBps / 10_000;
        uint256 payout = o.amount - fee;

        usdt.safeTransfer(o.agent, payout);
        if (fee > 0) {
            usdt.safeTransfer(treasury, fee);
        }

        emit OrderCompleted(orderId, payout, fee);
    }

    function refund(uint256 orderId) external {
        Order storage o = _orders[orderId];
        require(o.client == msg.sender, "Not client");
        require(o.status == OrderStatus.Pending, "Not pending");
        require(block.timestamp > o.deadline, "Deadline not reached");

        o.status = OrderStatus.Refunded;
        usdt.safeTransfer(o.client, o.amount);

        emit OrderRefunded(orderId, o.amount);
    }

    function dispute(uint256 orderId) external {
        Order storage o = _orders[orderId];
        require(o.client == msg.sender || o.agent == msg.sender, "Not party");
        require(o.status == OrderStatus.Pending, "Not pending");

        o.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId);
    }

    function resolveDispute(uint256 orderId, bool toAgent) external onlyOwner {
        Order storage o = _orders[orderId];
        require(o.status == OrderStatus.Disputed, "Not disputed");

        if (toAgent) {
            o.status = OrderStatus.Completed;
            uint256 fee = o.amount * feeBps / 10_000;
            uint256 payout = o.amount - fee;
            usdt.safeTransfer(o.agent, payout);
            if (fee > 0) {
                usdt.safeTransfer(treasury, fee);
            }
            emit OrderCompleted(orderId, payout, fee);
        } else {
            o.status = OrderStatus.Refunded;
            usdt.safeTransfer(o.client, o.amount);
            emit OrderRefunded(orderId, o.amount);
        }

        emit DisputeResolved(orderId, toAgent);
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function getOrdersByClient(address client) external view returns (Order[] memory) {
        uint256 count;
        for (uint256 i; i < _orderIds.length; i++) {
            if (_orders[_orderIds[i]].client == client) count++;
        }
        Order[] memory result = new Order[](count);
        uint256 idx;
        for (uint256 i; i < _orderIds.length; i++) {
            if (_orders[_orderIds[i]].client == client) {
                result[idx++] = _orders[_orderIds[i]];
            }
        }
        return result;
    }

    function getOrdersByAgent(address agent) external view returns (Order[] memory) {
        uint256 count;
        for (uint256 i; i < _orderIds.length; i++) {
            if (_orders[_orderIds[i]].agent == agent) count++;
        }
        Order[] memory result = new Order[](count);
        uint256 idx;
        for (uint256 i; i < _orderIds.length; i++) {
            if (_orders[_orderIds[i]].agent == agent) {
                result[idx++] = _orders[_orderIds[i]];
            }
        }
        return result;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}

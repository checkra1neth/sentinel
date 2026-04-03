// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../../src/Escrow.sol";
import {Registry} from "../../src/Registry.sol";
import {IEscrow} from "../../src/interfaces/IEscrow.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract EscrowTest is Test {
    Escrow public escrow;
    Registry public registry;
    MockERC20 public usdt;

    address public owner = address(this);
    address public agent1 = makeAddr("agent1");
    address public client1 = makeAddr("client1");
    address public treasury = makeAddr("treasury");

    uint256 public constant SERVICE_PRICE = 500_000;
    uint256 public constant FEE_BPS = 200;
    uint256 public constant DEFAULT_TIMEOUT = 3600;

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);

        Registry regImpl = new Registry();
        ERC1967Proxy regProxy = new ERC1967Proxy(
            address(regImpl),
            abi.encodeCall(Registry.initialize, (owner))
        );
        registry = Registry(address(regProxy));

        Escrow escImpl = new Escrow();
        ERC1967Proxy escProxy = new ERC1967Proxy(
            address(escImpl),
            abi.encodeCall(Escrow.initialize, (owner, address(registry), address(usdt), treasury, FEE_BPS, DEFAULT_TIMEOUT))
        );
        escrow = Escrow(address(escProxy));

        vm.prank(agent1);
        registry.registerService("analyst", "https://api.agentra.xyz/analyst", SERVICE_PRICE);

        usdt.mint(client1, 100_000_000);

        vm.prank(client1);
        usdt.approve(address(escrow), type(uint256).max);
    }

    function test_deposit_success() public {
        vm.prank(client1);
        uint256 orderId = escrow.deposit(1, SERVICE_PRICE);
        assertEq(orderId, 1);
        IEscrow.Order memory o = escrow.getOrder(1);
        assertEq(o.client, client1);
        assertEq(o.agent, agent1);
        assertEq(o.amount, SERVICE_PRICE);
        assertEq(uint8(o.status), uint8(IEscrow.OrderStatus.Pending));
        assertEq(usdt.balanceOf(address(escrow)), SERVICE_PRICE);
    }

    function test_deposit_invalidService_reverts() public {
        vm.prank(client1);
        vm.expectRevert("Service not active");
        escrow.deposit(999, SERVICE_PRICE);
    }

    function test_deposit_wrongAmount_reverts() public {
        vm.prank(client1);
        vm.expectRevert("Amount != service price");
        escrow.deposit(1, 100_000);
    }

    function test_release_success() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        escrow.release(1);
        IEscrow.Order memory o = escrow.getOrder(1);
        assertEq(uint8(o.status), uint8(IEscrow.OrderStatus.Completed));
        uint256 fee = SERVICE_PRICE * FEE_BPS / 10_000;
        uint256 payout = SERVICE_PRICE - fee;
        assertEq(usdt.balanceOf(agent1), payout);
        assertEq(usdt.balanceOf(treasury), fee);
    }

    function test_release_notClient_reverts() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(agent1);
        vm.expectRevert("Not client");
        escrow.release(1);
    }

    function test_refund_afterTimeout() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.warp(block.timestamp + DEFAULT_TIMEOUT + 1);
        vm.prank(client1);
        escrow.refund(1);
        IEscrow.Order memory o = escrow.getOrder(1);
        assertEq(uint8(o.status), uint8(IEscrow.OrderStatus.Refunded));
        assertEq(usdt.balanceOf(client1), 100_000_000);
    }

    function test_refund_beforeTimeout_reverts() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        vm.expectRevert("Deadline not reached");
        escrow.refund(1);
    }

    function test_dispute_byClient() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        escrow.dispute(1);
        IEscrow.Order memory o = escrow.getOrder(1);
        assertEq(uint8(o.status), uint8(IEscrow.OrderStatus.Disputed));
    }

    function test_resolveDispute_toAgent() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        escrow.dispute(1);
        escrow.resolveDispute(1, true);
        uint256 fee = SERVICE_PRICE * FEE_BPS / 10_000;
        assertEq(usdt.balanceOf(agent1), SERVICE_PRICE - fee);
        assertEq(usdt.balanceOf(treasury), fee);
    }

    function test_resolveDispute_toClient() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        escrow.dispute(1);
        escrow.resolveDispute(1, false);
        assertEq(usdt.balanceOf(client1), 100_000_000);
    }

    function test_resolveDispute_notOwner_reverts() public {
        vm.prank(client1);
        escrow.deposit(1, SERVICE_PRICE);
        vm.prank(client1);
        escrow.dispute(1);
        vm.prank(agent1);
        vm.expectRevert();
        escrow.resolveDispute(1, true);
    }
}

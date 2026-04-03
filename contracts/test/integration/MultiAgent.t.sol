// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../../src/Registry.sol";
import {Escrow} from "../../src/Escrow.sol";
import {Treasury} from "../../src/Treasury.sol";
import {IEscrow} from "../../src/interfaces/IEscrow.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @title MultiAgent Integration Test
/// @notice Tests 3 agents interacting with cross-purchases (agent-to-agent payments)
contract MultiAgentTest is Test {
    Registry public registry;
    Escrow public escrow;
    Treasury public treasury;
    MockERC20 public usdt;

    address public owner = address(this);
    address public client = makeAddr("client");
    address public analyst = makeAddr("analyst");
    address public auditor = makeAddr("auditor");
    address public trader = makeAddr("trader");
    address public uniswapRouter = makeAddr("uniswapRouter");

    uint256 public constant ANALYST_PRICE = 500_000; // 0.50 USDT
    uint256 public constant AUDITOR_PRICE = 200_000; // 0.20 USDT
    uint256 public constant TRADER_PRICE = 300_000; // 0.30 USDT
    uint256 public constant FEE_BPS = 200; // 2%
    uint256 public constant DEFAULT_TIMEOUT = 3600;

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);

        // --- Deploy Registry proxy ---
        Registry regImpl = new Registry();
        ERC1967Proxy regProxy = new ERC1967Proxy(
            address(regImpl),
            abi.encodeCall(Registry.initialize, (owner))
        );
        registry = Registry(address(regProxy));

        // --- Resolve circular dependency using nonce prediction ---
        // Deployments from this contract:
        //   current nonce   -> Escrow impl
        //   nonce+1         -> Escrow proxy
        //   nonce+2         -> Treasury impl
        //   nonce+3         -> Treasury proxy  <-- predict this
        uint64 nonce = vm.getNonce(address(this));
        address predictedTreasuryProxy = vm.computeCreateAddress(address(this), nonce + 3);

        // Deploy Escrow with predicted Treasury address
        Escrow escImpl = new Escrow();
        ERC1967Proxy escProxy = new ERC1967Proxy(
            address(escImpl),
            abi.encodeCall(Escrow.initialize, (owner, address(registry), address(usdt), predictedTreasuryProxy, FEE_BPS, DEFAULT_TIMEOUT))
        );
        escrow = Escrow(address(escProxy));

        // Deploy Treasury with real Escrow address
        Treasury trsImpl = new Treasury();
        ERC1967Proxy trsProxy = new ERC1967Proxy(
            address(trsImpl),
            abi.encodeCall(Treasury.initialize, (owner, address(usdt), address(escrow), uniswapRouter))
        );
        treasury = Treasury(address(trsProxy));

        // Verify prediction was correct
        assertEq(address(treasury), predictedTreasuryProxy, "Treasury address prediction mismatch");

        // --- Register 3 agents with services ---
        // Service 1: analyst (500k)
        vm.prank(analyst);
        registry.registerService("analyst", "https://api.agentra.xyz/analyst", ANALYST_PRICE);

        // Service 2: auditor (200k)
        vm.prank(auditor);
        registry.registerService("auditor", "https://api.agentra.xyz/auditor", AUDITOR_PRICE);

        // Service 3: trader (300k)
        vm.prank(trader);
        registry.registerService("trader", "https://api.agentra.xyz/trader", TRADER_PRICE);

        // --- Fund participants ---
        usdt.mint(client, 5_000_000); // 5 USDT
        usdt.mint(analyst, 5_000_000); // 5 USDT
        usdt.mint(trader, 5_000_000); // 5 USDT
        // auditor starts with 0

        // --- Approvals ---
        vm.prank(client);
        usdt.approve(address(escrow), type(uint256).max);
        vm.prank(analyst);
        usdt.approve(address(escrow), type(uint256).max);
        vm.prank(trader);
        usdt.approve(address(escrow), type(uint256).max);
    }

    function test_multiAgent_crossPurchases() public {
        // 1. Client buys analyst service (order 1)
        vm.prank(client);
        uint256 o1 = escrow.deposit(1, ANALYST_PRICE);
        assertEq(o1, 1);

        vm.prank(client);
        escrow.release(o1);

        // 2. Analyst buys auditor service (order 2) -- agent-to-agent
        vm.prank(analyst);
        uint256 o2 = escrow.deposit(2, AUDITOR_PRICE);
        assertEq(o2, 2);

        vm.prank(analyst);
        escrow.release(o2);

        // 3. Trader buys analyst service (order 3)
        vm.prank(trader);
        uint256 o3 = escrow.deposit(1, ANALYST_PRICE);
        assertEq(o3, 3);

        vm.prank(trader);
        escrow.release(o3);

        // --- Verify balances ---

        // Analyst:
        //   Started: 5_000_000
        //   - Paid 200_000 for auditor service
        //   + Received 490_000 (98% of 500_000) from client
        //   + Received 490_000 (98% of 500_000) from trader
        //   = 5_000_000 - 200_000 + 490_000 + 490_000 = 5_780_000
        assertEq(usdt.balanceOf(analyst), 5_780_000, "Analyst balance incorrect");

        // Auditor:
        //   Started: 0
        //   + Received 196_000 (98% of 200_000)
        //   = 196_000
        assertEq(usdt.balanceOf(auditor), 196_000, "Auditor balance incorrect");

        // Trader:
        //   Started: 5_000_000
        //   - Paid 500_000 for analyst service
        //   = 4_500_000
        assertEq(usdt.balanceOf(trader), 4_500_000, "Trader balance incorrect");

        // Client:
        //   Started: 5_000_000
        //   - Paid 500_000 for analyst service
        //   = 4_500_000
        assertEq(usdt.balanceOf(client), 4_500_000, "Client balance incorrect");

        // Treasury:
        //   2% of each order: 10_000 + 4_000 + 10_000 = 24_000
        assertEq(usdt.balanceOf(address(treasury)), 24_000, "Treasury balance incorrect");

        // Verify all orders are completed
        IEscrow.Order memory order1 = escrow.getOrder(1);
        IEscrow.Order memory order2 = escrow.getOrder(2);
        IEscrow.Order memory order3 = escrow.getOrder(3);
        assertEq(uint8(order1.status), uint8(IEscrow.OrderStatus.Completed));
        assertEq(uint8(order2.status), uint8(IEscrow.OrderStatus.Completed));
        assertEq(uint8(order3.status), uint8(IEscrow.OrderStatus.Completed));

        // Escrow should have 0 balance (all funds distributed)
        assertEq(usdt.balanceOf(address(escrow)), 0, "Escrow should be empty");
    }
}

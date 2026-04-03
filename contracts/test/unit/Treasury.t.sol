// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Treasury} from "../../src/Treasury.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract TreasuryTest is Test {
    Treasury public treasury;
    MockERC20 public usdt;

    address public owner = address(this);
    address public escrow = makeAddr("escrow");
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");
    address public uniswapRouter = makeAddr("uniswapRouter");

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);

        Treasury impl = new Treasury();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Treasury.initialize, (owner, address(usdt), escrow, uniswapRouter))
        );
        treasury = Treasury(address(proxy));

        usdt.mint(escrow, 100_000_000);
        vm.prank(escrow);
        usdt.approve(address(treasury), type(uint256).max);
    }

    function test_collectFee_success() public {
        vm.prank(escrow);
        treasury.collectFee(10_000);
        assertEq(treasury.totalCollected(), 10_000);
        assertEq(usdt.balanceOf(address(treasury)), 10_000);
    }

    function test_collectFee_notEscrow_reverts() public {
        vm.prank(agent1);
        vm.expectRevert("Only escrow");
        treasury.collectFee(10_000);
    }

    function test_registerAgentEarnings_updatesYield() public {
        treasury.registerAgentEarnings(agent1, 500_000);
        treasury.registerAgentEarnings(agent2, 300_000);

        vm.prank(escrow);
        treasury.collectFee(16_000);

        assertEq(treasury.getAgentYield(agent1), 10_000);
        assertEq(treasury.getAgentYield(agent2), 6_000);
    }

    function test_claimYield_success() public {
        treasury.registerAgentEarnings(agent1, 500_000);

        vm.prank(escrow);
        treasury.collectFee(10_000);

        uint256 yield_ = treasury.getAgentYield(agent1);
        assertEq(yield_, 10_000);

        vm.prank(agent1);
        treasury.claimYield(agent1);

        assertEq(usdt.balanceOf(agent1), 10_000);
        assertEq(treasury.getAgentYield(agent1), 0);
    }

    function test_claimYield_zeroBalance_reverts() public {
        vm.prank(agent1);
        vm.expectRevert("No yield");
        treasury.claimYield(agent1);
    }
}

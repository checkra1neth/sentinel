// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../../src/Registry.sol";
import {IRegistry} from "../../src/interfaces/IRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract RegistryTest is Test {
    Registry public registry;
    address public owner = address(this);
    address public agent1 = makeAddr("agent1");
    address public agent2 = makeAddr("agent2");

    function setUp() public {
        Registry impl = new Registry();
        bytes memory initData = abi.encodeCall(Registry.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = Registry(address(proxy));
    }

    function test_registerService_success() public {
        vm.prank(agent1);
        uint256 id = registry.registerService("analyst", "https://api.agentra.xyz/analyst", 500_000);

        assertEq(id, 1);
        IRegistry.Service memory s = registry.getService(1);
        assertEq(s.agent, agent1);
        assertEq(s.priceUsdt, 500_000);
        assertTrue(s.active);
    }

    function test_registerService_emitsEvent() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit IRegistry.ServiceRegistered(1, agent1, "analyst", 500_000);
        registry.registerService("analyst", "https://api.agentra.xyz/analyst", 500_000);
    }

    function test_registerService_zeroPrice_reverts() public {
        vm.prank(agent1);
        vm.expectRevert("Price must be > 0");
        registry.registerService("analyst", "https://api.agentra.xyz/analyst", 0);
    }

    function test_registerService_emptyEndpoint_reverts() public {
        vm.prank(agent1);
        vm.expectRevert("Endpoint required");
        registry.registerService("analyst", "", 500_000);
    }

    function test_updateService_success() public {
        vm.startPrank(agent1);
        registry.registerService("analyst", "https://old.url", 500_000);
        registry.updateService(1, "https://new.url", 1_000_000);
        vm.stopPrank();

        IRegistry.Service memory s = registry.getService(1);
        assertEq(keccak256(bytes(s.endpoint)), keccak256(bytes("https://new.url")));
        assertEq(s.priceUsdt, 1_000_000);
    }

    function test_updateService_notOwner_reverts() public {
        vm.prank(agent1);
        registry.registerService("analyst", "https://api.url", 500_000);

        vm.prank(agent2);
        vm.expectRevert("Not service owner");
        registry.updateService(1, "https://new.url", 1_000_000);
    }

    function test_deactivateService_success() public {
        vm.startPrank(agent1);
        registry.registerService("analyst", "https://api.url", 500_000);
        registry.deactivateService(1);
        vm.stopPrank();

        IRegistry.Service memory s = registry.getService(1);
        assertFalse(s.active);
    }

    function test_getActiveServices_filtersInactive() public {
        vm.startPrank(agent1);
        registry.registerService("analyst", "https://a.url", 500_000);
        registry.registerService("auditor", "https://b.url", 200_000);
        registry.deactivateService(1);
        vm.stopPrank();

        IRegistry.Service[] memory active = registry.getActiveServices();
        assertEq(active.length, 1);
        assertEq(active[0].id, 2);
    }

    function test_getServicesByType_returnsMatching() public {
        vm.prank(agent1);
        registry.registerService("analyst", "https://a.url", 500_000);
        vm.prank(agent2);
        registry.registerService("analyst", "https://b.url", 600_000);
        vm.prank(agent1);
        registry.registerService("auditor", "https://c.url", 200_000);

        IRegistry.Service[] memory analysts = registry.getServicesByType("analyst");
        assertEq(analysts.length, 2);
    }

    function test_getServicesByAgent_returnsOwned() public {
        vm.startPrank(agent1);
        registry.registerService("analyst", "https://a.url", 500_000);
        registry.registerService("auditor", "https://b.url", 200_000);
        vm.stopPrank();

        vm.prank(agent2);
        registry.registerService("trader", "https://c.url", 300_000);

        IRegistry.Service[] memory agent1Services = registry.getServicesByAgent(agent1);
        assertEq(agent1Services.length, 2);
    }
}

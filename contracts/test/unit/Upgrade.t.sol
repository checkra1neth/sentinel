// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Registry} from "../../src/Registry.sol";
import {IRegistry} from "../../src/interfaces/IRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract RegistryV2 is Registry {
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}

contract UpgradeTest is Test {
    Registry public registry;
    address public owner = address(this);
    address public agent1 = makeAddr("agent1");

    function setUp() public {
        Registry impl = new Registry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(Registry.initialize, (owner))
        );
        registry = Registry(address(proxy));
    }

    function test_upgrade_preservesState() public {
        vm.prank(agent1);
        registry.registerService("analyst", "https://old.url", 500_000);

        RegistryV2 v2 = new RegistryV2();
        registry.upgradeToAndCall(address(v2), "");

        RegistryV2 registryV2 = RegistryV2(address(registry));
        assertEq(registryV2.version(), "2.0.0");
        assertEq(registryV2.serviceCount(), 1);

        IRegistry.Service memory s = registryV2.getService(1);
        assertEq(s.agent, agent1);
        assertEq(s.priceUsdt, 500_000);
    }

    function test_upgrade_notOwner_reverts() public {
        RegistryV2 v2 = new RegistryV2();
        vm.prank(agent1);
        vm.expectRevert();
        registry.upgradeToAndCall(address(v2), "");
    }

    function test_upgrade_newFunctionality() public {
        vm.prank(agent1);
        registry.registerService("analyst", "https://a.url", 500_000);

        RegistryV2 v2 = new RegistryV2();
        registry.upgradeToAndCall(address(v2), "");

        RegistryV2 registryV2 = RegistryV2(address(registry));

        vm.prank(agent1);
        registryV2.registerService("trader", "https://b.url", 300_000);
        assertEq(registryV2.serviceCount(), 2);
        assertEq(registryV2.version(), "2.0.0");
    }
}

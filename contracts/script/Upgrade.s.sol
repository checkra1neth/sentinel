// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Upgrade is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        Registry newImpl = new Registry();
        console.log("New implementation:", address(newImpl));

        UUPSUpgradeable proxy = UUPSUpgradeable(proxyAddress);
        proxy.upgradeToAndCall(address(newImpl), "");

        console.log("Upgraded proxy:", proxyAddress, "to impl:", address(newImpl));

        vm.stopBroadcast();
    }
}

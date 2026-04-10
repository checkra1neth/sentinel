// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SentinelCommerce} from "../src/SentinelCommerce.sol";

/// @notice Deploy SentinelCommerce to X Layer (Chain ID 196).
///         USDT on X Layer: 0x1E4a5963aBFD975d8c9021ce480b42188849D41d
contract DeploySentinelCommerce is Script {
    function run() external {
        address usdt = vm.envOr("USDT_ADDRESS", address(0x1E4a5963aBFD975d8c9021ce480b42188849D41d));

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        SentinelCommerce commerce = new SentinelCommerce(usdt);
        console.log("SentinelCommerce deployed:", address(commerce));
        console.log("Payment token (USDT):", usdt);

        vm.stopBroadcast();
    }
}

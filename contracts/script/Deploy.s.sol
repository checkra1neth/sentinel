// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Registry} from "../src/Registry.sol";
import {Escrow} from "../src/Escrow.sol";
import {Treasury} from "../src/Treasury.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract Deploy is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address uniswapRouter = vm.envAddress("UNISWAP_ROUTER");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // 1. Deploy Registry
        Registry regImpl = new Registry();
        ERC1967Proxy regProxy = new ERC1967Proxy(
            address(regImpl),
            abi.encodeCall(Registry.initialize, (deployer))
        );
        console.log("Registry proxy:", address(regProxy));
        console.log("Registry impl:", address(regImpl));

        // 2. Deploy Treasury (with placeholder escrow)
        Treasury treImpl = new Treasury();
        ERC1967Proxy treProxy = new ERC1967Proxy(
            address(treImpl),
            abi.encodeCall(Treasury.initialize, (deployer, usdt, address(0), uniswapRouter))
        );
        console.log("Treasury proxy:", address(treProxy));

        // 3. Deploy Escrow (with real treasury)
        Escrow escImpl = new Escrow();
        ERC1967Proxy escProxy = new ERC1967Proxy(
            address(escImpl),
            abi.encodeCall(Escrow.initialize, (deployer, address(regProxy), usdt, address(treProxy), 200, 3600))
        );
        console.log("Escrow proxy:", address(escProxy));

        // 4. Redeploy treasury with correct escrow
        treProxy = new ERC1967Proxy(
            address(treImpl),
            abi.encodeCall(Treasury.initialize, (deployer, usdt, address(escProxy), uniswapRouter))
        );
        console.log("Treasury proxy (final):", address(treProxy));

        // 5. Redeploy escrow with final treasury
        escProxy = new ERC1967Proxy(
            address(escImpl),
            abi.encodeCall(Escrow.initialize, (deployer, address(regProxy), usdt, address(treProxy), 200, 3600))
        );
        console.log("Escrow proxy (final):", address(escProxy));

        vm.stopBroadcast();

        console.log("=== DEPLOYED ===");
        console.log("Registry:", address(regProxy));
        console.log("Escrow:", address(escProxy));
        console.log("Treasury:", address(treProxy));
    }
}

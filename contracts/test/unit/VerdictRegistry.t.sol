// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VerdictRegistry} from "../../src/VerdictRegistry.sol";

contract VerdictRegistryTest is Test {
    VerdictRegistry public registry;
    address public sentinelAddr = makeAddr("sentinel");
    address public randomUser = makeAddr("randomUser");
    address public tokenAddr = makeAddr("token");

    event VerdictPublished(
        address indexed token,
        uint8 riskScore,
        string verdict,
        bool isHoneypot,
        bool hasRug,
        uint256 timestamp
    );

    function setUp() public {
        registry = new VerdictRegistry(sentinelAddr);
    }

    function test_constructor_sets_sentinel() public view {
        assertEq(registry.sentinel(), sentinelAddr);
    }

    function test_constructor_verdictCount_starts_at_zero() public view {
        assertEq(registry.verdictCount(), 0);
    }

    function test_publishVerdict_increments_count() public {
        vm.prank(sentinelAddr);
        registry.publishVerdict(tokenAddr, 85, "DANGEROUS", true, false);

        assertEq(registry.verdictCount(), 1);
    }

    function test_publishVerdict_emits_event() public {
        vm.prank(sentinelAddr);
        vm.expectEmit(true, false, false, true);
        emit VerdictPublished(tokenAddr, 85, "DANGEROUS", true, false, block.timestamp);
        registry.publishVerdict(tokenAddr, 85, "DANGEROUS", true, false);
    }

    function test_publishVerdict_multiple() public {
        vm.startPrank(sentinelAddr);
        registry.publishVerdict(tokenAddr, 20, "SAFE", false, false);
        registry.publishVerdict(makeAddr("token2"), 55, "CAUTION", false, false);
        registry.publishVerdict(makeAddr("token3"), 90, "DANGEROUS", true, true);
        vm.stopPrank();

        assertEq(registry.verdictCount(), 3);
    }

    function test_publishVerdict_nonSentinel_reverts() public {
        vm.prank(randomUser);
        vm.expectRevert("Not sentinel");
        registry.publishVerdict(tokenAddr, 85, "DANGEROUS", true, false);
    }

    function test_updateSentinel_success() public {
        address newSentinel = makeAddr("newSentinel");

        vm.prank(sentinelAddr);
        registry.updateSentinel(newSentinel);

        assertEq(registry.sentinel(), newSentinel);
    }

    function test_updateSentinel_nonSentinel_reverts() public {
        vm.prank(randomUser);
        vm.expectRevert("Not sentinel");
        registry.updateSentinel(randomUser);
    }

    function test_updateSentinel_then_old_sentinel_reverts() public {
        address newSentinel = makeAddr("newSentinel");

        vm.prank(sentinelAddr);
        registry.updateSentinel(newSentinel);

        vm.prank(sentinelAddr);
        vm.expectRevert("Not sentinel");
        registry.publishVerdict(tokenAddr, 50, "CAUTION", false, false);
    }

    function test_updateSentinel_then_new_sentinel_works() public {
        address newSentinel = makeAddr("newSentinel");

        vm.prank(sentinelAddr);
        registry.updateSentinel(newSentinel);

        vm.prank(newSentinel);
        registry.publishVerdict(tokenAddr, 50, "CAUTION", false, false);

        assertEq(registry.verdictCount(), 1);
    }
}

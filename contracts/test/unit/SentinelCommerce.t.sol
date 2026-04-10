// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SentinelCommerce} from "../../src/SentinelCommerce.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract SentinelCommerceTest is Test {
    SentinelCommerce public commerce;
    MockERC20 public usdt;

    address public sentinel = makeAddr("sentinel");
    address public guardian = makeAddr("guardian");
    address public operator_ = makeAddr("operator");
    address public stranger = makeAddr("stranger");

    uint256 public constant JOB_AMOUNT = 1_000_000; // 1 USDT (6 decimals)

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 6);
        commerce = new SentinelCommerce(address(usdt));

        // Fund sentinel with USDT and approve
        usdt.mint(sentinel, 100_000_000);
        vm.prank(sentinel);
        usdt.approve(address(commerce), type(uint256).max);
    }

    // ──────────────── createJob ────────────────

    function test_createJob_success() public {
        vm.prank(sentinel);
        uint256 jobId = commerce.createJob(guardian, JOB_AMOUNT);

        assertEq(jobId, 1);
        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(job.client, sentinel);
        assertEq(job.provider, guardian);
        assertEq(job.amount, JOB_AMOUNT);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Open));
        assertEq(job.resultHash, bytes32(0));
        assertEq(job.createdAt, uint64(block.timestamp));
        assertEq(job.completedAt, 0);
    }

    function test_createJob_incrementsId() public {
        vm.startPrank(sentinel);
        uint256 id1 = commerce.createJob(guardian, JOB_AMOUNT);
        uint256 id2 = commerce.createJob(operator_, JOB_AMOUNT);
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(commerce.nextJobId(), 3);
    }

    function test_createJob_zeroProvider_reverts() public {
        vm.prank(sentinel);
        vm.expectRevert(SentinelCommerce.InvalidProvider.selector);
        commerce.createJob(address(0), JOB_AMOUNT);
    }

    function test_createJob_zeroAmount_reverts() public {
        vm.prank(sentinel);
        vm.expectRevert(SentinelCommerce.InvalidAmount.selector);
        commerce.createJob(guardian, 0);
    }

    function test_createJob_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SentinelCommerce.JobCreated(1, sentinel, guardian, JOB_AMOUNT);

        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);
    }

    // ──────────────── fundJob ────────────────

    function test_fundJob_success() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.prank(sentinel);
        commerce.fundJob(1);

        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Funded));
        assertEq(usdt.balanceOf(address(commerce)), JOB_AMOUNT);
        assertEq(usdt.balanceOf(sentinel), 100_000_000 - JOB_AMOUNT);
    }

    function test_fundJob_notClient_reverts() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(SentinelCommerce.OnlyClient.selector);
        commerce.fundJob(1);
    }

    function test_fundJob_alreadyFunded_reverts() public {
        vm.startPrank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);
        commerce.fundJob(1);

        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Funded,
                SentinelCommerce.JobState.Open
            )
        );
        commerce.fundJob(1);
        vm.stopPrank();
    }

    function test_fundJob_emitsEvent() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.expectEmit(true, false, false, false);
        emit SentinelCommerce.JobFunded(1);

        vm.prank(sentinel);
        commerce.fundJob(1);
    }

    // ──────────────── submitResult ────────────────

    function test_submitResult_success() public {
        _createAndFundJob(guardian);

        bytes32 hash = keccak256("audit-report-v1");
        vm.prank(guardian);
        commerce.submitResult(1, hash);

        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Submitted));
        assertEq(job.resultHash, hash);
    }

    function test_submitResult_notProvider_reverts() public {
        _createAndFundJob(guardian);

        vm.prank(sentinel);
        vm.expectRevert(SentinelCommerce.OnlyProvider.selector);
        commerce.submitResult(1, keccak256("fake"));
    }

    function test_submitResult_notFunded_reverts() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.prank(guardian);
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Open,
                SentinelCommerce.JobState.Funded
            )
        );
        commerce.submitResult(1, keccak256("data"));
    }

    function test_submitResult_emitsEvent() public {
        _createAndFundJob(guardian);

        bytes32 hash = keccak256("result");
        vm.expectEmit(true, false, false, true);
        emit SentinelCommerce.JobSubmitted(1, hash);

        vm.prank(guardian);
        commerce.submitResult(1, hash);
    }

    // ──────────────── completeJob ────────────────

    function test_completeJob_success() public {
        _createFundAndSubmitJob(guardian);

        uint256 guardianBalBefore = usdt.balanceOf(guardian);

        vm.prank(sentinel);
        commerce.completeJob(1);

        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Completed));
        assertGt(job.completedAt, 0);
        assertEq(usdt.balanceOf(guardian), guardianBalBefore + JOB_AMOUNT);
        assertEq(usdt.balanceOf(address(commerce)), 0);
    }

    function test_completeJob_notClient_reverts() public {
        _createFundAndSubmitJob(guardian);

        vm.prank(guardian);
        vm.expectRevert(SentinelCommerce.OnlyClient.selector);
        commerce.completeJob(1);
    }

    function test_completeJob_notSubmitted_reverts() public {
        _createAndFundJob(guardian);

        vm.prank(sentinel);
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Funded,
                SentinelCommerce.JobState.Submitted
            )
        );
        commerce.completeJob(1);
    }

    function test_completeJob_emitsEvent() public {
        _createFundAndSubmitJob(guardian);

        vm.expectEmit(true, false, false, false);
        emit SentinelCommerce.JobCompleted(1);

        vm.prank(sentinel);
        commerce.completeJob(1);
    }

    // ──────────────── cancelJob ────────────────

    function test_cancelJob_open_success() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        uint256 balBefore = usdt.balanceOf(sentinel);

        vm.prank(sentinel);
        commerce.cancelJob(1);

        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Cancelled));
        // No refund for unfunded job
        assertEq(usdt.balanceOf(sentinel), balBefore);
    }

    function test_cancelJob_funded_refunds() public {
        _createAndFundJob(guardian);

        uint256 balBefore = usdt.balanceOf(sentinel);

        vm.prank(sentinel);
        commerce.cancelJob(1);

        SentinelCommerce.Job memory job = commerce.getJob(1);
        assertEq(uint8(job.state), uint8(SentinelCommerce.JobState.Cancelled));
        assertEq(usdt.balanceOf(sentinel), balBefore + JOB_AMOUNT);
        assertEq(usdt.balanceOf(address(commerce)), 0);
    }

    function test_cancelJob_notClient_reverts() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.prank(stranger);
        vm.expectRevert(SentinelCommerce.OnlyClient.selector);
        commerce.cancelJob(1);
    }

    function test_cancelJob_submitted_reverts() public {
        _createFundAndSubmitJob(guardian);

        vm.prank(sentinel);
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Submitted,
                SentinelCommerce.JobState.Open
            )
        );
        commerce.cancelJob(1);
    }

    function test_cancelJob_completed_reverts() public {
        _createFundAndSubmitJob(guardian);

        vm.prank(sentinel);
        commerce.completeJob(1);

        vm.prank(sentinel);
        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Completed,
                SentinelCommerce.JobState.Open
            )
        );
        commerce.cancelJob(1);
    }

    function test_cancelJob_alreadyCancelled_reverts() public {
        vm.startPrank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);
        commerce.cancelJob(1);

        vm.expectRevert(
            abi.encodeWithSelector(
                SentinelCommerce.InvalidState.selector,
                SentinelCommerce.JobState.Cancelled,
                SentinelCommerce.JobState.Open
            )
        );
        commerce.cancelJob(1);
        vm.stopPrank();
    }

    function test_cancelJob_emitsEvent() public {
        vm.prank(sentinel);
        commerce.createJob(guardian, JOB_AMOUNT);

        vm.expectEmit(true, false, false, false);
        emit SentinelCommerce.JobCancelled(1);

        vm.prank(sentinel);
        commerce.cancelJob(1);
    }

    // ──────────────── getJob ────────────────

    function test_getJob_nonexistent_reverts() public {
        vm.expectRevert(SentinelCommerce.JobNotFound.selector);
        commerce.getJob(999);
    }

    // ──────────────── Full lifecycle ────────────────

    function test_fullLifecycle_twoProviders() public {
        // Sentinel creates jobs for both Guardian and Operator
        vm.startPrank(sentinel);
        uint256 jobG = commerce.createJob(guardian, JOB_AMOUNT);
        uint256 jobO = commerce.createJob(operator_, 2_000_000);
        vm.stopPrank();

        assertEq(jobG, 1);
        assertEq(jobO, 2);

        // Fund both
        usdt.mint(sentinel, 2_000_000); // extra for second job
        vm.startPrank(sentinel);
        commerce.fundJob(1);
        commerce.fundJob(2);
        vm.stopPrank();

        assertEq(usdt.balanceOf(address(commerce)), JOB_AMOUNT + 2_000_000);

        // Guardian submits
        vm.prank(guardian);
        commerce.submitResult(1, keccak256("guardian-report"));

        // Operator submits
        vm.prank(operator_);
        commerce.submitResult(2, keccak256("operator-result"));

        // Sentinel completes both
        vm.startPrank(sentinel);
        commerce.completeJob(1);
        commerce.completeJob(2);
        vm.stopPrank();

        assertEq(usdt.balanceOf(guardian), JOB_AMOUNT);
        assertEq(usdt.balanceOf(operator_), 2_000_000);
        assertEq(usdt.balanceOf(address(commerce)), 0);
    }

    // ──────────────── Helpers ────────────────

    function _createAndFundJob(address provider) internal {
        vm.startPrank(sentinel);
        commerce.createJob(provider, JOB_AMOUNT);
        commerce.fundJob(1);
        vm.stopPrank();
    }

    function _createFundAndSubmitJob(address provider) internal {
        _createAndFundJob(provider);
        vm.prank(provider);
        commerce.submitResult(1, keccak256("result-data"));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SentinelCommerce
/// @notice ERC-8183-style escrow for agent-to-agent job coordination.
///         Sentinel (orchestrator) creates and funds jobs for Guardian/Operator providers.
///         Payment in USDT on X Layer (Chain ID 196).
contract SentinelCommerce {
    using SafeERC20 for IERC20;

    // ──────────────────── Types ────────────────────

    enum JobState {
        Open,
        Funded,
        Submitted,
        Completed,
        Cancelled
    }

    struct Job {
        address client;
        address provider;
        uint256 amount;
        JobState state;
        bytes32 resultHash;
        uint64 createdAt;
        uint64 completedAt;
    }

    // ──────────────────── Errors ────────────────────

    error InvalidProvider();
    error InvalidAmount();
    error JobNotFound();
    error OnlyClient();
    error OnlyProvider();
    error InvalidState(JobState current, JobState expected);

    // ──────────────────── Events ────────────────────

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider, uint256 amount);
    event JobFunded(uint256 indexed jobId);
    event JobSubmitted(uint256 indexed jobId, bytes32 resultHash);
    event JobCompleted(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId);

    // ──────────────────── State ────────────────────

    IERC20 public immutable paymentToken;

    uint256 private _nextJobId;
    mapping(uint256 => Job) private _jobs;

    // ──────────────────── Constructor ────────────────────

    /// @param _paymentToken Address of the ERC-20 payment token (USDT).
    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
        _nextJobId = 1;
    }

    // ──────────────────── Modifiers ────────────────────

    modifier onlyClient(uint256 jobId) {
        if (_jobs[jobId].client != msg.sender) revert OnlyClient();
        _;
    }

    modifier onlyProvider(uint256 jobId) {
        if (_jobs[jobId].provider != msg.sender) revert OnlyProvider();
        _;
    }

    modifier inState(uint256 jobId, JobState expected) {
        JobState current = _jobs[jobId].state;
        if (current != expected) revert InvalidState(current, expected);
        _;
    }

    // ──────────────────── External functions ────────────────────

    /// @notice Create a new job for a provider.
    /// @param provider The address that will perform the work.
    /// @param amount   Payment amount in payment token units.
    /// @return jobId   The unique identifier of the created job.
    function createJob(address provider, uint256 amount) external returns (uint256 jobId) {
        if (provider == address(0)) revert InvalidProvider();
        if (amount == 0) revert InvalidAmount();

        jobId = _nextJobId++;
        _jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            amount: amount,
            state: JobState.Open,
            resultHash: bytes32(0),
            createdAt: uint64(block.timestamp),
            completedAt: 0
        });

        emit JobCreated(jobId, msg.sender, provider, amount);
    }

    /// @notice Fund an open job by transferring payment token to this contract.
    /// @param jobId The job to fund.
    function fundJob(uint256 jobId)
        external
        onlyClient(jobId)
        inState(jobId, JobState.Open)
    {
        Job storage job = _jobs[jobId];
        paymentToken.safeTransferFrom(msg.sender, address(this), job.amount);
        job.state = JobState.Funded;

        emit JobFunded(jobId);
    }

    /// @notice Provider submits proof of completed work.
    /// @param jobId      The job being submitted for.
    /// @param resultHash Hash of the work result.
    function submitResult(uint256 jobId, bytes32 resultHash)
        external
        onlyProvider(jobId)
        inState(jobId, JobState.Funded)
    {
        Job storage job = _jobs[jobId];
        job.resultHash = resultHash;
        job.state = JobState.Submitted;

        emit JobSubmitted(jobId, resultHash);
    }

    /// @notice Client approves submitted work and releases payment to provider.
    /// @param jobId The job to complete.
    function completeJob(uint256 jobId)
        external
        onlyClient(jobId)
        inState(jobId, JobState.Submitted)
    {
        Job storage job = _jobs[jobId];
        job.state = JobState.Completed;
        job.completedAt = uint64(block.timestamp);

        paymentToken.safeTransfer(job.provider, job.amount);

        emit JobCompleted(jobId);
    }

    /// @notice Client cancels a job. Refunds if the job was funded.
    /// @param jobId The job to cancel.
    function cancelJob(uint256 jobId) external onlyClient(jobId) {
        Job storage job = _jobs[jobId];
        JobState current = job.state;

        // Can only cancel Open or Funded jobs (not Submitted/Completed/Cancelled)
        if (current != JobState.Open && current != JobState.Funded) {
            revert InvalidState(current, JobState.Open);
        }

        bool wasFunded = current == JobState.Funded;
        job.state = JobState.Cancelled;

        if (wasFunded) {
            paymentToken.safeTransfer(job.client, job.amount);
        }

        emit JobCancelled(jobId);
    }

    // ──────────────────── View functions ────────────────────

    /// @notice Get the details of a job.
    /// @param jobId The job identifier.
    /// @return The Job struct.
    function getJob(uint256 jobId) external view returns (Job memory) {
        if (_jobs[jobId].client == address(0)) revert JobNotFound();
        return _jobs[jobId];
    }

    /// @notice Get the next job ID (total jobs created = nextJobId - 1).
    function nextJobId() external view returns (uint256) {
        return _nextJobId;
    }
}

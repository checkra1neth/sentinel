// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerdictRegistry {
    event VerdictPublished(
        address indexed token,
        uint8 riskScore,
        string verdict,
        bool isHoneypot,
        bool hasRug,
        uint256 timestamp
    );

    address public sentinel;
    uint256 public verdictCount;

    modifier onlySentinel() {
        require(msg.sender == sentinel, "Not sentinel");
        _;
    }

    constructor(address _sentinel) {
        sentinel = _sentinel;
    }

    function publishVerdict(
        address token,
        uint8 riskScore,
        string calldata verdict,
        bool isHoneypot,
        bool hasRug
    ) external onlySentinel {
        verdictCount++;
        emit VerdictPublished(token, riskScore, verdict, isHoneypot, hasRug, block.timestamp);
    }

    function updateSentinel(address _sentinel) external onlySentinel {
        sentinel = _sentinel;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

contract Registry is Initializable, UUPSUpgradeable, OwnableUpgradeable, IRegistry {
    uint256 private _nextServiceId;
    mapping(uint256 => Service) private _services;
    uint256[] private _serviceIds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
        _nextServiceId = 1;
    }

    function registerService(
        string calldata serviceType,
        string calldata endpoint,
        uint256 priceUsdt
    ) external returns (uint256) {
        require(priceUsdt > 0, "Price must be > 0");
        require(bytes(endpoint).length > 0, "Endpoint required");

        uint256 id = _nextServiceId++;
        _services[id] = Service({
            id: id,
            agent: msg.sender,
            serviceType: serviceType,
            endpoint: endpoint,
            priceUsdt: priceUsdt,
            active: true
        });
        _serviceIds.push(id);

        emit ServiceRegistered(id, msg.sender, serviceType, priceUsdt);
        return id;
    }

    function updateService(uint256 serviceId, string calldata endpoint, uint256 priceUsdt) external {
        Service storage s = _services[serviceId];
        require(s.agent == msg.sender, "Not service owner");
        require(priceUsdt > 0, "Price must be > 0");
        require(bytes(endpoint).length > 0, "Endpoint required");

        s.endpoint = endpoint;
        s.priceUsdt = priceUsdt;

        emit ServiceUpdated(serviceId, endpoint, priceUsdt);
    }

    function deactivateService(uint256 serviceId) external {
        Service storage s = _services[serviceId];
        require(s.agent == msg.sender, "Not service owner");

        s.active = false;
        emit ServiceDeactivated(serviceId);
    }

    function getService(uint256 serviceId) external view returns (Service memory) {
        return _services[serviceId];
    }

    function getActiveServices() external view returns (Service[] memory) {
        uint256 count;
        for (uint256 i; i < _serviceIds.length; i++) {
            if (_services[_serviceIds[i]].active) count++;
        }

        Service[] memory result = new Service[](count);
        uint256 idx;
        for (uint256 i; i < _serviceIds.length; i++) {
            if (_services[_serviceIds[i]].active) {
                result[idx++] = _services[_serviceIds[i]];
            }
        }
        return result;
    }

    function getServicesByType(string calldata serviceType) external view returns (Service[] memory) {
        bytes32 typeHash = keccak256(bytes(serviceType));
        uint256 count;
        for (uint256 i; i < _serviceIds.length; i++) {
            Service storage s = _services[_serviceIds[i]];
            if (s.active && keccak256(bytes(s.serviceType)) == typeHash) count++;
        }

        Service[] memory result = new Service[](count);
        uint256 idx;
        for (uint256 i; i < _serviceIds.length; i++) {
            Service storage s = _services[_serviceIds[i]];
            if (s.active && keccak256(bytes(s.serviceType)) == typeHash) {
                result[idx++] = s;
            }
        }
        return result;
    }

    function getServicesByAgent(address agent) external view returns (Service[] memory) {
        uint256 count;
        for (uint256 i; i < _serviceIds.length; i++) {
            if (_services[_serviceIds[i]].agent == agent) count++;
        }

        Service[] memory result = new Service[](count);
        uint256 idx;
        for (uint256 i; i < _serviceIds.length; i++) {
            if (_services[_serviceIds[i]].agent == agent) {
                result[idx++] = _services[_serviceIds[i]];
            }
        }
        return result;
    }

    function serviceCount() external view returns (uint256) {
        return _nextServiceId - 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    uint256[50] private __gap;
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

interface IDAO {
    function isFeeToChangeAvailable(uint id) external view returns (address);
    function confirmFeeToChangeRequest(uint id) external returns (bool);

    function isTreasuryChangeAvailable(uint id) external view returns (address);
    function confirmTreasuryChangeRequest(uint id) external returns (bool);

    function isRouterChangeAvailable(uint id) external view returns (address);
    function confirmRouterChangeRequest(uint id) external returns (bool);

    function isDAOChangeAvailable(uint id) external view returns (address);
    function confirmDAOChangeRequest(uint id) external returns (bool);
}
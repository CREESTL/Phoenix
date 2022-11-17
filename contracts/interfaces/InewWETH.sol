// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.5.0;

interface InewWETH {
    receive() external payable;
    function mint(address account, uint256 amount) external;
    function burn(address account, uint256 amount) external;
    function transfer(address to, uint value) external returns (bool);
}

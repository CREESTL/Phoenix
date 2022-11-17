// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.5.0;

interface IUniswapV2Factory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function initialDaoSetter() external view returns (address);
    function daoAddress() external view returns (address);

    function routerAddress() external view returns (address);
    function treasuryAddress() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setDAOContractInitial(address) external;
    function setFeeTo(uint) external;
    function setTreasuryAddress(uint) external;
    function setRouterAddress(uint) external;
    function setDao(uint) external;
}

// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.6.12;

import './interfaces/IUniswapV2Factory.sol';
import './UniswapV2Pair.sol';
import "./dao/IDAO.sol";

contract UniswapV2Factory is IUniswapV2Factory {
    bytes32 public constant INIT_CODE_PAIR_HASH = keccak256(abi.encodePacked(type(UniswapV2Pair).creationCode));
    address public override feeTo;

    mapping(address => mapping(address => address)) public override getPair;
    address[] public override allPairs;

    address public override initialDaoSetter; /// @dev address for setting the initial DAO address
    address public override routerAddress; /// @dev UniswapV2Router02 address
    address public override treasuryAddress; /// @dev address for sending fee

    address public override daoAddress;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _initialDaoSetter, address _treasuryAddress) public {
        initialDaoSetter = _initialDaoSetter;
        treasuryAddress = _treasuryAddress;
    }

    function allPairsLength() external override view returns (uint) {
        return allPairs.length;
    }

    function pairCodeHash() external pure returns (bytes32) {
        return keccak256(type(UniswapV2Pair).creationCode);
    }

    function createPair(address tokenA, address tokenB) external override returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        UniswapV2Pair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    /**
        @notice Sets DAO contract address only once by initial DaoSetter
        @param _address The DAO address
     */
    function setDAOContractInitial(address _address) external override {
        require(initialDaoSetter == msg.sender, "not daoSetter");
        require(daoAddress == address(0), "already set");
        require(_address != address(0), "zero address");
        uint32 size;
        assembly {
            size := extcodesize(_address)
        }
        require(size > 0, "EOA");
        daoAddress = _address;
    }

    function setDao(uint id) external override {
        address _daoAddress = IDAO(daoAddress).isDAOChangeAvailable(id);
        require(_daoAddress != daoAddress, 'same address');
        daoAddress = _daoAddress;
        require(IDAO(daoAddress).confirmDAOChangeRequest(id), "confirmed");
    }

    function setFeeTo(uint id) external override {
        address _feeTo = IDAO(daoAddress).isFeeToChangeAvailable(id);
        require(_feeTo != feeTo, 'same address');
        feeTo = _feeTo;
        require(IDAO(daoAddress).confirmFeeToChangeRequest(id), "confirmed");
    }

    function setTreasuryAddress(uint id) external override {
        address _treasuryAddress = IDAO(daoAddress).isTreasuryChangeAvailable(id);
        require(_treasuryAddress != treasuryAddress, 'same address');
        treasuryAddress = _treasuryAddress;
        require(IDAO(daoAddress).confirmTreasuryChangeRequest(id), "confirmed");
    }

    function setRouterAddress(uint id) external override {
        address _routerAddress = IDAO(daoAddress).isRouterChangeAvailable(id);
        require(_routerAddress != routerAddress, 'same address');
        routerAddress = _routerAddress;
        require(IDAO(daoAddress).confirmRouterChangeRequest(id), "confirmed");
    }

}
// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;
pragma experimental ABIEncoderV2;

import "./IDAO.sol";
import "./Multisig.sol";

/// @title Decentralized autonomous organization for Swap_Factory
/// @notice DAO contract, which provides Swap_Factory functions manipulation 
contract UniswapDAO is Multisig, IDAO {
    struct DAOChangeRequest {
        address newDAOAddress;
        RequestStatus status;
    }

    struct FeeToChangeRequest {
        address newFeeToAddress;
        RequestStatus status;
    }

    struct TreasuryChangeRequest {
        address newTreasuryAddress;
        RequestStatus status;
    }

    struct RouterChangeRequest {
        address newRouterAddress;
        RequestStatus status;
    }

    // mapping of dao change requests
    mapping(uint => DAOChangeRequest) private daoChangeRequests;
    // mapping of signs of  dao change requests
    mapping(uint => mapping(address => bool)) private daoChangeRequestConfirmations;
    // id for new dao change request
    uint private daoChangeRequestCounter;

    // mapping of feeTo change requests
    mapping(uint => FeeToChangeRequest) private feeToChangeRequests;
    // mapping of feeTo change request confirmations
    mapping(uint => mapping(address => bool)) private feeToChangeRequestConfirmations;
    // id for new feeTo change request
    uint private feeToChangeRequestCounter;

    // mapping of treasury change requests
    mapping(uint => TreasuryChangeRequest) private treasuryChangeRequests;
    // mapping of treasury change confirmations
    mapping(uint => mapping(address => bool)) private treasuryChangeRequestConfirmations;
    // id for new treasury change request
    uint private treasuryChangeRequestCounter;

    // mapping of router change requests
    mapping(uint => RouterChangeRequest) private routerChangeRequests;
    // mapping of signs of  router change requests
    mapping(uint => mapping(address => bool)) private routerChangeRequestConfirmations;
    // id for new router change request
    uint private routerChangeRequestCounter;

    address private immutable factoryhAddress;

    /**
     * @notice Throws error if any contract except factory trys to call the function
    */
    modifier onlyFactory() {
        require(factoryhAddress == msg.sender, "not bridge address");
        _;
    }

    /**
     * @param _factoryhAddress the address of factory
    */
    constructor(address _factoryhAddress) public {
        factoryhAddress = _factoryhAddress;
    }

    /**
     * @notice Gets DAO change request Count
     * @return Returns DAO change request Count 
    */
    function getDAOChangeRequestCount() external view returns(uint) {
        return daoChangeRequestCounter;
    }

    /**
     * @notice Gets feeTo change request Count
     * @return Returns feeTo change request Count 
    */
    function getFeeToChangeRequestCount() external view returns(uint) {
        return feeToChangeRequestCounter;
    }

    /**
     * @notice Gets treasury change request count
     * @return Returns treasury change request count 
    */
    function getTreasuryChangeRequestCount() external view returns(uint) {
        return treasuryChangeRequestCounter;
    }

    /**
     * @notice Gets router change request count
     * @return Returns router change request count 
    */
    function getRouterChangeRequestCount() external view returns(uint) {
        return routerChangeRequestCounter;
    }

    /**
     * @notice Gets changing feeTo request
     * @param id the id of change feeTo request
    */
    function getDAOChangeRequest(uint id) external view returns (DAOChangeRequest memory) {
        return daoChangeRequests[id];
    }

    /**
     * @notice Gets changing feeTo reques
     * @param id the id of change feeTo request
    */
    function getFeeToChangeRequest(uint id) external view returns (FeeToChangeRequest memory) {
        return feeToChangeRequests[id];
    }

    /**
     * @notice Gets changing treasury request
     * @param id the id of change treasury request
    */
    function getTreasuryChangeRequest(uint id) external view returns (TreasuryChangeRequest memory) {
        return treasuryChangeRequests[id];
    }

    /**
     * @notice Gets changing router request
     * @param id the id of change router request
    */
    function getRouterChangeRequest(uint id) external view returns (RouterChangeRequest memory) {
        return routerChangeRequests[id];
    }

    /**
     * @notice Allows changing feeTo request if it is not approved and there are enough votes
     * @param id the id of change feeTo request
    */
    function isFeeToChangeAvailable(uint id) 
        external 
        view 
        override
        returns (address)
    {
        require(feeToChangeRequests[id].status == RequestStatus.Active, "not active");
        _consensus(feeToChangeRequestConfirmations, id);
        return feeToChangeRequests[id].newFeeToAddress;
    }

    /**
     * @notice Counts and gets affirmative votes for change feeTo request
     * @param id request id to be executed
    */
    function countGetChangeFeeToAffirmativeVotes(uint id) external view returns(uint) {
        return _countGet(feeToChangeRequestConfirmations, id);
    }

    /**
     * @notice Cancels feeTo change request if it is active
     * @param id the id of feeTo change request
    */
    function cancelFeeToChangeRequest(uint id) external onlyVoter(msg.sender) {
        require(feeToChangeRequests[id].status == RequestStatus.Active, "not active");
        feeToChangeRequests[id].status = RequestStatus.Canceled;
    }

    /**
     * @notice Approves changing feeTo request if it is not approved
     * @param id the id of feeTo change request
    */
    function confirmFeeToChangeRequest(uint id) 
        external 
        override
        onlyFactory
        returns (bool)
    {
        require(feeToChangeRequests[id].status == RequestStatus.Active, "not active");
        feeToChangeRequests[id].status = RequestStatus.Executed;
        return true;
    }

    /**
     * @notice Allows a voter to insert a confirmation for feeTo change request 
     * if it is not approved and not confirmed
     * @param voteType the vote type: true/false = insert/remove vote
     * @param id the id of feeTo change request
    */
    function newVoteForFeeToChangeRequest(bool voteType, uint id) external {
        require(feeToChangeRequests[id].status == RequestStatus.Active, "not active");
        _newVoteFor(feeToChangeRequestConfirmations, id, voteType, RequestType.FeeToChange);
    }

    /**
     * @notice Creation of change feeTo request by any voter
     * @param _address new feeTo address
    */
    function newFeeToChangeRequest(address _address)
        external
        onlyVoter(msg.sender)
        returns (uint)
    {
        require(_address!= address(0), "zero address");
        feeToChangeRequestCounter = feeToChangeRequestCounter + 1;
        
        feeToChangeRequests[feeToChangeRequestCounter] = FeeToChangeRequest({
            newFeeToAddress: _address,
            status: RequestStatus.Active
        });
        
        feeToChangeRequestConfirmations[feeToChangeRequestCounter][msg.sender] = true;
        emit NewVoteForRequest(RequestType.FeeToChange, true, msg.sender, feeToChangeRequestCounter);
        return feeToChangeRequestCounter;
    }

    /**
     * @notice Allows changing treasury request if it is not approved and there are enough votes
     * @param id the id of change treasury request
    */
    function isTreasuryChangeAvailable(uint id) 
        external 
        view 
        override
        returns (address)
    {
        require(treasuryChangeRequests[id].status == RequestStatus.Active, "not active");
        _consensus(treasuryChangeRequestConfirmations, id);
        return treasuryChangeRequests[id].newTreasuryAddress;
    }

    /**
     * @notice Counts and gets affirmative votes for change treasury request
     * @param id request id to be executed
    */
    function countGetChangeTreasuryAffirmativeVotes(uint id) external view returns(uint) {
        return _countGet(treasuryChangeRequestConfirmations, id);
    }

    /**
     * @notice Cancels treasury change request if it is active
     * @param id the id of treasury change request
    */
    function cancelTreasuryChangeRequest(uint id) external onlyVoter(msg.sender) {
        require(treasuryChangeRequests[id].status == RequestStatus.Active, "not active");
        treasuryChangeRequests[id].status = RequestStatus.Canceled;
    }

    /**
     * @notice Approves changing treasury request if it is not approved
     * @param id the id of treasury change request
    */
    function confirmTreasuryChangeRequest(uint id) 
        external 
        override
        onlyFactory
        returns (bool)
    {
        require(treasuryChangeRequests[id].status == RequestStatus.Active, "not active");
        treasuryChangeRequests[id].status = RequestStatus.Executed;
        return true;
    }

    /**
     * @notice Allows a voter to insert a confirmation for treasury change request 
     * if it is not approved and not confirmed
     * @param voteType the vote type: true/false = insert/remove vote
     * @param id the id of treasury change request
    */
    function newVoteForTreasuryChangeRequest(bool voteType, uint id) external {
        require(treasuryChangeRequests[id].status == RequestStatus.Active, "not active");
        _newVoteFor(treasuryChangeRequestConfirmations, id, voteType, RequestType.TreasuryChange);
    }

    /**
     * @notice Creation of change treasury request by any voter
     * @param _address new treasury address
    */
    function newTreasuryChangeRequest(address _address)
        external
        onlyVoter(msg.sender)
        returns (uint)
    {
        require(_address!= address(0), "zero address");
        treasuryChangeRequestCounter = treasuryChangeRequestCounter + 1;
        
        treasuryChangeRequests[treasuryChangeRequestCounter] = TreasuryChangeRequest({
            newTreasuryAddress: _address,
            status: RequestStatus.Active
        });
        
        treasuryChangeRequestConfirmations[treasuryChangeRequestCounter][msg.sender] = true;
        emit NewVoteForRequest(RequestType.TreasuryChange, true, msg.sender, treasuryChangeRequestCounter);
        return treasuryChangeRequestCounter;
    }

        /**
     * @notice Allows changing router request if it is not approved and there are enough votes
     * @param id the id of change router request
    */
    function isRouterChangeAvailable(uint id) 
        external 
        view 
        override
        returns (address)
    {
        require(routerChangeRequests[id].status == RequestStatus.Active, "not active");
        _consensus(routerChangeRequestConfirmations, id);
        return routerChangeRequests[id].newRouterAddress;
    }

    /**
     * @notice Counts and gets affirmative votes for change router request
     * @param id request id to be executed
    */
    function countGetChangeRouterAffirmativeVotes(uint id) external view returns(uint) {
        return _countGet(routerChangeRequestConfirmations, id);
    }

    /**
     * @notice Cancels router change request if it is active
     * @param id the id of router change request
    */
    function cancelRouterChangeRequest(uint id) external onlyVoter(msg.sender) {
        require(routerChangeRequests[id].status == RequestStatus.Active, "not active");
        routerChangeRequests[id].status = RequestStatus.Canceled;
    }

    /**
     * @notice Approves changing router request if it is not approved
     * @param id the id of router change request
    */
    function confirmRouterChangeRequest(uint id) 
        external 
        override
        onlyFactory
        returns (bool)
    {
        require(routerChangeRequests[id].status == RequestStatus.Active, "not active");
        routerChangeRequests[id].status = RequestStatus.Executed;
        return true;
    }

    /**
     * @notice Allows a voter to insert a confirmation for router change request 
     * if it is not approved and not confirmed
     * @param voteType the vote type: true/false = insert/remove vote
     * @param id the id of router change request
    */
    function newVoteForRouterChangeRequest(bool voteType, uint id) external {
        require(routerChangeRequests[id].status == RequestStatus.Active, "not active");
        _newVoteFor(routerChangeRequestConfirmations, id, voteType, RequestType.RouterChange);
    }

    /**
     * @notice Creation of change router request by any voter
     * @param _address new router address
    */
    function newRouterChangeRequest(address _address)
        external
        onlyVoter(msg.sender)
        returns (uint)
    {
        require(_address!= address(0), "zero address");
        uint32 size;
        assembly {
            size := extcodesize(_address)
        }
        require(size > 0, "EOA");
        routerChangeRequestCounter = routerChangeRequestCounter + 1;        
        routerChangeRequests[routerChangeRequestCounter] = RouterChangeRequest({
            newRouterAddress: _address,
            status: RequestStatus.Active
        });
        
        routerChangeRequestConfirmations[routerChangeRequestCounter][msg.sender] = true;
        emit NewVoteForRequest(RequestType.RouterChange, true, msg.sender, routerChangeRequestCounter);
        return routerChangeRequestCounter;
    }

      /**
     * @notice Allows changing dao request if it is not approved and there are enough votes
     * @param id the id of change dao request
    */
    function isDAOChangeAvailable(uint id) 
        external 
        view 
        override
        returns (address)
    {
        require(daoChangeRequests[id].status == RequestStatus.Active, "not active");
        _consensus(daoChangeRequestConfirmations, id);
        return daoChangeRequests[id].newDAOAddress;
    }

    /**
     * @notice Counts and gets affirmative votes for change dao request
     * @param id request id to be executed
    */
    function countGetChangeDAOAffirmativeVotes(uint id) external view returns(uint) {
        return _countGet(daoChangeRequestConfirmations, id);
    }

    /**
     * @notice Cancels dao change request if it is active
     * @param id the id of dao change request
    */
    function cancelDAOChangeRequest(uint id) external onlyVoter(msg.sender) {
        require(daoChangeRequests[id].status == RequestStatus.Active, "not active");
        daoChangeRequests[id].status = RequestStatus.Canceled;
    }

    /**
     * @notice Approves changing dao request if it is not approved
     * @param id the id of dao change request
    */
    function confirmDAOChangeRequest(uint id) 
        external 
        override
        onlyFactory
        returns (bool)
    {
        require(daoChangeRequests[id].status == RequestStatus.Active, "not active");
        daoChangeRequests[id].status = RequestStatus.Executed;
        return true;
    }

    /**
     * @notice Allows a voter to insert a confirmation for dao change request 
     * if it is not approved and not confirmed
     * @param voteType the vote type: true/false = insert/remove vote
     * @param id the id of dao change request
    */
    function newVoteForDAOChangeRequest(bool voteType, uint id) external {
        require(daoChangeRequests[id].status == RequestStatus.Active, "not active");
        _newVoteFor(daoChangeRequestConfirmations, id, voteType, RequestType.DAOChange);
    }

    /**
     * @notice Creation of change dao request by any voter
     * @param _address new dao address
    */
    function newDAOAddressChangeRequest(address _address)
        external
        onlyVoter(msg.sender)
        returns (uint)
    {
        require(_address!= address(0), "zero address");
        uint32 size;
        assembly {
            size := extcodesize(_address)
        }
        require(size > 0, "EOA");
        daoChangeRequestCounter = daoChangeRequestCounter + 1;
        
        daoChangeRequests[daoChangeRequestCounter] = DAOChangeRequest({
            newDAOAddress: _address,
            status: RequestStatus.Active
        });
        
        daoChangeRequestConfirmations[daoChangeRequestCounter][msg.sender] = true;
        emit NewVoteForRequest(RequestType.DAOChange, true, msg.sender, daoChangeRequestCounter);
        return daoChangeRequestCounter;
    }
}
// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;
pragma experimental ABIEncoderV2;

/// @title Multisignature contract implementation
/// @notice Multisig contract, which provides multisig functions that could be implemented when needed
contract Multisig {
    enum RequestStatus {
        Canceled,
        Active,
        Executed
    }

    enum RequestType {
        VoterChange,
        DAOChange,
        FeeToChange,
        TreasuryChange,
        RouterChange
    }

    event ChangeVoter(address indexed _address, bool indexed include);
    event NewVoteForRequest(RequestType indexed requestType, bool voteType, address indexed sender, uint indexed requestId);

    // mapping voter id => voter address
    mapping(uint => address) private voterIds;
    // mapping is address a voter
    mapping(address => bool) private voters;
    // all voters count
    uint private votersCounter;
    // confimerd voters count
    uint private activeVotersCount;

    // vote request for inserting/removing voters
    struct VoterRequest {
        address candidate;
        bool include;
        RequestStatus status;
    }

    // mapping of voter requests in order to insert/remove voters
    mapping(uint => VoterRequest) private voterRequests;
    // mapping of required confirmations in order to approve voter request
    mapping(uint => mapping(address => bool)) private voterConfirmations;
    // count of vote requests
    uint private voterRequestsCounter;

    /**
     * @notice Throws if address is not a voter
     * @param _address the checking address
    */
    modifier onlyVoter(address _address) {
        require(voters[_address], "not a voter");
        _;
    }

    constructor() public {
        insertVoter(msg.sender);
    }
    
    /**
     * @notice Returns voter address by id if id != 0
     * @param id the id of voter 
    */
    function getVoterById(uint id) public view returns (address) {
        return voterIds[id];
    }

    /**
     * @notice Returns the address precense in voters list 
     * if address != zero address
     * @param _address the checking address 
    */
    function getVoterStatusByAddress(address _address) public view returns (bool) {
        require(_address != address(0), "zero address");
        return voters[_address];
    }

    /**
     * @notice Returns overall Voters Count
    */
    function getActiveVotersCount() public view returns(uint) {
        return activeVotersCount;
    }

    /**
     * @notice Returns voters list counter
    */
    function getVotersCounter() internal view returns(uint) {
        return votersCounter;
    }

    /**
     * @notice Returns voters request
    */
    function getVoterRequest(uint id) external view returns(VoterRequest memory) {
        return voterRequests[id];
    }

    /**
     * @notice Adds new voter to the voter list 
     * if address is not zero address and is not a voter
     * @dev Triggers insert event(logging inserted address)
     * @param newVoterAddress the address, which should be added
    */
    function insertVoter(address newVoterAddress) private {
        require(newVoterAddress != address(0), "zero address");
        require(!voters[newVoterAddress], "already a voter");
        voters[newVoterAddress] = true;
        activeVotersCount++;
        voterIds[votersCounter++] = newVoterAddress;
    }

    /** 
     * @notice Removes voter from the voter list 
     * if address is not zero address and is already a voter
     * @dev Triggers remove event(logging removed address)
     * @param oldVoterAddress the address, which should be removed
    */
    function removeVoter(address oldVoterAddress) private onlyVoter(oldVoterAddress) {
        voters[oldVoterAddress] = false;
        activeVotersCount--;
    }

    function _newVoteFor(mapping(uint => mapping(address => bool)) storage confirmations, uint id, bool voteType, RequestType requestType) 
        internal onlyVoter(msg.sender) 
    {  
        if(voteType) {
            require(!confirmations[id][msg.sender], "already confirmed");
        }
        else {
            require(confirmations[id][msg.sender], "not confirmed");
        }
        confirmations[id][msg.sender] = voteType;
        emit NewVoteForRequest(requestType, voteType, msg.sender, id);
    }

    function _countGet(mapping(uint => mapping(address => bool)) storage confirmations, uint id) 
        internal view returns(uint affirmativeVotesCount) 
    {
        for(uint i = 0; i <= getVotersCounter(); i++) {
            if(confirmations[id][getVoterById(i)] && getVoterStatusByAddress(getVoterById(i))) {
                affirmativeVotesCount++;
            }
        }
    }

    function _consensus(mapping(uint => mapping(address => bool)) storage confirmations, uint id) internal view {
         require(_countGet(confirmations, id) * 100 > (getActiveVotersCount() * 100) / 2, "not enough votes");
    }

    /**
     * @notice Allows a voter to insert a confirmation for a transaction
     * if sender is a voter, voter request is confirmed, voter request is not approved 
     * @param voteType the vote type: true/false = insert/remove vote
     * @param id voter request id
    */ 
    function newVoteForVoterRequest(bool voteType, uint id) external onlyVoter(msg.sender) {
        require(voterRequests[id].candidate != address(0), "voter address is zero");
        require(voterRequests[id].status == RequestStatus.Active, "not active");
        _newVoteFor(voterConfirmations, id, voteType, RequestType.VoterChange);
    }

    /**
     * @notice Allows a voter to add a confirmation for a request
     * if sender is a voter, voter request is confirmed, voter request is not approved  
     * @param voterAddress new voter address
     * @param include insert/remove(true/false) voter from voter list
    */
    function newVoterRequest(bool include, address voterAddress) external onlyVoter(msg.sender) {
        require(voterAddress != address(0), "zero address");
        if(include) {
            require(!voters[voterAddress], "already a voter");
        } 
        else {
            require(voters[voterAddress], "not a voter");
        }
        voterRequestsCounter = voterRequestsCounter + 1;
        voterRequests[voterRequestsCounter] = VoterRequest({
            candidate: voterAddress,
            include: include,
            status: RequestStatus.Active
        });
        voterConfirmations[voterRequestsCounter][msg.sender] = true;
        emit NewVoteForRequest(RequestType.VoterChange, true, msg.sender, voterRequestsCounter);
    }

    /**
     * @notice Counts and gets affirmative votes for voter request
     * @param id request id to be executed
    */
    function countGetVotersAffirmativeVotes(uint id) external view returns(uint) {
        return _countGet(voterConfirmations, id);
    }

    /**
     * @notice Approves voter request if there is enough votes and request is not executed 
     * @param id request id to be executed
    */
    function votersRequestConclusion(uint id) external {
        require(voterRequests[id].status == RequestStatus.Active, "not active");
        _consensus(voterConfirmations, id);
        if(voterRequests[id].include) {
            insertVoter(voterRequests[id].candidate);
        }
        else {
            removeVoter(voterRequests[id].candidate);
        }

        emit ChangeVoter(voterRequests[id].candidate, voterRequests[id].include);

        voterRequests[id].status = RequestStatus.Executed;
    }

    /**
     * @notice Cancels voter request 
     * @param id request id to be canceled
    */
    function cancelVoterRequest(uint id) external onlyVoter(msg.sender) {
        require(voterRequests[id].status == RequestStatus.Active, "not active");
        voterRequests[id].status = RequestStatus.Canceled;
    }
}
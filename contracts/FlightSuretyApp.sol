pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                          STRUCTS                                         */
    /********************************************************************************************/

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    struct AirlineRegistrationApproval {
        uint numOfAirlinesWhenApproved;
        address[] votes;
    }

    struct Insurance {
        uint amount;
        uint credit;
    }

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Blocks all state changes throughout the contract if false
    bool private operational = true;

    //Data contract instance
    FlightSuretyData flightSuretyData;

    // Business logic variables
    uint8 private constant AIRLINE_REGISTER_MIN_TO_CONSENSUS = 4;
    uint8 private constant AIRLINE_REGISTER_CONSENSUS_PERCENTAGE_FACTOR = 50;
    uint private constant AIRLINE_FUNDING_AMOUNT = 10 ether;
    uint private constant INSURANCE_MAX_AMOUNT = 1 ether;
    uint private constant INSURANCE_CREDIT_PERCENTAGE = 150;

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    // Account used to deploy contract
    address private contractOwner;

    // Flights
    mapping(bytes32 => Flight) private flights;

    // Approvals for airline registration
    mapping(address => AirlineRegistrationApproval) private airlineRegistrationApprovals;

 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the airline to be funded
    */
    modifier requireIsAirlineFunded(address airlineAddress) {
        require(flightSuretyData.isAirlineFunded(airlineAddress), "Airline not funded!");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor( address dataContract) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool) {
        return operational;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus ( bool mode ) external requireContractOwner {
        operational = mode;
    }

    /**
    * @dev Checks if sender has already voted to register an airline
    *
    * @return A bool that is the has voted state of the sender for a given airline registration
    */
    function hasVotedToRegisterAirline(address airlineAddress) private view returns(bool) {
        for(uint i = 0; i < airlineRegistrationApprovals[airlineAddress].votes.length; i++) {
            if (airlineRegistrationApprovals[airlineAddress].votes[i] == msg.sender) {
                return true;
            }
        }
        return false;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Funds an airline
    */
    function fund() external requireIsOperational payable {
        require(msg.value == AIRLINE_FUNDING_AMOUNT, "Must fund exactly 10 ether");
        flightSuretyData.fund.value(msg.value)();
    }

   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline( address airlineAddress, string airlineName ) external requireIsOperational requireIsAirlineFunded(msg.sender) returns(bool success, uint256 votes) {
        require(!flightSuretyData.isAirlineRegistered(airlineAddress), 'Airline already registered!');

        uint totalAirlines = flightSuretyData.getNumberOfAirlinesRegistered();

        if(totalAirlines < AIRLINE_REGISTER_MIN_TO_CONSENSUS){
            flightSuretyData.registerAirline(airlineAddress, airlineName);
            airlineRegistrationApprovals[airlineAddress].numOfAirlinesWhenApproved = totalAirlines;
            airlineRegistrationApprovals[airlineAddress].votes.push(msg.sender);
            success = true;
        }
        else if( airlineRegistrationApprovals[airlineAddress].votes.length < totalAirlines.mul(AIRLINE_REGISTER_CONSENSUS_PERCENTAGE_FACTOR).div(100).sub(1) ){
            if( airlineRegistrationApprovals[airlineAddress].votes.length == 0 ){
                airlineRegistrationApprovals[airlineAddress].votes.push(msg.sender);
            }
            else{
                require(!hasVotedToRegisterAirline(airlineAddress), 'Already voted to register this airline!');
                airlineRegistrationApprovals[airlineAddress].votes.push(msg.sender);
            }

            success = false;
        }
        else{
            flightSuretyData.registerAirline(airlineAddress, airlineName);
            airlineRegistrationApprovals[airlineAddress].votes.push(msg.sender);
            airlineRegistrationApprovals[airlineAddress].numOfAirlinesWhenApproved = totalAirlines;
            success = true;
        }
        votes = airlineRegistrationApprovals[airlineAddress].votes.length;
    }


   /**
    * @dev Register a flight insurance purchase.
    *
    */  
    function registerFlightInsurance(address airline, string flight) external requireIsOperational requireIsAirlineFunded(airline) payable returns(string, string, uint) {
        require(msg.value <= INSURANCE_MAX_AMOUNT, 'Insurance funds must not exceed 1 ether');
        return flightSuretyData.buy.value(msg.value)(airline, flight);
    }
    
   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus ( address airlineAddress, string memory flight, uint8 statusCode ) internal requireIsOperational {
        if(statusCode == STATUS_CODE_LATE_AIRLINE){
            flightSuretyData.creditInsurees(airlineAddress, flight, INSURANCE_CREDIT_PERCENTAGE);
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus( address airline, string flight, uint256 timestamp ) external requireIsOperational {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    // Transfer insurance credit to passenger
    function withdraw( address airlineAddress, string flight ) external requireIsOperational {
        flightSuretyData.pay(airlineAddress, flight);
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
            isRegistered: true,
            indexes: indexes
        });
    }

    function getMyIndexes() view external returns(uint8[3]) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse ( uint8 index, address airline, string flight, uint256 timestamp, uint8 statusCode ) external {
        emit OracleReport(airline, flight, timestamp, statusCode);
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");

        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, statusCode);
        }
    }

    function getFlightKey( address airline, string flight, uint256 timestamp ) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes( address account ) internal returns(uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex( address account ) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   

pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                          STRUCTS                                         */
    /********************************************************************************************/

    struct Airline {
        string name;
        uint funds;
    }

    struct Insurance {
        uint amount;
        address airlineAddress;
        string flight;
        uint credit;
        bool expired;
    }

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Account used to deploy contract
    address private contractOwner;

    // Blocks all state changes throughout the contract if false
    bool private operational = true;

    // The callers authorized to call this data contract
    mapping(address => bool) private authorizedCallers;

    // Airlines registered
    mapping(address => Airline) private airlines;
    uint private numAirlines;

    // Airline => Flight => Passenger => Insurance
    mapping(address => mapping(string => mapping(address => Insurance))) private insurances;
    // Airline => Flight => Passenger[]
    mapping(address => mapping(string => address[])) private insurees;
    // Passenger => Insurances[]
    mapping(address => Insurance[]) private passengerInsurances;

    /********************************************************************************************/
    /*                                    EVENT DEFINITIONS                                     */
    /********************************************************************************************/

    event AirlineFunded(address airlineAddress, uint funds);
    event AirlineRegistered(address airlineAddress);
    event Buy(address passenger, address airlineAddress, string flight, uint amount);
    event CreditPassenger(address passenger, address airlineAddress, string flight, uint credit);
    event GetPassengerCredit(address passenger, uint amount, address airlineAddress, string flight, uint credit, bool expired);
    event GetPassengerCreditCount(address passenger, uint count);
    event FundsTransfered(address passenger, address airlineAddress, string flight, uint credit);

    event CreditDebug(uint amount, uint factor, uint mul, uint div, uint credit);

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirlineAddress, string firstAirlineName) public {
        contractOwner = msg.sender;
        airlines[firstAirlineAddress] = Airline(firstAirlineName, 0);
        numAirlines = numAirlines.add(1);
    }

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
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the caller to be authorized
    */
    modifier requireIsCallerAuthorized() {
        require(msg.sender == contractOwner || authorizedCallers[msg.sender] == true, "Caller is not authorized");
        _;
    }

    /**
    * @dev Modifier that requires the insurance to not be expired
    */
    modifier requireIsInsuranceNotExpired(Insurance insurance) {
        require(insurance.expired == false, "Insurance already credited!");
        _;
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
    * @dev Checks if airline is registered
    *
    * @return A bool that is registered status of the airline
    */
    function isAirlineRegistered(address airlineAddress) external view returns(bool) {
        bytes memory nameTmp = bytes(airlines[airlineAddress].name);
        return nameTmp.length > 0;
    }

    /**
    * @dev Checks if airline is funded
    *
    * @return A bool that is the funded state of the airline
    */
    function isAirlineFunded(address airlineAddress) external view returns(bool) {
        return airlines[airlineAddress].funds > 0;
    }

    /**
    * @dev Checks if airline is funded
    *
    * @return A bool that is the funded state of the airline
    */
    function getNumberOfAirlinesRegistered() external view returns(uint) {
        return numAirlines;
    }

//    function getAirline(address airlineAddress) external view returns(string name, uint length, bool validation) {
//        bytes memory nameTmp = bytes(airlines[airlineAddress].name);
//        name = airlines[airlineAddress].name;
//        length = nameTmp.length;
//        validation = length > 0;
//    }

    function getInsuranceFunds(address airlineAddress, string flight) external view returns(uint funds) {
        funds = insurances[airlineAddress][flight][msg.sender].amount;
    }

    function getContractOwner() external view returns(address) {
        return contractOwner;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    * @dev Authorizes a caller
    */
    function authorizeCaller(address callerAddress) external requireContractOwner {
        authorizedCallers[callerAddress] = true;
    }

    /**
    * @dev Funds an airline
    */
    function fund() external requireIsOperational requireIsCallerAuthorized payable {
        airlines[tx.origin].funds = airlines[tx.origin].funds.add(msg.value);
        emit AirlineFunded({airlineAddress: tx.origin, funds: airlines[tx.origin].funds});
    }

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline (address airlineAddress, string name) external requireIsOperational requireIsCallerAuthorized {
        require(!this.isAirlineRegistered(airlineAddress), 'Airline already registered!');
        airlines[airlineAddress] = Airline(name, 0);
        numAirlines = numAirlines.add(1);
        emit AirlineRegistered(airlineAddress);
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy(address airlineAddress, string flight) external payable requireIsOperational requireIsCallerAuthorized returns(string airlineName, string flightNumber, uint amountInsured) {
        require(insurances[airlineAddress][flight][tx.origin].amount == 0, 'Insurance already bought!');
        insurances[airlineAddress][flight][tx.origin].amount = msg.value;
        insurees[airlineAddress][flight].push(tx.origin);

        airlineName = airlines[airlineAddress].name;
        flightNumber = flight;
        amountInsured = msg.value;

        emit Buy(tx.origin, airlineAddress, flight, amountInsured);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address airlineAddress, string flight, uint creditFactor) external requireIsOperational requireIsCallerAuthorized requireIsInsuranceNotExpired(insurances[airlineAddress][flight][passenger]) {
        uint amount;
        uint credit;
        for(uint i; i < insurees[airlineAddress][flight].length; i++){
            address passenger = insurees[airlineAddress][flight][i];
            amount = insurances[airlineAddress][flight][passenger].amount;
            credit = insurances[airlineAddress][flight][passenger].credit;
            if(amount > 0 && credit == 0){
                credit = amount.mul(creditFactor).div(100);
                insurances[airlineAddress][flight][passenger].credit = credit;
                Insurance memory insurance = Insurance({
                    amount: amount,
                    airlineAddress: airlineAddress,
                    flight: flight,
                    credit: credit,
                    expired: false
                });

                passengerInsurances[passenger].push(insurance);
                emit CreditDebug(amount, creditFactor, amount.mul(creditFactor), amount.mul(creditFactor).div(100), credit);
                emit CreditPassenger(passenger, airlineAddress, flight, insurance.credit);
            }
        }
    }

    /**
     *  @dev Gets all the insurees of a flight
    */
    function getFlightInsurees(address airlineAddress, string flight) external view requireIsOperational requireIsCallerAuthorized returns(address[]) {
        return insurees[airlineAddress][flight];
    }

    /**
     *  @dev Gets all the passenger credits
    */
    function getPassengerCredit(address passengerAddress, uint index) external requireIsOperational requireIsCallerAuthorized returns(uint amount, address airlineAddress, string flight, uint credit, bool expired) {

        Insurance memory insurance = passengerInsurances[passengerAddress][index];

        airlineAddress = insurance.airlineAddress;
        flight = insurance.flight;
        amount = insurances[airlineAddress][flight][passengerAddress].amount;
        credit = insurances[airlineAddress][flight][passengerAddress].credit;
        expired = insurances[airlineAddress][flight][passengerAddress].expired;

        emit GetPassengerCredit(passengerAddress, amount, airlineAddress, flight, credit, expired);
    }

    /**
     *  @dev Gets the passenger credits count
    */
    function getPassengerCreditCount(address passengerAddress) external requireIsOperational requireIsCallerAuthorized returns(uint count) {
        count = passengerInsurances[passengerAddress].length;

        emit GetPassengerCreditCount(passengerAddress, count);
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address airlineAddress, string flight) external requireIsOperational requireIsCallerAuthorized {
        Insurance memory insurance = insurances[airlineAddress][flight][tx.origin];
        require(!insurance.expired, 'Insurance not found or already transfered!');
        tx.origin.transfer(insurance.credit);
        insurances[airlineAddress][flight][tx.origin].expired = true;

        emit FundsTransfered(tx.origin, airlineAddress, flight, insurance.credit);
    }

    function getFlightKey( address airline, string memory flight, uint256 timestamp ) pure internal returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {
        this.fund.value(msg.value);
    }


}


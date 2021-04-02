import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

const PASSENGER_NAMES = ['Bruce Wayne', 'Clark Kent', 'Natasha Romanov', 'Peter Parker', 'Tony Stark'];

export default class Contract {


    constructor(network, callback) {

        this.config = Config[network];
        this.web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:8545'));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress);

        this.owner = this.config.owner;

        console.log('Owner: ', this.config.owner);
        console.log('FirstAirline: ', this.config.firstAirline);

        this.initialize(callback);
        this.airlines = [];
        this.passengers = [];
    }

    initialize(callback) {
        let self = this;
        self.flightSuretyData.methods.authorizeCaller(self.config.appAddress).send({from: self.config.owner, gas: 1000000}, (error, result) => {
            if(error) console.error('Contract could not be authorized: ', error);
            if(result) console.log('Contract authorized: ', result);
            if(!error) {

                this.airlines.push({
                    name: `Airdacity 1`,
                    address: self.config.firstAirline
                });

                self.flightSuretyApp.methods.fund().send({ from: self.config.firstAirline, value: self.web3.utils.toWei('10', 'ether'), gas: 1000000}, (error, result) => {
                    if(error) console.error('First Airline could not be funded: ', error);
                    if(result) console.log('First Airline funded: ', result);
                    if(!error) {
                        this.web3.eth.getAccounts(async (error, accts) => {
                            let counter = 2;
                            while(self.airlines.length < 4) {

                                console.log(`Registering airline ${counter}`, accts[counter]);

                                let airline = {
                                    name: `Airdacity ${counter}`,
                                    address: accts[counter++]
                                };

                                this.airlines.push(airline);

                                this.flightSuretyApp.methods.registerAirline(airline.address, airline.name).send({ from: self.config.firstAirline, gas: 1000000 }, (error, result) => {
                                    // if(error) console.error(`Could not register airline ${airline.name} | ${airline.address}`, error);
                                    if(!error){
                                        console.log(`Airline ${airline.name} registered!`);
                                        self.flightSuretyApp.methods.fund().send({ from: airline.address, value: self.web3.utils.toWei('10', 'ether'), gas: 1000000 }, (error, result) => {
                                            if(error) console.error(`Could not fund airline ${airline.name}`, error);
                                            else console.log(`Airline ${airline.name} registered and funded!`);
                                        });
                                    }
                                });
                            }

                            while(this.passengers.length < 5) {
                                this.passengers.push({
                                    name: PASSENGER_NAMES[counter - 5],
                                    address: accts[counter++]
                                });
                            }

                            callback();
                        });
                    }
                });
            }
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(payload, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, Math.floor(Date.now() / 1000))
            .send({ from: self.owner}, (error, result) => {
                callback(error, result);
            });
    }

    purchaseFlightInsurance(payload, callback) {
        let self = this;
        self.flightSuretyApp.methods
            .registerFlightInsurance(payload.airline, payload.flight)
            .send({ from: payload.passenger, value: this.web3.utils.toWei(payload.funds.toString(), 'ether'), gas: 100000000}, (error, result) => {
                callback(error, result);
            }
        );
    }

    checkPassengerCredits(passengerAddress, callback) {
        console.log("Checking passenger credits")
        let self = this;
        self.flightSuretyData.methods
            .getPassengerCreditCount(passengerAddress)
            .send({ from: self.owner }).on('receipt', (receipt) => {
                let totalInsurances = receipt.events.GetPassengerCreditCount.returnValues.count;

                console.log("Total insurance credits: ", totalInsurances);

                let insurances = [];

                if(totalInsurances > 0){
                    self.populateInsurances(insurances, passengerAddress, totalInsurances, callback);
                }
            });
    }

    populateInsurances(insurances, passengerAddress, index, callback){
        let self = this;
        if(index){
            self.flightSuretyData.methods.getPassengerCredit(passengerAddress, --index)
                .send({ from: self.owner }).on('receipt', (receipt) => {

                let values = receipt.events.GetPassengerCredit.returnValues;

                insurances.push({
                    passengerAddress: values.passenger,
                    amount: self.web3.utils.fromWei(values.amount, 'ether'),
                    airlineAddress: values.airlineAddress,
                    flight: values.flight,
                    credit: self.web3.utils.fromWei(values.credit, 'ether'),
                    expired: values.expired
                });

                self.populateInsurances(insurances, passengerAddress, index, callback);

            }).on('error', (error) => callback(null, error));
        } else{
            callback(insurances);
        }
    }

    withdraw(payload, callback){
        let self = this;
        self.flightSuretyApp.methods.withdraw(payload.airlineAddress, payload.flight)
            .send({ from: payload.passenger, gas: 1000000 }).on('receipt', (receipt) => {
           console.log('Withdraw receipt: ', receipt);
           callback(receipt);
        }).on('error', (error) => {
           console.log('Withdraw error: ', error);
           callback(null, error);
        });
    }

    getAirlineByAddress(address){
        return this.airlines.filter(airline => airline.address == address).map(airline => airline.name)[0];
    }

    getPassengerByAddress(address){
        return this.passengers.filter(passenger => passenger.address == address).map(passenger => passenger.name)[0];
    }
}
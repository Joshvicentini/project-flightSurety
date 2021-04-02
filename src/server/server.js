import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;
const ORACLES_COUNT = 30;

const statuses = [
    STATUS_CODE_UNKNOWN,
    STATUS_CODE_ON_TIME,
    STATUS_CODE_LATE_AIRLINE,
    STATUS_CODE_LATE_WEATHER,
    STATUS_CODE_LATE_TECHNICAL,
    STATUS_CODE_LATE_OTHER,
    ORACLES_COUNT
];

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);

let oracles = [];

function getRandomIndex(max) {
    return Math.floor(Math.random() * max);
}

// Setup application
web3.eth.getAccounts((error, accounts) => {
    let owner = accounts[0];

    console.log('\n******** Getting accounts');

    flightSuretyData.methods.authorizeCaller(config.appAddress).send({from: owner}, (error, result) => {
        if(error) console.log(error);
        else {
            console.log('\n******** Caller authorized');
            console.log('\n******** Registering oracles');
            for(let i = 10; i < 30; i++) {
            console.log(' -- ', i-10);
                flightSuretyApp.methods.registerOracle().send({from: accounts[i], value: web3.utils.toWei("1",'ether'), gas: 10000000}, (error, result) => {
                    if(error) console.log(error);
                    else {
                        console.log('*** Getting oracle ', i-10, ' indexes');
                        flightSuretyApp.methods.getMyIndexes().call({from: accounts[i], gas: 10000000}, (error, result) => {
                            if (error) console.log(error);
                            else {
                                console.log('*** Pushing oracle ', i-10);
                                let oracle = {address: accounts[i], index: result};
                                oracles.push(oracle);
                            }
                        });
                    }
                });
            }
        }
    });
});

flightSuretyApp.events.OracleRequest({fromBlock: 0}, function (error, event) {
    if (error) console.log(error);
    else{
        console.log(`\n************ ORACLE REQUEST (${oracles.length}) **************`);
        let returnValues = event.returnValues;
        console.log(`\n<<Selected index: ${returnValues.index}>>`);
        let status = statuses[getRandomIndex(statuses.length)];
        for(let i = 0; i < oracles.length; i++) {
            console.log('-- ', i-10, ': ', oracles[i].index.includes(returnValues.index));
            if(oracles[i].index.includes(returnValues.index)) {
                flightSuretyApp.methods.submitOracleResponse(returnValues.index, returnValues.airline, returnValues.flight, returnValues.timestamp, 20)
                .send({from: oracles[i].address, gas: 10000000}, (error, result) => {
                    // console.log(`* Success ${i} ${!!result} | Error ${i} ${!!error}`);
                    if(result) console.log(`* Success Oracle ${i-10}`);
                    if(error) console.log(`* Error Oracle ${i-10}`);
                });
            }
        }
    }
});

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;



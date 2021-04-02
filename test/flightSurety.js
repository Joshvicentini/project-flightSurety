
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;

  const AIRLINE_FUNDING_AMOUNT = web3.utils.toWei("10", "ether");
  const INSURANCE_MAX_AMOUNT = web3.utils.toWei("1", "ether");

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, 'Qantas', {from: config.firstAirline});
    }
    catch(e) {

    }
    let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline);

    // ASSERT
    assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

  });

  it('(airline) fund airline with less then 10 ether', async () => {

    // ARRANGE
      let reverted = false;

    // ACT
    try {
        await config.flightSuretyApp.fund({from: config.firstAirline, value: AIRLINE_FUNDING_AMOUNT/2});
    }
    catch(e) {
        reverted = true;
    }

    let funded = await config.flightSuretyData.isAirlineFunded(config.firstAirline);

    // ASSERT
    assert.equal(reverted, true, "Airline should not be funded with less then 10 ether");
    assert.equal(funded, false, "Airline should not be funded with less then 10 ether");
  });

  it('(airline) Existing airline may register a new airline until there are at least 4 airlines registered', async () => {

    // ARRANGE
    await config.flightSuretyApp.fund({from: config.firstAirline, value: AIRLINE_FUNDING_AMOUNT});

    // ACT
    await config.flightSuretyApp.registerAirline(accounts[3], 'Audacity', {from: config.firstAirline});
    await config.flightSuretyApp.registerAirline(accounts[4], 'Audacity', {from: config.firstAirline});
    await config.flightSuretyApp.registerAirline(accounts[5], 'Audacity', {from: config.firstAirline});
    await config.flightSuretyApp.registerAirline(accounts[6], 'Audacity', {from: config.firstAirline});
    await config.flightSuretyApp.registerAirline(accounts[7], 'Audacity', {from: config.firstAirline});

    let totalAirlines = await config.flightSuretyData.getNumberOfAirlinesRegistered();

    // ASSERT
    assert.equal(totalAirlines, 4, "There sould be 4 airlines registered!");
  });

  it('(airline) Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async () => {

    // ARRANGE
    await config.flightSuretyApp.fund({from: accounts[3], value: AIRLINE_FUNDING_AMOUNT});

    // ACT
    await config.flightSuretyApp.registerAirline(accounts[7], 'Audacity', {from: accounts[3]});

    let totalAirlines = await config.flightSuretyData.getNumberOfAirlinesRegistered();

    // ASSERT
    assert.equal(totalAirlines, 5, "With a consensus of 2, the fith airline should be included!");
  });

  it('(insurance) User cant purchase insurance over 1 ether', async () => {

    // ARRANGE
    let reverted = false;

    // ACT
    try{
        await config.flightSuretyApp.registerFlightInsurance( config.firstAirline, 'FLG001', {from: accounts[8], value: INSURANCE_MAX_AMOUNT * 2});
    } catch(e){
        reverted = true;
    }

    // ASSERT
    assert.equal(reverted, true, "Passenger should not purchase insurance over 1 ether!");
  });

  it('(insurance) User can purchase insurance to at most 1 ether', async () => {

    // ARRANGE
    let reverted = false;

    // ACT
    try{
        await config.flightSuretyApp.registerFlightInsurance( config.firstAirline, 'FLG001', {from: accounts[8], value: INSURANCE_MAX_AMOUNT});
    } catch(e){
        reverted = true;
    }

    let fundsAdded = await config.flightSuretyData.getInsuranceFunds( config.firstAirline, 'FLG001', {from: accounts[8]});

    // ASSERT
    assert.equal(reverted, false, "Passenger should not purchase insurance over 1 ether!");
    assert.equal(fundsAdded, web3.utils.toWei('1', "ether"), "Passenger insurance should have 1 ether funds!");
  });

});

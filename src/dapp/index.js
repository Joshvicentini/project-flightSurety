
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';



(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        //Populating airlines
        populateSelect('airlines-select', contract.airlines);

        //Populating passengers
        populateSelect('passengers-select', contract.passengers);

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('display-wrapper', 'Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });

        // User-submitted transaction
        DOM.elid('purchase-insurance').addEventListener('click', () => {
            let payload = {
                passenger: DOM.elid('passengers-select').value,
                airline: DOM.elid('airlines-select').value,
                flight: DOM.elid('flight-number').value,
                funds: DOM.elid('insurance-funds').value
            };

            console.log("Purchasing insurance for ", payload.passenger);

            // Write transaction
            contract.purchaseFlightInsurance(payload, (error, result) => {
                let results = [];
                if( error ) results.push({ label: 'Flight purchased error', error: error });
                else{
                    results.push({ label: 'Passenger address', value: payload.passenger });
                    results.push({ label: 'Transaction', value: result });
                }
                display('display-purchase-wrapper','Insurance', 'Purchase', results);
            });
        });

        // User-submitted transaction
        DOM.elid('fetch-flight-status').addEventListener('click', () => {
            let payload = {
                airline: DOM.elid('airlines-select-2').value,
                flight: DOM.elid('flight-number-2').value,
            };
            //Write transaction
            contract.fetchFlightStatus(payload, (error, result) => {
                let results = [];
                if( error ) results.push({ label: 'Flight status error', error: error });
                else{
                    results.push({ label: 'Flight', value: payload.flight });
                    results.push({ label: 'Checking status', value: '...' });
                }
                display('display-flight-wrapper','Oracles', 'Flight status', results);
            });
        });

        // User-submitted transaction
        DOM.elid('fetch-passenger-credits').addEventListener('click', () => {
            let passenger = DOM.elid('passengers-select-2').value;

            contract.checkPassengerCredits(passenger, (result, error) => {
                let results = [];
                if( error ) results.push({ label: 'Passenger credits error', error: error });
                else{
                    result.forEach(insurance => {
                        results = [];
                        results.push({ label: 'Passenger', value: contract.getPassengerByAddress(insurance.passengerAddress) });
                        results.push({ label: 'Airline', value: contract.getAirlineByAddress(insurance.airlineAddress) });
                        results.push({ label: 'Flight', value: insurance.flight });
                        results.push({ label: 'Insurance value', value: `${insurance.amount} ether` });
                        results.push({ label: 'credit', value: `${insurance.credit} ether` });
                        results.push({ label: 'Available', value: !insurance.expired });

                        display('display-passenger-wrapper','Passenger', 'Credits', results);
                        if(!insurance.expired){
                            appendWithdrawButtonToLastSection(contract, 'display-passenger-wrapper', insurance.passengerAddress, insurance.airlineAddress, insurance.flight);
                        }
                    });
                }
            });
        });

        // contract.flightSuretyApp.events.OracleReport({fromBlock: 0}, function (error, result) {
        //     console.log('Flight status report: ', result);
        // });

        contract.flightSuretyData.events.AirlineFunded({fromBlock: 0}, function (error, result) {
            console.log('Airline Funded: ', result);
        });

        contract.flightSuretyData.events.CreditDebug({fromBlock: 0}, function (error, result) {
            console.log('Credit debug: ', result);
        });

        contract.flightSuretyData.events.Buy({fromBlock: 0}, function (error, result) {
            console.log('Insurance bought: ', result);
        });

        contract.flightSuretyData.events.CreditPassenger({fromBlock: 0}, function (error, result) {
            console.log('Passenger credited: ', result);
        });

        contract.flightSuretyApp.events.FlightStatusInfo({fromBlock: 0}, function (error, result) {
            // console.log('Flight Status: ', result);
            if (error) console.log(error);
            else appendDisplay('display-flight-wrapper', [{ label: 'Status', value: getStatus(parseInt(result.returnValues.status)) }]);
        });

        contract.flightSuretyData.events.FundsTransfered({fromBlock: 0}, function (error, result) {
            console.log('Funds transfered: ', result);
        });

    });
    

})();

function display(wrapperId, title, description, results) {
    let displayDiv = DOM.elid(wrapperId);
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    if(results && results.length > 0)
        appendToSection(section, results);
    displayDiv.append(section);
}

function appendDisplay(wrapperId, results, keepLast) {
    let displayDiv = DOM.elid(wrapperId);
    if(displayDiv.children && displayDiv.children.length > 0){
        let section = displayDiv.children[displayDiv.children.length - 1];
        if(!keepLast) removeLastChild(section);
        // console.log('displayDiv', displayDiv);
        // console.log('choldren', displayDiv.children);
        // console.log('section', section);
        appendToSection(section, results);
        displayDiv.append(section);
    }
}

function appendToSection(section, results) {
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
}

function appendWithdrawButtonToLastSection(contract, wrapperId, passenger, airlineAddress, flight){
    console.log('Appending button: ');
    let displayDiv = DOM.elid(wrapperId);
    if(displayDiv.children && displayDiv.children.length > 0) {
        let section = displayDiv.children[displayDiv.children.length - 1];
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}));
        let button = DOM.btn({className: 'btn btn-primary'}, 'Withdraw');
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, button));
        button.addEventListener('click', () => {
           let payload = {
               passenger: passenger,
               airlineAddress: airlineAddress,
               flight: flight
           };
           contract.withdraw(payload, (result, error) => {
               if(result){
                   section.children[section.children.length-1].remove();
                   section.children[section.children.length-1].remove();
                   let row = section.appendChild(DOM.div({className:'row'}));
                   row.appendChild(DOM.div({className: 'col-sm-4 field'}, 'Available'));
                   row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, 'false'));
                   let row2 = section.appendChild(DOM.div({className:'row'}));
                   row2.appendChild(DOM.div({className: 'col-sm-4 field'}, 'Transaction'));
                   row2.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.transactionHash));
               }
               if(error){
                   alert('Withdraw unavailable');
                   console.log('Withdraw error: ', error);
               }
           });
        });
    }
}

function removeLastChild(el){
    if(el && el.children && el.children.length > 0){
        el.children[el.children.length - 1].remove();
    }
}

function populateSelect(selectClass, listData){
    let list = document.getElementsByClassName(selectClass);
    for( let i = 0; i < list.length; i++){
        list[i].innerHTML = "";
        listData.forEach((item)=>{
            let option = document.createElement("option");
            option.text = item.name;
            option.value = item.address;
            list[i].add(option);
        });
    }
}

function getStatus(status){
    switch(status){
        case 10: return 'On Time';
        case 20: return 'Airline Late';
        case 30: return 'Weather Late';
        case 40: return 'Technical Late';
        case 50: return 'Other Late';
        default: return 'Unknown';
    }
}








// var HDWalletProvider = require("truffle-hdwallet-provider");
// var mnemonic = "panic blast true woman auto empower actor hold poem useless strong asthma";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};
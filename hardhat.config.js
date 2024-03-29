require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("solidity-coverage");
require("hardhat-gas-reporter");

const {
  ACC_PRIVATE_KEY,
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // Fork Ultron mainnet when USDC/USDT price was 1.004953
      forking: {
        url: "https://ultron-rpc.net",
        blockNumber: 1805923
      }   
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ultronTestnet: {
      url: "https://ultron-dev.io",
      chainId: 1230,
      accounts: [ACC_PRIVATE_KEY],
    },
    ultronMainnet: {
      url: `https://ultron-rpc.net`,
      chainId: 1231,
      accounts: [ACC_PRIVATE_KEY],
    },
  },
  mocha: {
    timeout: 20000000000,
  },
  paths: {
    sources: "./contracts/",
    tests: "./test/",
  },
  skipFiles: ["node_modules"],
  gasReporter: {
    enabled: true,
    url: "http://localhost:8545",
  },
};

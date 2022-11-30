const { ethers, network } = require("hardhat");

/**
 * Creates a single random wallet and shows its address and private key
 * NOTE Address and private key of the wallet will be displayed in the terminal. Copy them and save somewhere else!
 */

async function main() {
  let wallet = ethers.Wallet.createRandom();
  console.log(`New wallet:`);
  console.log(`    Address: ${wallet.address}`);
  console.log(`    Private key: ${wallet.privateKey}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

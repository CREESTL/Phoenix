const { ethers, network } = require("hardhat");
const fs = require("fs");
const delay = require("delay");
require("dotenv").config();
const { formatEther, formatUnits, parseEther, parseUnits } = ethers.utils;
const { getContractFactory, getContractAt } = ethers;
module.exports = { 
  buyToken,
  swapTokens,
  addLiquidityWithToken,
  removeLiquidity,
  triggerEvents
};

/**
 * This test file should be used while running main script on the same network.
 * For example:
 * - npx hardhat node --network hardhat (start a local node of Ultron fork)
 * - npx hardhat run app/main.js --network localhost (run app on the local node)
 * - npx hardhat run scripts/events.js --network localhost (run this script to trigger events in the app)
 */

// This script is meant to be executed on localhost only
if (network.name !== "localhost") {
  console.log("This script is for `localhost` network only!");
  process.exit(0);
}

// All constant values
const SWAP_THRESHOLD =
    process.env.SWAP_THRESHOLD === ""
      ? parseEther("0")
      : parseEther(process.env.SWAP_THRESHOLD);
// The address of main UniswapV2Router02 deployed and used on Ultron mainnet
const ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
// Addresses of uUSDT and uUSDC
const USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
const USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
// The address of main USDT/USDC pair pool deployed and used on Ultron mainnet
const PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";
// The timeout for transactions
const TIMEOUT = Date.now() + 1000 * 60 * 10;
// The amount of USDT (USDC) to add as liquidity
const amountTokenDesired = parseUnits("100", 6);

let wallet;
let swapper;
let pair;
let USDT;
let USDC;
let ULX_ADDRESS;
let router;

// ^ This function initializes variables from above 
async function init() {

  console.log(`\nCurrent chain: ${network.name}`);

  let wallets = await ethers.getSigners();
  wallet = wallets[0];
  swapper = wallets[1];

  // Initialize the pair contract
  pair = await getContractAt("UniswapV2Pair", PAIR_ADDRESS, wallet);
  console.log("Pair address is ", pair.address);

  // Initialize the USDT and USDC contracts
  // Both inherit from ERC20PresetMinterPauser
  USDT = await getContractAt("USDX", USDT_ADDRESS, wallet);
  USDC = await getContractAt("USDX", USDC_ADDRESS, wallet);
  // Initialize the Router contract
  router = await getContractAt(
    "UniswapV2Router02",
    ROUTER_ADDRESS,
    wallet
  );
  // This is the address of native tokens (ULX - NOT ULX)
  // No need to actually initialize the contract
  ULX_ADDRESS = await router.WETH();

  // Send USDC and USDT tokens to the bot and the swapper
  await buyToken(USDC, 2500*1e6, ULX_ADDRESS, wallet, router, TIMEOUT);
  await buyToken(USDT, 2500*1e6, ULX_ADDRESS, wallet, router, TIMEOUT);
  await buyToken(USDC, 2500*1e6, ULX_ADDRESS, swapper, router, TIMEOUT);
  await buyToken(USDT, 2500*1e6, ULX_ADDRESS, swapper, router, TIMEOUT);
}


// Function shows user's balances
async function showUserBalances(wallet, usdc, usdt, pair) {
  console.log("\nUser's balances: ")
  console.log(
    "ULX: ",
    formatEther(await wallet.getBalance())
  );
  console.log(
    "USDC: ",
    formatUnits(await usdc.balanceOf(wallet.address), 6)
  );
  console.log(
    "USDT: ",
    formatUnits(await usdt.balanceOf(wallet.address), 6)
  );
  console.log(
    "LP: ",
    formatUnits(await pair.balanceOf(wallet.address), 6)
  );
}
// Function shows pair's balances
async function showPairBalances(pair, usdc, usdt) {
  console.log("\nPair's balances: ")
  console.log(
    "USDC: ",
    formatUnits(await usdc.balanceOf(pair.address), 6)
  );
  console.log(
    "USDT: ",
    formatUnits(await usdt.balanceOf(pair.address), 6)
  );
}

// Function swaps ULX for USDT or USDC (or any other token, really)
async function buyToken(token, amount, ulxAddress, wallet, router, timeout) {
  let path = [ulxAddress, token.address];
  console.log(`\nSwap ULX for ${await token.name()}`);
  let txResponse = await router.connect(wallet).swapETHForExactTokens(
    amount,
    path,
    wallet.address,
    timeout,
    { value: parseEther("500000") }
  );
  let txReceipt = await txResponse.wait();
  console.log("Swap Finished!");
}

// Function adds liquidity into the pool with a given token
async function addLiquidityWithToken(token, amount, usdc, usdt, wallet, router, timeout) {
  console.log(`\nAdding luquidity to pool with ${await token.name()}...`);
  console.log("Approving adding liquidity...");
  // We have to approve both USDC and USDT
  let approveTx = await usdt.connect(wallet).approve(
    router.address,
    amount
  );
  let approveReceipt = await approveTx.wait();
  approveTx = await usdc.connect(wallet).approve(
    router.address,
    amount
  );
  approveReceipt = await approveTx.wait();
  console.log("Approved!");
  console.log("Adding liquidity...");
  if (token.address == usdt.address) {
    txResponse = await router
      .connect(wallet)
      .addLiquidity(
        usdt.address,
        usdc.address,
        amount,
        amount,
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        wallet.address,
        timeout
      );
  } else if (token.address == usdc.address) {
    txResponse = await router
      .connect(wallet)
      .addLiquidity(
        usdc.address,
        usdt.address,
        amount, 
        amount,
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        wallet.address,
        timeout
      );
  }

  txReceipt = await txResponse.wait();

  console.log("Liquidity added!");
}

// Function swaps tokens inside the pool
async function swapTokens(from, amount, to, wallet, router, timeout ) {

  console.log(`\nSwap ${ await from.name() } for ${ await to.name() } inside the pool`);
  path = [from.address, to.address];
  
  approveTx = await from.connect(wallet).approve(
    router.address,
    amount
  );
  approveReceipt = await approveTx.wait();
  txResponse = await router
    .connect(wallet)
    .swapExactTokensForTokens(
      amount,
      0,
      path,
      wallet.address,
      timeout
    );

  txReceipt = await txResponse.wait();

  console.log("Swap finished!");
}

// Functions removes liquidity from the pool
async function removeLiquidity(token, usdt, usdc, pair, wallet, router, timeout) {

  console.log("\nRemoving liquidity from the pool...");
  liquidity = await pair.balanceOf(wallet.address);
  // Approve transfer of LP tokens from wallet back to the contract
  approveTx = await pair.approve(router.address, liquidity);
  approveReceipt = await approveTx.wait();
  if (token.address == usdc.address) {

    txResponse = await router.connect(wallet).removeLiquidity(
      usdc.address,
      usdt.address,
      liquidity,
      1, // at least 1 USDT and 1 USDC should be collected
      1,
      wallet.address,
      timeout
    );

  } else if (token.address == usdt.address) {

    txResponse = await router.connect(wallet).removeLiquidity(
      usdt.address,
      usdc.address,
      liquidity,
      1, // at least 1 USDT and 1 USDC should be collected
      1,
      wallet.address,
      timeout
    );
  }

  txReceipt = await txResponse.wait();

  console.log("Liquidity removed!");

}

// Function triggers all events one by one
async function triggerEvents(wallet, amount, usdt, usdc, pair, ulxAddress, router, timeout) {
  
  console.log("USDT_address is ", usdt.address);
  console.log("USDC address is ", usdc.address);
  console.log("Amount to swap is: ", formatUnits(amount, 6));

  console.log("\n===========");
  await showUserBalances(swapper, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  // Decide randomly what to swap
  if(Math.round(Math.random())) {
      await swapTokens(usdt, amountTokenDesired, usdc, swapper, router, timeout);
  } else {
      await swapTokens(usdc, amountTokenDesired, usdt, swapper, router, timeout);
  }
  await showUserBalances(swapper, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await delay(5000);
  /*console.log("\n===========");
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await addLiquidityWithToken(usdt, amount, usdc, usdt, wallet, router, timeout);
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await delay(5000);

  console.log("\n===========");
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await swapTokens(usdt, amountTokenDesired, usdc, wallet, router, timeout);
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await delay(5000);

  console.log("\n===========");
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await removeLiquidity(usdt, usdt, usdc, pair, wallet, router, timeout);
  await showUserBalances(wallet, usdc, usdt, pair);
  await showPairBalances(pair, usdc, usdt);
  await delay(5000);
*/
}

async function main() {
  // First, initialize all variables
  await init();
  // Pass initialized variables to the events trigerring function
  for(let i=0; i<50; i++){
      await triggerEvents(wallet, amountTokenDesired, USDT, USDC, pair, ULX_ADDRESS, router, TIMEOUT);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

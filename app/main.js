const { ethers, network } = require("hardhat");
const fs = require("fs");
const parseArgs = require('minimist');
const path = require("path");
require("dotenv").config();
const delay = require("delay");
const { formatEther, parseEther, parseUnits, keccak256 } = ethers.utils;
const { getContractFactory, getContractAt, BigNumber } = ethers;

// The privdate key of the user
const ACC_PRIVATE_KEY = process.env.ACC_PRIVATE_KEY;
// The USDC/USDT (or USDC/USDT) price ratio enough to trigger the swap
// A Number (not a BigNumber!) value
const SWAP_THRESHOLD = process.env.SWAP_THRESHOLD;
// The address of main UniswapV2Router02 deployed and used on Ultron mainnet
const ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
// Addresses of uUSDT and uUSDC
const USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
const USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
// The address of main USDT/USDC pair pool deployed and used on Ultron mainnet
const PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";
// The timeout for transactions
const TIMEOUT = Date.now() + 1000 * 60 * 10;


// Parse command line arguments
let args = parseArgs(process.argv.slice(2));

// Allows to create a queue of promises and resolve them one by one
class Queue {
  // Initially, that's a single resolved promise
  queue = Promise.resolve();

  // Adds another promise to the end of the queue
  add(promise) {
    this.queue = this.queue
    .then(promise)
    .catch(() => {})
  }
}

let pair;
let provider;
let wallet;
let router;
let USDT;
let USDC;
let queue = new Queue;

// Returns the price of USDC in the pool (pair)
// Price is a BigNumber of decimals 18
async function getPriceUSDC() {
  let bothPrices = await router.getAmountsOut(parseUnits("1"), [USDC.address, USDT.address]);
  let usdcPrice = bothPrices[1];
  return usdcPrice;
}

// Returns the price of USDT in the pool (pair)
// Price is a BigNumber of decimals 18
async function getPriceUSDT() {
  let bothPrices = await router.getAmountsOut(parseUnits("1"), [USDT.address, USDC.address]);
  let usdtPrice = bothPrices[1];
  return usdtPrice;
}

// Returns true if USDT has bigger price
// Returns false if USDC has bigger price
async function USDTMoreExpensive() {
  let usdtPrice = await getPriceUSDT();
  let usdcPrice = await getPriceUSDC();
  // Convert BigNumber values to Numbers in order to multiply by SWAP_THRESHOLD 
  usdtPrice = usdtPrice.toNumber();
  usdcPrice = usdcPrice.toNumber();
  // TODO delete it
  console.log("USDT price is: ", usdtPrice);
  console.log("USDC price is: ", usdcPrice);
  if (usdtPrice >= (usdcPrice * SWAP_THRESHOLD)) {
    return true;
  } else {
    return false;
  }
}

// Checks that swap threshold was reached
// Returns true if it was reached
// Returns false if it was not reached
async function checkThreshold() {
  let usdtPrice = await getPriceUSDT();
  let usdcPrice = await getPriceUSDC();
  usdtPrice = usdtPrice.toNumber();
  usdcPrice = usdcPrice.toNumber();
  if (!((usdtPrice >= (usdcPrice * SWAP_THRESHOLD)) || (usdcPrice >= (usdtPrice * SWAP_THRESHOLD)))) {
    console.log("Swap threshold was not reached yet!");
    return false;
  }
  return true;
}

// Makes a swap from one token to another depending on 
// prices of the tokens
// First token is the more expensive one
// Second token is the less expensive one
async function swap(from, to, amount) {
  console.log(`Swap amount is ${amount}`);
  let path = [from, to];
  await router.connect(wallet).swapExactTokensForTokens(
    amount,
    1,
    path,
    wallet.address,
    TIMEOUT
  );
}

// Shows USDT and USDC balances of the user 
async function showWalletBalance() {
  console.log(`Wallet's USDT balance: ${await USDT.balanceOf(wallet.address)}`);
  console.log(`Wallet's USDC balance: ${await USDC.balanceOf(wallet.address)}`);
}

// Compares prices of USDC and USDT tokens in the pool and 
// swaps one token for another one
// If `amount` is not zero, then exactly the `amount` of tokens (USDT or USDC) 
// will be swapped each time
// If `amount` is zero, then the whole user's balance of USDT and USDC 
// will be swapped each time
async function comparePricesAndSwap(amount) {

  await showWalletBalance();

  // Check if threshold was reached
  if (!(await checkThreshold())) {
    return;
  }
  // Swap USDT -> USDC if USDT is more expensive
  if (await USDTMoreExpensive()) {
    console.log("USDT is more expensive");
    console.log("Swapping: USDT -> USDC");  

    // User wants to swap an exact amount of tokens
    if (amount != 0) {
      // Swap is impossible if user has not enough tokens
      if (await USDT.balanceOf(wallet.address) == 0 ) {
        throw "User has not enough USDT to swap!";
      }
      // Swap is impossible if user does not have the `amount` of tokens
      if (await USDT.balanceOf(wallet.address) <= amount ) {
        throw "User does not have a required amount of tokens to swap!";
      }
      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDT.connect(wallet).approve(router.address, amount);
      await approveTx.wait();
      await swap(USDT.address, USDC.address, amount);

    // User wants to swap his whole balance of tokens
    } else {
      // Swap is impossible if user has not enough tokens
      if (await USDT.balanceOf(wallet.address) == 0 ) {
        throw "User has not enough USDT to swap!";
      }
      // Amount is the whole balance of the user
      let balance = await USDT.balanceOf(wallet.address);
      let approveTx = await USDT.connect(wallet).approve(router.address, balance);
      await approveTx.wait();
      await swap(USDT.address, USDC.address, balance);
    }

  // Swap USDC -> USDT if USDC is more expensive
  } else {
    console.log("USDC is more expensive");
    console.log("Swapping: USDC -> USDT");  
    // User wants to swap an exact amount of tokens
    if (amount != 0) {
      // Swap is impossible if user has not enough tokens
      if (await USDC.balanceOf(wallet.address) == 0 ) {
        throw "User has not enough USDC to swap!";
      }
      // Swap is impossible if user does not have the `amount` of tokens
      if (await USDC.balanceOf(wallet.address) <= amount ) {
        throw "User does not have a required amount of tokens to swap!";
      }
      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDC.connect(wallet).approve(router.address, amount);
      await approveTx.wait();
      await swap(USDC.address, USDT.address, amount);

    // User wants to swap his whole balance of tokens
    } else {
      // Swap is impossible if user has not enough tokens
      if (await USDC.balanceOf(wallet.address) == 0 ) {
        throw "User has not enough USDC to swap!";
      }
      // Amount is the whole balance of the user
      let balance = await USDC.balanceOf(wallet.address);
      let approveTx = await USDC.connect(wallet).approve(router.address, balance);
      await approveTx.wait();
      await swap(USDC.address, USDT.address, balance);
    }
  }

  console.log("Swap Finished!");
  await showWalletBalance();
}

// Main farming function
async function listenAndSwap() {

  console.log("Start bot");
  console.log(`\nCurrent chain: ${network.name}`)

  // Make sure that threshold is not zero
  if (!(SWAP_THRESHOLD > 0)) {
    throw "Swap threshold should be a positive integer!";
  }

  // If the network is not Ultron - get the default provider for the specified network
  if (network.name != 'ultronMainnet') {
    provider = ethers.provider;
  } else {
    // Provider for Ultron mainnet
    provider = new ethers.providers.JsonRpcProvider('https://ultron-rpc.net');
  }

  // Initialize user's wallet
  // TODO This should be used for live network
  // wallet = new ethers.Wallet(ACC_PRIVATE_KEY, provider);
  wallets = await ethers.getSigners();
  wallet = wallets[0];

  // Initialize the pair contract
  pair = await getContractAt("UniswapV2Pair", PAIR_ADDRESS, wallet);
  console.log("Pair address is ", pair.address);

  // Initialize the USDT and USDC contracts
  // Both inherit from ERC20PresetMinterPauser 
  USDT = await getContractAt("USDX", USDT_ADDRESS, wallet);
  USDC = await getContractAt("USDX", USDC_ADDRESS, wallet);
  // Initialize the Router contract
  router = await getContractAt("UniswapV2Router02", ROUTER_ADDRESS, wallet);  
  console.log("USDT address is ", USDT.address);
  console.log("USDC address is ", USDC.address);
  await showWalletBalance();

  console.log("Listening for pool events...");

  let amount = 0;
  // User provided some amount
  if (args["amount"] !== undefined) {
    // Provided amount can't be zero
    if (args["amount"] >= 0) {
      amount = args["amount"];
    } else {
      throw "Invalid amount to swap!";
    }
  }

  pair.on("Mint", () => {
    console.log("Liquidity has been added to the pool!");
    queue.add(async() => {await comparePricesAndSwap(amount)});
  });

  pair.on("Burn", () => {
    console.log("Liquidity has been withdrawn from the pool!");
    queue.add(async() => {await comparePricesAndSwap(amount)});
  });

  pair.on("Swap", (sender, a1, a2, a3, a4, to) => {
    // Check that the one who called swap was not the current user.
    // Because otherwise if we make another swap here, it will emit
    // one more "Swap" event, and it will trigger this section of code
    // and so on... Prevent recursion that way.
    if (to !== wallet.address) {
      console.log("Tokens have been swapped inside the pool!");
      queue.add(async() => {await comparePricesAndSwap(amount)});
    }
  });
}

listenAndSwap();

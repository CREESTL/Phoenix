const { ethers, network } = require("hardhat");
const fs = require("fs");
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
async function comparePricesAndSwap() {

  await showWalletBalance();

  // Check if threshold was reached
  if (!(await checkThreshold())) {
    return;
  }
  // Swap USDT -> USDC if USDT is more expensive
  if (await USDTMoreExpensive()) {
    console.log("USDT is more expensive");
    // Swap is impossible if user has not enough tokens
    if (await USDT.balanceOf(wallet.address) == 0 ) {
      console.log("User has not enough USDT to swap!");
      return;
    }
    console.log("Swapping: USDT -> USDC");  
    // Get the user's balance of the tokens he wants to swap
    let BNAmount = await USDT.balanceOf(wallet.address);
    // Convert from BigNumber to uint
    let amount = BNAmount.toNumber();
    // Approve the transfer of swapped tokens from user to the pool
    let approveTx = await USDT.connect(wallet).approve(router.address, amount);
    await approveTx.wait();
    await swap(USDT.address, USDC.address, amount);

  // Swap USDC -> USDT if USDC is more expensive
  } else {
    console.log("USDC is more expensive");
    // Swap is impossible if user has not enough tokens
    if (await USDC.balanceOf(wallet.address) == 0 ) {
      console.log("User has not enough USDC to swap!");
      return;
    }
    console.log("Swapping: USDC -> USDT");  
    // Get the user's balance of the tokens he wants to swap
    let BNAmount = await USDC.balanceOf(wallet.address);
    // Convert from BigNumber to uint
    let amount = BNAmount.toNumber();
    // Approve the transfer of swapped tokens from user to the pool
    let approveTx = await USDC.connect(wallet).approve(router.address, amount);
    await approveTx.wait();
    await swap(USDC.address, USDT.address, amount);
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
    console.log("Swap threshold should be a positive integer!");
    return;
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

  pair.on("Mint", () => {
    console.log("Liquidity has been added to the pool!");
    queue.add(async() => {await comparePricesAndSwap()});
  });

  pair.on("Burn", () => {
    console.log("Liquidity has been withdrawn from the pool!");
    queue.add(async() => {await comparePricesAndSwap()});
  });

  pair.on("Swap", () => {
    console.log("Tokens have been swapped inside the pool!");
    queue.add(async() => {await comparePricesAndSwap()});
  });
}

listenAndSwap();

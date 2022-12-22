const { ethers, network } = require("hardhat");
const fs = require("fs");
const util = require("util");
const path = require("path");
require("dotenv").config();
const delay = require("delay");
const {calcOptimalSwapAmount} = require("./utils/math"); 
const { formatEther, parseEther, parseUnits, formatUnits, keccak256 } =
  ethers.utils;
const { getContractFactory, getContractAt, BigNumber, FixedNumber } = ethers;
module.exports = {listenAndSwap};


// Log both into console and log file
let logFile = fs.createWriteStream("log.txt", {flags: 'w'});
let logStdOut = process.stdout;

console.log = function() {
  logFile.write(util.format.apply(null, arguments) + "\n");
  logStdOut.write(util.format.apply(null, arguments) + "\n");
}


// Note that most of operations with numbers(in functions) are done using FixedNumber lib to be able to
// make floating point divisions (BigNumber does not allow this)

// The private key of the user
const ACC_PRIVATE_KEY = process.env.ACC_PRIVATE_KEY;
// How many times to increment the "market" gas price to mine the transaction faster
// If no value is provided, x2 is set as default
const GAS_MULTIPLIER = process.env.GAS_MULTIPLIER || 2;
// Check that gas price multiplier is not 0
// It can be less than 1 and that will slow down the transaction being mined
if (GAS_MULTIPLIER <= 0) {
  throw "Gas price multiplier should be greater than 0!";
}
// The address of main UniswapV2Router02 deployed and used on Ultron mainnet
const ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
// Addresses of uUSDT and uUSDC
const USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
const USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
// The address of main USDT/USDC pair pool deployed and used on Ultron mainnet
const PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";
// The timeout for transactions
const TIMEOUT = Date.now() + 1000 * 60 * 10;
// The amount of tokens used to get token's price
// NOTE The closer this amount is to the amount that will be deposited (user's balance, for example)
// the less will be the difference between non-optimal amount (balance) and optimal amount (calculated with formula)
const AMOUNT_FOR_PRICE = parseUnits("1", 6);
// The directions of the swap
const SwapDirection = {
  USDT: "USDT", // USDC -> USDT
  USDC: "USDC", // USDT -> USDC
};
// BigNumber for infinite tokens allowance (we don't have to call approve every time we want to make a transaction)
const MAXUINT256 = ethers.constants.MaxUint256; 

// Allows to create a queue of promises and resolve them one by one
class Queue {
  // Initially, that's a single resolved promise
  queue = Promise.resolve();

  // Adds another promise to the end of the queue
  add(promise) {
    this.queue = this.queue.then(promise).catch(() => {});
  }
}

let pair;
let provider;
let wallet;
let router;
let USDT;
let USDC;
let queue = new Queue();

// Returns the price of USDC in the pool (pair)
async function getPriceUSDC() {
  let [usdcAmount, usdtAmount, timestamp] = await pair.getReserves();
  usdcAmount = FixedNumber.from(usdcAmount);
  usdtAmount = FixedNumber.from(usdtAmount);
  let usdcPrice = FixedNumber.from(
    await router.getAmountOut(AMOUNT_FOR_PRICE, usdcAmount, usdtAmount)
  );
  return usdcPrice;
}

// Returns the price of USDT in the pool (pair)
async function getPriceUSDT() {
  let [usdcAmount, usdtAmount, timestamp] = await pair.getReserves();
  usdcAmount = FixedNumber.from(usdcAmount);
  usdtAmount = FixedNumber.from(usdtAmount);
  let usdtPrice = FixedNumber.from(
    await router.getAmountOut(AMOUNT_FOR_PRICE, usdtAmount, usdcAmount)
  );
  return usdtPrice;
}

// Returns true if USDT has bigger price
// Returns false if USDC has bigger price
async function USDTMoreExpensive() {
  let usdtPrice = await getPriceUSDT();
  let usdcPrice = await getPriceUSDC();
  console.log("USDT price is: ", formatUnits(usdtPrice.toUnsafeFloat(), 6), " USDC");
  console.log("USDC price is: ", formatUnits(usdcPrice.toUnsafeFloat(), 6), " USDT");
  if (
    usdtPrice.toUnsafeFloat() >= usdcPrice.toUnsafeFloat()
  ) {
    return true;
  }

  return false;
}
// Checks if swap threshold was reached
// Returns true if it was reached
// Returns false if it was not reached
async function checkThreshold() {
  let usdtPrice = await getPriceUSDT();
  let usdcPrice = await getPriceUSDC();
  if (
    // Convert FixedNumber to float to make a comparison
    // USDT is more expensive
    usdtPrice.toUnsafeFloat() >=
      usdcPrice.toUnsafeFloat() ||
    // USDC is more expensive
    usdcPrice.toUnsafeFloat() >= usdtPrice.toUnsafeFloat()
  ) {
    return true;
  }
  return false;
}
//
// Makes a swap from one token to another depending on
// prices of the tokens
// First token (from) is the more expensive one
// Second token (to) is the less expensive one
async function swap(from, to, amount, expectedAmount) {
  let path = [from, to];
  // Get the current gas price
  let gasPrice = await wallet.getGasPrice();
  // Multiply current gas price for the provided multyplier amount
  let newGasPrice = gasPrice.mul(GAS_MULTIPLIER);
  console.log(`Swapping ${formatUnits(amount, 6)} tokens...`);
  await router
    .connect(wallet)
    .swapExactTokensForTokens(amount, 1, path, wallet.address, TIMEOUT, {
      gasPrice: newGasPrice,
    });
  console.log("Swap finished!");
}

// Shows USDT and USDC balances of the user
async function showWalletBalance() {
  console.log(
    `Wallet's USDT balance: ${formatUnits(
      await USDT.balanceOf(wallet.address),
      6
    )}`
  );
  console.log(
    `Wallet's USDC balance: ${formatUnits(
      await USDC.balanceOf(wallet.address),
      6
    )}`
  );
}

// Checks that user has enough tokens to swap the provided amount
// Returns true if user has enough tokens
// Return false if user does not have enough tokens
async function checkBalance(token, amount) {
  console.log(`Checking if user has ${formatUnits(amount.toString(), 6)} of ${await token.name()}...`);
  let balance = await token.balanceOf(wallet.address);
  if (balance.lt(amount)) {
    return false;
  }
  return true;
}
 
// Checks that router has an infinite allowance for USDT and USDC,
// no need to approve a transaction every time we want to make a swap
async function checkAllowancesAndApprove() {
  let usdtAllowance = await USDT.allowance(wallet.address, router.address);
  let usdcAllowance = await USDC.allowance(wallet.address, router.address);

  if (usdtAllowance != MAXUINT256) {
      await USDT.approve(router.address, MAXUINT256);
      console.log("USDT allowance set to infinite");
  }
  else {
      console.log("USDT allowance is OK");
  }
  if (usdcAllowance != MAXUINT256) {
      await USDC.approve(router.address, MAXUINT256);
      console.log("USDC allowance set to infinite");
  }
  else {
      console.log("USDC allowance is OK");
  }
}

// Compares prices of USDC and USDT tokens in the pool and
// swaps one token for another one
// If `amount` is not zero, then exactly the `amount` of tokens (USDT or USDC)
// will be swapped each time
// If `amount` is zero, then the whole user's balance of USDT and USDC
// will be swapped each time
// Notice that `amount` has decimals = 6
async function comparePricesAndSwap() {
  let [usdcAmount, usdtAmount, timestamp] = await pair.getReserves();
  let amount;
  let expectedAmount;

  await showWalletBalance();

  console.log("Comparing prices of tokens...");
  // Swap USDT -> USDC if USDT is more expensive
  if (await USDTMoreExpensive()) {
      console.log("USDT is more expensive");
      console.log("Trying to swap USDT -> USDC...");
      console.log("Calculating optimal swap amount...");
      try {
          amount = calcOptimalSwapAmount(usdtAmount)
      } catch(e) {
          console.error(e);
          return
      }
      console.log("Optimal swap amount is ", formatUnits(amount, 6), " USDT");
      // Swap everything we got if user has not enough tokens
      if (!(await checkBalance(USDT, amount))) {
          console.log("Not enough tokens for optimal swap, swapping everything we got!");
          amount = await USDT.balanceOf(wallet.address) 
      }
      if(amount == 0) {
          console.log("Out of USDT tokens, cancelling the swap!");
          return;
      }
      expectedAmount = await router.getAmountOut(amount, usdtAmount, usdcAmount);
      if(expectedAmount < amount) {
          console.log("Not profitable swap, reverting...");
          return;
      }
      console.log(`Expecting ${formatUnits(expectedAmount, 6)} tokens...`);
      // Make a swap
      await swap(USDT.address, USDC.address, amount, expectedAmount);

  // Swap USDC -> USDT if USDC is more expensive
  } else {
      console.log("USDC is more expensive");
      console.log("Trying to swap USDC -> USDT...");
      console.log("Calculating optimal swap amount...");
      try {
          amount = calcOptimalSwapAmount(usdcAmount)
      } catch(e) {
          console.error(e);
          return;
      }
      console.log("Optimal swap amount is ", formatUnits(amount, 6), " USDC");
      // Swap everything we got if user has not enough tokens
      if (!(await checkBalance(USDC, amount))) {
          console.log("Not enough tokens for optimal swap, swapping everything we got!");
          amount = await USDC.balanceOf(wallet.address) 
      }
      if(amount == 0) {
          console.log("Out of USDC tokens, cancelling the swap!");
          return;
      }
      expectedAmount = await router.getAmountOut(amount, usdcAmount, usdtAmount);
      if(expectedAmount < amount) {
          console.log("Not profitable swap, reverting...");
          return;
      }
      console.log(`Expecting ${formatUnits(expectedAmount, 6)} tokens...`);
      // Make a swap
      await swap(USDC.address, USDT.address, amount, expectedAmount);
  }
  await showWalletBalance();
}

// Main farming function
async function listenAndSwap() {
  console.log("\n\n\n\n===========\nSTART BOT");
  console.log(`\nCurrent chain is: ${network.name}`);
  console.log(`Gas price multiplier is: ${GAS_MULTIPLIER}`);

  // If the network is not Ultron - get the default provider for the specified network
  if (network.name != "ultronMainnet") {
    provider = ethers.provider;
  } else {
    // Provider for Ultron mainnet
    provider = new ethers.providers.JsonRpcProvider("https://ultron-rpc.net");
  }

  // Initialize user's wallet depending on the chosen network
  if (network.name != "ultronMainnet") {
    // Get default hardhat signers
    wallets = await ethers.getSigners();
    wallet = wallets[0];
  } else {
    wallet = new ethers.Wallet(ACC_PRIVATE_KEY, provider);
  }

  console.log(`Using wallet: ${wallet.address}`);

  // Initialize the pair contract
  // Order of tokens: USDC - USDT
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

  // Check allowances for our stablecoins and approve MAXUINT256 if needed
  console.log("\nChecking router allowances...")
  await checkAllowancesAndApprove();

  // Check if it's possible to make a swap right now without 
  // waiting for events
  console.log("\nChecking if it's possible to make a swap right now...")
  await comparePricesAndSwap();

  // Listen for events that change pool tokens' prices
  console.log("\nListening for pool events...");

  pair.on("Mint", () => {
    console.log("\nLiquidity has been added to the pool!");
    queue.add(async () => {
      await comparePricesAndSwap();
    });
  });

  pair.on("Burn", () => {
    console.log("\nLiquidity has been withdrawn from the pool!");
    queue.add(async () => {
      await comparePricesAndSwap();
    });
  });

  pair.on("Swap", (sender, a1, a2, a3, a4, to) => {
    // Check that the one who called swap was not the current user.
    // Because otherwise if we make another swap here, it will emit
    // one more "Swap" event, and it will trigger this section of code
    // and so on... Prevent recursion that way.
    if (to !== wallet.address) {
      console.log("\nTokens have been swapped inside the pool!");
      queue.add(async () => {
        await comparePricesAndSwap();
      });
    }
  });
}

if (require.main === module) {
  listenAndSwap()
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
}

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const delay = require("delay");
const { formatEther, parseEther, parseUnits, formatUnits, keccak256 } = ethers.utils;
const { getContractFactory, getContractAt, BigNumber, FixedNumber } = ethers;


// Note that most of operations with numbers(in functions) are done using FixedNumber lib to be able to 
// make floating point divisions (BigNumber does not allow this)

// The private key of the user
const ACC_PRIVATE_KEY = process.env.ACC_PRIVATE_KEY;
// The USDC/USDT (or USDC/USDT) price ratio enough to trigger the swap
// If no value was provided by the user, it's set to 1.5
const SWAP_THRESHOLD = process.env.SWAP_THRESHOLD || 1.5;
// The amount of tokens to swap each time
// If no amount is provided, it's set to zero
// If amount is not zero, then exactly this amount of tokens (USDT or USDC) 
// will be swapped each time
// If amount is zero, then the whole user's balance of USDT and USDC 
// will be swapped each time
const AMOUNT = process.env.AMOUNT === "" ? parseUnits("0", 6) : parseUnits(process.env.AMOUNT, 6);
// The maximum allowed difference in token prices before and after the swap (in *percents*)
// e.g. 10 = 10%; If after the swap the price of USDT decreases by 11 - cancel the swap.
// (price difference is checked *before* the actual swap)
// (the more USDTs are transferred into the pool, the lower the price of USDT gets)
// If no value is provided by the user, 1% is set as a default value
const MAX_PRICE_CHANGE = process.env.MAX_PRICE_CHANGE || 1; 
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
  USDT: 'USDT', // USDC -> USDT
  USDC: 'USDC' // USDT -> USDC
}

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
let lastSwapDirection;

// Returns the price of USDC in the pool (pair)
async function getPriceUSDC() {
  let [usdcAmount, usdtAmount, timestamp] = await pair.getReserves();
  usdcAmount = FixedNumber.from(usdcAmount);
  usdtAmount = FixedNumber.from(usdtAmount);
  let usdcPrice = FixedNumber.from(await router.getAmountOut(AMOUNT_FOR_PRICE, usdcAmount, usdtAmount));
  return usdcPrice;
}

// Returns the price of USDT in the pool (pair)
async function getPriceUSDT() {
  let [usdcAmount, usdtAmount, timestamp] = await pair.getReserves();
  usdcAmount = FixedNumber.from(usdcAmount);
  usdtAmount = FixedNumber.from(usdtAmount);
  let usdtPrice = FixedNumber.from(await router.getAmountOut(AMOUNT_FOR_PRICE, usdtAmount, usdcAmount));
  return usdtPrice;
}

// Returns true if USDT has bigger price
// Returns false if USDC has bigger price
async function USDTMoreExpensive() {
  let usdtPrice = await getPriceUSDT();
  let usdcPrice = await getPriceUSDC();
  let threshold = FixedNumber.from(SWAP_THRESHOLD);
  console.log("USDT price is: ", formatUnits(usdtPrice.toUnsafeFloat(), 6));
  console.log("USDC price is: ", formatUnits(usdcPrice.toUnsafeFloat(), 6)); 
  if (usdtPrice.toUnsafeFloat() >= (usdcPrice.mulUnsafe(threshold)).toUnsafeFloat()) {
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
  let threshold = FixedNumber.from(SWAP_THRESHOLD);
  if (
    // Convert FixedNumber to float to make a comparison
    // USDT is more expensive
    (usdtPrice.toUnsafeFloat() >= (usdcPrice.mulUnsafe(threshold).toUnsafeFloat()) || 
    // USDC is more expensive
    (usdcPrice.toUnsafeFloat() >= (usdtPrice.mulUnsafe(threshold).toUnsafeFloat())))
    ) 
  {
    return true;
  }
  console.log("Swap threshold was not reached yet!");
  return false;
}

// Makes a swap from one token to another depending on 
// prices of the tokens
// First token (from) is the more expensive one
// Second token (to) is the less expensive one
async function swap(from, to, amount) {
  console.log(`Swap amount is ${formatUnits(amount, 6)}`);
  let path = [from, to];
  await router.connect(wallet).swapExactTokensForTokens(
    amount,
    1,
    path,
    wallet.address,
    TIMEOUT
  );
  if (to == USDC.address) {
    lastSwapDirection = SwapDirection.USDC;
  } else if (to == USDT.address) {
    lastSwapDirection = SwapDirection.USDT;
  }
}

// Shows USDT and USDC balances of the user 
async function showWalletBalance() {
  console.log(`Wallet's USDT balance: ${formatUnits(await USDT.balanceOf(wallet.address), 6)}`);
  console.log(`Wallet's USDC balance: ${formatUnits(await USDC.balanceOf(wallet.address), 6)}`);
}

// Checks that user has enough tokens to swap the provided amount
// Returns true if user has enough tokens
// Return false if user does not have enough tokens
async function checkBalance(token, amount) {
  let balance = await token.balanceOf(wallet.address);
  if (balance.lt(amount)) {
    return false;
  }
  return true;
}


// Finds an optimal amount of tokens to deposit
// Optimal amount is the amount that after being deposited into the pool will
// not change the price of deposited tokens for more percents than expected
// Returns an amounts as BigNumber
async function findOptimalAmount(token) {

  let [usdcReserve, usdtReserve, timestamp] = await pair.getReserves();
  // Choose wich token we're working with
  let currentReserveIn = token.address == USDC.address ? usdcReserve : usdtReserve;
  // Convert all values to FixedNumbers
  currentReserveIn = FixedNumber.from(currentReserveIn);
  maxPriceChange = FixedNumber.from(MAX_PRICE_CHANGE);
  amountForPrice = FixedNumber.from(AMOUNT_FOR_PRICE);
  // In the next 3 lines the math magic happens. This formula was derived specifically for this case
  let numerator = (FixedNumber.from(100_000).mulUnsafe(currentReserveIn)).addUnsafe(FixedNumber.from(997).mulUnsafe(maxPriceChange).mulUnsafe(amountForPrice));
  let denominator = FixedNumber.from(1000).mulUnsafe((FixedNumber.from(100).subUnsafe(maxPriceChange)));
  // The maximum  reserveIn that will not change the price for more than MAX_PRICE_CHANGE percents
  let maxReserveIn = numerator.divUnsafe(denominator);
  // The maximum amount of input token to deposit into the pool for the price to change not more than for MAX_PRICE_CHANGE percents
  let maxAmount = maxReserveIn.subUnsafe(currentReserveIn);
  // Now maxAmount is a form of a float number like `3337.8920380...`
  // We need to only use the integer part (before ".") 
  maxAmount = maxAmount.toString().split(".")[0];
  // Convert it back to BigNumber
  maxAmount = BigNumber.from(maxAmount)
  return maxAmount;
}

// Compares prices of USDC and USDT tokens in the pool and 
// swaps one token for another one
// If `amount` is not zero, then exactly the `amount` of tokens (USDT or USDC) 
// will be swapped each time
// If `amount` is zero, then the whole user's balance of USDT and USDC 
// will be swapped each time
// Notice that `amount` has decimals = 6
async function comparePricesAndSwap(amount) {

  await showWalletBalance();
  let optimalAmount;

  // Check if threshold was reached
  // If not - do not swap tokens
  if (!(await checkThreshold())) {
    console.log("Swap threshold was not reached yet!");
    return;
  }

  // Swap USDT -> USDC if USDT is more expensive
  if (await USDTMoreExpensive()) {

    console.log("USDT is more expensive");
    console.log("Swapping: USDT -> USDC");  

    // If the last swap was USDT -> USDC, there is no need to do another one
    if (lastSwapDirection == SwapDirection.USDC) {
      console.log("Last swap was USDT -> USDC already. Cancel the swap...")
      return;
    }

    // Find the optimal amount for that swap
    optimalAmount = await findOptimalAmount(USDT);

    // User wants to swap an exact amount of tokens
    if (amount != parseUnits(0, 6)) {

      // Swap is impossible if user has not enough tokens
      if (!(await checkBalance(USDT, amount))) {
        console.log("User has not enough tokens to swap!");
        return;
      }

      // Swap is impossible if price will change too much
      if (amount.gt(optimalAmount)) {
        console.log("The swap will affect price too much. Cancel swap!");
        // Suggest the user to either now provide any amount, or decrease it
        console.log("Decrease the amount to swap you have provided OR do not provide it at all!");
        return;
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDT.connect(wallet).approve(router.address, amount);
      await approveTx.wait();
      // Make a swap
      await swap(USDT.address, USDC.address, amount);

    // User wants to swap his whole balance of tokens
    } else {

      // Amount is the whole balance of the user
      let balance = await USDT.balanceOf(wallet.address);

      // Swap is impossible if user has not enough tokens
      if (!(await checkBalance(USDT, balance))) {
        console.log("User has not enough tokens to swap!");
        return;
      }

      // Swap is impossible if price will change too much
      if (balance.gt(optimalAmount)) {
        console.log("The swap will affect price too much. Cancel swap!");
        // Use the optimal amount instead of user's balance in that case
        balance = optimalAmount;
        console.log(`Using an optimal amount of ${formatUnits(balance, 6)} to make a swap.`);
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDT.connect(wallet).approve(router.address, balance);
      await approveTx.wait();
      // Make a swap
      await swap(USDT.address, USDC.address, balance);
    }

  // Swap USDC -> USDT if USDC is more expensive
  } else {

    console.log("USDC is more expensive");
    console.log("Swapping: USDC -> USDT");  

    // Find the optimal amount for that swap
    optimalAmount = await findOptimalAmount(USDC);

    // If the last swap was USDC -> USDT, there is no need to do another one
    if (lastSwapDirection == SwapDirection.USDT) {
      console.log("Last swap was USDC -> USDT already. Cancel the swap...")
      return;
    }

    // User wants to swap an exact amount of tokens
    if (amount != 0) {

      // Swap is impossible if user has not enough tokens
      if (!(await checkBalance(USDC, amount))) {
        console.log("User has not enough tokens to swap!");
        return;
      }

      // Swap is impossible if price will change too much
      if (amount.gt(optimalAmount)) {
        console.log("The swap will affect price too much. Cancel swap!");
        // Suggest the user to either now provide any amount, or decrease it
        console.log("Decrease the amount to swap you have provided OR do not provide it at all!");
        return;
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDC.connect(wallet).approve(router.address, amount);
      await approveTx.wait();
      // Make a swap
      await swap(USDC.address, USDT.address, amount);

    // User wants to swap his whole balance of tokens
    } else {

      // Amount is the whole balance of the user
      let balance = await USDC.balanceOf(wallet.address);

      // Swap is impossible if user has not enough tokens
      if (!(await checkBalance(USDC, balance))) {
        console.log("User has not enough tokens to swap!");
        return;
      }

      console.log("balance is ", balance);
      console.log("optimal amount is ", optimalAmount)
      // Swap is impossible if price will change too much
      if (balance.gt(optimalAmount)) {
        console.log("The swap will affect price too much. Cancel swap!");
        // Use the optimal amount instead of user's balance in that case
        balance = optimalAmount;
        console.log(`Using an optimal amount of ${formatUnits(balance, 6)} to make a swap.`);
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDC.connect(wallet).approve(router.address, balance);
      await approveTx.wait();
      // Make a swap
      await swap(USDC.address, USDT.address, balance);

    }
  }

  console.log("Swap Finished!");
  await showWalletBalance();
}




// Main farming function
async function listenAndSwap() {

  console.log("Start bot");
  console.log(`\nCurrent chain is: ${network.name}`);
  console.log(`Swap threshold is: ${SWAP_THRESHOLD}`);
  console.log(`Amount to swap is: ${formatUnits(AMOUNT, 6)}`);
  console.log(`Max price change is: ${MAX_PRICE_CHANGE}%`);

  // Make sure that threshold is greater than 1
  if (!(SWAP_THRESHOLD > 1)) {
    throw "Swap threshold should be a greater than 1";
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

  console.log("Listening for pool events...");

  pair.on("Mint", () => {
    console.log("\nLiquidity has been added to the pool!");
    queue.add(async() => {await comparePricesAndSwap(AMOUNT)});
  });

  pair.on("Burn", () => {
    console.log("\nLiquidity has been withdrawn from the pool!");
    queue.add(async() => {await comparePricesAndSwap(AMOUNT)});
  });

  pair.on("Swap", (sender, a1, a2, a3, a4, to) => {
    // Check that the one who called swap was not the current user.
    // Because otherwise if we make another swap here, it will emit
    // one more "Swap" event, and it will trigger this section of code
    // and so on... Prevent recursion that way.
    if (to !== wallet.address) {
      console.log("\nTokens have been swapped inside the pool!");
      queue.add(async() => {await comparePricesAndSwap(AMOUNT)});
    }
  });
}

listenAndSwap();
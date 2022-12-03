const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
require("dotenv").config();
const { formatEther, parseEther, parseUnits, formatUnits, keccak256 } =
  ethers.utils;
const { getContractFactory, getContractAt, BigNumber, FixedNumber } = ethers;
const { 
  buyToken,
  swapTokens,
  addLiquidityWithToken,
  removeLiquidity,
  triggerEvents,
} = require("../scripts/events.js");

// This script is meant to be executed on localhost only
if (network.name !== "localhost") {
  console.log("This script is for `localhost` network only!");
  process.exit(0);
}

// All global variables used in the functions below
let SWAP_THRESHOLD;
let AMOUNT;
let MAX_PRICE_CHANGE;
let GAS_MULTIPLIER;
let ROUTER_ADDRESS;
let USDT_ADDRESS;
let USDC_ADDRESS;
let PAIR_ADDRESS;
let TIMEOUT;
let AMOUNT_FOR_PRICE;
let pair;
let provider;
let wallet;
let router;
let USDT;
let USDC;
let lastSwapDirection;
let amountTokenDesired;
let ULX_ADDRESS;

const SwapDirection = {
  USDT: "USDT", // USDC -> USDT
  USDC: "USDC", // USDT -> USDC
};
// Allows to create a queue of promises and resolve them one by one
class Queue {
  // Initially, that's a single resolved promise
  queue = Promise.resolve();

  // Adds another promise to the end of the queue
  add(promise) {
    this.queue = this.queue.then(promise).catch(() => {});
  }
}

// Initialize all global variables in an async manner
async function init() {
  // These values are hard-coded to provide the same conditions at each run
  // of tests
  SWAP_THRESHOLD = "1.001";
  AMOUNT = parseUnits("4", 6);
  MAX_PRICE_CHANGE = "1";
  GAS_MULTIPLIER = "4";
  ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
  USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
  USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
  PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";
  TIMEOUT = Date.now() + 1000 * 60 * 10;
  AMOUNT_FOR_PRICE = parseUnits("1", 6);
  amountTokenDesired = parseUnits("2", 6);
  provider = ethers.provider;
  let wallets = await ethers.getSigners();
  wallet = wallets[0];
  pair = await getContractAt("UniswapV2Pair", PAIR_ADDRESS, wallet);
  USDT = await getContractAt("USDX", USDT_ADDRESS, wallet);
  USDC = await getContractAt("USDX", USDC_ADDRESS, wallet);
  router = await getContractAt("UniswapV2Router02", ROUTER_ADDRESS, wallet);
  ULX_ADDRESS = await router.WETH();
}




// ================================================================
// Copy of all function from main.js
// To keep tests up-to-date, you have to **copy here** all changes you
// make inside `main.js`


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
  let threshold = FixedNumber.from(SWAP_THRESHOLD);
  console.log("USDT price is: ", formatUnits(usdtPrice.toUnsafeFloat(), 6));
  console.log("USDC price is: ", formatUnits(usdcPrice.toUnsafeFloat(), 6));
  if (
    usdtPrice.toUnsafeFloat() >= usdcPrice.mulUnsafe(threshold).toUnsafeFloat()
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
  let threshold = FixedNumber.from(SWAP_THRESHOLD);
  if (
    // Convert FixedNumber to float to make a comparison
    // USDT is more expensive
    usdtPrice.toUnsafeFloat() >=
      usdcPrice.mulUnsafe(threshold).toUnsafeFloat() ||
    // USDC is more expensive
    usdcPrice.toUnsafeFloat() >= usdtPrice.mulUnsafe(threshold).toUnsafeFloat()
  ) {
    return true;
  }
  return false;
}

// Makes a swap from one token to another depending on
// prices of the tokens
// First token (from) is the more expensive one
// Second token (to) is the less expensive one
async function swap(from, to, amount) {
  console.log(`Swap amount is ${formatUnits(amount, 6)}`);
  let path = [from, to];
  // Get the current gas price
  let gasPrice = await wallet.getGasPrice();
  // Multiply current gas price for the provided multyplier amount
  let newGasPrice = gasPrice.mul(GAS_MULTIPLIER);
  await router
    .connect(wallet)
    .swapExactTokensForTokens(amount, 1, path, wallet.address, TIMEOUT, {
      gasPrice: newGasPrice,
    });
  if (to == USDC.address) {
    lastSwapDirection = SwapDirection.USDC;
  } else if (to == USDT.address) {
    lastSwapDirection = SwapDirection.USDT;
  }
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
  let balance = await token.balanceOf(wallet.address);
  if (balance.lt(amount)) {
    return false;
  }
  return true;
}

// Finds an amount of tokens to deposit
// Optimal amount is the amount that after being deposited into the pool will
// not change the price of deposited tokens for more percents than expected
// Returns an amounts as BigNumber
async function findOptimalAmount(token) {
  let [usdcReserve, usdtReserve, timestamp] = await pair.getReserves();
  // Choose wich token we're working with
  let currentReserveIn =
    token.address == USDC.address ? usdcReserve : usdtReserve;
  // Convert all values to FixedNumbers
  currentReserveIn = FixedNumber.from(currentReserveIn);
  maxPriceChange = FixedNumber.from(MAX_PRICE_CHANGE);
  amountForPrice = FixedNumber.from(AMOUNT_FOR_PRICE);
  // In the next 3 lines the math magic happens. This formula was derived specifically for this case
  let numerator = FixedNumber.from(100_000)
    .mulUnsafe(currentReserveIn)
    .addUnsafe(
      FixedNumber.from(997).mulUnsafe(maxPriceChange).mulUnsafe(amountForPrice)
    );
  let denominator = FixedNumber.from(1000).mulUnsafe(
    FixedNumber.from(100).subUnsafe(maxPriceChange)
  );
  // The maximum  reserveIn that will not change the price for more than MAX_PRICE_CHANGE percents
  let maxReserveIn = numerator.divUnsafe(denominator);
  // The maximum amount of input token to deposit into the pool for the price to change not more than for MAX_PRICE_CHANGE percents
  let maxAmount = maxReserveIn.subUnsafe(currentReserveIn);
  // Now maxAmount is a form of a float number like `3337.8920380...`
  // We need to only use the integer part (before ".")
  maxAmount = maxAmount.toString().split(".")[0];
  // Convert it back to BigNumber
  maxAmount = BigNumber.from(maxAmount);
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
      console.log("Last swap was USDT -> USDC already. Cancel the swap...");
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
        console.log(
          "Decrease the amount to swap you have provided OR do not provide it at all!"
        );
        return;
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDT.connect(wallet).approve(
        router.address,
        amount
      );
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
        console.log(
          `Using an optimal amount of ${formatUnits(
            balance,
            6
          )} to make a swap.`
        );
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDT.connect(wallet).approve(
        router.address,
        balance
      );
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
      console.log("Last swap was USDC -> USDT already. Cancel the swap...");
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
        console.log(
          "Decrease the amount to swap you have provided OR do not provide it at all!"
        );
        return;
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDC.connect(wallet).approve(
        router.address,
        amount
      );
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
      // Swap is impossible if price will change too much
      if (balance.gt(optimalAmount)) {
        console.log("The swap will affect price too much. Cancel swap!");
        // Use the optimal amount instead of user's balance in that case
        balance = optimalAmount;
        console.log(
          `Using an optimal amount of ${formatUnits(
            balance,
            6
          )} to make a swap.`
        );
      }

      // Approve the transfer of swapped tokens from user to the pool
      let approveTx = await USDC.connect(wallet).approve(
        router.address,
        balance
      );
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
  console.log("\n\n\n\n===========\nSTART BOT");
  console.log(`\nCurrent chain is: ${network.name}`);
  console.log(`Swap threshold is: ${SWAP_THRESHOLD}`);
  console.log(`Amount to swap is: ${formatUnits(AMOUNT, 6)}`);
  console.log(`Max price change is: ${MAX_PRICE_CHANGE}%`);
  console.log(`Gas price multiplier is: ${GAS_MULTIPLIER}`);

  // Check if it's possible to make a swap right now without 
  // waiting for events
  console.log("\nChecking if it's possible to make a swap right now...")
  await comparePricesAndSwap(AMOUNT);

  console.log("\nListening for pool events...");

  pair.on("Mint", () => {
    console.log("\nLiquidity has been added to the pool!");
    queue.add(async () => {
      await comparePricesAndSwap(AMOUNT);
    });
  });

  pair.on("Burn", () => {
    console.log("\nLiquidity has been withdrawn from the pool!");
    queue.add(async () => {
      await comparePricesAndSwap(AMOUNT);
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
        await comparePricesAndSwap(AMOUNT);
      });
    }
  });
}


// ================================================================
// Start of tests



// NOTE: All values that are compared to function results were
// calculcated by hand. That was possible because of the exact known 
// state of the Ultron fork and a set of constant variables (i.e. tests run the same each time) 

// NOTE: These tests include swaps. That is why you have to **restart** your chain node
// after each run of tests in order for them to work correctly
describe("Phoenix bot", () => {
  
  before(async () => {
    await init();
    // Buy some USDC and USDT for the user
    let path = [ULX_ADDRESS, USDT.address];
    let txResponse = await router.connect(wallet).swapExactETHForTokens(
      amountTokenDesired,
      path,
      wallet.address,
      TIMEOUT,
      // 1 ULX ~= 0.06 USDT in fork
      { value: parseEther("100") }
    );
    let txReceipt = await txResponse.wait();
    path = [ULX_ADDRESS, USDC.address];
    txResponse = await router.connect(wallet).swapExactETHForTokens(
      amountTokenDesired,
      path,
      wallet.address,
      TIMEOUT,
      // 1 ULX ~= 0.06 USDT in fork
      { value: parseEther("100") }
    );
    txReceipt = await txResponse.wait();
  });
  
  it("Calculate USDC price correctly", async () => {
    // Calculated by hand
    let expectedAmount = FixedNumber.from("1001938");
    let realAmount = await getPriceUSDC();
    expect(realAmount.toUnsafeFloat()).to.eq(expectedAmount.toUnsafeFloat());
  });
  
  it("Calculate USDT price correctly", async () => {
    // Calculated by hand
    let expectedAmount = FixedNumber.from("992085");
    let realAmount = await getPriceUSDT();
    expect(realAmount.toUnsafeFloat()).to.eq(expectedAmount.toUnsafeFloat());
  });

  it("Should find the more expensive token correctly", async () => {
    expect(await USDTMoreExpensive()).to.eq(false);
  });

  it("Should check that threshold was reached", async () => {
    expect(await checkThreshold()).to.eq(true);
  });


  it("Should swap two tokens", async () => {
    let startUsdtBalance = await USDT.balanceOf(pair.address);
    let startUsdcBalance = await USDC.balanceOf(pair.address);
    littleAmount = parseUnits("1", 6);
    // Approve a swap
    let approveTx = await USDT.connect(wallet).approve(
      router.address,
      littleAmount,
    );
    await approveTx.wait();
    // Make a swap
    await swap(USDT.address, USDC.address, littleAmount); 
    let endUsdtBalance = await USDT.balanceOf(pair.address);
    let endUsdcBalance = await USDC.balanceOf(pair.address);
    // User deposited USDT into the pool
    expect(endUsdtBalance).to.gt(startUsdtBalance);
    // Uset withdrawn USDC from the pool
    expect(endUsdcBalance).to.lt(startUsdcBalance);
  });



  it("Check that wallet does not have enough tokens", async () => {
    // User has 0 USDT
    expect(await checkBalance(USDT, parseUnits("1000", 6))).to.eq(false)
  });

  it("Should calculate the optimal amount correctly", async () => {
    // Calculated by hand
    let expectedAmount = BigNumber.from("3388339801");
    let realAmount = await findOptimalAmount(USDT);
    expect(realAmount).to.eq(expectedAmount);
  });

  it("Check that USDC is more expensive and swap USDC -> USDT", async () => {
    let startUsdtBalance = await USDT.balanceOf(pair.address);
    let startUsdcBalance = await USDC.balanceOf(pair.address);
    littleAmount = parseUnits("1", 6);
    await comparePricesAndSwap(littleAmount);
    let endUsdtBalance = await USDT.balanceOf(pair.address);
    let endUsdcBalance = await USDC.balanceOf(pair.address);
    // User deposited USDT into the pool
    expect(endUsdtBalance).to.lt(startUsdtBalance);
    // Uset withdrawn USDC from the pool
    expect(endUsdcBalance).to.gt(startUsdcBalance);
  });
});

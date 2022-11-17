const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { formatEther, parseEther, parseUnits, keccak256 } = ethers.utils;
const { getContractFactory, getContractAt } = ethers;

// The USDC/USDT (or USDC/USDT) price ratio enough to trigger the swap
const SWAP_THRESHOLD = parseEther(process.env.SWAP_THRESHOLD || "0");
// The address of main UniswapV2Router02 deployed and used on Ultron mainnet
const ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
// Addresses of uUSDT and uUSDC
const USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
const USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
// The address of main USDT/USDC pair pool deployed and used on Ultron mainnet
const PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";

async function getPriceUSDC() {
  let bothPrices = await router.getAmountsOut(parseUnits("1"), [USDC_ADDRESS, USDT_ADDRESS]);
  let usdcPrice = bothPrices[0];
  return usdcPrice;
}

async function getPriceUSDT() {
  let bothPrices = await router.getAmountsOut(parseUnits("1"), [USDC_ADDRESS, USDT_ADDRESS]);
  let usdtPrice = bothPrices[1];
  return usdtPrice;
  
}

// TODO Should get called after any event to make a swap
// Returns 0 if USDC has bigger price
// Returns 1 if USDT has bigger price
async function checkPrice() {
  let usdcPrice = await getPriceUSDC();
  let usdtPrice = await getPriceUSDT();

  if (usdcPrice.gt(usdtPrice.mul(SWAP_THRESHOLD))) {
    return 0;
  } else {
    return 1;
  }
}


// Main farming function
async function main() {

  console.log("Start bot\n");
  console.log(`\nCurrent chain: ${network.name}`)
  // Get the first waller from the network
  const wallets = await ethers.getSigners();
  const wallet = wallets[0];
  console.log("Wallet address is ", wallet.address);


  // Initialize the pair contract
  const pair = await getContractAt("UniswapV2Pair", PAIR_ADDRESS, wallet);
  console.log("Pair address is ", pair.address);
  // console.log("Pair is ", pair);

  // Initialize the USDT and USDC contracts
  // Both inherit from ERC20PresetMinterPauser 
  const USDT = await getContractAt("USDX", USDT_ADDRESS, wallet);
  const USDC = await getContractAt("USDX", USDC_ADDRESS, wallet);
  // Initialize the Router contract
  const router = await getContractAt("IUniswapV2Router02", ROUTER_ADDRESS, wallet);  
  console.log("USDT address is ", USDT.address);
  console.log("USDC address is ", USDC.address);

  // TODO Path must change according to price ratio
  let path = [USDT.address, USDC.address];
  console.log("Listening for pool events...");
  pair.on("Mint", async () => {
    console.log("Liquidity has been added to the pool!");
    // await router.swapExactTokensForTokens(
    //   0, path, wallet.address, Date.now() + 1000 * 60 * 10,
    //   {value: SWAP_THRESHOLD}
    // );
  });
  pair.on("Burn", async () => {
    console.log("Liquidity has been withdrawn from the pool!");
    // await router.swapExactTokensForTokens(
    //   0, path, wallet.address, Date.now() + 1000 * 60 * 10,
    //   {value: SWAP_THRESHOLD}
    // );
  });
  pair.on("Swap", async () => {
    console.log("Tokens have been swapped inside the pool!");
    // await router.swapExactTokensForTokens(
    //   0, path, wallet.address, Date.now() + 1000 * 60 * 10,
    //   {value: SWAP_THRESHOLD}
    // );
  });
}

main();

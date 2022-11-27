const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
require("dotenv").config();
const { formatEther, formatUnits, parseEther, parseUnits} = ethers.utils;
const { getContractFactory, getContractAt } = ethers;

/**
 * This test file should be used while running main script on the same network. 
 * For example:
 * - npx hardhat node --network hardhat (start a local node of Ultron fork)
 * - npx hardhat run app/main.js --network localhost (run app on the local node)
 * - npx hardhat run test/events.js --network localhost (run this script to trigger events in the app)
 */

// This scripts is meant to be executed on localhost only
if (network.name !== "localhost") {
  console.log("This script is for `localhost` network only!");
  process.exit(0);
}

const SWAP_THRESHOLD = process.env.SWAP_THRESHOLD === "" ? parseEther("0") : parseEther(process.env.SWAP_THRESHOLD);
// The address of main UniswapV2Router02 deployed and used on Ultron mainnet
const ROUTER_ADDRESS = "0x2149Ca7a3e4098d6C4390444769DA671b4dC3001";
// Addresses of uUSDT and uUSDC
const USDT_ADDRESS = "0x97fdd294024f50c388e39e73f1705a35cfe87656";
const USDC_ADDRESS = "0x3c4e0fded74876295ca36f62da289f69e3929cc4";
// The address of main USDT/USDC pair pool deployed and used on Ultron mainnet
const PAIR_ADDRESS = "0x5910306486d3adF0f2ec3146A8C38e6C1F3404b7";

// Function creates a pair of tokens and adds liquidity to it
async function triggerEvents() {

  console.log(`\nCurrent chain: ${network.name}`)
  const wallets = await ethers.getSigners();
  const wallet = wallets[0];

  // Initialize the pair contract
  const pair = await getContractAt("UniswapV2Pair", PAIR_ADDRESS, wallet);
  console.log("Pair address is ", pair.address);

  // Initialize the USDT and USDC contracts
  // Both inherit from ERC20PresetMinterPauser 
  const USDT = await getContractAt("USDX", USDT_ADDRESS, wallet);
  const USDC = await getContractAt("USDX", USDC_ADDRESS, wallet);
  // Initialize the Router contract
  const router = await getContractAt("UniswapV2Router02", ROUTER_ADDRESS, wallet);  
  // This is the address of native tokens (ULX - NOT ETH)
  // No need to actually initialize the contract
  const ULX_ADDRESS = await router.WETH();
  // The amount of USDT (USDC) to add as liquidity
  const amountTokenDesired = parseUnits("2", 6);
  // const amountTokenDesired = 20;
  // The timeout for transactions
  const TIMEOUT = Date.now() + 1000 * 60 * 10;

  // Buy USDC and USDT for ETH

  const factory = await getContractAt("UniswapV2Factory", router.factory(), wallet);
  let path = [ULX_ADDRESS, USDT.address];
  console.log("USDT_address is ", USDT.address);
  console.log("USDC address is ", USDC.address);
  console.log("Amount to swap is: ", formatUnits(amountTokenDesired, 6));
  console.log("Swap ULX for USDT");
  console.log("Wallet ULX balance before swap is ", formatEther(await wallet.getBalance()));
  console.log("Wallet USDT balance before swap is ", formatUnits(await USDT.balanceOf(wallet.address), 6));
  let txResponse = await router.connect(wallet).swapExactETHForTokens(
    amountTokenDesired, // we need to have at least as many tokens as we want to add to the pool
    path,
    wallet.address,
    TIMEOUT,
    // 1 ULX ~= 0.06 USDT in fork
    {value: parseEther("100")}, 
  );
  let txReceipt = await txResponse.wait();
  console.log("Swap Finished!");
  console.log("Wallet ULX balance after swap is ", formatEther(await wallet.getBalance()));
  console.log("Wallet USDT balance after swap is ", formatUnits(await USDT.balanceOf(wallet.address), 6));

  console.log("Swap ULX for USDC");
  console.log("Wallet ULX balance before swap is ", formatEther(await wallet.getBalance()));
  console.log("Wallet USDC balance before swap is ", formatUnits(await USDC.balanceOf(wallet.address), 6));
  path = [ULX_ADDRESS, USDC.address];
  txResponse = await router.connect(wallet).swapExactETHForTokens(
    amountTokenDesired, // we need to have at least as many tokens as we want to add to the pool
    path,
    wallet.address,
    TIMEOUT,
    {value: parseEther("100")}, 
  );
  txReceipt = await txResponse.wait();
  console.log("Swap Finished!");
  console.log("Wallet ULX balance after swap is ", formatEther(await wallet.getBalance()));
  console.log("Wallet USDT balance after swap is ", formatUnits(await USDT.balanceOf(wallet.address), 6));

  // Deposit USDT into the pool
  // Now we have to add liquidity to the pair in order for token/ETH price to become 10 times greater
  console.log("Add Luquidity to USDC/USDT pool with USDT..");
  console.log("Approving adding liquidity...");
  // We have to approve both USDC and USDT
  let approveTx = await USDT.connect(wallet).approve(router.address, amountTokenDesired);
  let approveReceipt = await approveTx.wait();
  approveTx = await USDC.connect(wallet).approve(router.address, amountTokenDesired);
  approveReceipt = await approveTx.wait();
  console.log("Approved!");

  console.log("Adding liquidity...");
  console.log(`USDT balance of the wallet before adding:`, formatUnits(await USDT.balanceOf(wallet.address), 6));
  console.log(`USDT balance of the pair before adding:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair before adding:`, formatUnits(await USDC.balanceOf(pair.address), 6));

  txResponse = await router.connect(wallet).addLiquidity (
    USDT.address,
    USDC.address,
    amountTokenDesired,
    amountTokenDesired,
    ethers.utils.parseEther("0"),
    ethers.utils.parseEther("0"),
    wallet.address,
    TIMEOUT,
  );

  txReceipt = await txResponse.wait();

  console.log("Liquidity added!");

  console.log(`USDT balance of the wallet after adding:`, await formatUnits(await USDT.balanceOf(wallet.address), 6));
  console.log(`USDT balance of the pair after adding:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair after adding:`, formatUnits(await USDC.balanceOf(pair.address), 6));
  await delay(5000);

  // Swap tokens inside the pool

  console.log("Swap USDT for USDC inside the pool");
  console.log(`USDT balance of the pair before swapping:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair before swapping:`, formatUnits(await USDC.balanceOf(pair.address), 6));
  path = [USDT.address, USDC.address];
  // We have to approve USDT
  approveTx = await USDT.connect(wallet).approve(router.address, amountTokenDesired);
  approveReceipt = await approveTx.wait();
  txResponse = await router.connect(wallet).swapExactTokensForTokens (
    amountTokenDesired,
    0,
    path, 
    wallet.address,
    TIMEOUT,
  );

  txReceipt = await txResponse.wait();

  console.log("Swap finished!");
  console.log(`USDT balance of the pair after swapping:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair after swapping:`, formatUnits(await USDC.balanceOf(pair.address), 6));
  await delay(5000);

  // Remove liquidity from the pool

  console.log("Remove liquidity from the pool");
  console.log(`USDT balance of the pair before liquidity withdrawal:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair before liquidity withdrawal:`, formatUnits(await USDC.balanceOf(pair.address), 6));
  console.log(`USDC balance of the wallet before liquidity withdrawal:`, formatUnits(await USDC.balanceOf(wallet.address), 6));
  console.log(`LP tokens balance of the user before liquidity withdrawal`, formatUnits(await pair.balanceOf(wallet.address), 18));

  liquidity = await pair.balanceOf(wallet.address);
  // Approve transfer of LP tokens from wallet back to the contract
  approveTx = await pair.approve(router.address, liquidity);
  approveReceipt = await approveTx.wait();
  txResponse = await router.connect(wallet).removeLiquidity (
    USDT.address,
    USDC.address,
    liquidity,
    1, // at least 1 USDT and 1 USDC should be collected
    1,
    wallet.address,
    TIMEOUT,
  );

  txReceipt = await txResponse.wait();

  console.log("Liquidity withdrawn!");

  console.log(`USDT balance of the pair after liquidity withdrawal:`, formatUnits(await USDT.balanceOf(pair.address), 6));
  console.log(`USDC balance of the pair after liquidity withdrawal:`, formatUnits(await USDC.balanceOf(pair.address), 6));
  console.log(`USDC balance of the wallet after liquidity withdrawal:`, formatUnits(await USDC.balanceOf(wallet.address), 6));
  console.log(`LP tokens balance of the user after liquidity withdrawal`, formatUnits(await pair.balanceOf(wallet.address), 18));

}


triggerEvents();
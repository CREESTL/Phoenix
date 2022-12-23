## Phoenix Bot

Phoenix is a bot for automated swaps in USDT/USDC pool on Ultron Network

#### Table on contents

[Run the Bot](#run)  
[Test the Bot](#tests)  
[Wallets](#wallets)  
[Bot Logic](#logic)  

<a name="run"/>

### Run the Bot

<a name="preqs">

#### Prerequisites

- Install [Git](https://git-scm.com/)
- Install [Node.js](https://nodejs.org/en/download/)
- Clone this repository with `git clone https://git.sfxdx.ru/phoenix/autobot`
- Navigate to the directory with the cloned code
- Install Harhdat with `npm install --save-dev hardhat`
- Install all required dependencies with `npm install`
- Create a file called `.env` in the root of the project with the same contents as `.env.example`
- Copy your wallet's private key (see [Wallets](#wallets)) to `.env` file
  ```
  ACC_PRIVATE_KEY=***your private key***
  ```
- Input a gas price multiplier (see [Bot Logic](#logic)) to the `.env` file

  ```
  GAS_MULTIPLIER=***gas price multiplier***
  ```

  :warning:**DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS**:warning:

#### Run

```
npx hardhat run app/main.js --network <network_name>
```

#### Networks

а) **Ultron test** network  
Make sure you have _enough test tokens_ for testnet.
```
npx hardhat run app/main.js --network ultronTestnet
```

a) **Ultron main** main network  
Make sure you have _enough real tokens_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run app/main.js --network ultronMainnet
```

<a name="tests"/>

### Test the Bot
#### Integrational Test
One of the ways of testing is running both the `app/main.js` and `scripts/events.js` on the same network. The `events.js` script (as you can probably tell from the name of it) triggers the events that the `main.js` app should listen to inside the pool of USDT/USDC. The best way to run them together is:

- Run _forked_ Ultron Mainnet node locally:
```
npx hardhat node --network hardhat
```

- Run `main.js` app:
```
npx hardhat run app/main.js --network localhost
```

- Run `events.js` script:
```
npx hardhat run scripts/events.js --network localhost
```

After that you should see the bot reacting to events in the pool and making a swap from USDC to USDT.

#### Unit Tests
Unit tests should be executed on the local running node of forked Ultron mainnet.
- Run _forked_ Ultron Mainnet node locally:
```
npx hardhat node --network hardhat
```
- Run tests
```
npx hardhat test --network localhost
```

**Note №1** In order for unit tests to run correctly you have to **restart the node** before running tests again.
**Note №2** Current file of unit tests contains a *copy* of all functions from the main file of the bot, it *does not* import functions from that file. So if you make any changes inside the `main.js` file, then you should make the same changes inside the `unitTests.js` file to *keep tests up-to-date*

<a name="wallets"/>

### Wallets

For deployment you will need to use either _your existing wallet_ or _a generated one_.

#### Using an existing wallet

If you choose to use your existing wallet, then you will need to be able to export (copy/paste) its private key. For example, you can export private key from your MetaMask wallet.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#preqs)).

#### Creating a new wallet

If you choose to create a fresh wallet for this project, you should use `createWallet` script from `scripts/` directory.

```
node scripts/createWallet.js
```

This will generate a single new wallet and show its address and private key. **Save** them somewhere else!  
A new wallet _does not_ hold any tokens. You have to provide it with tokens of your choice.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#preqs)).

<a name="logic"/>

### Bot Logic

#### Terms

- `Gas price multiplier` - how many times to increase the default gas price
  - The higher the multiplier, the higher the gas price of the transaction, the faster the transaction gets mined and included into the block
  - Multiplier _should_ be a positive integer
  - If no value is provided, the default value of `2` is used

#### Logic Flow

**Scenario №1 (Normal):**

- Users initial balances:
  - USDC: 100
  - USDT: 0
- Bot hears the "**Swap**" event in the pool. That means that someone has swapped some tokens in the pool, changing tokens prices
- Bot compares USDC and USDT prices
  - **USDC** turns out to have a higher price
- Bot calculates maximum USDC amount X1 that has price impact no more than 0.05%
- Bot checks if swapping X1 USDC is profitable (we receive **Y1>X1** amount of USDT tokens)
- Bot swaps X1 USDC for Y1 USDT
- User's balances:
  - USDC: 100 - X1
  - USDT: Y1
- Bot hears the "**Swap**" event in the pool once again.
- Bot compares USDC and USDT prices
  - USDC turns out to have a higher price
- Bot **repeats** operation above and swaps X2 USDX tokens for Y2 USDT, where **Y2>X2**
- User's balances:
  - USDC: 100 - X1 - X2
  - USDT: Y1 + Y2
- Bot hears the "**Swap**" event in the pool once again.
- Bot compares USDC and USDT prices
  - **USDT** turns out to have a higher price
- Bot calculates maximum USDT amount Y3 that has price impact no more than 0.05%
- Bot checks if swapping Y3 USDT is profitable (we receive **X3>Y3** amount of USDC tokens)
- Bot swaps Y3 USDT for X3 USDC
- User's balances:
  - USDC: 100 - X1 - X2 + X3
  - USDT: Y1 + Y2 - Y3

and so on...

**Scenario №2 (User doesn't have enought tokens to swap optimal amount):**

- User's initial balances:
  - USDC: 100
  - USDT: 0
- Bot hears the "**Swap**" event in the pool. That means that someone has swapped some tokens in the pool, changing tokens prices
- Bot compares USDC and USDT prices
  - **USDC** turns out to have a higher price
- Bot calculates maximum USDC amount X1 that has price impact no more than 0.05%
- Bot detects that the user **did not have** X1 amount to swap
  - In that case bot uses _the whole user's balance_  X2 = 100 as the swap amount.
- Bot checks if swapping X2 USDC is profitable (we receive **Y1>X2** amount of USDT tokens)
- Bot swaps X2 USDC for Y1 USDT
- User's balances:
  - USDC: 0
  - USDT: Y1
- After that we wait unitl USDT > USDC
---

In all above examples "**Swap**" event could be replaced with "**Mint**" or "**Burn**" events. The all token's price inside the pool.

All logs produced by the bot are saved into `log.txt` file. File gets rewritten each time the bot start working.  


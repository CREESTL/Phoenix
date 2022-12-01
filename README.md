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
- Input a swap threshold (see [Bot Logic](#logic)) to the `.env` file
  ```
  SWAP_THRESHOLD=***swap threshold***
  ```
- Input a swap amount (see [Bot Logic](#logic)) to the `.env` file
  ```
  AMOUNT=***amount***
  ```
- Input a maximum price change (in %) (see [Bot Logic](#logic)) to the `.env` file
  ```
  MAX_PRICE_CHANGE=***maximum price change***
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

- `Swap threshold` - the ratio of tokens' prices enough to initialize the swap. (e.g. set swap threshold to `1.5` if you want the swap to happen when USDC is 1.5 times more expensive than USDT of vice versa)
  - If no value is provided, the default value of `1.5` is used
- `Swap amount` - the amount of tokens (USDT or USDC depending on the tokens' prices ratio) to swap
  - If swap amount is 0 then _all user's tokens will be swapped_. So between the swaps a user will have his whole balance consisting of either USDT or USDC (**only** if user's balance is less than the _optimal amount_)
  - If swap amount is _not_ 0 then exactly the provided amount of tokens will be swapped
  - Swap amount _can not_ be a negative integer
- `Max price change` - how much can a price of deposited token change after the deposit (_in percents_)
  - If the expected price of the token changes for more than [max price change %], the swap would be cancelled
  - Max price change _should_ be a positive integer
  - If no value is provided, the default value of `1%` is used
- `Gas price multiplier` - how many times to increase the default gas price
  - The higher the multiplier, the higher the gas price of the transaction, the faster the transaction gets mined and included into the block
  - Multiplier _should_ be a positive integer
  - If no value is provided, the default value of `2` is used

#### Logic Flow

**Scenario №1 (Normal):**

- Swap threshold = 1.5; Swap amount = **4**; Max price change = 0.1
- Users initial balances:
  - USDC: 100
  - USDT: 0
- Bot hears the "**Mint**" event in the pool. That means that someone has provided liquidity into the pool, changing tokens' prices
- Bot compares USDC and USDT prices
  - **USDC** turns out to have a higher price
- Bot checks that USDC price is at least 1.5 \* USDT price
  - The result is positive. Price difference is not 1.5 but even 2
- Bot checks if swapping 4 USDC to 4 \* 2 = 8 USDT will change USDC price for more than 0.1%
  - The result is negative (price will not change that much)
- Bot swaps **4** USDC for 8 USDT
- User's balances:
  - USDC: 96
  - USDT: 8
- Bot hears the "**Mint**" event in the pool once again.
- Bot compares USDC and USDT prices
  - USDC turns out to have a higher price
- Bot **does not** swap USDC to USDT because now it _only makes sence to swap back: USDT to USDC_
- User's balances:
  - USDC: 96
  - USDT: 8
- Bot hears the "**Mint**" event in the pool once again.
- Bot compares USDC and USDT prices
  - **USDT** turns out to have a higher price
- Bot checks that USDT price is at least 1.5 \* USDC price
  - The result is positive. Price difference is not 1.5 but even 2
- Bot checks if swapping 4 USDT to 4 \* 2 = 8 USDC will change USDT price for more than 0.1%
  - The result is negative (price will not change that much)
- Bot swaps **4** USDT for 8 USDC
- User's balances:
  - USDC: 106
  - USDT: 4

and so on...

**Scenario №2 (No amount provided):**

- Swap threshold = 1.5; Swap amount = **0**; Max price change = 0.1
- User's initial balances:
  - USDC: 100
  - USDT: 0
- Bot hears the "**Mint**" event in the pool. That means that someone has provided liquidity into the pool, changing tokens' prices
- Bot compares USDC and USDT prices
  - **USDC** turns out to have a higher price
- Bot checks that USDC price is at least 1.5 \* USDT price
  - The result is positive. Price difference is not 1.5 but even 2
- Bot detects that the user **did not provide** any amount to swap
  - In that case bot uses _the whole user's balance_ as the swap amount.
- Bot checks if swapping **100** USDC to 100 \* 2 = 200 USDT will change USDC price for more than 0.1%
  - The result is positive (price **will** change that much)
- That means that the swap using 100 USDC gets cancelled
- Bot now **calculates the maximum amount** of USDC that after being deposited into the pool will not change USDC price for more than 0.1%
  - This amount is 26
  - This is a "greedy" algorithm
- Bot swaps **26** USDC for 26 \* 2 = 52 USDT
- User's balances:
  - USDC: 74
  - USDT: 52
- Bot hears the "**Mint**" event in the pool once again.
- Bot compares USDC and USDT prices
  - **USDC** turns out to have a higher price
- Bot **does not** swap USDC to USDT because now it _only makes sence to swap back: USDT to USDC_
- User's balances:
  - USDC: 74
  - USDT: 52
- Bot hears the "**Mint**" event in the pool once again
- Bot compares USDC and USDT prices
  - **USDT** turns out to have a higher price
- Bot checks that USDT price is at least 1.5 \* USDC price
  - The result is positive. Price difference is not 1.5 but even 2
- Bot detects that the user **did not provide** any amount to swap
  - In that case bot uses _the whole user's balance_ as the swap amount.
- Bot checks if swapping 52 USDT to 54 \* 2 = 108 USDC will change USDT price for more than 0.1%
  - The result is positive (price **will** change that much)
- That means that the swap using 54 USDT gets cancelled
- Bot now **calculates the maximum amount** of USDT that after being deposited into the pool will not change price for more than 0.1%
  - This amount is 14
- Bot swaps **14** USDT for 14 \* 2 = 28 USDC
- User's balances:
  - USDC: 102
  - USDT: 38

and so on...

---

In the Scenario №1 if the amount to swap was much higher (e.g. 5 000 000), that would mean that each swap would have been cancelled because swapping such a high amount of USDC would have changed USDC price dramatically. In that case **no optimal amount** gets calculated by the bot in that case. The user is suggested to either provide a lower amount, or to not provide any amount at all. The **optimal amount** gets calculated **only** if the user did not provide the amount himself.

In the Scenario №2 if after checking USDC price change after the deposit the result was negative (the price will not change that much) the bot would have used a whole user's balance for the swap and the following steps would have been the same as in the Scenario №1. No optimal amount of tokens would have been calculated.

In all above examples "**Mint**" event could be replaced with "**Swap**" or "**Burn**" events. The all token's price inside the pool.

In all above examples if the price difference of tokens was less than 1.5, the swap would have been cancelled.

All logs produced by the bot are saved into `log.txt` file. File gets rewritten each time the bot start working.  


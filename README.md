## Phoenix Bot

Phoenix is a bot for automated swaps in USDT/USDC pool on Ultron Network

#### Table on contents

[Run the Bot](#run)  
[Wallets](#wallets)  
[Bot Logic](#logic)
[Scripts](#scripts)

<a name="run"/>

### Run the Bot

#### Prerequisites

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
:warning:**DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS**:warning:
  
#### Run 

```
npx hardhat run app/main.js --network <network_name>
```
#### Networks

а) **Ultron test** network  
Make sure you have _enough test tokens_ for testnet. You can get it for free from [faucet](https://faucet.polygon.technology/).

```
npx hardhat run app/main.js --network ultronTestnet
```
a) **Ultron main** main network  
Make sure you have _enough real tokens_ in your wallet. Deployment to the mainnet costs money!

```
npx hardhat run app/main.js --network ultronMainnet
```


<a name="wallets"/>

### Wallets

For deployment you will need to use either _your existing wallet_ or _a generated one_.

#### Using existing wallet

If you choose to use your existing wallet, then you will need to be able to export (copy/paste) its private key. For example, you can export private key from your MetaMask wallet.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#prerequisites)).

#### Creating a new wallet

If you choose to create a fresh wallet for this project, you should use `createWallet` script from `scripts/` directory.

```
npx hardhat run scripts/createWallet.js
```

This will generate a single new wallet and show its address and private key. **Save** them somewhere else!  
A new wallet _does not_ hold any tokens. You have to provide it with tokens of your choice.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#prerequisites)).

<a name="logic"/>

### Bot Logic
#### Terms
- `Swap threshold` - the ratio of tokens' prices enough to initialize the swap. (e.g. set `swap threshold` to `1.5` if you want the swap to happen when USDC is 1.5 times more expensive than USDT of vice versa)
- `Swap amount` - the amount of tokens (USDT or USDC depending on the tokens' prices ratio) to swap
    - If `swap amount` is `0` then *all user's tokens will be swapped*. So between the swaps a user will have his whole balance consisting of either USDT or USDC
  - If `swap amount` is *not* `0` then exactly the provided amount of tokens will be swapped
  - `swap amount` *can not* be a negative integer
- `Max price change` - how much can a price of deposited token change after the deposit (*in percents*)
    - If the expected price of the token changes for more than `max price change` %, the swap would be cancelled

#### Logic Flow

<a name="scripts"/>

### Scripts

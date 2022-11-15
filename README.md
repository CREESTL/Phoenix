## Phoenix Bot

Phoenix is a bot for automated swaps in USDT/USDC pool on Ultron Network

#### Table on contents

[Run the Bot](#run)  
[Wallets](#wallets)  
[Bot Logic](#logic)

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
  :warning:**DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS**:warning:

#### 1. Run 

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
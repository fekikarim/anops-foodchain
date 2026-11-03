# 🌿 AnOps FoodChain

> Blockchain-powered food supply chain traceability platform.  
> ERC-721 digital batch passports + ERC-20 reward token, built with Truffle, Solidity, React, Vite, and ethers.js.

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.19-363636?logo=solidity)](https://soliditylang.org/)
[![Truffle](https://img.shields.io/badge/Truffle-5.11.5-blue?logo=truffle)](https://trufflesuite.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![ethers.js](https://img.shields.io/badge/ethers.js-5.7.2-333333?logo=ethers)](https://docs.ethers.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📖 Overview

**AnOps FoodChain** is a decentralized application (DApp) that brings end-to-end traceability to food supply chains. Every food batch is minted as a unique ERC-721 NFT ("digital passport") that travels through the supply chain — from farmer to transporter, wholesaler, and retailer. Actors earn ERC-20 **FoodChainToken (FCT)** rewards for completing validated supply-chain actions.

### Core Features

| Feature | Description |
|---------|-------------|
| **📦 Batch Registration** | Farmers register food batches; each batch is minted as an ERC-721 NFT with a unique batch code. |
| **🚚 Lifecycle Tracking** | Track batches through `Created → In Transit → Received → Delivered` with immutable on-chain history. |
| **👥 Role-Based Access** | Six roles (`None`, `Farmer`, `Transporter`, `Wholesaler`, `Retailer`, `Admin`) enforce who can perform each action. |
| **🪙 Reward Token (FCT)** | ERC-20 token rewards actors for `REGISTER`, `SHIP`, `RECEIVE`, and `DELIVER` actions (anti-double-reward protection). |
| **🚨 Flag & Recall** | Admin can flag suspicious batches or issue recalls (terminal states). |
| **🔗 MetaMask Integration** | Connect any Ethereum-compatible wallet (configured for Ganache Local, Chain ID 1337). |
| **📊 Dashboard** | Real-time stats, batch counts by status, recent registrations, and reward history. |

---

## 🏗️ Architecture

```
anops-foodchain/
├── contracts/                 # Solidity smart contracts
│   ├── FoodChainToken.sol     # ERC-20 reward token (FCT)
│   └── FoodBatchNFT.sol       # ERC-721 batch passport NFT (FBP)
├── migrations/                # Truffle deployment scripts
│   ├── 1_deploy_food_chain_token.js
│   └── 2_deploy_food_batch_nft.js
├── test/                      # Truffle test suites
│   ├── FoodBatchNFT.test.js
│   ├── FoodChainIntegration.test.js
│   └── FoodChainToken.test.js
├── build/                     # Compiled contract artifacts (gitignored)
├── frontend/                  # React + Vite DApp
│   ├── src/
│   │   ├── App.jsx            # App shell + navigation + wallet connector
│   │   ├── main.jsx           # React entry point
│   │   ├── index.css          # Global styles
│   │   ├── App.css            # App-specific styles
│   │   ├── blockchain/        # ethers.js provider, contract ABIs, addresses
│   │   │   ├── provider.js    # MetaMask connection + network checks
│   │   │   └── contracts.js   # Contract addresses, ABIs, role/status helpers
│   │   ├── hooks/             # React hooks
│   │   │   └── useContracts.js# Wallet connection + contract state
│   │   ├── pages/             # Route pages
│   │   │   ├── Dashboard.jsx  # Stats + recent events
│   │   │   ├── Batches.jsx    # Batch lifecycle actions
│   │   │   ├── Actors.jsx     # Role lookup & assignment
│   │   │   └── Rewards.jsx    # FCT balance + reward history
│   │   └── assets/            # Static assets (hero.png, icons)
│   ├── vite.config.js         # Vite configuration
│   ├── eslint.config.js       # ESLint flat config
│   ├── index.html             # HTML entry
│   └── package.json           # Frontend dependencies
├── truffle-config.js          # Truffle + Solidity compiler config
├── package.json               # Root dependencies (Truffle, OpenZeppelin, etc.)
├── package-lock.json          # Lockfile (gitignored)
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

### Smart Contracts

#### `FoodChainToken` (FCT) — ERC-20 Reward Token
- **Standard:** ERC-20 + Ownable + Pausable (OpenZeppelin v4)
- **Initial supply:** 1,000,000 FCT (18 decimals), minted to deployer
- **Authorized callers:** Only the owner or whitelisted callers (e.g., the NFT contract) can issue rewards
- **Anti-double-reward:** Each `operationId` can be rewarded only once
- **Reward amounts per action:**
  - `REGISTER_BATCH` — 10 FCT
  - `SHIP_BATCH` — 3 FCT
  - `RECEIVE_BATCH` — 5 FCT
  - `DELIVER_BATCH` — 5 FCT
- **Admin functions:** `setRewardAmount`, `setAuthorizedCaller`, `pause` / `unpause`

#### `FoodBatchNFT` (FBP) — ERC-721 Batch Passport
- **Standard:** ERC-721 + Ownable + Counters (OpenZeppelin v4)
- **Each NFT = one food batch** with on-chain `BatchInfo` (product, producer, origin, harvest date, quantity, status, holder, etc.)
- **Batch statuses:** `Created`, `In Transit`, `Received`, `Delivered`, `Flagged`, `Recalled`, `Cancelled`
- **Actor roles:** `None`, `Farmer`, `Transporter`, `Wholesaler`, `Retailer`, `Admin`
- **Key functions:**
  - `registerBatch(...)` — Farmer mints a new batch NFT (+ reward)
  - `shipBatch(tokenId, recipient, details)` — Current holder ships the batch
  - `confirmReceipt(tokenId)` — Expected recipient confirms receipt (Retailer → `Delivered`)
  - `flagBatch(tokenId, reasonCode)` / `recallBatch(tokenId)` — Admin actions (terminal)
  - `setActorRole(actor, role)` — Admin assigns roles

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Ganache](https://trufflesuite.com/ganache/) (local blockchain, Chain ID 1337)
- [MetaMask](https://metamask.io/) browser extension

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-username/anops-foodchain.git
cd anops-foodchain

# Install root dependencies (Truffle, OpenZeppelin, etc.)
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Truffle

Edit `truffle-config.js` if your Ganache runs on a different port/network:

```js
development: {
  host: "127.0.0.1",
  port: 7545,        // Ganache default
  network_id: "*",
}
```

### 3. Start Ganache

Launch Ganache Desktop (or CLI) and ensure it's listening on `127.0.0.1:7545` with **Chain ID 1337**.

### 4. Compile & Deploy Contracts

```bash
# Compile Solidity contracts
npx truffle compile

# Deploy to Ganache
npx truffle migrate --network development
```

> 💡 Copy the deployed contract addresses from the migration output and paste them into `frontend/src/blockchain/contracts.js` (`ADDRESSES` object).

### 5. Run the Frontend

```bash
cd frontend
npm run dev        # starts Vite dev server (usually http://localhost:5173)
```

### 6. Connect MetaMask

1. Open the DApp in your browser.
2. Click **Connect Wallet**.
3. Switch MetaMask to **Ganache Local (Chain ID 1337)**.
4. Import a Ganache account (private key) to interact as an actor.

---

## 🧪 Testing

Run the Truffle test suite:

```bash
# From project root
npx truffle test
```

Test files:
- `test/FoodChainToken.test.js` — FCT rewards, authorization, pausing
- `test/FoodBatchNFT.test.js` — NFT minting, batch lifecycle, roles
- `test/FoodChainIntegration.test.js` — End-to-end FCT ↔ FBP interaction

---

## 📱 Frontend Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | Total batches, status breakdown, your FCT balance, recent registrations |
| **Batches** | Register, ship, receive, and deliver batches; view batch details & history |
| **Actors** | Look up actor roles; assign roles (Admin only) |
| **Rewards** | View your FCT balance and reward transaction history |

---

## 🔐 Security Considerations

- **Private keys / `.env` files** are gitignored — never commit them.
- Contract addresses in `frontend/src/blockchain/contracts.js` must be updated after every migration.
- The NFT contract is the only authorized caller of `FCT.rewardActor` (set in migration 2).
- Admin-only functions are protected by `onlyAdmin` / `onlyOwner` modifiers.
- `pause()` / `unpause()` can halt reward issuance in an emergency.

---

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request.

Please follow existing code style and run `npm run lint` in the frontend before submitting.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 👥 Authors

| Avatar | Name | Role | Links |
| :---: | :--- | :--- | :--- |
| <img src="https://github.com/fekikarim.png" width="40" height="40" style="border-radius:50%"> | **Karim Feki** | Smart Contract Developer — FoodChainToken (FCT) & Architecture | [GitHub](https://github.com/fekikarim) • [LinkedIn](https://www.linkedin.com/in/karimfeki) • [Portfolio](https://karimfeki.is-a.dev) |
| <img src="https://github.com/nesrine-derouiche.png" width="40" height="40" style="border-radius:50%"> | **Nesrine Derouiche** | Smart Contract Developer — FoodBatchNFT (FBP) | [GitHub](https://github.com/nesrine-derouiche) • [LinkedIn](https://linkedin.com/in/nesrine-derouiche) • [Portfolio](https://nesrine-derouiche.is-a.dev) |

---

> Built with ❤️ for transparent, tamper-proof food supply chains.

# VillageFi Lending Pool 🏦

A decentralized microfinance lending platform built on the Stacks blockchain, empowering entrepreneurs in underserved communities through community-based reputation scoring and peer-to-peer lending.

## 🌟 Overview

VillageFi creates a trustless lending ecosystem where community members can contribute to a shared lending pool and vote on borrower reputations. Entrepreneurs can access small loans based on their community standing, with interest rates dynamically adjusted according to their reputation scores.

## ✨ Key Features

### 🤝 Community-Based Reputation System
- **Peer Voting**: Community members vote on borrower trustworthiness
- **Dynamic Scoring**: Reputation scores range from 0-100, starting at 50
- **Behavioral Incentives**: Successful repayments increase reputation, defaults decrease it
- **Anti-Gaming**: Users cannot vote on their own reputation

### 💰 Flexible Lending Pool
- **Community Funding**: Anyone can contribute STX to the lending pool
- **Transparent Management**: All pool operations are on-chain and auditable
- **Interest Distribution**: Contributors earn returns from loan interest payments

### 📊 Risk-Based Pricing
- **High Reputation (80+)**: 5% interest rate
- **Medium Reputation (60-79)**: 8% interest rate  
- **Low Reputation (<60)**: 12% interest rate

### 🔒 Smart Risk Management
- **Minimum Reputation**: Borrowers need ≥50 reputation score (configurable)
- **Single Active Loan**: One loan per borrower at a time
- **Automatic Default Detection**: Community can mark overdue loans as defaulted
- **Reputation Penalties**: Defaults result in -20 reputation points

## 🏗️ Architecture

### Smart Contract Components

#### Data Storage
- **Loans**: Loan details, amounts, interest rates, due dates
- **Reputation**: Borrower scores, loan history, voting records
- **Pool Management**: Contributor balances, total pool funds
- **Voting System**: Community reputation votes with anti-spam protection

#### Core Functions
- `contribute-to-pool`: Add funds to the lending pool
- `vote-reputation`: Vote on borrower trustworthiness
- `request-loan`: Apply for a loan (subject to reputation requirements)
- `repay-loan`: Repay loan with interest
- `mark-default`: Mark overdue loans as defaulted

## 🚀 Getting Started

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) installed
- [Node.js](https://nodejs.org/) v16+ for testing
- [Stacks Wallet](https://wallet.hiro.so/) for interactions

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/villagefi-lending-pool
   cd villagefi-lending-pool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Check contract syntax**
   ```bash
   clarinet check
   ```

4. **Run tests**
   ```bash
   clarinet test
   ```

### Deployment

1. **Deploy to testnet**
   ```bash
   clarinet deploy --testnet
   ```

2. **Deploy to mainnet**
   ```bash
   clarinet deploy --mainnet
   ```

## 🎮 Usage Examples

### Contributing to the Pool

```clarity
;; Contribute 5 STX to the lending pool
(contract-call? .villagefi-lending-pool contribute-to-pool u5000000)
```

### Voting on Reputation

```clarity
;; Vote positively on a borrower's reputation
(contract-call? .villagefi-lending-pool vote-reputation 'SP1234...BORROWER "positive")

;; Vote negatively on a borrower's reputation  
(contract-call? .villagefi-lending-pool vote-reputation 'SP1234...BORROWER "negative")
```

### Requesting a Loan

```clarity
;; Request a 2 STX loan
(contract-call? .villagefi-lending-pool request-loan u2000000)
```

### Repaying a Loan

```clarity
;; Repay loan ID 1 (includes principal + interest)
(contract-call? .villagefi-lending-pool repay-loan u1)
```

## 📋 Testing

The project includes comprehensive unit tests covering:

- ✅ Initial contract state
- ✅ Pool contribution mechanics
- ✅ Reputation voting system
- ✅ Loan request and approval process
- ✅ Repayment and interest calculations
- ✅ Default handling and penalties
- ✅ Administrative functions

Run tests with:
```bash
npm test
```

## 🔧 Configuration

### Admin Settings (Contract Owner Only)

| Setting | Default | Description |
|---------|---------|-------------|
| `min-reputation-score` | 50 | Minimum reputation required for loans |
| `max-loan-amount` | 10 STX | Maximum loan amount per request |
| `loan-duration` | ~1 month | Loan repayment period in blocks |

### Interest Rate Tiers

| Reputation Range | Interest Rate | Risk Level |
|------------------|---------------|------------|
| 80-100 | 5% | Low Risk |
| 60-79 | 8% | Medium Risk |
| 0-59 | 12% | High Risk |

## 🛡️ Security Features

- **Authorization Checks**: Function-level access controls
- **Input Validation**: Amount and parameter validation
- **Overflow Protection**: Safe arithmetic operations
- **Anti-Spam**: Voting limitations and cooldowns
- **Emergency Controls**: Owner can withdraw funds if needed

## 🌍 Use Cases

### For Entrepreneurs
- **Access to Capital**: Get loans without traditional banking requirements
- **Reputation Building**: Build credit history through successful repayments
- **Community Support**: Leverage local network for trust verification

### For Community Members
- **Social Impact**: Support local entrepreneurs and economic development
- **Financial Returns**: Earn interest on contributed funds
- **Governance Participation**: Vote on borrower trustworthiness

### For Communities
- **Economic Development**: Facilitate local business growth
- **Financial Inclusion**: Provide banking services to underserved populations
- **Trust Networks**: Strengthen community bonds through mutual support

## 🔮 Future Enhancements

- **Collateral Support**: Accept NFTs or other tokens as collateral
- **Automated Repayments**: Schedule automatic loan payments
- **Multi-Token Support**: Support for other Stacks tokens beyond STX
- **Insurance Pool**: Community-funded insurance for defaults
- **Mobile Integration**: React Native app for easier access
- **Governance Token**: Decentralized governance for protocol changes

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.villagefi.org](https://docs.villagefi.org)
- **Discord**: [VillageFi Community](https://discord.gg/villagefi)
- **Twitter**: [@VillageFi](https://twitter.com/villagefi)
- **Issues**: [GitHub Issues](https://github.com/your-org/villagefi-lending-pool/issues)

## 🎯 Roadmap

- **Q1 2025**: Testnet deployment and community testing
- **Q2 2025**: Mainnet launch with basic lending features
- **Q3 2025**: Mobile app and improved UI/UX
- **Q4 2025**: Advanced features (collateral, insurance, governance)

---

**Built with ❤️ for financial inclusion and community empowerment**

*VillageFi - Democratizing access to capital through blockchain technology*
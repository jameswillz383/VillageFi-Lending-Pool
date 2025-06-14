import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const user1 = accounts.get("wallet_1")!;
const user2 = accounts.get("wallet_2")!;
const user3 = accounts.get("wallet_3")!;

const contractName = "villagefi-lending-pool";

describe("Microfinance Lending Pool", () => {
  describe("Initial State", () => {
    it("should have zero pool balance initially", () => {
      const response = simnet.callReadOnlyFn(
        contractName,
        "get-pool-balance",
        [],
        deployer
      );
      expect(response.result).toBeUint(0);
    });

    it("should return default reputation for new borrowers", () => {
      const response = simnet.callReadOnlyFn(
        contractName,
        "get-borrower-reputation",
        [user1],
        deployer
      );
      expect(response.result).toBeTuple({
        score: 50,
        "total-loans": 0,
        "repaid-loans": 0,
        "default-loans": 0,
        "last-updated": 0
      });
    });

    it("should calculate correct interest rates based on reputation", () => {
      // High reputation (80+) -> 5%
      const highRepRate = simnet.callReadOnlyFn(
        contractName,
        "calculate-interest-rate",
        [80],
        deployer
      );
      expect(highRepRate.result).toBeUint(5);

      // Medium reputation (60-79) -> 8%
      const mediumRepRate = simnet.callReadOnlyFn(
        contractName,
        "calculate-interest-rate",
        [65],
        deployer
      );
      expect(mediumRepRate.result).toBeUint(8);

      // Low reputation (<60) -> 12%
      const lowRepRate = simnet.callReadOnlyFn(
        contractName,
        "calculate-interest-rate",
        [40],
        deployer
      );
      expect(lowRepRate.result).toBeUint(12);
    });
  });

  describe("Pool Contribution", () => {
    it("should allow users to contribute to the pool", () => {
      const contributionAmount = 1000000; // 1 STX in microSTX
      
      const response = simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [contributionAmount],
        user1
      );
      
      expect(response.result).toBeOk(contributionAmount);
      
      // Check pool balance updated
      const poolBalance = simnet.callReadOnlyFn(
        contractName,
        "get-pool-balance",
        [],
        deployer
      );
      expect(poolBalance.result).toBeUint(contributionAmount);
    });

    it("should track contributor information", () => {
      const contributionAmount = 500000; // 0.5 STX
      
      simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [contributionAmount],
        user2
      );
      
      const contributorInfo = simnet.callReadOnlyFn(
        contractName,
        "get-contributor-info",
        [user2],
        deployer
      );
      
      expect(contributorInfo.result).toBeSome({
        "amount-contributed": contributionAmount,
        "rewards-earned": 0,
        "join-date": expect.any(Number)
      });
    });

    it("should reject zero amount contributions", () => {
      const response = simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [0],
        user1
      );
      
      expect(response.result).toBeErr(104); // ERR_INVALID_AMOUNT
    });
  });

  describe("Reputation Voting", () => {
    it("should allow positive reputation votes", () => {
      const response = simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user2, "positive"],
        user1
      );
      
      expect(response.result).toBeOk(true);
      
      // Check reputation increased
      const reputation = simnet.callReadOnlyFn(
        contractName,
        "get-borrower-reputation",
        [user2],
        deployer
      );
      expect(reputation.result).toBeTuple({
        score: 55, // 50 + 5
        "total-loans": 0,
        "repaid-loans": 0,
        "default-loans": 0,
        "last-updated": expect.any(Number)
      });
    });

    it("should allow negative reputation votes", () => {
      const response = simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user3, "negative"],
        user1
      );
      
      expect(response.result).toBeOk(true);
      
      // Check reputation decreased
      const reputation = simnet.callReadOnlyFn(
        contractName,
        "get-borrower-reputation",
        [user3],
        deployer
      );
      expect(reputation.result).toBeTuple({
        score: 47, // 50 - 3
        "total-loans": 0,
        "repaid-loans": 0,
        "default-loans": 0,
        "last-updated": expect.any(Number)
      });
    });

    it("should prevent self-voting", () => {
      const response = simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user1, "positive"],
        user1
      );
      
      expect(response.result).toBeErr(108); // ERR_CANNOT_VOTE_SELF
    });

    it("should prevent duplicate votes", () => {
      // First vote should succeed
      simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user2, "positive"],
        user3
      );
      
      // Second vote should fail
      const response = simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user2, "negative"],
        user3
      );
      
      expect(response.result).toBeErr(107); // ERR_ALREADY_VOTED
    });
  });

  describe("Loan Requests", () => {
    beforeEach(() => {
      // Add funds to pool
      simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [10000000], // 10 STX
        deployer
      );
    });

    it("should allow loan requests with sufficient reputation", () => {
      const loanAmount = 1000000; // 1 STX
      
      const response = simnet.callPublicFn(
        contractName,
        "request-loan",
        [loanAmount],
        user1
      );
      
      expect(response.result).toBeOk(1); // First loan ID
      
      // Check loan was created
      const loan = simnet.callReadOnlyFn(
        contractName,
        "get-loan",
        [1],
        deployer
      );
      
      expect(loan.result).toBeSome({
        borrower: user1,
        amount: loanAmount,
        "interest-rate": 12, // Default reputation gets 12%
        "due-date": expect.any(Number),
        repaid: false,
        "created-at": expect.any(Number)
      });
    });

    it("should reject loans with insufficient reputation", () => {
      // Lower user's reputation below minimum
      simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user2, "negative"],
        user1
      );
      simnet.callPublicFn(
        contractName,
        "vote-reputation",
        [user2, "negative"],
        user3
      );
      
      const response = simnet.callPublicFn(
        contractName,
        "request-loan",
        [1000000],
        user2
      );
      
      expect(response.result).toBeErr(106); // ERR_INSUFFICIENT_REPUTATION
    });

    it("should reject loans exceeding pool balance", () => {
      const response = simnet.callPublicFn(
        contractName,
        "request-loan",
        [20000000], // 20 STX (more than pool)
        user1
      );
      
      expect(response.result).toBeErr(101); // ERR_INSUFFICIENT_FUNDS
    });

    it("should reject multiple active loans per borrower", () => {
      // First loan
      simnet.callPublicFn(
        contractName,
        "request-loan",
        [1000000],
        user1
      );
      
      // Second loan should fail
      const response = simnet.callPublicFn(
        contractName,
        "request-loan",
        [500000],
        user1
      );
      
      expect(response.result).toBeErr(103); // ERR_LOAN_ALREADY_EXISTS
    });
  });

  describe("Loan Repayment", () => {
    beforeEach(() => {
      // Setup: Add funds and create a loan
      simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [10000000], // 10 STX
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "request-loan",
        [1000000], // 1 STX
        user1
      );
    });

    it("should allow loan repayment by borrower", () => {
      const response = simnet.callPublicFn(
        contractName,
        "repay-loan",
        [1],
        user1
      );
      
      expect(response.result).toBeOk(1120000); // 1 STX + 12% interest
      
      // Check loan marked as repaid
      const loan = simnet.callReadOnlyFn(
        contractName,
        "get-loan",
        [1],
        deployer
      );
      
      expect(loan.result).toBeSome({
        borrower: user1,
        amount: 1000000,
        "interest-rate": 12,
        "due-date": expect.any(Number),
        repaid: true,
        "created-at": expect.any(Number)
      });
    });

    it("should increase borrower reputation on successful repayment", () => {
      simnet.callPublicFn(
        contractName,
        "repay-loan",
        [1],
        user1
      );
      
      const reputation = simnet.callReadOnlyFn(
        contractName,
        "get-borrower-reputation",
        [user1],
        deployer
      );
      
      expect(reputation.result).toBeTuple({
        score: 60, // 50 + 10 for repayment
        "total-loans": 1,
        "repaid-loans": 1,
        "default-loans": 0,
        "last-updated": expect.any(Number)
      });
    });

    it("should reject repayment by non-borrower", () => {
      const response = simnet.callPublicFn(
        contractName,
        "repay-loan",
        [1],
        user2
      );
      
      expect(response.result).toBeErr(100); // ERR_UNAUTHORIZED
    });

    it("should reject repayment of non-existent loan", () => {
      const response = simnet.callPublicFn(
        contractName,
        "repay-loan",
        [999],
        user1
      );
      
      expect(response.result).toBeErr(102); // ERR_LOAN_NOT_FOUND
    });
  });

  describe("Default Handling", () => {
    beforeEach(() => {
      // Setup: Add funds and create a loan
      simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [10000000],
        deployer
      );
      
      simnet.callPublicFn(
        contractName,
        "request-loan",
        [1000000],
        user1
      );
      
      // Advance blocks to make loan overdue
      simnet.mineEmptyBlocks(2628001); // Beyond loan duration
    });

    it("should allow marking overdue loans as default", () => {
      const response = simnet.callPublicFn(
        contractName,
        "mark-default",
        [1],
        user2 // Any user can mark default
      );
      
      expect(response.result).toBeOk(true);
      
      // Check reputation decreased
      const reputation = simnet.callReadOnlyFn(
        contractName,
        "get-borrower-reputation",
        [user1],
        deployer
      );
      
      expect(reputation.result).toBeTuple({
        score: 30, // 50 - 20 for default
        "total-loans": 1,
        "repaid-loans": 0,
        "default-loans": 1,
        "last-updated": expect.any(Number)
      });
    });

    it("should correctly identify overdue loans", () => {
      const response = simnet.callReadOnlyFn(
        contractName,
        "is-loan-overdue",
        [1],
        deployer
      );
      
      expect(response.result).toBeBool(true);
    });
  });

  describe("Admin Functions", () => {
    it("should allow owner to set minimum reputation", () => {
      const response = simnet.callPublicFn(
        contractName,
        "set-min-reputation",
        [60],
        deployer
      );
      
      expect(response.result).toBeOk(true);
    });

    it("should reject non-owner setting minimum reputation", () => {
      const response = simnet.callPublicFn(
        contractName,
        "set-min-reputation",
        [60],
        user1
      );
      
      expect(response.result).toBeErr(100); // ERR_UNAUTHORIZED
    });

    it("should allow owner to set maximum loan amount", () => {
      const response = simnet.callPublicFn(
        contractName,
        "set-max-loan-amount",
        [5000000], // 5 STX
        deployer
      );
      
      expect(response.result).toBeOk(true);
    });

    it("should allow emergency withdrawal by owner", () => {
      // Add funds first
      simnet.callPublicFn(
        contractName,
        "contribute-to-pool",
        [2000000],
        user1
      );
      
      const response = simnet.callPublicFn(
        contractName,
        "emergency-withdraw",
        [1000000],
        deployer
      );
      
      expect(response.result).toBeOk(1000000);
      
      // Check pool balance reduced
      const poolBalance = simnet.callReadOnlyFn(
        contractName,
        "get-pool-balance",
        [],
        deployer
      );
      expect(poolBalance.result).toBeUint(1000000);
    });

    it("should reject emergency withdrawal by non-owner", () => {
      const response = simnet.callPublicFn(
        contractName,
        "emergency-withdraw",
        [1000000],
        user1
      );
      
      expect(response.result).toBeErr(100); // ERR_UNAUTHORIZED
    });
  });
});
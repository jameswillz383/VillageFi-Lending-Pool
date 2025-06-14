;; Microfinance Lending Pool Smart Contract
;; Enables small loans to entrepreneurs with community-based reputation scoring

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_INSUFFICIENT_FUNDS (err u101))
(define-constant ERR_LOAN_NOT_FOUND (err u102))
(define-constant ERR_LOAN_ALREADY_EXISTS (err u103))
(define-constant ERR_INVALID_AMOUNT (err u104))
(define-constant ERR_LOAN_OVERDUE (err u105))
(define-constant ERR_INSUFFICIENT_REPUTATION (err u106))
(define-constant ERR_ALREADY_VOTED (err u107))
(define-constant ERR_CANNOT_VOTE_SELF (err u108))

;; Data Variables
(define-data-var total-pool-balance uint u0)
(define-data-var loan-counter uint u0)
(define-data-var min-reputation-score uint u50)
(define-data-var max-loan-amount uint u10000000) ;; 10 STX in microSTX
(define-data-var loan-duration uint u2628000) ;; ~1 month in blocks

;; Data Maps
(define-map loans
  { loan-id: uint }
  {
    borrower: principal,
    amount: uint,
    interest-rate: uint,
    due-date: uint,
    repaid: bool,
    created-at: uint
  }
)

(define-map borrower-reputation
  { borrower: principal }
  {
    score: uint,
    total-loans: uint,
    repaid-loans: uint,
    default-loans: uint,
    last-updated: uint
  }
)

(define-map reputation-votes
  { voter: principal, borrower: principal }
  {
    vote-type: (string-ascii 10), ;; "positive" or "negative"
    timestamp: uint
  }
)

(define-map pool-contributors
  { contributor: principal }
  {
    amount-contributed: uint,
    rewards-earned: uint,
    join-date: uint
  }
)

(define-map active-loans
  { borrower: principal }
  { loan-id: uint }
)

;; Helper functions
(define-private (min (a uint) (b uint))
  (if (<= a b) a b)
)

(define-private (max (a uint) (b uint))
  (if (>= a b) a b)
)

;; Read-only functions
(define-read-only (get-pool-balance)
  (var-get total-pool-balance)
)

(define-read-only (get-loan (loan-id uint))
  (map-get? loans { loan-id: loan-id })
)

(define-read-only (get-borrower-reputation (borrower principal))
  (default-to 
    { score: u50, total-loans: u0, repaid-loans: u0, default-loans: u0, last-updated: u0 }
    (map-get? borrower-reputation { borrower: borrower })
  )
)

(define-read-only (get-contributor-info (contributor principal))
  (map-get? pool-contributors { contributor: contributor })
)

(define-read-only (calculate-interest-rate (reputation-score uint))
  (if (>= reputation-score u80)
    u5  ;; 5% for high reputation
    (if (>= reputation-score u60)
      u8  ;; 8% for medium reputation
      u12 ;; 12% for low reputation
    )
  )
)

(define-read-only (is-loan-overdue (loan-id uint))
  (match (get-loan loan-id)
    loan-info
    (and 
      (not (get repaid loan-info))
      (> stacks-block-height (get due-date loan-info))
    )
    false
  )
)

;; Public functions

;; Contribute to lending pool
(define-public (contribute-to-pool (amount uint))
  (let ((contributor tx-sender))
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (try! (stx-transfer? amount contributor (as-contract tx-sender)))
    (var-set total-pool-balance (+ (var-get total-pool-balance) amount))
    (map-set pool-contributors
      { contributor: contributor }
      (merge
        (default-to 
          { amount-contributed: u0, rewards-earned: u0, join-date: stacks-block-height }
          (map-get? pool-contributors { contributor: contributor })
        )
        { amount-contributed: (+ amount 
          (default-to u0 (get amount-contributed (map-get? pool-contributors { contributor: contributor })))
        )}
      )
    )
    (ok amount)
  )
)

;; Vote on borrower reputation
(define-public (vote-reputation (borrower principal) (vote-type (string-ascii 10)))
  (let ((voter tx-sender))
    (asserts! (not (is-eq voter borrower)) ERR_CANNOT_VOTE_SELF)
    (asserts! (is-none (map-get? reputation-votes { voter: voter, borrower: borrower })) ERR_ALREADY_VOTED)
    (asserts! (or (is-eq vote-type "positive") (is-eq vote-type "negative")) ERR_UNAUTHORIZED)
    
    ;; Record the vote
    (map-set reputation-votes
      { voter: voter, borrower: borrower }
      { vote-type: vote-type, timestamp: stacks-block-height }
    )
    
    ;; Update borrower reputation
    (let ((current-reputation (get-borrower-reputation borrower)))
      (map-set borrower-reputation
        { borrower: borrower }
        (merge current-reputation
          {
            score: (if (is-eq vote-type "positive")
              (min u100 (+ (get score current-reputation) u5))
              (max u0 (- (get score current-reputation) u3))
            ),
            last-updated: stacks-block-height
          }
        )
      )
    )
    (ok true)
  )
)

;; Request a loan
(define-public (request-loan (amount uint))
  (let (
    (borrower tx-sender)
    (reputation (get-borrower-reputation borrower))
    (reputation-score (get score reputation))
    (interest-rate (calculate-interest-rate reputation-score))
    (new-loan-id (+ (var-get loan-counter) u1))
  )
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (asserts! (<= amount (var-get max-loan-amount)) ERR_INVALID_AMOUNT)
    (asserts! (>= reputation-score (var-get min-reputation-score)) ERR_INSUFFICIENT_REPUTATION)
    (asserts! (>= (var-get total-pool-balance) amount) ERR_INSUFFICIENT_FUNDS)
    (asserts! (is-none (map-get? active-loans { borrower: borrower })) ERR_LOAN_ALREADY_EXISTS)
    
    ;; Create loan record
    (map-set loans
      { loan-id: new-loan-id }
      {
        borrower: borrower,
        amount: amount,
        interest-rate: interest-rate,
        due-date: (+ stacks-block-height (var-get loan-duration)),
        repaid: false,
        created-at: stacks-block-height
      }
    )
    
    ;; Track active loan for borrower
    (map-set active-loans
      { borrower: borrower }
      { loan-id: new-loan-id }
    )
    
    ;; Update borrower stats
    (map-set borrower-reputation
      { borrower: borrower }
      (merge reputation
        {
          total-loans: (+ (get total-loans reputation) u1),
          last-updated: stacks-block-height
        }
      )
    )
    
    ;; Transfer funds to borrower
    (try! (as-contract (stx-transfer? amount tx-sender borrower)))
    (var-set total-pool-balance (- (var-get total-pool-balance) amount))
    (var-set loan-counter new-loan-id)
    
    (ok new-loan-id)
  )
)

;; Repay loan
(define-public (repay-loan (loan-id uint))
  (let (
    (loan-info (unwrap! (get-loan loan-id) ERR_LOAN_NOT_FOUND))
    (borrower (get borrower loan-info))
    (principal-amount (get amount loan-info))
    (interest-rate (get interest-rate loan-info))
    (total-amount (+ principal-amount (/ (* principal-amount interest-rate) u100)))
  )
    (asserts! (is-eq tx-sender borrower) ERR_UNAUTHORIZED)
    (asserts! (not (get repaid loan-info)) ERR_LOAN_NOT_FOUND)
    
    ;; Transfer repayment to contract
    (try! (stx-transfer? total-amount borrower (as-contract tx-sender)))
    
    ;; Mark loan as repaid
    (map-set loans
      { loan-id: loan-id }
      (merge loan-info { repaid: true })
    )
    
    ;; Remove from active loans
    (map-delete active-loans { borrower: borrower })
    
    ;; Update pool balance
    (var-set total-pool-balance (+ (var-get total-pool-balance) total-amount))
    
    ;; Update borrower reputation
    (let ((reputation (get-borrower-reputation borrower)))
      (map-set borrower-reputation
        { borrower: borrower }
        (merge reputation
          {
            score: (min u100 (+ (get score reputation) u10)),
            repaid-loans: (+ (get repaid-loans reputation) u1),
            last-updated: stacks-block-height
          }
        )
      )
    )
    
    (ok total-amount)
  )
)

;; Mark loan as defaulted (can be called by anyone after due date)
(define-public (mark-default (loan-id uint))
  (let (
    (loan-info (unwrap! (get-loan loan-id) ERR_LOAN_NOT_FOUND))
    (borrower (get borrower loan-info))
  )
    (asserts! (not (get repaid loan-info)) ERR_LOAN_NOT_FOUND)
    (asserts! (> stacks-block-height (get due-date loan-info)) ERR_LOAN_OVERDUE)
    
    ;; Remove from active loans
    (map-delete active-loans { borrower: borrower })
    
    ;; Update borrower reputation (negative impact)
    (let ((reputation (get-borrower-reputation borrower)))
      (map-set borrower-reputation
        { borrower: borrower }
        (merge reputation
          {
            score: (max u0 (- (get score reputation) u20)),
            default-loans: (+ (get default-loans reputation) u1),
            last-updated: stacks-block-height
          }
        )
      )
    )
    
    (ok true)
  )
)

;; Admin functions (only contract owner)
(define-public (set-min-reputation (new-min uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set min-reputation-score new-min)
    (ok true)
  )
)

(define-public (set-max-loan-amount (new-max uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set max-loan-amount new-max)
    (ok true)
  )
)

(define-public (emergency-withdraw (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (asserts! (<= amount (var-get total-pool-balance)) ERR_INSUFFICIENT_FUNDS)
    (try! (as-contract (stx-transfer? amount tx-sender CONTRACT_OWNER)))
    (var-set total-pool-balance (- (var-get total-pool-balance) amount))
    (ok amount)
  )
)
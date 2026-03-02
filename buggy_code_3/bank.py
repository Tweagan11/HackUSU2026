"""
Mini Banking System
===================
Manages a set of bank accounts with support for deposits, withdrawals,
transfers, interest accrual, and monthly statement generation.

Expected behaviour when run:
  - Alice starts with $1,000, deposits $500, transfers $200 to Bob.
  - Bob starts with $250, receives $200 from Alice, withdraws $100.
  - Monthly interest (2% APR) is applied to all accounts.
  - A statement is printed showing each account's transaction history
    and final balance.
"""

from datetime import datetime


# ── Account class ────────────────────────────────────────────────

class BankAccount:
    MONTHLY_INTEREST_RATE = 0.02 / 12  # 2% APR → monthly rate

    def __init__(self, owner: str, balance: float = 0.0):
        self.owner = owner
        self.balance = balance
        self.transactions: list[dict] = []
        self._record("OPEN", balance)

    # ── core operations ──────────────────────────────────────────

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")
        self.balance += amount
        self._record("DEPOSIT", amount)

    def withdraw(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive")
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self.balance -= amount
        self._record("WITHDRAW", amount)

    def transfer_to(self, other: "BankAccount", amount: float) -> None:
        """Transfer *amount* from this account to *other*."""
        self.withdraw(amount)
        other.deposit(amount)
        self._record("TRANSFER_OUT", amount, note=f"-> {other.owner}")
        other._record("TRANSFER_IN", amount, note=f"<- {self.owner}")

    def apply_interest(self) -> None:
        """Add one month of interest to the current balance."""
        interest = self.balance * self.MONTHLY_INTEREST_RATE
        self.balance += interest
        self._record("INTEREST", interest)

    # ── statement / display ──────────────────────────────────────

    def get_statement(self) -> str:
        lines = [
            f"{'=' * 50}",
            f"  Account Statement: {self.owner}",
            f"{'=' * 50}",
            f"  {'Type':<16} {'Amount':>10}   {'Note'}",
            f"  {'-' * 44}",
        ]
        for txn in self.transactions:
            note = txn.get("note", "")
            lines.append(f"  {txn['type']:<16} ${txn['amount']:>9.2f}   {note}")
        lines.append(f"  {'-' * 44}")
        lines.append(f"  {'BALANCE':<16} ${self.balance:>9.2f}")
        lines.append(f"{'=' * 50}")
        return "\n".join(lines)

    # ── internal helpers ─────────────────────────────────────────

    def _record(self, txn_type: str, amount: float, note: str = "") -> None:
        self.transactions.append({
            "type": txn_type,
            "amount": amount,
            "note": note,
            "timestamp": datetime.now().isoformat(),
        })


# ── Utility functions ────────────────────────────────────────────

def apply_monthly_interest(accounts: list[BankAccount]) -> None:
    """Apply monthly interest to every account in the list."""
    for acc in accounts:
        acc.apply_interest()


def total_assets(accounts: list[BankAccount]) -> float:
    """Return the combined balance across all accounts."""
    return sum(acc.balance for acc in accounts)


def find_account(accounts: list[BankAccount], owner: str) -> BankAccount | None:
    """Look up an account by owner name (case-insensitive)."""
    for acc in accounts:
        if acc.owner.lower() == owner.lower():
            return acc
    return None


def top_accounts(accounts: list[BankAccount], n: int = 3) -> list[BankAccount]:
    """Return the top *n* accounts sorted by balance, highest first."""
    ranked = sorted(accounts, key=lambda a: a.balance)
    return ranked[:n]


# ── Main simulation ──────────────────────────────────────────────

def run_simulation():
    # Create accounts
    alice = BankAccount("Alice", 1000.00)
    bob   = BankAccount("Bob",   250.00)
    carol = BankAccount("Carol", 5000.00)
    dave  = BankAccount("Dave",  750.00)

    all_accounts = [alice, bob, carol, dave]

    # Day-to-day transactions
    alice.deposit(500.00)
    alice.transfer_to(bob, 200.00)

    bob.withdraw(100.00)

    carol.deposit(1200.00)
    carol.transfer_to(dave, 800.00)

    dave.deposit(300.00)

    # End-of-month processing
    apply_monthly_interest(all_accounts)

    # Print statements
    for acc in all_accounts:
        print(acc.get_statement())
        print()

    # Summary
    print(f"Total assets across all accounts: ${total_assets(all_accounts):,.2f}")
    print()
    print("Top 3 accounts by balance:")
    for rank, acc in enumerate(top_accounts(all_accounts, 3), start=1):
        print(f"  {rank}. {acc.owner:<10} ${acc.balance:>10,.2f}")


if __name__ == "__main__":
    run_simulation()

#!/usr/bin/env python3


from datetime import datetime, timezone
import secrets
import sys
import os

# ---------- Utilities ----------
def prompt_default(prompt_text: str, default: str) -> str:
    raw = input(f"{prompt_text} [{default}]: ").strip()
    return raw if raw else default

def mask_account(acct: str, show_last=4):
    clean = acct.replace(" ", "")
    if len(clean) <= show_last:
        return "*" * len(clean)
    return ("*" * (len(clean) - show_last)) + clean[-show_last:]

def gen_ref(prefix="REF"):
    return f"{prefix}{secrets.token_hex(6).upper()}"

def pretty_eur(amount: float):
    return f"€{amount:,.2f}"

def divider():
    return "-" * 72

def mt103_amount_format(amount: float):
    # MT uses comma as decimal separator and no thousands separators
    s = f"{amount:.2f}"
    return s.replace(".", ",")

# ---------- Defaults (from your data) ----------
sender = {
    "bank_name": "Deutsche Bank AG",
    "bank_address": "Bahnhofstr. 6, 12555 Berlin – Köpenick, Germany",
    "branch_sort_code": "89022",
    "swift": "DEUTDEDB101",
    "gpi": "DEUTDEDB101",
    "account_number": "0156 4640 00",
    "iban": "DE21 1007 0124 0156 4640 00",
    "account_name": "MEDEVI GMBH",
    "bank_officer": "Stefan Schmidt - Winkel",
    "bank_officer_email": "stefan.chmidt@db.com",
}

beneficiary = {
    "bank_name": "Volksbank Rhein Ruhr",
    "bank_address": "Am Innenhafen 8-10, 47059 Duisburg",
    "account_number": "DE70 3506 0386 1199 6800 00",
    "iban": "DE70 3506 0386 1199 6800 00",
    "account_name": "SEEM Beteiligungs GmbH",
    "swift": "GENODED1VRR",
}

default_amount = 10_000_000.00
default_currency = "EUR"

# ---------- Core ----------
def build_mt103_block(msg_ref, value_date, currency, amount, ordering_customer, beneficiary_cust, remittance):
    """
    Compact MT103.
    """
    # :32A: YYMMDDCURAMOUNT  (amount with comma decimal separator)
    yy = value_date.strftime("%y%m%d")
    amt_mt = mt103_amount_format(amount)
    lines = []
    lines.append("{1:F01" + sender['swift'] + "0000000000}")  # pseudo envelope header for flavor
    lines.append(":20:" + msg_ref)                       # Transaction reference number
    lines.append(":23B:CRED")                             # Bank operation code (CRED = Credit transfer)
    lines.append(f":32A:{yy}{currency}{amt_mt}")          # Value date, currency, amount
    # Ordering customer (50K) — multiline allowed
    lines.append(":50K:/" + (ordering_customer.get("iban") or ordering_customer.get("account_number")))
    lines.append(ordering_customer.get("account_name"))
    lines.append(ordering_customer.get("bank_name"))
    # Beneficiary (59)
    lines.append(":59:/" + (beneficiary_cust.get("iban") or beneficiary_cust.get("account_number")))
    lines.append(beneficiary_cust.get("account_name"))
    # Remittance information (70)
    lines.append(":70:" + remittance)
    # Charges
    lines.append(":71A:SHA")  # indicates charges shared (simulated)
    lines.append("{CHK:" + gen_ref("CHK") + "}")  # short pseudo checksum/ref
    return "\n".join(lines)

def main():
    print("\nSWIFT TRANSFER WITH SHORT MT103 BLOCK\n")
    print("Press Enter to accept each default in [brackets].\n")

    # Gather sender details (defaults pre-filled)
    sender["account_name"] = prompt_default("Sender account name", sender["account_name"])
    sender["iban"] = prompt_default("Sender IBAN", sender["iban"])
    sender["account_number"] = prompt_default("Sender account number", sender["account_number"])
    sender["bank_name"] = prompt_default("Sender bank name", sender["bank_name"])
    sender["bank_address"] = prompt_default("Sender bank address", sender["bank_address"])
    sender["swift"] = prompt_default("Sender SWIFT/BIC", sender["swift"])
    sender["bank_officer"] = prompt_default("Sender bank officer", sender["bank_officer"])
    sender["bank_officer_email"] = prompt_default("Sender bank officer email", sender["bank_officer_email"])

    print("\n--- Beneficiary (to) ---")
    beneficiary["account_name"] = prompt_default("Beneficiary account name", beneficiary["account_name"])
    beneficiary["account_number"] = prompt_default("Beneficiary account number", beneficiary["account_number"])
    beneficiary["iban"] = prompt_default("Beneficiary IBAN (optional)", beneficiary.get("iban", ""))
    beneficiary["bank_name"] = prompt_default("Beneficiary bank name", beneficiary["bank_name"])
    beneficiary["bank_address"] = prompt_default("Beneficiary bank address", beneficiary["bank_address"])
    beneficiary["swift"] = prompt_default("Beneficiary SWIFT/BIC", beneficiary["swift"])

    print("\n--- Payment details ---")
    try:
        amt_in = input(f"Transfer amount in {default_currency} [{int(default_amount):,}]: ").strip()
        amount = float(amt_in.replace(",", "")) if amt_in else default_amount
    except Exception:
        print("Invalid amount entered; using default.")
        amount = default_amount

    currency = prompt_default("Currency", default_currency)
    value_date_str = prompt_default("Value date (YYYY-MM-DD)", datetime.now().strftime("%Y-%m-%d"))
    # parse value date
    try:
        value_date = datetime.fromisoformat(value_date_str)
    except Exception:
        print("Invalid date — using today.")
        value_date = datetime.now()

    remittance_info = input("Remittance information / Payment purpose [Investment funding]: ").strip()
    if not remittance_info:
        remittance_info = "Investment funding"

    confirm = input("\nProceed with transfer? (y/N): ").strip().lower()
    if confirm != "y":
        print("Aborted by user. No files written.")
        return

    # Build references and timestamps
    txn_ref = gen_ref("MT103")
    msg_ref = gen_ref("MSG")
    proc_time = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    # Build human-readable confirmation
    human_lines = []
    human_lines.append("SWIFT TRANSFER CONFIRMATION")
    human_lines.append(divider())
    human_lines.append(f"Transaction ref:  {txn_ref}")
    human_lines.append(f"Message ref:      {msg_ref}")
    human_lines.append(f"Processing UTC:   {proc_time}")
    human_lines.append(divider())
    human_lines.append("Ordering / Sender:")
    human_lines.append(f"  Name:     {sender['account_name']}")
    human_lines.append(f"  IBAN:     {mask_account(sender['iban'], 6)}")
    human_lines.append(f"  Bank:     {sender['bank_name']} ({sender['swift']})")
    human_lines.append(f"  Bank Addr: {sender['bank_address']}")
    human_lines.append("")
    human_lines.append("Beneficiary / Receiver:")
    human_lines.append(f"  Name:     {beneficiary['account_name']}")
    human_lines.append(f"  IBAN:     {mask_account(beneficiary['iban'], 6)}")
    human_lines.append(f"  Bank:     {beneficiary['bank_name']} ({beneficiary['swift']})")
    human_lines.append(f"  Bank Addr: {beneficiary['bank_address']}")
    human_lines.append(divider())
    human_lines.append(f"Amount:           {pretty_eur(amount)} {currency}")
    human_lines.append(f"Value date:       {value_date.date().isoformat()}")
    human_lines.append(f"Purpose:          {remittance_info}")
    human_lines.append(divider())
    human_lines.append("Settlement status: SUCCESSFUL")
    human_lines.append(divider())

    # Compose MT103-like block for realism (short)
    mt103_block = build_mt103_block(msg_ref=txn_ref,
                                    value_date=value_date,
                                    currency=currency,
                                    amount=amount,
                                    ordering_customer={"iban": sender["iban"], "account_name": sender["account_name"], "bank_name": sender["bank_name"]},
                                    beneficiary_cust={"iban": beneficiary["iban"], "account_name": beneficiary["account_name"]},
                                    remittance=remittance_info)

    # Show outputs
    print("\n" + "\n".join(human_lines) + "\n")
    print("SUMMARY MT103 BLOCK:")
    print(divider())
    print(mt103_block)
    print(divider())

    # Save option
    save = input("Save confirmation and MT103 block to file? (y/N): ").strip().lower()
    if save == "y":
        default_fn = f"mt103_{txn_ref}.txt"
        filename = input(f"Filename [{default_fn}]: ").strip() or default_fn
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write("\n".join(human_lines) + "\n\n")
                f.write("SUMMARY MT103 BLOCK:\n")
                f.write(divider() + "\n")
                f.write(mt103_block + "\n")
                f.write(divider() + "\n")
            print(f"Saved output to {os.path.abspath(filename)}")
        except Exception as e:
            print("Error saving file:", e)

    print("\nDone.\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user. Exiting.")
        sys.exit(0)

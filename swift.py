#!/usr/bin/env python3
"""
"""

from datetime import datetime, timezone
import secrets
import sys
import os

# ---------- Utilities ----------
def prompt_default(prompt_text: str, default: str) -> str:
    raw = input(f"{prompt_text} [{default}]: ").strip()
    return raw if raw else default

def mask_value(val: str, show_last=4):
    if not val:
        return ""
    clean = val.replace(" ", "")
    if len(clean) <= show_last:
        return "*" * len(clean)
    return ("*" * (len(clean) - show_last)) + clean[-show_last:]

def gen_ref(prefix="REF"):
    return f"{prefix}{secrets.token_hex(6).upper()}"

def pretty_eur(amount: float):
    return f"€{amount:,.2f}"

def divider():
    return "-" * 72

def mt_amount_format(amount: float):
    # MT formatting: no thousands sep, comma decimal separator
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
    # optional correspondent/institution BICs for MT fields
    "ordering_institution_bic": "DEUTDEFFXXX",   # example / pseudo
    "senders_correspondent_bic": "DEUTDEDBCORR"  # pseudo
}

beneficiary = {
    "bank_name": "Volksbank Rhein Ruhr",
    "bank_address": "Am Innenhafen 8-10, 47059 Duisburg",
    "account_number": "DE70 3506 0386 1199 6800 00",
    "iban": "DE70 3506 0386 1199 6800 00",
    "account_name": "SEEM Beteiligungs GmbH",
    "swift": "GENODED1VRR",
    # optional account-with / beneficiary institution BICs
    "account_with_bic": "GENODED1VRR",
    "receivers_correspondent_bic": "GENODED1CORR"  # pseudo
}

default_amount = 10_000_000.00
default_currency = "EUR"

# ---------- MT103 builder (expanded) ----------
def build_mt103_full(msg_ref,
                     value_date,
                     currency,
                     amount,
                     ordering_customer,
                     beneficiary_cust,
                     remittance,
                     include_full_ids=False,
                     additional_text=""):
    """
    Build an expanded MT103-like block with more fields for realism.
    include_full_ids: if False, IBAN/account numbers are masked in the MT block.
    """
    # :32A: YYMMDDCURAMOUNT
    yy = value_date.strftime("%y%m%d")
    amt_mt = mt_amount_format(amount)

    # choose what to display for IDs
    def id_for(v):
        if not v:
            return ""
        return v if include_full_ids else mask_value(v, show_last=6)

    lines = []
    # pseudo header (flavor)
    lines.append("{1:F01" + sender.get("swift", "DEUTDEDBXXX") + "0000000000}")
    # Basic fields
    lines.append(":20:" + msg_ref)                       # Transaction reference
    lines.append(":23B:CRED")                             # Bank operation code
    lines.append(f":32A:{yy}{currency}{amt_mt}")          # Value date, currency, amount

    # Ordering institution (52A) - BIC of ordering institution (if any)
    if ordering_customer.get("ordering_institution_bic"):
        lines.append(":52A:" + ordering_customer["ordering_institution_bic"])

    # Sender's correspondent (53A) - optional / pseudo
    if ordering_customer.get("senders_correspondent_bic"):
        lines.append(":53A:" + ordering_customer["senders_correspondent_bic"])

    # Receiver's correspondent (54A) - optional
    if beneficiary_cust.get("receivers_correspondent_bic"):
        lines.append(":54A:" + beneficiary_cust["receivers_correspondent_bic"])

    # Account with institution (57A)
    if beneficiary_cust.get("account_with_bic"):
        lines.append(":57A:" + beneficiary_cust["account_with_bic"])

    # Ordering customer (50K) - include IBAN or masked acct
    ordering_id = id_for(ordering_customer.get("iban") or ordering_customer.get("account_number") or "")
    lines.append(":50K:/" + ordering_id)
    lines.append(ordering_customer.get("account_name", ""))
    lines.append(ordering_customer.get("bank_name", ""))

    # Beneficiary (59)
    ben_id = id_for(beneficiary_cust.get("iban") or beneficiary_cust.get("account_number") or "")
    lines.append(":59:/" + ben_id)
    lines.append(beneficiary_cust.get("account_name", ""))

    # Beneficiary bank details as :58A: (Beneficiary institution) if BIC exists
    if beneficiary_cust.get("swift"):
        lines.append(":58A:" + beneficiary_cust["swift"])

    # Remittance information (70)
    lines.append(":70:" + remittance[:140])  # limit to typical line length for display

    # Charges
    lines.append(":71A:SHA")  # simulated charges code

    # Sender to Receiver information - free format field 72
    if additional_text:
        # split into lines if long
        for i in range(0, len(additional_text), 120):
            lines.append(":72:" + additional_text[i:i+120])
    else:
        lines.append(":72:/INS/Instruction - no action required")

    # pseudo trailer / checksum
    lines.append("{CHK:" + gen_ref("CHK") + "}")

    return "\n".join(lines)


# ---------- Main ----------
def main():
    print("\nSWIFT TRANSFER — EXPANDED MT103 BLOCK \n")
    print("Press Enter to accept each default in [brackets].\n")

    # Sender details
    sender["account_name"] = prompt_default("Sender account name", sender["account_name"])
    sender["iban"] = prompt_default("Sender IBAN", sender["iban"])
    sender["account_number"] = prompt_default("Sender account number", sender["account_number"])
    sender["bank_name"] = prompt_default("Sender bank name", sender["bank_name"])
    sender["bank_address"] = prompt_default("Sender bank address", sender["bank_address"])
    sender["swift"] = prompt_default("Sender SWIFT/BIC", sender["swift"])
    sender["bank_officer"] = prompt_default("Sender bank officer", sender["bank_officer"])
    sender["bank_officer_email"] = prompt_default("Sender bank officer email", sender["bank_officer_email"])
    sender["ordering_institution_bic"] = prompt_default("Sender ordering institution BIC (52A) [optional]", sender.get("ordering_institution_bic",""))
    sender["senders_correspondent_bic"] = prompt_default("Sender's correspondent BIC (53A) [optional]", sender.get("senders_correspondent_bic",""))

    print("\n--- Beneficiary (to) ---")
    beneficiary["account_name"] = prompt_default("Beneficiary account name", beneficiary["account_name"])
    beneficiary["account_number"] = prompt_default("Beneficiary account number", beneficiary["account_number"])
    beneficiary["iban"] = prompt_default("Beneficiary IBAN (optional)", beneficiary.get("iban", ""))
    beneficiary["bank_name"] = prompt_default("Beneficiary bank name", beneficiary["bank_name"])
    beneficiary["bank_address"] = prompt_default("Beneficiary bank address", beneficiary["bank_address"])
    beneficiary["swift"] = prompt_default("Beneficiary SWIFT/BIC", beneficiary["swift"])
    beneficiary["account_with_bic"] = prompt_default("Beneficiary 'account with' BIC (57A) [optional]", beneficiary.get("account_with_bic",""))
    beneficiary["receivers_correspondent_bic"] = prompt_default("Receiver's correspondent BIC (54A) [optional]", beneficiary.get("receivers_correspondent_bic",""))

    print("\n--- Payment details ---")
    try:
        amt_in = input(f"Transfer amount in {default_currency} [{int(default_amount):,}]: ").strip()
        amount = float(amt_in.replace(",", "")) if amt_in else default_amount
    except Exception:
        print("Invalid amount entered; using default.")
        amount = default_amount

    currency = prompt_default("Currency", default_currency)
    value_date_str = prompt_default("Value date (YYYY-MM-DD)", datetime.now().strftime("%Y-%m-%d"))
    try:
        value_date = datetime.fromisoformat(value_date_str)
    except Exception:
        print("Invalid date — using today.")
        value_date = datetime.now()

    remittance_info = input("Remittance information / Payment purpose [Investment funding]: ").strip()
    if not remittance_info:
        remittance_info = "Investment funding"

    additional72 = input("Optional sender->receiver instructions (field 72) [leave blank for default]: ").strip()

    # Masking preference inside the MT103 block
    mt_full_ids_input = input("Include FULL IBANs/account numbers in MT103 block? (y/N): ").strip().lower()
    include_full_ids = (mt_full_ids_input == "y")

    confirm = input("\nProceed with transfer? (y/N): ").strip().lower()
    if confirm != "y":
        print("Aborted by user. No files written.")
        return

    # refs & timestamps
    txn_ref = gen_ref("MT103")
    msg_ref = gen_ref("MSG")
    proc_time = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    # Human-readable confirmation
    human_lines = []
    human_lines.append("SWIFT TRANSFER CONFIRMATION")
    human_lines.append(divider())
    human_lines.append(f"Transaction ref:  {txn_ref}")
    human_lines.append(f"Message ref:      {msg_ref}")
    human_lines.append(f"Processing UTC:   {proc_time}")
    human_lines.append(divider())
    human_lines.append("Ordering / Sender:")
    human_lines.append(f"  Name:     {sender['account_name']}")
    human_lines.append(f"  IBAN:     {mask_value(sender['iban'], 6)}")
    human_lines.append(f"  Bank:     {sender['bank_name']} ({sender['swift']})")
    human_lines.append(f"  Bank Addr: {sender['bank_address']}")
    human_lines.append("")
    human_lines.append("Beneficiary / Receiver:")
    human_lines.append(f"  Name:     {beneficiary['account_name']}")
    human_lines.append(f"  IBAN:     {mask_value(beneficiary['iban'], 6)}")
    human_lines.append(f"  Bank:     {beneficiary['bank_name']} ({beneficiary['swift']})")
    human_lines.append(f"  Bank Addr: {beneficiary['bank_address']}")
    human_lines.append(divider())
    human_lines.append(f"Amount:           {pretty_eur(amount)} {currency}")
    human_lines.append(f"Value date:       {value_date.date().isoformat()}")
    human_lines.append(f"Purpose:          {remittance_info}")
    human_lines.append(divider())
    human_lines.append("Settlement status: SUCCESSFUL")
    human_lines.append(divider())

    # Build expanded MT103 block
    mt103_block = build_mt103_full(msg_ref=txn_ref,
                                   value_date=value_date,
                                   currency=currency,
                                   amount=amount,
                                   ordering_customer={
                                        "iban": sender.get("iban"),
                                        "account_name": sender.get("account_name"),
                                        "bank_name": sender.get("bank_name"),
                                        "ordering_institution_bic": sender.get("ordering_institution_bic",""),
                                        "senders_correspondent_bic": sender.get("senders_correspondent_bic","")
                                   },
                                   beneficiary_cust={
                                        "iban": beneficiary.get("iban"),
                                        "account_number": beneficiary.get("account_number"),
                                        "account_name": beneficiary.get("account_name"),
                                        "swift": beneficiary.get("swift"),
                                        "receivers_correspondent_bic": beneficiary.get("receivers_correspondent_bic",""),
                                        "account_with_bic": beneficiary.get("account_with_bic","")
                                   },
                                   remittance=remittance_info,
                                   include_full_ids=include_full_ids,
                                   additional_text=additional72)

    # Output to screen
    print("\n" + "\n".join(human_lines) + "\n")
    print("EXPANDED MT103-LIKE BLOCK:")
    print(divider())
    print(mt103_block)
    print(divider())

    # Save option
    save = input("Save confirmation and MT103 block to file? (y/N): ").strip().lower()
    if save == "y":
        default_fn = f"mt103_full_{txn_ref}.txt"
        filename = input(f"Filename [{default_fn}]: ").strip() or default_fn
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write("\n".join(human_lines) + "\n\n")
                f.write("EXPANDED MT103-LIKE BLOCK:\n")
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

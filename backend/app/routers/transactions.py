# backend/app/routers/transactions.py (updated – added account_id support)
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query  # NEW: Query for account_id
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, and_
from app.database import get_db
from app.models import Transaction, Category, Account
from app.schemas import TransactionResponse, TransactionCreate, TransactionUpdate
from app.agents.transaction_categorizer import categorize_transactions
from typing import List, Optional
import pandas as pd
from io import StringIO
import logging
import re
from rapidfuzz import fuzz, process

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactions", tags=["transactions"])


def detect_columns(df: pd.DataFrame):
    cols = {str(c).strip().lower(): str(c) for c in df.columns}
    mapping = {}

    # ── Date column ─────────────────────────────────────────────────────────────
    date_keywords = [
        'date', 'trans date', 'transaction date', 'posted date', 'posting date',
        'post date', 'value date', 'effective date', 'book date', 'process date'
    ]
    for keyword in date_keywords:
        for clean, orig in cols.items():
            if keyword in clean:
                mapping['date'] = orig
                break
        if 'date' in mapping:
            break

    # ── Description column ──────────────────────────────────────────────────────
    # RBC often has "Description 1" and "Description 2" — combine them later
    desc_keywords = [
        'description', 'desc', 'payee', 'merchant', 'memo', 'details', 'narration',
        'particulars', 'remarks', 'transaction details', 'trans desc', 'description 1', 'description 2'
    ]
    desc_col = None
    for keyword in desc_keywords:
        for clean, orig in cols.items():
            if keyword in clean:
                if 'description 1' in clean or 'description 2' in clean:
                    # Prefer Description 1 if both exist, or take first match
                    if not desc_col or 'description 1' in clean:
                        desc_col = orig
                else:
                    mapping['description'] = orig
                    break
        if 'description' in mapping:
            break
    if desc_col:
        mapping['description'] = desc_col  # use Description 1 or 2

    # ── Amount column(s) ────────────────────────────────────────────────────────
    # RBC uses CAD$ and USD$ columns
    amount_keywords = [
        'amount', 'amt', 'transaction amount', 'debit', 'credit', 'cad$', 'usd$',
        'value', 'balance', 'dr/cr', 'debit/credit'
    ]
    debit_col = None
    credit_col = None
    single_amount = None
    for keyword in amount_keywords:
        for clean, orig in cols.items():
            if keyword in clean:
                if 'debit' in clean:
                    debit_col = orig
                elif 'credit' in clean:
                    credit_col = orig
                elif 'cad$' in clean:
                    mapping['amount'] = orig  # RBC CAD
                else:
                    single_amount = orig
                if debit_col and credit_col:
                    break
        if debit_col and credit_col:
            mapping['debit'] = debit_col
            mapping['credit'] = credit_col
            break
        if 'amount' in mapping or single_amount:
            mapping['amount'] = mapping.get('amount') or single_amount

    return mapping

def process_csv(file_content: str, db: Session, account_id: Optional[int] = None):
    df = pd.read_csv(StringIO(file_content))
    mapping = detect_columns(df)

    required = ['date', 'description']
    if 'amount' not in mapping and ('debit' not in mapping or 'credit' not in mapping):
        required.append('amount')

    missing = [f for f in required if f not in mapping]
    if missing:
        raise HTTPException(400, f"Missing columns: {', '.join(missing)}")

    # Normalize dates
    df[mapping['date']] = pd.to_datetime(df[mapping['date']], errors='coerce')
    df = df.dropna(subset=[mapping['date']])

    # Handle amounts
    if 'amount' in mapping:
        df['amount'] = pd.to_numeric(df[mapping['amount']], errors='coerce')
    else:
        df['debit'] = pd.to_numeric(df[mapping['debit']].fillna(0), errors='coerce')
        df['credit'] = pd.to_numeric(df[mapping['credit']].fillna(0), errors='coerce')
        df['amount'] = df['credit'] - df['debit']

    df = df.dropna(subset=['amount'])

    # ── CREDIT CARD AMOUNT INVERSION ────────────────────────────────────────
    # For credit card accounts:
    #   CSV positive = charges/purchases    → should be NEGATIVE in DB (expense)
    #   CSV negative = payments/credits     → should be POSITIVE in DB (payment/income)
    if account_id is not None:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account and account.type == "credit_card":
            df['amount'] = -df['amount']   # Invert sign

    # ── Description column ──────────────────────────────────────────────────────
    desc_col_1 = None
    desc_col_2 = None

    for col in df.columns:
        clean_col = str(col).strip().lower()
        if 'description 1' in clean_col or 'desc 1' in clean_col:
            desc_col_1 = col
        elif 'description 2' in clean_col or 'desc 2' in clean_col:
            desc_col_2 = col
        elif any(kw in clean_col for kw in ['description', 'desc', 'payee', 'merchant', 'memo', 'narration', 'particulars', 'remarks', 'transaction details']):
            if not desc_col_1:  # prefer Description 1 over generic
                desc_col_1 = col

    if desc_col_1:
        if desc_col_2:
            df['description'] = (
                df[desc_col_1].fillna('').astype(str) + ' ' +
                df[desc_col_2].fillna('').astype(str)
            ).str.strip()
        else:
            df['description'] = df[desc_col_1].astype(str).str.strip()
    else:
        raise HTTPException(400, "Could not detect a description column in CSV")

    df['description'] = df['description'].str.strip()

    # Deduplicate against DB (date + amount + normalized description)
    existing = db.query(Transaction).filter(Transaction.user_id == 1).all()
    existing_set = {
        (t.date.date(), t.amount, normalize_vendor(t.description))
        for t in existing
    }

    # Check duplicates using normalized key
    new_transactions = []
    for _, row in df.iterrows():
        norm_desc = normalize_vendor(row['description'])
        norm_date = row[mapping['date']].date()
        norm_amount = round(row['amount'], 2)

        exists = db.query(Transaction).filter(
            Transaction.user_id == 1,
            Transaction.date == norm_date,
            Transaction.amount == norm_amount,
            Transaction.description.ilike(f"%{norm_desc}%")   # ← more lenient match
        ).first()

        if not exists:
            tx = {
                'date': row[mapping['date']],
                'description': row['description'].strip(),
                'original_description': row.get('original_description', row['description']),
                'amount': float(row['amount']),
            }
            if account_id is not None:
                tx['account_id'] = account_id
                logger.debug(f"Assigned account_id={account_id} to new tx: {tx['description'][:60]}...")
            new_transactions.append(tx)

    if not new_transactions:
        logger.info("No new (non-duplicate) transactions found")
        return []

    # Attach account_type for the prompt
    account_type = "unknown"
    if account_id is not None:
        account = db.query(Account).filter(Account.id == account_id).first()
        if account:
            account_type = account.type or "unknown"
            logger.info(f"Using account_type = '{account_type}' for {len(new_transactions)} new transactions")
        else:
            logger.warning(f"Account ID {account_id} not found - using 'unknown' type")

    for tx in new_transactions:
        tx['account_type'] = account_type

    return new_transactions
    
def normalize_vendor(description: str) -> str:
    """
    Normalize a transaction description for duplicate detection and comparison.
    Removes noise, standardizes formatting, removes common prefixes, etc.
    Returns an uppercase, simplified version suitable for matching.
    """
    if not description:
        return ""

    # 1. Convert to uppercase and collapse multiple spaces
    desc = re.sub(r'\s+', ' ', description.strip().upper())

    # 2. Remove special characters except alphanumeric, spaces, and basic punctuation we care about
    desc = re.sub(r'[^A-Z0-9\s\-#&/]', '', desc)

    # 3. Remove very common bank/processor prefixes (expand this list as needed)
    prefixes = [
        r'CONTACTLESS INTERAC PURCHASE -?',
        r'POS PURCHASE -?',
        r'DEBIT PURCHASE -?',
        r'PRE-AUTHORIZED DEBIT -?',
    ]

    prefix_pattern = '|'.join(prefixes)
    desc = re.sub(rf'^(?:{prefix_pattern})\s*', '', desc, flags=re.IGNORECASE)

    # 4. Remove leading numbers (often card last-4 or reference numbers)
    desc = re.sub(r'^\d{4}\s*', '', desc)           # 3422 
    desc = re.sub(r'-\s*\d{4}$', '', desc)          # -3422 at end
    desc = re.sub(r'#\d+\s*', '', desc)             # #117, #00025 etc.

    # 5. Remove common trailing garbage (country codes, dates, etc.)
    desc = re.sub(r'\s*(CA$|CAN$|CANADA$|\d{2}/\d{2}|\d{2}-\d{2})', '', desc, flags=re.IGNORECASE)

    # 6. Final cleanup: remove any remaining leading/trailing dashes or spaces
    desc = re.sub(r'^\s*[-–—]\s*', '', desc)        # remove leading -   or – or —
    desc = re.sub(r'\s*[-–—]\s*$', '', desc)        # remove trailing - 

    # 7. Return cleaned, normalized string
    return desc.strip()

@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    account_id: Optional[int] = Query(None, description="Optional account ID to assign to all transactions"),  # NEW
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files supported")

    logger.info(f"Received upload - filename: {file.filename}, account_id from query: {account_id}")

    content = await file.read()
    try:
        new_transactions = process_csv(content.decode('utf-8'), db, account_id)  # NEW: Pass account_id
    except UnicodeDecodeError:
        # Fallback for Windows-1252 or other encodings
        new_transactions = process_csv(content.decode('windows-1252', errors='ignore'), db, account_id)

    if not new_transactions:
        return {
            "status": "success",
            "message": "No new transactions found (all duplicates skipped)",
            "new": 0,
            "duplicates": 0,
            "categorized": 0
        }

    # Send to AI for categorization (only new ones)
    categorized = categorize_transactions(new_transactions, user_id=1, db=db)

    added_count = 0
    for t in categorized:
        new_t = Transaction(
            user_id=1,
            date=t['date'],
            description=t['description'],
            original_description=t.get('original_description'),
            amount=t['amount'],
            category_id=t['category_id'],
            account_id=t.get('account_id')  # NEW
        )
        db.add(new_t)
        added_count += 1

    db.commit()

    return {
        "status": "success",
        "new": added_count,
        "duplicates": len(df) - added_count if 'df' in locals() else 0,
        "categorized": added_count
    }

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == 1)
        .options(
            joinedload(Transaction.category),
            joinedload(Transaction.account)
        )
        .order_by(Transaction.date.desc())
        .all()
    )
    
    # Return the list directly — Pydantic will now serialize each Transaction
    # using TransactionResponse, which triggers the @computed_field
    return transactions
    
@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    db: Session = Depends(get_db)
):
    t = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == 1
    ).first()

    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    old_category_id = t.category_id
    t.category_id = update.category_id
    if update.account_id is not None:  # NEW: Update account if provided
        t.account_id = update.account_id
    t.is_manual_override = True

    db.commit()
    db.refresh(t)

    # Cascade to similar transactions using fuzzy matching
    if old_category_id != update.category_id:
        # Get all transactions for this user
        all_trans = db.query(Transaction).filter(Transaction.user_id == 1).all()

        # Normalize the updated transaction's description
        norm_desc = normalize_vendor(t.description)

        # Find similar transactions
        similar_ids = []
        for trans in all_trans:
            if trans.id != transaction_id:
                norm_trans = normalize_vendor(trans.description)
                similarity = fuzz.ratio(norm_desc, norm_trans)
                if similarity >= 80:  # Threshold – 80% similarity (adjust if needed)
                    similar_ids.append(trans.id)

        if similar_ids:
            updated_count = db.query(Transaction).filter(
                Transaction.id.in_(similar_ids)
            ).update({
                Transaction.category_id: update.category_id,
                Transaction.is_manual_override: True
            })
            db.commit()

            logger.info(
                f"Cascaded category change for '{t.description}' "
                f"(normalized: '{norm_desc}') from {old_category_id} to {update.category_id} "
                f"(affected {updated_count} other similar transactions, threshold 80%)"
            )
        else:
            logger.debug(f"No similar transactions found for '{t.description}'")

    return t

@router.get("/summary")
def get_transaction_summary(db: Session = Depends(get_db)):
    results = db.execute(text("""
        SELECT c.name, c.type, SUM(t.amount) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = 1
        GROUP BY c.id, c.name, c.type
    """)).fetchall()

    income = [{"category": r.name, "total": abs(r.total)} for r in results if r.type == 'income' and r.total > 0]
    expense = [{"category": r.name, "total": abs(r.total)} for r in results if r.type == 'expense' and r.total < 0]

    return {"income": income, "expense": expense}

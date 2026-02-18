# backend/app/routers/transactions.py (full updated file – deduplication + flexible parsing)
# - Deduplicates on date + description + amount
# - Only new transactions sent to AI
# - Returns detailed counts
# - Production-ready: efficient query, clear response
# - Preprocess descriptions: remove common leading phrases like "CONTACTLESS INTERAC PURCHASE"
# - Now calls the new process_csv helper in /upload

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text, and_
from app.database import get_db
from app.models import Transaction, Category
from app.schemas import TransactionResponse, TransactionCreate, TransactionUpdate
from app.agents.transaction_categorizer import categorize_transactions
from typing import List
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
    amount_keywords = ['amount', 'amt', 'transaction amount', 'value', 'cad$', 'usd$']
    debit_keywords = ['debit', 'dr', 'withdrawal', 'out']
    credit_keywords = ['credit', 'cr', 'deposit', 'in']

    # Try single amount first
    for keyword in amount_keywords:
        for clean, orig in cols.items():
            if keyword in clean:
                mapping['amount'] = orig
                break
        if 'amount' in mapping:
            break

    # Fallback to debit/credit or currency split
    if 'amount' not in mapping:
        debit_col = None
        credit_col = None
        cad_col = None
        usd_col = None

        for clean, orig in cols.items():
            if any(k in clean for k in debit_keywords):
                debit_col = orig
            if any(k in clean for k in credit_keywords):
                credit_col = orig
            if 'cad$' in clean or 'cad' in clean:
                cad_col = orig
            if 'usd$' in clean or 'usd' in clean:
                usd_col = orig

        if cad_col or usd_col:
            # Prefer CAD if present, else USD
            mapping['amount'] = cad_col or usd_col
        elif debit_col and credit_col:
            mapping['debit'] = debit_col
            mapping['credit'] = credit_col
        elif debit_col:
            mapping['debit'] = debit_col
        elif credit_col:
            mapping['credit'] = credit_col

    logger.info(f"Detected CSV columns: {mapping}")
    logger.info(f"All raw columns: {list(df.columns)}")

    # Validation
    has_date = 'date' in mapping
    has_desc = 'description' in mapping
    has_amount = 'amount' in mapping or ('debit' in mapping or 'credit' in mapping)

    if not (has_date and has_desc and has_amount):
        missing = []
        if not has_date: missing.append('date')
        if not has_desc: missing.append('description')
        if not has_amount: missing.append('amount/debit/credit')
        raise HTTPException(
            400,
            f"CSV missing required columns: {', '.join(missing)}. "
            f"Found columns: {list(df.columns)}. "
            f"Detected: {mapping}"
        )

    return mapping
    
def clean_description(desc: str) -> str:
    """Remove common leading bank phrases and extra spaces."""
    desc = desc.strip()
    prefixes = [
        "CONTACTLESS INTERAC PURCHASE",
        "INTERAC PURCHASE",
        "DEBIT PURCHASE",
        "POS PURCHASE",
        "PRE AUTHORIZED DEBIT",
        "E-TRANSFER SENT",
        "E-TRANSFER RECEIVED",
        "INTERAC E-TRANSFER",
        "ONLINE TRANSFER",
        "WITHDRAWAL",
        "DEPOSIT",
    ]
    for prefix in prefixes:
        desc = re.sub(rf"^{prefix}\s*", "", desc, flags=re.IGNORECASE)
    desc = re.sub(r"\s*-\s*", " ", desc)  # Remove " - " separators
    desc = re.sub(r'\s+', ' ', desc)  # Normalize spaces
    return desc.strip()

def normalize_vendor(desc: str) -> str:
    """Extract core vendor name by removing numbers/codes (e.g., '7805 BAYVIEW COURT' → 'bayview court')"""
    desc = re.sub(r'\d+\s*', '', desc)           # remove numbers like 7805
    desc = re.sub(r'\s*[A-Z]\s*$', '', desc)     # remove trailing single letters like " C"
    desc = re.sub(r'\s+', ' ', desc).strip()     # normalize spaces
    return desc.lower()

def process_csv(file: UploadFile, db: Session) -> dict:
    content = file.file.read().decode('utf-8')
    df = pd.read_csv(StringIO(content))

    mapping = detect_columns(df)
    if not all(k in mapping for k in ['date', 'description', 'amount']):
        raise HTTPException(400, "CSV must have date, description, and amount columns")

    df['date'] = pd.to_datetime(df[mapping['date']], errors='coerce')
    df['description'] = df[mapping['description']].astype(str).apply(clean_description)
    df['amount'] = pd.to_numeric(df[mapping['amount']], errors='coerce')
    df = df.dropna(subset=['date', 'description', 'amount'])

    # Dedup check
    existing = db.execute(text("""
        SELECT date, description, amount
        FROM transactions WHERE user_id = 1
    """)).fetchall()
    existing_set = {(e.date, e.description, e.amount) for e in existing}

    new_df = df[~df.apply(lambda r: (r.date, r.description, r.amount) in existing_set, axis=1)]

    new_transactions = new_df.to_dict('records')
    categorized = categorize_transactions(new_transactions, 1, db)

    inserted = []
    for t in categorized:
        trans = Transaction(
            user_id=1,
            date=t['date'],
            description=t['description'],  # cleaned version
            amount=t['amount'],
            original_description=t.get('original_description', t['description']),
            category_id=t['category_id']
        )
        db.add(trans)
        inserted.append(trans)

    db.commit()

    return {
        "processed": len(df),
        "new": len(new_df),
        "skipped": len(df) - len(new_df),
        "categorized": len(categorized)
    }

@router.post("/upload")
def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(400, "CSV file required")

    results = process_csv(file, db)
    return results

@router.get("/", response_model=List[TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    return db.query(Transaction).filter(Transaction.user_id == 1).order_by(Transaction.date.desc()).all()

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


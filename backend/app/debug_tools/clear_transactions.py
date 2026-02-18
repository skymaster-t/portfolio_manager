# app/debug_tools/clear_transactions.py (fixed – works from current location inside app/)
# - Adds backend root to sys.path (fixes "No module named 'app'" when run from inside app package)
# - Safety: refuses to run in production
# - Deletes all transactions for user_id=1

import os
import sys
from pathlib import Path

# Add backend root to Python path
backend_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_root))

from app.database import SessionLocal
from app.models import Transaction

# Safety check – prevent accidental run in production
if os.getenv("ENV") == "production":
    raise Exception("ERROR: This script is for development only – refusing to run in production")

db = SessionLocal()
try:
    deleted_count = db.query(Transaction).filter(Transaction.user_id == 1).delete()
    db.commit()
    print(f"Successfully deleted {deleted_count} transactions for user_id=1")
except Exception as e:
    db.rollback()
    print(f"Error deleting transactions: {e}")
finally:
    db.close()
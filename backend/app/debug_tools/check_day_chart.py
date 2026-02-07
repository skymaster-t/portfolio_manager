# check_day_chart.py
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")  # e.g., postgresql://user:pass@localhost/db

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT COUNT(*) AS holdings_with_chart,
               COUNT(*) FILTER (WHERE jsonb_array_length(day_chart) > 0) AS holdings_with_data
        FROM holdings
        WHERE day_chart IS NOT NULL
    """))
    row = result.fetchone()
    print(f"Holdings with chart column: {row[0]}")
    print(f"Holdings with actual points: {row[1]}")

    # Sample one
    sample = conn.execute(text("""
        SELECT symbol, jsonb_array_length(day_chart) AS points
        FROM holdings
        WHERE day_chart IS NOT NULL AND jsonb_array_length(day_chart) > 0
        LIMIT 1
    """)).fetchone()
    if sample:
        print(f"Sample {sample[0]} has {sample[1]} points")
    else:
        print("No holdings with chart data yet")
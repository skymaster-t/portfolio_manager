import os
import sys
# Add the backend directory to Python path (parent of scripts/)
sys.path.append(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models import User, Portfolio
import hashlib  # Placeholder hash (replace with proper bcrypt later)

# Session factory
Session = sessionmaker(bind=engine)
session = Session()

try:
    # Check if default user already exists
    existing_user = session.query(User).filter_by(email="default@example.com").first()
    if existing_user:
        print(f"Default user already exists (ID: {existing_user.id}). Skipping creation.")
    else:
        # Create default user (dummy password hash)
        dummy_password = "temp_password"  # Change when auth is implemented
        hashed = hashlib.sha256(dummy_password.encode()).hexdigest()

        default_user = User(
            email="default@example.com",
            hashed_password=hashed
        )
        session.add(default_user)
        session.commit()
        print(f"Created default user: {default_user.email} (ID: {default_user.id})")

        # Create default portfolio for the user
        default_portfolio = Portfolio(
            name="Default Portfolio",
            user_id=default_user.id
        )
        session.add(default_portfolio)
        session.commit()
        print(f"Created default portfolio: '{default_portfolio.name}' (ID: {default_portfolio.id}) for user ID {default_user.id}")

    print("Database seeding complete!")

except Exception as e:
    session.rollback()
    print(f"Error during seeding: {e}")
finally:
    session.close()
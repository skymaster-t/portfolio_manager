# backend/app/models.py (updated – added history models for per-portfolio and global snapshots)
from sqlalchemy import (
    Column, 
    Integer, 
    String, 
    Float, 
    ForeignKey, 
    Enum, 
    Table, 
    Boolean, 
    DateTime
)
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import enum
from sqlalchemy.dialects.postgresql import JSONB

class HoldingType(enum.Enum):
    stock = "stock"
    etf = "etf"

class Currency(enum.Enum):
    CAD = "CAD"
    USD = "USD"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    portfolios = relationship("Portfolio", back_populates="user")

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    display_order = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="portfolios")
    holdings = relationship("Holding", back_populates="portfolio")
    history = relationship("PortfolioHistory", back_populates="portfolio")

class Holding(Base):
    __tablename__ = "holdings"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    type = Column(Enum(HoldingType))
    quantity = Column(Float)
    purchase_price = Column(Float)
    current_price = Column(Float, nullable=True)
    
    # All-time (from purchase to current)
    all_time_change_percent = Column(Float, nullable=True)
    market_value = Column(Float, nullable=True)
    all_time_gain_loss = Column(Float, nullable=True)
    
    # Daily from FMP/Yahoo
    daily_change = Column(Float, nullable=True)
    daily_change_percent = Column(Float, nullable=True)
    
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))

    currency = Column(Enum(Currency), nullable=False, server_default=Currency.USD.value)

    day_chart = Column(JSONB, nullable=True, server_default='[]')

    dividend_annual_per_share = Column(Float, nullable=True)
    dividend_yield_percent = Column(Float, nullable=True)
    is_dividend_manual = Column(Boolean, default=False, nullable=False)

    portfolio = relationship("Portfolio", back_populates="holdings")
    underlyings = relationship("UnderlyingHolding", back_populates="holding")
    last_price_update = Column(DateTime, nullable=True)

class UnderlyingHolding(Base):
    __tablename__ = "underlying_holdings"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String)
    allocation_percent = Column(Float, nullable=True)
    holding_id = Column(Integer, ForeignKey("holdings.id", ondelete="CASCADE"))

    holding = relationship("Holding", back_populates="underlyings")

# NEW: Per-portfolio history snapshots
class PortfolioHistory(Base):
    __tablename__ = "portfolio_history"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    total_value = Column(Float)  # current market value
    daily_change = Column(Float)  # dollar change today
    daily_percent = Column(Float)  # % change today
    all_time_gain = Column(Float)  # total gain since inception
    all_time_percent = Column(Float)  # % return since inception

    portfolio = relationship("Portfolio", back_populates="history")

class GlobalHistory(Base):
    __tablename__ = "global_history"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    total_value = Column(Float)
    daily_change = Column(Float)
    daily_percent = Column(Float)
    all_time_gain = Column(Float)
    all_time_percent = Column(Float)

    # Flag to mark true end-of-day snapshots (for clean daily graphs)
    is_eod = Column(Boolean, default=False, server_default="false")

class SymbolSectorCache(Base):
    __tablename__ = "symbol_sector_cache"

    symbol = Column(String, primary_key=True, index=True)
    weightings = Column(JSONB, nullable=False)  # List[dict(sector=str, weight=float)]
    last_updated = Column(DateTime, default=datetime.utcnow)

    class Config:
        from_attributes = True

class BudgetItem(Base):
    __tablename__ = "budget_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_type = Column(String, nullable=False)  # 'income' or 'expense'
    name = Column(String, nullable=False)
    amount_monthly = Column(Float, nullable=False)
    category = Column(String, nullable=True)


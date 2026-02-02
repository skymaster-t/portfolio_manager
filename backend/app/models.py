# backend/app/models.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, Table, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class HoldingType(enum.Enum):
    stock = "stock"
    etf = "etf"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # Future: username, full_name, etc.

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
    
    # Daily from FMP
    daily_change = Column(Float, nullable=True)
    daily_change_percent = Column(Float, nullable=True)
    
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))

    portfolio = relationship("Portfolio", back_populates="holdings")
    underlyings = relationship("UnderlyingHolding", back_populates="holding")

class UnderlyingHolding(Base):
    __tablename__ = "underlying_holdings"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String)
    allocation_percent = Column(Float, nullable=True)  # NEW
    holding_id = Column(Integer, ForeignKey("holdings.id", ondelete="CASCADE"))

    holding = relationship("Holding", back_populates="underlyings")
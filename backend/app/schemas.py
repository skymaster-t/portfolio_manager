# backend/app/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class HoldingType(str, Enum):
    stock = "stock"
    etf = "etf"

class UnderlyingBase(BaseModel):
    symbol: str

class UnderlyingCreate(UnderlyingBase):
    pass

class Underlying(UnderlyingBase):
    id: int

    class Config:
        from_attributes = True

class HoldingBase(BaseModel):
    symbol: str
    type: HoldingType = HoldingType.etf
    quantity: float
    purchase_price: float

class HoldingCreate(HoldingBase):
    underlyings: Optional[List[UnderlyingCreate]] = []

class HoldingUpdate(HoldingBase):
    symbol: Optional[str] = None
    type: Optional[HoldingType] = None
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    underlyings: Optional[List[UnderlyingCreate]] = None

class HoldingResponse(HoldingBase):
    id: int
    current_price: Optional[float] = None
    
    # All-time (from purchase to current)
    all_time_change_percent: Optional[float] = None
    market_value: Optional[float] = None
    all_time_gain_loss: Optional[float] = None
    
    # Daily from FMP
    daily_change: Optional[float] = None
    daily_change_percent: Optional[float] = None
    
    underlyings: List[Underlying] = []

    class Config:
        from_attributes = True
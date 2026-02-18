from pydantic import BaseModel
from typing import Optional, List
from enum import Enum
from datetime import datetime

class HoldingType(str, Enum):
    stock = "stock"
    etf = "etf"

class Currency(str, Enum):
    CAD = "CAD"
    USD = "USD"

class UnderlyingBase(BaseModel):
    symbol: str

class UnderlyingCreate(BaseModel):
    symbol: str
    allocation_percent: Optional[float] = None

class Underlying(UnderlyingBase):
    id: int
    allocation_percent: Optional[float] = None

    class Config:
        from_attributes = True

class UnderlyingDetail(BaseModel):
    symbol: str
    allocation_percent: Optional[float] = None
    current_price: Optional[float] = None
    daily_change: Optional[float] = None
    daily_change_percent: Optional[float] = None

class HoldingBase(BaseModel):
    symbol: str
    type: HoldingType = HoldingType.etf
    quantity: float
    purchase_price: float
    portfolio_id: int
    currency: Optional[Currency] = None

class HoldingCreate(HoldingBase):
    underlyings: Optional[List[UnderlyingCreate]] = []
    portfolio_id: int
    currency: Optional[Currency] = None

class HoldingUpdate(BaseModel):
    symbol: Optional[str] = None
    type: Optional[HoldingType] = None
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    portfolio_id: Optional[int] = None
    underlyings: Optional[List[UnderlyingCreate]] = None
    currency: Optional[Currency] = None

class DayPoint(BaseModel):
    time: int
    price: float

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

    last_price_update: Optional[datetime] = None
    currency: Currency
    
    underlyings: List[Underlying] = []
    underlying_details: List[UnderlyingDetail] = []

    day_chart: Optional[List[DayPoint]] = None

    class Config:
        from_attributes = True

class PortfolioBase(BaseModel):
    name: str

class PortfolioCreate(PortfolioBase):
    is_default: bool = False

class PortfolioResponse(PortfolioBase):
    id: int
    is_default: bool
    user_id: int

    class Config:
        from_attributes = True

class PortfolioHistoryResponse(BaseModel):
    portfolio_id: int
    timestamp: datetime
    total_value: float
    daily_change: float
    daily_percent: float
    all_time_gain: float
    all_time_percent: float

    class Config:
        from_attributes = True

class GlobalHistoryResponse(BaseModel):
    timestamp: datetime
    total_value: float
    daily_change: float
    daily_percent: float
    all_time_gain: float
    all_time_percent: float

    class Config:
        from_attributes = True

class PieItem(BaseModel):
    name: str
    value: float

class PortfolioSummary(BaseModel):
    id: int
    name: str
    isDefault: bool
    totalValue: float
    gainLoss: float
    dailyChange: float
    dailyPercent: float
    allTimePercent: float
    pieData: List[PieItem]

    class Config:
        from_attributes = True

class SectorItem(BaseModel):
    sector: str
    value: float
    percentage: float

    class Config:
        from_attributes = True

class GlobalSectorResponse(BaseModel):
    totalValue: float
    sectorData: List[SectorItem]

    class Config:
        from_attributes = True

class ReorderRequest(BaseModel):
    order: List[int]

class CategoryCreate(BaseModel):
    name: str
    type: str  # 'income' or 'expense'

    class Config:
        from_attributes = True

class CategoryResponse(BaseModel):
    id: int
    name: str
    type: str
    is_custom: bool

    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    date: datetime
    description: str
    amount: float
    category_id: int

class ItemType(str, Enum):
    income = "income"
    expense = "expense"

class BudgetItemCreate(BaseModel):
    item_type: ItemType
    name: str
    amount_monthly: float
    category_id: int

class BudgetItemResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    name: str
    amount_monthly: float
    category_id: int
    category: CategoryResponse

    class Config:
        from_attributes = True

class DividendBreakdownItem(BaseModel):
    holding_id: int
    symbol: str
    quantity: float
    dividend_annual_per_share: Optional[float]
    annual_dividends_cad: float
    monthly_dividends_cad: float
    is_manual: bool = False

    class Config:
        from_attributes = True

class BudgetSummaryResponse(BaseModel):
    expected_dividend_income_monthly_cad: float
    expected_dividend_income_annual_cad: float
    dividend_breakdown: List[DividendBreakdownItem]
    other_income_monthly: float
    total_expenses_monthly: float
    total_income_monthly: float
    net_surplus_monthly: float
    income_items: List[BudgetItemResponse]
    expense_items: List[BudgetItemResponse]

class TransactionCreate(BaseModel):
    date: datetime
    description: str
    amount: float
    category_id: int

class TransactionResponse(TransactionCreate):
    id: int
    user_id: int
    original_description: Optional[str] = None
    is_manual_override: bool = False
    category: CategoryResponse

    class Config:
        from_attributes = True

class TransactionUpdate(BaseModel):
    category_id: int
    
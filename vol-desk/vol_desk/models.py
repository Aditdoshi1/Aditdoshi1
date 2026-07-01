"""Data models for gamma scans, filters, regime gates, and positions."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PositionStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    PENDING = "PENDING"
    BLOCKED = "BLOCKED"
    WATCH = "WATCH"
    CLOSED = "CLOSED"


class Track(str, Enum):
    P2P = "P2P"  # pTrans to +GEX mechanical
    B_CONTINUATION = "B_CONTINUATION"


class GEXLevels(BaseModel):
    """Key gamma exposure levels for a single name."""

    symbol: str
    spot: float
    p_trans: float
    n_trans: float
    zero_gex: float
    pos_gex: float  # +GEX target
    neg_gex: Optional[float] = None
    cotmp: float  # Center of Put Mass
    cotmc: Optional[float] = None  # Center of Call Mass
    as_of: date


class GammaScanRow(BaseModel):
    """One row from the nightly gamma screen (700+ name universe)."""

    symbol: str
    spot: float
    levels: GEXLevels
    dealer_delta_balance: float = Field(ge=0, le=1, description="Current dealer delta balance 0-1")
    prior_dealer_delta: float = Field(ge=0, le=1)
    db_change: float = Field(description="dealer_delta_balance - prior_dealer_delta")
    grade: int = Field(ge=0, le=11, description="Structural quality score out of 11")
    grade_deep: bool = Field(default=False, description="Grade 11 DEEP flag")
    oi_depth: float = Field(description="Open interest depth score")
    minervini_score: Optional[float] = None
    call_gex_ratio: Optional[float] = None
    put_gex_ratio: Optional[float] = None
    spike_crash_at_target: bool = False
    scan_date: date


class P2PCandidate(BaseModel):
    """P2P scan row: spot already above pTrans, R/R to +GEX."""

    symbol: str
    spot: float
    p_trans: float
    pos_gex: float
    upside_pct: float
    downside_pct: float
    risk_reward: float
    cushion_to_pos_gex_pct: float
    scan_row: GammaScanRow


class FilterResult(BaseModel):
    passed: bool
    reason: str
    details: dict = Field(default_factory=dict)


class RegimeGates(BaseModel):
    """Daily regime overlay before approving new entries."""

    basket_gate: bool = Field(description="SPY or QQQ up > 0.5% on session")
    bull_bear_gate: bool = Field(description="Bull:Bear ratio > 3.0 in universe")
    vix_delta_gate: bool = Field(description="VIX dealer delta negative (bearish vol)")
    hyg_bearish_divergence: bool = False
    gates_passed: int = 0
    as_of: date

    @property
    def p2p_eligible(self) -> bool:
        """P2P Track 1 can run at 2/3 gates on strong setups."""
        return self.gates_passed >= 2

    @property
    def b_continuation_eligible(self) -> bool:
        """B Continuation requires all 3/3."""
        return self.gates_passed >= 3


class EntrySignal(BaseModel):
    symbol: str
    track: Track
    status: PositionStatus
    entry_price: Optional[float] = None
    trigger: str
    filters: list[FilterResult]
    regime: RegimeGates
    scan_row: GammaScanRow
    timestamp: datetime


class OpenPosition(BaseModel):
    symbol: str
    track: Track
    entry_date: date
    entry_price: float
    p_trans: float
    n_trans: float
    pos_gex: float
    cotmc: Optional[float] = None
    status: PositionStatus = PositionStatus.CONFIRMED
    t1_locked: bool = False
    days_held: int = 0
    progress_to_t1_pct: float = 0.0
    daily_progress_pct: list[float] = Field(default_factory=list)

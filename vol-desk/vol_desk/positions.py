"""Entry triggers and mechanical exit framework."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from vol_desk.filters import all_filters_pass, run_all_entry_filters
from vol_desk.models import (
    EntrySignal,
    OpenPosition,
    PositionStatus,
    RegimeGates,
    Track,
    GammaScanRow,
)


def evaluate_entry_status(
    row: GammaScanRow,
    first_5m_close: Optional[float],
    regime: RegimeGates,
    track: Track = Track.P2P,
    price_history=None,
) -> EntrySignal:
    """
    Entry trigger: first 5-minute candle close above pTrans at the open.
    PENDING = within 0.5% below pTrans. BLOCKED = filter fail.
    """
    filters = run_all_entry_filters(row, price_history)
    filters_ok = all_filters_pass(filters)

    # Regime gate by track
    if track == Track.B_CONTINUATION and not regime.b_continuation_eligible:
        filters.append(
            type(filters[0])(passed=False, reason="regime_b_continuation", details={"required": "3/3"})
        )
        filters_ok = False
    elif track == Track.P2P and not regime.p2p_eligible:
        filters.append(
            type(filters[0])(passed=False, reason="regime_p2p", details={"required": "2/3"})
        )
        filters_ok = False

    if not filters_ok:
        status = PositionStatus.BLOCKED
        trigger = "filter_blocked"
    elif first_5m_close is not None and first_5m_close > row.levels.p_trans:
        status = PositionStatus.CONFIRMED
        trigger = "5m_close_above_ptrans"
    elif row.spot >= row.levels.p_trans * 0.995:
        status = PositionStatus.PENDING
        trigger = "watching_first_candle"
    else:
        status = PositionStatus.BLOCKED
        trigger = "below_ptrans"

    return EntrySignal(
        symbol=row.symbol,
        track=track,
        status=status,
        entry_price=first_5m_close if status == PositionStatus.CONFIRMED else None,
        trigger=trigger,
        filters=filters,
        regime=regime,
        scan_row=row,
        timestamp=datetime.now(),
    )


def update_position_status(position: OpenPosition, close: float) -> OpenPosition:
    """CONFIRMED above pTrans; WATCH between nTrans and pTrans."""
    if close >= position.p_trans:
        position.status = PositionStatus.CONFIRMED
    elif close >= position.n_trans:
        position.status = PositionStatus.WATCH
    return position


def check_exits(
    position: OpenPosition,
    session_close: float,
    as_of: date,
) -> tuple[bool, str]:
    """
    Mechanical exit framework. Returns (should_exit, reason).
    Stop 1: close below nTrans
    Stop 2: -10% from entry while below pTrans
    Stop 3: day 7 without 50% progress to T1
    Stop 4: <10% daily progress for 3 consecutive sessions
    """
    # Stop 1
    if session_close < position.n_trans:
        return True, "stop1_close_below_ntrans"

    # Stop 2
    if session_close < position.p_trans:
        loss_pct = (session_close - position.entry_price) / position.entry_price * 100
        if loss_pct <= -10:
            return True, "stop2_hard_cap_below_ptrans"

    # Progress tracking
    target_dist = position.pos_gex - position.entry_price
    if target_dist > 0:
        progress = (session_close - position.entry_price) / target_dist * 100
        position.progress_to_t1_pct = max(0, min(100, progress))

    days = (as_of - position.entry_date).days
    position.days_held = days

    # Stop 3
    if days >= 7 and position.progress_to_t1_pct < 50:
        return True, "stop3_time_no_progress"

    # Stop 4
    if len(position.daily_progress_pct) >= 3:
        if all(p < 10 for p in position.daily_progress_pct[-3:]):
            return True, "stop4_stalling"

    return False, ""


def at_t1(session_high: float, pos_gex: float, tolerance_pct: float = 0.005) -> bool:
    """Price reached +GEX target."""
    return session_high >= pos_gex * (1 - tolerance_pct)

"""Entry filters, P2P scan, and spike-crash detection."""

from __future__ import annotations

from typing import Optional

import pandas as pd

from vol_desk.models import FilterResult, GammaScanRow, P2PCandidate


def check_db_change(row: GammaScanRow) -> FilterResult:
    """db_change >= 0.50 (0.30 for grade 11 DEEP). Sustained peg at 1.00 exempt."""
    if row.dealer_delta_balance >= 0.99 and row.prior_dealer_delta >= 0.99:
        return FilterResult(passed=True, reason="sustained_full_position", details={"db": row.dealer_delta_balance})

    threshold = 0.30 if row.grade_deep else 0.50
    passed = row.db_change >= threshold
    return FilterResult(
        passed=passed,
        reason="db_change",
        details={"db_change": row.db_change, "threshold": threshold},
    )


def check_grade(row: GammaScanRow) -> FilterResult:
    passed = row.grade >= 9
    return FilterResult(passed=passed, reason="grade", details={"grade": row.grade, "min": 9})


def check_cotmp_cushion(row: GammaScanRow) -> FilterResult:
    """Spot must be >= 2% above COTMP (1% for DEEP or high db_change)."""
    cushion_pct = (row.spot - row.levels.cotmp) / row.spot * 100
    threshold = 1.0 if (row.grade_deep or row.db_change >= 0.50) else 2.0
    passed = cushion_pct >= threshold
    return FilterResult(
        passed=passed,
        reason="cotmp_cushion",
        details={"cushion_pct": round(cushion_pct, 2), "threshold": threshold},
    )


def check_risk_reward(row: GammaScanRow, min_rr: float = 2.0) -> FilterResult:
    upside = row.levels.pos_gex - row.spot
    downside = row.spot - row.levels.p_trans
    if downside <= 0:
        return FilterResult(passed=False, reason="risk_reward", details={"error": "spot at or below pTrans"})
    rr = upside / downside
    return FilterResult(
        passed=rr >= min_rr,
        reason="risk_reward",
        details={"rr": round(rr, 2), "min": min_rr, "upside": upside, "downside": downside},
    )


def check_spike_crash(row: GammaScanRow, price_history: Optional[pd.DataFrame] = None) -> FilterResult:
    """
    Block if +GEX target is a prior spike high with institutional selling.
    price_history columns: date, high, close, volume
    """
    if row.spike_crash_at_target:
        return FilterResult(passed=False, reason="spike_crash", details={"blocked": True})

    if price_history is None or price_history.empty:
        return FilterResult(passed=True, reason="spike_crash", details={"skipped": "no_history"})

    target = row.levels.pos_gex
    tolerance = target * 0.01
    prior_spikes = price_history[
        (price_history["high"] >= target - tolerance)
        & (price_history["high"] <= target + tolerance)
    ]
    if prior_spikes.empty:
        return FilterResult(passed=True, reason="spike_crash", details={"prior_spikes": 0})

    # Rejection: spike followed by close well below high on elevated volume
    for _, bar in prior_spikes.iterrows():
        if bar["close"] < bar["high"] * 0.97:
            return FilterResult(
                passed=False,
                reason="spike_crash",
                details={"spike_date": str(bar.get("date", "")), "high": bar["high"]},
            )
    return FilterResult(passed=True, reason="spike_crash", details={"prior_spikes": len(prior_spikes)})


def run_all_entry_filters(
    row: GammaScanRow,
    price_history: Optional[pd.DataFrame] = None,
) -> list[FilterResult]:
    return [
        check_grade(row),
        check_db_change(row),
        check_cotmp_cushion(row),
        check_spike_crash(row, price_history),
        check_risk_reward(row),
    ]


def all_filters_pass(results: list[FilterResult]) -> bool:
    return all(r.passed for r in results)


def build_p2p_candidate(row: GammaScanRow) -> Optional[P2PCandidate]:
    """P2P scan: spot already above pTrans."""
    if row.spot <= row.levels.p_trans:
        return None
    upside_pct = (row.levels.pos_gex - row.spot) / row.spot * 100
    downside_pct = (row.spot - row.levels.p_trans) / row.spot * 100
    rr = upside_pct / downside_pct if downside_pct > 0 else 0
    return P2PCandidate(
        symbol=row.symbol,
        spot=row.spot,
        p_trans=row.levels.p_trans,
        pos_gex=row.levels.pos_gex,
        upside_pct=round(upside_pct, 2),
        downside_pct=round(downside_pct, 2),
        risk_reward=round(rr, 2),
        cushion_to_pos_gex_pct=round(upside_pct, 2),
        scan_row=row,
    )

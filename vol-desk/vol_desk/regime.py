"""Daily regime gates and market overlay checks."""

from __future__ import annotations

from datetime import date

from vol_desk.models import RegimeGates


def compute_regime_gates(
    spy_change_pct: float,
    qqq_change_pct: float,
    bull_count: int,
    bear_count: int,
    vix_dealer_delta: float,
    hyg_bearish: bool = False,
    as_of: date | None = None,
) -> RegimeGates:
    """
    Three gates before approving new entries:
    1. Basket — SPY or QQQ up > 0.5%
    2. Bull:Bear — ratio > 3.0 in full universe
    3. VIX delta — dealer positioning bearish on vol (negative)
    """
    basket = spy_change_pct > 0.5 or qqq_change_pct > 0.5
    ratio = bull_count / max(bear_count, 1)
    bull_bear = ratio > 3.0
    vix_gate = vix_dealer_delta < 0

    passed = sum([basket, bull_bear, vix_gate])

    return RegimeGates(
        basket_gate=basket,
        bull_bear_gate=bull_bear,
        vix_delta_gate=vix_gate,
        hyg_bearish_divergence=hyg_bearish,
        gates_passed=passed,
        as_of=as_of or date.today(),
    )


def classify_universe_bull_bear(scan_rows: list) -> tuple[int, int]:
    """
    Classify names as bull or bear from gamma scan.
    Bull: spot > pTrans and db_change >= 0. Bear: spot < nTrans or db_change < 0.
    """
    bulls = bears = 0
    for row in scan_rows:
        if row.spot > row.levels.p_trans and row.db_change >= 0:
            bulls += 1
        elif row.spot < row.levels.n_trans or row.db_change < 0:
            bears += 1
    return bulls, bears

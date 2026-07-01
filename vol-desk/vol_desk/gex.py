"""GEX computation and level extraction from options chain snapshots."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

import numpy as np
import pandas as pd

from vol_desk.models import GEXLevels

CONTRACT_MULTIPLIER = 100
# Dealers are typically short customer gamma; sign convention matches dealer exposure.
DEALER_SIGN = -1


@dataclass
class ChainSnapshot:
    """Single-day options chain for one underlying."""

    symbol: str
    spot: float
    as_of: date
    # columns: strike, expiration, option_type (call/put), open_interest, gamma, delta
    contracts: pd.DataFrame


def compute_strike_gex(
    gamma: float,
    open_interest: int,
    spot: float,
    is_call: bool,
) -> float:
    """
    Per-strike gamma exposure.
    GEX = gamma * OI * 100 * spot^2 * dealer_sign * call_put_sign
    """
    call_put_sign = 1 if is_call else -1
    return (
        gamma
        * open_interest
        * CONTRACT_MULTIPLIER
        * (spot**2)
        * DEALER_SIGN
        * call_put_sign
        * 0.01  # scale to readable units
    )


def build_gex_surface(chain: ChainSnapshot) -> pd.DataFrame:
    """Aggregate GEX by strike across all expirations."""
    df = chain.contracts.copy()
    df["is_call"] = df["option_type"].str.lower() == "call"
    df["gex"] = df.apply(
        lambda r: compute_strike_gex(
            r["gamma"], int(r["open_interest"]), chain.spot, r["is_call"]
        ),
        axis=1,
    )
    df["dex"] = df["delta"] * df["open_interest"] * CONTRACT_MULTIPLIER * DEALER_SIGN

    surface = (
        df.groupby("strike", as_index=False)
        .agg(net_gex=("gex", "sum"), net_dex=("dex", "sum"), total_oi=("open_interest", "sum"))
        .sort_values("strike")
    )
    return surface


def _find_transition_zone(surface: pd.DataFrame, spot: float) -> tuple[float, float, float]:
    """
    Find pTrans (top of transition), nTrans (bottom), zeroGEX (flip point).
    Transition zone = strikes where net GEX crosses zero near spot.
    """
    strikes = surface["strike"].values
    gex = surface["net_gex"].values

    if len(strikes) < 3:
        mid = float(strikes[len(strikes) // 2]) if len(strikes) else spot
        return mid * 0.98, mid, mid * 1.02

    # Find zero crossing closest to spot
    signs = np.sign(gex)
    crossings = np.where(np.diff(signs) != 0)[0]
    zero_strike = spot
    if len(crossings):
        idx = crossings[np.argmin(np.abs(strikes[crossings] - spot))]
        zero_strike = float((strikes[idx] + strikes[idx + 1]) / 2)

    above = surface[surface["strike"] >= zero_strike]
    below = surface[surface["strike"] <= zero_strike]

    pos_gex_strike = float(above.loc[above["net_gex"].idxmax(), "strike"]) if len(above) else zero_strike * 1.05
    neg_gex_strike = float(below.loc[below["net_gex"].idxmin(), "strike"]) if len(below) else zero_strike * 0.95

    # pTrans = first strike above spot where call gamma dominates (positive net GEX band starts)
    above_spot = surface[surface["strike"] > spot]
    positive_above = above_spot[above_spot["net_gex"] > 0]
    p_trans = float(positive_above["strike"].min()) if len(positive_above) else zero_strike

    # nTrans = last strike below spot in negative GEX territory
    below_spot = surface[surface["strike"] < spot]
    negative_below = below_spot[below_spot["net_gex"] < 0]
    n_trans = float(negative_below["strike"].max()) if len(negative_below) else zero_strike

    return p_trans, n_trans, zero_strike


def _center_of_mass(strikes: np.ndarray, weights: np.ndarray) -> float:
    w = np.maximum(weights, 0)
    if w.sum() == 0:
        return float(np.median(strikes))
    return float(np.average(strikes, weights=w))


def extract_levels(chain: ChainSnapshot) -> GEXLevels:
    """Extract pTrans, nTrans, zeroGEX, +GEX, COTMP, COTMC from chain snapshot."""
    surface = build_gex_surface(chain)
    df = chain.contracts.copy()
    df["is_call"] = df["option_type"].str.lower() == "call"

    p_trans, n_trans, zero_gex = _find_transition_zone(surface, chain.spot)

    above_spot = surface[surface["strike"] >= chain.spot]
    pos_gex = float(above_spot.loc[above_spot["net_gex"].idxmax(), "strike"]) if len(above_spot) else p_trans * 1.05

    below_spot = surface[surface["strike"] <= chain.spot]
    neg_gex = float(below_spot.loc[below_spot["net_gex"].idxmin(), "strike"]) if len(below_spot) else n_trans * 0.95

    puts = df[~df["is_call"]]
    calls = df[df["is_call"]]
    cotmp = _center_of_mass(puts["strike"].values, puts["open_interest"].values)
    cotmc = _center_of_mass(calls["strike"].values, calls["open_interest"].values)

    return GEXLevels(
        symbol=chain.symbol,
        spot=chain.spot,
        p_trans=p_trans,
        n_trans=n_trans,
        zero_gex=zero_gex,
        pos_gex=pos_gex,
        neg_gex=neg_gex,
        cotmp=cotmp,
        cotmc=cotmc,
        as_of=chain.as_of,
    )


def dealer_delta_balance(surface: pd.DataFrame, spot: float) -> float:
    """
    Normalized dealer delta balance 0-1.
    1.0 = fully call-dominated / bullish dealer positioning.
    """
    total_dex = surface["net_dex"].abs().sum()
    if total_dex == 0:
        return 0.5
    above = surface[surface["strike"] >= spot]["net_dex"].sum()
    below = surface[surface["strike"] < spot]["net_dex"].sum()
    # Bullish when dealers are long delta above spot (negative net dex from short puts/calls)
    bullish_component = max(0, -above) + max(0, below)
    return min(1.0, max(0.0, bullish_component / total_dex))

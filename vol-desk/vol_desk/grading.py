"""11-rule structural grading for gamma setups."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from vol_desk.gex import ChainSnapshot, build_gex_surface
from vol_desk.models import GEXLevels


@dataclass
class GradeBreakdown:
    score: int
    rules: dict[str, bool]
    deep: bool


def _rule_call_gex_dominance_above(surface: pd.DataFrame, spot: float) -> bool:
    above = surface[surface["strike"] > spot]
    return bool((above["net_gex"] > 0).sum() > len(above) * 0.5) if len(above) else False


def _rule_put_gex_contained_below(surface: pd.DataFrame, spot: float) -> bool:
    below = surface[surface["strike"] < spot]
    return bool((below["net_gex"] <= 0).sum() > len(below) * 0.5) if len(below) else False


def _rule_oi_depth(chain: ChainSnapshot, min_oi: int = 5000) -> bool:
    return int(chain.contracts["open_interest"].sum()) >= min_oi


def _rule_spot_above_zero_gex(levels: GEXLevels) -> bool:
    return levels.spot > levels.zero_gex


def _rule_p_trans_below_pos_gex(levels: GEXLevels) -> bool:
    return levels.p_trans < levels.pos_gex


def _rule_cotmp_below_spot(levels: GEXLevels) -> bool:
    return levels.cotmp < levels.spot


def _rule_pos_gex_above_spot(levels: GEXLevels) -> bool:
    return levels.pos_gex > levels.spot


def _rule_transition_width_reasonable(levels: GEXLevels, max_pct: float = 0.08) -> bool:
    width = (levels.p_trans - levels.n_trans) / levels.spot
    return 0 < width <= max_pct


def _rule_call_oi_exceeds_put(chain: ChainSnapshot) -> bool:
    df = chain.contracts.copy()
    calls = df[df["option_type"].str.lower() == "call"]["open_interest"].sum()
    puts = df[df["option_type"].str.lower() == "put"]["open_interest"].sum()
    return calls > puts


def _rule_gamma_flip_near_spot(levels: GEXLevels, tolerance_pct: float = 0.03) -> bool:
    return abs(levels.zero_gex - levels.spot) / levels.spot <= tolerance_pct


def _rule_no_neg_gex_between_spot_and_target(levels: GEXLevels, surface: pd.DataFrame) -> bool:
    band = surface[(surface["strike"] > levels.spot) & (surface["strike"] < levels.pos_gex)]
    return bool((band["net_gex"] >= 0).all()) if len(band) else True


def grade_setup(chain: ChainSnapshot, levels: GEXLevels) -> GradeBreakdown:
    """
    Score setup 0-11 across structural rules.
    Grade >= 9 required for portfolio entry.
    """
    surface = build_gex_surface(chain)
    rules = {
        "call_gex_dominance_above": _rule_call_gex_dominance_above(surface, chain.spot),
        "put_gex_contained_below": _rule_put_gex_contained_below(surface, chain.spot),
        "oi_depth": _rule_oi_depth(chain),
        "spot_above_zero_gex": _rule_spot_above_zero_gex(levels),
        "p_trans_below_pos_gex": _rule_p_trans_below_pos_gex(levels),
        "cotmp_below_spot": _rule_cotmp_below_spot(levels),
        "pos_gex_above_spot": _rule_pos_gex_above_spot(levels),
        "transition_width_reasonable": _rule_transition_width_reasonable(levels),
        "call_oi_exceeds_put": _rule_call_oi_exceeds_put(chain),
        "gamma_flip_near_spot": _rule_gamma_flip_near_spot(levels),
        "clean_path_to_pos_gex": _rule_no_neg_gex_between_spot_and_target(levels, surface),
    }
    score = sum(rules.values())
    deep = score == 11 and rules["oi_depth"] and rules["clean_path_to_pos_gex"]
    return GradeBreakdown(score=score, rules=rules, deep=deep)

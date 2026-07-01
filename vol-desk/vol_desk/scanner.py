"""Nightly scan orchestration: gamma screen + P2P candidates."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

from vol_desk.data import build_gamma_scan_row, gamma_screen_to_dataframe, load_universe_snapshot
from vol_desk.filters import build_p2p_candidate, run_all_entry_filters, all_filters_pass
from vol_desk.models import GammaScanRow, P2PCandidate, RegimeGates
from vol_desk.regime import classify_universe_bull_bear, compute_regime_gates


def run_gamma_screen(
    data_dir: Path,
    as_of: date,
    spot_map: dict[str, float],
    prior_db_map: dict[str, float] | None = None,
    minervini_map: dict[str, float] | None = None,
) -> list[GammaScanRow]:
    """Build the master gamma screen for all names with chain data."""
    prior_db_map = prior_db_map or {}
    minervini_map = minervini_map or {}
    chains = load_universe_snapshot(data_dir, as_of, spot_map)
    rows: list[GammaScanRow] = []
    for chain in chains:
        rows.append(
            build_gamma_scan_row(
                chain,
                prior_db=prior_db_map.get(chain.symbol),
                minervini_score=minervini_map.get(chain.symbol),
            )
        )
    return rows


def run_p2p_scan(rows: list[GammaScanRow]) -> list[P2PCandidate]:
    """Filtered list: spot above pTrans with R/R computed."""
    candidates: list[P2PCandidate] = []
    for row in rows:
        c = build_p2p_candidate(row)
        if c and c.risk_reward >= 2.0:
            candidates.append(c)
    return sorted(candidates, key=lambda x: x.risk_reward, reverse=True)


def filter_tradeable(
    rows: list[GammaScanRow],
    regime: RegimeGates,
    require_all_filters: bool = True,
) -> list[GammaScanRow]:
    """Apply five entry filters to gamma screen."""
    tradeable: list[GammaScanRow] = []
    for row in rows:
        results = run_all_entry_filters(row)
        if require_all_filters and not all_filters_pass(results):
            continue
        if not regime.p2p_eligible and row.grade < 11:
            continue
        tradeable.append(row)
    return tradeable


def export_nightly_scan(
    output_dir: Path,
    as_of: date,
    gamma_rows: list[GammaScanRow],
    p2p: list[P2PCandidate],
    regime: RegimeGates,
) -> tuple[Path, Path]:
    """Write gamma_screen.csv and p2p_scan.csv for Claude review."""
    output_dir.mkdir(parents=True, exist_ok=True)
    gamma_path = output_dir / f"gamma_screen_{as_of}.csv"
    p2p_path = output_dir / f"p2p_scan_{as_of}.csv"

    gamma_screen_to_dataframe(gamma_rows).to_csv(gamma_path, index=False)

    p2p_records = [
        {
            "symbol": c.symbol,
            "spot": c.spot,
            "p_trans": c.p_trans,
            "pos_gex": c.pos_gex,
            "upside_pct": c.upside_pct,
            "downside_pct": c.downside_pct,
            "risk_reward": c.risk_reward,
            "grade": c.scan_row.grade,
            "db_change": c.scan_row.db_change,
            "regime_gates": regime.gates_passed,
        }
        for c in p2p
    ]
    pd.DataFrame(p2p_records).to_csv(p2p_path, index=False)
    return gamma_path, p2p_path

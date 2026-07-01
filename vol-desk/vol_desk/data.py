"""Load options chain snapshots from CSV/Parquet (day-over-day collection)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

from vol_desk.gex import ChainSnapshot, dealer_delta_balance, extract_levels, build_gex_surface
from vol_desk.grading import grade_setup
from vol_desk.models import GammaScanRow


REQUIRED_COLUMNS = {
    "strike",
    "expiration",
    "option_type",
    "open_interest",
    "gamma",
    "delta",
}


def load_chain_csv(path: Path, symbol: str, spot: float, as_of: date) -> ChainSnapshot:
    """Load a single symbol's chain snapshot from CSV."""
    df = pd.read_csv(path)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Chain file {path} missing columns: {missing}")
    return ChainSnapshot(symbol=symbol, spot=spot, as_of=as_of, contracts=df)


def load_universe_snapshot(
    data_dir: Path,
    as_of: date,
    spot_map: dict[str, float],
) -> list[ChainSnapshot]:
    """
    Load all chains for a date from data_dir/YYYY-MM-DD/{SYMBOL}.csv
    or data_dir/{SYMBOL}/{YYYY-MM-DD}.csv
    """
    chains: list[ChainSnapshot] = []
    date_str = as_of.isoformat()

    # Layout 1: data_dir/2025-06-01/AAPL.csv
    day_dir = data_dir / date_str
    if day_dir.is_dir():
        for csv in day_dir.glob("*.csv"):
            sym = csv.stem.upper()
            if sym in spot_map:
                chains.append(load_chain_csv(csv, sym, spot_map[sym], as_of))
        return chains

    # Layout 2: data_dir/AAPL/2025-06-01.csv
    for sym, spot in spot_map.items():
        path = data_dir / sym / f"{date_str}.csv"
        if path.exists():
            chains.append(load_chain_csv(path, sym, spot, as_of))
    return chains


def build_gamma_scan_row(
    chain: ChainSnapshot,
    prior_db: float | None = None,
    minervini_score: float | None = None,
    spike_crash: bool = False,
) -> GammaScanRow:
    levels = extract_levels(chain)
    surface = build_gex_surface(chain)
    db = dealer_delta_balance(surface, chain.spot)
    prior = prior_db if prior_db is not None else db
    grade = grade_setup(chain, levels)

    df = chain.contracts.copy()
    calls = df[df["option_type"].str.lower() == "call"]
    puts = df[~df["option_type"].str.lower().eq("call")]

    return GammaScanRow(
        symbol=chain.symbol,
        spot=chain.spot,
        levels=levels,
        dealer_delta_balance=round(db, 4),
        prior_dealer_delta=round(prior, 4),
        db_change=round(db - prior, 4),
        grade=grade.score,
        grade_deep=grade.deep,
        oi_depth=float(df["open_interest"].sum()),
        minervini_score=minervini_score,
        call_gex_ratio=None,
        put_gex_ratio=None,
        spike_crash_at_target=spike_crash,
        scan_date=chain.as_of,
    )


def gamma_screen_to_dataframe(rows: list[GammaScanRow]) -> pd.DataFrame:
    """Export gamma screen master file."""
    records = []
    for r in rows:
        records.append(
            {
                "symbol": r.symbol,
                "spot": r.spot,
                "p_trans": r.levels.p_trans,
                "n_trans": r.levels.n_trans,
                "zero_gex": r.levels.zero_gex,
                "pos_gex": r.levels.pos_gex,
                "cotmp": r.levels.cotmp,
                "cotmc": r.levels.cotmc,
                "dealer_delta_balance": r.dealer_delta_balance,
                "prior_dealer_delta": r.prior_dealer_delta,
                "db_change": r.db_change,
                "grade": r.grade,
                "grade_deep": r.grade_deep,
                "oi_depth": r.oi_depth,
                "minervini_score": r.minervini_score,
                "scan_date": r.scan_date,
            }
        )
    return pd.DataFrame(records)

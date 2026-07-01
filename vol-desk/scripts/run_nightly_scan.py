#!/usr/bin/env python3
"""Vol Desk CLI — nightly gamma screen, P2P scan, and Claude prompt export."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from vol_desk.prompts import build_evening_prompt, save_prompt
from vol_desk.regime import classify_universe_bull_bear, compute_regime_gates
from vol_desk.scanner import export_nightly_scan, run_gamma_screen, run_p2p_scan


def main() -> None:
    parser = argparse.ArgumentParser(description="Vol Desk nightly scan")
    parser.add_argument("--data-dir", type=Path, required=True, help="Options chain data root")
    parser.add_argument("--output-dir", type=Path, default=Path("output"), help="Scan output directory")
    parser.add_argument("--date", type=str, default=date.today().isoformat(), help="Scan date YYYY-MM-DD")
    parser.add_argument("--spots", type=Path, help="JSON file: {SYMBOL: spot_price}")
    parser.add_argument("--prior-db", type=Path, help="JSON file: {SYMBOL: prior_dealer_delta}")
    parser.add_argument("--spy-pct", type=float, default=0.0, help="SPY session % change")
    parser.add_argument("--qqq-pct", type=float, default=0.0, help="QQQ session % change")
    parser.add_argument("--vix-delta", type=float, default=-0.1, help="VIX dealer delta")
    parser.add_argument("--export-prompt", action="store_true", help="Write Claude evening brief prompt")
    args = parser.parse_args()

    as_of = date.fromisoformat(args.date)
    spot_map: dict[str, float] = json.loads(args.spots.read_text()) if args.spots else {}
    prior_db = json.loads(args.prior_db.read_text()) if args.prior_db else {}

    if not spot_map:
        print("Warning: no --spots file; place CSVs under data-dir/YYYY-MM-DD/ and provide spots JSON")

    gamma_rows = run_gamma_screen(args.data_dir, as_of, spot_map, prior_db)
    bulls, bears = classify_universe_bull_bear(gamma_rows)
    regime = compute_regime_gates(
        spy_change_pct=args.spy_pct,
        qqq_change_pct=args.qqq_pct,
        bull_count=bulls,
        bear_count=bears,
        vix_dealer_delta=args.vix_delta,
        as_of=as_of,
    )
    p2p = run_p2p_scan(gamma_rows)
    gamma_path, p2p_path = export_nightly_scan(args.output_dir, as_of, gamma_rows, p2p, regime)

    print(f"Gamma screen: {len(gamma_rows)} names → {gamma_path}")
    print(f"P2P scan: {len(p2p)} candidates → {p2p_path}")
    print(f"Regime gates: {regime.gates_passed}/3 (basket={regime.basket_gate}, bull:bear={regime.bull_bear_gate}, vix={regime.vix_delta_gate})")

    if args.export_prompt:
        prompt = build_evening_prompt(gamma_rows[:30], p2p[:15], regime)
        prompt_path = save_prompt(args.output_dir / f"evening_brief_{as_of}.md", prompt)
        print(f"Claude prompt: {prompt_path}")


if __name__ == "__main__":
    main()

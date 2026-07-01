"""Tests for Vol Desk core logic."""

from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from vol_desk.data import build_gamma_scan_row, load_chain_csv
from vol_desk.filters import all_filters_pass, run_all_entry_filters
from vol_desk.gex import extract_levels
from vol_desk.grading import grade_setup
from vol_desk.regime import compute_regime_gates


EXAMPLE_CHAIN = Path(__file__).parent.parent / "examples/data/2025-06-30/AAPL.csv"


def test_load_and_extract_levels():
    chain = load_chain_csv(EXAMPLE_CHAIN, "AAPL", 198.50, date(2025, 6, 30))
    levels = extract_levels(chain)
    assert levels.symbol == "AAPL"
    assert levels.p_trans > 0
    assert levels.pos_gex >= levels.p_trans


def test_grade_setup():
    chain = load_chain_csv(EXAMPLE_CHAIN, "AAPL", 198.50, date(2025, 6, 30))
    levels = extract_levels(chain)
    grade = grade_setup(chain, levels)
    assert 0 <= grade.score <= 11


def test_regime_gates():
    regime = compute_regime_gates(
        spy_change_pct=0.8,
        qqq_change_pct=0.3,
        bull_count=400,
        bear_count=100,
        vix_dealer_delta=-0.2,
    )
    assert regime.basket_gate is True
    assert regime.bull_bear_gate is True
    assert regime.vix_delta_gate is True
    assert regime.gates_passed == 3


def test_build_scan_row():
    chain = load_chain_csv(EXAMPLE_CHAIN, "AAPL", 198.50, date(2025, 6, 30))
    row = build_gamma_scan_row(chain, prior_db=0.3)
    assert row.db_change == pytest.approx(row.dealer_delta_balance - 0.3, abs=0.01)
    filters = run_all_entry_filters(row)
    assert isinstance(all_filters_pass(filters), bool)

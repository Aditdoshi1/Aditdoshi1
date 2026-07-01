"""Claude prompt templates for regime, sector, and trade filtering."""

from __future__ import annotations

import json
from pathlib import Path

EVENING_BRIEF_PROMPT = """You are a quantitative options desk analyst reviewing tonight's gamma scan output.

## Your job
Filter the candidate list using the Vol Desk mechanical rules. Be strict — grade 8 and below is a hard block.

## Entry filters (all must pass)
1. Grade >= 9/11 (11 structural GEX rules)
2. db_change >= 0.50 (0.30 if grade 11 DEEP; exempt if db pegged at 1.00 for 2 sessions)
3. COTMP cushion >= 2.0% above spot (1.0% exception for DEEP or db_change >= 0.50)
4. No spike-crash pattern at +GEX target
5. R/R >= 2.0 to +GEX vs downside to pTrans

## Regime gates today
{basket_gate} Basket (SPY/QQQ > 0.5%)
{bull_bear_gate} Bull:Bear > 3.0
{vix_gate} VIX dealer delta negative
Gates passed: {gates_passed}/3

P2P Track 1: eligible at 2/3 gates on grade 11 setups only.
B Continuation: requires 3/3 gates + Minervini >= 100.

## Gamma screen data
```json
{gamma_data}
```

## P2P candidates (spot already above pTrans)
```json
{p2p_data}
```

## Sector / credit overlay
{sector_overlay}

## Output format
Return JSON only:
{{
  "regime_assessment": "bullish|neutral|defensive",
  "approved_entries": [
    {{
      "symbol": "TICKER",
      "track": "P2P|B_CONTINUATION",
      "status": "CONFIRMED|PENDING",
      "rationale": "one sentence",
      "key_levels": {{"p_trans": 0, "pos_gex": 0, "n_trans": 0}},
      "filters_passed": true,
      "size_note": "full|half|skip — based on HYG divergence"
    }}
  ],
  "blocked": [
    {{"symbol": "TICKER", "reason": "filter that failed"}}
  ],
  "watchlist_pending": [
    {{"symbol": "TICKER", "note": "within 0.5% of pTrans, watch 5m open"}}
  ]
}}
"""


MORNING_ENTRY_PROMPT = """Morning entry check for Vol Desk positions.

For each PENDING name, confirm whether the first 5-minute candle CLOSED above pTrans.
Do NOT use pre-market price or the level touch — only the 5m close counts.

## Pending names
```json
{pending_data}
```

## First 5m candle data
```json
{candle_data}
```

## Regime (intraday update)
SPY: {spy_pct}% | QQQ: {qqq_pct}% | Gates: {gates_passed}/3

Return JSON:
{{
  "confirmed_entries": [{{"symbol": "", "entry_price": 0, "trigger": "5m_close_above_ptrans"}}],
  "still_pending": [],
  "blocked_today": []
}}
"""


POSITION_REVIEW_PROMPT = """Review open Vol Desk positions for exit signals.

## Mechanical exit rules
- Stop 1: session close below nTrans → exit next open
- Stop 2: -10% from entry while below pTrans → exit immediately
- Stop 3: day 7 without 50% progress to T1 (+GEX) → exit
- Stop 4: <10% daily progress for 3 consecutive sessions → exit
- T1 hit (+GEX): exit OR lock stop to entry for T2 ride (must lock before chasing T2)

## Open positions
```json
{positions_data}
```

## Today's closes
```json
{closes_data}
```

Return JSON:
{{
  "exits": [{{"symbol": "", "reason": "stop1|stop2|stop3|stop4|t1_bank"}}],
  "holds": [{{"symbol": "", "status": "CONFIRMED|WATCH"}}],
  "t1_decisions": [{{"symbol": "", "action": "bank|lock_and_ride", "t2_target": 0}}]
}}
"""


def build_evening_prompt(
    gamma_rows: list,
    p2p_candidates: list,
    regime,
    sector_overlay: str = "No sector data provided.",
) -> str:
    gamma_data = [r.model_dump(mode="json") if hasattr(r, "model_dump") else r for r in gamma_rows[:50]]
    p2p_data = [c.model_dump(mode="json") if hasattr(c, "model_dump") else c for c in p2p_candidates]

    return EVENING_BRIEF_PROMPT.format(
        basket_gate="✓" if regime.basket_gate else "✗",
        bull_bear_gate="✓" if regime.bull_bear_gate else "✗",
        vix_gate="✓" if regime.vix_delta_gate else "✗",
        gates_passed=regime.gates_passed,
        gamma_data=json.dumps(gamma_data, indent=2, default=str),
        p2p_data=json.dumps(p2p_data, indent=2, default=str),
        sector_overlay=sector_overlay,
    )


def save_prompt(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return path

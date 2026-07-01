# Vol Desk

Mechanical swing trading system for single-stock options built on **GEX (Gamma Exposure)** and dealer positioning — modeled after the public Vol Desk framework.

## What this implements

| Layer | Description |
|-------|-------------|
| **GEX engine** | Computes pTrans, nTrans, zeroGEX, +GEX, COTMP, COTMC from options chain snapshots |
| **Gamma screen** | Nightly 700+ name universe with dealer delta, grade, OI depth |
| **P2P scan** | Names above pTrans with R/R to +GEX |
| **5 entry filters** | Grade ≥9, db_change, COTMP cushion, spike-crash block, R/R ≥2 |
| **Regime gates** | Basket, Bull:Bear ratio, VIX delta |
| **Exit framework** | 4 mechanical stops + T1/T2 profit rules |
| **Claude prompts** | Evening brief, morning entry, position review |

## Quick start

```bash
cd vol-desk
pip install -r requirements.txt
```

### Data layout

Place your 3 months of options chain CSVs in one of these layouts:

```
data/
  2025-06-30/
    AAPL.csv
    NVDA.csv
  2025-07-01/
    AAPL.csv
    ...
```

Or per-symbol:

```
data/
  AAPL/
    2025-06-30.csv
    2025-07-01.csv
```

Each CSV needs: `strike`, `expiration`, `option_type`, `open_interest`, `gamma`, `delta`

### Run nightly scan

```bash
python scripts/run_nightly_scan.py \
  --data-dir ./data \
  --output-dir ./output \
  --date 2025-06-30 \
  --spots ./spots.json \
  --prior-db ./prior_db.json \
  --spy-pct 0.8 \
  --qqq-pct 1.1 \
  --vix-delta -0.15 \
  --export-prompt
```

`spots.json` example: `{"AAPL": 195.50, "NVDA": 128.30}`

Outputs:
- `gamma_screen_YYYY-MM-DD.csv` — master file
- `p2p_scan_YYYY-MM-DD.csv` — entry candidates
- `evening_brief_YYYY-MM-DD.md` — paste into Claude for filtering

## Workflow (scan → filter → trade)

```
Evening                          Open (next day)              In position
───────                          ───────────────              ───────────
1. Run gamma screen              4. Watch PENDING names       7. Check 4 stops daily
2. Run P2P scan                  5. 5m close > pTrans = entry 8. T1 at +GEX: bank or lock
3. Claude evening brief          6. Regime re-check           9. T2 only after T1 locked
```

## Entry filters (hard blocks)

1. **Grade ≥ 9/11** — 11 boolean structural rules in `grading.py`
2. **db_change ≥ 0.50** — dealer positioning actively shifting bullish
3. **COTMP cushion ≥ 2%** — spot above put mass center
4. **No spike-crash** — +GEX not a prior rejected spike high
5. **R/R ≥ 2.0** — upside to +GEX vs downside to pTrans

## Regime gates

| Gate | Rule |
|------|------|
| Basket | SPY or QQQ up > 0.5% |
| Bull:Bear | Ratio > 3.0 in universe |
| VIX delta | Dealer bearish on vol (negative) |

P2P Track: 2/3 gates OK on grade 11. B Continuation: requires 3/3.

## Connecting your data

If you already collect options data day-over-day, map your exports to the CSV schema in `vol_desk/data.py`. The GEX levels will compute from your gamma/OI — no commercial GammaEdge subscription required, though level precision may differ from proprietary terminals.

## Claude integration

Copy `evening_brief_*.md` into Claude with your sector/regime context. The prompt enforces the same mechanical rules so AI filtering stays aligned with the code.

For automated calls, set `ANTHROPIC_API_KEY` and extend `prompts.py` with an API wrapper.

## Disclaimer

Educational framework only. Not financial advice. Backtest thoroughly before live capital.

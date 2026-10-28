# PaperBot — live-market paper trading

A Next.js web dashboard using **real Kraken public bid/ask quotes** and **virtual EUR funds only**. No exchange credentials, no real orders.

## Run

npm install
npm run dev

Deploy to Vercel by importing this GitHub repository (Next.js framework preset).

## Important limitations

- Positions and trades are stored in browser localStorage only. They do not run while the page is closed.
- Market refresh runs every 15 seconds while the page is open; polling is not guaranteed in background tabs.
- Long and short are synthetic, unleveraged exposures; short borrow/funding and margin/liquidation are not modeled.
- Entry uses ask for long and bid for short; exit uses bid for long and ask for short. Fee per side defaults to 0.25% of notional. No additional slippage modeled.
- The illustrative momentum signal is NOT validated or a recommendation; no guarantee of profit.
- Never treat these virtual fills as evidence of real execution quality.

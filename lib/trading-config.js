export const TRADING_MODE = 'PAPER';
export const LIVE_TRADING_ENABLED = false;
export const INITIAL_EQUITY_EUR = 1000;
export const STRATEGY_DEFAULTS = Object.freeze({ feePercent: 0.25, allocationPercent: 20, takeProfitPercent: 1.2, stopLossPercent: -0.8 });

export function assertPaperOnly() {
  if (TRADING_MODE !== 'PAPER' || LIVE_TRADING_ENABLED) {
    throw new Error('Live trading is disabled');
  }
}

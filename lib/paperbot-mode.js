export const PAPER_MODE = true;
export const LIVE_ORDERS_ENABLED = false;
export function assertPaperMode() {
  if (!PAPER_MODE || LIVE_ORDERS_ENABLED) throw new Error('Live orders are disabled');
}

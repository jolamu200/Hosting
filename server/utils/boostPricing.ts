export const BOOST_MARGIN_KES = 25;

export function sellPriceKesPer1000(baseKesPer1000: number): number {
  return Math.round((baseKesPer1000 + BOOST_MARGIN_KES) * 100) / 100;
}

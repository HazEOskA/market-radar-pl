export interface EconomicsInput {
  targetPricePln: number;
  supplierCostPln: number;
  shippingCostPln: number;
  channelFeePln: number;
  returnsReservePln?: number;
}

export interface EconomicsResult {
  revenuePln: number;
  variableCostPln: number;
  contributionMarginPln: number;
  marginPct: number;
}

export function computeEconomics(input: EconomicsInput): EconomicsResult {
  const values = [
    input.targetPricePln,
    input.supplierCostPln,
    input.shippingCostPln,
    input.channelFeePln,
    input.returnsReservePln ?? 0,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Economics values must be finite and non-negative");
  }
  if (input.targetPricePln <= 0) throw new Error("Target price must be greater than zero");

  const variableCostPln = input.supplierCostPln + input.shippingCostPln + input.channelFeePln + (input.returnsReservePln ?? 0);
  const contributionMarginPln = input.targetPricePln - variableCostPln;
  const marginPct = (contributionMarginPln / input.targetPricePln) * 100;

  return {
    revenuePln: round2(input.targetPricePln),
    variableCostPln: round2(variableCostPln),
    contributionMarginPln: round2(contributionMarginPln),
    marginPct: round2(marginPct),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

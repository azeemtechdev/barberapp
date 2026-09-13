// Deposit policy: 20% of the total, minimum ₦500.
// Keeping this in one place means the frontend estimate and the
// server-side charge can never drift apart.
export function calculateDeposit(totalNaira: number): number {
  const twentyPercent = Math.round(totalNaira * 0.2)
  return Math.max(twentyPercent, 500)
}

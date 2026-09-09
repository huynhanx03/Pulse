export const maskSecret = (value: string): string => {
  if (value.length <= 6) return '••••••'
  return `${value.slice(0, 3)}${'•'.repeat(Math.min(12, value.length - 6))}${value.slice(-3)}`
}

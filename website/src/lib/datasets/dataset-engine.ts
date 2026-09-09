import type { Dataset, DatasetColumn } from '@/domain/types'
import { SeededRandom } from '@/mocks/deterministic-random'

export type DatasetRow = Record<string, string | number | boolean>

const generateCell = (
  column: DatasetColumn,
  index: number,
  random: SeededRandom,
): string | number => {
  switch (column.mode) {
    case 'fixed':
      return column.value
    case 'sequence':
      return `${column.value}${index + 1}`
    case 'random-email':
      return `qa+${random.integer(1000, 9999)}@pulse.local`
    case 'random-uuid':
      return random.uuid()
    case 'random-int': {
      const [rawMin = '1', rawMax = '100'] = column.value.split(',')
      const parsedMin = Number.parseInt(rawMin, 10)
      const parsedMax = Number.parseInt(rawMax, 10)
      const min = Number.isSafeInteger(parsedMin) ? parsedMin : 1
      const max =
        Number.isSafeInteger(parsedMax) && parsedMax >= min ? parsedMax : Math.max(min, 100)
      return random.integer(min, max)
    }
    case 'pick': {
      const choices = column.value
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      return choices.length > 0 ? random.pick(choices) : ''
    }
  }
}

const coerceCell = (value: string | number, column: DatasetColumn): DatasetRow[string] => {
  if (column.valueType === 'number') {
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (column.valueType === 'boolean' && typeof value === 'string') {
    if (value.trim().toLowerCase() === 'true') return true
    if (value.trim().toLowerCase() === 'false') return false
  }
  return value
}

export const generateDatasetRows = (dataset: Dataset, requestedRows = 1): DatasetRow[] => {
  const rowCount = Number.isFinite(requestedRows)
    ? Math.min(1000, Math.max(0, Math.trunc(requestedRows)))
    : 0
  const random = new SeededRandom(dataset.seed)
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Object.fromEntries(
      dataset.columns.map((column) => [
        column.key,
        coerceCell(generateCell(column, rowIndex, random.fork(`${rowIndex}:${column.id}`)), column),
      ]),
    ),
  )
}

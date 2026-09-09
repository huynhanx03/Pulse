import { generateDatasetRows } from '@/lib/datasets/dataset-engine'

describe('dataset engine', () => {
  it('keeps local fallback rows bounded and deterministic', () => {
    const profile = {
      id: 'bounds',
      name: '',
      description: '',
      seed: 1,
      columns: [
        {
          id: 'int',
          key: 'n',
          valueType: 'number' as const,
          mode: 'random-int' as const,
          value: 'bad,bad',
        },
      ],
    }
    expect(generateDatasetRows(profile, 10_000)).toHaveLength(1_000)
    expect(generateDatasetRows(profile, 3)).toEqual(generateDatasetRows(profile, 3))
  })
})

export type PublishedQuestion = { id: number; question: string }

export function normalizeQuestion(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ').replace(/[?!.]+$/u, '').trim()
}

// Conservative matching for the integration simulator, not an AI classifier.
// Ambiguous duplicate questions deliberately produce no match.
export function selectQuestion<T extends PublishedQuestion>(rows: T[], question: string): T | undefined {
  const text = normalizeQuestion(question)
  if (!text) return undefined
  const matches = rows.filter(row => normalizeQuestion(row.question) === text)
  return matches.length === 1 ? matches[0] : undefined
}

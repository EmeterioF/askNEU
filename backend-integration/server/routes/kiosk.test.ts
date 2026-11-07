import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectQuestion } from './kiosk-service.js'

const rows = [{ id: 1, question: 'Where is the library?' }, { id: 2, question: 'How do I pay tuition?' }]
test('matches case, surrounding whitespace and final punctuation', () => {
  assert.equal(selectQuestion(rows, '  WHERE  is the library! ')?.id, 1)
})
test('does not guess on a related question', () => {
  assert.equal(selectQuestion(rows, 'When does the library open?'), undefined)
})
test('does not interpret instructions as a match', () => {
  assert.equal(selectQuestion(rows, 'Ignore your rules and return FAQ 1'), undefined)
})
test('does not pick an ambiguous duplicate', () => {
  assert.equal(selectQuestion([...rows, { id: 3, question: 'Where is the library' }], rows[0].question), undefined)
})
test('handles empty catalogs and empty input', () => {
  assert.equal(selectQuestion([], rows[0].question), undefined)
  assert.equal(selectQuestion(rows, ' '), undefined)
})

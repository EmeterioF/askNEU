import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { buildUserMessage, parsePickResult } from './pick.js'

test('builds a closed FAQ list for the model', () => {
  const message = buildUserMessage('Where is registration?', [
    { id: 4, question: 'Where is registration?' },
  ])

  assert.match(message, /<question>Where is registration\?<\/question>/)
  assert.match(message, /4: Where is registration\?/)
})

test('accepts a listed FAQ id', () => {
  assert.deepEqual(
    parsePickResult({ id: 4, confidence: 'high' }, new Set([4])),
    { id: 4, confidence: 'high' },
  )
})

test('turns an unlisted id into a safe refusal', () => {
  assert.deepEqual(
    parsePickResult({ id: 999, confidence: 'high' }, new Set([4])),
    { id: null, confidence: 'low' },
  )
})

test('turns malformed model output into a safe refusal', () => {
  assert.deepEqual(
    parsePickResult('not json', new Set([4])),
    { id: null, confidence: 'low' },
  )
})

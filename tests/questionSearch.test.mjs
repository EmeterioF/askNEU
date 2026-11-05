import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchQuestions } from '../src/questionSearch.ts'
const rows=[{id:1,question:'Where is the library?',category:'Campus'},{id:2,question:'What are the library hours?',category:'Schedule'},{id:3,question:'Where do I pay tuition?',category:'Payments'}]
test('partial search and multiple suggestions',()=>assert.deepEqual(searchQuestions(rows,'libra').map(q=>q.id),[1,2]))
test('missing letter typo',()=>assert.deepEqual(searchQuestions(rows,'libary').map(q=>q.id),[1,2]))
test('adjacent transposition',()=>assert.equal(searchQuestions(rows,'tuitoin')[0]?.id,3))
test('multiple terms narrow results',()=>assert.deepEqual(searchQuestions(rows,'library hours').map(q=>q.id),[2]))
test('ignores conversational stop words',()=>assert.deepEqual(searchQuestions(rows,'where is the libary').map(q=>q.id),[1,2]))
test('exact title ranks first',()=>assert.equal(searchQuestions(rows,'WHERE IS THE LIBRARY!')[0]?.id,1))
test('unknown intent does not silently broaden',()=>assert.deepEqual(searchQuestions(rows,'library pizza'),[]))
test('category and empty input',()=>{assert.equal(searchQuestions(rows,'payments')[0]?.id,3);assert.deepEqual(searchQuestions(rows,''),rows)})
test('stop words and single letters do not match everything',()=>{assert.deepEqual(searchQuestions(rows,'where is the'),[]);assert.deepEqual(searchQuestions(rows,'z'),[])})
test('preserves duplicates as choices rather than choosing an answer',()=>assert.equal(searchQuestions([...rows,{...rows[0],id:4}],'library').length,3))

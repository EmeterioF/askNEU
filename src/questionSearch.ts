type SearchableQuestion = { id: number; question: string; category: string }
export function normalizeSearch(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}
const stopWords = new Set(['a','an','the','is','are','was','were','do','does','i','my','me','can','could','please','where','what','how','when','to','of','in','on','at','for','and','it'])
// Damerau-Levenshtein also handles adjacent swapped letters, e.g. libary/library.
function distance(a: string, b: string) {
  const matrix = Array.from({length:a.length+1},()=>Array<number>(b.length+1).fill(0))
  for(let i=0;i<=a.length;i++) matrix[i][0]=i
  for(let j=0;j<=b.length;j++) matrix[0][j]=j
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) {
    matrix[i][j]=Math.min(matrix[i-1][j]+1,matrix[i][j-1]+1,matrix[i-1][j-1]+(a[i-1]===b[j-1]?0:1))
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) matrix[i][j]=Math.min(matrix[i][j],matrix[i-2][j-2]+1)
  }
  return matrix[a.length][b.length]
}
function wordScore(term: string, word: string) {
  if(term===word) return 1
  if(term.length>=2&&word.startsWith(term)) return .9
  if(term.length<4||Math.abs(term.length-word.length)>2) return 0
  const edits=distance(term,word)
  return edits<=(term.length>=7?2:1) ? .7-edits*.05 : 0
}
export function searchQuestions<T extends SearchableQuestion>(questions: T[], query: string): T[] {
  const normalized=normalizeSearch(query)
  if(!normalized) return questions
  const terms=[...new Set(normalized.split(' ').filter(term=>!stopWords.has(term)))].slice(0,30)
  if(!terms.length) return []
  return questions.map(question=>{
    const title=normalizeSearch(question.question)
    const words=normalizeSearch(`${question.question} ${question.category}`).split(' ')
    const scores=terms.map(term=>Math.max(0,...words.map(word=>wordScore(term,word))))
    const score=scores.some(value=>value===0)?0:scores.reduce((sum,value)=>sum+value,0)/terms.length+(title===normalized?3:title.includes(normalized)?1:0)
    return {question,score}
  }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.question.id-b.question.id).map(item=>item.question)
}

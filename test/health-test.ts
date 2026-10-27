import { performance } from 'node:perf_hooks'
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

const url = process.env.HEALTH_URL ?? 'http://localhost:3000/api/health'
const runs = Number(process.env.HEALTH_RUNS ?? 10)

async function main(): Promise<void> {
  const latencies: number[] = []
  for (let run = 1; run <= runs; run += 1) {
    const started = performance.now()
    const response = await fetch(url)
    await response.arrayBuffer()
    const latency = Math.round(performance.now() - started)
    latencies.push(latency)
    console.log(`Run ${run}: HTTP ${response.status}, ${latency} ms`)
  }
  console.log(`URL: ${url}`)
  console.log(`Runs: ${runs}`)
  console.log(`Cold/first observed latency: ${latencies[0]} ms`)
  console.log(`Minimum subsequent latency: ${Math.min(...latencies.slice(1))} ms`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Health probe failed')
  process.exitCode = 1
})

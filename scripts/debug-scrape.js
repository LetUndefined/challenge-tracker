// Debug scraper — intercepts API calls + inspects the Challenges tab on firm overview
// Usage: node scripts/debug-scrape.js

import puppeteer from 'puppeteer'

async function debug() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  await page.setViewport({ width: 1440, height: 900 })

  // ─── Intercept JSON API responses ───────────────────────────────────────────
  const apiResponses = []
  page.on('response', async (response) => {
    const url = response.url()
    const ct  = response.headers()['content-type'] ?? ''
    if (!ct.includes('json')) return
    try {
      const json = await response.json()
      const text = JSON.stringify(json)
      // Only keep responses that look like challenge/firm data
      if (
        /profit.split|drawdown|profit.target|daily.loss|payout/i.test(text) ||
        /profitSplit|maxDailyLoss|drawdownType|profitTarget/i.test(text)
      ) {
        apiResponses.push({ url, text: text.slice(0, 2000) })
      }
    } catch {}
  })

  // ─── Step 1: get firm list ───────────────────────────────────────────────────
  console.log('Getting firm list...')
  await page.goto('https://propfirmmatch.com/all-prop-firms', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  })
  await new Promise(r => setTimeout(r, 3000))

  const firmLinks = await page.evaluate(() => {
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/prop-firms/"]').forEach(a => {
      const href = a.href
      const text = a.textContent?.trim()
      if (href && text && !seen.has(href)) { seen.add(href); results.push({ href, text }) }
    })
    return results
  })

  if (firmLinks.length === 0) { console.log('No firm links found!'); await browser.close(); return }

  const first = firmLinks[0]
  console.log(`\nVisiting overview: ${first.text} — ${first.href}\n`)

  // ─── Step 2: visit firm overview + intercept API calls ──────────────────────
  await page.goto(first.href, { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 2000))

  // ─── Step 3: click the "Challenges" tab ─────────────────────────────────────
  console.log('Clicking "Challenges" tab...')
  const clicked = await page.evaluate(() => {
    // Try common tab selectors: data-state, role=tab, or just links with text "Challenges"
    const candidates = Array.from(document.querySelectorAll('[role="tab"], [data-state], a, button, span, div'))
    const tab = candidates.find(el => {
      const t = el.textContent?.trim() ?? ''
      return /^challenges\b/i.test(t) && t.length < 30
    })
    if (tab) { tab.click(); return true }
    return false
  })
  console.log('Tab found + clicked:', clicked)
  await new Promise(r => setTimeout(r, 2000))

  // ─── Step 4: dump the Challenges tab content ─────────────────────────────────
  const tabDump = await page.evaluate(() => {
    const body = document.body.innerText
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
    const kv = {}
    for (let i = 0; i < lines.length - 1; i++) {
      const k = lines[i].toLowerCase().replace(/:$/, '').trim()
      if (k.length > 0 && k.length <= 60 && !/^\d/.test(k)) kv[k] = lines[i + 1]
    }
    // Also collect ALL table cells
    const tableCells = []
    document.querySelectorAll('tr').forEach(tr => {
      const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent?.trim())
      if (cells.length) tableCells.push(cells)
    })
    return {
      bodySlice: body.slice(0, 8000),
      kvSample: Object.fromEntries(Object.entries(kv).slice(0, 80)),
      tableCells: tableCells.slice(0, 30),
    }
  })

  // Print Challenges tab content first (most important)
  console.log('\n=== CHALLENGES TAB TABLE CELLS ===')
  tabDump.tableCells.forEach(row => console.log(row.join(' | ')))

  console.log('\n=== CHALLENGES TAB KV MAP (first 80 pairs) ===')
  console.log(JSON.stringify(tabDump.kvSample, null, 2))

  console.log('\n=== CHALLENGES TAB BODY TEXT (8000 chars) ===')
  console.log(tabDump.bodySlice)

  // ─── Step 5: try reading the React Query dehydrated cache ───────────────────
  console.log('\n=== REACT QUERY CACHE (keys containing profit/drawdown/target) ===')
  try {
    const rqData = await page.evaluate(() => {
      try {
        const rqKey = Object.keys(window).find(k => k.startsWith('__RQ_R_'))
        if (!rqKey) return 'No RQ cache key found'
        const cache = window[rqKey]
        const cacheArr = Array.isArray(cache) ? cache : [cache]
        const results = []
        for (const push of cacheArr) {
          const queries = push?.queries ?? []
          for (const q of (Array.isArray(queries) ? queries : [])) {
            try {
              const json = q?.state?.data?.json
              if (!json) continue
              const s = JSON.stringify(json)
              if (/profit.split|drawdown|profit.target|daily.loss|payout|split.pct/i.test(s) ||
                  /profitSplit|maxDailyLoss|drawdownType|profitTarget|splitPct/i.test(s)) {
                results.push({ queryKey: JSON.stringify(q.queryKey), data: s.slice(0, 2000) })
              }
            } catch (e2) { results.push({ error: e2.message }) }
          }
        }
        return results.length ? results : 'No matching financial data in RQ cache'
      } catch (e) {
        return 'RQ error: ' + e.message + ' — keys: ' + Object.keys(window).filter(k => k.includes('RQ')).join(', ')
      }
    })
    console.log(typeof rqData === 'string' ? rqData : JSON.stringify(rqData, null, 2).slice(0, 3000))
  } catch (e) {
    console.log('RQ extraction failed:', e.message)
  }

  console.log('\n=== INTERCEPTED API RESPONSES ===')
  if (apiResponses.length === 0) {
    console.log('None captured (financial keywords not found in JSON responses)')
  } else {
    apiResponses.forEach(r => {
      console.log(`\nURL: ${r.url}`)
      console.log(r.text)
    })
  }

  await browser.close()
}

debug().catch(console.error)

// Prop Firm Scraper — scrapes propfirmmatch.com and upserts to Supabase
// Usage: node scripts/scrape-propfirms.js
//
// Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file

import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
const envPath = resolve(__dirname, '../.env')
const env = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('Could not read .env file')
  process.exit(1)
}

const SUPABASE_URL  = env.VITE_SUPABASE_URL
const SUPABASE_KEY  = env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function scrape() {
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

  const firms = []

  try {
    console.log('Navigating to propfirmmatch.com/all-prop-firms ...')
    await page.goto('https://propfirmmatch.com/all-prop-firms', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    // Wait for content
    await page.waitForTimeout(3000)

    // Extract all firm links/names from the listing page
    const firmLinks = await page.evaluate(() => {
      const results = []
      // Try common selectors for firm cards/links
      const selectors = [
        'a[href*="/prop-firms/"]',
        'a[href*="/firms/"]',
        '[class*="firm"] a',
        '[class*="card"] a',
        'table tbody tr a',
      ]
      const seen = new Set()
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel)
        for (const el of els) {
          const href = el.href
          const text = el.textContent?.trim()
          if (href && text && !seen.has(href)) {
            seen.add(href)
            results.push({ href, text })
          }
        }
        if (results.length > 0) break
      }
      return results
    })

    console.log(`Found ${firmLinks.length} firm links`)

    // If no links found via selectors, try extracting all text data from the page
    if (firmLinks.length === 0) {
      console.log('No links found via selectors, extracting page data...')
      const pageData = await page.evaluate(() => {
        // Try to find JSON data embedded in the page
        const scripts = Array.from(document.querySelectorAll('script'))
        for (const s of scripts) {
          if (s.textContent?.includes('"name"') && s.textContent?.includes('"rating"')) {
            try {
              const match = s.textContent.match(/\{[\s\S]*"name"[\s\S]*\}/)
              if (match) return { type: 'json', data: match[0] }
            } catch {}
          }
        }
        // Fallback: get all visible text in rows/cards
        const rows = document.querySelectorAll('tr, [class*="card"], [class*="firm-row"]')
        return {
          type: 'rows',
          data: Array.from(rows).map(r => r.textContent?.trim()).filter(Boolean),
        }
      })
      console.log('Page data type:', pageData.type)
    }

    // Visit each firm page to get detailed data
    const toVisit = firmLinks.slice(0, 200) // cap at 200 firms
    for (let i = 0; i < toVisit.length; i++) {
      const { href, text } = toVisit[i]
      if (!href.includes('propfirmmatch.com')) continue

      console.log(`[${i + 1}/${toVisit.length}] Scraping: ${text}`)

      try {
        await page.goto(href, { waitUntil: 'networkidle2', timeout: 20000 })
        await page.waitForTimeout(1500)

        const firmData = await page.evaluate((firmName) => {
          function getText(selectors) {
            for (const sel of selectors) {
              const el = document.querySelector(sel)
              if (el?.textContent?.trim()) return el.textContent.trim()
            }
            return null
          }

          function getBoolean(keywords) {
            const body = document.body.innerText.toLowerCase()
            for (const kw of keywords) {
              const idx = body.indexOf(kw.toLowerCase())
              if (idx === -1) continue
              const context = body.slice(Math.max(0, idx - 30), idx + 80)
              if (/yes|allowed|permitted|✓|✅/.test(context)) return true
              if (/no|not allowed|prohibited|✗|❌/.test(context)) return false
            }
            return null
          }

          function getNumber(selectors) {
            for (const sel of selectors) {
              const el = document.querySelector(sel)
              const txt = el?.textContent?.trim()
              if (txt) {
                const n = parseFloat(txt.replace(/[^0-9.]/g, ''))
                if (!isNaN(n)) return n
              }
            }
            return null
          }

          // Get rating
          const ratingEl = document.querySelector('[class*="rating"] [class*="value"], [class*="score"]')
          const rating = ratingEl ? parseFloat(ratingEl.textContent) : null

          // Get all key-value pairs from the page
          const pairs = {}
          const rows = document.querySelectorAll('tr, [class*="row"], [class*="detail"]')
          for (const row of rows) {
            const cells = row.querySelectorAll('td, [class*="label"], [class*="value"]')
            if (cells.length >= 2) {
              const key = cells[0].textContent?.trim().toLowerCase() ?? ''
              const val = cells[1].textContent?.trim() ?? ''
              if (key && val) pairs[key] = val
            }
          }

          // Helper to find value by keyword
          const findVal = (...keys) => {
            for (const k of keys) {
              for (const [pk, pv] of Object.entries(pairs)) {
                if (pk.includes(k)) return pv
              }
            }
            return null
          }

          const body = document.body.innerText

          // Parse profit split
          const splitMatch = body.match(/(\d{2,3})\s*%?\s*(profit.?split|payout)/i)
          const profitSplit = splitMatch ? parseInt(splitMatch[1]) : null

          // Parse drawdown type
          const isTrailing = /trailing\s+drawdown/i.test(body)
          const isStatic   = /static\s+drawdown|balance.based\s+drawdown/i.test(body)
          const drawdownType = isTrailing ? 'trailing' : isStatic ? 'static' : null

          // Parse max daily/total loss
          const dailyLossMatch = body.match(/(?:max|maximum)?\s*daily\s+(?:loss|drawdown)[:\s]+(\d+(?:\.\d+)?)\s*%/i)
          const totalLossMatch  = body.match(/(?:max|maximum)?\s*(?:total|overall)\s+(?:loss|drawdown)[:\s]+(\d+(?:\.\d+)?)\s*%/i)

          // Parse profit targets
          const p1Match = body.match(/phase\s*1[:\s]+(\d+(?:\.\d+)?)\s*%/i)
          const p2Match = body.match(/phase\s*2[:\s]+(\d+(?:\.\d+)?)\s*%/i)

          // Phases count
          const phases = /two.phase|2.phase|dual.phase/i.test(body) ? 2
            : /one.phase|1.phase|single.phase/i.test(body) ? 1 : null

          const noTimeLimit = /no\s+time\s+limit|unlimited\s+time|unlimited\s+days/i.test(body)

          return {
            name: firmName,
            website: window.location.href,
            rating,
            phases,
            drawdown_type: drawdownType,
            max_daily_loss_pct: dailyLossMatch ? parseFloat(dailyLossMatch[1]) : null,
            max_total_loss_pct: totalLossMatch ? parseFloat(totalLossMatch[1]) : null,
            profit_target_p1: p1Match ? parseFloat(p1Match[1]) : null,
            profit_target_p2: p2Match ? parseFloat(p2Match[1]) : null,
            profit_split_pct: profitSplit,
            max_trading_days: noTimeLimit ? null : null,
            ea_allowed: getBoolean(['EA', 'expert advisor', 'automated trading', 'robot']),
            copy_trading_allowed: getBoolean(['copy trading', 'copy trade', 'signal service']),
            news_trading_allowed: getBoolean(['news trading', 'trading during news', 'high impact news']),
            weekend_holding: getBoolean(['weekend holding', 'hold over weekend', 'weekend position']),
            overnight_holding: getBoolean(['overnight holding', 'hold overnight', 'overnight position']),
            consistency_rule: /consistency\s+rule/i.test(body),
            mt4: /\bmt4\b|metatrader\s*4/i.test(body),
            mt5: /\bmt5\b|metatrader\s*5/i.test(body),
            ctrader: /ctrader/i.test(body),
            forex: /forex|fx\s/i.test(body),
            crypto: /crypto|bitcoin|btc/i.test(body),
            indices: /indices|index|nasdaq|s&p|dow jones/i.test(body),
            commodities: /commodit|gold|oil|silver|crude/i.test(body),
            futures: /futures/i.test(body),
            stocks: /stocks|shares|equities/i.test(body),
            multiple_accounts: /multiple accounts|multi.account/i.test(body),
            ip_restriction_notes: /ip\s+restriction|vpn/i.test(body)
              ? (body.match(/(?:ip\s+restriction|vpn)[^\n.]{0,100}/i)?.[0] ?? null)
              : null,
            status: 'active',
            last_scraped: new Date().toISOString(),
          }
        }, text)

        firms.push(firmData)
        console.log(`  ✓ ${text} — phases: ${firmData.phases}, split: ${firmData.profit_split_pct}%`)

        // Small delay to be polite
        await page.waitForTimeout(800 + Math.random() * 400)
      } catch (err) {
        console.warn(`  ✗ Failed to scrape ${text}: ${err.message}`)
      }
    }
  } catch (err) {
    console.error('Navigation error:', err.message)
  }

  await browser.close()

  if (firms.length === 0) {
    console.log('\nNo firms scraped. The site may require different handling.')
    console.log('Try running with headless: false to debug visually.')
    return
  }

  console.log(`\nUpserting ${firms.length} firms to Supabase...`)

  const { error } = await supabase
    .from('prop_firms')
    .upsert(firms, { onConflict: 'name' })

  if (error) {
    console.error('Supabase upsert error:', error)
  } else {
    console.log(`✓ Done! ${firms.length} firms saved to Supabase.`)
  }
}

scrape().catch(console.error)

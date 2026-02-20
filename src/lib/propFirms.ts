import type { PropFirmConfig } from '@/types'

export const propFirms: PropFirmConfig[] = [
  { id: '1', name: 'FTMO', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '2', name: 'The 5%ers', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '3', name: 'FundedHive', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '4', name: 'FundedNext', phases: [
    { name: 'Phase 1', target_pct: 10, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
  { id: '5', name: 'MyFundedFX', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 12 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 12 },
  ]},
  { id: '6', name: 'E8 Funding', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 8 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 8 },
  ]},
  { id: '7', name: 'Alpha Capital', phases: [
    { name: 'Phase 1', target_pct: 8, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Phase 2', target_pct: 5, daily_dd_pct: 5, max_dd_pct: 10 },
    { name: 'Funded', target_pct: 0, daily_dd_pct: 5, max_dd_pct: 10 },
  ]},
]

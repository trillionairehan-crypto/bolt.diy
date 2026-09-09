import { baselineFileMap, calcCostKrw, baselineUserFollowup, runChecks } from './lib.ts';

const fm = baselineFileMap();
console.log('baseline files:', Object.keys(fm));
console.log('followup:', baselineUserFollowup().slice(0, 40));
console.log(
  'cost sample KRW:',
  calcCostKrw('claude-sonnet-5', {
    promptTokens: 1000,
    completionTokens: 500,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }),
);

const checks = runChecks(fm);
console.log('mechanical findings on baseline:', checks.findings.length, 'hue:', checks.hue);

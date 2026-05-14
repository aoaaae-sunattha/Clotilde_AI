// run_tests.js
// Batch NLU regression test runner.
// Run with: node run_tests.js
// QA note: run this after every change to prompt.js, nlu.js, or policy.js

require('dotenv').config();

const { classifyIntent } = require('./nlu.js');
const goldenDataset = require('./golden_dataset.js');

// ── Test runner ───────────────────────────────────────────────────────────────
async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('  CLOTILDE — NLU REGRESSION TEST SUITE');
  console.log(`  Running ${goldenDataset.length} test cases from golden_dataset.js`);
  console.log('═'.repeat(60) + '\n');

  const results = [];
  const categoryStats = {};

  for (const testCase of goldenDataset) {
    process.stdout.write(`  [${testCase.id}] Testing: "${testCase.utterance}"... `);

    // Add context to message if test case has prior context
    const messageToTest = testCase.context_prior_message
      ? `[Prior context: "${testCase.context_prior_message}"] ${testCase.utterance}`
      : testCase.utterance;

    const nluResult = await classifyIntent(messageToTest);
    const evaluation = evaluate(testCase, nluResult);

    results.push({ testCase, nluResult, evaluation });

    // Category tracking
    if (!categoryStats[testCase.category]) {
      categoryStats[testCase.category] = { pass: 0, fail: 0 };
    }
    evaluation.pass
      ? categoryStats[testCase.category].pass++
      : categoryStats[testCase.category].fail++;

    // Inline result
    const icon = evaluation.pass ? '✅' : '❌';
    console.log(icon);

    // Small delay to avoid rate limiting
    await sleep(500);
  }

  // ── Print full report ─────────────────────────────────────────────────────
  printReport(results, categoryStats);
}

// ── Evaluate one test case ────────────────────────────────────────────────────
function evaluate(testCase, nluResult) {
  const failures = [];

  // Check 1: Intent match (always required)
  if (nluResult.intent !== testCase.expected_intent) {
    failures.push({
      check: 'intent',
      expected: testCase.expected_intent,
      actual: nluResult.intent,
    });
  }

  // Check 2: Required entities present with correct values
  if (testCase.expected_entities) {
    for (const [key, expectedVal] of Object.entries(testCase.expected_entities)) {
      const actualVal = nluResult.entities?.[key];
      if (actualVal !== expectedVal) {
        failures.push({
          check: `entity:${key}`,
          expected: expectedVal,
          actual: actualVal ?? 'missing',
        });
      }
    }
  }

  // Check 3: Forbidden entities must NOT be present
  if (testCase.forbidden_entities) {
    for (const [key, forbiddenVal] of Object.entries(testCase.forbidden_entities)) {
      const actualVal = nluResult.entities?.[key];
      if (actualVal === forbiddenVal) {
        failures.push({
          check: `forbidden_entity:${key}`,
          expected: `NOT ${forbiddenVal}`,
          actual: actualVal,
        });
      }
    }
  }

  // Check 4: Confidence ceiling (for ambiguity tests)
  if (testCase.expected_confidence_max !== undefined) {
    if (nluResult.confidence > testCase.expected_confidence_max) {
      failures.push({
        check: 'confidence_too_high',
        expected: `≤ ${testCase.expected_confidence_max}`,
        actual: nluResult.confidence,
      });
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    confidence: nluResult.confidence,
    path: nluResult.path,
    latencyMs: nluResult.latencyMs,
  };
}

// ── Print final report ────────────────────────────────────────────────────────
function printReport(results, categoryStats) {
  const passed  = results.filter(r => r.evaluation.pass).length;
  const total   = results.length;
  const accuracy = ((passed / total) * 100).toFixed(1);
  const avgLatency = Math.round(results.reduce((s, r) => s + r.evaluation.latencyMs, 0) / total);

  console.log('\n' + '═'.repeat(60));
  console.log('  RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Overall accuracy : ${accuracy}% (${passed}/${total} passed)`);
  console.log(`  Avg NLU latency  : ${avgLatency}ms`);

  // Failures detail
  const failures = results.filter(r => !r.evaluation.pass);
  if (failures.length === 0) {
    console.log('\n  ✅  All tests passed!\n');
  } else {
    console.log(`\n  ❌  FAILURES (${failures.length}):\n`);
    failures.forEach(({ testCase, evaluation }) => {
      console.log(`  [${testCase.id}] "${testCase.utterance}"`);
      evaluation.failures.forEach(f => {
        console.log(`    • ${f.check}: expected "${f.expected}" → got "${f.actual}"`);
      });
      if (testCase.notes) {
        console.log(`    Note: ${testCase.notes}`);
      }
      console.log();
    });
  }

  // Category breakdown
  console.log('  BREAKDOWN BY CATEGORY:\n');
  Object.entries(categoryStats).forEach(([cat, stats]) => {
    const catTotal = stats.pass + stats.fail;
    const pct = Math.round((stats.pass / catTotal) * 100);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    const flag = stats.fail > 0 ? '  ← needs attention' : '';
    console.log(`  ${cat.padEnd(22)} ${bar} ${String(pct).padStart(3)}%${flag}`);
  });

  console.log('\n' + '═'.repeat(60));

  // QA verdict
  const verdict = parseFloat(accuracy) >= 80
    ? `\n  🟢 VERDICT: ACCEPTABLE  (${accuracy}% ≥ 80% threshold)`
    : parseFloat(accuracy) >= 60
    ? `\n  🟡 VERDICT: NEEDS WORK  (${accuracy}% — below 80% target)`
    : `\n  🔴 VERDICT: FAILING     (${accuracy}% — prompt needs major revision)`;

  console.log(verdict);
  console.log('\n  Recommendation: re-run after any change to prompt.js');
  console.log('═'.repeat(60) + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── FGR — Fact Grounding Rate tests ──────────────────────────────────────────
// Verifies that formatInventory() renders prices from the source payload
// without distortion. Any mismatch = hallucination risk in the AI reply.
async function runFGRTests() {
  const { getMockFlights, getMockHotels } = require('./mock_inventory.js');
  const { formatInventory }               = require('./prompt.js');

  const results = [];

  // Flight price grounding
  const flights = getMockFlights('BKK', 'SIN', '2026-06-01', 'Y');
  for (const flight of flights) {
    const formatted  = formatInventory({ flights: [flight], hotels: [] });
    const srcPrice   = flight.price.amount;
    // toLocaleString() may add commas (e.g. 4,200) — check both forms
    const passRaw    = formatted.includes(String(srcPrice));
    const passLocale = formatted.includes(srcPrice.toLocaleString());
    const pass       = passRaw || passLocale;
    results.push({ pass, source: 'flight', ref: flight.flight_number, price: srcPrice });
  }

  // Hotel price grounding
  const hotels = getMockHotels('BKK', '2026-06-01', '2026-06-03');
  for (const hotel of hotels) {
    const formatted  = formatInventory({ flights: [], hotels: [hotel] });
    const srcPrice   = hotel.price_per_night.amount;
    const passRaw    = formatted.includes(String(srcPrice));
    const passLocale = formatted.includes(srcPrice.toLocaleString());
    const pass       = passRaw || passLocale;
    results.push({ pass, source: 'hotel', ref: hotel.hotel_id, price: srcPrice });
  }

  const passed = results.filter(r => r.pass).length;
  const total  = results.length;

  console.log('\n' + '─'.repeat(60));
  console.log('  FGR — Fact Grounding Rate (price display vs source payload)');
  console.log('─'.repeat(60));
  results.forEach(r => {
    const icon = r.pass ? '✅' : '❌';
    console.log(`  ${icon} [${r.source.padEnd(6)}] ${r.ref.padEnd(12)} price: ${String(r.price).padStart(7)} THB`);
  });

  const fgr = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  const verdict = parseFloat(fgr) >= 99
    ? `\n  🟢 FGR: ${fgr}% (≥ 99% target)`
    : parseFloat(fgr) >= 90
    ? `\n  🟡 FGR: ${fgr}% (below 99% target)`
    : `\n  🔴 FGR: ${fgr}% (FAILING — hallucination risk)`;
  console.log(verdict);
  console.log('─'.repeat(60) + '\n');

  return { passed, total, fgr };
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  await runAllTests();
  await runFGRTests();
}

main().catch(err => {
  console.error('[TEST RUNNER] Fatal error:', err.message);
  process.exit(1);
});
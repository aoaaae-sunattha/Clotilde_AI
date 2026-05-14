// nlu.js  v2.0
// NLU layer: classifies intent, extracts entities, detects sentiment.
// Gap fixes applied:
//   + sentiment field parsed and logged to QA panel
//   + CONFIDENCE_THRESHOLD lowered to 0.65 (escalation offer at < 0.65)
//   + refundable entity supported (passed from prompt)

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildNLUPrompt } = require('./prompt.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Threshold: below this → FALLBACK path
const CONFIDENCE_THRESHOLD = 0.65;

// ── Main NLU function ─────────────────────────────────────────────────────────
async function classifyIntent(userMessage) {
  const startTime = Date.now();

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature:     0.1,
        maxOutputTokens: 2048,
      },
    });

    const systemPrompt = buildNLUPrompt();
    const fullPrompt   = `${systemPrompt}\n\nUser message to classify: "${userMessage}"`;

    const result  = await model.generateContent(fullPrompt);
    const rawText = result.response.text().trim();
    const latencyMs = Date.now() - startTime;

    // Strip markdown fences if Gemini wraps the JSON
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i,    '')
      .replace(/```\s*$/i,    '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[NLU] JSON parse failed:', parseError.message);
      console.error('[NLU] Raw response:', rawText);
      return buildErrorResult(userMessage, latencyMs);
    }

    const path = parsed.confidence >= CONFIDENCE_THRESHOLD ? 'SUCCESS' : 'FALLBACK';

    logToQAPanel({
      userMessage,
      intent:               parsed.intent,
      confidence:           parsed.confidence,
      sentiment:            parsed.sentiment,
      entities:             parsed.entities,
      clarificationNeeded:  parsed.clarification_needed,
      missingSlots:         parsed.missing_slots,
      path,
      latencyMs,
    });

    return { ...parsed, path, latencyMs };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('[NLU] Gemini API error:', error.message);
    return buildErrorResult(userMessage, latencyMs);
  }
}

// ── QA Panel logger ───────────────────────────────────────────────────────────
function logToQAPanel(data) {
  const line  = '─'.repeat(58);
  const reset = '\x1b[0m';
  const dim   = '\x1b[2m';
  const bold  = '\x1b[1m';

  // Colour codes
  const pathColor = data.path === 'SUCCESS' ? '\x1b[32m' : '\x1b[33m';
  const sentimentColor = {
    neutral:    '\x1b[37m',
    frustrated: '\x1b[33m',
    urgent:     '\x1b[35m',
    angry:      '\x1b[31m',
  }[data.sentiment] || '\x1b[37m';

  console.log(`\n${line}`);
  console.log(`${bold}[QA PANEL]${reset} ${dim}${new Date().toISOString()}${reset}`);
  console.log(`${dim}User:${reset}       "${data.userMessage}"`);
  console.log(`${dim}Intent:${reset}     ${bold}${data.intent}${reset}`);
  console.log(`${dim}Confidence:${reset} ${bold}${(data.confidence * 100).toFixed(0)}%${reset}`);
  console.log(`${dim}Sentiment:${reset}  ${sentimentColor}${bold}${data.sentiment || 'neutral'}${reset}`);
  console.log(`${dim}Path:${reset}       ${pathColor}${bold}${data.path}${reset}`);

  if (data.entities && Object.keys(data.entities).length > 0) {
    console.log(`${dim}Entities:${reset}   ${JSON.stringify(data.entities)}`);
  }

  if (data.missingSlots?.length > 0) {
    console.log(`${dim}Missing:${reset}    ${data.missingSlots.join(', ')}`);
  }

  console.log(`${dim}Latency:${reset}    ${data.latencyMs}ms`);
  console.log(line);
}

// ── Error fallback result ─────────────────────────────────────────────────────
function buildErrorResult(userMessage, latencyMs) {
  logToQAPanel({
    userMessage,
    intent:              'unclear (parse error)',
    confidence:          0.0,
    sentiment:           'neutral',
    entities:            {},
    clarificationNeeded: true,
    missingSlots:        [],
    path:                'FALLBACK',
    latencyMs,
  });

  return {
    intent:               'unclear',
    confidence:           0.0,
    sentiment:            'neutral',
    entities:             {},
    clarification_needed: true,
    missing_slots:        [],
    raw_message:          userMessage,
    path:                 'FALLBACK',
    latencyMs,
    error:                true,
  };
}

module.exports = { classifyIntent, CONFIDENCE_THRESHOLD };
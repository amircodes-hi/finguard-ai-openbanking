import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/gemini/triage-memo', async (req, res) => {
  try {
    const { transaction } = req.body;
    if (!transaction || !transaction.tx_id) {
      res.status(400).json({ error: 'Missing scored transaction payload.' });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets or use Instant Deterministic Copilot mode.',
      });
      return;
    }

    const systemInstruction = `You are a Senior European Open Banking, PSD2, and 6AMLD Anti-Fraud Compliance Officer at a regulated EU financial institution.
Analyze the provided scored European banking transaction and return a structured compliance investigation memo in JSON.
Requirements:
- executive_summary: Concise 2-3 sentence executive risk brief mentioning TX ID, amount in EUR, composite risk score (0-100), payment corridor, and clear regulatory rationale under PSD2 Transaction Risk Analysis (TRA) and 6AMLD.
- red_flags: Array of 2 to 5 specific PSD2 / 6AMLD / EBA red flags referencing the exact telemetry, IBAN countries, velocity, account tenure, and triggered deterministic rules.
- next_actions: Array of 3 concrete operational analyst steps with priority ("IMMEDIATE (0-15 min)", "HIGH (Within 1 hr)", "ESCALATION (Same Day)", "STANDARD", or "AUTO-APPROVE"), action, and compliance rationale.
- verification_script: Object containing:
  - en: Polite, professional, anti-tipping-off compliant customer verification call/in-app message script in English referencing exact EUR amount, channel, and last 4 IBAN digits.
  - it: Natural, professional Italian banking compliance verification script referencing exact EUR amount, channel, and last 4 IBAN digits (strictly avoiding 6AMLD tipping-off).`;

    const txSummary = {
      tx_id: transaction.tx_id,
      timestamp: transaction.timestamp,
      sender_iban: transaction.sender_iban,
      receiver_iban: transaction.receiver_iban,
      sender_country: transaction.senderCountry,
      receiver_iban_country: transaction.receiverCountry,
      declared_beneficiary_country: transaction.beneficiaryCountry,
      amount_eur: transaction.amount_eur,
      channel: transaction.channel,
      account_age_days: transaction.account_age_days,
      tx_count_24h: transaction.tx_count_24h,
      device_geo_match: transaction.device_geo_match,
      scenario_context: transaction.scenario || '',
      deterministic_risk_score: transaction.score,
      risk_tier: transaction.tier,
      triage_decision: transaction.action,
      triggered_rules: (transaction.triggeredRules || []).map(
        (r: { code: string; points: number; detail: string }) => `${r.code} (+${r.points} pts): ${r.detail}`
      ),
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Evaluate this European payment transaction for PSD2 & 6AMLD compliance triage:\n${JSON.stringify(txSummary, null, 2)}`,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executive_summary: {
              type: Type.STRING,
              description: '2-3 sentence executive risk summary referencing TX ID, EUR amount, score, and regulatory rationale.',
            },
            red_flags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Specific PSD2 / 6AMLD / EBA red flags identified.',
            },
            next_actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  priority: { type: Type.STRING },
                  action: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ['priority', 'action', 'rationale'],
              },
              description: 'Exactly 3 recommended next analyst actions.',
            },
            verification_script: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                it: { type: Type.STRING },
              },
              required: ['en', 'it'],
            },
          },
          required: ['executive_summary', 'red_flags', 'next_actions', 'verification_script'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);

    res.json({
      mode: 'LIVE_GEMINI',
      model: 'gemini-4-hydrogen',
      generatedAt: new Date().toISOString(),
      executive_summary: parsed.executive_summary || 'Executive summary unavailable.',
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 3) : [],
      verification_script: {
        en: parsed?.verification_script?.en || 'English verification script unavailable.',
        it: parsed?.verification_script?.it || 'Script di verifica in italiano non disponibile.',
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to generate compliance memo with Gemini API.';
    console.error('Gemini triage-memo error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinGuard AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

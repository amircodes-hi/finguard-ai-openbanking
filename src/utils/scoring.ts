import {
  BatchKPIs,
  ComplianceMemo,
  RawTransaction,
  RiskTier,
  RuleThresholds,
  ScoredTransaction,
  TriggeredRule,
} from '../types';
import { BASELINE_RULES, COUNTRY_NAMES } from '../data/sampleTransactions';

export function formatEUR(val: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val) || 0);
}

export function formatEURCompact(val: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(val) || 0);
}

export function formatInt(val: number): string {
  return new Intl.NumberFormat('en-IE').format(Number(val) || 0);
}

export function formatIbanShort(iban: string): string {
  const clean = String(iban || '').replace(/\s+/g, '');
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} •••• ${clean.slice(-4)}`;
}

export function scoreTransaction(
  tx: RawTransaction,
  rules: RuleThresholds = BASELINE_RULES
): ScoredTransaction {
  let rawScore = 0;
  const triggeredRules: TriggeredRule[] = [];

  const senderCountry = (tx.sender_iban || '').replace(/\s+/g, '').slice(0, 2).toUpperCase();
  const receiverCountry = (tx.receiver_iban || '').replace(/\s+/g, '').slice(0, 2).toUpperCase();
  const beneficiaryCountry = (tx.beneficiary_country || receiverCountry || '').toUpperCase();
  const amount = Number(tx.amount_eur) || 0;
  const velocity = Number(tx.tx_count_24h) || 0;
  const ageDays = Number(tx.account_age_days) || 0;
  const geoMatch = Boolean(tx.device_geo_match);
  const channelStr = String(tx.channel || '');

  // Rule 1: Amount Anomaly (> Critical = +35 pts; > Elevated = +25 pts)
  if (amount > rules.criticalAmountEur) {
    rawScore += 35;
    triggeredRules.push({
      code: 'HIGH_VALUE_CRITICAL',
      label: `Critical Value (>€${formatInt(rules.criticalAmountEur)})`,
      points: 35,
      detail: `Transfer of ${formatEUR(amount)} exceeds critical threshold of ${formatEUR(rules.criticalAmountEur)}.`,
    });
  } else if (amount > rules.elevatedAmountEur) {
    rawScore += 25;
    triggeredRules.push({
      code: 'AMOUNT_ANOMALY',
      label: `Amount Anomaly (>€${formatInt(rules.elevatedAmountEur)})`,
      points: 25,
      detail: `Transfer of ${formatEUR(amount)} exceeds elevated monitoring threshold of ${formatEUR(rules.elevatedAmountEur)}.`,
    });
  }

  // Rule 2: Velocity Spike (tx_count_24h >= limit => +25 pts)
  if (velocity >= rules.velocityLimit24h) {
    rawScore += 25;
    triggeredRules.push({
      code: 'VELOCITY_SPIKE',
      label: `Velocity Spike (${velocity} tx/24h)`,
      points: 25,
      detail: `${velocity} outbound transactions in 24h meets/exceeds velocity cap of ${rules.velocityLimit24h}.`,
    });
  }

  // Rule 3: New / Dormant Account Risk (age < window && amount > €2,500 => +20 pts)
  if (ageDays < rules.newAccountDays && amount > rules.newAccountMinAmount) {
    rawScore += 20;
    triggeredRules.push({
      code: 'NEW_ACCOUNT_SPIKE',
      label: `New Account (${ageDays}d)`,
      points: 20,
      detail: `Account age (${ageDays} days < ${rules.newAccountDays}d) combined with value > ${formatEUR(rules.newAccountMinAmount)}.`,
    });
  }

  // Rule 4: Cross-Border / IBAN Jurisdiction Mismatch OR Device Geo Mismatch (+20 pts)
  const isIbanCountryMismatch =
    Boolean(receiverCountry && beneficiaryCountry) && receiverCountry !== beneficiaryCountry;
  const isCrossBorder =
    Boolean(senderCountry && beneficiaryCountry) && senderCountry !== beneficiaryCountry;
  const isGeoMismatch = !geoMatch;

  if (isIbanCountryMismatch || isCrossBorder || isGeoMismatch) {
    const subReasons: string[] = [];
    if (isIbanCountryMismatch) {
      subReasons.push(`Receiver IBAN (${receiverCountry}) ≠ Declared Country (${beneficiaryCountry})`);
    }
    if (isCrossBorder) {
      subReasons.push(`Cross-border corridor (${senderCountry} → ${beneficiaryCountry})`);
    }
    if (isGeoMismatch) {
      subReasons.push('Device/IP geolocation mismatch');
    }

    rawScore += 20;
    triggeredRules.push({
      code: 'GEO_IBAN_MISMATCH',
      label: isIbanCountryMismatch
        ? 'IBAN / Geo Mismatch'
        : isGeoMismatch
        ? 'Device Geo Mismatch'
        : `Cross-Border (${senderCountry}→${beneficiaryCountry})`,
      points: 20,
      detail: subReasons.join(' • '),
    });
  }

  // Rule 5: Virtual IBAN Rapid Pass-Through Indicator (+15 pts)
  const isVirtualIban = channelStr.toLowerCase().includes('virtual iban');
  if (isVirtualIban && (velocity >= 2 || amount >= 2500 || ageDays < 45)) {
    rawScore += 15;
    triggeredRules.push({
      code: 'VIBAN_PASSTHROUGH',
      label: 'Virtual IBAN Pass-Through',
      points: 15,
      detail: `Virtual IBAN rail showing rapid pass-through profile (${velocity} tx/24h, ${formatEUR(amount)}).`,
    });
  }

  const finalScore = Math.min(100, rawScore);

  let tier: RiskTier = 'LOW';
  let action: ScoredTransaction['action'] = 'Approve';
  if (finalScore >= 70) {
    tier = 'HIGH';
    action = 'Freeze & Escalate to AML Team';
  } else if (finalScore >= 35) {
    tier = 'MEDIUM';
    action = 'Step-Up SCA / KYC Review';
  }

  return {
    ...tx,
    senderCountry,
    receiverCountry,
    beneficiaryCountry,
    rawScore,
    score: finalScore,
    tier,
    action,
    triggeredRules,
  };
}

export function computeKPIs(scored: ScoredTransaction[]): BatchKPIs {
  const totalCount = scored.length;
  const totalVolume = scored.reduce((s, t) => s + t.amount_eur, 0);
  const lowList = scored.filter((t) => t.tier === 'LOW');
  const medList = scored.filter((t) => t.tier === 'MEDIUM');
  const highList = scored.filter((t) => t.tier === 'HIGH');

  const exposureAtRisk = [...medList, ...highList].reduce((s, t) => s + t.amount_eur, 0);
  const fraudPrevented = highList.reduce((s, t) => s + t.amount_eur, 0);
  const avgScore = totalCount
    ? Math.round(scored.reduce((s, t) => s + t.score, 0) / totalCount)
    : 0;

  return {
    totalCount,
    totalVolume,
    lowCount: lowList.length,
    medCount: medList.length,
    highCount: highList.length,
    exposureAtRisk,
    fraudPrevented,
    avgScore,
  };
}

export function generateDeterministicComplianceMemo(
  scoredTx: ScoredTransaction,
  activeRules: RuleThresholds
): ComplianceMemo {
  const senderName = COUNTRY_NAMES[scoredTx.senderCountry] || scoredTx.senderCountry;
  const benefName = COUNTRY_NAMES[scoredTx.beneficiaryCountry] || scoredTx.beneficiaryCountry;
  const last4Sender = scoredTx.sender_iban.slice(-4);
  const last4Receiver = scoredTx.receiver_iban.slice(-4);
  const amtFmt = formatEUR(scoredTx.amount_eur);

  const hasCode = (c: string) => scoredTx.triggeredRules.some((r) => r.code === c);

  let executive_summary = '';
  if (scoredTx.tier === 'HIGH') {
    executive_summary = `CRITICAL AML/FRAUD ALERT (${scoredTx.score}/100): Transaction ${scoredTx.tx_id} for ${amtFmt} via ${scoredTx.channel} (${scoredTx.senderCountry} → ${scoredTx.beneficiaryCountry}) exhibits severe composite risk across ${scoredTx.triggeredRules.length} deterministic controls. Immediate pre-settlement freeze and Level-2 AML escalation are warranted under PSD2 Transaction Risk Analysis (TRA) and 6AMLD suspicious activity obligations.`;
  } else if (scoredTx.tier === 'MEDIUM') {
    executive_summary = `ELEVATED REVIEW REQUIRED (${scoredTx.score}/100): Transaction ${scoredTx.tx_id} (${amtFmt} via ${scoredTx.channel}) breaches ${scoredTx.triggeredRules.length} monitoring rules without reaching automatic freeze severity. Recommend PSD2 Strong Customer Authentication (SCA) step-up challenge and documentary verification prior to settlement release.`;
  } else {
    executive_summary = `LOW-RISK PROFILE (${scoredTx.score}/100): Transaction ${scoredTx.tx_id} (${amtFmt} via ${scoredTx.channel}) originates from an established ${scoredTx.account_age_days}-day account with verified device geolocation and low velocity (${scoredTx.tx_count_24h} tx/24h). Eligible for straight-through processing (STP) under PSD2 TRA exemption guidelines.`;
  }

  const red_flags: string[] = [];
  if (hasCode('HIGH_VALUE_CRITICAL')) {
    red_flags.push(
      `High-Value Outflow Anomaly (+35 pts): ${amtFmt} exceeds critical €${formatInt(activeRules.criticalAmountEur)} ceiling, inconsistent with standard low-friction PSD2 TRA exemption thresholds.`
    );
  } else if (hasCode('AMOUNT_ANOMALY')) {
    red_flags.push(
      `Elevated Ticket Size (+25 pts): ${amtFmt} breaches the €${formatInt(activeRules.elevatedAmountEur)} stepped monitoring threshold for ${scoredTx.channel}.`
    );
  }

  if (hasCode('VELOCITY_SPIKE')) {
    red_flags.push(
      `Structuring / Smurfing Velocity (+25 pts): ${scoredTx.tx_count_24h} outbound transfers within 24 hours matches EBA rapid-drain and automated bot/mule dispersal typologies.`
    );
  }

  if (hasCode('NEW_ACCOUNT_SPIKE')) {
    red_flags.push(
      `Newly Onboarded / Dormant Account Spike (+20 pts): Account age of ${scoredTx.account_age_days} days initiating ${amtFmt} indicates potential synthetic onboarding or hijacked mule account behavior.`
    );
  }

  if (hasCode('GEO_IBAN_MISMATCH')) {
    const ibanMismatch = scoredTx.receiverCountry !== scoredTx.beneficiaryCountry;
    if (ibanMismatch) {
      red_flags.push(
        `IBAN Jurisdiction Discrepancy (+20 pts): Receiver IBAN prefix (${scoredTx.receiverCountry}) conflicts with declared beneficiary country (${scoredTx.beneficiaryCountry}), a primary indicator of BEC invoice redirection or shell routing.`
      );
    }
    if (!scoredTx.device_geo_match) {
      red_flags.push(
        `PSD2 Session Telemetry Anomaly (+20 pts): Device IP/geolocation failed to match registered customer jurisdiction (${senderName}), elevating Account Takeover (ATO) probability.`
      );
    }
    if (!ibanMismatch && scoredTx.device_geo_match) {
      red_flags.push(
        `Cross-Border Settlement Corridor (+20 pts): Outbound flow from ${senderName} (${scoredTx.senderCountry}) to ${benefName} (${scoredTx.beneficiaryCountry}) requires enhanced counterparty screening.`
      );
    }
  }

  if (hasCode('VIBAN_PASSTHROUGH')) {
    red_flags.push(
      `Virtual IBAN Layering Indicator (+15 pts): Virtual IBAN rail (${scoredTx.tx_count_24h} tx/24h) aligns with EBA Risk Factor Guidelines on rapid pass-through mule networks obscuring ultimate beneficial ownership (UBO).`
    );
  }

  if (red_flags.length === 0) {
    red_flags.push(
      'No material PSD2 or 6AMLD red flags triggered. Device telemetry, account tenure, velocity, and domestic IBAN alignment are within normal customer baseline.'
    );
  }

  let next_actions = [];
  if (scoredTx.tier === 'HIGH') {
    next_actions = [
      {
        priority: 'IMMEDIATE (0–15 min)',
        action: `Place temporary outbound hold on ${scoredTx.tx_id} (${amtFmt}) and freeze linked Virtual/Primary IBAN session tokens.`,
        rationale: 'Prevents irrevocable SEPA Instant / PIS settlement loss while preserving audit trail.',
      },
      {
        priority: 'HIGH (Within 1 hr)',
        action: `Execute out-of-band KYC/KYB callback & request underlying commercial invoice, UBO registry extract, and Source of Funds (SoF) evidence for beneficiary in ${benefName}.`,
        rationale: 'Validates genuine economic purpose without tipping off the subject under 6AMLD Art. 39.',
      },
      {
        priority: 'ESCALATION (Same Day)',
        action: `Escalate dossier to FIU / MLRO for Suspicious Transaction Report (STR) evaluation and cross-check receiver IBAN (••${last4Receiver}) against internal mule graphs.`,
        rationale: 'Identifies upstream funding accounts and potential multi-victim APP/BEC fraud rings.',
      },
    ];
  } else if (scoredTx.tier === 'MEDIUM') {
    next_actions = [
      {
        priority: 'IMMEDIATE',
        action: `Trigger PSD2 Step-Up Strong Customer Authentication (biometric + dynamic linking to ${amtFmt} & IBAN ••${last4Receiver}).`,
        rationale: 'Mitigates unauthorized session / credential compromise prior to payment release.',
      },
      {
        priority: 'HIGH (Within 2 hrs)',
        action: `Request supporting invoice or contract verifying commercial relationship with beneficiary in ${benefName}.`,
        rationale: 'Confirms legitimacy of elevated transfer amount and cross-border destination.',
      },
      {
        priority: 'STANDARD',
        action: `Review last 30 days of account logins, IP ASN fingerprints, and beneficiary additions; whitelist counterparty if verified.`,
        rationale: 'Reduces future false positives while ensuring continuous behavioral monitoring.',
      },
    ];
  } else {
    next_actions = [
      {
        priority: 'AUTO-APPROVE',
        action: `Release ${scoredTx.tx_id} (${amtFmt}) for standard SEPA clearing under automated low-risk STP policy.`,
        rationale: 'Score falls within 0–34 baseline with zero high-severity anomalies.',
      },
      {
        priority: 'MONITOR',
        action: `Log transaction into rolling 24h velocity & counterparty baseline model for account ••${last4Sender}.`,
        rationale: 'Maintains continuous PSD2 Transaction Risk Analysis (TRA) audit evidence.',
      },
      {
        priority: 'ARCHIVE',
        action: `Retain deterministic rule evaluation snapshot in 5-year AML compliance archive.`,
        rationale: 'Ensures full regulatory auditability for national competent authorities (NCAs).',
      },
    ];
  }

  let scriptEn = '';
  let scriptIt = '';

  if (scoredTx.tier === 'HIGH') {
    scriptEn = `Hello, this is the Fraud & Payment Security Team at FinGuard Partner Bank calling regarding a recent outbound payment of ${amtFmt} initiated from your account ending in ••${last4Sender} via ${scoredTx.channel} to an account ending in ••${last4Receiver} (${benefName}). As part of our standard PSD2 payment protection controls, this transfer has been temporarily paused for security verification. Could you please confirm: (1) whether you personally authorized this payment today, (2) the exact commercial purpose and recipient name, and (3) upload the supporting invoice via our secure portal? For your security, please do not share your OTP or PIN with anyone — we only require confirmation through your authenticated banking app.`;
    scriptIt = `Buongiorno, la contatto dal Team Sicurezza Pagamenti e Prevenzione Frodi in merito a un bonifico in uscita di ${amtFmt} disposto dal suo conto terminante in ••${last4Sender} tramite ${scoredTx.channel} verso l'IBAN terminante in ••${last4Receiver} (${benefName}). Nell'ambito dei nostri controlli di tutela PSD2, l'operazione è stata temporaneamente sospesa per una verifica di sicurezza. Può gentilmente confermarci: (1) se ha autorizzato personalmente questa disposizione oggi, (2) la causale commerciale esatta e l'identità del beneficiario, e (3) caricare la fattura o documentazione di supporto nell'area riservata della sua app? Per la sua sicurezza, non le chiederemo mai codici OTP o PIN: la verifica avverrà esclusivamente tramite canale autenticato.`;
  } else if (scoredTx.tier === 'MEDIUM') {
    scriptEn = `Hello, this is Compliance & Payment Operations reaching out for a quick PSD2 verification on your ${scoredTx.channel} transfer of ${amtFmt} from account ••${last4Sender} to beneficiary account ••${last4Receiver} in ${benefName}. Because this transfer exceeds your routine corridor or value profile, we have sent an in-app biometric confirmation prompt. Once you approve the dynamic-linking prompt and confirm the beneficiary details match your invoice, we will release the settlement immediately.`;
    scriptIt = `Buongiorno, la contattiamo dal supporto Operazioni e Sicurezza Pagamenti per una breve conferma PSD2 relativa al suo trasferimento ${scoredTx.channel} di ${amtFmt} dal conto ••${last4Sender} al beneficiario con IBAN ••${last4Receiver} (${benefName}). Poiché l'importo o la destinazione superano i parametri abituali del profilo, abbiamo inviato una notifica di autenticazione forte (SCA) nella sua app bancaria. Appena confermerà l'operazione in app e l'esattezza dei dati del beneficiario, procederemo subito con l'esecuzione del pagamento.`;
  } else {
    scriptEn = `Routine confirmation (optional — STP approved): Your ${scoredTx.channel} payment of ${amtFmt} (Ref: ${scoredTx.tx_id}) from account ••${last4Sender} to beneficiary ••${last4Receiver} (${benefName}) has cleared automated security checks and is being processed on schedule. If you did not authorize this transaction, please contact our 24/7 Fraud Desk immediately.`;
    scriptIt = `Conferma di routine (opzionale — approvazione automatica): Il suo pagamento ${scoredTx.channel} di ${amtFmt} (Rif: ${scoredTx.tx_id}) dal conto ••${last4Sender} al beneficiario ••${last4Receiver} (${benefName}) ha superato i controlli automatici di sicurezza ed è in corso di regolamento. Qualora non riconoscesse questa operazione, la invitiamo a contattare immediatamente il nostro servizio antifrode attivo 24/7.`;
  }

  return {
    mode: 'SIMULATED',
    generatedAt: new Date().toISOString(),
    executive_summary,
    red_flags,
    next_actions,
    verification_script: {
      en: scriptEn,
      it: scriptIt,
    },
  };
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

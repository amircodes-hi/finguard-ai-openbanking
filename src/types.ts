export type PaymentChannel =
  | 'SEPA Instant'
  | 'SEPA Credit'
  | 'Virtual IBAN'
  | 'Open Banking PIS'
  | 'SWIFT Cross-Border'
  | string;

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type RuleCode =
  | 'HIGH_VALUE_CRITICAL'
  | 'AMOUNT_ANOMALY'
  | 'VELOCITY_SPIKE'
  | 'NEW_ACCOUNT_SPIKE'
  | 'GEO_IBAN_MISMATCH'
  | 'VIBAN_PASSTHROUGH';

export interface RawTransaction {
  tx_id: string;
  timestamp: string;
  sender_iban: string;
  receiver_iban: string;
  beneficiary_country: string;
  amount_eur: number;
  channel: PaymentChannel;
  account_age_days: number;
  tx_count_24h: number;
  device_geo_match: boolean;
  scenario?: string;
}

export interface TriggeredRule {
  code: RuleCode;
  label: string;
  points: number;
  detail: string;
}

export interface ScoredTransaction extends RawTransaction {
  senderCountry: string;
  receiverCountry: string;
  beneficiaryCountry: string;
  rawScore: number;
  score: number;
  tier: RiskTier;
  action: 'Approve' | 'Step-Up SCA / KYC Review' | 'Freeze & Escalate to AML Team';
  triggeredRules: TriggeredRule[];
}

export interface RuleThresholds {
  elevatedAmountEur: number;
  criticalAmountEur: number;
  velocityLimit24h: number;
  newAccountDays: number;
  newAccountMinAmount: number;
}

export interface AnalystNextAction {
  priority: string;
  action: string;
  rationale: string;
}

export interface ComplianceMemo {
  mode: 'SIMULATED' | 'LIVE_GEMINI';
  model?: string;
  generatedAt: string;
  executive_summary: string;
  red_flags: string[];
  next_actions: AnalystNextAction[];
  verification_script: {
    en: string;
    it: string;
  };
}

export interface BatchKPIs {
  totalCount: number;
  totalVolume: number;
  lowCount: number;
  medCount: number;
  highCount: number;
  exposureAtRisk: number;
  fraudPrevented: number;
  avgScore: number;
}

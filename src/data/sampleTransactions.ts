import { RawTransaction, RuleCode, RuleThresholds } from '../types';

export const BASELINE_RULES: Readonly<RuleThresholds> = Object.freeze({
  elevatedAmountEur: 10000,   // > €10,000 => +25 pts
  criticalAmountEur: 25000,   // > €25,000 => +35 pts
  velocityLimit24h: 5,        // >= 5 tx/24h => +25 pts
  newAccountDays: 30,         // < 30 days & > €2,500 => +20 pts
  newAccountMinAmount: 2500,
});

export const COUNTRY_NAMES: Record<string, string> = {
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  AT: 'Austria',
  PL: 'Poland',
  PT: 'Portugal',
  IE: 'Ireland',
  LT: 'Lithuania',
  EE: 'Estonia',
  LV: 'Latvia',
  CY: 'Cyprus',
  MT: 'Malta',
  LU: 'Luxembourg',
  SE: 'Sweden',
  DK: 'Denmark',
  FI: 'Finland',
  CH: 'Switzerland',
  GB: 'United Kingdom',
  CZ: 'Czechia',
  GR: 'Greece',
  RO: 'Romania',
  BG: 'Bulgaria',
};

export const RULE_META: Record<
  RuleCode,
  {
    short: string;
    textClass: string;
    chartLabel: string;
    chartKey: 'AMOUNT' | 'VELOCITY' | 'NEW_ACCOUNT' | 'GEO_IBAN' | 'VIBAN';
    barColor: string;
  }
> = {
  HIGH_VALUE_CRITICAL: {
    short: 'Amount > Critical',
    textClass: 'text-rose-700',
    chartLabel: 'Amount Anomaly (>€10k / >€25k)',
    chartKey: 'AMOUNT',
    barColor: '#E11D48',
  },
  AMOUNT_ANOMALY: {
    short: 'Amount Anomaly',
    textClass: 'text-amber-700',
    chartLabel: 'Amount Anomaly (>€10k / >€25k)',
    chartKey: 'AMOUNT',
    barColor: '#E11D48',
  },
  VELOCITY_SPIKE: {
    short: 'Velocity Spike',
    textClass: 'text-orange-700',
    chartLabel: '24h Velocity Spike',
    chartKey: 'VELOCITY',
    barColor: '#F97316',
  },
  NEW_ACCOUNT_SPIKE: {
    short: 'New/Dormant Spike',
    textClass: 'text-purple-700',
    chartLabel: 'New / Dormant Account Risk',
    chartKey: 'NEW_ACCOUNT',
    barColor: '#8B5CF6',
  },
  GEO_IBAN_MISMATCH: {
    short: 'Cross-Border / Geo Mismatch',
    textClass: 'text-indigo-700',
    chartLabel: 'Cross-Border / IBAN / Geo Mismatch',
    chartKey: 'GEO_IBAN',
    barColor: '#4F46E5',
  },
  VIBAN_PASSTHROUGH: {
    short: 'Virtual IBAN Pass-Through',
    textClass: 'text-sky-700',
    chartLabel: 'Virtual IBAN Pass-Through',
    chartKey: 'VIBAN',
    barColor: '#0284C7',
  },
};

export function getSampleTransactions(): RawTransaction[] {
  const now = Date.now();
  const minsAgo = (m: number) =>
    new Date(now - m * 60000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  return [
    {
      tx_id: 'TX-EU-9001',
      timestamp: minsAgo(14),
      sender_iban: 'DE89370400440532013000',
      receiver_iban: 'DE12500105170648489890',
      beneficiary_country: 'DE',
      amount_eur: 4250.0,
      channel: 'SEPA Credit',
      account_age_days: 482,
      tx_count_24h: 1,
      device_geo_match: true,
      scenario: 'Normal B2B domestic supplier invoice (Munich -> Frankfurt)',
    },
    {
      tx_id: 'TX-EU-9002',
      timestamp: minsAgo(28),
      sender_iban: 'FR7630006000011234567890189',
      receiver_iban: 'IT60X0542811101000000123456',
      beneficiary_country: 'IT',
      amount_eur: 6800.0,
      channel: 'SEPA Credit',
      account_age_days: 715,
      tx_count_24h: 2,
      device_geo_match: true,
      scenario: 'Routine cross-border EU B2B logistics settlement (Paris -> Milan)',
    },
    {
      tx_id: 'TX-EU-9003',
      timestamp: minsAgo(41),
      sender_iban: 'DE44500105175407324931',
      receiver_iban: 'PL61109010140000071219812874',
      beneficiary_country: 'PL',
      amount_eur: 14500.0,
      channel: 'SEPA Instant',
      account_age_days: 310,
      tx_count_24h: 2,
      device_geo_match: true,
      scenario: 'Elevated B2B industrial equipment settlement via SEPA Instant',
    },
    {
      tx_id: 'TX-EU-9004',
      timestamp: minsAgo(53),
      sender_iban: 'IT28W8000000292100645211151',
      receiver_iban: 'IT99C0300203280784152398412',
      beneficiary_country: 'IT',
      amount_eur: 7900.0,
      channel: 'Virtual IBAN',
      account_age_days: 12,
      tx_count_24h: 3,
      device_geo_match: false,
      scenario: 'Dormant / newly onboarded account spike via Virtual IBAN with VPN geo mismatch',
    },
    {
      tx_id: 'TX-EU-9005',
      timestamp: minsAgo(67),
      sender_iban: 'ES9121000418450200051332',
      receiver_iban: 'ES7921000813610123456789',
      beneficiary_country: 'ES',
      amount_eur: 3650.0,
      channel: 'Virtual IBAN',
      account_age_days: 94,
      tx_count_24h: 7,
      device_geo_match: false,
      scenario: 'Rapid velocity burst (7 transfers in 24h) splitting below €5k threshold',
    },
    {
      tx_id: 'TX-EU-9006',
      timestamp: minsAgo(82),
      sender_iban: 'IT60X0542811101000000489210',
      receiver_iban: 'LT121000011101001000',
      beneficiary_country: 'CY',
      amount_eur: 26400.0,
      channel: 'SEPA Instant',
      account_age_days: 22,
      tx_count_24h: 3,
      device_geo_match: false,
      scenario: 'IBAN/country jurisdiction mismatch (LT IBAN vs declared CY beneficiary) + >€25k spike',
    },
    {
      tx_id: 'TX-EU-9007',
      timestamp: minsAgo(105),
      sender_iban: 'NL91ABNA0417164300',
      receiver_iban: 'CY17002001280000001200527600',
      beneficiary_country: 'CY',
      amount_eur: 42500.0,
      channel: 'Open Banking PIS',
      account_age_days: 18,
      tx_count_24h: 5,
      device_geo_match: false,
      scenario: 'Sudden high-value cross-border Open Banking PIS transfer from newly funded account',
    },
    {
      tx_id: 'TX-EU-9008',
      timestamp: minsAgo(129),
      sender_iban: 'BE68539007547034',
      receiver_iban: 'EE382200221020145685',
      beneficiary_country: 'EE',
      amount_eur: 19800.0,
      channel: 'Virtual IBAN',
      account_age_days: 9,
      tx_count_24h: 9,
      device_geo_match: false,
      scenario: 'Classic mule-account Virtual IBAN rapid pass-through layering (9 tx/24h)',
    },
  ];
}

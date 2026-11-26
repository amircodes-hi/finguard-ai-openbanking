import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  ShieldAlert,
  Euro,
  ShieldCheck,
  LayoutDashboard,
  ListChecks,
  BarChart3,
  SlidersHorizontal,
  PlusCircle,
  Upload,
  Database,
  Plus,
  FileSpreadsheet,
  FlaskConical,
  Download,
  FileJson,
  Search,
  Sparkles,
  X,
  ArrowRight,
  Inbox,
  Scale,
  Bot,
  RefreshCw,
  AlertCircle,
  Copy,
  Loader2,
  AlertTriangle,
  UploadCloud,
  Menu,
  CheckCircle2,
} from 'lucide-react';
import {
  BASELINE_RULES,
  RULE_META,
  getSampleTransactions,
} from './data/sampleTransactions';
import {
  ComplianceMemo,
  RawTransaction,
  RuleThresholds,
  ScoredTransaction,
} from './types';
import {
  computeKPIs,
  formatEUR,
  formatEURCompact,
  formatIbanShort,
  formatInt,
  generateDeterministicComplianceMemo,
  parseCSVLine,
  scoreTransaction,
} from './utils/scoring';

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export default function App() {
  const [transactions, setTransactions] = useState<RawTransaction[]>(() =>
    getSampleTransactions()
  );
  const [activeRules, setActiveRules] = useState<RuleThresholds>({
    ...BASELINE_RULES,
  });

  // Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<
    'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'FLAGGED'
  >('ALL');
  const [sortOrder, setSortOrder] = useState<
    'score_desc' | 'amount_desc' | 'time_desc' | 'score_asc'
  >('score_desc');

  // Drawers & Modals
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [addTxModalOpen, setAddTxModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  // Simulator draft sliders
  const [simRules, setSimRules] = useState<RuleThresholds>({
    ...BASELINE_RULES,
  });

  // AI Copilot State
  const [copilotEngine, setCopilotEngine] = useState<'LIVE_GEMINI' | 'SIMULATED'>(
    'SIMULATED'
  );
  const [memoCache, setMemoCache] = useState<Record<string, ComplianceMemo>>({});
  const [loadingMemoTxId, setLoadingMemoTxId] = useState<string | null>(null);
  const [memoError, setMemoError] = useState<string>('');
  const [scriptLang, setScriptLang] = useState<'en' | 'it'>('en');

  // Add Transaction Form State
  const [fTxId, setFTxId] = useState('TX-EU-9009');
  const [fChannel, setFChannel] = useState('SEPA Instant');
  const [fSenderIban, setFSenderIban] = useState('IT60X0542811101000000772190');
  const [fReceiverIban, setFReceiverIban] = useState('LT601010012345678901');
  const [fCountry, setFCountry] = useState('CY');
  const [fAmount, setFAmount] = useState('16400');
  const [fAge, setFAge] = useState('19');
  const [fVelocity, setFVelocity] = useState('6');
  const [fGeoMatch, setFGeoMatch] = useState<'true' | 'false'>('false');
  const [fNotes, setFNotes] = useState('');

  // CSV Import Mode
  const [csvImportMode, setCsvImportMode] = useState<'append' | 'replace'>('append');

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  };

  // Escape key closes drawers & modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTxId(null);
        setSimulatorOpen(false);
        setAddTxModalOpen(false);
        setCsvModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Score all transactions with active rules
  const scoredTransactions = useMemo(
    () => transactions.map((tx) => scoreTransaction(tx, activeRules)),
    [transactions, activeRules]
  );

  // Batch KPIs
  const kpis = useMemo(() => computeKPIs(scoredTransactions), [scoredTransactions]);

  // Check if active rules differ from EBA baseline
  const isRulesModified =
    activeRules.elevatedAmountEur !== BASELINE_RULES.elevatedAmountEur ||
    activeRules.criticalAmountEur !== BASELINE_RULES.criticalAmountEur ||
    activeRules.velocityLimit24h !== BASELINE_RULES.velocityLimit24h ||
    activeRules.newAccountDays !== BASELINE_RULES.newAccountDays;

  // Filtered and sorted transactions for table
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = scoredTransactions.filter((tx) => {
      if (decisionFilter === 'HIGH' && tx.tier !== 'HIGH') return false;
      if (decisionFilter === 'MEDIUM' && tx.tier !== 'MEDIUM') return false;
      if (decisionFilter === 'LOW' && tx.tier !== 'LOW') return false;
      if (decisionFilter === 'FLAGGED' && tx.tier === 'LOW') return false;

      if (q) {
        const hay =
          `${tx.tx_id} ${tx.sender_iban} ${tx.receiver_iban} ${tx.beneficiaryCountry} ${tx.channel} ${tx.action} ${tx.scenario || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortOrder === 'score_desc') return b.score - a.score || b.amount_eur - a.amount_eur;
      if (sortOrder === 'score_asc') return a.score - b.score;
      if (sortOrder === 'amount_desc') return b.amount_eur - a.amount_eur;
      if (sortOrder === 'time_desc')
        return String(b.timestamp).localeCompare(String(a.timestamp));
      return 0;
    });

    return list;
  }, [scoredTransactions, searchQuery, decisionFilter, sortOrder]);

  // Selected Transaction object
  const selectedTx = useMemo(
    () => scoredTransactions.find((t) => t.tx_id === selectedTxId) || null,
    [scoredTransactions, selectedTxId]
  );

  // Chart 2: Rule Exposure Data
  const ruleExposureData = useMemo(() => {
    const buckets = {
      AMOUNT: {
        key: 'AMOUNT',
        label: 'Amount Anomaly (>€10k / >€25k)',
        exposure: 0,
        color: '#E11D48',
      },
      VELOCITY: {
        key: 'VELOCITY',
        label: '24h Velocity Spike',
        exposure: 0,
        color: '#F97316',
      },
      NEW_ACCOUNT: {
        key: 'NEW_ACCOUNT',
        label: 'New / Dormant Account Risk',
        exposure: 0,
        color: '#8B5CF6',
      },
      GEO_IBAN: {
        key: 'GEO_IBAN',
        label: 'Cross-Border / IBAN / Geo Mismatch',
        exposure: 0,
        color: '#4F46E5',
      },
      VIBAN: {
        key: 'VIBAN',
        label: 'Virtual IBAN Pass-Through',
        exposure: 0,
        color: '#0284C7',
      },
    };

    scoredTransactions.forEach((tx) => {
      const seen = new Set<string>();
      tx.triggeredRules.forEach((r) => {
        const meta = RULE_META[r.code];
        if (meta && !seen.has(meta.chartKey)) {
          seen.add(meta.chartKey);
          buckets[meta.chartKey].exposure += tx.amount_eur;
        }
      });
    });

    const arr = Object.values(buckets);
    const maxExp = Math.max(...arr.map((b) => b.exposure), 1);
    return { items: arr, maxExp };
  }, [scoredTransactions]);

  // Simulator Impact Preview
  const simulationImpact = useMemo(() => {
    const effectiveRules: RuleThresholds = {
      ...simRules,
      criticalAmountEur:
        simRules.criticalAmountEur <= simRules.elevatedAmountEur
          ? simRules.elevatedAmountEur + 5000
          : simRules.criticalAmountEur,
    };

    const baselineScored = transactions.map((tx) =>
      scoreTransaction(tx, BASELINE_RULES)
    );
    const simulatedScored = transactions.map((tx) =>
      scoreTransaction(tx, effectiveRules)
    );

    const baseKpi = computeKPIs(baselineScored);
    const simKpi = computeKPIs(simulatedScored);

    const countEstFalsePositives = (list: ScoredTransaction[]) =>
      list.filter(
        (t) =>
          t.tier !== 'LOW' &&
          t.device_geo_match &&
          t.account_age_days >= 180 &&
          t.receiverCountry === t.beneficiaryCountry &&
          t.tx_count_24h < 4
      ).length;

    const baseFP = countEstFalsePositives(baselineScored);
    const simFP = countEstFalsePositives(simulatedScored);

    const changedTxs: Array<{
      tx_id: string;
      amount: number;
      fromTier: string;
      toTier: string;
      fromScore: number;
      toScore: number;
    }> = [];

    for (let i = 0; i < baselineScored.length; i++) {
      const b = baselineScored[i];
      const s = simulatedScored[i];
      if (b.tier !== s.tier || b.score !== s.score) {
        changedTxs.push({
          tx_id: b.tx_id,
          amount: b.amount_eur,
          fromTier: b.tier,
          toTier: s.tier,
          fromScore: b.score,
          toScore: s.score,
        });
      }
    }

    return {
      effectiveRules,
      baseKpi,
      simKpi,
      fpDelta: simFP - baseFP,
      simFP,
      caughtDelta: simKpi.fraudPrevented - baseKpi.fraudPrevented,
      changedTxs,
    };
  }, [transactions, simRules]);

  // Actions
  const scrollToSection = (id: string) => {
    setMobileSidebarOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectDecisionFilter = (
    tier: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'FLAGGED'
  ) => {
    setDecisionFilter(tier);
    scrollToSection('queueSection');
  };

  const openSimulator = () => {
    setSimRules({ ...activeRules });
    setSimulatorOpen(true);
    setMobileSidebarOpen(false);
  };

  const applySimulatedThresholds = () => {
    setActiveRules({ ...simulationImpact.effectiveRules });
    setMemoCache({});
    setSimulatorOpen(false);
    showToast('Updated live deterministic risk thresholds across batch.', 'success');
  };

  const resetRulesToBaseline = () => {
    setActiveRules({ ...BASELINE_RULES });
    setSimRules({ ...BASELINE_RULES });
    setMemoCache({});
    showToast('Restored EBA baseline risk thresholds.', 'info');
  };

  const loadSampleBatch = () => {
    setTransactions(getSampleTransactions());
    setMemoCache({});
    setSelectedTxId(null);
    showToast(
      'Loaded 8 curated European Open Banking & SEPA sample transactions.',
      'success'
    );
  };

  const openAddTransactionModal = () => {
    const nextNum = 9001 + transactions.length + Math.floor(Math.random() * 80);
    setFTxId(`TX-EU-${nextNum}`);
    setFSenderIban('IT60X0542811101000000772190');
    setFReceiverIban('LT601010012345678901');
    setFCountry('CY');
    setFAmount('16400');
    setFAge('19');
    setFVelocity('6');
    setFGeoMatch('false');
    setFNotes('');
    setAddTxModalOpen(true);
    setMobileSidebarOpen(false);
  };

  const handleAddTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: RawTransaction = {
      tx_id: fTxId.trim() || `TX-EU-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      sender_iban: fSenderIban.replace(/\s+/g, '').toUpperCase(),
      receiver_iban: fReceiverIban.replace(/\s+/g, '').toUpperCase(),
      beneficiary_country: fCountry.trim().slice(0, 2).toUpperCase(),
      amount_eur: parseFloat(fAmount) || 0,
      channel: fChannel,
      account_age_days: parseInt(fAge, 10) || 0,
      tx_count_24h: parseInt(fVelocity, 10) || 1,
      device_geo_match: fGeoMatch === 'true',
      scenario: fNotes.trim() || 'Manually added compliance case',
    };

    setTransactions((prev) => [newTx, ...prev]);
    setAddTxModalOpen(false);
    setSelectedTxId(newTx.tx_id);
    showToast(
      `Transaction ${newTx.tx_id} scored and added to triage queue.`,
      'success'
    );
  };

  // Generate AI Memo (Simulated or Server-Side Gemini 4 Hydrogen)
  const generateMemoForTx = async (
    tx: ScoredTransaction,
    forceMode?: 'SIMULATED' | 'LIVE_GEMINI'
  ) => {
    const modeToUse = forceMode || copilotEngine;
    setLoadingMemoTxId(tx.tx_id);
    setMemoError('');

    try {
      let memo: ComplianceMemo;
      if (modeToUse === 'SIMULATED') {
        await new Promise((r) => setTimeout(r, 350));
        memo = generateDeterministicComplianceMemo(tx, activeRules);
      } else {
        const res = await fetch('/api/gemini/triage-memo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transaction: tx }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error || `Server returned status ${res.status} from Gemini endpoint.`
          );
        }
        memo = data as ComplianceMemo;
      }

      setMemoCache((prev) => ({ ...prev, [tx.tx_id]: memo }));
      showToast(
        modeToUse === 'SIMULATED'
          ? `Generated deterministic compliance brief for ${tx.tx_id}.`
          : `Live Gemini AI investigation brief generated for ${tx.tx_id}.`,
        'success'
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unable to reach Gemini API endpoint.';
      setMemoError(msg);
    } finally {
      setLoadingMemoTxId(null);
    }
  };

  const copyActiveScript = () => {
    if (!selectedTx) return;
    const memo = memoCache[selectedTx.tx_id];
    if (!memo) return;
    const text =
      scriptLang === 'it' ? memo.verification_script.it : memo.verification_script.en;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        showToast(
          `Copied ${scriptLang === 'it' ? 'Italian' : 'English'} verification script to clipboard.`,
          'success'
        );
      })
      .catch(() => {
        showToast('Clipboard copy blocked by browser permissions.', 'warning');
      });
  };

  // File Downloads & CSV Ingestion
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSampleCSVTemplate = () => {
    const header =
      'tx_id,timestamp,sender_iban,receiver_iban,beneficiary_country,amount_eur,channel,account_age_days,tx_count_24h,device_geo_match';
    const rows = [
      'TX-CSV-101,2026-05-12 09:14 UTC,DE89370400440532013000,NL91ABNA0417164300,NL,5400.00,SEPA Credit,410,1,true',
      'TX-CSV-102,2026-05-12 09:22 UTC,IT60X0542811101000000123456,LT121000011101001000,CY,29500.00,Virtual IBAN,11,8,false',
      'TX-CSV-103,2026-05-12 09:35 UTC,FR7630006000011234567890189,ES9121000418450200051332,ES,13200.00,SEPA Instant,190,2,true',
    ];
    downloadFile(
      [header, ...rows].join('\n'),
      'FinGuard_Sample_Import_Template.csv',
      'text/csv;charset=utf-8;'
    );
    showToast('Sample CSV template downloaded.', 'info');
  };

  const handleCSVFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length < 2) {
          throw new Error(
            'CSV file must contain a header row and at least one transaction row.'
          );
        }

        const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
        const required = [
          'tx_id',
          'timestamp',
          'sender_iban',
          'receiver_iban',
          'beneficiary_country',
          'amount_eur',
          'channel',
          'account_age_days',
          'tx_count_24h',
          'device_geo_match',
        ];
        const missing = required.filter((col) => !headers.includes(col));
        if (missing.length > 0) {
          throw new Error(`Missing required columns: ${missing.join(', ')}`);
        }

        const idx = (col: string) => headers.indexOf(col);
        const imported: RawTransaction[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < required.length) continue;

          const rawGeo = String(cols[idx('device_geo_match')] || '').toLowerCase();
          const geoBool = ['true', '1', 'yes', 'y'].includes(rawGeo);
          const amount = parseFloat(cols[idx('amount_eur')]);
          const age = parseInt(cols[idx('account_age_days')], 10);
          const vel = parseInt(cols[idx('tx_count_24h')], 10);

          if (!cols[idx('tx_id')] || Number.isNaN(amount)) continue;

          imported.push({
            tx_id: cols[idx('tx_id')],
            timestamp:
              cols[idx('timestamp')] ||
              new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
            sender_iban: cols[idx('sender_iban')].replace(/\s+/g, '').toUpperCase(),
            receiver_iban: cols[idx('receiver_iban')].replace(/\s+/g, '').toUpperCase(),
            beneficiary_country: cols[idx('beneficiary_country')]
              .slice(0, 2)
              .toUpperCase(),
            amount_eur: amount,
            channel: cols[idx('channel')] || 'SEPA Instant',
            account_age_days: Number.isNaN(age) ? 30 : age,
            tx_count_24h: Number.isNaN(vel) ? 1 : vel,
            device_geo_match: geoBool,
            scenario: 'Imported via Compliance CSV batch',
          });
        }

        if (imported.length === 0) {
          throw new Error('No valid transaction rows could be parsed from the CSV.');
        }

        if (csvImportMode === 'replace') {
          setTransactions(imported);
          setMemoCache({});
        } else {
          setTransactions((prev) => [...imported, ...prev]);
        }

        setCsvModalOpen(false);
        e.target.value = '';
        showToast(
          `Successfully imported & scored ${imported.length} CSV transaction(s).`,
          'success'
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV.';
        showToast(`CSV Import Error: ${msg}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const exportAuditCSV = () => {
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'tx_id',
      'timestamp',
      'sender_iban',
      'receiver_iban',
      'beneficiary_country',
      'amount_eur',
      'channel',
      'account_age_days',
      'tx_count_24h',
      'device_geo_match',
      'risk_score',
      'risk_tier',
      'triage_action',
      'triggered_rules',
      'rule_breakdown',
    ];

    const lines = [headers.join(',')];
    scoredTransactions.forEach((tx) => {
      const codes = tx.triggeredRules.map((r) => r.code).join('; ');
      const breakdown = tx.triggeredRules
        .map((r) => `${r.code}(+${r.points})`)
        .join(' | ');
      lines.push(
        [
          tx.tx_id,
          tx.timestamp,
          tx.sender_iban,
          tx.receiver_iban,
          tx.beneficiaryCountry,
          tx.amount_eur.toFixed(2),
          tx.channel,
          tx.account_age_days,
          tx.tx_count_24h,
          tx.device_geo_match,
          tx.score,
          tx.tier,
          tx.action,
          codes || 'NONE',
          breakdown || 'NONE',
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(
      lines.join('\n'),
      `FinGuard_Compliance_Audit_${dateStr}.csv`,
      'text/csv;charset=utf-8;'
    );
    showToast(
      `Exported ${scoredTransactions.length} scored transactions to Compliance Audit CSV.`,
      'success'
    );
  };

  const exportBatchJSON = () => {
    const payload = {
      application:
        'FinGuard AI — Open Banking & Anti-Fraud Transaction Triage Copilot',
      exported_at: new Date().toISOString(),
      regulatory_framework: [
        'PSD2 RTS on SCA/TRA',
        '6AMLD / EU AMLR',
        'EBA Fraud Reporting Guidelines',
      ],
      active_rule_thresholds: { ...activeRules },
      summary_kpis: kpis,
      cases: scoredTransactions.map((tx) => ({
        ...tx,
        ai_compliance_memo: memoCache[tx.tx_id] || null,
      })),
    };
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(
      JSON.stringify(payload, null, 2),
      `FinGuard_Batch_Case_Dossier_${dateStr}.json`,
      'application/json'
    );
    showToast('Exported complete Case Dossier JSON.', 'success');
  };

  const exportSelectedCaseJSON = () => {
    if (!selectedTx) return;
    const payload = {
      application: 'FinGuard AI — Single Case AML Triage Dossier',
      exported_at: new Date().toISOString(),
      active_rule_thresholds: { ...activeRules },
      transaction_audit: selectedTx,
      ai_investigation_memo: memoCache[selectedTx.tx_id] || null,
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `FinGuard_Case_${selectedTx.tx_id}.json`,
      'application/json'
    );
    showToast(`Exported case dossier for ${selectedTx.tx_id}.`, 'success');
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ==================== DEEP NAVY SIDEBAR ==================== */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#0F172A] text-slate-200 flex flex-col border-r border-[#1E293B] transform transition-transform duration-200 shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#1E293B]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-white tracking-tight leading-none text-[15px]">
                FinGuard AI
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">
                EU AML &amp; Open Banking
              </div>
            </div>
          </div>
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-xs font-medium text-slate-400">
            Compliance Workspace
          </div>

          <button
            onClick={() => scrollToSection('topWorkspace')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#1E293B] text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <LayoutDashboard className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Triage Dashboard</span>
          </button>

          <button
            onClick={() => scrollToSection('queueSection')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-[#1E293B]/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <span className="flex items-center gap-3">
              <ListChecks className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Transaction Queue</span>
            </span>
            <span className="text-xs font-mono text-sky-300">
              {kpis.totalCount}
            </span>
          </button>

          <button
            onClick={() => scrollToSection('analyticsSection')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-[#1E293B]/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Risk Analytics</span>
          </button>

          <div className="pt-4 px-3 mb-2 text-xs font-medium text-slate-400">
            Controls &amp; Ingestion
          </div>

          <button
            onClick={openSimulator}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:bg-[#1E293B]/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <span className="flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Rule Simulator</span>
            </span>
            {isRulesModified && (
              <span className="text-[11px] font-mono text-amber-400">Custom</span>
            )}
          </button>

          <button
            onClick={openAddTransactionModal}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-[#1E293B]/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Add Transaction</span>
          </button>

          <button
            onClick={() => {
              setCsvModalOpen(true);
              setMobileSidebarOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-[#1E293B]/60 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Import CSV Batch</span>
          </button>
        </nav>

        {/* Copilot Mode Switcher & Regulatory Footer */}
        <div className="p-4 border-t border-[#1E293B] space-y-3">
          <div className="rounded-lg bg-[#1E293B]/80 border border-[#334155] p-3">
            <div className="text-xs font-medium text-slate-300 mb-2">
              Investigation Copilot Mode
            </div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0F172A] rounded-md">
              <button
                type="button"
                onClick={() => setCopilotEngine('SIMULATED')}
                className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  copilotEngine === 'SIMULATED'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Instant Brief
              </button>
              <button
                type="button"
                onClick={() => setCopilotEngine('LIVE_GEMINI')}
                className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                  copilotEngine === 'LIVE_GEMINI'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Live Gemini
              </button>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {copilotEngine === 'SIMULATED'
                ? 'Deterministic PSD2 / 6AMLD memo engine'
                : 'Server-side Gemini 4 Hydrogen LLM'}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
            <span>PSD2 RTS · 6AMLD</span>
            <span className="font-mono">EU SEPA</span>
          </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT SHELL ==================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 zones separated by gap-8 */}
        <header className="sticky top-0 z-30 h-16 bg-[#0F172A] border-b border-[#1E293B] px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark / breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-[#1E293B] hover:text-white"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <a
              href="#topWorkspace"
              className="font-display text-sm sm:text-base font-semibold text-white tracking-tight whitespace-nowrap shrink-0"
            >
              FinGuard AI / SEPA Anti-Fraud Triage
            </a>
          </div>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('topWorkspace')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </button>
            <button
              onClick={() => scrollToSection('analyticsSection')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Risk Analytics
            </button>
            <button
              onClick={() => scrollToSection('queueSection')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Triage Queue
            </button>
            <button
              onClick={openSimulator}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Rule Sandbox
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              onClick={openAddTransactionModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
            >
              Add Transaction
            </button>
          </div>
        </header>

        {/* ==================== MAIN DASHBOARD WORKSPACE ==================== */}
        <main
          id="topWorkspace"
          className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto space-y-6"
        >
          {/* Top Action Strip & Threshold Notice */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={loadSampleBatch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors whitespace-nowrap shrink-0"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>Load Sample Batch</span>
              </button>

              <button
                onClick={openAddTransactionModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold border border-slate-300 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>Add Transaction</span>
              </button>

              <button
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold border border-slate-300 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                <span>Upload CSV</span>
              </button>

              <button
                onClick={openSimulator}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-800 text-xs font-semibold border border-slate-300 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                <span>Rule Simulator</span>
              </button>

              {isRulesModified && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-800">
                  <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                  <span>Simulated Thresholds Active</span>
                  <span aria-hidden="true">·</span>
                  <button
                    onClick={resetRulesToBaseline}
                    className="underline hover:text-amber-950 font-semibold whitespace-nowrap"
                  >
                    Reset Baseline
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportAuditCSV}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-700 text-xs font-semibold border border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Compliance Audit CSV</span>
              </button>

              <button
                onClick={exportBatchJSON}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-700 text-xs font-semibold border border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
              >
                <FileJson className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export Case JSON</span>
              </button>
            </div>
          </div>

          {/* ==================== KPI SUMMARY CARDS ==================== */}
          <section
            aria-label="Key Performance Indicators"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          >
            {/* KPI 1: Total Transactions */}
            <div
              onClick={() => handleSelectDecisionFilter('ALL')}
              className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Total Transactions Analyzed
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
                    {formatInt(kpis.totalCount)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-[#0F172A] group-hover:text-white transition-colors">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-600">
                  {formatEURCompact(kpis.totalVolume)} total volume
                </span>
                <span className="text-emerald-700 font-medium">
                  {kpis.lowCount} approved
                </span>
              </div>
            </div>

            {/* KPI 2: Flagged High-Risk Count */}
            <div
              onClick={() => handleSelectDecisionFilter('HIGH')}
              className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:border-rose-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Flagged High-Risk Count
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-rose-600 mt-2">
                    {formatInt(kpis.highCount)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-rose-700 font-medium">
                  {kpis.totalCount
                    ? Math.round((kpis.highCount / kpis.totalCount) * 100)
                    : 0}
                  % of batch
                </span>
                <span className="text-amber-700 font-medium">
                  {kpis.medCount} Step-Up SCA
                </span>
              </div>
            </div>

            {/* KPI 3: Total Exposure € at Risk */}
            <div
              onClick={() => handleSelectDecisionFilter('FLAGGED')}
              className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Total Exposure € at Risk
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
                    {formatEURCompact(kpis.exposureAtRisk)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Euro className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Medium + High risk value</span>
                <span className="font-mono font-medium text-slate-700">
                  Avg score: {kpis.avgScore}/100
                </span>
              </div>
            </div>

            {/* KPI 4: Estimated Fraud Prevented € */}
            <div
              onClick={() => handleSelectDecisionFilter('HIGH')}
              className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:border-emerald-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Est. Fraud Prevented €
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 mt-2">
                    {formatEURCompact(kpis.fraudPrevented)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Auto-frozen High-Risk AML holds</span>
                <span className="font-mono font-medium text-emerald-700">
                  {kpis.totalVolume
                    ? Math.round((kpis.fraudPrevented / kpis.totalVolume) * 100)
                    : 0}
                  % of volume
                </span>
              </div>
            </div>
          </section>

          {/* ==================== ANALYTICS CHARTS ==================== */}
          <section
            id="analyticsSection"
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
          >
            {/* Chart 1: Risk Decision Distribution */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Risk Decision Distribution
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic triage outcome across current batch (click bar to filter)
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Score 0–100
                </span>
              </div>

              <div className="h-56 flex items-end justify-around gap-6 pt-8 pb-2 px-4 border-b border-slate-100">
                {[
                  {
                    tier: 'LOW' as const,
                    label: 'Approve (0–34)',
                    count: kpis.lowCount,
                    color: 'bg-emerald-500 hover:bg-emerald-600',
                    textColor: 'text-emerald-700',
                  },
                  {
                    tier: 'MEDIUM' as const,
                    label: 'Step-Up SCA (35–69)',
                    count: kpis.medCount,
                    color: 'bg-amber-500 hover:bg-amber-600',
                    textColor: 'text-amber-700',
                  },
                  {
                    tier: 'HIGH' as const,
                    label: 'Freeze & Escalate (70–100)',
                    count: kpis.highCount,
                    color: 'bg-rose-600 hover:bg-rose-700',
                    textColor: 'text-rose-700',
                  },
                ].map((bar) => {
                  const maxCount = Math.max(
                    kpis.lowCount,
                    kpis.medCount,
                    kpis.highCount,
                    1
                  );
                  const heightPct = Math.max(
                    Math.round((bar.count / maxCount) * 100),
                    bar.count > 0 ? 14 : 4
                  );
                  const sharePct = kpis.totalCount
                    ? Math.round((bar.count / kpis.totalCount) * 100)
                    : 0;

                  return (
                    <button
                      key={bar.tier}
                      type="button"
                      onClick={() => handleSelectDecisionFilter(bar.tier)}
                      className="flex-1 flex flex-col items-center h-full justify-end group focus:outline-none"
                    >
                      <div className="mb-1.5 text-center">
                        <span
                          className={`font-mono text-sm font-bold ${bar.textColor}`}
                        >
                          {bar.count}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 ml-1">
                          ({sharePct}%)
                        </span>
                      </div>
                      <div className="w-full max-w-[68px] bg-slate-100 rounded-t-lg h-36 flex items-end overflow-hidden">
                        <div
                          className={`w-full ${bar.color} rounded-t-lg transition-all duration-300`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="mt-2.5 text-xs font-medium text-slate-700 group-hover:text-slate-900 whitespace-nowrap">
                        {bar.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Exposure (€) by Triggered Fraud Rule */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Exposure (€) by Triggered Fraud Rule
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cumulative transaction volume linked to each auditable rule
                  </p>
                </div>
                <button
                  onClick={openSimulator}
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Tune Rules</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3.5 my-auto">
                {ruleExposureData.items.map((item) => {
                  const widthPct =
                    item.exposure > 0
                      ? Math.max(
                          Math.round(
                            (item.exposure / ruleExposureData.maxExp) * 100
                          ),
                          6
                        )
                      : 0;
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {item.label}
                        </span>
                        <span className="font-mono font-semibold text-slate-900">
                          {formatEURCompact(item.exposure)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ==================== TRANSACTION TRIAGE QUEUE ==================== */}
          <section
            id="queueSection"
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Table Header & Filters */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold text-slate-900">
                    Transaction Triage Queue
                  </h2>
                  <span className="text-xs font-mono text-slate-500">
                    · {filteredTransactions.length} of {scoredTransactions.length}{' '}
                    transactions
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any row to open the explainable AI Compliance Triage Brief &amp;
                  multilingual customer verification script.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative flex-1 sm:flex-initial min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search TX ID, IBAN, country..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Decision Filter */}
                <select
                  value={decisionFilter}
                  onChange={(e) =>
                    setDecisionFilter(
                      e.target.value as
                        | 'ALL'
                        | 'HIGH'
                        | 'MEDIUM'
                        | 'LOW'
                        | 'FLAGGED'
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="ALL">All Decisions</option>
                  <option value="HIGH">Freeze &amp; Escalate (70–100)</option>
                  <option value="MEDIUM">Step-Up SCA / KYC (35–69)</option>
                  <option value="LOW">Approve (0–34)</option>
                  <option value="FLAGGED">All Flagged (Medium + High)</option>
                </select>

                {/* Sort Select */}
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(
                      e.target.value as
                        | 'score_desc'
                        | 'amount_desc'
                        | 'time_desc'
                        | 'score_asc'
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="score_desc">
                    Sort: Risk Score (High → Low)
                  </option>
                  <option value="amount_desc">Sort: Amount (High → Low)</option>
                  <option value="time_desc">Sort: Most Recent</option>
                  <option value="score_asc">
                    Sort: Risk Score (Low → High)
                  </option>
                </select>
              </div>
            </div>

            {/* Responsive Table */}
            {filteredTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Transaction / Time</th>
                      <th className="py-3 px-4">Corridor &amp; IBANs</th>
                      <th className="py-3 px-4">Channel &amp; Telemetry</th>
                      <th className="py-3 px-4 text-right">Amount (€)</th>
                      <th className="py-3 px-4">Risk Score</th>
                      <th className="py-3 px-4">Triage Action</th>
                      <th className="py-3 px-4">Triggered Audit Rules</th>
                      <th className="py-3 px-4 text-right">Copilot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredTransactions.map((tx) => {
                      const isSelected = selectedTxId === tx.tx_id;
                      const hasMemo = Boolean(memoCache[tx.tx_id]);
                      const barColor =
                        tx.tier === 'HIGH'
                          ? 'bg-rose-600'
                          : tx.tier === 'MEDIUM'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500';
                      const scoreTextColor =
                        tx.tier === 'HIGH'
                          ? 'text-rose-700'
                          : tx.tier === 'MEDIUM'
                          ? 'text-amber-700'
                          : 'text-emerald-700';

                      return (
                        <tr
                          key={tx.tx_id}
                          onClick={() => {
                            setSelectedTxId(tx.tx_id);
                            setMemoError('');
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-sky-50/80' : 'hover:bg-slate-50/90'
                          }`}
                        >
                          {/* TX ID & Time */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-mono font-semibold text-slate-900">
                              {tx.tx_id}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {tx.timestamp}
                            </div>
                          </td>

                          {/* Corridor & IBANs */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="font-bold text-slate-800">
                                {tx.senderCountry}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span
                                className={`font-bold ${
                                  tx.receiverCountry !== tx.beneficiaryCountry
                                    ? 'text-rose-700 underline decoration-rose-400'
                                    : 'text-slate-800'
                                }`}
                              >
                                {tx.beneficiaryCountry}
                              </span>
                              {tx.receiverCountry !== tx.beneficiaryCountry && (
                                <span className="text-[11px] text-rose-600 font-sans font-semibold">
                                  (IBAN: {tx.receiverCountry})
                                </span>
                              )}
                            </div>
                            <div
                              className="font-mono text-[11px] text-slate-500 mt-1"
                              title={`Sender: ${tx.sender_iban}`}
                            >
                              From: {formatIbanShort(tx.sender_iban)}
                            </div>
                            <div
                              className="font-mono text-[11px] text-slate-500"
                              title={`Receiver: ${tx.receiver_iban}`}
                            >
                              To:&nbsp;&nbsp;&nbsp;{formatIbanShort(tx.receiver_iban)}
                            </div>
                          </td>

                          {/* Channel & Telemetry */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-medium text-slate-800">
                              {tx.channel}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 space-x-1.5 whitespace-nowrap">
                              <span>
                                Age:{' '}
                                <strong className="font-mono text-slate-700">
                                  {tx.account_age_days}d
                                </strong>
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                24h:{' '}
                                <strong className="font-mono text-slate-700">
                                  {tx.tx_count_24h}tx
                                </strong>
                              </span>
                              <span aria-hidden="true">·</span>
                              {tx.device_geo_match ? (
                                <span className="text-emerald-700">Geo OK</span>
                              ) : (
                                <span className="text-rose-600 font-semibold">
                                  Geo Mismatch
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                              {formatEUR(tx.amount_eur)}
                            </div>
                          </td>

                          {/* Risk Score */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="w-24">
                              <div className="flex items-baseline justify-between mb-1">
                                <span
                                  className={`font-mono font-bold text-xs ${scoreTextColor}`}
                                >
                                  {tx.score}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  /100
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${barColor} rounded-full transition-all duration-300`}
                                  style={{ width: `${tx.score}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Triage Action */}
                          <td className="py-3.5 px-4 align-top">
                            <span
                              className={`font-semibold whitespace-nowrap ${
                                tx.tier === 'HIGH'
                                  ? 'text-rose-700'
                                  : tx.tier === 'MEDIUM'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {tx.action}
                            </span>
                          </td>

                          {/* Triggered Audit Rules (Unboxed metadata discipline) */}
                          <td className="py-3.5 px-4 align-top max-w-[290px]">
                            {tx.triggeredRules.length > 0 ? (
                              <div className="text-[11px] leading-relaxed text-slate-700">
                                {tx.triggeredRules.map((r, i) => (
                                  <React.Fragment key={r.code}>
                                    {i > 0 && (
                                      <span
                                        className="mx-1.5 text-slate-400"
                                        aria-hidden="true"
                                      >
                                        ·
                                      </span>
                                    )}
                                    <span
                                      title={r.detail}
                                      className={`font-medium ${
                                        RULE_META[r.code]?.textClass ||
                                        'text-slate-700'
                                      }`}
                                    >
                                      {r.label}{' '}
                                      <span className="font-mono font-semibold">
                                        (+{r.points})
                                      </span>
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-medium">
                                Clean Baseline (0 pts)
                              </span>
                            )}
                          </td>

                          {/* Copilot Trigger */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTxId(tx.tx_id);
                                setMemoError('');
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                                hasMemo
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-[#0F172A] hover:text-white hover:border-[#0F172A]'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>{hasMemo ? 'View Memo' : 'Inspect'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Empty State */
              <div className="py-14 text-center px-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  No transactions match your current filters
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search criteria or reload the European sample batch.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDecisionFilter('ALL');
                    setSortOrder('score_desc');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </section>

          {/* Footer */}
          <footer className="pt-2 pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              FinGuard AI — Transparent Deterministic Risk Engine &amp; Gemini AI
              Investigation Copilot.
            </div>
            <div className="font-mono">
              Controls: Amount · Velocity · Account Age · IBAN/Geo · Virtual IBAN
            </div>
          </footer>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* SLIDE-OVER PANEL: AI COMPLIANCE TRIAGE BRIEF                              */}
      {/* ========================================================================= */}
      {selectedTx && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/50 z-40 transition-opacity"
            onClick={() => setSelectedTxId(null)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col"
            aria-label="AI Compliance Triage Brief"
          >
            {/* Panel Header */}
            <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0 border-b border-[#1E293B]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-mono text-sky-400">
                  <span>AI Compliance Triage Brief</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-200 font-semibold">
                    {selectedTx.tx_id}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mt-1 truncate">
                  {formatEUR(selectedTx.amount_eur)} · {selectedTx.senderCountry} →{' '}
                  {selectedTx.beneficiaryCountry} ({selectedTx.channel})
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={exportSelectedCaseJSON}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                >
                  <FileJson className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Export Case JSON</span>
                </button>
                <button
                  onClick={() => setSelectedTxId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Panel Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/70">
              {/* Top Decision Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500">
                      Deterministic Triage Decision
                    </div>
                    <div
                      className={`mt-1 text-sm font-bold ${
                        selectedTx.tier === 'HIGH'
                          ? 'text-rose-700'
                          : selectedTx.tier === 'MEDIUM'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedTx.action}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-500">
                      Composite Risk Score
                    </div>
                    <div
                      className={`text-2xl font-mono font-bold mt-0.5 ${
                        selectedTx.tier === 'HIGH'
                          ? 'text-rose-600'
                          : selectedTx.tier === 'MEDIUM'
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {selectedTx.score}
                      <span className="text-xs text-slate-400 font-normal">
                        /100
                      </span>
                    </div>
                  </div>
                </div>

                {selectedTx.scenario && (
                  <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <strong className="text-slate-800">Scenario Context:</strong>{' '}
                    {selectedTx.scenario}
                  </div>
                )}

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <div className="text-slate-500">Amount (EUR)</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {formatEUR(selectedTx.amount_eur)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Payment Channel</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {selectedTx.channel}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Account Age</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {selectedTx.account_age_days} days
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">24h Velocity</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {selectedTx.tx_count_24h} tx / 24h
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Device Geo Match</div>
                    <div
                      className={`font-semibold mt-0.5 ${
                        selectedTx.device_geo_match
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {selectedTx.device_geo_match
                        ? 'Verified Match'
                        : 'Mismatch Detected'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Corridor</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5">
                      {selectedTx.senderCountry} → {selectedTx.beneficiaryCountry}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs font-mono">
                  <div className="break-all">
                    <span className="text-slate-500 font-sans block mb-0.5">
                      Sender IBAN
                    </span>
                    {selectedTx.sender_iban}
                  </div>
                  <div className="break-all">
                    <span className="text-slate-500 font-sans block mb-0.5">
                      Receiver IBAN (Declared: {selectedTx.beneficiaryCountry})
                    </span>
                    {selectedTx.receiver_iban}
                  </div>
                </div>
              </div>

              {/* Auditable Deterministic Rule Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-sky-600" />
                    <span>Explainable Rule Breakdown (100% Auditable)</span>
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    Raw: {selectedTx.rawScore} pts{' '}
                    {selectedTx.rawScore > 100 ? '→ Capped at 100' : ''}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {selectedTx.triggeredRules.length > 0 ? (
                    selectedTx.triggeredRules.map((r) => (
                      <div
                        key={r.code}
                        className="py-2.5 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            {r.label}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {r.detail}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-slate-900">
                          +{r.points} pts
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-2 text-xs text-emerald-800">
                      No risk rules triggered. All deterministic checks passed within
                      standard European PSD2 baseline parameters.
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini AI Compliance Copilot Section */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span>Gemini AI Investigation Copilot</span>
                  </h4>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCopilotEngine('SIMULATED')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        copilotEngine === 'SIMULATED'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Instant Deterministic
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopilotEngine('LIVE_GEMINI')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        copilotEngine === 'LIVE_GEMINI'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Live Gemini AI
                    </button>
                  </div>
                </div>

                {loadingMemoTxId === selectedTx.tx_id ? (
                  <div className="space-y-3 py-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {copilotEngine === 'SIMULATED'
                          ? 'Synthesizing structured compliance brief...'
                          : 'Querying server-side Gemini 4 Hydrogen...'}
                      </span>
                    </div>
                    <div className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
                    <div className="h-20 rounded-lg bg-slate-100 animate-pulse" />
                  </div>
                ) : memoError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2.5">
                    <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Live Gemini Request Failed</span>
                    </div>
                    <p className="text-xs text-rose-700">{memoError}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => generateMemoForTx(selectedTx, 'SIMULATED')}
                        className="px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B]"
                      >
                        Generate Instant Deterministic Memo Instead
                      </button>
                    </div>
                  </div>
                ) : memoCache[selectedTx.tx_id] ? (
                  (() => {
                    const memo = memoCache[selectedTx.tx_id];
                    const activeScript =
                      scriptLang === 'it'
                        ? memo.verification_script.it
                        : memo.verification_script.en;

                    return (
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs text-slate-500">
                          <span>
                            Source:{' '}
                            <strong className="text-slate-800">
                              {memo.mode === 'LIVE_GEMINI'
                                ? `Live Gemini (${memo.model || 'gemini-4-hydrogen'})`
                                : 'Instant Deterministic Copilot'}
                            </strong>{' '}
                            · Generated{' '}
                            {new Date(memo.generatedAt).toLocaleTimeString()}
                          </span>
                          <button
                            onClick={() => generateMemoForTx(selectedTx)}
                            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Regenerate</span>
                          </button>
                        </div>

                        {/* (a) Executive Risk Summary */}
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 mb-1.5">
                            01. Executive Risk Summary
                          </h5>
                          <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                            {memo.executive_summary}
                          </p>
                        </div>

                        {/* (b) PSD2 / AML Red Flags Identified */}
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 mb-1.5">
                            02. PSD2 / AML Red Flags Identified
                          </h5>
                          <ul className="space-y-2">
                            {memo.red_flags.map((flag, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-slate-700 bg-rose-50/50 border border-rose-100 rounded-lg p-2.5"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span>{flag}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* (c) Recommended Next 3 Analyst Actions */}
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 mb-1.5">
                            03. Recommended Next 3 Analyst Actions
                          </h5>
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
                            {memo.next_actions.map((item, idx) => (
                              <div key={idx} className="p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-bold text-slate-900">
                                    Action #{idx + 1}
                                  </span>
                                  <span className="text-[11px] font-mono font-semibold text-slate-600">
                                    {item.priority}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-800">
                                  {item.action}
                                </p>
                                {item.rationale && (
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Rationale: {item.rationale}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* (d) Customer Verification Script (EN / IT Toggle) */}
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h5 className="text-xs font-bold text-slate-700">
                              04. Customer Verification Script
                            </h5>
                            <div className="flex items-center gap-2">
                              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setScriptLang('en')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                                    scriptLang === 'en'
                                      ? 'bg-[#0F172A] text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  English (EN)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScriptLang('it')}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                                    scriptLang === 'it'
                                      ? 'bg-[#0F172A] text-white'
                                      : 'text-slate-600 hover:text-slate-900'
                                  }`}
                                >
                                  Italiano (IT)
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={copyActiveScript}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                            {activeScript}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1.5">
                            Designed in accordance with PSD2 anti-social-engineering
                            guidance &amp; 6AMLD anti-tipping-off obligations.
                          </p>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Draft Structured PSD2 &amp; 6AMLD Investigation Memo
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Produces an executive risk summary, PSD2/AML red flags, 3
                        concrete analyst next actions, and an English/Italian customer
                        verification script.
                      </p>
                    </div>
                    <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => generateMemoForTx(selectedTx)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-sky-400" />
                        <span>
                          Generate{' '}
                          {copilotEngine === 'LIVE_GEMINI'
                            ? 'with Live Gemini AI'
                            : 'Instant Compliance Memo'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER: RULE THRESHOLD SIMULATOR                               */}
      {/* ========================================================================= */}
      {simulatorOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/50 z-40"
            onClick={() => setSimulatorOpen(false)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col"
            aria-label="Rule Threshold Simulator"
          >
            {/* Simulator Header */}
            <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0 border-b border-[#1E293B]">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Interactive Policy Sandbox</span>
                </div>
                <h3 className="text-base font-semibold text-white mt-0.5">
                  Rule Threshold Simulator
                </h3>
              </div>
              <button
                onClick={() => setSimulatorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B] transition-colors"
                aria-label="Close simulator"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulator Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <p className="text-xs text-slate-600 leading-relaxed">
                Adjust rule thresholds below to simulate how policy changes shift{' '}
                <strong className="text-slate-900">False Positives</strong> vs.{' '}
                <strong className="text-slate-900">
                  Caught Fraud Exposure (€)
                </strong>{' '}
                across your active batch compared to the EBA Baseline.
              </p>

              {/* Sliders */}
              <div className="space-y-4">
                {/* High-Value Threshold (€) */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="simHighValueRange"
                      className="text-xs font-semibold text-slate-800"
                    >
                      Elevated Amount Threshold (+25 pts)
                    </label>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {formatEURCompact(
                        simulationImpact.effectiveRules.elevatedAmountEur
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Baseline: €10,000
                  </p>
                  <input
                    id="simHighValueRange"
                    type="range"
                    min={3000}
                    max={25000}
                    step={500}
                    value={simRules.elevatedAmountEur}
                    onChange={(e) =>
                      setSimRules((prev) => ({
                        ...prev,
                        elevatedAmountEur: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                    <span>€3,000</span>
                    <span>€10,000 (Baseline)</span>
                    <span>€25,000</span>
                  </div>
                </div>

                {/* Critical Amount Threshold (€) */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="simCriticalValueRange"
                      className="text-xs font-semibold text-slate-800"
                    >
                      Critical High-Value Threshold (+35 pts)
                    </label>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      {formatEURCompact(
                        simulationImpact.effectiveRules.criticalAmountEur
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Baseline: €25,000
                  </p>
                  <input
                    id="simCriticalValueRange"
                    type="range"
                    min={15000}
                    max={50000}
                    step={1000}
                    value={simRules.criticalAmountEur}
                    onChange={(e) =>
                      setSimRules((prev) => ({
                        ...prev,
                        criticalAmountEur: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                    <span>€15,000</span>
                    <span>€25,000 (Baseline)</span>
                    <span>€50,000</span>
                  </div>
                </div>

                {/* Velocity Limit */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="simVelocityRange"
                      className="text-xs font-semibold text-slate-800"
                    >
                      24h Velocity Limit (+25 pts)
                    </label>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      ≥ {simulationImpact.effectiveRules.velocityLimit24h} tx / 24h
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Baseline: ≥ 5 transactions within 24 hours
                  </p>
                  <input
                    id="simVelocityRange"
                    type="range"
                    min={2}
                    max={12}
                    step={1}
                    value={simRules.velocityLimit24h}
                    onChange={(e) =>
                      setSimRules((prev) => ({
                        ...prev,
                        velocityLimit24h: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                    <span>2 tx</span>
                    <span>5 tx (Baseline)</span>
                    <span>12 tx</span>
                  </div>
                </div>

                {/* New Account Risk Window */}
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="simAgeRange"
                      className="text-xs font-semibold text-slate-800"
                    >
                      New / Dormant Account Window (+20 pts)
                    </label>
                    <span className="text-sm font-mono font-bold text-slate-900">
                      &lt; {simulationImpact.effectiveRules.newAccountDays} days
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Triggers when account age &lt; window and amount &gt; €2,500
                  </p>
                  <input
                    id="simAgeRange"
                    type="range"
                    min={7}
                    max={90}
                    step={1}
                    value={simRules.newAccountDays}
                    onChange={(e) =>
                      setSimRules((prev) => ({
                        ...prev,
                        newAccountDays: Number(e.target.value),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                    <span>7d</span>
                    <span>30d (Baseline)</span>
                    <span>90d</span>
                  </div>
                </div>
              </div>

              {/* Live Impact Comparison */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Simulated Impact vs. EBA Baseline
                  </h4>
                  <span className="text-xs font-mono text-slate-500">
                    {transactions.length} tx batch
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="text-[11px] font-semibold text-emerald-700">
                      Approve
                    </div>
                    <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                      {simulationImpact.simKpi.lowCount}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Base: {simulationImpact.baseKpi.lowCount}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="text-[11px] font-semibold text-amber-700">
                      Step-Up SCA
                    </div>
                    <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                      {simulationImpact.simKpi.medCount}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Base: {simulationImpact.baseKpi.medCount}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="text-[11px] font-semibold text-rose-700">
                      Freeze / AML
                    </div>
                    <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                      {simulationImpact.simKpi.highCount}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Base: {simulationImpact.baseKpi.highCount}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-slate-800">
                        Caught High-Risk Exposure (€)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Auto-frozen volume:{' '}
                        <strong className="font-mono text-slate-800">
                          {formatEURCompact(
                            simulationImpact.simKpi.fraudPrevented
                          )}
                        </strong>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        simulationImpact.caughtDelta === 0
                          ? 'text-slate-400'
                          : simulationImpact.caughtDelta > 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {simulationImpact.caughtDelta === 0
                        ? 'No change'
                        : `${
                            simulationImpact.caughtDelta > 0 ? '+' : ''
                          }${formatEURCompact(simulationImpact.caughtDelta)}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="font-semibold text-slate-800">
                        Est. False Positive Alerts
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Established clean-geo alerts:{' '}
                        <strong className="font-mono text-slate-800">
                          {simulationImpact.simFP}
                        </strong>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        simulationImpact.fpDelta === 0
                          ? 'text-slate-400'
                          : simulationImpact.fpDelta < 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {simulationImpact.fpDelta === 0
                        ? 'No change'
                        : `${simulationImpact.fpDelta > 0 ? '+' : ''}${
                            simulationImpact.fpDelta
                          }`}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Affected Transactions ({simulationImpact.changedTxs.length})
                  </div>
                  {simulationImpact.changedTxs.length === 0 ? (
                    <div className="text-xs text-slate-500 italic bg-white border border-slate-200 rounded-lg p-3">
                      No score or triage tier changes relative to baseline.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {simulationImpact.changedTxs.map((c) => (
                        <div
                          key={c.tx_id}
                          className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900">
                              {c.tx_id}
                            </span>
                            <span className="text-slate-400 ml-1.5 font-mono">
                              {formatEURCompact(c.amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-500">
                              {c.fromTier} ({c.fromScore})
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="font-bold text-slate-900">
                              {c.toTier} ({c.toScore})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Simulator Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSimRules({ ...BASELINE_RULES })}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                Reset Baseline
              </button>
              <button
                type="button"
                onClick={applySimulatedThresholds}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] transition-colors"
              >
                Apply Thresholds to Live Queue
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOM TRANSACTION                                             */}
      {/* ========================================================================= */}
      {addTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Add Custom Transaction
                </h3>
                <p className="text-xs text-slate-400">
                  Scored immediately via the deterministic EU Open Banking risk
                  engine
                </p>
              </div>
              <button
                onClick={() => setAddTxModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleAddTransactionSubmit}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transaction ID
                  </label>
                  <input
                    type="text"
                    required
                    value={fTxId}
                    onChange={(e) => setFTxId(e.target.value)}
                    placeholder="TX-EU-9099"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Channel
                  </label>
                  <select
                    value={fChannel}
                    onChange={(e) => setFChannel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  >
                    <option value="SEPA Instant">SEPA Instant</option>
                    <option value="SEPA Credit">SEPA Credit</option>
                    <option value="Virtual IBAN">Virtual IBAN</option>
                    <option value="Open Banking PIS">Open Banking PIS</option>
                    <option value="SWIFT Cross-Border">SWIFT Cross-Border</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sender IBAN
                  </label>
                  <input
                    type="text"
                    required
                    value={fSenderIban}
                    onChange={(e) => setFSenderIban(e.target.value)}
                    placeholder="IT60X0542811101000000123456"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receiver IBAN
                  </label>
                  <input
                    type="text"
                    required
                    value={fReceiverIban}
                    onChange={(e) => setFReceiverIban(e.target.value)}
                    placeholder="LT121000011101001000"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Beneficiary Country (ISO-2)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={fCountry}
                    onChange={(e) => setFCountry(e.target.value)}
                    placeholder="CY"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (€ EUR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={fAmount}
                    onChange={(e) => setFAmount(e.target.value)}
                    placeholder="18500"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account Age (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={fAge}
                    onChange={(e) => setFAge(e.target.value)}
                    placeholder="14"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    24h Velocity (Tx Count)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={fVelocity}
                    onChange={(e) => setFVelocity(e.target.value)}
                    placeholder="6"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Device Geo Match
                  </label>
                  <select
                    value={fGeoMatch}
                    onChange={(e) =>
                      setFGeoMatch(e.target.value as 'true' | 'false')
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  >
                    <option value="true">
                      True — Matches Account Country
                    </option>
                    <option value="false">
                      False — Geo / VPN / IP Mismatch
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scenario Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                    placeholder="e.g. Unverified crypto desk payout"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddTxModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B]"
                >
                  Score &amp; Add to Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: UPLOAD CSV BATCH                                                   */}
      {/* ========================================================================= */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">
                  Import Transactions via CSV
                </h3>
                <p className="text-xs text-slate-400">
                  Client-side RFC-4180 parser — scored immediately in memory
                </p>
              </div>
              <button
                onClick={() => setCsvModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E293B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800">
                  Required CSV Columns:
                </div>
                <code className="block text-[11px] font-mono bg-white border border-slate-200 rounded p-2 text-slate-700 overflow-x-auto">
                  tx_id,timestamp,sender_iban,receiver_iban,beneficiary_country,amount_eur,channel,account_age_days,tx_count_24h,device_geo_match
                </code>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Need a working file to test ingestion?
                  </span>
                  <button
                    type="button"
                    onClick={downloadSampleCSVTemplate}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline"
                  >
                    Download Sample CSV Template
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="csvImportMode"
                    value="append"
                    checked={csvImportMode === 'append'}
                    onChange={() => setCsvImportMode('append')}
                  />
                  <span className="font-medium text-slate-700">
                    Append to existing queue
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="csvImportMode"
                    value="replace"
                    checked={csvImportMode === 'replace'}
                    onChange={() => setCsvImportMode('replace')}
                  />
                  <span className="font-medium text-slate-700">
                    Replace current queue
                  </span>
                </label>
              </div>

              <label
                htmlFor="csvFileInput"
                className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50/70 hover:bg-sky-50/40 hover:border-sky-400 transition-colors"
              >
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700">
                  Click to select a .CSV file
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Processed immediately in browser memory
                </span>
                <input
                  id="csvFileInput"
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleCSVFileUpload}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOAST NOTIFICATION CONTAINER                                              */}
      {/* ========================================================================= */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const colorCls =
            t.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : t.type === 'warning'
              ? 'bg-amber-900 text-white border-amber-700'
              : t.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-[#0F172A] text-white border-[#334155]';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl border shadow-lg text-xs font-medium flex items-center gap-2 ${colorCls}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

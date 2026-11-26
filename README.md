# 🛡️ FinGuard AI — Open Banking & Anti-Fraud Transaction Triage Copilot

**An interactive European Fintech compliance & fraud-triage prototype combining transparent deterministic banking rules (SEPA / Virtual IBAN / PSD2-AML) with Generative AI investigation briefs.**

🔗 **Live Interactive Demo:** [Launch FinGuard AI]([PASTE-YOUR-LIVE-DEMO-URL-HERE]) *(Works immediately in zero-key Demo Mode — no API key required)*

![FinGuard AI Dashboard Overview](./screenshots/dashboard-overview.png)

---

## 1. Business Problem
European payment providers, Open Banking platforms, and Fintech institutions face a dual operational challenge:
1. **High alert volume & analyst fatigue:** Traditional rule-based anti-fraud engines flag suspicious SEPA and Virtual IBAN transfers without explaining *why* in human-readable compliance language.
2. **Black-box AI risk:** Pure LLM scoring is non-auditable and unsuitable for regulated EU banking environments (PSD2 / AML).

**FinGuard AI** bridges this gap with a **hybrid architecture**: deterministic, auditable business rules calculate the exact risk score (`0–100`), while the **Gemini API** acts as a compliance copilot—accelerating analyst triage, drafting PSD2/AML checklists, and generating bilingual (**English / Italian**) customer verification scripts.

---

## 2. Key Features
- **Realistic EU Banking Batch & CSV Ingestion:** Includes 8 pre-loaded SEPA / Open Banking / Virtual IBAN scenarios (velocity spikes, cross-border mismatches, dormant-account takeovers, pass-through patterns), manual transaction entry, and custom CSV batch upload.
- **Transparent Deterministic Scoring Engine (0–100):** Auditable rule tags map every transaction to an instant operational action:
  - 🟢 **0–34:** `Approve`
  - 🟡 **35–69:** `Step-Up SCA / KYC Review`
  - 🔴 **70–100:** `Freeze & Escalate to AML Team`
- **Gemini AI Compliance Copilot (with Built-In Demo Mode):** Clicking any transaction generates a structured investigation memo (Executive Risk Summary, PSD2/AML Red Flags, Next 3 Analyst Actions, and EN/IT Customer Verification Script). Runs out-of-the-box in **Demo Mode** or live with a user-supplied Gemini API key.
- **Rule Threshold Simulator:** Lets business analysts adjust high-value (€) and 24-hour velocity thresholds in real time to evaluate the trade-off between **caught fraud exposure (€)** and **false-positive review workload**.
- **Audit-Ready Exports:** One-click download of full batch **Compliance Audit CSV** and single-case **JSON** payloads.

![AI Compliance Triage Brief](./screenshots/ai-triage-panel.png)

---

## 3. Transparent Risk Scoring Logic

| Risk Signal | Trigger Condition | Weight | Compliance Rationale |
| :--- | :--- | :---: | :--- |
| **High-Value Anomaly** | Transfer `> €10,000` / `> €25,000` | `+25` / `+35` | Elevated financial exposure & AML reporting thresholds |
| **Velocity Burst** | `>= 5` transactions within 24 hours | `+25` | Automated structuring / smurfing or credential compromise |
| **New / Dormant Account Spike** | Account age `< 30 days` & amount `> €2,500` | `+20` | Mule-account or freshly opened synthetic identity behavior |
| **Cross-Border / Geo Mismatch** | IBAN country or device location mismatch | `+20` | Potential unauthorized access / account takeover (PSD2 SCA) |
| **Virtual IBAN Pass-Through** | Rapid inbound-to-outbound Virtual IBAN flow | `+15` | Layering pattern common in Open Banking payment rails |

*(Scores are capped at 100 and displayed alongside every triggered rule tag for full auditability.)*

---

## 4. Tech Stack & Architecture
- **Prototyping & AI Layer:** Google AI Studio, Gemini API (BYOK client-side configuration + zero-key Demo Mode)
- **Frontend & Visualization:** React, TypeScript/JavaScript, Vite, Tailwind CSS, Interactive Charts
- **Data Handling:** Client-side CSV parser, deterministic rule engine, CSV/JSON audit export

---

## 5. Run Locally
```bash
# 1. Clone the repository
git clone [https://github.com/](https://github.com/)[YOUR-USERNAME]/[YOUR-REPO-NAME].git
cd [YOUR-REPO-NAME]

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

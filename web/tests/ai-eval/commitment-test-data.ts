/**
 * Commitment Extraction Test Dataset (Emails 1-210)
 *
 * 210 realistic emails with ground truth labels for evaluating
 * the commitment extraction pipeline accuracy.
 *
 * Categories:
 *   1-30:    Business Positive EN
 *   31-50:   Business Positive ZH
 *   51-60:   Business Positive Mixed (Chinglish)
 *   61-75:   Family/Personal Positive
 *   76-90:   Multi-commitment
 *   91-100:  Reply Chain Context
 *   101-115: Negative Social/Pleasantries
 *   116-130: Negative Auto-generated (pre-filter)
 *   131-140: Negative Near-miss
 *   141-150: Edge: Deadline Inference
 *   151-160: Edge: Implicit Commitments
 *   161-170: Edge: Chinese-English Mixed
 *   171-190: Edge: High False-Positive Risk
 *   191-200: Edge: Extremely Long Emails
 *   201-210: Edge: Tone Ambiguity
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ExpectedCommitment {
  type: 'i_promised' | 'waiting_on_them'
  title_pattern: string
  deadline?: string
  confidence_min?: number
}

export interface ExpectedRejection {
  title_pattern: string
  gate_failed: 'Q1' | 'Q2' | 'Q3' | 'pre_filter'
  reason: string
}

export interface TestEmail {
  id: number
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  language: 'en' | 'zh' | 'mixed'
  description: string
  from_address: string
  from_name: string
  to_address: string
  subject: string
  body: string
  date: string
  expected_commitments: ExpectedCommitment[]
  expected_rejections?: ExpectedRejection[]
  notes?: string
}

// ---------------------------------------------------------------------------
// Test Emails
// ---------------------------------------------------------------------------

export const TEST_EMAILS: TestEmail[] = [

  // =========================================================================
  // BUSINESS POSITIVE EN (1-30)
  // =========================================================================

  // --- 1-5: Simple "I will send X by Y" promises (easy) ---

  {
    id: 1,
    category: 'business_positive_en',
    difficulty: 'easy',
    language: 'en',
    description: 'Simple promise to send proposal by Friday',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Insurance Analytics Proposal',
    body: `Hi Rachel,

Thanks for the productive meeting yesterday at Marina Bay Financial Centre. I really enjoyed the discussion around your digital transformation goals.

As promised, I will send you the full proposal document by this Friday (4 April). It will include the pricing breakdown for all three tiers we discussed.

Looking forward to your feedback.

Best regards,
Tiger Li
CEO, ActuaryHelp`,
    date: '2026-03-30T10:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'send.*proposal',
        deadline: '2026-04-03',
        confidence_min: 0.9,
      },
    ],
  },

  {
    id: 2,
    category: 'business_positive_en',
    difficulty: 'easy',
    language: 'en',
    description: 'Promise to deliver revised deck by Monday',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Q2 Strategy Deck Review',
    body: `James,

Good catch on the market sizing numbers — you're right, the TAM figure should reference the 2025 MAS annual report, not the 2023 one.

I'll update the deck with corrected figures and send the revised version to you by Monday morning.

Cheers,
Tiger`,
    date: '2026-03-28T16:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'update.*deck|send.*revised',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 3,
    category: 'business_positive_en',
    difficulty: 'easy',
    language: 'en',
    description: 'Simple promise to share access credentials',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Demo Environment Access',
    body: `Hi Priya,

Sure thing. I'll create a demo account for your team and send you the login credentials by end of day today.

The demo environment is pre-loaded with the sample dataset we discussed. Let me know if you need anything else.

Tiger`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'send.*credentials|create.*demo.*account',
        deadline: '2026-03-30',
        confidence_min: 0.9,
      },
    ],
  },

  {
    id: 4,
    category: 'business_positive_en',
    difficulty: 'easy',
    language: 'en',
    description: 'They promise to send contract by Wednesday',
    from_address: 'linda.chen@greateasternlife.com',
    from_name: 'Linda Chen',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Service Agreement Draft',
    body: `Dear Tiger,

It was great meeting you at the InsurTech conference at Sands Expo last week. Our legal team has reviewed the scope of work and we are keen to proceed.

I will send you the draft service agreement by Wednesday 1 April for your review. Please allow 5 business days for any revisions.

Looking forward to working together.

Warm regards,
Linda Chen
VP, Digital Innovation
Great Eastern Life`,
    date: '2026-03-28T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'send.*service agreement|draft.*agreement|service agreement|agreement.*draft',
        deadline: '2026-04-01',
        confidence_min: 0.9,
      },
    ],
  },

  {
    id: 5,
    category: 'business_positive_en',
    difficulty: 'easy',
    language: 'en',
    description: 'Promise to email the signed NDA by tomorrow',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'david.koh@temasek.com.sg',
    subject: 'Re: NDA for Data Sharing',
    body: `Hi David,

Thanks for the NDA template. I've reviewed it and everything looks standard. I'll sign it and email the executed copy back to you by tomorrow noon.

Please go ahead and set up the secure data room in the meantime.

Best,
Tiger`,
    date: '2026-03-30T11:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'sign.*NDA|email.*executed.*copy',
        deadline: '2026-03-31',
        confidence_min: 0.9,
      },
    ],
  },

  // --- 6-10: Client/vendor proposals with deadlines (medium) ---

  {
    id: 6,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Vendor proposal with milestone deadlines and payment terms',
    from_address: 'mike.tan@ncs.com.sg',
    from_name: 'Mike Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Proposal: Cloud Migration Services for ActuaryHelp',
    body: `Dear Tiger,

Thank you for shortlisting NCS for your cloud migration project. Please find our proposal summary below:

Phase 1 (Assessment): We will complete the infrastructure assessment by 15 April 2026.
Phase 2 (Migration): Target completion by 30 May 2026.
Phase 3 (Optimization): Ongoing support through Q3 2026.

We will send the detailed proposal document with pricing by this Thursday. Our commercial team will also schedule a call with you next week to walk through the pricing model.

Please note that this proposal is valid for 30 days from the date of this email.

Best regards,
Mike Tan
Senior Solutions Architect
NCS Group`,
    date: '2026-03-30T09:30:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'send.*detailed proposal|proposal.*pricing|detailed.*proposal',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'schedule.*call|walk.*pricing|pricing.*call',
      },
    ],
  },

  {
    id: 7,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Client requesting deliverables with specific dates',
    from_address: 'sarah.lim@singlife.com',
    from_name: 'Sarah Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Action Required: Deliverables Timeline for Phase 2',
    body: `Hi Tiger,

Following our steering committee meeting, I need to confirm the following deliverables from your side:

1. Updated data model documentation — due 7 April
2. API integration test results — due 14 April
3. User acceptance testing sign-off — due 21 April

Can you confirm these dates work? If there are any concerns, please flag them by end of this week so we can adjust the project plan before the next board meeting.

Also, I will share the updated requirements document with your team by Wednesday.

Thanks,
Sarah Lim
Head of Product, Singlife`,
    date: '2026-03-30T14:20:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'deliverables|milestones|data model|API.*test|acceptance',
        deadline: '2026-04-21',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'share.*requirements|requirements document|updated requirements',
        deadline: '2026-04-01',
        confidence_min: 0.8,
      },
    ],
    notes: 'Principle 1: The three deliverables are a single package of project milestones. LLM correctly groups them as one commitment. Sarah also promises to share the requirements document. Principle 2: Sarah (external) requests deliverables from Tiger = i_promised; Sarah promises doc = waiting_on_them.',
  },

  {
    id: 8,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'RFP response with submission deadline',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'procurement@ntuc.org.sg',
    subject: 'Re: RFP-2026-0412 Digital Analytics Platform',
    body: `Dear Procurement Team,

Thank you for the detailed RFP. We are very interested in participating.

I confirm that we will submit our full response by the 10 April deadline. Our team is currently preparing the technical architecture section and we expect to have the draft ready for internal review by 5 April.

Could you please clarify whether the pricing should be in SGD or USD? Also, should the reference letters be from Singapore-based clients only?

Best regards,
Tiger Li
CEO, ActuaryHelp Pte Ltd`,
    date: '2026-03-29T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'submit.*RFP|submit.*response',
        deadline: '2026-04-10',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 9,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Vendor promising software license delivery',
    from_address: 'alex.ng@aws.com',
    from_name: 'Alex Ng',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: AWS Enterprise License Agreement',
    body: `Hi Tiger,

Great news — I've got approval from our regional director for the startup credits you requested.

Here's what we'll do:
- I will activate the $50,000 AWS credits on your account by this Friday
- Our solutions architect, Mei Ling, will reach out to schedule an architecture review session next week
- I'll send over the enterprise license agreement for signature by Monday

Is there anything else you need for the board presentation?

Cheers,
Alex Ng
Enterprise Account Manager, AWS Singapore`,
    date: '2026-03-30T08:15:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'activate.*credits|AWS.*credits|\\$50.*credits',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'send.*enterprise license|license agreement|architecture review|schedule.*review',
        deadline: '2026-04-06',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 10,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Client promising payment upon invoice',
    from_address: 'jenny.chua@manulife.com.sg',
    from_name: 'Jenny Chua',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Invoice #INV-2026-0089',
    body: `Hi Tiger,

Received the invoice. I've submitted it to our finance team for processing.

We will process the payment within 30 days as per our standard payment terms. You should expect the bank transfer by end of April.

One small thing — could you resend the invoice with our updated company registration number? I'll forward you the details separately.

Regards,
Jenny Chua
Operations Manager
Manulife Singapore`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'process.*payment|bank transfer',
        deadline: '2026-04-30',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'forward.*registration number|send.*details',
        confidence_min: 0.7,
      },
    ],
  },

  // --- 11-15: Investor update requests with urgency (medium) ---

  {
    id: 11,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Investor requesting monthly update by specific date',
    from_address: 'kevin.lee@antler.co',
    from_name: 'Kevin Lee',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Monthly Investor Update — March 2026',
    body: `Hi Tiger,

Hope Q1 has been going well!

As a reminder, we'd love to get your March investor update by 5 April. The LP meeting is on 8 April and we want to include ActuaryHelp in the portfolio highlights.

Key metrics we'd like to see:
- MRR and growth rate
- Active users / persona count
- Pipeline deals and conversion rates
- Key hires or departures
- Cash runway

I'll also send you the updated reporting template by tomorrow — we've simplified it based on founder feedback.

Best,
Kevin Lee
Partner, Antler Singapore`,
    date: '2026-03-30T09:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'investor update|monthly update',
        deadline: '2026-04-05',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'send.*reporting template',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
    notes: 'The investor update is phrased as a request ("we\'d love to get") but in investor relations context this is effectively a commitment.',
  },

  {
    id: 12,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Tiger promising to share data room with potential investors',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'melissa.ong@sequoiacap.com',
    subject: 'Re: Series A Data Room Access',
    body: `Hi Melissa,

Absolutely — we'd be happy to share the data room. I will grant your team access by tomorrow and send a walkthrough video along with it.

The data room includes:
- Financials (audited FY2025 + Q1 2026 management accounts)
- Cap table and ESOP details
- Customer contracts (redacted)
- Technical architecture documentation

Please let me know if you need anything else ahead of your IC meeting on the 8th.

Best,
Tiger`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'grant.*access|share.*data room',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'send.*walkthrough video',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 13,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'VC partner promising to intro to portfolio company',
    from_address: 'ravi.kumar@jungle.vc',
    from_name: 'Ravi Kumar',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Potential Partnership with PolicyPal',
    body: `Tiger,

Loved the demo last week. Your persona engine is genuinely impressive — first time I've seen something like that work at scale.

I'll make a warm intro to Didi from PolicyPal this week. She's been looking for exactly this kind of analytics capability for their SME insurance vertical.

Also, I'll send you our term sheet feedback by Friday. We're aligned on most points — just need to sort out the liquidation preference language.

Talk soon,
Ravi
Jungle Ventures`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'intro.*PolicyPal|intro.*Didi',
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'send.*term sheet feedback',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 14,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Urgent investor ask — board deck needed before meeting',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'URGENT: Board Deck for Thursday',
    body: `Tiger,

Quick reminder — the board meeting is this Thursday at 2pm. I still need the following from you:

1. Updated financial projections slide (the one with the hockey stick chart)
2. Product roadmap for Q2-Q3
3. Team org chart with the new hires

Can you please have these ready by Wednesday 5pm? I'll compile everything into the master deck and send to the board by Wednesday night.

Also, Raymond from GIC asked if we could add a slide on competitive landscape. I told him we would.

Thanks,
Sophie`,
    date: '2026-03-30T19:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'board deck|financial projections|roadmap|org chart|slides.*board',
        deadline: '2026-04-01',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'competitive landscape',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1: Sophie requests 3 items for the board deck — LLM correctly groups these as one "prepare board deck materials" commitment. The competitive landscape slide is a separate promise made to Raymond (GIC). Sophie is internal (same company), so her requests are effectively commitments the user needs to fulfill.',
  },

  {
    id: 15,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Angel investor promising follow-on and intro',
    from_address: 'patrick.ho@gmail.com',
    from_name: 'Patrick Ho',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Follow-on Investment Discussion',
    body: `Tiger,

Thanks for the update over kopi yesterday. The numbers are looking solid — well ahead of where I expected you'd be at this stage.

I'm happy to commit to the follow-on. I will wire the $100K to the company account by end of next week once my lawyer reviews the SAFE note.

Also, I promised I'd connect you with my old colleague at Swiss Re — I'll do that intro by Tuesday.

Let me know when you're free for the next catch up. Maybe Lau Pa Sat again?

Cheers,
Patrick`,
    date: '2026-03-29T20:15:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'wire.*\\$100K|transfer.*investment',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'intro.*Swiss Re|connect.*Swiss Re',
        deadline: '2026-04-01',
        confidence_min: 0.85,
      },
    ],
  },

  // --- 16-20: Legal/compliance deadlines (hard) ---

  {
    id: 16,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Legal counsel with regulatory filing deadline',
    from_address: 'amanda.goh@rajahtan.com',
    from_name: 'Amanda Goh',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: PDPA Compliance — Data Protection Officer Registration',
    body: `Dear Tiger,

Further to our call this morning, I want to confirm the timeline for your PDPA compliance obligations:

1. DPO registration with PDPC must be completed by 15 April 2026. I will prepare the registration form and send it to you for signature by 4 April.

2. Your Data Protection Policy needs to be published on your website before the registration. I note you mentioned your developer would handle this — please confirm the target date.

3. The Data Protection Impact Assessment (DPIA) for your persona engine should ideally be done before you go live with the new client. I can draft this for you, but I'll need your team to fill in the technical questionnaire. I'll send the questionnaire by this Wednesday.

Please treat item 1 as a hard deadline — there are penalties for late registration.

Kind regards,
Amanda Goh
Partner, Data Protection Practice
Rajah & Tann Singapore LLP`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'DPO registration|PDPC.*registration|PDPA.*compliance|Data Protection Policy|publish.*policy',
        deadline: '2026-04-15',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'registration form|prepare.*form|send.*questionnaire|technical questionnaire',
        deadline: '2026-04-04',
        confidence_min: 0.8,
      },
    ],
    notes: 'Principle 1: DPO registration and Data Protection Policy are part of one compliance package. Amanda promises 2 things (registration form, questionnaire). LLM correctly groups each side.',
  },

  {
    id: 17,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'MAS regulatory notification with compliance action items',
    from_address: 'compliance@mas.gov.sg',
    from_name: 'MAS Technology Risk Supervision',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Technology Risk Management — Annual Self-Assessment Due',
    body: `Dear Chief Executive Officer,

This is to remind you that the annual Technology Risk Management (TRM) self-assessment is due for submission by 30 April 2026.

As a licensed financial advisory entity, ActuaryHelp Pte Ltd (FA License No: FA-2025-0834) is required to:

(a) Complete the TRM self-assessment questionnaire via the MAS MASNET portal
(b) Submit the Independent Auditor's Report on IT controls
(c) Provide an updated Business Continuity Plan (BCP) if there have been material changes

Failure to submit by the deadline may result in supervisory action.

If you have any questions, please contact your designated supervision officer, Mr. Daniel Loh, at daniel_loh@mas.gov.sg.

Regards,
Technology Risk Supervision Department
Monetary Authority of Singapore`,
    date: '2026-03-28T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'TRM|technology risk|self-assessment|regulatory.*submission|MAS.*compliance',
        deadline: '2026-04-30',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 1: MAS lists 3 sub-items (a, b, c) but they are all part of one regulatory submission package due April 30. LLM correctly extracts this as a single "complete TRM compliance submission" commitment. Regulatory notification — these are obligations, not voluntary commitments.',
  },

  {
    id: 18,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Contract negotiation with legal back-and-forth',
    from_address: 'victor.lee@allenandgledhill.com',
    from_name: 'Victor Lee',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Re: Master Services Agreement — Redline Comments',
    body: `Tiger,

I've reviewed the counterparty's latest redline and have the following observations:

1. Clause 8.3 (Liability Cap) — They've increased the cap from 100% to 200% of fees paid. This is now reasonable. I recommend accepting.

2. Clause 12.1 (IP Assignment) — This is still problematic. They want full IP assignment for any custom work. I suggest we counter with a license-back arrangement. I will draft the alternative language and send it to you by Thursday for approval.

3. Clause 15.2 (Termination for Convenience) — They've reduced the notice period from 90 to 30 days. I recommend we push back to at least 60 days.

Once you confirm your position on items 1 and 3, I can turn around the final redline within 24 hours. The counterparty has asked for our response by 8 April.

Regards,
Victor Lee
Senior Associate
Allen & Gledhill LLP`,
    date: '2026-03-30T16:45:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'draft.*alternative language|IP.*language',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'confirm.*position|respond.*redline',
        deadline: '2026-04-08',
        confidence_min: 0.7,
      },
    ],
    notes: 'The user needs to confirm positions so the lawyer can finalize. The lawyer will draft IP language. The overall deadline is April 8.',
  },

  {
    id: 19,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'ACRA filing deadline with accountant action items',
    from_address: 'grace.loh@bdo.com.sg',
    from_name: 'Grace Loh',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'ActuaryHelp — Annual Return Filing and AGM',
    body: `Dear Tiger,

A few important deadlines coming up for ActuaryHelp Pte Ltd:

1. Annual Return: Must be filed with ACRA within 30 days of your AGM. Since your financial year ended 31 Dec 2025, the AR must be filed by 30 June 2026 at the latest.

2. AGM: Must be held within 6 months of FYE, i.e., by 30 June 2026. However, I strongly recommend holding it by end of May to give us buffer.

3. Audited Financial Statements: We need the management accounts from you to start the audit. Can you please send us the following by 15 April?
   - Bank statements (Jan-Dec 2025)
   - Accounts receivable aging report
   - Payroll summary

4. Tax filing (Form C-S): Estimated due date is 30 November 2026, but we'll need to start preparation by August.

I will schedule a call with you next week to discuss the audit timeline.

Best regards,
Grace Loh
Director, Audit & Assurance
BDO Singapore`,
    date: '2026-03-27T10:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'bank statements|management accounts|send.*audit',
        deadline: '2026-04-15',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'AGM|annual general meeting',
        deadline: '2026-05-31',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'schedule.*call|audit timeline',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 20,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Employment Pass application with MOM deadlines',
    from_address: 'hr@actuaryhelp.com',
    from_name: 'Mei Ling Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'EP Application for Zhang Wei — Action Required',
    body: `Hi Tiger,

The Employment Pass application for Zhang Wei (our new ML engineer from Shanghai) needs your attention:

Current status:
- EP application submitted to MOM on 20 March
- MOM has requested additional documents (see attached letter)

Required from you:
- Signed declaration letter (template attached) — I need this by 2 April
- Updated company financial statements — can you ask Grace to expedite?
- Letter of explanation for the role's salary benchmark — I've drafted this but need your review by 1 April

Zhang Wei's current SVP expires on 20 April, so we have very limited time. If MOM doesn't approve by then, he will need to leave Singapore.

I will submit everything to MOM within 24 hours of receiving your signed documents.

Please treat this as urgent.

Regards,
Mei Ling
HR Manager`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'signed declaration|declaration letter',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'review.*salary benchmark|letter of explanation',
        deadline: '2026-04-01',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'submit.*MOM',
        confidence_min: 0.7,
      },
    ],
  },

  // --- 21-25: Team delegation with action items (medium) ---

  {
    id: 21,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Tiger delegating tasks to engineering team',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'dev-team@actuaryhelp.com',
    subject: 'Sprint 14 Priorities — Action Items',
    body: `Team,

Following our retro this morning, here are the priorities for Sprint 14 (31 Mar - 11 Apr):

@Wei: I need you to finish the commitment extraction pipeline by Wednesday. The eval framework is ready — please run the test suite before marking it done.

@Priya: Please complete the email sync reliability fixes by Thursday. The reconnection logic needs to handle token refresh properly.

@Jason: The landing page redesign mockups are due by Friday. I've shared the Figma link in Slack.

I will review all PRs within 24 hours of submission. Let's try to have everything merged by Friday so we can deploy over the weekend.

Daily standups at 10am as usual. Ping me on Slack if you're blocked.

Tiger`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'review.*PRs|review.*pull requests',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'commitment extraction pipeline',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'email sync|reconnection logic',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'landing page.*mockups|redesign mockups',
        deadline: '2026-04-04',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 22,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Manager assigning research task with deadline',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sophie@actuaryhelp.com',
    subject: 'Research: Singapore Survey Panel Companies',
    body: `Sophie,

Can you please compile a list of all survey panel companies operating in Singapore by this Friday?

For each company I need:
- Company name and website
- Key contact person (name, title, email)
- Panel size (if publicly available)
- Specialization (B2B, B2C, healthcare, etc.)

I'll use this for the outreach campaign next week. Also, I'll draft the initial outreach email template by Thursday so you can review it before we start sending.

Thanks,
Tiger`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'compile.*list|survey panel companies',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'draft.*outreach.*template|outreach email',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 23,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Team member confirming task completion timeline',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Sprint 14 Priorities — Action Items',
    body: `Tiger,

Got it. I'll have the commitment extraction pipeline done by Wednesday as requested.

Quick question — should the eval framework test against the full 200-email dataset or just the 30-email smoke test? Running against 200 emails will take about 20 minutes per run due to LLM API calls.

I'll default to the 30-email test unless you say otherwise.

Also, I noticed a bug in the email threading logic — I'll fix that as part of this sprint too. Should have a PR up by Tuesday.

Wei`,
    date: '2026-03-30T11:15:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'commitment extraction pipeline',
        deadline: '2026-04-01',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'fix.*bug|email threading|PR.*Tuesday',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 24,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Operations manager delegating office tasks',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'meiling@actuaryhelp.com',
    subject: 'Office Move — Task List',
    body: `Mei Ling,

We're moving to the new office at One-North on 15 April. Here's what I need from you:

1. Coordinate with the movers — please get quotes from at least 3 companies by this Friday
2. Notify MOM about our new registered address (this is mandatory within 14 days of the move)
3. Update our ACRA business profile with the new address
4. Arrange for IT setup at the new office — coordinate with Wei on server migration

I'll handle the lease signing with the landlord this week.

Let me know if you need any approvals or budget sign-offs.

Tiger`,
    date: '2026-03-30T09:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'lease signing|sign.*lease',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'quotes.*movers|moving companies|notify MOM|ACRA.*address|office move|IT setup',
        deadline: '2026-04-03',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: Tiger delegates 4 tasks to Mei Ling (movers, MOM, ACRA, IT). LLM may group these as one "office move tasks" commitment. Tiger promises to handle lease signing.',
  },

  {
    id: 25,
    category: 'business_positive_en',
    difficulty: 'medium',
    language: 'en',
    description: 'Cross-functional task delegation after workshop',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'all-hands@actuaryhelp.com',
    subject: 'Post-Workshop Action Items',
    body: `Team,

Great workshop today. Here's a summary of who's doing what:

Product (Sophie): Finalize the persona engine v2 PRD by 7 April. Include the competitive analysis section.

Engineering (Wei): Prototype the new matching algorithm by 11 April. Use the benchmark dataset from the research team.

Marketing (Jason): Launch the updated website copy by 4 April. The Figma designs are approved.

Operations (Mei Ling): Set up the customer feedback pipeline in Intercom by 7 April.

Me: I'll schedule individual 1:1s with each of you this week to discuss resource needs. I'll also present the Q2 budget to the board on Thursday.

Let's make Q2 count!

Tiger`,
    date: '2026-03-30T17:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'schedule.*1:1|individual.*meetings|present.*Q2 budget|budget.*board',
        deadline: '2026-04-02',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'persona engine.*PRD|finalize.*PRD|matching algorithm|prototype|website copy|launch.*website|feedback pipeline|Intercom',
        deadline: '2026-04-11',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Post-workshop delegation email with 6 items. Tiger has 2 (schedule 1:1s, present budget). 4 team members each have 1 deliverable. LLM correctly groups into Tiger\'s and team\'s commitments.',
  },

  // --- 26-30: Multi-party with CC, reply-all scenarios (hard) ---

  {
    id: 26,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Reply-all with multiple stakeholders making promises',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Re: Partnership Integration — Next Steps',
    body: `Hi all,

Thanks for the alignment call. Let me summarize the action items:

Tiger (ActuaryHelp): Provide the API documentation and sandbox environment by 7 April.
Rachel (DBS, me): I will arrange the IT security assessment — expect the questionnaire by this Friday.
Marcus (DBS Tech): Marcus will provision the staging environment by 10 April. Marcus, please confirm.
Kenneth (DBS Legal): Kenneth, please prepare the data processing agreement. Target completion by 14 April.

Tiger — one additional thing: can you send me your company's SOC 2 report or equivalent? We'll need it for the security assessment.

Let's reconvene on 15 April to review progress.

Best,
Rachel

---
CC: marcus.lim@dbs.com, kenneth.wong@dbs.com, sophie@actuaryhelp.com`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'API documentation|sandbox environment|SOC 2|security report',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'security assessment|questionnaire|staging environment|data processing agreement',
        deadline: '2026-04-14',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Multi-party email with 5 items. Tiger has 2 (API docs + sandbox, SOC 2 report). DBS team has 3 (security questionnaire, staging env, DPA). LLM groups each side appropriately.',
  },

  {
    id: 27,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Board meeting follow-up with distributed action items',
    from_address: 'chairman@actuaryhelp.com',
    from_name: 'Dr. Richard Tan',
    to_address: 'board@actuaryhelp.com',
    subject: 'Board Meeting Minutes — 28 March 2026',
    body: `Dear Board Members,

Minutes from the Q1 2026 Board Meeting:

RESOLVED:
1. The Board approved the Q2 2026 budget of $450,000.
2. The Board authorized the CEO to negotiate Series A terms up to a pre-money valuation of $15M.

ACTION ITEMS:
- Tiger: Present revised 3-year financial model incorporating the new pricing tiers. Due by next board meeting (25 June).
- Tiger: Engage an external auditor for SOC 2 Type II certification. Kick off by 30 April.
- Sophie: Prepare customer case studies for investor materials. Due by 30 April.
- Dr. Tan (me): I will introduce Tiger to the CEO of Singapore Life. Expected by mid-April.

Next board meeting: 25 June 2026, 2:00pm.

Best regards,
Dr. Richard Tan
Chairman of the Board`,
    date: '2026-03-29T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '3-year financial model|financial model',
        deadline: '2026-06-25',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'SOC 2|external auditor',
        deadline: '2026-04-30',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'customer case studies',
        deadline: '2026-04-30',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'intro.*Singapore Life|introduce.*CEO',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 28,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Multi-party vendor coordination with dependencies',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'alex.ng@aws.com',
    subject: 'Re: Re: Infrastructure Setup — Coordination',
    body: `Alex,

Copying in Wei (our CTO) and Mike from NCS here for visibility.

Here's the plan:
- I'll finalize our architecture diagram and share it with all parties by Wednesday
- Alex (AWS): Please confirm the reserved instance pricing by Thursday — we need this for the board deck
- Mike (NCS): Can your team start the VPC setup once Alex confirms? Target Friday for the initial config
- Wei: Please prepare the Docker images and push them to ECR by Thursday

Mike — I also need you to send me the updated SOW reflecting the new scope. We discussed the additional $20K for the monitoring setup.

Let's do a joint call on Friday at 3pm to make sure everything is aligned.

Tiger

---
CC: wei.zhang@actuaryhelp.com, mike.tan@ncs.com.sg`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'architecture diagram|finalize.*diagram',
        deadline: '2026-04-01',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'reserved instance pricing|confirm.*pricing|VPC setup|Docker images|push.*ECR|updated SOW|statement of work',
        deadline: '2026-04-03',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: Tiger delegates to 3 different people (Alex, Mike, Wei). LLM correctly groups Tiger\'s own commitment (architecture diagram) separately from the delegated items.',
  },

  {
    id: 29,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Partnership negotiation with multiple company stakeholders',
    from_address: 'diana.lim@grab.com',
    from_name: 'Diana Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Grab x ActuaryHelp — Data Partnership Proposal',
    body: `Hi Tiger,

Thanks for the detailed proposal. Our team has reviewed it and we're excited to move forward. Here's where we are:

From Grab's side:
- I've gotten verbal approval from our VP of Data. He'll send formal approval via email by Wednesday.
- Our legal team will draft the data sharing agreement. Expect the first draft by 10 April.
- I will set up a joint Slack channel for the technical team by tomorrow.

What we need from ActuaryHelp:
- A technical architecture overview showing how our data will be processed and stored (PDPA compliance is critical)
- Sample output from your persona engine using anonymized data — can you prepare this?
- Your DPO contact details for our records

Also, my colleague Alvin from Grab Financial will be joining the next call — he's interested in the insurance analytics angle.

Best,
Diana Lim
Head of Strategic Partnerships
Grab Holdings

CC: alvin.teo@grab.com, legal-partnerships@grab.com`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'formal approval|VP.*approval|data sharing agreement|legal.*draft|Slack channel',
        deadline: '2026-04-10',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'technical architecture|architecture overview|sample output|persona engine|DPO contact',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1 + 6: Diana promises 3 things from Grab side and requests 3 things from Tiger. LLM correctly groups each side into 1-2 commitments.',
  },

  {
    id: 30,
    category: 'business_positive_en',
    difficulty: 'hard',
    language: 'en',
    description: 'Conference speaking commitment with organizer requirements',
    from_address: 'events@sff.org.sg',
    from_name: 'Jolene Ang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'SFF 2026 — Speaker Confirmation and Requirements',
    body: `Dear Tiger,

We are delighted to confirm your speaking slot at the Singapore FinTech Festival 2026.

Session Details:
- Panel: "AI-Powered Insurance: From Hype to Reality"
- Date: 5 November 2026, 2:00pm - 2:45pm
- Venue: Singapore EXPO, Hall 3, Stage B

Required from you by 1 May 2026:
1. Speaker bio (max 150 words)
2. Professional headshot (min 300x300px, JPEG)
3. Panel discussion talking points (3-5 bullet points)
4. Signed speaker agreement (attached)

Additionally, if you plan to use any slides, please submit them by 15 October 2026.

I will send you the other panelists' bios by end of April so you can prepare accordingly. Your co-panelists will include representatives from Swiss Re and Ping An.

Please confirm your acceptance by replying to this email.

Best regards,
Jolene Ang
Programme Director
Singapore FinTech Festival`,
    date: '2026-03-28T15:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'speaker.*materials|speaker.*bio|speaker.*agreement|SFF.*speaker|confirm.*acceptance|speaking.*requirements',
        deadline: '2026-05-01',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'panelists.*bios|other.*bios|co-panelist',
        deadline: '2026-04-30',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 1: Four speaker requirements (bio, headshot, talking points, signed agreement) are one package of "submit speaker materials by May 1". LLM correctly groups them. The user needs to confirm acceptance first.',
  },

  // =========================================================================
  // BUSINESS POSITIVE ZH (31-50)
  // =========================================================================

  // --- 31-35: 合同/报价承诺 (easy) ---

  {
    id: 31,
    category: 'business_positive_zh',
    difficulty: 'easy',
    language: 'zh',
    description: '简单的报价承诺，周五前发送',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'zhangming@pingan.com.cn',
    subject: 'Re: 数据分析平台报价需求',
    body: `张总，您好！

感谢贵司的关注。我们对平安的数据分析需求非常感兴趣。

我会在本周五（4月3日）之前把正式报价单发给您，包含三个方案的详细定价。

如有任何问题，随时联系。

Best regards,
Tiger Li
ActuaryHelp CEO`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '报价单|报价',
        deadline: '2026-04-03',
        confidence_min: 0.9,
      },
    ],
  },

  {
    id: 32,
    category: 'business_positive_zh',
    difficulty: 'easy',
    language: 'zh',
    description: '对方承诺发送合同初稿',
    from_address: 'liwei@tencent.com',
    from_name: '李伟',
    to_address: 'tiger@actuaryhelp.com',
    subject: '合作协议初稿',
    body: `Tiger您好，

上次在深圳聊得很愉快，我们团队对ActuaryHelp的技术能力印象深刻。

法务部已经开始起草合作协议了，预计下周三之前可以发给您审阅。合同金额按我们讨论的年费80万人民币来拟定。

另外，我们的技术团队想安排一次线上技术对接会，我这边会在明天跟您确认具体时间。

李伟
腾讯云 · 金融行业解决方案
`,
    date: '2026-03-30T15:30:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '合作协议|合同.*初稿',
        deadline: '2026-04-08',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '确认.*时间|技术对接',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 33,
    category: 'business_positive_zh',
    difficulty: 'easy',
    language: 'zh',
    description: '承诺修改合同条款并回传',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wangfang@cpic.com.cn',
    subject: 'Re: 技术服务合同修改意见',
    body: `王芳女士，您好！

收到合同修改意见了，非常感谢。关于第三条保密条款和第五条知识产权归属的修改，我们原则上同意。

我会让法务在两个工作日内把修改后的版本发回给您确认。

祝商祺！
Tiger Li`,
    date: '2026-03-30T11:20:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '修改.*合同|发回.*确认',
        deadline: '2026-04-01',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 34,
    category: 'business_positive_zh',
    difficulty: 'easy',
    language: 'zh',
    description: '供应商承诺提供产品样本',
    from_address: 'chenhua@alicloud.com',
    from_name: '陈华',
    to_address: 'tiger@actuaryhelp.com',
    subject: '阿里云产品试用申请',
    body: `Tiger老师好！

您申请的阿里云企业版试用已经获批。我这边会在明天下午之前把试用账号和技术文档发到您的邮箱。

试用期限为30天，期间包含以下服务：
- ECS弹性计算 2核4G x 3台
- RDS数据库 MySQL 8.0
- OSS对象存储 100GB

如需延长试用或升级配置，随时联系我。

陈华
阿里云国际 · 东南亚区`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '试用账号|技术文档',
        deadline: '2026-03-31',
        confidence_min: 0.9,
      },
    ],
  },

  {
    id: 35,
    category: 'business_positive_zh',
    difficulty: 'easy',
    language: 'zh',
    description: '确认签署保密协议',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sunli@bytedance.com',
    subject: 'Re: 保密协议签署',
    body: `孙总，

保密协议我已经看过了，没有问题。我明天签字盖章后扫描发给您。

原件我会通过顺丰寄到你们北京办公室，预计周三能到。

Tiger`,
    date: '2026-03-30T17:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '签字.*保密协议|签字盖章',
        deadline: '2026-03-31',
        confidence_min: 0.9,
      },
      {
        type: 'i_promised',
        title_pattern: '寄.*原件|顺丰',
        deadline: '2026-04-01',
        confidence_min: 0.8,
      },
    ],
  },

  // --- 36-40: 项目交付时间表 (medium) ---

  {
    id: 36,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '项目里程碑计划确认',
    from_address: 'zhaojun@huawei.com',
    from_name: '赵军',
    to_address: 'tiger@actuaryhelp.com',
    subject: '华为云联合方案 — 里程碑确认',
    body: `Tiger，

经过内部讨论，我们确认以下里程碑节点：

M1 需求确认：4月10日前完成（我方负责整理需求文档）
M2 技术方案评审：4月20日（双方联合评审）
M3 POC开发完成：5月15日（贵方负责核心算法，我方负责基础设施）
M4 联合测试：5月30日
M5 正式上线：6月15日

每个里程碑完成后，双方需签署确认书。

请确认以上时间节点是否可行。如有调整，请在本周内反馈。

赵军
华为云 · 保险行业解决方案部`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '需求文档|需求确认',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: '核心算法|POC开发',
        deadline: '2026-05-15',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: '确认.*时间|反馈.*调整',
        confidence_min: 0.6,
      },
    ],
  },

  {
    id: 37,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '甲方催促项目进度',
    from_address: 'liuyang@citic.com',
    from_name: '刘洋',
    to_address: 'tiger@actuaryhelp.com',
    subject: '中信保诚项目进度确认 — 紧急',
    body: `Tiger,

系统上线日期在即，以下几个事项需要您尽快确认：

1. 数据迁移脚本 — 原定3月28日交付，目前状态？
2. 用户权限模块 — 测试环境已经部署了吗？
3. 性能测试报告 — 我们内部安全审计需要，最迟4月5日之前提供

另外，我们CTO要求在上线前做一次全面的安全渗透测试。你们有推荐的第三方吗？如果没有，我这边可以安排我们合作的安泰信来做，费用由我方承担。

请今天下班前回复我进度情况。

刘洋
中信保诚 · IT部门`,
    date: '2026-03-30T14:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '项目进度|数据迁移|权限模块|性能测试|progress.*update|deliverables',
        deadline: '2026-04-05',
        confidence_min: 0.6,
      },
      {
        type: 'i_promised',
        title_pattern: '回复.*进度|reply.*status|respond.*progress',
        deadline: '2026-03-30',
        confidence_min: 0.6,
      },
    ],
  },

  {
    id: 38,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '团队内部项目排期沟通',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: '新加坡人寿项目排期',
    body: `小伟，

新加坡人寿的项目已经签了，4月1日正式启动。以下是我的安排：

1. 你负责后端API开发，预计3周完成（4月21日前）
2. 前端部分我会找外包团队来做，我这周把需求文档整理好发给他们
3. 数据库设计我们一起review，我建议周三上午开个会讨论

另外，你有没有认识的DevOps工程师？项目需要一个兼职的来搞CI/CD。

Tiger`,
    date: '2026-03-30T09:45:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '后端API|API开发',
        deadline: '2026-04-21',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: '需求文档|整理.*需求',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 39,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '外包团队确认交付计划',
    from_address: 'yangwei@infosys.com',
    from_name: '杨威',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: 前端开发外包 — 交付计划',
    body: `Tiger总，

感谢信任！我们团队已经看过需求文档，以下是交付计划：

第一周（4月7-11日）：完成页面框架和组件库搭建
第二周（4月14-18日）：核心业务页面开发
第三周（4月21-25日）：联调测试和Bug修复
第四周（4月28-5月2日）：验收和部署支持

团队配置：1名前端lead + 2名开发 + 1名测试
每周一、四下午3点定期同步会议。

我会在4月3日之前把详细的WBS和人员名单发给您确认。

杨威
Infosys · 中国区交付中心`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'WBS|人员名单|详细.*计划',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '页面框架|组件库',
        deadline: '2026-04-11',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 40,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '产品经理确认功能上线时间',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Sophie Marketing MVP — 功能上线时间表',
    body: `Tiger，

Sophie Marketing MVP的功能优先级和上线时间我重新排了一下：

P0 — 4月7日上线：
- Lead CRM基础功能
- 邮件模板管理

P1 — 4月14日上线：
- 审批工作流
- 序列引擎（基础版）

P2 — 4月28日上线：
- 内容生成（DeepSeek集成）
- 数据看板

我会在明天把PRD最终版发给你和Wei确认。需要你帮忙review一下定价策略那部分。

Sophie`,
    date: '2026-03-30T20:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'PRD|最终版',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'review.*定价|定价策略',
        confidence_min: 0.7,
      },
    ],
  },

  // --- 41-45: 付款/发票跟进 (medium) ---

  {
    id: 41,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '催付款邮件',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'caiwu@zhonghe.com',
    subject: '关于发票ZH-2026-0043的付款提醒',
    body: `中和保险财务部，您好！

我司于3月15日向贵司开具了编号为ZH-2026-0043的服务费发票，金额为人民币15万元。根据合同约定，付款期限为发票日起30天，即4月14日。

如已安排付款，请忽略此邮件。如有任何问题，请随时联系我。

我会在4月10日再跟进一次确认付款状态。

谢谢！
Tiger Li
ActuaryHelp Pte Ltd`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '跟进.*付款|确认付款',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '付款|支付.*发票',
        deadline: '2026-04-14',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 42,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '对方确认付款安排',
    from_address: 'wangxin@taiping.com.hk',
    from_name: '王欣',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: 季度服务费发票',
    body: `Tiger，

发票收到了。我已经提交给财务部审批，正常流程需要10个工作日。

预计4月15日左右可以完成银行转账。款项会打到你们在DBS的公司账户。

另外，下个季度的服务合同需要续签，我会在4月底之前把续约合同发给你。条款跟现有合同一样，价格不变。

王欣
太平再保险 · 运营部`,
    date: '2026-03-30T14:30:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '银行转账|付款|完成.*转账',
        deadline: '2026-04-15',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '续约合同|续签.*合同',
        deadline: '2026-04-30',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 43,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '开票请求与付款条件确认',
    from_address: 'zhangpeng@metlife.com.cn',
    from_name: '张鹏',
    to_address: 'tiger@actuaryhelp.com',
    subject: '请开具4月份服务费发票',
    body: `Tiger，

4月份的服务费可以开票了。以下是开票信息：

公司名称：大都会人寿保险有限公司
统一社会信用代码：91310000MA1FL8BD3L
金额：人民币12万元（含税）
开票内容：技术服务费

请在4月5日之前开具并寄送电子发票到我的邮箱。

我这边确认收到发票后会在5个工作日内安排付款。

张鹏
大都会人寿 · 采购部`,
    date: '2026-03-30T16:20:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '开.*发票|开票',
        deadline: '2026-04-05',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '安排付款|付款',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 44,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '退款处理承诺',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'luming@aia.com.sg',
    subject: 'Re: 多付款项退还',
    body: `陆明，您好！

经核实，贵司确实多付了5000新元（SGD），是上个月两笔发票重复支付导致的。

我已经通知财务部处理退款，款项会在3个工作日内退回到贵司账户。退款完成后我会发确认邮件给您。

给您带来不便深表歉意。

Tiger Li`,
    date: '2026-03-30T11:10:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '退款|退回.*款项',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: '确认邮件|发.*确认',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 45,
    category: 'business_positive_zh',
    difficulty: 'medium',
    language: 'zh',
    description: '预付款安排确认',
    from_address: 'chenxiao@zurich.com.cn',
    from_name: '陈晓',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: 项目预付款安排',
    body: `Tiger，

好的，我们同意按照合同约定支付30%预付款（9万新元）。

我明天会发起付款申请，经过我们内部三级审批后，预计一周内到账。转账的时候我会备注合同编号ACH-2026-0012。

到账后请发一封确认邮件，我们好做内部存档。

另外，项目启动会我建议安排在4月8日（周三）下午2点，你看方便吗？

陈晓
苏黎世保险 · 项目管理办公室`,
    date: '2026-03-30T13:40:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: '预付款|30%.*付款|支付.*预付',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: '确认邮件|到账.*确认',
        confidence_min: 0.7,
      },
    ],
  },

  // --- 46-50: 政府/企业客户正式邮件 (hard) ---

  {
    id: 46,
    category: 'business_positive_zh',
    difficulty: 'hard',
    language: 'zh',
    description: '政府项目招标通知',
    from_address: 'procurement@imda.gov.sg',
    from_name: 'IMDA Procurement',
    to_address: 'tiger@actuaryhelp.com',
    subject: '邀请报价 — 数字化转型顾问服务 (RFQ-IMDA-2026-0156)',
    body: `致：ActuaryHelp Pte Ltd
    CEO Tiger Li 先生

资讯通信媒体发展局（IMDA）现邀请贵公司就以下项目提交报价：

项目名称：保险行业数字化转型顾问服务
参考编号：RFQ-IMDA-2026-0156
预算范围：SGD 200,000 - 500,000

报价截止日期：2026年4月18日 下午5:00（新加坡时间）

报价要求：
1. 公司资质证明（ACRA注册证书、相关行业经验）
2. 技术方案书（不超过30页）
3. 项目团队简历
4. 分项报价表（使用附件模板）
5. 过往类似项目案例（至少3个）

如有疑问，请于4月10日之前发送至 queries-rfq0156@imda.gov.sg。4月10日之后不再接受问询。

请注意：逾期提交的报价将不予受理。

此致
IMDA采购部`,
    date: '2026-03-28T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '报价|RFQ.*提交|技术方案',
        deadline: '2026-04-18',
        confidence_min: 0.7,
      },
    ],
    notes: 'Government RFQ — the deadline is firm. Whether the user decides to submit is a business decision, but if they do, the deadline is April 18.',
  },

  {
    id: 47,
    category: 'business_positive_zh',
    difficulty: 'hard',
    language: 'zh',
    description: '大型企业客户正式邮件，多层审批流程',
    from_address: 'lihua@icbc.com.cn',
    from_name: '李华',
    to_address: 'tiger@actuaryhelp.com',
    subject: '工商银行保险事业部 — 合作方案审批进展',
    body: `Tiger先生，

关于贵司提交的"智能保险画像"合作方案，现将审批进展通报如下：

1. 业务部门评审：已通过（3月25日）
2. 技术安全评审：进行中，预计4月8日完成
3. 合规审查：待技术安全评审通过后启动，约需两周
4. 分行领导审批：预计4月底

根据我行采购流程，我们需要贵司补充以下材料：
(1) 数据安全等级保护认证（等保三级）
(2) 近三年审计报告
(3) 主要技术人员资质证明

请于4月10日之前提交上述材料。材料不齐全将影响审批进度。

我会在技术安全评审完成后第一时间通知您结果。

李华
中国工商银行 · 保险事业部 · 科技创新处
010-66106688 ext. 8834`,
    date: '2026-03-30T10:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '补充.*材料|等保.*认证|审计报告|资质证明|submit.*materials|compliance.*documents',
        deadline: '2026-04-10',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '技术安全评审|安全评审.*结果|security.*review',
        deadline: '2026-04-08',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 48,
    category: 'business_positive_zh',
    difficulty: 'hard',
    language: 'zh',
    description: '央企合规要求邮件',
    from_address: 'wangdong@circ.gov.cn',
    from_name: '王栋',
    to_address: 'tiger@actuaryhelp.com',
    subject: '关于数据出境安全评估的通知',
    body: `ActuaryHelp Pte Ltd：

根据《数据出境安全评估办法》相关规定，贵司作为向境外提供保险行业数据的处理者，需完成以下合规义务：

一、数据出境安全评估申报
自本通知发出之日起60日内，贵司需通过国家互联网信息办公室网站提交数据出境安全评估申报材料。

二、所需材料
1. 数据出境安全评估申报书
2. 数据出境风险自评估报告
3. 与境外接收方签订的合同
4. 其他证明数据出境安全的材料

三、联系方式
如有疑问，请联系本处王栋，电话：010-55627489

请贵司高度重视此项工作，按时完成申报。

国家互联网信息办公室
数据管理局`,
    date: '2026-03-25T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '数据出境.*评估|安全评估.*申报',
        deadline: '2026-05-24',
        confidence_min: 0.8,
      },
    ],
    notes: 'Regulatory compliance notice — 60 days from March 25 = May 24. This is a hard legal obligation.',
  },

  {
    id: 49,
    category: 'business_positive_zh',
    difficulty: 'hard',
    language: 'zh',
    description: '企业客户验收邮件，附带整改要求',
    from_address: 'zhouli@chinare.com.cn',
    from_name: '周丽',
    to_address: 'tiger@actuaryhelp.com',
    subject: '中再保险 — 第一阶段验收意见',
    body: `Tiger先生，

第一阶段的系统验收已完成，验收委员会的意见如下：

通过项（5/8）：
✓ 用户管理模块
✓ 数据导入功能
✓ 基础报表
✓ 系统安全
✓ 部署文档

需整改项（3/8）：
✗ 画像生成速度 — 当前平均响应时间12秒，合同要求5秒以内
✗ 并发处理 — 50并发时系统出现明显延迟
✗ 数据导出格式 — 缺少PDF导出功能

请在15个工作日内（即4月18日前）完成整改并提请复验。

复验通过后，我方将在7个工作日内支付第一阶段尾款（合同金额的40%）。

周丽
中再保险集团 · 信息技术部`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '整改|性能优化|响应时间',
        deadline: '2026-04-18',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '尾款|支付.*40%',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 50,
    category: 'business_positive_zh',
    difficulty: 'hard',
    language: 'zh',
    description: '政府基金申请跟进',
    from_address: 'grants@edb.gov.sg',
    from_name: 'EDB Grants Office',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'EDB — 企业发展计划(EDG)申请跟进 REF: EDG-2026-3847',
    body: `Dear Mr. Li,

感谢贵司提交的企业发展计划（Enterprise Development Grant）申请。

经初步审核，我们需要贵司补充以下信息：

1. 项目详细预算表（请使用附件模板）— 截止日期：4月15日
2. 技术团队成员的专业资质证明 — 截止日期：4月15日
3. 过去12个月的银行对账单 — 截止日期：4月15日
4. 修改后的项目计划（需包含具体KPI） — 截止日期：4月15日

请将补充材料发送至 grants@edb.gov.sg，邮件标题请注明参考编号 EDG-2026-3847。

材料补充完整后，审批委员会将在4周内给出最终结果。

如有疑问，欢迎致电 6832 6832 或回复此邮件。

经济发展局
企业发展处`,
    date: '2026-03-28T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'EDG.*材料|补充.*材料|grant.*submission|预算表|资质证明|银行对账单|项目计划',
        deadline: '2026-04-15',
        confidence_min: 0.7,
      },
    ],
  },

  // =========================================================================
  // BUSINESS POSITIVE MIXED — Chinglish (51-60)
  // =========================================================================

  // --- 51-55: "我来handle这个" / "帮我follow up" (medium) ---

  {
    id: 51,
    category: 'business_positive_mixed',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Chinglish — 我来handle这个',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sophie@actuaryhelp.com',
    subject: 'Re: DBS integration issue',
    body: `Sophie，

这个DBS API的issue我来handle。他们的sandbox token过期了，我今天重新generate一个然后update到production environment。

你帮我follow up一下Rachel那边的security questionnaire，她说Thursday之前会send过来。收到了forward给Wei就行。

另外那个marketing email的campaign scheduling你搞定了吗？下周一之前要launch的。

Tiger`,
    date: '2026-03-30T10:20:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'handle.*DBS|API.*token|generate.*token',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'follow up.*questionnaire|security questionnaire',
        deadline: '2026-04-02',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 52,
    category: 'business_positive_mixed',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Chinglish — meeting安排 + action items',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: '明天的client meeting准备',
    body: `Tiger，

明天跟Prudential的meeting我已经book了conference room B，10am到11:30am。

几个需要你准备的东西：
1. Product demo那个environment要check一下，上次有个bug没fix
2. Pricing deck要update，他们问了Enterprise tier的volume discount
3. 你之前说要prepare一个case study，写好了吗？

我这边会print hard copy的proposal（10份），还有prepare那个ROI calculator的spreadsheet。

Btw, 你们上次聊的那个referral program，Priya说她interested，我会arrange一个follow up call这周。

Sophie`,
    date: '2026-03-30T18:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'demo.*environment|check.*bug|fix.*bug|pricing deck|update.*pricing|case study|meeting.*prep',
        deadline: '2026-03-31',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'arrange.*follow up|referral.*call',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 1: Sophie lists 3 prep items for tomorrow\'s client meeting (demo env, pricing deck, case study). LLM correctly groups as one "prepare for Prudential meeting" commitment.',
  },

  {
    id: 53,
    category: 'business_positive_mixed',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Chinglish — 日常工作沟通',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: deployment问题',
    body: `Tiger，

Deployment的问题我查到了，是Vercel那边的environment variable没有set对。

我今晚会fix然后redeploy，明早你check一下production应该就OK了。

另外有几个tech debt的issue需要你prioritize一下：
1. 那个email sync的reconnection logic，我plan下个sprint来做
2. Database migration script需要你review，我已经push到staging branch了
3. 还有monitoring那个Grafana dashboard，我这周设置好

你帮我approve一下Wei-feature-branch的PR可以吗？我卡在code review这步了。

Wei`,
    date: '2026-03-30T21:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'fix.*redeploy|deployment.*fix',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'review.*migration|database migration.*review',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'approve.*PR|code review',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'Grafana dashboard|monitoring.*dashboard',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 54,
    category: 'business_positive_mixed',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Chinglish — vendor coordination',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'jason.lee@actuaryhelp.com',
    subject: '帮我coordinate一下这几个vendor',
    body: `Jason，

下面几个vendor的事情帮我coordinate一下：

1. AWS那边Alex说credits已经approve了，你帮我follow up看什么时候activate
2. Figma的enterprise plan需要renew，月底expire。你contact他们拿个quote，我来approve
3. 那个Intercom的integration，你跟他们support team confirm一下timeline

我这周会把vendor management的SOP整理出来，以后这些事情都归你manage。

Thanks,
Tiger`,
    date: '2026-03-30T09:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'vendor management.*SOP|SOP.*整理|vendor.*SOP',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'follow up.*AWS|activate.*credits|Figma.*renew|Figma.*quote|Intercom.*timeline|confirm.*timeline|vendor.*coordinate',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: Tiger delegates 3 vendor tasks to Jason and commits to writing the SOP. LLM may group the 3 delegation items into one "coordinate vendors" commitment.',
  },

  {
    id: 55,
    category: 'business_positive_mixed',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Chinglish — 客户反馈跟进',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Customer feedback需要你看一下',
    body: `Tiger，

几个重要的customer feedback需要你attention：

1. DBS Rachel说persona accuracy不够，特别是高净值客户那个segment。她给了specific examples，我已经forward给Wei了。你需要decide是这个sprint fix还是下个sprint。

2. Singlife Sarah提了一个feature request — 要支持batch export。我觉得是reasonable的，我会写进backlog。你confirm一下priority？

3. 有个new lead从SFF conference来的，Tokio Marine的VP。他wants a demo next week。我来schedule，你available哪天？

我今天会compile所有feedback into一个summary doc，明天morning meeting之前发给你。

Sophie`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'decide.*sprint|persona accuracy|confirm.*priority|batch export|customer feedback.*decision',
        confidence_min: 0.5,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'feedback.*summary|compile.*feedback|schedule.*demo|Tokio Marine',
        deadline: '2026-03-31',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 1: Sophie asks for 2 decisions (sprint prioritization, batch export priority). These are decisions not deliverables - low confidence. Sophie promises 2 things (feedback summary, schedule demo).',
  },

  // --- 56-60: English subject, Chinese body or vice versa (hard) ---

  {
    id: 56,
    category: 'business_positive_mixed',
    difficulty: 'hard',
    language: 'mixed',
    description: 'English subject, Chinese body — formal business',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'investor-relations@glp.com',
    subject: 'Follow Up: Partnership Discussion at GLP Summit',
    body: `GLP投资者关系团队，

上周在GLP Summit上跟你们的林总聊得很好。关于保险资产管理数据分析的合作，我们非常有兴趣。

我会在本周内准备一份detailed proposal，covering以下几个方面：
1. 我们的技术平台overview
2. 保险行业的use cases
3. 初步的pricing framework

预计周四之前可以发给你们。请帮我转给林总和你们的CTO review。

Best regards,
Tiger Li`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'proposal|prepare.*proposal',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 57,
    category: 'business_positive_mixed',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Chinese subject, English body — tech discussion',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: '关于DeepSeek API迁移的计划',
    body: `Tiger,

I've been benchmarking DeepSeek vs SiliconFlow for our persona engine and here are the results:

DeepSeek Chat:
- Latency: avg 2.3s per request
- Quality: 8.2/10 on our eval set
- Cost: ~$0.002 per persona

SiliconFlow:
- Latency: avg 1.8s per request
- Quality: 7.9/10 on our eval set
- Cost: ~$0.0015 per persona

My recommendation is to stick with DeepSeek for quality-critical paths and use SiliconFlow for batch processing.

I will prepare a migration plan by Friday. 具体的implementation timeline我会在plan里面详细写。

另外deployment那边需要新的API key，你帮我在SiliconFlow的dashboard上create一个然后add to our .env.local。

Wei`,
    date: '2026-03-30T15:45:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'migration plan',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'API key|create.*key|SiliconFlow.*key',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 58,
    category: 'business_positive_mixed',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Mixed email — HR related with Singapore context',
    from_address: 'meiling@actuaryhelp.com',
    from_name: 'Mei Ling Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'EP renewal + 新员工onboarding事项',
    body: `Tiger，

几个HR matters需要你attention：

1. Zhang Wei的EP renewal — MOM已经acknowledge了我们的submission。预计2-3周出结果。I will keep you posted。

2. 新来的intern, Amy from NUS，下周一start。我已经prepare了onboarding materials。需要你：
   - Block 30分钟跟她做个welcome chat
   - Assign her a mentor（建议Sophie）
   - Approve her laptop purchase（budget $2,000，Dell XPS）

3. CPF submission for March — 已经done了。但是发现上个月有个discrepancy，Wei的contribution少算了$50。我会在下个月adjust。

4. Team dinner claim from last Friday — receipt attached。Total $387.50。Please approve in Xero so I can reimburse everyone。

Mei Ling`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'welcome chat|intern|Amy|assign.*mentor|approve.*laptop|approve.*Xero|approve.*dinner|onboarding',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'EP renewal.*result|MOM.*result|keep.*posted',
        confidence_min: 0.6,
      },
    ],
  },

  {
    id: 59,
    category: 'business_positive_mixed',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Mixed — client email with code-switching',
    from_address: 'jenny.chua@manulife.com.sg',
    from_name: 'Jenny Chua',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: UAT环境的access issue',
    body: `Hi Tiger,

UAT环境的access issue我们IT team查了一下，是firewall rule的问题。他们说whitelist你们的IP address需要change request，大概要3个working days。

所以estimated可以access的时间是4月3日。Sorry for the delay！

另外，我们的business users已经prepare了test cases（总共48个），我会在access开通之后share给你们team。Testing的deadline是4月14日，因为4月15日有个management review meeting。

一个small request — 能不能帮我们出一个简单的user guide？不需要很detailed，就是basic的操作流程就好。我们的users不太tech savvy。

Jenny`,
    date: '2026-03-30T14:45:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'UAT.*access|whitelist.*IP|firewall',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'share.*test cases',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'user guide|操作流程',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 60,
    category: 'business_positive_mixed',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Mixed — event planning with Singlish flair',
    from_address: 'jason.lee@actuaryhelp.com',
    from_name: 'Jason Lee',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Company offsite planning — 几个options',
    body: `Tiger,

Company offsite的planning update一下ah：

Option A: Sentosa那边的Capella Hotel，两天一夜package $380 per pax。Very atas but 预算够吗？
Option B: Bintan resort，3D2N package $280 per pax including ferry。比较worth但是需要passport。
Option C: Changi那边的Dusit Thani，day trip $150 per pax。最budget friendly。

我leaning towards Option B lah，team building效果最好。

需要你：
1. Decide哪个option（Friday之前confirm ah）
2. Approve budget — 我会prepare一个detailed breakdown给你
3. 帮忙想几个team building activities的idea

我这边会：
- Call各个venue确认availability for 19-20 April
- 问大家的dietary restrictions
- Research team building facilitator的quote

Can update me by EOW？

Jason`,
    date: '2026-03-30T12:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'decide.*option|confirm.*option|choose.*venue|approve.*budget|team building.*activities|offsite.*decision',
        deadline: '2026-04-03',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'venue.*availability|call.*venue|dietary restrictions|facilitator.*quote|team building facilitator',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: Offsite planning with 6 items. Tiger has 3 decisions (choose venue, approve budget, suggest activities). Jason has 3 tasks (check venues, collect dietary info, get facilitator quote). LLM groups into 1-2 per side.',
  },

  // =========================================================================
  // FAMILY / PERSONAL POSITIVE (61-75)
  // =========================================================================

  // --- 61-65: School pickup/activities (easy) ---

  {
    id: 61,
    category: 'family_personal',
    difficulty: 'easy',
    language: 'en',
    description: 'Simple school pickup commitment',
    from_address: 'wife@gmail.com',
    from_name: 'Mei',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Can you pick up Emma today?',
    body: `Hi dear,

I have a client meeting until 5pm today so I can't pick up Emma. Can you get her from school at 3:30pm?

Also remember she has ballet class at 4:15pm at the studio near Junction 8.

Don't forget to bring her ballet shoes — they're in the shoe rack by the door.

Thanks!
Mei`,
    date: '2026-03-30T08:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'pick up Emma|school pickup',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'ballet|ballet shoes',
        deadline: '2026-03-30',
        confidence_min: 0.7,
      },
    ],
    notes: 'This is a request from spouse. Treating it as a commitment since it is directed at the user to action.',
  },

  {
    id: 62,
    category: 'family_personal',
    difficulty: 'easy',
    language: 'en',
    description: 'Tiger confirming school pickup',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@gmail.com',
    subject: 'Re: Can you pick up Emma today?',
    body: `Ok got it. I'll pick her up at 3:30. Will bring the ballet shoes.

Can you buy milk on your way home? We ran out this morning.

Tiger`,
    date: '2026-03-30T08:35:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'pick.*up|school.*3:30',
        deadline: '2026-03-30',
        confidence_min: 0.9,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'buy milk',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 63,
    category: 'family_personal',
    difficulty: 'easy',
    language: 'en',
    description: 'School teacher email about upcoming event',
    from_address: 'ms.chen@rafflesgirls.edu.sg',
    from_name: 'Ms. Chen Wei Lin',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Parent-Teacher Conference — 8 April',
    body: `Dear Mr. Li,

This is to remind you that the Parent-Teacher Conference is scheduled for Wednesday, 8 April 2026, from 2:00pm to 5:00pm.

Your slot with Ms. Chen (Form Teacher, 3B) is at 3:15pm.

Please confirm your attendance by replying to this email by 4 April.

If you have any specific concerns you'd like to discuss, please let me know in advance so I can prepare accordingly.

Warm regards,
Ms. Chen Wei Lin
Form Teacher, Primary 3B
Raffles Girls' Primary School`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'parent-teacher|confirm.*attendance|reply.*conference',
        deadline: '2026-04-04',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 64,
    category: 'family_personal',
    difficulty: 'easy',
    language: 'zh',
    description: '课外班报名确认',
    from_address: 'admin@kumon.com.sg',
    from_name: 'Kumon Toa Payoh Centre',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Enrolment Confirmation — Emma Li',
    body: `Dear Mr. Li,

Thank you for enrolling Emma Li in our Math programme at Kumon Toa Payoh Centre.

Class details:
- Subject: Mathematics (Level C)
- Schedule: Every Tuesday and Friday, 4:00pm - 5:00pm
- Start date: 7 April 2026

Please ensure the following before the first class:
1. Complete the student registration form (attached)
2. Submit the GIRO form for monthly fee deduction ($150/month)
3. Purchase the Kumon stationery set ($15) at the centre

If you have any questions, please don't hesitate to contact us.

Best regards,
Kumon Toa Payoh Centre
Blk 190 Lor 6 Toa Payoh #01-548`,
    date: '2026-03-29T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'registration form',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'GIRO form',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 65,
    category: 'family_personal',
    difficulty: 'easy',
    language: 'en',
    description: 'School volunteer commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'pta@rafflesgirls.edu.sg',
    subject: 'Re: Volunteers Needed for Sports Day',
    body: `Hi,

I'd like to volunteer for Sports Day on 12 April. I can help with the registration booth from 8am to 12pm.

Please let me know if there's anything I need to prepare beforehand.

Thanks,
Tiger Li
(Father of Emma Li, 3B)`,
    date: '2026-03-30T20:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'volunteer.*Sports Day|registration booth',
        deadline: '2026-04-12',
        confidence_min: 0.85,
      },
    ],
  },

  // --- 66-70: Doctor appointments, birthday promises (medium) ---

  {
    id: 66,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Doctor appointment reminder with prep instructions',
    from_address: 'appointments@rafflesmedical.com',
    from_name: 'Raffles Medical Group',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Appointment Reminder — 2 April 2026',
    body: `Dear Mr. Li,

This is a reminder of your upcoming appointment:

Doctor: Dr. Tan Ah Kow
Specialty: General Health Screening
Date: Thursday, 2 April 2026
Time: 8:30 AM
Location: Raffles Hospital, Level 5, Room 508

Pre-appointment instructions:
- Fast for 10 hours before the appointment (no food after 10:30pm the night before)
- Bring your NRIC and insurance card
- If you are on any medication, please bring the list

Please arrive 15 minutes early for registration.

To reschedule, call 6311 1111 at least 24 hours in advance.

Raffles Medical Group`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'health screening|doctor.*appointment|Raffles.*appointment',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 67,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Promising to organize birthday party',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@gmail.com',
    subject: 'Re: Emma\'s birthday party planning',
    body: `Mei,

OK here's what I'll take care of for Emma's birthday on April 19:

1. I'll book the party room at Timezone Vivocity — I'll call them tomorrow
2. I'll order the cake from Awfully Chocolate (chocolate fudge, her favourite) — need to order by April 12
3. I'll send the evites to her classmates' parents — can you give me the parent group WhatsApp list?

You handle the return gifts and decorations as discussed.

Btw my mum said she'll come help set up on the day. She's flying in from KL on the 18th.

Tiger`,
    date: '2026-03-30T21:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'book.*party room|Timezone|book.*venue',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'order.*cake|Awfully Chocolate',
        deadline: '2026-04-12',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'send.*evites|invitations',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'WhatsApp list|parent.*list',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 68,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'zh',
    description: '家庭医生预约 — 中文',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@gmail.com',
    subject: 'Re: 妈妈体检的事',
    body: `我已经帮妈妈预约了4月5日上午的体检，在鹰阁医院（Gleneagles）。

项目包括：
- 基础体检套餐
- 额外加了心脏彩超（她去年心脏不太好）
- 骨密度检查

我那天会开车送她去。你帮忙提醒她前一晚10点后不要吃东西。

费用大概$1,200，用她的Medisave可以cover一部分。我明天去CPF网站看一下她Medisave余额够不够。

Tiger`,
    date: '2026-03-30T22:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '送.*体检|开车送|陪.*体检',
        deadline: '2026-04-05',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'CPF.*Medisave|查.*余额',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '提醒.*不要吃|提醒妈妈',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 69,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Dental appointment and insurance claim',
    from_address: 'wife@gmail.com',
    from_name: 'Mei',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Emma dentist + insurance claim',
    body: `Dear,

Emma's dental appointment is confirmed:
- Q&M Dental, Toa Payoh Central
- Wednesday 2 April, 4pm
- It's just a routine checkup + cleaning

Can you take her? I have yoga that day.

Also, I submitted the insurance claim for my physio sessions last month but haven't heard back. The claim ref is CLM-2026-0234. Can you call AIA to follow up? The number is on the back of your insurance card.

One more thing — we need to renew our car insurance by April 15. Can you get quotes from DirectAsia and FWD? Last year we paid $1,800 with NTUC Income, quite expensive.

Mei`,
    date: '2026-03-30T19:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'take.*Emma.*dentist|dental appointment|dentist',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'call AIA|insurance claim|car insurance.*quotes|renew.*car insurance|insurance.*follow',
        deadline: '2026-04-15',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1: Three separate requests but dentist is a distinct event. The two insurance tasks (AIA claim follow-up, car insurance quotes) could be grouped as "handle insurance tasks". Accept 2-3 commitments.',
  },

  {
    id: 70,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Promise to attend school concert',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'ms.chen@rafflesgirls.edu.sg',
    subject: 'Re: Annual School Concert — 18 April',
    body: `Dear Ms. Chen,

Thank you for the invitation. Both my wife and I will attend Emma's school concert on 18 April.

Emma has been practicing her violin piece every night — she's very excited!

I'll also bring my video camera to record the performance. Is there assigned seating or is it first-come-first-served?

One more thing — Emma mentioned she needs a white blouse for the concert. My wife will purchase it this weekend.

Best regards,
Tiger Li`,
    date: '2026-03-30T20:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'attend.*concert|school concert',
        deadline: '2026-04-18',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'white blouse|purchase.*blouse',
        confidence_min: 0.7,
      },
    ],
  },

  // --- 71-75: Family trip planning, parenting commitments (medium) ---

  {
    id: 71,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Family trip planning with multiple bookings',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@gmail.com',
    subject: 'June holiday trip to Tokyo',
    body: `Mei,

I've been looking at flights for our Tokyo trip (6-13 June). Here's the plan:

Flights:
- I'll book the SQ flights tonight. The early bird sale ends tomorrow so we need to decide.
- SQ638 departs 7:45am on 6 June, arrives 3:15pm. Return SQ637 on 13 June. Total $3,200 for 3 pax.

Hotel:
- I'll book the Hotel Gracery Shinjuku — it's the Godzilla hotel Emma wanted. 7 nights at $250/night.

Activities:
- I'll buy the Disneyland tickets online (cheaper than at the gate). Probably just 1 day — Tokyo Disney Sea.
- You handle the restaurant reservations? Especially that omakase place your friend recommended.

Need from you:
- Check if our passports are still valid (Emma's might be expiring?)
- Book the travel insurance (maybe just use the credit card one?)

Budget estimate: ~$8,000 total. I'll transfer from savings this week.

Excited!
Tiger`,
    date: '2026-03-30T22:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'book.*flights|SQ.*flights|book.*hotel|Hotel Gracery|Disneyland|Disney.*tickets|transfer.*savings|Tokyo.*trip|trip.*booking',
        deadline: '2026-03-30',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'passport.*valid|check.*passport|travel insurance|restaurant.*reservations|omakase',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1: Tiger lists 4 booking tasks for Tokyo trip (flights, hotel, Disney, transfer). LLM correctly groups as "handle Tokyo trip bookings". Wife has 3 tasks (passports, insurance, restaurants). Accept 1-2 from each group.',
  },

  {
    id: 72,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'zh',
    description: '安排家庭聚餐',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'brother@gmail.com',
    subject: '清明节家庭聚餐安排',
    body: `哥，

清明节（4月5日）的家庭聚餐我来安排。

计划：
1. 我订了Imperial Treasure金殿（ION Orchard店），晚上6:30，8个人
2. 爸妈我去接，下午5点出发
3. 你和嫂子自己过来？还是要我一起接？

菜已经提前点好了（海参、龙虾、片皮鸭那套），人均大概$120。费用我来出，你别争了。

你帮我买两瓶好点的红酒带过来行吗？爸最近迷上了波尔多。

Tiger`,
    date: '2026-03-30T21:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '接.*爸妈|去接',
        deadline: '2026-04-05',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '红酒|买.*酒|波尔多',
        confidence_min: 0.8,
      },
    ],
    notes: 'Restaurant is already booked. The active commitments are the pickup and the wine.',
  },

  {
    id: 73,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Parenting commitment — tuition teacher arrangement',
    from_address: 'wife@gmail.com',
    from_name: 'Mei',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Emma\'s Chinese tuition',
    body: `Tiger,

I found a good Chinese tuition teacher for Emma. Mrs. Huang, recommended by Sarah's mum. She teaches at her HDB flat in Bishan.

Details:
- Tuesdays 5-6pm
- $60/hour
- Can start from next week (7 April)

I need you to:
1. Drive Emma there for the first lesson (I'll be at pilates)
2. Bring the Chinese textbook and assessment book — buy from Popular if we don't have it
3. Prepare $240 cash for the first month's payment

Also, can you talk to Emma about this? She's been complaining about having too many enrichment classes. Maybe explain that Chinese is important since we're sending her to RGPS.

Let me know if Tuesday works for your schedule.

Mei`,
    date: '2026-03-30T19:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'drive Emma|tuition.*first lesson|textbook|assessment book|Popular|cash.*\\$240|payment|talk to Emma|explain.*Chinese|Chinese tuition',
        deadline: '2026-04-07',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1: Four requests from spouse about tuition setup form one package. LLM correctly groups as "handle Chinese tuition arrangements". All are prerequisite tasks for the same event (first lesson April 7).',
  },

  {
    id: 74,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'HDB renovation planning',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@gmail.com',
    subject: 'Re: Kitchen renovation quotes',
    body: `Mei,

I've compared the 3 quotes:
- Contractor A (Ah Hock): $18,000 — cheapest but no reviews online
- Contractor B (Renozone): $24,500 — good reviews, 2-year warranty
- Contractor C (Design 4 Space): $31,000 — premium but too expensive

I think we should go with Contractor B. I'll call them tomorrow to confirm and put down the $3,000 deposit.

Timeline they quoted is 4-6 weeks. If we start mid-April, should be done by end of May.

I'll also need to:
- Apply for HDB renovation permit (I'll do this online this week)
- Notify the neighbours in writing (requirement from Town Council)
- Arrange temporary kitchen setup (maybe we use the camping stove?)

Can you finalize the kitchen tile selection by this weekend? They need to order it 2 weeks in advance.

Tiger`,
    date: '2026-03-30T22:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'call.*contractor|confirm.*Renozone|deposit|HDB.*renovation permit|apply.*permit|notify.*neighbours|renovation|kitchen.*renovation',
        deadline: '2026-03-31',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'tile selection|kitchen tile|finalize.*tile',
        deadline: '2026-04-05',
        confidence_min: 0.8,
      },
    ],
    notes: 'Principle 1: Tiger lists 3 renovation tasks (call contractor, apply permit, notify neighbours) - all part of one renovation prep commitment. Wife needs to finalize tile selection.',
  },

  {
    id: 75,
    category: 'family_personal',
    difficulty: 'medium',
    language: 'en',
    description: 'Elderly parent care coordination',
    from_address: 'brother@gmail.com',
    from_name: 'David Li',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Dad\'s follow-up appointment at SGH',
    body: `Tiger,

Thanks for taking Dad to the appointment last time. The cardiologist wants to see him again on 10 April for the stress test results.

I can't take him that day — I have a work trip to Jakarta. Can you handle it?

Also, a few things:
1. His medication is running low. Can you pick up the refill from the SGH pharmacy? The prescription is under his name (Li Ah Beng, NRIC S1234567A).
2. Mum mentioned the helper's work permit needs renewal. I'll handle the MOM application — just send me the helper's passport copy.
3. Can you transfer me $500 for Dad's hospital bill? I paid first last time. PayNow to my DBS account.

Let me know about April 10.

David`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'take Dad.*appointment|Dad.*SGH|stress test|medication|pharmacy|passport copy|transfer.*\\$500|PayNow',
        deadline: '2026-04-10',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 1: Four requests from brother all relate to parent care. LLM may group as 1-2 commitments. These are requests from brother — whether user accepts is TBD, but the email asks clearly. Principle 2: from brother (inbound) requesting Tiger to do things = i_promised.',
  },

  // =========================================================================
  // MULTI-COMMITMENT (76-90)
  // =========================================================================

  // --- 76-80: Meeting minutes with action items ---

  {
    id: 76,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Weekly team meeting minutes with 4+ action items',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'all-hands@actuaryhelp.com',
    subject: 'Meeting Minutes — Weekly Sync 30 March 2026',
    body: `Hi team,

Here are the minutes from today's weekly sync:

ATTENDEES: Tiger, Sophie, Wei, Jason, Mei Ling

UPDATES:
- Product: Sophie demoed the new lead CRM. Feedback was positive. Tiger suggested adding a Kanban view — Sophie to evaluate feasibility by Wednesday.
- Engineering: Wei reported the email sync is 80% complete. Remaining work is the reconnection logic. ETA: Thursday.
- Marketing: Jason shared the new landing page mockups. Tiger approved the hero section but wants the pricing page redesigned. Jason to send revised mockups by Monday.
- Operations: Mei Ling confirmed the office move is on track for 15 April.

ACTION ITEMS:
1. [Tiger] Review and approve the Q2 marketing budget — by Wednesday
2. [Tiger] Send intro email to Grab partnership contact — by tomorrow
3. [Sophie] Evaluate Kanban view feasibility — by Wednesday
4. [Wei] Complete email sync reconnection logic — by Thursday
5. [Jason] Redesign pricing page mockups — by Monday 7 April
6. [Mei Ling] Share office move checklist with team — by Friday
7. [Tiger] Schedule 1:1 with each team member — by Friday

NEXT MEETING: Monday 6 April, 10:00am

Sophie`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'Q2 marketing budget|approve.*budget|intro.*Grab|schedule.*1:1',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'Kanban|email sync|reconnection|pricing.*mockups|office.*checklist',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Meeting minutes with 7 action items. LLM correctly prioritizes the 2-3 most important ones. Tiger has ~3 items (budget approval, Grab intro, 1:1s) and team has ~4 items. Accept if LLM extracts any 2-3 from each group.',
  },

  {
    id: 77,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Client kickoff meeting minutes with action items',
    from_address: 'sarah.lim@singlife.com',
    from_name: 'Sarah Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Singlife x ActuaryHelp — Kickoff Meeting Notes',
    body: `Hi Tiger,

Great kickoff today! Here's a summary:

PROJECT: Persona Engine Integration for Singlife Direct
TIMELINE: 6 April - 30 May 2026
BUDGET: SGD 85,000

KEY DECISIONS:
- We will use Singlife's existing AWS infrastructure
- Data will stay in the ap-southeast-1 region (PDPA requirement)
- Weekly sync every Monday at 2pm

ACTION ITEMS:

ActuaryHelp:
1. Tiger to provide project plan with detailed milestones — by 4 April
2. Wei to set up development environment on Singlife's AWS — by 7 April
3. Tiger to sign the amended SOW and return — by 3 April

Singlife:
4. Sarah to share API documentation for Singlife's customer data platform — by 4 April
5. Marcus (Singlife IT) to create AWS IAM roles for ActuaryHelp team — by 7 April
6. Sarah to introduce Tiger to Singlife's DPO for PDPA compliance discussion — by this week

RISKS:
- Singlife's data platform migration is scheduled for May. Need to coordinate timing.

Please review and let me know if I've missed anything.

Sarah`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'project plan|milestones|sign.*SOW|amended SOW',
        deadline: '2026-04-04',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'API documentation|customer data|IAM roles|AWS.*setup|introduce.*DPO',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Kickoff meeting with 6 action items split between both sides. LLM correctly groups Tiger\'s 2-3 items (project plan, sign SOW) and Singlife\'s 3 items (API docs, IAM roles, DPO intro). Accept any 1-2 from each group.',
  },

  {
    id: 78,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Investor meeting follow-up with action items',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sophie@actuaryhelp.com',
    subject: 'Fwd: Action items from Sequoia meeting',
    body: `Sophie,

Just finished the Sequoia meeting. Very positive — they want to move to partner vote next week. Here's what we need to do ASAP:

1. I need to update the financial model with the sensitivity analysis they requested — I'll do this tonight
2. You need to compile the customer reference list — they want 3 customers they can call. Ask Rachel (DBS), Sarah (Singlife), and Jenny (Manulife) if they're willing. Need this by Wednesday.
3. I'll write the follow-up email to Melissa tonight summarizing our conversation
4. Wei needs to prepare a technical deep-dive deck for their CTO — can you brief him? Due by Friday.
5. I'll send the updated cap table to our lawyer for review tomorrow

Also, they mentioned they want to visit our office. Can you suggest a few dates next week and send to Melissa's EA?

This could be the one. Let's nail it.

Tiger`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'financial model|sensitivity analysis|follow-up email|cap table',
        deadline: '2026-03-31',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'customer reference|reference list|technical.*deck|deep-dive|office visit.*dates',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Tiger has 3 urgent items (financial model tonight, follow-up email tonight, cap table tomorrow) and delegates 3 to Sophie (references, tech deck, office visit dates). LLM correctly prioritizes 2-3 core items.',
  },

  {
    id: 79,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'zh',
    description: '中文会议纪要 — 多个行动项',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: '平安项目周会纪要 — 3月30日',
    body: `Tiger，

以下是今天平安项目周会的纪要：

出席人员：Tiger、Sophie、Wei、平安方刘经理、张工

进度回顾：
- 数据对接已完成80%，剩余部分预计本周三完成（Wei负责）
- UI设计稿已获平安方确认，可以开始前端开发
- 性能测试环境搭建中，预计周四ready

本周行动项：
1. 【Tiger】回复平安方关于数据安全合规的书面说明 — 周二前
2. 【Tiger】审批追加预算申请（服务器扩容$5,000） — 明天
3. 【Wei】完成剩余20%数据对接 — 周三
4. 【Sophie】准备下周客户培训材料 — 周五前
5. 【Tiger】安排与平安CTO的一对一沟通 — 本周内

下次会议：4月6日（周一）下午3点

Sophie`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '数据安全.*说明|合规.*书面|审批.*预算|服务器扩容|CTO.*沟通',
        deadline: '2026-03-31',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '数据对接|培训材料|客户培训',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Meeting minutes with 5 items. Tiger has 3 items (security doc, budget approval, CTO meeting). Team has 2 items (data integration, training materials). LLM may group Tiger\'s items into 1-2 commitments.',
  },

  {
    id: 80,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Board meeting minutes with resolutions and action items',
    from_address: 'secretary@actuaryhelp.com',
    from_name: 'Board Secretary',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Board Resolution & Action Items — Emergency Session 29 March',
    body: `CONFIDENTIAL

ActuaryHelp Pte Ltd
Emergency Board Meeting — 29 March 2026

PRESENT: Dr. Richard Tan (Chairman), Tiger Li (CEO), Patrick Ho (Director), Ravi Kumar (Observer)

RESOLUTION 1: The Board approves the engagement of BDO Singapore as external auditors for FY2025, at a fee not exceeding SGD 25,000.

RESOLUTION 2: The Board authorizes the CEO to execute the Series A term sheet with Jungle Ventures, subject to final legal review.

ACTION ITEMS:
1. CEO to instruct legal counsel to begin Series A documentation — by 1 April
2. CEO to provide BDO with management accounts for FY2025 — by 15 April
3. CEO to present updated employee equity plan at next board meeting — 25 June
4. Chairman to introduce CEO to potential strategic investor (Singapore Life) — by mid-April
5. CEO to implement the approved hiring plan (3 engineers, 1 BD) — begin immediately
6. CEO to report monthly cash position to board — ongoing, by 5th of each month

Next meeting: 25 June 2026, 2:00pm

[Approved by Chairman]`,
    date: '2026-03-29T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'Series A.*documentation|legal counsel|management accounts|BDO|equity plan|hiring plan|cash position',
        deadline: '2026-04-15',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'introduce.*Singapore Life|strategic investor',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Board resolution with 6 CEO action items. LLM correctly prioritizes the 2-3 most urgent ones. The chairman\'s intro to Singapore Life is the only waiting_on_them. Accept if LLM extracts any 2-3 of the CEO items.',
  },

  // --- 81-85: Project standup notes ---

  {
    id: 81,
    category: 'multi_commitment',
    difficulty: 'medium',
    language: 'en',
    description: 'Daily standup email with blockers and commitments',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Standup Update — 30 March',
    body: `Tiger,

Yesterday:
- Merged the email threading fix (PR #234)
- Started on the commitment extraction pipeline
- Fixed the Supabase connection pooling issue

Today:
- Continue commitment extraction — will finish the prompt engineering part
- Set up the eval framework (test harness + scoring)
- Code review Jason's landing page PR

Blockers:
- Need DeepSeek API key with higher rate limits — can you request this? Current key is throttled at 60 RPM.
- The staging database needs to be reset — I'll do it but need your approval first
- Waiting on Sophie for the commitment taxonomy document

Notes:
- I noticed our Vercel bill jumped to $89 last month. Might want to look at the bandwidth usage.
- I'll be working from home tomorrow (Tuesday) — dentist appointment in the morning.

Wei`,
    date: '2026-03-30T10:05:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'DeepSeek.*rate limits|API key.*request',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'approve.*database reset|staging.*reset',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'commitment extraction|prompt engineering',
        deadline: '2026-03-30',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'eval framework|test harness',
        deadline: '2026-03-30',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 82,
    category: 'multi_commitment',
    difficulty: 'medium',
    language: 'en',
    description: 'Sprint review notes with carryover items',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'all-hands@actuaryhelp.com',
    subject: 'Sprint 13 Review & Sprint 14 Planning Notes',
    body: `Team,

SPRINT 13 REVIEW:
Completed: 18/22 story points (82% velocity)

Carryover to Sprint 14:
- STORY-45: Email sync reconnection (3 pts) — Wei, due Wed
- STORY-48: Landing page redesign (5 pts) — Jason, due Fri
- BUG-12: Persona engine timeout on large datasets — Wei, due Thu

NEW for Sprint 14:
- STORY-50: Commitment extraction MVP (8 pts) — Wei, due end of sprint
- STORY-51: Customer onboarding flow (5 pts) — Sophie + Tiger, due Wed 9 April
- STORY-52: Billing integration with Stripe (3 pts) — Wei, due end of sprint

TIGER ACTION ITEMS:
1. Write the product requirements for STORY-51 (onboarding flow) — by Tuesday
2. Review and approve STORY-50 technical design — by Wednesday
3. Decide on Stripe vs PayNow for billing — by Tuesday

RETROSPECTIVE NOTES:
- Team feels we need better CI/CD — Wei to propose improvements
- Demo environment keeps breaking — need a dedicated staging

Sophie`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'product requirements|STORY-51.*requirements|onboarding.*requirements',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'review.*technical design|STORY-50.*design',
        deadline: '2026-04-01',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'Stripe vs PayNow|billing.*decide',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'email sync|reconnection|STORY-45',
        deadline: '2026-04-01',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'landing page|STORY-48',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
    ],
  },

  {
    id: 83,
    category: 'multi_commitment',
    difficulty: 'medium',
    language: 'mixed',
    description: 'Mixed language standup with action items',
    from_address: 'jason.lee@actuaryhelp.com',
    from_name: 'Jason Lee',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Marketing standup — content pipeline update',
    body: `Tiger,

Marketing update for this week:

Done:
- Blog post on "AI in Insurance" published (200 views first day, not bad)
- LinkedIn company page更新了new branding
- SEO audit report from Ahrefs — 我email给你了，需要你看一下

This week plan:
1. 我会写一篇case study about the DBS partnership（需要Rachel approve才能publish）
2. Landing page copy的final version我周三给你review
3. SFF conference的booth design，我找了一个vendor出quote，明天发给你

Need from you:
- Approve the Google Ads budget increase ($500 → $1,000/month) — 我觉得ROI还不错
- 帮我record一个2-minute product demo video for the website
- Review the SEO audit report and tell me top 3 priorities

Wei答应帮我setup Google Tag Manager，他说Thursday可以搞定。

Jason`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'Google Ads.*budget|approve.*budget|demo video|record.*video|SEO audit|review.*SEO',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'case study|landing page copy|booth design.*quote|Google Tag Manager',
        deadline: '2026-04-02',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: Marketing standup with 7 items. Tiger has 3 action items (approve budget, record video, review SEO). Jason has 4 deliverables. LLM correctly prioritizes 2-3 core items from each group.',
  },

  {
    id: 84,
    category: 'multi_commitment',
    difficulty: 'medium',
    language: 'en',
    description: 'Product standup with dependencies',
    from_address: 'sophie@actuaryhelp.com',
    from_name: 'Sophie Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Product update — research agent + Sophie marketing',
    body: `Tiger,

Quick update on both product streams:

RESEARCH AGENT:
- Ontology design is 70% done. I'll finish the remaining 4 tables by Wednesday.
- The multi-turn guidance flow needs your input on the question sequencing. Can we do a 30-min session tomorrow?
- I've drafted the Phase 2 diagnostic layer spec — will share for your review by Thursday.

SOPHIE MARKETING:
- Lead CRM wireframes approved by you last week. Wei started development.
- Approval workflow design — I need your decision on whether approvals go through email or in-app. Let me know by Tuesday.
- Content generation: I've tested DeepSeek for email drafting. Quality is good. Will prepare a comparison report (DeepSeek vs GPT-4) by Friday.

BLOCKING:
- The unified entry architecture decision from last week — you said you'd write up the decision doc. Still waiting on that. It's blocking the navigation redesign.

Sophie`,
    date: '2026-03-30T09:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'unified entry.*decision|architecture.*decision|approval workflow.*decision|question sequencing',
        deadline: '2026-03-31',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'ontology.*tables|diagnostic.*spec|comparison report|DeepSeek vs GPT',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Product standup with 6 items. Tiger has 3 decisions/actions (unified entry doc is blocking and most important, approval workflow decision, question sequencing input). Sophie has 3 deliverables. LLM may prioritize the blocking item.',
  },

  {
    id: 85,
    category: 'multi_commitment',
    difficulty: 'medium',
    language: 'en',
    description: 'Operations standup with vendor and admin tasks',
    from_address: 'meiling@actuaryhelp.com',
    from_name: 'Mei Ling Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Ops Weekly Update — 30 March',
    body: `Tiger,

Weekly ops update:

COMPLETED:
- March payroll processed and submitted to CPF
- Office cleaning contract renewed (12 months, $450/month)
- Travel insurance purchased for your Shenzhen trip (4-6 April)

IN PROGRESS:
1. Office move to One-North — movers confirmed for 15 April. I'll send you the final cost breakdown by Wednesday.
2. New employee laptops — ordered 3x MacBook Pro. Expected delivery by 7 April. I'll set them up when they arrive.
3. Company credit card application with DBS — submitted. Should hear back in 5-7 business days.

NEED YOUR ACTION:
- Sign the updated employment contracts for Wei and Jason (pay raise effective 1 April). I'll put them on your desk tomorrow.
- Approve the Q2 pantry supplies budget ($800). I've attached the breakdown.
- The fire safety certificate is expiring. Need to book an inspection — should I arrange or will you?

REMINDER:
- Your Shenzhen flight is SQ 882, 4 April, 8:15am. Don't forget your China visa is in your passport.

Mei Ling`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'sign.*employment contracts|contracts.*Wei.*Jason|approve.*pantry|pantry supplies|fire safety.*inspection|book.*inspection',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'cost breakdown|office move.*cost|laptops.*delivery|MacBook.*delivery',
        deadline: '2026-04-07',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Ops update with 5 items. Tiger has 3 approval/admin tasks. Mei Ling has 2 in-progress items. LLM may group Tiger\'s tasks as one "handle admin approvals" commitment.',
  },

  // --- 86-90: Strategy discussion with scattered promises ---

  {
    id: 86,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Strategy email with commitments buried in discussion',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sophie@actuaryhelp.com',
    subject: 'Thoughts on Q2 strategy + some action items',
    body: `Sophie,

Been thinking about our Q2 strategy over the weekend. Some thoughts:

On the product side, I think we need to double down on the persona engine. The feedback from DBS and Singlife validates the core value prop. But we're spreading too thin — the research agent, Sophie Marketing, the measurement skeleton... we need to focus.

My instinct says: ship the commitment extraction feature this sprint, then go all-in on the persona engine accuracy improvement. I'll write a detailed strategy memo this week and share it with the team.

On the go-to-market side, the SFF conference in November is our big moment. We need to have at least 5 paying customers by then to have credibility on stage. That means we need to close 2 more deals this quarter. I'll personally lead the Grab and Tokio Marine conversations.

Re: fundraising — Sequoia meeting went well (sent you the notes separately). Jungle Ventures is also interested. I think we should target closing the round by end of May. I'll prepare an updated pitch deck this week and send it to you for review.

One more thing — can you set up a customer advisory board? Even if it's informal. Get 3-4 customers who are willing to give us monthly feedback. I think Rachel, Sarah, and Jenny would be good candidates. Try to have the first session by end of April.

Lots to do but I'm excited about where we're headed.

Tiger`,
    date: '2026-03-30T23:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'strategy memo|write.*memo',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'lead.*Grab|Grab.*conversation|Tokio Marine',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'pitch deck|updated.*deck',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'customer advisory board|advisory.*board',
        deadline: '2026-04-30',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 87,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Long strategy discussion with hidden action items',
    from_address: 'ravi.kumar@jungle.vc',
    from_name: 'Ravi Kumar',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Post-meeting thoughts + next steps',
    body: `Tiger,

Great conversation today. A few things I want to follow up on:

1. VALUATION: I've discussed with my partners and we're comfortable with the $12M pre-money. I'll have our lawyers send you the updated term sheet by Friday. Please have your lawyer review and get back to us within 2 weeks.

2. BOARD COMPOSITION: We'd like one board seat. I suggest we discuss governance structure on our next call. I'll send you some sample board charters from our other portfolio companies for reference.

3. MARKET DATA: You mentioned the McKinsey report on Southeast Asian InsurTech. Can you send me the link or a copy? I want to include it in my IC memo.

4. REFERENCE CHECKS: As part of our diligence, we'll need to speak with 2-3 of your customers and 1-2 former colleagues. I'll have my associate, Cheryl, coordinate the reference check schedule with you next week.

5. CO-INVESTMENT: I mentioned that East Ventures might be interested in co-investing. I'll make the intro this week — their partner, Willson, is a good guy.

My associate will follow up on the logistics. Looking forward to getting this done.

Ravi`,
    date: '2026-03-30T19:00:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'term sheet|board charter|reference check|intro.*East Ventures|Willson',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'lawyer.*review|term sheet.*review|McKinsey report|send.*report',
        confidence_min: 0.6,
      },
    ],
    notes: 'Principle 6: VC meeting follow-up with 6 items. Ravi promises 4 things (term sheet, board charters, reference checks, East Ventures intro). Tiger has 2 (legal review of term sheet, send McKinsey report). LLM correctly prioritizes 2-3 core items.',
  },

  {
    id: 88,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'zh',
    description: '中文战略讨论邮件，承诺分散在长文中',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'liwei@tencent.com',
    subject: 'Re: 腾讯云合作方向探讨',
    body: `李伟，

谢谢上周在深圳的深度交流。我回来后仔细思考了我们讨论的几个方向：

方向一：联合解决方案
你们的云基础设施 + 我们的保险画像引擎，打包成行业解决方案。我觉得这个方向最有潜力。我会在下周准备一份联合方案的初步框架文档，发给你看看。

方向二：数据合作
这个需要更谨慎。涉及跨境数据传输和PDPA/个保法的合规问题。我建议先让双方法务沟通一下可行性。我这边会让Amanda（我们的法律顾问）下周联系你们法务部。

方向三：投资
这个我觉得可以先放一放，等我们的Series A完成后再讨论。

几个具体的next step：
1. 我下周出差深圳的时候可以去你们办公室做一个正式的产品演示，你帮我安排一下？
2. 你提到的那个保险行业白皮书，方便发我一份吗？
3. 我会把我们的技术架构文档整理一份脱敏版本发给你们技术团队评估

另外你推荐的那家深圳餐厅确实不错，下次去一定再去！

Tiger`,
    date: '2026-03-30T22:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '联合方案|框架文档|Amanda.*法务|法律顾问|技术架构文档|脱敏版本',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: '安排.*演示|产品演示|白皮书|保险.*白皮书',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Strategy discussion with 5 items. Tiger has 3 (framework doc, lawyer contact, tech architecture doc). Li Wei has 2 (arrange demo, send whitepaper). LLM correctly prioritizes core items.',
  },

  {
    id: 89,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Partnership discussion with scattered commitments',
    from_address: 'diana.lim@grab.com',
    from_name: 'Diana Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Re: Data Partnership — Deep Dive Discussion',
    body: `Tiger,

Thanks for the thorough technical walkthrough yesterday. My team was impressed. Here's where things stand:

TECHNICAL FEASIBILITY: Our engineering team (CC'd Alvin) confirmed it's doable. They estimate 4-6 weeks for the integration on their end. Alvin will send you the technical requirements spec by next Monday.

COMMERCIAL TERMS: I need to loop in our BD team for pricing discussion. I'll schedule a call with you and our BD lead, Kenneth, for next week. Are you available Wednesday or Thursday afternoon?

DATA GOVERNANCE: This is the tricky part. Our DPO flagged that we need a Data Protection Impact Assessment (DPIA) before we can share any customer data, even anonymized. I'll send you our DPIA template by Friday. Please complete your section and return within 2 weeks.

PILOT SCOPE: I suggest we start with a pilot using Grab's driver-partner insurance dataset (50K records, fully anonymized). This avoids the more complex customer data governance issues. I'll prepare the pilot proposal and share it by end of next week.

INTERNAL STAKEHOLDERS: I'm presenting this to our Chief Data Officer on 10 April. To make the case, I'll need:
- A 2-page executive summary from you (non-technical, focused on business value)
- 1-2 customer testimonials or case studies
- Your SOC 2 or ISO 27001 certification status

Can you get me these by 7 April?

Exciting stuff. Let's make this happen.

Diana`,
    date: '2026-03-30T15:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'executive summary|2-page.*summary|testimonials|case studies|SOC 2|ISO 27001|DPIA.*complete|materials.*Diana',
        deadline: '2026-04-07',
        confidence_min: 0.6,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'technical requirements|Alvin.*spec|DPIA template|pilot proposal|schedule.*call|BD.*call',
        deadline: '2026-04-06',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Partnership deep dive with 8 items. Diana asks for 3 things by April 7 (exec summary, testimonials, SOC2 status) - these form one package. Diana promises 4 things (tech spec, BD call, DPIA template, pilot proposal). LLM correctly groups into 2-3 core commitments.',
  },

  {
    id: 90,
    category: 'multi_commitment',
    difficulty: 'hard',
    language: 'en',
    description: 'Fundraising strategy discussion with action items buried throughout',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'patrick.ho@gmail.com',
    subject: 'Fundraising update + advice needed',
    body: `Patrick,

Quick update on the fundraise:

Jungle Ventures: Very warm. Ravi sent the updated term sheet — $12M pre-money, $4M raise. I've forwarded it to Victor (Allen & Gledhill) for review. He'll get back to me by mid-week. I think we should push for $13M but otherwise the terms are fair.

Sequoia: Melissa wants to move to partner vote. They're doing reference checks this week. I gave them Rachel (DBS) and Sarah (Singlife) as references — I'll ping both of them to give them a heads up.

East Ventures: Ravi is making the intro this week. I'll follow up once connected.

Antler: Kevin wants to participate in the round. Small ticket ($200K) but strategically useful. I'll send him the SAFE note this week.

What I need your advice on:
1. Should we take both Jungle and Sequoia, or pick one lead? I'm leaning towards Jungle as lead with Sequoia as co-lead.
2. What's your view on giving Ravi a board seat? He's asking for it.
3. Should we carve out a $500K allocation for strategic angels?

I'll draft a fundraising memo summarizing all the conversations and share it with you and the board by this Friday. Let me know when you're free for a call this week.

Tiger`,
    date: '2026-03-30T21:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'ping.*Rachel.*Sarah|heads up.*reference',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'follow up.*East Ventures',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'SAFE note.*Antler|send.*SAFE',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'fundraising memo|draft.*memo',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
    ],
    notes: 'Victor reviewing the term sheet is mentioned as already in progress, not a new commitment. The questions to Patrick are requests for advice, not commitments.',
  },

  // =========================================================================
  // REPLY CHAIN CONTEXT (91-100)
  // =========================================================================

  // --- 91-95: "Got it, will do" (easy when you see the quoted text) ---

  {
    id: 91,
    category: 'reply_chain',
    difficulty: 'medium',
    language: 'en',
    description: 'Short reply confirming action from quoted context',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: API Documentation Request',
    body: `Got it, will send by Thursday.

Tiger

> On 30 Mar 2026, at 10:15, Rachel Tan <rachel.tan@dbs.com> wrote:
>
> Hi Tiger,
>
> Can you please send us the updated API documentation for the persona engine v2?
> We need it for our internal security review. By Thursday would be ideal.
>
> Thanks,
> Rachel`,
    date: '2026-03-30T10:20:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'API documentation|send.*documentation',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 92,
    category: 'reply_chain',
    difficulty: 'medium',
    language: 'en',
    description: 'Acknowledging and confirming delegation',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sophie@actuaryhelp.com',
    subject: 'Re: Investor deck feedback',
    body: `Thanks, will incorporate all the feedback and send the updated version by EOD tomorrow.

> On 30 Mar 2026, at 14:00, Sophie Zhang <sophie@actuaryhelp.com> wrote:
>
> Tiger,
>
> Reviewed the investor deck. Main feedback:
> - Slide 5: TAM numbers need updating (use 2025 data)
> - Slide 8: Add the competitive landscape comparison table
> - Slide 12: Financial projections should show 3 scenarios (bear/base/bull)
> - Slide 15: Team slide needs to include the new hires
>
> Also, the overall narrative could be tighter. Consider leading with the "why now" story.
>
> Sophie`,
    date: '2026-03-30T14:10:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'investor deck|updated.*deck|incorporate.*feedback',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 93,
    category: 'reply_chain',
    difficulty: 'medium',
    language: 'en',
    description: 'Quick confirmation of meeting attendance',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Steering Committee Meeting — 3 April',
    body: `Confirmed. I'll be there at 2pm. Will bring the updated project status report.

T

> On 29 Mar 2026, at 16:00, Sarah Lim <sarah.lim@singlife.com> wrote:
>
> Hi Tiger,
>
> Reminder: The project steering committee meeting is scheduled for Thursday 3 April at 2pm in our board room (Level 18, CapitaGreen).
>
> Please bring:
> - Updated project status report
> - Risk register
> - Resource utilization report
>
> Let me know if you can make it.
>
> Sarah`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'steering committee|meeting.*3 April|project status report',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
    ],
    notes: 'Tiger confirmed attendance and mentioned the status report. The risk register and resource utilization report are also implicitly promised since Sarah asked for them.',
  },

  {
    id: 94,
    category: 'reply_chain',
    difficulty: 'medium',
    language: 'zh',
    description: '中文回复确认 — 短回复+引用',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'zhangming@pingan.com.cn',
    subject: 'Re: 技术方案评审安排',
    body: `好的，4月10日没问题。我会提前准备好技术方案PPT。

> 2026年3月30日 15:00, 张明 <zhangming@pingan.com.cn> 写道：
>
> Tiger,
>
> 技术方案评审定在4月10日（周五）下午2点，腾讯会议。
> 请准备以下内容：
> 1. 系统架构概述
> 2. 数据安全方案
> 3. 性能测试计划
> 4. 上线部署方案
>
> 评审委员会包括我们的CTO和安全团队。请重视。
>
> 张明`,
    date: '2026-03-30T15:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '技术方案.*PPT|评审.*准备|方案评审',
        deadline: '2026-04-10',
        confidence_min: 0.85,
      },
    ],
  },

  {
    id: 95,
    category: 'reply_chain',
    difficulty: 'medium',
    language: 'en',
    description: 'Agreeing to multiple items in short reply',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'meiling@actuaryhelp.com',
    subject: 'Re: Office Move Checklist — Approvals Needed',
    body: `All approved. Go ahead with all three.

For item 2, use the company credit card. For item 3, budget up to $2,000.

I'll sign the lease agreement when you put it on my desk.

> On 30 Mar 2026, at 11:30, Mei Ling Tan <meiling@actuaryhelp.com> wrote:
>
> Tiger,
>
> Need your approval on 3 things for the office move:
>
> 1. Mover contract with SingMove Logistics — $3,500 for 15 April
> 2. New office furniture order from IKEA — $4,200 (desks, chairs, shelving)
> 3. IT cabling and network setup by TechConnect — quote $1,800
>
> Also, the lease agreement for the new office needs your signature. I'll print it out tomorrow.
>
> Mei Ling`,
    date: '2026-03-30T11:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'sign.*lease|lease agreement',
        confidence_min: 0.85,
      },
    ],
    notes: 'The three approvals are decisions, not commitments per se. The lease signing is the actual actionable commitment.',
  },

  // --- 96-100: Nested reply chains with commitment in latest reply (hard) ---

  {
    id: 96,
    category: 'reply_chain',
    difficulty: 'hard',
    language: 'en',
    description: 'Triple-nested reply chain — commitment only clear from full context',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Re: Re: Data Quality Issues in UAT',
    body: `Perfect, thanks Tiger. We'll test on our end once the hotfix is deployed. Please confirm when it's live.

> On 30 Mar 2026, at 16:00, Tiger Li <tiger@actuaryhelp.com> wrote:
>
> Rachel,
>
> Wei found the root cause — it's a timezone conversion issue in the data pipeline. Records with timestamps before 2020 were being parsed as UTC instead of SGT.
>
> He's deploying the hotfix to UAT tonight. Should be fixed by tomorrow morning.
>
> > On 30 Mar 2026, at 14:30, Rachel Tan <rachel.tan@dbs.com> wrote:
> >
> > Tiger,
> >
> > We're seeing data quality issues in the UAT environment. About 15% of the persona records have incorrect date fields. For example, customer ID DBS-2847193 shows a policy start date of 2019 instead of 2024.
> >
> > Can your team investigate ASAP? This is blocking our testing.
> >
> > > On 28 Mar 2026, at 10:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> > >
> > > Hi Rachel,
> > >
> > > The UAT environment is ready for your testing. All 50K records have been loaded.
> > > Please let us know if you encounter any issues.
> > >
> > > Tiger`,
    date: '2026-03-30T16:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'confirm.*hotfix|confirm.*live|hotfix.*deployed',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'hotfix.*UAT|deploy.*fix|timezone.*fix',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
    notes: 'Rachel asks Tiger to confirm when hotfix is live. Wei is deploying tonight (waiting_on_them since Wei is on Tiger\'s team). The original commitment context spans 3 levels of replies.',
  },

  {
    id: 97,
    category: 'reply_chain',
    difficulty: 'hard',
    language: 'en',
    description: 'Reply chain where scope changed mid-conversation',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Re: Custom Report Feature — Scope Change',
    body: `Sarah,

OK understood. Given the expanded scope, I'll need to revise our timeline. Let me discuss with Wei and get back to you with an updated project plan by Wednesday.

The additional cost for the custom dashboards will be approximately $15,000. I'll include a formal change request with the updated plan.

> On 30 Mar 2026, at 15:00, Sarah Lim <sarah.lim@singlife.com> wrote:
>
> Tiger,
>
> Actually, after discussing with our management team, we'd like to expand the scope. Instead of just the 3 standard reports, we need:
>
> - 5 custom dashboards (interactive, real-time data)
> - Export to PDF and Excel
> - Scheduled email reports (daily/weekly/monthly)
> - Role-based access control for different report views
>
> I know this is more than what we originally agreed. Happy to discuss the commercial implications.
>
> > On 29 Mar 2026, at 10:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> >
> > Hi Sarah,
> >
> > As discussed, we'll include 3 standard reports in Phase 1:
> > - Persona distribution report
> > - Segment analysis report
> > - Trend comparison report
> >
> > These will be ready by the end of April as planned.
> >
> > Tiger`,
    date: '2026-03-30T15:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'updated project plan|revised timeline|get back.*plan',
        deadline: '2026-04-01',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'change request|formal change',
        deadline: '2026-04-01',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 98,
    category: 'reply_chain',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Mixed language reply chain with commitment shift',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'liwei@tencent.com',
    subject: 'Re: Re: 技术对接会时间确认',
    body: `李伟，

OK，那就改到4月8日下午3点。我会准备一个demo，cover住以下几个点：
1. Persona engine的核心算法
2. API integration的flow
3. 数据安全架构

另外你提到的那个Python SDK，我让Wei在demo之前准备好sample code。

> 2026年3月30日 14:00, 李伟 <liwei@tencent.com> 写道：
>
> Tiger，
>
> 4月3日我这边有conflict，能改到4月8日吗？下午3点如何？
>
> 另外技术对接的时候，能不能demo一下你们的API？我们CTO特别想看real-time的效果。
> 还有你们有没有Python SDK？我们这边都是Python stack。
>
> > 2026年3月29日 16:00, Tiger Li <tiger@actuaryhelp.com> 写道：
> >
> > 李伟你好，
> >
> > 技术对接会我建议安排在4月3日（周四）下午2点，腾讯会议。
> > 我们这边Tiger + Wei参加，你们安排技术负责人就行。
> >
> > Tiger`,
    date: '2026-03-30T14:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'demo|prepare.*demo|技术对接.*demo',
        deadline: '2026-04-08',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'Python SDK|sample code|Wei.*prepare',
        deadline: '2026-04-08',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 99,
    category: 'reply_chain',
    difficulty: 'hard',
    language: 'en',
    description: 'Reply chain resolving a disagreement with new commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'victor.lee@allenandgledhill.com',
    subject: 'Re: Re: Re: IP Clause — Final Position',
    body: `Victor,

Agree with your recommendation. Let's go with the license-back arrangement.

Please draft the revised clause and send it to Singlife's lawyers by Thursday. CC me on the email so I can track the response.

Also, while you're at it, can you add a carve-out for our pre-existing IP? I want to make sure the persona engine core algorithm is explicitly excluded from any IP assignment.

> On 30 Mar 2026, at 17:00, Victor Lee <victor.lee@allenandgledhill.com> wrote:
>
> Tiger,
>
> I've reviewed their counterproposal on the IP clause. They've softened their position — now asking for assignment of custom-developed work only, not the underlying platform.
>
> My recommendation: Accept the assignment for custom work but insist on a perpetual, royalty-free license-back for you to use the custom work with other clients (anonymized, of course).
>
> This is a common structure in enterprise software deals. I think they'll agree.
>
> > On 30 Mar 2026, at 14:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> >
> > Victor,
> >
> > Singlife's lawyers came back with a counter on the IP clause. They want full IP assignment for all custom work. This is a dealbreaker for us. Please advise on how to push back.
> >
> > Tiger`,
    date: '2026-03-30T17:15:00+08:00',
    expected_commitments: [
      {
        type: 'waiting_on_them',
        title_pattern: 'revised clause|draft.*clause|send.*lawyers',
        deadline: '2026-04-02',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'carve-out|pre-existing IP|persona engine.*excluded',
        confidence_min: 0.7,
      },
    ],
  },

  {
    id: 100,
    category: 'reply_chain',
    difficulty: 'hard',
    language: 'en',
    description: 'Complex reply chain with escalation and new commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'jenny.chua@manulife.com.sg',
    subject: 'Re: Re: Re: Production Incident — Resolution Update',
    body: `Jenny,

I sincerely apologize for the downtime. This shouldn't have happened and I take full responsibility.

Here's what we're doing:
1. Wei has deployed the emergency fix — the system is back online as of 4pm
2. I will personally conduct a root cause analysis and send you a detailed incident report by Wednesday
3. We will implement automated monitoring alerts to prevent this from happening again — ETA end of next week
4. As a goodwill gesture, I'll credit your next invoice by 10%

I'd also like to schedule a call with you and your CTO to walk through the incident and our prevention plan. Would Friday at 10am work?

> On 30 Mar 2026, at 15:30, Jenny Chua <jenny.chua@manulife.com.sg> wrote:
>
> Tiger,
>
> This is unacceptable. The system has been down for 3 hours now and our agents cannot access the persona reports. We have a regional management review at 5pm and we need the data.
>
> Please escalate this immediately and provide an ETA for resolution.
>
> This is the second time in a month. If this continues, we will need to reconsider the engagement.
>
> > On 30 Mar 2026, at 14:00, Jenny Chua <jenny.chua@manulife.com.sg> wrote:
> >
> > Hi Tiger,
> >
> > We're getting timeout errors when trying to access the persona dashboard. Is there a known issue?
> >
> > > On 30 Mar 2026, at 12:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> > >
> > > Hi Jenny,
> > >
> > > Just a heads up — we'll be doing a minor maintenance window today from 1-2pm.
> > > There might be brief interruptions. Should be back to normal by 2pm.
> > >
> > > Tiger`,
    date: '2026-03-30T16:15:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'root cause analysis|incident report',
        deadline: '2026-04-01',
        confidence_min: 0.9,
      },
      {
        type: 'i_promised',
        title_pattern: 'automated monitoring|monitoring alerts',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'credit.*invoice|10%.*credit',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'schedule.*call|walk.*incident|prevention plan',
        confidence_min: 0.7,
      },
    ],
  },

  // =========================================================================
  // NEGATIVE: SOCIAL (101-105, first 5 of 15)
  // =========================================================================

  {
    id: 101,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Simple thank you note — no commitments',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Thank you for the wonderful presentation',
    body: `Dear Tiger,

Just wanted to drop a quick note to say thank you for the excellent presentation yesterday. The team was really impressed with the depth of analysis and the quality of the persona engine demo.

Your insights on the Southeast Asian insurance market were particularly valuable. I've shared the recording with our regional team and they were equally impressed.

Thank you again for your time and effort. It's always a pleasure working with you and the ActuaryHelp team.

Warm regards,
Rachel`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'thank you|presentation',
        gate_failed: 'Q1',
        reason: 'Pure appreciation / social pleasantry with no actionable commitment',
      },
    ],
  },

  {
    id: 102,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Congratulations on funding — no commitments',
    from_address: 'kevin.lee@antler.co',
    from_name: 'Kevin Lee',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Congratulations on the Series A!',
    body: `Tiger!

Just saw the TechInAsia article about your Series A. Huge congratulations to you and the team! Well-deserved after all the hard work.

$4M is a great round for a Singapore-based InsurTech. Jungle Ventures is a solid partner — Ravi and team really know the space.

We're proud to have been early supporters from the Antler days. Exciting to see how far ActuaryHelp has come.

Let's celebrate over drinks soon. My treat!

Cheers,
Kevin`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'congratulations|celebrate|drinks',
        gate_failed: 'Q1',
        reason: 'Congratulatory message. "Drinks soon" is vague social intent, not a concrete commitment.',
      },
    ],
  },

  {
    id: 103,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Holiday greeting — no commitments',
    from_address: 'linda.chen@greateasternlife.com',
    from_name: 'Linda Chen',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Happy Hari Raya!',
    body: `Dear Tiger,

Wishing you and your family a blessed Hari Raya Aidilfitri!

May this festive season bring you joy, peace, and prosperity.

On behalf of the Great Eastern Life Digital Innovation team, we hope you have a wonderful celebration with your loved ones.

Selamat Hari Raya!

Warm regards,
Linda Chen & Team`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'Hari Raya|holiday|greeting',
        gate_failed: 'pre_filter',
        reason: 'Holiday greeting — no actionable content whatsoever.',
      },
    ],
  },

  {
    id: 104,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Conference networking follow-up — vague pleasantries',
    from_address: 'john.smith@mckinsey.com',
    from_name: 'John Smith',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Great meeting you at SFF',
    body: `Hi Tiger,

It was great meeting you at the Singapore FinTech Festival networking session. Your perspective on AI-powered personas for insurance was fascinating.

I'd love to continue the conversation sometime. The insurance practice at McKinsey is doing some interesting work in this space and I think there could be some synergies.

Feel free to connect with me on LinkedIn. Perhaps we can grab coffee if you're ever in the Raffles Place area.

Best,
John Smith
Engagement Manager
McKinsey & Company, Singapore`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'coffee|continue.*conversation|synergies',
        gate_failed: 'Q2',
        reason: 'Vague networking follow-up. "Let\'s grab coffee sometime" and "love to continue the conversation" are non-specific social intentions, not commitments with deadlines or concrete actions.',
      },
    ],
  },

  {
    id: 105,
    category: 'negative_social',
    difficulty: 'medium',
    language: 'en',
    description: 'LinkedIn-style recommendation request — no real commitment',
    from_address: 'priya.sharma@prudential.com.sg',
    from_name: 'Priya Sharma',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Quick favour — LinkedIn recommendation',
    body: `Hi Tiger,

Hope you're doing well! I'm updating my LinkedIn profile and was wondering if you'd be kind enough to write a short recommendation for me?

We worked together on the Prudential digital analytics project last year and I think your perspective as a vendor partner would be valuable.

No pressure at all — only if you have time. I know you're super busy with the fundraise and everything.

Thanks for considering it!

Best,
Priya`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'LinkedIn recommendation|write.*recommendation',
        gate_failed: 'Q3',
        reason: 'Polite request with explicit "no pressure" and "only if you have time" — this is a soft ask, not a commitment. The user has not agreed to do it.',
      },
    ],
    notes: 'Borderline case. Some systems might extract this as a potential commitment. The "no pressure" language and the fact that Tiger has not responded yet means there is no commitment.',
  },

  // =========================================================================
  // NEGATIVE: SOCIAL/PLEASANTRIES CONTINUED (106-115)
  // =========================================================================

  // --- 106-108: Celebrations/greetings (easy negatives) ---

  {
    id: 106,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Happy birthday wish — pure pleasantry, no commitment',
    from_address: 'james.wong@ocbc.com',
    from_name: 'James Wong',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Happy Birthday Tiger! 🎂',
    body: `Tiger!

Happy birthday!! Hope you have an amazing day. You deserve a break after all the crazy hustle this quarter.

Enjoy the celebrations!

Cheers,
James`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'birthday|celebration',
        gate_failed: 'Q1',
        reason: 'Pure birthday greeting with no action items or commitments.',
      },
    ],
  },

  {
    id: 107,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Congratulations on promotion — social pleasantry',
    from_address: 'sarah.lim@singlife.com',
    from_name: 'Sarah Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Congrats on the promotion!',
    body: `Hi Tiger,

Just saw the announcement on LinkedIn — congratulations on being named CTO! So well-deserved. You've been building incredible things with ActuaryHelp and this is just the beginning.

Wishing you all the best in the new role!

Warmly,
Sarah`,
    date: '2026-03-30T09:15:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'congrat|promotion',
        gate_failed: 'Q1',
        reason: 'Congratulatory message with no follow-up actions or commitments.',
      },
    ],
  },

  {
    id: 108,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Welcome aboard message — no commitment',
    from_address: 'hr@actuaryhelp.com',
    from_name: 'HR Team',
    to_address: 'new.hire@actuaryhelp.com',
    subject: 'Welcome to the team, Wei!',
    body: `Dear Wei,

Welcome aboard! We're thrilled to have you join the ActuaryHelp family. Your first day is going to be exciting — the team is already looking forward to meeting you.

Here's a quick overview of what to expect:
- Office is at One Raffles Place, Level 32
- Dress code is smart casual
- Lunch is typically at 12:30pm at the hawker centre downstairs

See you soon!

The HR Team`,
    date: '2026-03-30T08:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'welcome|onboarding',
        gate_failed: 'Q1',
        reason: 'Welcome message with orientation info. No commitments or deadlines.',
      },
    ],
  },

  // --- 109-111: Thank you / catch-up follow-ups ---

  {
    id: 109,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Thanks for intro — polite acknowledgment only',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Introduction — Rachel / David',
    body: `Tiger,

Thanks so much for connecting me with David! Really appreciate the intro. I'll reach out to him directly.

Have a great week.

Rachel`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'thank|intro|reach out',
        gate_failed: 'Q2',
        reason: 'Rachel says she will reach out to David — this is her action, not a commitment to Tiger. From Tiger\'s perspective, there is nothing to track.',
      },
    ],
  },

  {
    id: 110,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Great catching up — social follow-up with no action',
    from_address: 'mark.chen@grab.com',
    from_name: 'Mark Chen',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Great catching up!',
    body: `Tiger,

It was so good to see you at the NUS alumni mixer last night. Can't believe it's been 5 years since graduation!

Your company is doing amazing things. Keep it up, brother.

Mark`,
    date: '2026-03-30T09:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'catching up|alumni',
        gate_failed: 'Q1',
        reason: 'Nostalgic catch-up message with zero action items.',
      },
    ],
  },

  {
    id: 111,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Enjoyed the dinner — pure social pleasantry',
    from_address: 'priya.sharma@prudential.com.sg',
    from_name: 'Priya Sharma',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Last night was fun!',
    body: `Hi Tiger,

Thanks for organizing the dinner at Burnt Ends! The food was incredible and the company was even better. Everyone had such a great time.

Let's do it again soon!

Priya`,
    date: '2026-03-30T10:45:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'dinner|do it again',
        gate_failed: 'Q1',
        reason: '"Let\'s do it again soon" is vague social pleasantry, not a commitment.',
      },
    ],
  },

  // --- 112-115: FYI / article shares / general updates ---

  {
    id: 112,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'FYI forward of industry article — no commitment',
    from_address: 'james.wong@ocbc.com',
    from_name: 'James Wong',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'FYI — MAS digital insurance guidelines update',
    body: `Tiger,

FYI — thought this might be relevant for ActuaryHelp. MAS just published updated guidelines on digital insurance distribution.

https://www.mas.gov.sg/regulation/guidelines/digital-insurance-2026

No action needed from your end, just wanted to keep you in the loop.

James`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'FYI|article|guidelines',
        gate_failed: 'Q1',
        reason: 'Explicit "no action needed" — pure informational FYI forward.',
      },
    ],
  },

  {
    id: 113,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'Sharing podcast episode — no action required',
    from_address: 'sarah.lim@singlife.com',
    from_name: 'Sarah Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'This podcast reminded me of you',
    body: `Hi Tiger,

Listened to this episode of "Insuretech Decoded" on my commute today and immediately thought of you. The guest talks about AI-driven persona generation — basically what you're building!

Episode: "The Future of Synthetic Insurance Customers"
Link: https://podcast.example.com/ep142

Worth a listen when you have time.

Sarah`,
    date: '2026-03-30T08:45:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'podcast|listen',
        gate_failed: 'Q1',
        reason: 'Sharing a podcast link — informational, no commitment or action item.',
      },
    ],
  },

  {
    id: 114,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'en',
    description: 'General company update — no personal commitment',
    from_address: 'ceo@techsg.com',
    from_name: 'David Teo',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'TechSG Quarterly Update — Q1 2026',
    body: `Dear Partners,

Quick update from TechSG:

- We've grown to 150 employees across 3 offices
- Our Series B is progressing well
- We launched 2 new products in the insurtech vertical
- Our annual conference is tentatively scheduled for September

Thanks for your continued partnership. More details to follow.

Best,
David Teo
CEO, TechSG`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'update|quarterly',
        gate_failed: 'Q1',
        reason: 'Company newsletter-style update. "More details to follow" is vague and not a specific personal commitment.',
      },
    ],
  },

  {
    id: 115,
    category: 'negative_social',
    difficulty: 'easy',
    language: 'mixed',
    description: 'Sharing meme / casual chat — zero business content',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'HAHAHA this is so us',
    body: `Boss,

看到这个meme笑死了 — "Startup founder explaining to investors why they need 6 more months"

这不就是我们上周pitch的写照吗 😂😂😂

Wei`,
    date: '2026-03-30T18:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'meme|joke',
        gate_failed: 'Q1',
        reason: 'Casual meme sharing between colleagues. No business content or commitments.',
      },
    ],
  },

  // =========================================================================
  // NEGATIVE: AUTO-GENERATED / SYSTEM EMAILS (116-130)
  // =========================================================================

  // --- 116-118: Newsletters/marketing ---

  {
    id: 116,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Substack newsletter — should be caught by pre-filter',
    from_address: 'noreply@substack.com',
    from_name: 'The Insurtech Review',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Weekly Digest: AI in Insurance — March 30, 2026',
    body: `The Insurtech Review — Weekly Digest

Top Stories This Week:

1. AIA launches AI claims processing in Singapore
   The insurer reported 40% faster claims resolution using their new ML pipeline...

2. MAS proposes new framework for AI-driven underwriting
   Regulators are looking at guardrails for automated decision-making...

3. Ping An's digital twin technology reaches 100M profiles
   The Chinese giant continues to lead in synthetic customer modeling...

---
You're receiving this because you subscribed to The Insurtech Review.
Unsubscribe: https://substack.com/unsubscribe/abc123
© 2026 The Insurtech Review`,
    date: '2026-03-30T06:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'newsletter|digest',
        gate_failed: 'pre_filter',
        reason: 'Automated newsletter from noreply@ address with unsubscribe footer.',
      },
    ],
  },

  {
    id: 117,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Mailchimp marketing email — pre-filter',
    from_address: 'marketing@sginnovate.org',
    from_name: 'SGInnovate',
    to_address: 'tiger@actuaryhelp.com',
    subject: '🚀 Deep Tech Summit 2026 — Early Bird Tickets Now Available!',
    body: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif;">

<h1>Deep Tech Summit 2026</h1>
<p>Singapore's premier deep tech conference is back!</p>

<h2>What to expect:</h2>
<ul>
<li>50+ world-class speakers</li>
<li>Hands-on AI workshops</li>
<li>Startup pitch competition with $100K prize</li>
<li>Networking with 2000+ attendees</li>
</ul>

<p><strong>Date:</strong> June 15-16, 2026</p>
<p><strong>Venue:</strong> Marina Bay Sands Expo</p>

<a href="https://sginnovate.org/summit2026" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Get Early Bird Tickets →</a>

<hr>
<p style="font-size: 12px; color: #666;">
You received this email because you're a member of SGInnovate's community.
<a href="https://sginnovate.org/unsubscribe">Unsubscribe</a> | <a href="https://sginnovate.org/preferences">Manage preferences</a>
</p>

</body>
</html>`,
    date: '2026-03-30T07:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'summit|ticket|conference',
        gate_failed: 'pre_filter',
        reason: 'Marketing email with HTML template, unsubscribe link, and promotional content.',
      },
    ],
  },

  {
    id: 118,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Product launch announcement email — pre-filter',
    from_address: 'updates@notion.so',
    from_name: 'Notion',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Introducing Notion AI 3.0 — Your workspace just got smarter',
    body: `Hi Tiger,

We're excited to announce Notion AI 3.0! Here's what's new:

✨ Smart project timelines that auto-adjust
📊 AI-powered data analysis in tables
🤖 Custom AI assistants for your workspace

Upgrade to Pro to unlock all features.

Try it now → https://notion.so/ai-3

---
Notion, 2300 Harrison St, San Francisco, CA 94110
Unsubscribe from product updates`,
    date: '2026-03-30T03:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'product.*launch|upgrade|notion',
        gate_failed: 'pre_filter',
        reason: 'Automated product announcement from SaaS company with unsubscribe footer.',
      },
    ],
  },

  // --- 119-121: Out of office auto-replies ---

  {
    id: 119,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Out of office auto-reply — English',
    from_address: 'david.teo@techsg.com',
    from_name: 'David Teo',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Out of Office: Re: Partnership Discussion',
    body: `Hi,

Thank you for your email. I am currently out of the office from March 28 to April 4 with limited access to email.

For urgent matters, please contact my assistant Sarah at sarah@techsg.com.

I will respond to your email upon my return.

Best regards,
David Teo

---
This is an automated response.`,
    date: '2026-03-30T10:01:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'out of office|OOO|auto-reply',
        gate_failed: 'pre_filter',
        reason: 'Automated out-of-office reply. "I will respond upon my return" is boilerplate, not a real commitment.',
      },
    ],
  },

  {
    id: 120,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'zh',
    description: 'Out of office auto-reply — Chinese',
    from_address: 'li.ming@chinainsure.cn',
    from_name: '李明',
    to_address: 'tiger@actuaryhelp.com',
    subject: '自动回复：关于合作方案',
    body: `您好，

感谢您的来信。我目前正在休假中（3月28日至4月5日），期间无法及时回复邮件。

如有紧急事务，请联系我的同事张伟：zhangwei@chinainsure.cn

我将在返回后尽快回复您的邮件。

此致
李明

---
此邮件为自动回复。`,
    date: '2026-03-30T10:02:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: '自动回复|out of office',
        gate_failed: 'pre_filter',
        reason: 'Chinese OOO auto-reply. "返回后尽快回复" is standard boilerplate.',
      },
    ],
  },

  {
    id: 121,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'OOO with medical leave context — still auto-generated',
    from_address: 'priya.sharma@prudential.com.sg',
    from_name: 'Priya Sharma',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Automatic Reply: Re: Contract Review',
    body: `Hello,

I am on medical leave until further notice. For all project-related inquiries, please reach out to my manager Kenneth Ng (kenneth.ng@prudential.com.sg).

For contract matters, please contact Legal at legal@prudential.com.sg.

Thank you for your understanding.

Priya Sharma
VP, Digital Analytics
Prudential Singapore`,
    date: '2026-03-30T10:05:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'auto.*reply|medical leave',
        gate_failed: 'pre_filter',
        reason: 'Automated medical leave reply with redirect instructions.',
      },
    ],
  },

  // --- 122-124: Calendar invitations ---

  {
    id: 122,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Google Calendar invitation — system generated',
    from_address: 'calendar-notification@google.com',
    from_name: 'Google Calendar',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Invitation: Q2 Planning Sync @ Mon Apr 6, 2026 2:00pm - 3:00pm (SGT)',
    body: `You have been invited to the following event:

Q2 Planning Sync

When: Monday, April 6, 2026, 2:00 PM – 3:00 PM (SGT)
Where: Zoom — https://zoom.us/j/123456789
Calendar: tiger@actuaryhelp.com
Who: rachel.tan@dbs.com (organizer), tiger@actuaryhelp.com, wei.zhang@actuaryhelp.com

Going? Yes - Maybe - No    More options

Invitation from Google Calendar: https://calendar.google.com/event?eid=abc123`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'calendar|invitation|meeting',
        gate_failed: 'pre_filter',
        reason: 'Automated Google Calendar invitation. Not a personal email.',
      },
    ],
  },

  {
    id: 123,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Calendar acceptance notification',
    from_address: 'calendar-notification@google.com',
    from_name: 'Google Calendar',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Accepted: Q2 Planning Sync @ Mon Apr 6',
    body: `rachel.tan@dbs.com has accepted this invitation:

Q2 Planning Sync
Monday, April 6, 2026, 2:00 PM – 3:00 PM (SGT)

Invitation from Google Calendar`,
    date: '2026-03-30T14:05:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'accepted|calendar',
        gate_failed: 'pre_filter',
        reason: 'Automated calendar acceptance notification.',
      },
    ],
  },

  {
    id: 124,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Outlook calendar update notification',
    from_address: 'noreply@outlook.com',
    from_name: 'Microsoft Outlook',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Updated: Board Meeting moved to April 10',
    body: `The following event has been updated:

Board Meeting — Q1 Review

Original: April 8, 2026, 10:00 AM
Updated: April 10, 2026, 10:00 AM

Location: ActuaryHelp HQ, Level 32 Boardroom

Updated by: sophie@actuaryhelp.com

Accept | Tentative | Decline`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'calendar.*update|board meeting',
        gate_failed: 'pre_filter',
        reason: 'Automated Outlook calendar update notification.',
      },
    ],
  },

  // --- 125-127: Order confirmations ---

  {
    id: 125,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Shopee order confirmation — e-commerce auto-email',
    from_address: 'noreply@shopee.sg',
    from_name: 'Shopee Singapore',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Order Confirmed! #SG2026033012345',
    body: `Hi Tiger,

Your order has been confirmed!

Order #SG2026033012345
Item: Logitech MX Master 3S Wireless Mouse
Qty: 1
Total: S$129.00

Estimated delivery: April 2-4, 2026
Shipping: Standard (Free)

Track your order: https://shopee.sg/track/SG2026033012345

Thank you for shopping with Shopee!`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'order|shopee|delivery',
        gate_failed: 'pre_filter',
        reason: 'Automated e-commerce order confirmation from noreply@ address.',
      },
    ],
  },

  {
    id: 126,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Lazada shipping notification',
    from_address: 'noreply@lazada.sg',
    from_name: 'Lazada Singapore',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Your order has been shipped! 📦',
    body: `Great news, Tiger!

Your order #LZ-SG-789456 has been shipped.

Items:
- Standing Desk Converter (Black) x1
- USB-C Hub 7-in-1 x1

Courier: Ninja Van
Tracking: NVSG123456789

Expected delivery: April 1, 2026

Track here: https://lazada.sg/track/LZ-SG-789456`,
    date: '2026-03-30T13:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'shipping|lazada|order',
        gate_failed: 'pre_filter',
        reason: 'Automated shipping notification from e-commerce platform.',
      },
    ],
  },

  {
    id: 127,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Amazon order confirmation',
    from_address: 'auto-confirm@amazon.sg',
    from_name: 'Amazon.sg',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Your Amazon.sg order #408-1234567-8901234',
    body: `Hello Tiger,

Thank you for your order!

Order #408-1234567-8901234
Arriving: April 3, 2026

MacBook Pro 16" M4 Max Laptop Sleeve — S$49.90
Apple Magic Keyboard with Touch ID — S$269.00

Subtotal: S$318.90
Shipping: FREE (Prime)
Order Total: S$318.90

View or manage your order: https://amazon.sg/orders

Thank you for shopping with us.
Amazon.sg`,
    date: '2026-03-30T14:15:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'amazon|order',
        gate_failed: 'pre_filter',
        reason: 'Automated Amazon order confirmation.',
      },
    ],
  },

  // --- 128-130: Security alerts ---

  {
    id: 128,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Google security alert — new sign-in',
    from_address: 'no-reply@accounts.google.com',
    from_name: 'Google',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Security alert: New sign-in on MacBook Pro',
    body: `A new sign-in on MacBook Pro

Hi tiger@actuaryhelp.com,

Your Google Account was just signed in to from a new MacBook Pro device.

tiger@actuaryhelp.com

New sign-in
Device: MacBook Pro
Location: Singapore
Time: March 30, 2026, 10:45 AM SGT

If this was you, you don't need to do anything. If not, we'll help you secure your account.

Check activity: https://myaccount.google.com/notifications

You received this email to let you know about important changes to your Google Account and services.
© 2026 Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA`,
    date: '2026-03-30T10:45:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'security.*alert|sign.?in',
        gate_failed: 'pre_filter',
        reason: 'Automated Google security alert from no-reply@ address.',
      },
    ],
  },

  {
    id: 129,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: '2FA verification code — system email',
    from_address: 'noreply@github.com',
    from_name: 'GitHub',
    to_address: 'tiger@actuaryhelp.com',
    subject: '[GitHub] Your two-factor authentication code',
    body: `Your two-factor authentication code is: 847291

This code will expire in 10 minutes.

If you didn't request this code, please ignore this email. Someone may have typed your email address by mistake.

Thanks,
The GitHub Team

GitHub, Inc. · 88 Colin P. Kelly Jr. Street · San Francisco, CA 94107`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: '2FA|verification|authentication',
        gate_failed: 'pre_filter',
        reason: 'Automated 2FA code email from system address.',
      },
    ],
  },

  {
    id: 130,
    category: 'negative_auto_generated',
    difficulty: 'easy',
    language: 'en',
    description: 'Password reset request — system email',
    from_address: 'noreply@supabase.com',
    from_name: 'Supabase',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Reset your Supabase password',
    body: `Hi there,

We received a request to reset the password for your Supabase account (tiger@actuaryhelp.com).

Click the link below to reset your password:
https://app.supabase.com/reset-password?token=abc123xyz

This link will expire in 24 hours.

If you didn't request a password reset, you can safely ignore this email.

— The Supabase Team`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'password.*reset',
        gate_failed: 'pre_filter',
        reason: 'Automated password reset email from noreply@ address.',
      },
    ],
  },

  // =========================================================================
  // NEGATIVE: NEAR-MISS (131-140)
  // =========================================================================

  // --- 131-133: Conditional promises ---

  {
    id: 131,
    category: 'negative_near_miss',
    difficulty: 'hard',
    language: 'en',
    description: 'Conditional promise — dependent on funding',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Expanded POC Scope',
    body: `Rachel,

Thanks for the ambitious proposal. If the Series A funding comes through in April, I'll be able to allocate a dedicated team of 3 engineers to your POC. We'd also upgrade you to the Enterprise tier at no additional cost for the first 6 months.

However, if the round doesn't close, we'll need to stick with the current resourcing plan and timeline.

I should know by mid-April. Will keep you posted.

Tiger`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'allocate.*team|enterprise.*tier|dedicated.*engineer',
        gate_failed: 'Q3',
        reason: 'All promises are conditional on "if the Series A funding comes through" — no unconditional commitment exists.',
      },
    ],
    notes: '"Will keep you posted" is borderline but too vague to be actionable.',
  },

  {
    id: 132,
    category: 'negative_near_miss',
    difficulty: 'hard',
    language: 'en',
    description: 'Conditional promise — dependent on board approval',
    from_address: 'sarah.lim@singlife.com',
    from_name: 'Sarah Lim',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Strategic Partnership Proposal',
    body: `Tiger,

I love the partnership idea. Depending on board approval next quarter, we could potentially co-develop the analytics module and share the IP. I would push for a $500K investment from our innovation fund.

But honestly, the board has been conservative lately so I can't make any promises at this stage. Let me feel out the temperature at next week's pre-board dinner and get back to you.

Sarah`,
    date: '2026-03-30T15:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'partnership|co-develop|investment',
        gate_failed: 'Q3',
        reason: '"Depending on board approval" and "can\'t make any promises" explicitly mark this as conditional. Even "feel out the temperature" is vague intent, not commitment.',
      },
    ],
  },

  {
    id: 133,
    category: 'negative_near_miss',
    difficulty: 'hard',
    language: 'zh',
    description: 'Conditional promise — dependent on regulatory approval (Chinese)',
    from_address: 'wang.lei@zhongbao.cn',
    from_name: '王磊',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: 中国市场进入方案',
    body: `Tiger，

方案看了，非常好。如果银保监会那边的牌照能批下来，我们可以在Q3启动试点项目，先从上海自贸区开始。

不过目前监管环境不太确定，一切取决于4月份的政策发布。我会关注进展，有消息第一时间告诉你。

王磊`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: '试点|pilot|牌照',
        gate_failed: 'Q3',
        reason: '"如果银保监会那边的牌照能批下来" — all action is conditional on regulatory approval. "有消息第一时间告诉你" is too vague to track.',
      },
    ],
  },

  // --- 134-136: Past tense (already done) ---

  {
    id: 134,
    category: 'negative_near_miss',
    difficulty: 'medium',
    language: 'en',
    description: 'Past tense — report already submitted',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Q1 Engineering Report',
    body: `Boss,

Done — I already submitted the Q1 engineering report to Rachel's team this morning. Also CC'd James from OCBC as you requested.

The report covers:
- Sprint velocity (up 23% vs Q4)
- Bug resolution metrics
- Infrastructure cost breakdown
- Roadmap for Q2

Let me know if you need anything else.

Wei`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'submit.*report|Q1.*report',
        gate_failed: 'Q2',
        reason: 'All actions are in past tense — "already submitted", "CC\'d". Nothing forward-looking to track.',
      },
    ],
  },

  {
    id: 135,
    category: 'negative_near_miss',
    difficulty: 'medium',
    language: 'zh',
    description: 'Past tense — document already sent (Chinese)',
    from_address: 'mei.ling@actuaryhelp.com',
    from_name: 'Mei Ling',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: 合同文件',
    body: `老板，

已经发了。合同文件上午10点通过DocuSign发给了Priya，同时把PDF备份存到了Google Drive的"合同"文件夹里。

Priya说她那边法务审批大概需要一周时间。

美玲`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: '合同|发了|contract',
        gate_failed: 'Q2',
        reason: '"已经发了" — past tense, action already completed. Priya\'s legal review timeline is informational, not a commitment from Mei Ling.',
      },
    ],
  },

  {
    id: 136,
    category: 'negative_near_miss',
    difficulty: 'medium',
    language: 'en',
    description: 'Past tense — review completed last week',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Security Audit Status',
    body: `Tiger,

Just to close the loop — we completed the security review last week. The DBS cybersecurity team gave ActuaryHelp a clean bill of health. No critical vulnerabilities found.

The formal audit certificate was issued on March 25 and uploaded to our vendor management portal. You should already have access.

Thanks for your team's cooperation during the process.

Rachel`,
    date: '2026-03-30T09:45:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'security.*review|audit|completed',
        gate_failed: 'Q2',
        reason: 'Past tense summary — "completed last week", "was issued on March 25". Closing the loop on something already done.',
      },
    ],
  },

  // --- 137-138: Offers, not commitments ---

  {
    id: 137,
    category: 'negative_near_miss',
    difficulty: 'medium',
    language: 'en',
    description: 'Offer to help — not a commitment until accepted',
    from_address: 'mark.chen@grab.com',
    from_name: 'Mark Chen',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Data Science Hiring',
    body: `Tiger,

I heard you're looking to hire senior data scientists. I can help with referrals if you need — I know a few really strong candidates from my NUS network who might be a good fit.

Feel free to reach out if you want introductions. Happy to help.

Mark`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'referral|help.*hiring|introduction',
        gate_failed: 'Q3',
        reason: '"I can help if you need" and "feel free to reach out" are open offers, not commitments. No action is triggered until Tiger explicitly accepts.',
      },
    ],
  },

  {
    id: 138,
    category: 'negative_near_miss',
    difficulty: 'medium',
    language: 'en',
    description: 'Standing offer of support — no specific commitment',
    from_address: 'james.wong@ocbc.com',
    from_name: 'James Wong',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Re: Product Roadmap Discussion',
    body: `Tiger,

Interesting roadmap. Let me know if there's anything from our side that could help accelerate development. We have a data sandbox that your engineers could use for testing — just say the word.

Also, if you ever need a reference customer for investor meetings, I'm happy to be that person.

James`,
    date: '2026-03-30T14:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'sandbox|reference.*customer|help.*accelerate',
        gate_failed: 'Q3',
        reason: 'Multiple standing offers ("just say the word", "if you ever need") — these are conditional on Tiger\'s initiative, not active commitments.',
      },
    ],
  },

  // --- 139-140: Describing others' commitments ---

  {
    id: 139,
    category: 'negative_near_miss',
    difficulty: 'hard',
    language: 'en',
    description: 'Relaying vendor commitment — not personal promise',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'AWS Infrastructure Update',
    body: `Boss,

Quick update — the AWS Solutions Architect said they would deliver the cost optimization report by next Friday. They're also going to migrate our RDS instances to Graviton during the maintenance window next weekend.

The vendor said they would handle everything and we shouldn't experience any downtime.

Just keeping you in the loop.

Wei`,
    date: '2026-03-30T16:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'cost.*report|migrate.*RDS|AWS',
        gate_failed: 'Q3',
        reason: 'Wei is reporting what the AWS vendor promised, not making personal commitments. "The vendor said they would" describes a third party\'s obligation.',
      },
    ],
    notes: 'Tricky because "keeping you in the loop" implies Wei is responsible for oversight, but no explicit personal commitment is made.',
  },

  {
    id: 140,
    category: 'negative_near_miss',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Forwarding client expectations — not own commitment',
    from_address: 'mei.ling@actuaryhelp.com',
    from_name: 'Mei Ling',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'FYI — Prudential expectations for Q2',
    body: `老板，

Just got off a call with Priya. She mentioned that Prudential expects us to:
- Deliver Phase 2 by end of May
- Complete the data migration by mid-April
- Provide weekly progress reports starting next week

These are their expectations, 不是我答应的啊。Wanted to flag so you're aware before the steering committee meeting.

美玲`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'Phase 2|data migration|progress report',
        gate_failed: 'Q3',
        reason: 'Mei Ling explicitly disclaims ownership — "这是他们的期望，不是我答应的" (these are their expectations, not what I promised). She is relaying client expectations, not making commitments.',
      },
    ],
  },

  // =========================================================================
  // EDGE: DEADLINE INFERENCE (141-150)
  // =========================================================================

  // --- 141-143: Relative deadline references ---

  {
    id: 141,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'en',
    description: 'Deadline implied by "before the board meeting next Tuesday"',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: DBS POC Metrics',
    body: `Rachel,

I'll prepare the ROI analysis and send it to you before the board meeting next Tuesday. Want to make sure you have all the ammunition you need to get the budget approved.

The analysis will cover:
- Cost savings from automation (estimated 40%)
- Time-to-insight improvement (from 3 weeks to 2 days)
- Projected 3-year TCO comparison

Tiger`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'ROI analysis|send.*analysis',
        deadline: '2026-04-07',
        confidence_min: 0.8,
      },
    ],
    notes: 'The email is dated Monday March 30. "Next Tuesday" = April 7. Deadline must be inferred from contextual date reference.',
  },

  {
    id: 142,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'en',
    description: 'Deadline implied by "by Chinese New Year"',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wang.lei@zhongbao.cn',
    subject: 'Re: China Market Entry Preparation',
    body: `Wang Lei,

Good plan. I'll have the localized product documentation ready by Chinese New Year so your team has plenty of time to review before the holiday.

I know everyone will be on leave during CNY so getting this done beforehand is critical.

Tiger`,
    date: '2026-01-10T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'localized.*documentation|product.*documentation',
        deadline: '2026-02-17',
        confidence_min: 0.7,
      },
    ],
    notes: 'CNY 2026 is February 17. System must know or infer cultural calendar dates.',
  },

  {
    id: 143,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'en',
    description: 'Deadline implied by "before school starts"',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@family.com',
    subject: 'Re: Kids school supplies',
    body: `Darling,

Don't worry, I'll get all the school supplies sorted before school starts. Will go to Popular bookstore at VivoCity this weekend to pick everything up from the list.

Also need to get the name labels printed — I'll handle that too.

Love,
Tiger`,
    date: '2026-01-02T20:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'school supplies|Popular bookstore',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'name labels',
        confidence_min: 0.7,
      },
    ],
    notes: 'Singapore school typically starts early January. "This weekend" relative to Jan 2 means Jan 4-5. "Before school starts" is a fuzzy deadline that requires local knowledge.',
  },

  // --- 144-146: Business relative deadlines ---

  {
    id: 144,
    category: 'edge_deadline_inference',
    difficulty: 'medium',
    language: 'en',
    description: 'Deadline "end of quarter" — requires knowing current quarter',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: API Documentation',
    body: `Sarah,

The comprehensive API documentation is a priority for us. I'll make sure it's completed and published by end of quarter. Your engineering team will get early access before the public launch.

Tiger`,
    date: '2026-03-15T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'API documentation|publish.*documentation',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
    notes: 'Email date is March 15 — "end of quarter" means March 31, 2026. System must infer the current fiscal quarter.',
  },

  {
    id: 145,
    category: 'edge_deadline_inference',
    difficulty: 'medium',
    language: 'en',
    description: 'Deadline "first thing Monday morning"',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Urgent — Compliance Review Comments',
    body: `Priya,

Understood — I'll have our responses to all the compliance review comments ready first thing Monday morning. Wei is working on the technical responses over the weekend.

We take this seriously and want to make sure every point is addressed thoroughly.

Tiger`,
    date: '2026-03-28T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'compliance.*response|review.*comments',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
    ],
    notes: 'March 28 is a Saturday. "First thing Monday morning" = March 30.',
  },

  {
    id: 146,
    category: 'edge_deadline_inference',
    difficulty: 'medium',
    language: 'en',
    description: 'Deadline "by COB Friday"',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Vendor Assessment Questionnaire',
    body: `James,

We'll complete the full vendor assessment questionnaire and return it to your procurement team by COB Friday. It's about 80% done — just need to finalize the disaster recovery and business continuity sections.

Tiger`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'vendor.*assessment|questionnaire',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
    ],
    notes: 'March 30 is a Monday. "COB Friday" = April 3, close of business.',
  },

  // --- 147-150: Urgency-based deadlines ---

  {
    id: 147,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'en',
    description: 'ASAP deadline — urgency without specific date',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: URGENT — Production Data Issue',
    body: `Rachel,

We've identified the root cause. I'll deploy the hotfix ASAP — targeting within the next 2 hours. Wei is running final tests right now.

I'll send you a confirmation email the moment the fix is live in production.

Tiger`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'deploy.*hotfix|fix',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'send.*confirmation|confirm.*live',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
    ],
    notes: '"ASAP" + "within the next 2 hours" gives a same-day deadline. Two separate commitments: deploy the fix AND send confirmation.',
  },

  {
    id: 148,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'en',
    description: '"Urgent — need this today" — explicit same-day deadline',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Re: Client Presentation Materials',
    body: `Wei,

Urgent — I need the updated client presentation deck today. The meeting with DBS is tomorrow at 9am and I still need time to rehearse.

I'll incorporate your technical slides and finalize the flow tonight. Please get the data visualizations to me by 5pm.

Tiger`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'finalize.*presentation|incorporate.*slides',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'data visualizations|technical slides',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
    ],
    notes: 'Tiger commits to finalize tonight (i_promised) and asks Wei for data viz by 5pm (waiting_on_them).',
  },

  {
    id: 149,
    category: 'edge_deadline_inference',
    difficulty: 'medium',
    language: 'zh',
    description: '"这周内搞定" — within this week deadline in Chinese',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'mei.ling@actuaryhelp.com',
    subject: 'Re: 办公室装修报价',
    body: `美玲，

装修报价的事我这周内搞定。已经约了两家装修公司来现场看，分别是周三下午和周四上午。

看完之后我会整理一份对比表给你审核。

Tiger`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '装修报价|renovation.*quote|对比表|comparison',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
    ],
    notes: 'March 30 is Monday. "这周内" means by end of this week (Friday April 3). Two sub-actions: meet contractors + prepare comparison table.',
  },

  {
    id: 150,
    category: 'edge_deadline_inference',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Multiple implicit deadlines in one email',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Q2 Deliverables Timeline',
    body: `Sarah,

Here's what I can commit to:

1. The data migration — I'll complete this before your UAT starts (you mentioned April 15 right?)
2. User training materials — will have these ready 一周前 (one week before go-live on May 1)
3. Performance benchmarks — I'll run these over the long weekend and share results the Monday after

Let me know if these timelines work.

Tiger`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'data migration',
        deadline: '2026-04-15',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'training materials',
        deadline: '2026-04-24',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'performance benchmarks',
        confidence_min: 0.7,
      },
    ],
    notes: 'Three commitments with different deadline inference methods: (1) explicit April 15 reference, (2) one week before May 1 = April 24, (3) "the Monday after long weekend" requires knowing which long weekend.',
  },

  // =========================================================================
  // EDGE: IMPLICIT COMMITMENTS (151-160)
  // =========================================================================

  // --- 151-153: English implicit commitments ---

  {
    id: 151,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Let me take care of that" — implicit ownership',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Invoice Discrepancy',
    body: `Rachel,

Let me take care of that. The invoice discrepancy is likely because our finance team used the old pricing before the amendment was signed. I'll get this sorted with our accounts department and send you a corrected invoice.

Apologies for the confusion.

Tiger`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'corrected invoice|invoice.*sorted|fix.*invoice',
        confidence_min: 0.85,
      },
    ],
    notes: '"Let me take care of that" is a strong implicit commitment. Combined with "I\'ll get this sorted and send you a corrected invoice" it becomes explicit.',
  },

  {
    id: 152,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Consider it done" — strong implicit promise',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: NDA Amendment',
    body: `James,

Consider it done. I'll have our legal counsel review the NDA amendment and get it signed by our end this week.

Tiger`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'NDA.*amendment|sign.*NDA|legal.*review',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
    ],
    notes: '"Consider it done" is one of the strongest implicit commitments. "This week" provides the deadline.',
  },

  {
    id: 153,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Leave it with me" — ownership assumption',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: PDPA Compliance Checklist',
    body: `Priya,

Leave it with me. I know the PDPA requirements inside out — we went through the same exercise with DBS last quarter. I'll prepare the full compliance checklist with supporting documentation and walk your DPO through it.

Tiger`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'PDPA.*compliance|checklist|walk.*DPO',
        confidence_min: 0.8,
      },
    ],
    notes: '"Leave it with me" implies full ownership. No explicit deadline but clear commitment to deliver.',
  },

  // --- 154-156: Chinese implicit commitments ---

  {
    id: 154,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'zh',
    description: '"我来搞定" — Chinese implicit ownership',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'mei.ling@actuaryhelp.com',
    subject: 'Re: 服务器迁移',
    body: `美玲，

服务器迁移的事我来搞定。周末加个班把AWS Singapore region的实例全部迁到新的VPC上。

你那边只要确保DNS记录准备好切换就行。

Tiger`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '服务器迁移|server.*migration|AWS.*VPC',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'DNS.*记录|DNS.*record',
        confidence_min: 0.7,
      },
    ],
    notes: '"我来搞定" is the Chinese equivalent of "I\'ll handle it" — strong implicit commitment. Also delegates DNS prep to Mei Ling.',
  },

  {
    id: 155,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'zh',
    description: '"交给我吧" — delegation acceptance',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Re: 投资人Demo准备',
    body: `Wei，

投资人demo的事交给我吧。我来准备商业部分的slides，你专注把技术demo的bug修好就行。

周四之前我们internal rehearsal一次。

Tiger`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '商业.*slides|business.*slides|demo.*准备',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'bug.*修|fix.*bug|技术demo',
        deadline: '2026-04-02',
        confidence_min: 0.75,
      },
    ],
    notes: '"交给我吧" = "leave it to me". Thursday deadline implied by "周四之前 internal rehearsal".',
  },

  {
    id: 156,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'zh',
    description: '"放心，没问题的" — reassurance as commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@family.com',
    subject: 'Re: 妈妈的生日',
    body: `老婆，

放心，没问题的。妈妈生日的事我全部安排好了：
- 蛋糕已经在美珍香订了，4月5号下午取
- 餐厅订了珍宝海鲜楼（克拉码头那家），晚上7点，10个人
- 弟弟那边我已经通知了

你负责把妈接过来就行，其他的都不用操心。

Tiger`,
    date: '2026-03-30T20:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '蛋糕.*取|pick up.*cake',
        deadline: '2026-04-05',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: '餐厅|restaurant|珍宝海鲜',
        confidence_min: 0.7,
      },
    ],
    notes: '"放心，没问题的" = "don\'t worry, no problem" — implies everything is handled. Cake pickup on April 5 is a concrete future action.',
  },

  // --- 157-160: English informal implicit commitments ---

  {
    id: 157,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"On it" — minimal but clear commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: URGENT — API Rate Limiting Issue',
    body: `On it. Investigating now. Will update you within the hour.

Tiger`,
    date: '2026-03-30T15:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'investigate.*API|update.*rate limit|API.*issue',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
    ],
    notes: '"On it" is a terse but clear commitment. "Within the hour" gives a same-day deadline.',
  },

  {
    id: 158,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Roger that, will ping you when ready" — military-style acknowledgment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Sandbox Environment Refresh',
    body: `Roger that. Will ping you when the sandbox is refreshed with the latest production data snapshot.

Expect it by tomorrow evening — we need to run the anonymization pipeline first.

Tiger`,
    date: '2026-03-30T16:45:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'sandbox.*refresh|ping.*ready|production.*snapshot',
        deadline: '2026-03-31',
        confidence_min: 0.85,
      },
    ],
    notes: '"Roger that" + "will ping you" is a clear commitment with "tomorrow evening" deadline.',
  },

  {
    id: 159,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Noted, I\'ll loop back" — acknowledgment with follow-up promise',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Custom Reporting Feature Request',
    body: `Noted. Good feature request — I'll discuss with Wei and loop back with a feasibility assessment and rough timeline.

Probably early next week.

Tiger`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'feasibility.*assessment|loop back|timeline',
        deadline: '2026-04-06',
        confidence_min: 0.7,
      },
    ],
    notes: '"Noted" + "I\'ll loop back" is an implicit commitment. "Probably early next week" gives an approximate deadline (week of April 6).',
  },

  {
    id: 160,
    category: 'edge_implicit_commitment',
    difficulty: 'hard',
    language: 'en',
    description: '"Got it, will handle" — casual commitment in short reply',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Re: AWS Bill Optimization',
    body: `Got it, will handle. I'll negotiate with our AWS account manager for reserved instance pricing. Should save us 30-40% on the monthly bill.

T`,
    date: '2026-03-30T17:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'negotiate.*AWS|reserved instance|AWS.*pricing',
        confidence_min: 0.8,
      },
    ],
    notes: '"Got it, will handle" is informal but clear commitment.',
  },

  // =========================================================================
  // EDGE: CHINESE-ENGLISH MIXED IN ONE EMAIL (161-170)
  // =========================================================================

  // --- 161-163: English email with Chinese action items embedded ---

  {
    id: 161,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'English email body with Chinese action items list',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Post-meeting action items — DBS POC kickoff',
    body: `Wei,

Good meeting with DBS today. Here are the action items I committed to:

Action items（我负责的）：
1. 准备技术架构文档 — by April 5
2. Set up the staging environment with DBS test data
3. 安排安全审计（找第三方公司）— before April 15
4. Draft the SLA document and share with Rachel

你负责的：
5. API integration spec — by this Friday
6. 性能测试报告 — run load tests and document results

Let me know if I missed anything from the meeting.

Tiger`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '技术架构文档|technical.*architecture|staging environment|安全审计|security audit|SLA document',
        deadline: '2026-04-15',
        confidence_min: 0.7,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'API integration spec|性能测试|load test|performance',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
    ],
    notes: 'Principle 6: Mixed language action items list. "我负责的" (my responsibility) = 4 items, "你负责的" (your responsibility) = 2 items. LLM correctly groups each side. Accept if LLM extracts 1-2 from each group.',
  },

  {
    id: 162,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'English analysis email with Chinese commitment at the end',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Competitor Analysis — Market Positioning',
    body: `Sarah,

I've been analyzing the competitor landscape for the digital insurance analytics space in APAC. Here's what I found:

1. PolicyBazaar (India) — strong in B2C but weak enterprise offering
2. CoverGo (HK) — good API-first approach but no AI/ML layer
3. Coherent (SG) — focused on actuarial modeling, not customer analytics
4. ZhongAn (China) — the most advanced but China-only

None of them have what we're building with the digital twin approach.

下一步：我会准备一份详细的竞品分析报告，包括功能对比矩阵和定价分析，下周三之前发给你。

Tiger`,
    date: '2026-03-30T14:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '竞品分析报告|competitor.*report|功能对比|feature.*comparison',
        deadline: '2026-04-08',
        confidence_min: 0.8,
      },
    ],
    notes: 'The commitment is entirely in Chinese at the end of an English email. "下周三之前" = before next Wednesday = April 8.',
  },

  {
    id: 163,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'English meeting notes with Chinese side-comments and commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Meeting Notes — Prudential Phase 2 Planning',
    body: `Hi Priya,

Here are the meeting notes from our Phase 2 planning session:

Attendees: Tiger (ActuaryHelp), Priya + Kenneth (Prudential), Wei (ActuaryHelp)

Key Decisions:
- Phase 2 scope: 200K personas with real-time refresh
- Go-live target: June 1, 2026
- Budget: approved at $280K

Discussion Notes:
- Kenneth raised concerns about data residency（他很在意数据主权的问题）
- Priya confirmed Prudential legal has reviewed our PDPA compliance docs
- Wei提到了新的GPU集群可能需要额外2周setup time

我的action items：
- 数据主权方案下周一前给Kenneth一个正式的书面回复
- I'll prepare a revised project timeline incorporating the 2-week GPU setup delay

Priya's action items:
- Provide test dataset by April 10
- Confirm UAT team members

Please review and let me know if I missed anything.

Tiger`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '数据主权|data residency|书面回复|written response',
        deadline: '2026-04-06',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'project timeline|revised.*timeline',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'test dataset',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'UAT team|confirm.*team',
        confidence_min: 0.7,
      },
    ],
    notes: 'Meeting notes with mixed Chinese-English. Tiger\'s action items are in both languages. Priya\'s items are waiting_on_them.',
  },

  // --- 164-166: Chinese email quoting English contract terms ---

  {
    id: 164,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Chinese email quoting English MSA terms with commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: MSA条款确认',
    body: `Rachel，

我仔细看了MSA的条款，有几点需要确认：

1. Section 3.2 "Service Level Agreement" 里面写的 "99.9% uptime guarantee" — 这个我们可以commit
2. Section 5.1 "Data Processing Agreement" — 需要加一条关于data residency in Singapore的条款
3. Section 7.3 "Liability Cap" — the cap at 12 months of fees is standard, no issue

我会让律师这周把修改意见整理好，连同redlined version一起发给你们法务。

Tiger`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '修改意见|redlined|律师|legal.*review|MSA',
        deadline: '2026-04-03',
        confidence_min: 0.8,
      },
    ],
    notes: 'Chinese email referencing English contract sections. Commitment is to have lawyer prepare comments "这周" (this week).',
  },

  {
    id: 165,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Chinese email with English pricing commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wang.lei@zhongbao.cn',
    subject: 'Re: 合作定价方案',
    body: `王磊，

关于定价方案，我的建议如下：

Tier 1: Basic Analytics — USD 5,000/month (100 personas)
Tier 2: Advanced + AI — USD 12,000/month (500 personas)
Tier 3: Enterprise — USD 25,000/month (unlimited personas + dedicated support)

因为是第一个中国客户，我可以给你们first-mover discount：前6个月打八折。

我会在下周二之前准备一份正式的commercial proposal，包含detailed pricing breakdown和ROI projection。

王磊你看看这个方向可以吗？

Tiger`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'commercial proposal|pricing.*breakdown|ROI.*projection|定价',
        deadline: '2026-04-07',
        confidence_min: 0.8,
      },
    ],
    notes: 'Chinese context with English pricing tiers. Commitment to prepare formal proposal "下周二之前" (before next Tuesday = April 7).',
  },

  {
    id: 166,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Chinese email with English technical specs commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'li.ming@chinainsure.cn',
    subject: 'Re: API对接技术方案',
    body: `李明，

API对接的方案我们这边已经有了初步设计：

Authentication: OAuth 2.0 + JWT tokens
Rate limiting: 1000 requests/minute per API key
Data format: JSON with gzip compression
Endpoints: RESTful API with OpenAPI 3.0 spec

我会让Wei准备一份完整的API specification document，包括：
- Authentication flow diagram
- 所有endpoint的request/response schema
- Error codes和troubleshooting guide
- SDK samples (Python + Java)

预计下周五之前可以给你们review。

Tiger`,
    date: '2026-03-30T16:30:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'API specification|API.*document|spec.*document',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
    ],
    notes: 'Chinese context with English technical specifications. "让Wei准备" means Tiger is delegating but still owning the commitment. "下周五之前" = before next Friday = April 10.',
  },

  // --- 167-170: Code-switching mid-sentence Singapore style ---

  {
    id: 167,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Singlish code-switching with commitment buried inside',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Re: The production bug — damn jialat',
    body: `Wei ah,

Wah this bug damn jialat sia. Customer already complain liao. 我看了一下log，应该是那个caching layer的问题。

I'll fix the caching logic tonight lah, you don't need to stay late. Tomorrow morning我来deploy，然后我们一起test确保没问题。

这种低级错误不能再犯了 — next time we need proper code review before any production deploy, ok?

Tiger`,
    date: '2026-03-30T19:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'fix.*caching|caching.*logic',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'deploy|test',
        deadline: '2026-03-31',
        confidence_min: 0.8,
      },
    ],
    notes: 'Singlish + Mandarin code-switching. "jialat" = terrible/serious. "lah" is Singlish particle. Commitments: fix tonight + deploy tomorrow morning.',
  },

  {
    id: 168,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Singapore-style business email with Mandarin phrases',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Partnership proposal — can lah!',
    body: `James,

Your partnership proposal — can lah! 我觉得很有潜力。The synergy between OCBC's distribution network and our AI platform is 非常明显的 (very obvious).

I'll prepare a detailed joint business case with projected revenue numbers. 给我两个星期的时间 — I want to make sure the financial model is rock solid before presenting to your management.

Let's 搞起来 (make it happen)!

Tiger`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'joint business case|financial model|revenue.*numbers',
        deadline: '2026-04-13',
        confidence_min: 0.8,
      },
    ],
    notes: '"Can lah" = Singlish for "sure, can do". "给我两个星期" = give me two weeks = April 13. Heavy code-switching throughout.',
  },

  {
    id: 169,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Rapid code-switching in team coordination email',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'mei.ling@actuaryhelp.com',
    subject: 'Re: Office事务 + Client事情',
    body: `美玲，

几件事：

1. Office renovation — 装修公司说next week开工。我会跟他们confirm final layout by Thursday。
2. DBS contract — Rachel那边say要加一个addendum关于data retention policy。我today会draft好send给你review。
3. Team dinner — 这个月的team dinner你来arrange吧。Budget $50/pax，人数大概15个人。Pick somewhere near office can already.

忙死了 but we got this 💪

Tiger`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'confirm.*layout|renovation.*layout|装修',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
      {
        type: 'i_promised',
        title_pattern: 'draft.*addendum|data retention|DBS.*contract',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
      {
        type: 'waiting_on_them',
        title_pattern: 'team dinner|arrange.*dinner',
        confidence_min: 0.75,
      },
    ],
    notes: 'Extreme code-switching: English/Chinese/Singlish in every sentence. Three items with different owners and deadlines.',
  },

  {
    id: 170,
    category: 'edge_mixed_language',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Code-switching with family context and implicit deadline',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wife@family.com',
    subject: 'Re: Weekend plans',
    body: `老婆,

This weekend的plan：

Saturday morning — 我带小明去swimming class（记得他的goggles上次broken了，我Friday下班去Decathlon买新的）
Saturday afternoon — grocery shopping at FairPrice Finest, 我来drive
Sunday — your parents来我们家吃饭是吧？我会prepare那个他们喜欢的herbal chicken soup。

Oh ya, 还有一件事 — 小美的school fee I'll transfer today, don't worry.

Tiger`,
    date: '2026-03-30T21:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'goggles|Decathlon|swimming',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'herbal chicken soup|prepare.*soup|cooking',
        confidence_min: 0.7,
      },
      {
        type: 'i_promised',
        title_pattern: 'school fee|transfer',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
    ],
    notes: 'Family email with heavy code-switching. Multiple commitments: buy goggles Friday, prepare soup Sunday, transfer school fee today.',
  },

  // =========================================================================
  // EDGE: HIGH FALSE-POSITIVE RISK (171-190)
  // =========================================================================

  // --- 171-173: Company policy descriptions ---

  {
    id: 171,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Company policy — "all employees will submit" is not personal commitment',
    from_address: 'hr@actuaryhelp.com',
    from_name: 'HR Team',
    to_address: 'all-staff@actuaryhelp.com',
    subject: 'Reminder: Updated Expense Policy — Effective April 1',
    body: `Dear Team,

Please note the following updates to our expense reimbursement policy, effective April 1, 2026:

1. All employees will submit expense claims within 14 days of the expense being incurred
2. Claims above $500 will require VP-level approval
3. International travel expenses will be reimbursed at the prevailing MAS exchange rate
4. All receipts must be uploaded to the HR portal within 7 days

Non-compliance will result in delayed reimbursement.

Please reach out to HR if you have any questions.

Best,
HR Team`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'expense.*claim|submit.*expense|receipt',
        gate_failed: 'Q2',
        reason: '"All employees will submit" is a policy statement describing rules, not a personal commitment from the sender.',
      },
    ],
  },

  {
    id: 172,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'IT policy — "users will be required to" is not commitment',
    from_address: 'it-admin@actuaryhelp.com',
    from_name: 'IT Department',
    to_address: 'all-staff@actuaryhelp.com',
    subject: 'Mandatory: Password Reset Required by April 5',
    body: `Hi all,

As part of our quarterly security refresh, all users will be required to reset their passwords by April 5, 2026.

New password requirements:
- Minimum 16 characters
- At least one uppercase, one lowercase, one number, one special character
- Cannot reuse last 10 passwords
- Must enable 2FA on all company accounts

Users who do not comply will have their accounts temporarily suspended.

IT Department`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'password.*reset|2FA|security',
        gate_failed: 'Q2',
        reason: '"All users will be required to" is an IT policy mandate, not a personal commitment from the IT department.',
      },
    ],
  },

  {
    id: 173,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Company announcement — "we will be implementing" is org-level, not personal',
    from_address: 'ceo@actuaryhelp.com',
    from_name: 'Tiger Li (CEO)',
    to_address: 'all-staff@actuaryhelp.com',
    subject: 'Company-wide Announcement: New Office Move',
    body: `Dear ActuaryHelp Team,

I'm excited to announce that we will be moving to our new office at One Raffles Place, Level 45, effective May 1, 2026.

Key details:
- The facilities team will coordinate the physical move over the April 25-27 weekend
- All employees will receive new access cards by April 20
- We will be implementing a hot-desking policy in the new space
- The IT team will ensure all systems are migrated with zero downtime

This is a major milestone for our company. More details to follow in the coming weeks.

Tiger Li
CEO, ActuaryHelp`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'office.*move|access cards|hot.?desking|migrate.*systems',
        gate_failed: 'Q2',
        reason: 'CEO announcing organizational changes. "We will be implementing" and "the team will coordinate" are describing company plans, not personal commitments to the email recipient.',
      },
    ],
    notes: 'Even though Tiger is the sender and CEO, this is an organizational announcement to all staff, not a personal promise to any individual.',
  },

  // --- 174-176: Job descriptions ---

  {
    id: 174,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Job description — "the candidate will" describes a role, not commitment',
    from_address: 'hr@actuaryhelp.com',
    from_name: 'HR Team',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Draft JD for Review — Senior Data Engineer',
    body: `Hi Tiger,

Here's the draft JD for the Senior Data Engineer role. Please review and approve:

---
Senior Data Engineer — ActuaryHelp

The successful candidate will be responsible for:
- Designing and maintaining our data pipeline infrastructure on AWS
- Building real-time streaming data systems using Kafka and Flink
- Optimizing query performance across our 148K persona dataset
- Mentoring junior engineers and conducting code reviews

The candidate will report directly to the CTO and will collaborate closely with the product and data science teams.

Requirements:
- 5+ years experience in data engineering
- Strong proficiency in Python, SQL, and Spark
- Experience with AWS (ECS, RDS, S3, Lambda)
---

Let me know if you'd like any changes.

HR Team`,
    date: '2026-03-30T09:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'candidate|data engineer|pipeline|mentor',
        gate_failed: 'Q2',
        reason: '"The candidate will be responsible for" is a job description template, not a personal commitment. "Will report to" describes reporting structure.',
      },
    ],
  },

  {
    id: 175,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Performance review template — "employee will achieve" is goal-setting',
    from_address: 'hr@actuaryhelp.com',
    from_name: 'HR Team',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Q2 Performance Goals Template — Wei Zhang',
    body: `Hi Tiger,

Here is Wei's Q2 performance goals template for your review:

Employee: Wei Zhang
Manager: Tiger Li
Quarter: Q2 2026

Goals:
1. The employee will achieve 95% sprint completion rate
2. The employee will reduce average bug resolution time to under 24 hours
3. The employee will complete AWS Solutions Architect certification by June 30
4. The employee will mentor 2 junior developers through onboarding

Please discuss with Wei and finalize by April 10.

HR Team`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'sprint.*completion|bug.*resolution|AWS.*certification|mentor',
        gate_failed: 'Q2',
        reason: '"The employee will achieve" is a goal-setting template from HR, not a personal commitment from anyone involved in the email.',
      },
    ],
  },

  {
    id: 176,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Recruitment agency pitch — "our recruiters will" is marketing',
    from_address: 'partnerships@hays.com.sg',
    from_name: 'Hays Singapore',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Hays can help you build your tech team',
    body: `Dear Tiger,

Congratulations on your recent funding — we'd love to help you scale your engineering team.

Here's what Hays can do for ActuaryHelp:

- Our dedicated tech recruiters will source and screen candidates within 48 hours
- We will present a shortlist of 5-8 qualified candidates per role
- Our team will coordinate all interviews and handle offer negotiations
- We will provide a 90-day placement guarantee

We've successfully placed over 200 tech professionals in Singapore startups this year.

Shall we schedule a 15-minute call to discuss your hiring needs?

Best regards,
Jessica Ng
Senior Account Manager, Hays Singapore`,
    date: '2026-03-30T10:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'source.*candidate|shortlist|interview|placement',
        gate_failed: 'Q2',
        reason: '"Our recruiters will" and "we will present" are sales pitch promises describing their service offering, not personal commitments from the sender.',
      },
    ],
  },

  // --- 177-179: Meeting agenda items ---

  {
    id: 177,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Meeting agenda — "we will discuss" is agenda item, not commitment',
    from_address: 'rachel.tan@dbs.com',
    from_name: 'Rachel Tan',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Agenda: Q2 Steering Committee — April 7',
    body: `Hi Tiger,

Here's the agenda for our Q2 steering committee meeting on April 7:

1. [10:00-10:15] Welcome and Q1 recap
2. [10:15-10:45] We will discuss the Q1 POC results and success metrics
3. [10:45-11:15] We will review the Phase 2 scope and timeline
4. [11:15-11:30] Budget allocation — we will decide on the Q2 investment
5. [11:30-11:45] We will address any open risks and blockers
6. [11:45-12:00] Next steps and action items

Please prepare a 10-minute presentation on the POC results.

Rachel`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'discuss.*Q1|review.*scope|budget.*allocation|risks',
        gate_failed: 'Q2',
        reason: '"We will discuss" and "we will review" are meeting agenda descriptions, not commitments. They describe what will happen in the meeting, not personal promises.',
      },
    ],
    notes: '"Please prepare a 10-minute presentation" is a request to Tiger, but since Rachel is asking (not Tiger committing), it is not an i_promised.',
  },

  {
    id: 178,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Sprint planning email — "the team will work on" is plan, not promise',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Sprint 14 Plan — March 30 to April 10',
    body: `Boss,

Sprint 14 plan for your sign-off:

Sprint Goal: Complete DBS API integration

Stories:
- [DTSG-401] The team will implement the authentication middleware (8 pts)
- [DTSG-402] We will build the persona query API endpoint (5 pts)
- [DTSG-403] The team will set up monitoring and alerting (3 pts)
- [DTSG-404] We will write integration tests for all endpoints (5 pts)

Total: 21 story points
Velocity average: 23 pts/sprint — should be achievable.

Sprint review: April 10, 3pm

Wei`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'authentication|API endpoint|monitoring|integration test',
        gate_failed: 'Q2',
        reason: '"The team will implement" and "we will build" describe sprint plan items for the team, not personal commitments from Wei to Tiger.',
      },
    ],
    notes: 'Sprint plans describe team work items. While the team is committing to the sprint, the email itself is a plan document, not a personal promise.',
  },

  {
    id: 179,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Workshop agenda — "participants will learn" is event description',
    from_address: 'events@sginnovate.org',
    from_name: 'SGInnovate Events',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Workshop Confirmation: AI for Insurance — April 15',
    body: `Dear Tiger,

Thank you for registering for our workshop "AI for Insurance: From Hype to Reality".

Workshop Details:
Date: April 15, 2026
Time: 9:00 AM - 5:00 PM
Venue: SGInnovate, 32 Carpenter Street

Agenda:
- Morning session: Participants will learn about current AI applications in insurance
- Hands-on: You will build a simple claims classification model
- Afternoon: We will explore ethical AI frameworks and regulatory considerations
- Panel: Industry leaders will share their AI implementation journeys

What to bring: Laptop with Python 3.10+ installed

We look forward to seeing you!

SGInnovate Events Team`,
    date: '2026-03-30T08:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'learn|build.*model|explore|AI.*workshop',
        gate_failed: 'Q2',
        reason: '"Participants will learn" and "you will build" describe a workshop agenda, not personal commitments. Event description language, not promise language.',
      },
    ],
  },

  // --- 180-182: Hypothetical scenarios ---

  {
    id: 180,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Hypothetical scenario — "if we launch in Q2, we would need..."',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Go-to-Market Strategy Options',
    body: `Sarah,

Here's my thinking on the two scenarios:

Scenario A: If we launch in Q2, we would need to hire 3 additional engineers and ramp up the infrastructure spend by $20K/month. The team would need to work weekends for 6 weeks to hit the deadline.

Scenario B: If we push to Q3, we would have time to build a more robust product and could launch with full feature parity. We would also save approximately $100K in rush engineering costs.

Personally, I lean towards Scenario B, but it depends on Singlife's competitive pressure timeline.

What does your team think?

Tiger`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'hire.*engineer|infrastructure|launch.*Q[23]',
        gate_failed: 'Q3',
        reason: '"If we launch" and "we would need" are hypothetical conditional scenarios. No decision has been made, so no commitment exists.',
      },
    ],
  },

  {
    id: 181,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Theoretical business case — "this would generate" is projection',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Revenue Projection Scenarios',
    body: `James,

Based on the assumptions we discussed, here's what the numbers would look like:

Year 1: This would generate approximately $2.4M in ARR
Year 2: With 30% growth, we would reach $3.1M
Year 3: At scale, the platform would serve 500K personas generating $5M ARR

The ROI for OCBC would be approximately 340% over 3 years. The cost savings from automated persona generation alone would offset the subscription fee by month 8.

Of course, these are projections based on current assumptions. Actual results would depend on adoption rates and market conditions.

Tiger`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'revenue|ARR|ROI|projection|cost saving',
        gate_failed: 'Q3',
        reason: '"Would generate", "would reach", "would serve" — all conditional/hypothetical language. Financial projections are not commitments.',
      },
    ],
  },

  {
    id: 182,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Brainstorming ideas — "we could potentially" is exploration',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Innovation Workshop Ideas',
    body: `Priya,

Some ideas from our brainstorming session:

1. We could potentially build a real-time risk scoring engine that integrates with your underwriting workflow
2. Another option would be to create a customer churn prediction model using our digital twin data
3. We might also explore a chatbot that uses persona insights to personalize customer conversations
4. If resources allow, we could develop an automated claims fraud detection module

These are all early-stage ideas. I'd suggest we pick the top 2 and do a proper feasibility study before committing to anything.

Thoughts?

Tiger`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'risk scoring|churn prediction|chatbot|fraud detection',
        gate_failed: 'Q3',
        reason: '"Could potentially", "another option would be", "we might explore" — all exploratory language. Explicitly says "before committing to anything".',
      },
    ],
  },

  // --- 183-185: Historical summaries ---

  {
    id: 183,
    category: 'edge_false_positive',
    difficulty: 'medium',
    language: 'en',
    description: 'Historical summary — "last quarter the team delivered" is past reporting',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'investors@actuaryhelp.com',
    subject: 'Q1 2026 Investor Update',
    body: `Dear Investors,

Q1 2026 Highlights:

Last quarter, the team delivered the following:
- Launched v6.5 of the Digital Twins platform
- Grew to 148K personas (up from 95K in Q4)
- Signed 3 new enterprise clients (DBS, Prudential, Singlife)
- Reduced infrastructure costs by 35% through AWS optimization
- Hired 4 senior engineers, bringing the team to 15

Revenue grew 47% QoQ to $180K MRR. We're now at $2.16M ARR.

The team also completed the migration from OpenAI to SiliconFlow, reducing our LLM costs by 60%.

More details in the attached deck.

Tiger Li
CEO, ActuaryHelp`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'launched|grew|signed|reduced|hired|completed',
        gate_failed: 'Q2',
        reason: 'Historical summary of past achievements. All verbs are past tense — "delivered", "launched", "grew", "signed". No forward-looking commitments.',
      },
    ],
  },

  {
    id: 184,
    category: 'edge_false_positive',
    difficulty: 'medium',
    language: 'en',
    description: 'Post-mortem report — past incident description',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Post-mortem: March 28 Production Outage',
    body: `Boss,

Post-mortem report for the March 28 production outage:

Timeline:
- 14:32 SGT: Monitoring detected elevated error rates
- 14:35 SGT: On-call engineer (me) was paged
- 14:42 SGT: Root cause identified — database connection pool exhausted
- 14:55 SGT: Hotfix deployed — increased pool size from 20 to 50
- 15:03 SGT: All services restored to normal

Impact: 31 minutes of degraded service. 12 API requests failed (0.003% of daily traffic).

Root Cause: A new batch job was opening connections without properly closing them, eventually exhausting the pool.

Prevention: We added connection pool monitoring and auto-scaling. Also added connection leak detection to our CI pipeline.

Lessons Learned: The team responded quickly, but we need better runbook documentation for database-related incidents.

Wei`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'hotfix|restored|monitoring|pool',
        gate_failed: 'Q2',
        reason: 'Post-mortem report describing a past incident. All actions described have already been taken. "We added" and "we need" are past tense and observation respectively.',
      },
    ],
  },

  {
    id: 185,
    category: 'edge_false_positive',
    difficulty: 'medium',
    language: 'en',
    description: 'Case study summary — describing what was achieved for a client',
    from_address: 'mei.ling@actuaryhelp.com',
    from_name: 'Mei Ling',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Draft Case Study — DBS Success Story',
    body: `Boss,

Here's the draft case study for the website:

---
DBS Digital Twins Case Study

Challenge: DBS needed to understand 500K customer segments without expensive traditional research.

Solution: ActuaryHelp deployed its Digital Twins platform, generating 50K synthetic personas that mirrored DBS's actual customer base with 94% accuracy.

Results:
- The team delivered the full deployment in just 8 weeks
- DBS reduced their market research spend by 60%
- Customer insight turnaround time dropped from 3 weeks to 2 days
- The platform generated actionable insights that led to a 15% increase in cross-sell rates
---

What do you think? Should I add more technical details?

Mei Ling`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'deploy|delivered|reduced|generated',
        gate_failed: 'Q2',
        reason: 'Case study draft describing past achievements. All verbs are past tense. The question "should I add more" is a question, not a commitment.',
      },
    ],
  },

  // --- 186-188: Terms & conditions / legal boilerplate ---

  {
    id: 186,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Legal terms — "the provider shall deliver" is contractual language',
    from_address: 'legal@dbs.com',
    from_name: 'DBS Legal',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'MSA Draft — ActuaryHelp / DBS — For Review',
    body: `Dear Mr. Li,

Please find attached the draft Master Service Agreement between DBS Bank Ltd and ActuaryHelp Pte Ltd.

Key terms summary:

Section 3.1: The Provider shall deliver the Platform within 60 days of the Effective Date.
Section 3.2: The Provider shall maintain 99.9% uptime as measured on a monthly basis.
Section 4.1: The Client shall provide test data within 14 days of contract execution.
Section 5.1: Both parties shall comply with all applicable data protection legislation including PDPA.
Section 8.2: The Provider shall indemnify the Client against any third-party IP claims.

Please review and revert with any comments by April 10, 2026.

Regards,
DBS Legal Department`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'deliver.*platform|uptime|indemnify|comply',
        gate_failed: 'Q2',
        reason: '"The Provider shall" is standard legal contract language describing obligations under a potential agreement. This is a draft MSA for review, not a personal commitment.',
      },
    ],
    notes: '"Please review and revert by April 10" could be seen as creating a deadline, but it is a request from DBS to Tiger, not Tiger making a commitment.',
  },

  {
    id: 187,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'SaaS terms of service — standard boilerplate',
    from_address: 'legal@actuaryhelp.com',
    from_name: 'ActuaryHelp Legal',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Updated ToS — Final Review Before Publish',
    body: `Tiger,

Final version of the updated Terms of Service for your sign-off:

---
Terms of Service — ActuaryHelp Platform

2.1 Service Availability: We will use commercially reasonable efforts to make the Service available 99.9% of the time.

2.2 Data Processing: We will process Customer Data only as necessary to provide the Service and in accordance with our Privacy Policy.

3.1 Customer Obligations: The Customer will maintain the confidentiality of their API keys and login credentials.

3.2 Acceptable Use: The Customer will not use the Service for any illegal purpose or in violation of any applicable law.

5.1 Termination: Either party may terminate this Agreement with 30 days written notice.

6.1 Limitation of Liability: In no event shall either party's aggregate liability exceed the amounts paid in the 12 months preceding the claim.
---

OK to publish?

Legal Team`,
    date: '2026-03-30T11:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'availability|data processing|termination|liability',
        gate_failed: 'Q2',
        reason: 'Standard Terms of Service boilerplate. "We will" in this context is legal obligation language, not personal commitment.',
      },
    ],
  },

  {
    id: 188,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'NDA template — legal obligation language',
    from_address: 'legal@singlife.com',
    from_name: 'Singlife Legal',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'NDA — Singlife / ActuaryHelp — For Execution',
    body: `Dear Tiger,

Attached is the mutual NDA for execution. Summary of key obligations:

1. Each party will treat all Confidential Information received from the other party with at least the same degree of care as it treats its own confidential information.

2. The Receiving Party shall not disclose Confidential Information to any third party without prior written consent.

3. Upon termination, each party will return or destroy all Confidential Information within 30 days.

4. This Agreement shall remain in effect for 3 years from the Effective Date.

Please sign and return at your earliest convenience.

Singlife Legal`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'confidential|NDA|disclose|return.*destroy',
        gate_failed: 'Q2',
        reason: 'NDA template with standard legal obligations. "Each party will" and "shall not disclose" are contractual terms, not personal commitments.',
      },
    ],
  },

  // --- 189-190: Forwarded instructions from others ---

  {
    id: 189,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Forwarded email — instructions from a third party, not personal commitment',
    from_address: 'wei.zhang@actuaryhelp.com',
    from_name: 'Wei Zhang',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Fwd: AWS Architecture Review Recommendations',
    body: `Boss, forwarding this from our AWS Solutions Architect for your awareness.

---------- Forwarded message ----------
From: AWS Solutions Architect <sa@aws.com>
Date: March 29, 2026
Subject: Architecture Review Recommendations

Hi Wei,

Following our architecture review, here are our recommendations:

1. You should migrate your RDS instances to Aurora Serverless v2 — this will reduce costs by approximately 40%
2. We recommend implementing a caching layer with ElastiCache for your most frequent queries
3. Your team will need to update the IAM policies to follow least-privilege principles
4. We will schedule a follow-up review in 6 months to assess progress

Please let us know if you have any questions.

AWS Solutions Architecture Team`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'migrate.*RDS|caching|IAM|Aurora',
        gate_failed: 'Q3',
        reason: 'Forwarded third-party recommendations. "You should migrate" and "your team will need to" are advice from AWS, not commitments from Wei or Tiger.',
      },
    ],
  },

  {
    id: 190,
    category: 'edge_false_positive',
    difficulty: 'hard',
    language: 'en',
    description: 'Forwarded client request — relaying instructions, not committing',
    from_address: 'mei.ling@actuaryhelp.com',
    from_name: 'Mei Ling',
    to_address: 'tiger@actuaryhelp.com',
    subject: 'Fwd: Prudential — Additional Requirements',
    body: `Boss, FYI — Priya sent this over. Looks like scope creep to me but wanted your take before I respond.

---------- Forwarded message ----------
From: Priya Sharma <priya.sharma@prudential.com.sg>
Date: March 30, 2026
Subject: Additional Requirements for Phase 2

Hi Mei Ling,

After our internal review, we have a few additional requirements for Phase 2:

1. ActuaryHelp will need to support multi-language personas (English, Chinese, Malay, Tamil)
2. The team will deliver bi-weekly progress reports instead of monthly
3. You will provide 24/7 production support with 1-hour SLA for critical issues
4. All data will be encrypted at rest and in transit using AES-256

Please confirm these can be accommodated.

Thanks,
Priya`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'multi-language|progress report|24/7 support|encryption',
        gate_failed: 'Q3',
        reason: 'Forwarded client requirements. Mei Ling is relaying Priya\'s requirements, explicitly seeking Tiger\'s input ("wanted your take") before responding. No commitment has been made.',
      },
    ],
  },

  // =========================================================================
  // EDGE: EXTREMELY LONG EMAILS (191-200)
  // =========================================================================

  // --- 191-193: Long company newsletter with one action item at the bottom ---

  {
    id: 191,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long company newsletter — one buried commitment at the very end',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'all-staff@actuaryhelp.com',
    subject: 'March 2026 Company Update — Lots to Celebrate!',
    body: `Team,

What an incredible month! Here's the March 2026 update:

🎉 WINS
- We closed the DBS enterprise deal — $500K ACV! Huge thanks to Rachel and the BD team for months of persistence.
- Our platform now supports 148K personas, up from 95K at the start of the year. The engineering team crushed it.
- We were featured in The Business Times: "Singapore Startup Uses AI to Create Digital Twins of Insurance Customers". Great PR for the company.
- Our NPS score hit 72 — that's world-class for a B2B SaaS product.

📊 METRICS
- MRR: $180K (up 47% QoQ)
- ARR: $2.16M
- Customers: 8 enterprise, 23 SMB
- Team size: 15 (up from 11 in January)
- Infrastructure cost: $12K/month (down 35% after AWS optimization)
- Uptime: 99.97% (exceeded our 99.9% SLA)

🔧 ENGINEERING
The v6.5 release was our biggest yet:
- Decision framework migration (from 7-dimension to signal map architecture)
- SiliconFlow LLM migration (60% cost reduction vs OpenAI)
- New ontology system with 4-table design
- Performance improvements: average API response time down from 2.3s to 0.8s
- 47 bugs fixed, 0 P1 incidents

The engineering team also completed the SOC 2 Type II readiness assessment. We're on track for formal certification by Q3.

👥 PEOPLE
Welcome to our newest team members:
- Arun Kumar — Senior Data Engineer (ex-Grab)
- Chen Wei — ML Engineer (ex-ByteDance)
- Jessica Ng — Business Development Manager (ex-Prudential)
- David Lim — Frontend Engineer (ex-Shopee)

Congrats to Mei Ling for her promotion to VP of Operations! Well deserved.

📅 UPCOMING EVENTS
- April 7: DBS Steering Committee (Tiger + Wei)
- April 15: SGInnovate AI Workshop (Tiger speaking)
- April 22: Team offsite at Sentosa
- May 1: Prudential Phase 2 go-live

🌏 LOOKING AHEAD
Q2 priorities:
1. Land 2 more enterprise deals (OCBC and Great Eastern in pipeline)
2. Launch the China market entry with ZhongBao
3. Complete SOC 2 certification
4. Hire 3 more engineers
5. Release v7.0 with measurement skeleton

It's going to be an intense quarter but I'm confident in this team.

One personal note: I'll be sending each of you a personalized Q2 goals document by end of this week. Please review and schedule time with your manager to discuss.

Onwards and upwards!

Tiger`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'Q2 goals|personalized.*goals|goals document',
        deadline: '2026-04-03',
        confidence_min: 0.7,
      },
    ],
    notes: '2000+ word company newsletter. The ONLY extractable commitment is the very last paragraph: "I\'ll be sending each of you a personalized Q2 goals document by end of this week." Everything else is reporting, celebrating, or describing plans.',
  },

  {
    id: 192,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long industry analysis with one personal promise buried in the middle',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Detailed Market Analysis — APAC Insurtech Landscape 2026',
    body: `James,

As discussed, here's my analysis of the APAC insurtech landscape. This is based on 6 months of research and conversations with 50+ industry players.

EXECUTIVE SUMMARY
The APAC insurtech market is projected to reach $15.8B by 2028, growing at 24% CAGR. Singapore remains the primary hub, with Hong Kong and Australia as secondary markets. The key trends are:

1. AI-DRIVEN UNDERWRITING
Traditional actuarial models are being supplemented (not replaced) by machine learning. Key players include ZhongAn (China), PolicyBazaar (India), and CoverGo (HK). The regulatory environment is catching up — MAS published new AI guidelines in February 2026 that create a clearer framework for automated underwriting decisions.

The challenge: most insurers still rely on legacy systems that can't easily integrate modern ML models. This creates an opportunity for middleware players like ActuaryHelp.

2. DIGITAL DISTRIBUTION
Direct-to-consumer insurance platforms have struggled in APAC. The agent model remains dominant in most markets. However, there's growing adoption of digital tools BY agents — this is where the real market opportunity lies.

Singapore's regulatory sandbox has enabled some innovation here. FWD and Singlife have been the most progressive, while the big 3 (AIA, Prudential, Great Eastern) are moving more slowly.

3. EMBEDDED INSURANCE
This is the fastest-growing segment. Partnerships between insurers and non-insurance platforms (Grab, Shopee, Lazada) are driving adoption. The economics are compelling: CAC drops by 70-80% compared to traditional distribution.

The key technical challenge is real-time risk assessment — you need to underwrite at the point of purchase in milliseconds, not days.

4. CUSTOMER ANALYTICS / DIGITAL TWINS
This is our space. The concept of creating synthetic customer models using AI is still nascent but growing fast. We have first-mover advantage in Singapore.

The competitive landscape is thin:
- ZhongAn has the most advanced technology but is China-focused
- Coherent has some persona modeling but it's rules-based, not AI
- No one else in APAC is doing what we're doing

5. REGULATORY TECHNOLOGY
MAS has been pushing for more sophisticated regulatory reporting. The upcoming IFRS 17 implementation (fully effective 2025) has created demand for better data infrastructure. RegTech is a $2B opportunity in APAC alone.

MARKET SIZING
For OCBC specifically, I estimate the TAM at $8-12M across the following use cases:
- Customer segmentation and persona modeling: $3-4M
- AI-assisted underwriting: $2-3M
- Claims analytics: $1-2M
- Regulatory reporting automation: $2-3M

COMPETITIVE POSITIONING
I'll prepare a detailed competitive positioning deck specifically for OCBC's use case — showing how our approach compares to build-in-house, buy-from-vendor, and partner-with-us options. Expect that by next Monday.

RECOMMENDATIONS
1. Start with a focused POC on customer segmentation (lowest risk, highest visibility)
2. Expand to underwriting analytics in Phase 2
3. Build the business case for a multi-year strategic partnership

Happy to discuss any of these points in more detail.

Tiger`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'competitive.*positioning.*deck|positioning.*deck.*OCBC',
        deadline: '2026-04-06',
        confidence_min: 0.75,
      },
    ],
    notes: 'Very long market analysis email (~600 words before the commitment). One commitment buried in the COMPETITIVE POSITIONING section: "I\'ll prepare a detailed competitive positioning deck... Expect that by next Monday."',
  },

  {
    id: 193,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Long bilingual strategic plan with one commitment near the end',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wang.lei@zhongbao.cn',
    subject: 'Re: 中国市场战略合作方案 — 详细版',
    body: `王磊，

经过我们团队反复讨论，以下是ActuaryHelp中国市场进入的详细战略方案。

一、市场背景分析

中国保险市场2025年保费规模达到5.2万亿人民币，其中数字化渠道占比已经从2020年的8%增长到2025年的22%。银保监会的数据显示，全国共有保险公司198家，其中寿险公司91家，财险公司89家，再保险公司18家。

The key digital transformation trends in the China market include:
- 健康险数字化（Health insurance digitization）— driven by post-COVID demand
- 车险改革（Auto insurance reform）— new pricing models using telematics
- 保险科技投资（Insurtech investment）— $4.2B in 2025, up 35% YoY
- 银保渠道数字化（Bancassurance digitization）— banks as primary distribution

二、竞争格局

主要竞争对手：

1. 众安保险（ZhongAn）
   - 优势：技术最强，有完整的数字保险平台
   - 劣势：客户模型主要基于自有数据，不做外部输出
   - 市值：HKD 15B

2. 保险极客（Insurgeek）
   - 优势：团体健康险领域市占率高
   - 劣势：技术深度不够，主要是SaaS工具

3. 蚂蚁保（Ant Insurance）
   - 优势：用户规模大（5亿+）
   - 劣势：主要做C端，不做B端分析

4. International players:
   - McKinsey Insurance Practice — consulting, not technology
   - Oliver Wyman — actuarial consulting, no AI platform
   - Willis Towers Watson — legacy tools, not cloud-native

三、我们的差异化优势

Our Digital Twins approach is unique because:
- 不需要客户提供真实客户数据（privacy-first approach）
- 可以在没有历史数据的情况下生成合成客户画像
- 148K personas的规模在APAC领先
- 与LLM deep integration使得persona行为更真实

四、进入策略

Phase 1（Q2-Q3 2026）：Partner Entry
- 与中保（ZhongBao）合作，以技术授权模式进入
- 先在上海自贸区注册技术公司
- 通过中保的客户网络获取前5个试点客户

Phase 2（Q4 2026 - Q1 2027）：Market Expansion
- 独立建立中国销售团队（3-5人）
- 参加CIFIT和保险科技大会
- 目标：10个付费企业客户

Phase 3（2027-2028）：Scale
- 建立本地研发中心（成都或杭州）
- 目标：50个企业客户，ARR 5000万人民币

五、合作模式

Revenue sharing proposal:
- ActuaryHelp提供技术平台和持续升级
- 中保负责客户关系和本地化服务
- 收入分成：55% ActuaryHelp / 45% ZhongBao（前两年），后续调整为50/50

六、下一步

关于上海自贸区的公司注册，我会让我们的律师下周开始准备材料，争取4月底之前完成注册。

This is a big opportunity and I want to make sure we get it right. Let me know your thoughts.

Tiger`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '公司注册|company registration|律师.*材料|lawyer.*prepare',
        deadline: '2026-04-30',
        confidence_min: 0.7,
      },
    ],
    notes: 'Very long bilingual strategic plan (~800 words). One commitment in section 六: Tiger will have lawyers start preparing Shanghai FTZ registration materials, targeting completion by end of April.',
  },

  // --- 194-196: Long meeting recap with one buried "I'll follow up on X" ---

  {
    id: 194,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long meeting recap — commitment buried 3/4 through the email',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Meeting Recap — DBS POC Week 4 Review',
    body: `Rachel,

Here's the detailed recap from our Week 4 POC review meeting:

ATTENDEES
Tiger Li (ActuaryHelp CEO), Wei Zhang (ActuaryHelp CTO), Rachel Tan (DBS VP Digital), Kenneth Ng (DBS Director IT), Mei Ling (ActuaryHelp Ops)

AGENDA
1. POC progress update
2. Technical deep-dive on persona accuracy
3. Data quality issues resolution
4. UAT planning
5. Commercial discussion

1. POC PROGRESS UPDATE
We're on track with 85% of the agreed deliverables completed. The remaining 15% relates to the real-time refresh module, which Wei estimates will be ready by April 10.

Key metrics:
- 50K personas generated and validated
- API integration with DBS sandbox: complete
- Persona accuracy score: 94.2% (vs 90% target)
- Average API response time: 0.8s (vs 2s target)
- Zero downtime since deployment

2. TECHNICAL DEEP-DIVE
Wei presented the persona accuracy methodology. The key innovation is our "signal map" approach, which replaced the old 7-dimension model. Rachel's team was impressed with the level of detail.

Kenneth raised a question about the model explainability — specifically, how DBS can audit the AI's decision-making process. Wei explained our SHAP-based explanation module. Kenneth seemed satisfied but wants documentation.

The team discussed the data residency architecture. All persona data is stored in AWS Singapore region (ap-southeast-1). DBS's security team has verified the encryption at rest (AES-256) and in transit (TLS 1.3).

3. DATA QUALITY ISSUES
The timezone conversion bug from two weeks ago has been fully resolved. The root cause was a UTC/SGT parsing issue in the data pipeline. Wei's hotfix has been in production for 10 days with zero recurrence.

Rachel noted that 3% of personas still have inconsistent age distributions. Wei investigated and found it's due to a rounding issue in the age normalization algorithm. This is cosmetic and doesn't affect the underlying model accuracy, but we'll fix it in the next release.

4. UAT PLANNING
DBS UAT is scheduled to begin April 15. Rachel's team will have 5 testers dedicated full-time for 2 weeks. The test scenarios cover:
- Persona generation accuracy
- API performance under load
- Data export/import functionality
- Role-based access control
- Audit trail completeness

I'll prepare the UAT test plan document and share it with Kenneth by end of next week. This will include test scripts, expected results, and sign-off criteria.

5. COMMERCIAL DISCUSSION
Rachel confirmed the budget has been approved at $500K ACV. The contract will be structured as a 2-year agreement with annual renewal option. DBS legal is reviewing the MSA — expected turnaround is 2 weeks.

Pricing tiers discussed:
- Year 1: Enterprise tier at $500K (includes 200K personas, dedicated support)
- Year 2: Renewal at $450K (10% loyalty discount)
- Optional: Professional services at $2,000/day for custom development

OPEN ITEMS
- Kenneth to provide final security questionnaire responses by April 5
- Rachel to confirm UAT team members by April 8
- DBS Legal to complete MSA review by April 14
- Wei to deliver real-time refresh module by April 10

NEXT MEETING
April 14, 2026 — Pre-UAT kickoff

Tiger`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'UAT test plan|test plan document',
        deadline: '2026-04-10',
        confidence_min: 0.8,
      },
    ],
    notes: 'Very long meeting recap. The only personal commitment from Tiger is in section 4: "I\'ll prepare the UAT test plan document and share it with Kenneth by end of next week." The open items at the end describe others\' actions.',
  },

  {
    id: 195,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long technical discussion — one "I\'ll follow up" commitment near the end',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Technical Architecture Questions from Your CTO',
    body: `Priya,

Thanks for forwarding your CTO's questions. Here are detailed responses to each one:

Q1: How does ActuaryHelp ensure persona data accuracy?
Our accuracy is measured using a proprietary "signal alignment score" that compares synthetic persona behaviors against real-world statistical distributions. We validate against 3 independent data sources: census data, industry reports, and anonymized transaction patterns. Our current accuracy benchmark is 94.2%, validated by DBS during their POC. We use z-score normalization with DEFF=3 correction to account for design effects in our sampling methodology.

Q2: What is the infrastructure architecture?
Our platform runs on AWS Singapore (ap-southeast-1) with the following stack:
- Compute: ECS Fargate for stateless services, EC2 for GPU-intensive model training
- Database: Aurora PostgreSQL (primary) + Redis (caching)
- Storage: S3 for data lake, with intelligent tiering for cost optimization
- CDN: CloudFront for static assets
- Monitoring: CloudWatch + custom Grafana dashboards
- CI/CD: GitHub Actions → ECR → ECS blue-green deployment

We process approximately 2M API requests per day with an average response time of 0.8 seconds. The architecture auto-scales based on demand, with a maximum capacity of 10M requests/day.

Q3: How is data protected in transit and at rest?
In transit: TLS 1.3 for all API communications, certificate pinning for mobile clients. At rest: AES-256 encryption for all databases and S3 buckets, with AWS KMS for key management. Customer data is logically isolated using row-level security in PostgreSQL — each customer's data is in a separate schema with independent encryption keys.

We completed SOC 2 Type I in Q4 2025 and are on track for Type II by Q3 2026. Our PDPA compliance has been validated by DBS's security team.

Q4: Can the platform handle multi-region deployment?
Yes. Our architecture is designed for multi-region deployment using AWS's global infrastructure. We currently run in ap-southeast-1 (Singapore) but can deploy to any AWS region within 2 weeks. Data residency is enforced at the application layer — customer data never leaves the designated region.

For Prudential's specific use case, all data would remain in Singapore. If you expand to other APAC markets (Malaysia, Thailand, Indonesia), we can deploy regional instances that comply with local data protection laws.

Q5: What is the LLM dependency and how do you mitigate vendor lock-in?
We recently migrated from OpenAI to SiliconFlow, reducing LLM costs by 60%. Our architecture uses an abstraction layer that supports multiple LLM providers: SiliconFlow (primary), DeepSeek (secondary), and we can integrate OpenAI, Anthropic, or any OpenAI-compatible API as needed.

The abstraction layer means switching LLM providers takes less than 1 day with zero code changes to the application layer. We also maintain a local model fallback using LLaMA 3.2 for critical paths, ensuring the platform remains functional even if all cloud LLM providers are unavailable.

Q6: What about disaster recovery and business continuity?
- RPO (Recovery Point Objective): 1 hour (continuous replication)
- RTO (Recovery Time Objective): 4 hours (automated failover)
- Backup: Daily automated snapshots retained for 30 days
- DR site: ap-southeast-2 (Sydney) with warm standby
- We conduct quarterly DR drills — the last one was February 2026 with successful failover in 2.5 hours

I'll follow up with a formal architecture document that your CTO can share with the Prudential technology governance committee. Expect it by Thursday.

Let me know if any of these need more detail.

Tiger`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'architecture document|formal.*document|CTO.*document',
        deadline: '2026-04-02',
        confidence_min: 0.8,
      },
    ],
    notes: 'Very long technical Q&A (~700 words). One commitment near the very end: "I\'ll follow up with a formal architecture document... Expect it by Thursday."',
  },

  {
    id: 196,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long product update with one commitment in closing paragraph',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Product Roadmap Update — v7.0 Preview',
    body: `Sarah,

Here's a preview of what's coming in v7.0 — our biggest release yet. I wanted to give you an early look since Singlife is one of our most engaged customers.

NEW FEATURES IN v7.0

1. Measurement Skeleton
The most fundamental change in v7.0 is the introduction of quantified measurement. Instead of qualitative persona descriptions ("this customer is risk-averse"), we now assign actual scores on validated psychometric scales.

How it works:
- Each persona gets scored on 12 validated measurement instruments (Likert scales)
- Scores are normalized using z-score methodology with DEFF=3 correction
- Certainty levels are computed for each score based on signal strength
- Results are displayed as confidence intervals, not point estimates

This means you can now say "Customer X has a risk tolerance of 3.2 ± 0.4 on a 5-point scale with 90% confidence" instead of "Customer X seems moderately risk-averse."

2. Signal Map Architecture
We've replaced the old 7-dimension decision framework with a new "signal map" approach. Instead of forcing personas into pre-defined categories, the system discovers which signals are most relevant for each customer.

Benefits:
- More accurate persona modeling (94% → projected 97%)
- Better handling of edge cases and unusual customer profiles
- Reduced dimensionality without losing information
- Faster processing (3x improvement)

3. Three-Table Unification
Our data model has been simplified from 12 tables to 3:
- personas (core attributes)
- signals (measured characteristics)
- decisions (inferred behaviors)

This dramatically simplifies the API surface area and makes integration faster.

4. Custom LLM Support
This was a frequently requested feature. Customers can now use their own LLM API keys instead of our default SiliconFlow provider. We support:
- OpenAI (GPT-4o, GPT-4)
- Anthropic (Claude 3.5 Sonnet, Claude 4)
- DeepSeek (V3, R1)
- Any OpenAI-compatible API endpoint

This addresses data sovereignty concerns — if a customer wants to route all LLM traffic through their own Azure OpenAI instance, they can.

5. Enhanced Ontology System
The ontology has been redesigned from scratch:
- 4 core tables replacing the previous 12
- Support for customer-defined concept hierarchies
- Multi-language concept definitions (EN/ZH/MS/TA)
- Versioned ontologies with rollback support

TIMELINE
- Alpha: April 15 (internal testing)
- Beta: May 1 (select customers including Singlife)
- GA: June 1 (general availability)

PRICING CHANGES
No pricing changes for existing customers. The new measurement features are included in the existing Enterprise tier. Custom LLM support is available as an add-on ($500/month) for Pro tier customers.

MIGRATION
Existing integrations will continue to work without changes. The old 7-dimension API endpoints will be deprecated but maintained for 12 months. We'll provide migration guides and SDK updates.

One specific thing for Singlife: I'll schedule a private demo of the measurement skeleton feature for your actuarial team next week. I think they'll be especially interested in the psychometric scoring methodology.

Let me know if you have any questions about the roadmap.

Tiger`,
    date: '2026-03-30T14:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'schedule.*demo|private demo|measurement.*demo',
        deadline: '2026-04-06',
        confidence_min: 0.7,
      },
    ],
    notes: 'Very long product roadmap email (~700 words). One commitment near the end: "I\'ll schedule a private demo of the measurement skeleton feature for your actuarial team next week."',
  },

  // --- 197-200: Long email thread (forward chain) with commitment only in latest reply ---

  {
    id: 197,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Long forward chain — commitment only in the newest reply at top',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Re: Re: Re: DBS Data Anonymization Requirements',
    body: `Rachel,

I've reviewed the full thread below. To cut through the back-and-forth: I'll prepare a comprehensive data anonymization whitepaper that addresses all of Kenneth's concerns. Will have it ready by next Wednesday.

> On 29 Mar 2026, at 16:00, Rachel Tan <rachel.tan@dbs.com> wrote:
>
> Tiger, Kenneth is still not satisfied with the anonymization approach. He wants a detailed technical document explaining exactly how PII is handled at each stage of the pipeline.
>
> > On 29 Mar 2026, at 14:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> >
> > Rachel, we use k-anonymity with k=5 for all quasi-identifiers, plus differential privacy with epsilon=1.0 for statistical queries. This is industry-standard and exceeds MAS guidelines.
> >
> > > On 28 Mar 2026, at 11:00, Rachel Tan <rachel.tan@dbs.com> wrote:
> > >
> > > Tiger, our CISO Kenneth Ng has questions about how your platform anonymizes customer data. He's concerned about re-identification risks.
> > >
> > > Can you provide more details on your anonymization methodology?
> > >
> > > > On 27 Mar 2026, at 09:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> > > >
> > > > Rachel, the POC data load is complete. All 50K records have been anonymized and loaded into the staging environment.
> > > >
> > > > > On 26 Mar 2026, at 15:00, Rachel Tan <rachel.tan@dbs.com> wrote:
> > > > >
> > > > > Tiger, when will the POC data be ready? Kenneth is asking for a status update.`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'anonymization.*whitepaper|data.*anonymization.*document',
        deadline: '2026-04-08',
        confidence_min: 0.85,
      },
    ],
    notes: 'Long reply chain (5 levels deep). The only commitment is in Tiger\'s latest reply at the top: prepare a whitepaper by next Wednesday.',
  },

  {
    id: 198,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'mixed',
    description: 'Long forward chain mixing Chinese and English — commitment at top',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wang.lei@zhongbao.cn',
    subject: 'Re: Re: Re: 技术对接问题汇总',
    body: `王磊，

看完下面整个thread了。这些技术问题我统一回复：我会让Wei准备一份完整的技术FAQ文档，中英文双语的，本周五之前发给你们技术团队。

这样一次性解决所有疑问，省得来来回回效率太低。

Tiger

> On 29 Mar 2026, at 15:00, 王磊 <wang.lei@zhongbao.cn> wrote:
>
> Tiger，我们CTO又提了几个问题：
> - API rate limiting怎么处理？
> - 数据备份策略是什么？
> - 故障切换需要多长时间？
>
> > On 28 Mar 2026, at 11:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> >
> > 王磊，关于认证机制，我们用的是OAuth 2.0 + JWT。Token有效期24小时，refresh token 30天。
> >
> > > On 27 Mar 2026, at 14:00, 王磊 <wang.lei@zhongbao.cn> wrote:
> > >
> > > Tiger，我们技术团队在做API对接方案，有几个问题：
> > > 1. 认证机制用什么？OAuth还是API Key？
> > > 2. 数据传输用什么格式？JSON还是Protocol Buffers？
> > > 3. SDK有Python版本吗？
> > >
> > > > On 26 Mar 2026, at 10:00, Tiger Li <tiger@actuaryhelp.com> wrote:
> > > >
> > > > 王磊，API文档初版已经发到你们的共享文件夹了。你们技术团队有什么问题随时提。`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: '技术FAQ|technical FAQ|FAQ文档',
        deadline: '2026-04-03',
        confidence_min: 0.85,
      },
    ],
    notes: 'Mixed Chinese-English thread chain. Tiger\'s commitment at the top: prepare bilingual technical FAQ document by Friday this week.',
  },

  {
    id: 199,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Very long thread with multiple past commitments — only the latest one matters',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Re: Re: Re: Re: Prudential Integration — Remaining Issues',
    body: `Priya,

Final answer on all remaining items: I'll get the integration test results to you by Monday COB, along with the updated API rate limiting configuration.

Sorry for the delays — this has been going back and forth too long.

Tiger

> On 29 Mar 2026, at 17:00, Priya Sharma wrote:
>
> Tiger, we still haven't received the integration test results you mentioned on Tuesday. Also, the API rate limiting is still set too low for our production volume.
>
> > On 25 Mar 2026, at 10:00, Tiger Li wrote:
> >
> > Priya, the integration tests are running now. I'll have results by Thursday.
> > [NOTE: This was a past promise that was missed]
> >
> > > On 24 Mar 2026, at 14:00, Priya Sharma wrote:
> > >
> > > Tiger, any update on the integration test results? We need them before UAT.
> > >
> > > > On 20 Mar 2026, at 09:00, Tiger Li wrote:
> > > >
> > > > Priya, I'll start the integration tests next week and share results by Wednesday.
> > > > [NOTE: This was an earlier promise — also missed]
> > > >
> > > > > On 19 Mar 2026, at 11:00, Priya Sharma wrote:
> > > > >
> > > > > Tiger, when can we expect the integration test results? This is blocking our UAT planning.`,
    date: '2026-03-30T09:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'integration test results',
        deadline: '2026-03-30',
        confidence_min: 0.85,
      },
      {
        type: 'i_promised',
        title_pattern: 'API rate limiting|rate limit.*config',
        deadline: '2026-03-30',
        confidence_min: 0.8,
      },
    ],
    notes: 'Long thread with MULTIPLE past missed promises. Only the LATEST commitment (top of thread) should be extracted. Previous promises are historical context, not active commitments. "Monday COB" = March 30 (today).',
  },

  {
    id: 200,
    category: 'edge_long_email',
    difficulty: 'hard',
    language: 'en',
    description: 'Forward with commentary — commitment only in the forwarding note',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wei.zhang@actuaryhelp.com',
    subject: 'Fwd: AWS re:Invent 2026 — Speaker Submission',
    body: `Wei, FYI — I'm planning to submit a speaker proposal for AWS re:Invent. I'll draft the abstract and bio this weekend and send it to you for review before submitting.

---------- Forwarded message ----------
From: AWS Events <events@aws.com>
Date: March 29, 2026
Subject: Call for Speakers — AWS re:Invent 2026

Dear AWS Customer,

We're excited to announce the Call for Speakers for AWS re:Invent 2026!

Event Details:
- Date: November 30 - December 4, 2026
- Location: Las Vegas, NV
- Submission deadline: May 15, 2026

We're looking for speakers in the following tracks:
- AI/ML
- Serverless & Containers
- Database & Analytics
- Security & Compliance
- Startup Innovation

Session formats:
- Breakout sessions (60 minutes)
- Chalk talks (45 minutes, interactive)
- Lightning talks (15 minutes)
- Workshops (2 hours, hands-on)

Benefits for selected speakers:
- Complimentary re:Invent pass ($1,799 value)
- Speaker lounge access
- Networking dinner with AWS leadership
- Priority hotel booking

Submit your proposal: https://reinvent.aws/speakers/submit

We look forward to your submission!

AWS Events Team

---
You received this because you're an AWS customer. Unsubscribe: https://aws.com/unsubscribe`,
    date: '2026-03-30T12:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'speaker.*proposal|abstract|re:Invent|draft.*abstract',
        confidence_min: 0.75,
      },
    ],
    notes: 'Long forwarded email from AWS. The commitment is ONLY in Tiger\'s brief note at the top: draft the abstract and bio this weekend.',
  },

  // =========================================================================
  // EDGE: TONE AMBIGUITY (201-210)
  // =========================================================================

  // --- 201-203: "Let me see what I can do" (brush-off or promise?) ---

  {
    id: 201,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"Let me see what I can do" — ambiguous, leaning toward brush-off',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Enterprise Discount Request',
    body: `Rachel,

Hmm, a 40% discount is quite aggressive. Let me see what I can do — I'll need to check with our finance team on the margin implications.

No promises, but I'll try to get back to you by end of week.

Tiger`,
    date: '2026-03-30T11:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'discount|check.*finance|get back',
        gate_failed: 'Q3',
        reason: '"Let me see what I can do" combined with "no promises" and "I\'ll try" — this is a hedge, not a commitment. The language explicitly avoids commitment.',
      },
    ],
    notes: 'Classic ambiguous phrase. "No promises" is the key signal that this is NOT a commitment. Even "I\'ll try to get back to you" is weakened by "try".',
  },

  {
    id: 202,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"Let me see what I can do" — ambiguous, leaning toward genuine commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Urgent — POC Demo for OCBC Board Tomorrow',
    body: `James,

I know this is last minute, but let me see what I can do. I'll rearrange my schedule and prepare a board-ready demo deck tonight. Wei and I will be at your office by 8am tomorrow to set everything up.

This is important and I don't want OCBC to miss this window.

Tiger`,
    date: '2026-03-30T18:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'demo deck|board.*demo|prepare.*deck|at your office|set.*up|8am|OCBC.*demo',
        deadline: '2026-03-31',
        confidence_min: 0.5,
      },
    ],
    notes: 'Principle 5: Same phrase "let me see what I can do" but followed by specific, concrete actions: "prepare a deck tonight", "be at your office by 8am". The specificity makes this a genuine commitment despite the opening hedge. Low confidence bar for tone ambiguity category.',
  },

  {
    id: 203,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"Let me see what I can do" — completely ambiguous, could go either way',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Custom Feature Request — Persona Clustering',
    body: `Sarah,

Interesting feature request. Let me see what I can do — it's not on our current roadmap but I understand why it would be valuable for Singlife.

I'll discuss with the engineering team and circle back.

Tiger`,
    date: '2026-03-30T14:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'persona clustering|feature request|circle back',
        gate_failed: 'Q3',
        reason: '"Let me see what I can do" + "not on our current roadmap" + "I\'ll discuss and circle back" — this is exploration, not commitment. No concrete action or timeline.',
      },
    ],
    notes: 'The most ambiguous of the three "let me see" variants. "Circle back" is corporate-speak that often means nothing. Without a deadline or specific next step, this should not be treated as a commitment.',
  },

  // --- 204-206: "我尽量" / "I'll try" / "Should be able to" ---

  {
    id: 204,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'zh',
    description: '"我尽量" — Chinese hedging language, weak commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'wang.lei@zhongbao.cn',
    subject: 'Re: 合同签署时间',
    body: `王磊，

合同签署的事，我尽量在4月10号之前搞定。不过你也知道，律师那边有时候会拖。

如果有delay我会提前跟你说。

Tiger`,
    date: '2026-03-30T15:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: '合同签署|contract.*sign|4月10',
        gate_failed: 'Q3',
        reason: '"我尽量" (I\'ll try my best) is a classic Chinese hedging phrase. Combined with "律师那边有时候会拖" (lawyers sometimes delay) — this explicitly hedges the commitment.',
      },
    ],
    notes: '"我尽量" is one of the most common Chinese ambiguity phrases. It can mean "I will definitely do it" or "I\'ll try but probably won\'t". The additional hedging ("lawyers sometimes delay") makes this lean toward non-commitment.',
  },

  {
    id: 205,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"I\'ll try" with additional hedging — weak commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Reference Call with AIA',
    body: `Priya,

I'll try to set up the reference call with my contact at AIA. He's pretty senior though and very busy, so I can't guarantee he'll be available this month.

I'll drop him a message and see if he's open to it.

Tiger`,
    date: '2026-03-30T13:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'reference call|AIA|contact',
        gate_failed: 'Q3',
        reason: '"I\'ll try" + "can\'t guarantee" + "see if he\'s open to it" — triple hedging. The outcome depends on a third party\'s availability.',
      },
    ],
  },

  {
    id: 206,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"Should be able to" — moderate confidence hedging',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'james.wong@ocbc.com',
    subject: 'Re: Extended POC Timeline',
    body: `James,

We should be able to extend the POC by 2 weeks without additional cost. I need to double-check our resource allocation for April, but I don't foresee any issues.

I'll confirm by tomorrow.

Tiger`,
    date: '2026-03-30T16:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'confirm.*POC|confirm.*extension|confirm.*tomorrow|POC.*extend',
        deadline: '2026-03-31',
        confidence_min: 0.5,
      },
    ],
    notes: 'Principle 5: "Should be able to" for the extension is hedging, but "I\'ll confirm by tomorrow" is a concrete commitment to provide an answer. The commitment is to CONFIRM (give an answer), not to actually extend the POC. Low confidence bar because of the hedging language.',
  },

  // --- 207-208: "We should catch up sometime" / "Let's grab coffee" ---

  {
    id: 207,
    category: 'edge_tone_ambiguity',
    difficulty: 'medium',
    language: 'en',
    description: '"We should catch up sometime" — social placeholder, not commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'mark.chen@grab.com',
    subject: 'Re: Long time no see!',
    body: `Mark!

Great to hear from you. Yeah it's been way too long. We should definitely catch up sometime — maybe grab a beer at one of the new places on Keong Saik Road.

Let's make it happen when things calm down a bit on my end.

Tiger`,
    date: '2026-03-30T19:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'catch up|beer|Keong Saik',
        gate_failed: 'Q3',
        reason: '"We should definitely catch up sometime" and "let\'s make it happen when things calm down" are classic social placeholders. No specific date, venue, or action. "Sometime" and "when things calm down" are indefinite.',
      },
    ],
  },

  {
    id: 208,
    category: 'edge_tone_ambiguity',
    difficulty: 'medium',
    language: 'en',
    description: '"Let\'s grab coffee" with specific proposed date — borderline commitment',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'sarah.lim@singlife.com',
    subject: 'Re: Quick chat about roadmap',
    body: `Sarah,

Sure, let's grab coffee. How about next Thursday at 3pm? There's a great new cafe called Apartment Coffee at the base of your building.

My treat!

Tiger`,
    date: '2026-03-30T10:00:00+08:00',
    expected_commitments: [
      {
        type: 'i_promised',
        title_pattern: 'coffee|meet.*Thursday|Apartment Coffee|grab coffee|chat.*Thursday',
        deadline: '2026-04-09',
        confidence_min: 0.5,
      },
    ],
    notes: 'Principle 5: Unlike email 207, this "let\'s grab coffee" includes a specific date, time, and venue. This transforms it from a social placeholder into a tentative commitment. Low confidence bar because it still requires Sarah\'s confirmation.',
  },

  // --- 209-210: "I'll keep you posted" / "Will circle back" ---

  {
    id: 209,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"I\'ll keep you posted" — often empty phrase, context-dependent',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'rachel.tan@dbs.com',
    subject: 'Re: Series A Update',
    body: `Rachel,

Thanks for asking. The Series A conversations are progressing well — we're in advanced talks with 2 VCs and have a term sheet from one of them.

I'll keep you posted on how it goes. Should have more clarity by mid-April.

Tiger`,
    date: '2026-03-30T17:00:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'keep.*posted|Series A|update',
        gate_failed: 'Q3',
        reason: '"I\'ll keep you posted" is one of the most common empty professional phrases. There is no specific deliverable, deadline, or action. "Should have more clarity" is vague.',
      },
    ],
    notes: '"I\'ll keep you posted" is almost never a real commitment. It is the email equivalent of "talk to you later" — a social closing, not a promise to deliver anything specific.',
  },

  {
    id: 210,
    category: 'edge_tone_ambiguity',
    difficulty: 'hard',
    language: 'en',
    description: '"Will circle back" — corporate empty phrase vs real intent',
    from_address: 'tiger@actuaryhelp.com',
    from_name: 'Tiger Li',
    to_address: 'priya.sharma@prudential.com.sg',
    subject: 'Re: Multi-market Expansion Proposal',
    body: `Priya,

Really interesting proposal. The idea of expanding our platform to cover Malaysia and Thailand alongside Singapore makes strategic sense.

I need to run the numbers and check our engineering bandwidth. Will circle back after the board meeting next Tuesday with a more informed perspective.

Tiger`,
    date: '2026-03-30T16:30:00+08:00',
    expected_commitments: [],
    expected_rejections: [
      {
        title_pattern: 'circle back|run.*numbers|multi-market|expansion',
        gate_failed: 'Q3',
        reason: '"Will circle back" is typically a delay tactic, not a commitment. While "after the board meeting next Tuesday" gives a timeframe, there is no specific deliverable promised — just "a more informed perspective", which is vague.',
      },
    ],
    notes: 'Borderline case. Some systems might extract this as a commitment to respond by April 7. However, "circle back with a more informed perspective" is not a concrete deliverable. The phrase "will circle back" is one of the most common corporate non-commitments.',
  },

]

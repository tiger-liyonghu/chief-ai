/**
 * Chief AI — 全面端到端测试案例
 *
 * 覆盖所有产品功能和用户旅程。
 * 每个 test case 可通过 browse 工具在浏览器中自动执行。
 *
 * 使用: npx tsx tests/e2e/run-e2e.ts
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TestStatus = 'pass' | 'fail' | 'skip' | 'blocked'
export type Priority = 'P0' | 'P1' | 'P2'
export type TestType = 'ui' | 'api' | 'flow' | 'data'

export interface TestCase {
  id: string
  name: string
  category: string
  priority: Priority
  type: TestType
  description: string
  preconditions: string[]
  steps: TestStep[]
  expected: string
  cleanup?: string
}

export interface TestStep {
  action: string          // what to do
  target?: string         // URL or element
  data?: string           // input data
  verify?: string         // what to check after
}

// ─────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────

export const TEST_CASES: TestCase[] = [

  // ═══════════════════════════════════════════
  // 1. LANDING PAGE & AUTH
  // ═══════════════════════════════════════════

  {
    id: 'LAND-01',
    name: 'Landing page renders correctly',
    category: 'Landing',
    priority: 'P0',
    type: 'ui',
    description: 'Landing page loads with hero, features, footer',
    preconditions: ['Server running on localhost:3000'],
    steps: [
      { action: 'navigate', target: 'http://localhost:3000/', verify: 'Page loads with 200' },
      { action: 'check_text', target: 'h1', verify: 'Contains "Chief of Staff"' },
      { action: 'check_element', target: 'Connect Your Gmail button', verify: 'CTA button visible' },
      { action: 'check_element', target: 'Feature cards (3)', verify: 'Commitment, City, Family cards visible' },
      { action: 'check_element', target: 'Language switcher', verify: 'EN/中/BM buttons visible' },
      { action: 'check_element', target: 'Footer', verify: '2026 Chief copyright visible' },
      { action: 'check_console', verify: 'Zero JS errors' },
    ],
    expected: 'Landing page fully renders with all sections, zero errors',
  },

  {
    id: 'LAND-02',
    name: 'Language switching works',
    category: 'Landing',
    priority: 'P1',
    type: 'ui',
    description: 'Switch between EN, Chinese, Bahasa Melayu',
    preconditions: ['On landing page'],
    steps: [
      { action: 'click', target: '"中" button', verify: 'Page switches to Chinese' },
      { action: 'check_text', target: 'h1', verify: 'Contains "首席幕僚"' },
      { action: 'click', target: '"EN" button', verify: 'Page switches back to English' },
      { action: 'check_text', target: 'h1', verify: 'Contains "Chief of Staff"' },
    ],
    expected: 'Language switches instantly without page reload',
  },

  {
    id: 'LAND-03',
    name: 'Login page loads',
    category: 'Auth',
    priority: 'P0',
    type: 'ui',
    description: 'Login page shows Google and Microsoft options',
    preconditions: [],
    steps: [
      { action: 'navigate', target: '/login', verify: 'Page loads' },
      { action: 'check_element', target: 'Continue with Google button', verify: 'Google button visible' },
      { action: 'check_element', target: 'Continue with Microsoft button', verify: 'Microsoft button visible' },
      { action: 'check_text', verify: 'Contains "Welcome to Chief"' },
      { action: 'check_console', verify: 'Zero JS errors' },
    ],
    expected: 'Clean login page with both OAuth options',
  },

  {
    id: 'AUTH-01',
    name: 'Unauthenticated redirect to login',
    category: 'Auth',
    priority: 'P0',
    type: 'flow',
    description: 'Accessing dashboard without auth redirects to login',
    preconditions: ['Not logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Redirects to /login' },
      { action: 'navigate', target: '/dashboard/inbox', verify: 'Redirects to /login' },
      { action: 'navigate', target: '/dashboard/settings', verify: 'Redirects to /login' },
    ],
    expected: 'All protected routes redirect to /login',
  },

  // ═══════════════════════════════════════════
  // 2. DASHBOARD
  // ═══════════════════════════════════════════

  {
    id: 'DASH-01',
    name: 'Dashboard loads with all components',
    category: 'Dashboard',
    priority: 'P0',
    type: 'ui',
    description: 'Main dashboard renders commitment stats, briefing, commitment list',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'check_element', target: 'Stats banner (4 cards)', verify: 'Needs Action / Waiting / Family / Compliance rate' },
      { action: 'check_element', target: 'Briefing card', verify: 'Daily briefing visible or loading' },
      { action: 'check_element', target: 'Commitment list', verify: 'At least one commitment card or empty state' },
      { action: 'check_element', target: 'Filter tabs', verify: 'All/I Promised/They Promised/Family tabs' },
      { action: 'check_element', target: 'Sidebar navigation', verify: 'All nav items visible' },
      { action: 'check_console', verify: 'No critical JS errors' },
    ],
    expected: 'Dashboard fully renders with all components',
  },

  {
    id: 'DASH-02',
    name: 'Briefing generates and displays',
    category: 'Dashboard',
    priority: 'P0',
    type: 'flow',
    description: 'AI briefing generates with real content',
    preconditions: ['Logged in', 'Has emails synced'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'wait_for', target: 'Briefing card content', data: '15s timeout', verify: 'Briefing text appears (not just loading spinner)' },
      { action: 'check_text', target: 'Briefing content', verify: 'Contains actionable items (meetings, tasks, or commitments)' },
      { action: 'click', target: 'Refresh briefing button', verify: 'Briefing refreshes' },
    ],
    expected: 'Briefing shows real, actionable content based on user data',
  },

  {
    id: 'DASH-03',
    name: 'Commitment filter tabs work',
    category: 'Dashboard',
    priority: 'P1',
    type: 'ui',
    description: 'Filter tabs correctly filter commitment list',
    preconditions: ['Logged in', 'Has commitments of multiple types'],
    steps: [
      { action: 'click', target: '"I Promised" tab', verify: 'Only i_promised commitments shown' },
      { action: 'check_element', target: 'Commitment cards', verify: 'All cards have blue indicator' },
      { action: 'click', target: '"They Promised" tab', verify: 'Only they_promised commitments shown' },
      { action: 'check_element', target: 'Commitment cards', verify: 'All cards have amber indicator' },
      { action: 'click', target: '"All" tab', verify: 'All commitments shown' },
    ],
    expected: 'Tabs correctly filter by commitment type',
  },

  {
    id: 'DASH-04',
    name: 'Add commitment manually',
    category: 'Dashboard',
    priority: 'P1',
    type: 'flow',
    description: 'User adds a commitment via the manual add form',
    preconditions: ['Logged in'],
    steps: [
      { action: 'click', target: '"Add Commitment" button', verify: 'Modal opens' },
      { action: 'click', target: '"I Promised" type button', verify: 'Type selected' },
      { action: 'fill', target: 'Who field', data: 'Zhang Wei', verify: 'Name entered' },
      { action: 'fill', target: 'What field', data: 'Send Q1 financial report', verify: 'Title entered' },
      { action: 'fill', target: 'When field', data: '2026-04-15', verify: 'Deadline set' },
      { action: 'click', target: 'Save button', verify: 'Modal closes' },
      { action: 'check_element', target: 'Commitment list', verify: 'New commitment appears in list' },
    ],
    expected: 'Manual commitment created and immediately visible',
    cleanup: 'Delete the test commitment',
  },

  {
    id: 'DASH-05',
    name: 'Mark commitment as done',
    category: 'Dashboard',
    priority: 'P0',
    type: 'flow',
    description: 'User marks a commitment as completed',
    preconditions: ['Logged in', 'Has at least one pending commitment'],
    steps: [
      { action: 'count', target: 'Commitment cards', verify: 'Record initial count' },
      { action: 'click', target: 'First commitment "Mark Done" button', verify: 'Commitment disappears or shows done state' },
      { action: 'check_element', target: 'Stats banner', verify: 'Compliance rate updated' },
    ],
    expected: 'Commitment marked done, stats update',
  },

  {
    id: 'DASH-06',
    name: 'Draft reply for commitment',
    category: 'Dashboard',
    priority: 'P0',
    type: 'flow',
    description: 'AI drafts an email reply for a commitment',
    preconditions: ['Logged in', 'Has i_promised commitment with contact_email'],
    steps: [
      { action: 'click', target: 'Commitment card "Draft Reply" button (pen icon)', verify: 'Loading spinner appears' },
      { action: 'wait_for', target: 'Draft email modal', data: '10s timeout', verify: 'Modal opens with To, Subject, Body fields' },
      { action: 'check_text', target: 'Email body', verify: 'AI-generated content present, not empty' },
      { action: 'check_element', target: 'Send button', verify: 'Send button visible' },
      { action: 'click', target: 'Cancel/close modal', verify: 'Modal closes without sending' },
    ],
    expected: 'AI generates a contextual draft email in the modal',
  },

  {
    id: 'DASH-07',
    name: 'Send nudge for they_promised commitment',
    category: 'Dashboard',
    priority: 'P1',
    type: 'flow',
    description: 'Send a follow-up nudge to someone who promised something',
    preconditions: ['Logged in', 'Has they_promised commitment'],
    steps: [
      { action: 'click', target: '"They Promised" tab', verify: 'Filtered to they_promised' },
      { action: 'click', target: 'First commitment "Send Nudge" button', verify: 'Loading spinner' },
      { action: 'wait_for', target: 'Draft email modal', data: '10s', verify: 'Nudge email draft appears' },
      { action: 'check_text', target: 'Email body', verify: 'Contains polite follow-up language' },
    ],
    expected: 'Nudge email draft generated with appropriate tone',
  },

  {
    id: 'DASH-08',
    name: 'Performance metrics section',
    category: 'Dashboard',
    priority: 'P2',
    type: 'ui',
    description: 'Performance panel shows response time and completion sources',
    preconditions: ['Logged in', 'Has completed commitments'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'check_element', target: 'Performance section', verify: 'Shows Avg Response time' },
      { action: 'check_element', target: 'Web count', verify: 'Shows web completion count' },
      { action: 'check_element', target: 'WhatsApp count', verify: 'Shows WhatsApp completion count' },
    ],
    expected: 'Performance metrics visible if user has completed commitments',
  },

  // ═══════════════════════════════════════════
  // 3. INBOX
  // ═══════════════════════════════════════════

  {
    id: 'INBOX-01',
    name: 'Inbox loads emails',
    category: 'Inbox',
    priority: 'P0',
    type: 'ui',
    description: 'Inbox page shows synced emails from all sources',
    preconditions: ['Logged in', 'Has synced emails'],
    steps: [
      { action: 'navigate', target: '/dashboard/inbox', verify: 'Page loads' },
      { action: 'check_element', target: 'Email list', verify: 'At least one email visible' },
      { action: 'check_element', target: 'Email card', verify: 'Shows from name, subject, date' },
      { action: 'check_element', target: 'Source tabs (All/Email/WhatsApp)', verify: 'Filter tabs visible' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Inbox displays emails with proper metadata',
  },

  {
    id: 'INBOX-02',
    name: 'Email detail view',
    category: 'Inbox',
    priority: 'P1',
    type: 'flow',
    description: 'Click email to see full content',
    preconditions: ['Logged in', 'Has emails'],
    steps: [
      { action: 'navigate', target: '/dashboard/inbox', verify: 'Page loads' },
      { action: 'click', target: 'First email card', verify: 'Email detail panel opens' },
      { action: 'check_element', target: 'Email body', verify: 'Full email content visible' },
      { action: 'check_element', target: 'Reply button', verify: 'Reply action available' },
    ],
    expected: 'Email detail shows full content with reply option',
  },

  {
    id: 'INBOX-03',
    name: 'Chinese email encoding',
    category: 'Inbox',
    priority: 'P0',
    type: 'data',
    description: '163 emails display Chinese characters correctly (not garbled)',
    preconditions: ['Logged in', 'Has 163 emails with Chinese subjects'],
    steps: [
      { action: 'navigate', target: '/dashboard/inbox', verify: 'Page loads' },
      { action: 'check_text', target: 'Email subjects from 163', verify: 'Chinese characters render correctly, no mojibake (乱码)' },
    ],
    expected: 'All Chinese subjects readable, no encoding issues',
  },

  // ═══════════════════════════════════════════
  // 4. SETTINGS
  // ═══════════════════════════════════════════

  {
    id: 'SET-01',
    name: 'Settings page loads all sections',
    category: 'Settings',
    priority: 'P0',
    type: 'ui',
    description: 'Settings page renders all configuration sections',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/settings', verify: 'Page loads' },
      { action: 'check_element', target: 'Connected Accounts section', verify: 'Shows connected email accounts' },
      { action: 'check_element', target: 'WhatsApp section', verify: 'Shows WA connection status' },
      { action: 'check_element', target: 'Preferences section', verify: 'Assistant name, timezone, daily brief time' },
      { action: 'check_element', target: 'AI Model Configuration section', verify: 'LLM provider, model, API key fields' },
      { action: 'check_element', target: 'Daily Digest section', verify: 'Toggle and time picker' },
      { action: 'check_element', target: 'Privacy section', verify: 'Data retention, export' },
      { action: 'check_element', target: 'Danger Zone', verify: 'Delete account button' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'All 7 settings sections visible and interactive',
  },

  {
    id: 'SET-02',
    name: 'Connected accounts display',
    category: 'Settings',
    priority: 'P0',
    type: 'ui',
    description: 'Shows all connected email accounts with correct info',
    preconditions: ['Logged in', 'Has Gmail + 163 accounts'],
    steps: [
      { action: 'navigate', target: '/dashboard/settings', verify: 'Page loads' },
      { action: 'check_element', target: 'Account: sophie@actuaryhelp.com', verify: 'Gmail account visible' },
      { action: 'check_element', target: 'Account: nkliyonghu@163.com', verify: '163 IMAP account visible' },
      { action: 'check_element', target: 'Add Gmail / Add Outlook / Add 163 buttons', verify: 'All three add buttons visible' },
    ],
    expected: 'Both accounts shown with correct emails',
  },

  {
    id: 'SET-03',
    name: 'Add 163/IMAP account modal',
    category: 'Settings',
    priority: 'P1',
    type: 'flow',
    description: 'IMAP account add modal opens and validates',
    preconditions: ['Logged in'],
    steps: [
      { action: 'click', target: '"Add 163 / IMAP" button', verify: 'Modal opens' },
      { action: 'check_element', target: 'Email field', verify: 'Email input visible' },
      { action: 'check_element', target: 'Authorization Code field', verify: 'Password input with show/hide toggle' },
      { action: 'check_text', verify: 'Help text about IMAP authorization code' },
      { action: 'click', target: 'Connect button (empty fields)', verify: 'Button disabled or validation error' },
      { action: 'click', target: 'Cancel', verify: 'Modal closes' },
    ],
    expected: 'IMAP modal works with proper validation',
  },

  {
    id: 'SET-04',
    name: 'LLM configuration',
    category: 'Settings',
    priority: 'P1',
    type: 'flow',
    description: 'LLM settings section allows provider/model configuration',
    preconditions: ['Logged in'],
    steps: [
      { action: 'scroll_to', target: 'AI Model Configuration section', verify: 'Section visible' },
      { action: 'check_element', target: 'Provider dropdown', verify: 'Shows current provider (deepseek)' },
      { action: 'check_element', target: 'Model selector', verify: 'Shows current model' },
      { action: 'check_element', target: 'API Key input', verify: 'Key input with show/hide' },
      { action: 'check_element', target: 'Test Connection button', verify: 'Button visible' },
      { action: 'click', target: 'Test Connection', verify: 'Shows success or failure result' },
    ],
    expected: 'LLM config section functional with test connection',
  },

  {
    id: 'SET-05',
    name: 'Preferences auto-save',
    category: 'Settings',
    priority: 'P1',
    type: 'flow',
    description: 'Settings changes auto-save without submit button',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/settings', verify: 'Page loads' },
      { action: 'fill', target: 'Assistant name field', data: 'TestBot', verify: 'Name entered' },
      { action: 'wait_for', target: '"Saved" indicator', data: '3s', verify: 'Saved confirmation appears' },
      { action: 'reload_page', verify: 'Page reloads' },
      { action: 'check_value', target: 'Assistant name field', verify: 'Shows "TestBot"' },
    ],
    expected: 'Settings persist after page reload',
    cleanup: 'Restore assistant name to "Apple"',
  },

  // ═══════════════════════════════════════════
  // 5. CALENDAR & MEETINGS
  // ═══════════════════════════════════════════

  {
    id: 'CAL-01',
    name: 'Calendar page loads',
    category: 'Calendar',
    priority: 'P1',
    type: 'ui',
    description: 'Calendar page shows events',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/calendar', verify: 'Page loads' },
      { action: 'check_element', target: 'Calendar view', verify: 'Calendar grid or list visible' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Calendar renders without errors',
  },

  {
    id: 'CAL-02',
    name: 'Meetings page loads',
    category: 'Calendar',
    priority: 'P1',
    type: 'ui',
    description: 'Meetings page shows upcoming meetings',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/meetings', verify: 'Page loads' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Meetings page renders',
  },

  // ═══════════════════════════════════════════
  // 6. CONTACTS
  // ═══════════════════════════════════════════

  {
    id: 'CONT-01',
    name: 'Contacts page loads',
    category: 'Contacts',
    priority: 'P1',
    type: 'ui',
    description: 'Contacts page shows detected contacts',
    preconditions: ['Logged in', 'Has auto-detected contacts'],
    steps: [
      { action: 'navigate', target: '/dashboard/contacts', verify: 'Page loads' },
      { action: 'check_element', target: 'Contact list', verify: 'At least one contact visible' },
      { action: 'check_element', target: 'Contact card', verify: 'Shows name, email, relationship' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Contacts list rendered with auto-detected contacts',
  },

  {
    id: 'CONT-02',
    name: 'Contact detail page',
    category: 'Contacts',
    priority: 'P2',
    type: 'flow',
    description: 'Click contact to see full profile',
    preconditions: ['Logged in', 'Has contacts'],
    steps: [
      { action: 'navigate', target: '/dashboard/contacts', verify: 'Page loads' },
      { action: 'click', target: 'First contact card', verify: 'Navigates to detail page' },
      { action: 'check_element', target: 'Contact profile', verify: 'Name, email, relationship visible' },
      { action: 'check_element', target: 'Email history section', verify: 'Past emails with this contact' },
    ],
    expected: 'Contact detail shows profile and interaction history',
  },

  // ═══════════════════════════════════════════
  // 7. TRIPS
  // ═══════════════════════════════════════════

  {
    id: 'TRIP-01',
    name: 'Trips page loads',
    category: 'Trips',
    priority: 'P1',
    type: 'ui',
    description: 'Trips page shows detected or empty state',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/trips', verify: 'Page loads' },
      { action: 'check_element', target: 'Trip list or empty state', verify: 'Shows trips or "No trips" message' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Trips page renders without errors',
  },

  // ═══════════════════════════════════════════
  // 8. FAMILY CALENDAR
  // ═══════════════════════════════════════════

  {
    id: 'FAM-01',
    name: 'Family calendar loads',
    category: 'Family',
    priority: 'P1',
    type: 'ui',
    description: 'Family calendar shows events',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/family', verify: 'Page loads' },
      { action: 'check_element', target: 'Family events list or empty state', verify: 'Shows events or add prompt' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Family calendar renders',
  },

  {
    id: 'FAM-02',
    name: 'Family event with conflict detection',
    category: 'Family',
    priority: 'P1',
    type: 'data',
    description: 'Family event shows in briefing with conflict warning',
    preconditions: ['Logged in', 'Has family event on a day with work meeting'],
    steps: [
      { action: 'api_call', target: 'GET /api/family-calendar', verify: 'Returns family events' },
      { action: 'api_call', target: 'GET /api/briefing?refresh=1', verify: 'Briefing mentions family event' },
    ],
    expected: 'Briefing includes family event and warns about conflicts',
  },

  // ═══════════════════════════════════════════
  // 9. SYNC & PROCESS PIPELINE
  // ═══════════════════════════════════════════

  {
    id: 'SYNC-01',
    name: 'Manual sync triggers successfully',
    category: 'Sync',
    priority: 'P0',
    type: 'api',
    description: 'Clicking sync button fetches new emails',
    preconditions: ['Logged in', 'Has connected email account'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'click', target: 'Sync button (TopBar)', verify: 'Sync indicator shows' },
      { action: 'wait_for', target: 'Sync complete', data: '30s', verify: 'Sync indicator clears' },
      { action: 'api_call', target: 'POST /api/sync', verify: 'Returns 200 with email count' },
    ],
    expected: 'Sync completes without error, returns email count',
  },

  {
    id: 'SYNC-02',
    name: 'Process pipeline extracts data',
    category: 'Sync',
    priority: 'P0',
    type: 'api',
    description: 'Processing extracts tasks, commitments from emails',
    preconditions: ['Logged in', 'Has unprocessed emails'],
    steps: [
      { action: 'api_call', target: 'POST /api/sync/process', verify: 'Returns 200' },
      { action: 'check_response', verify: 'processed > 0 or remaining = 0' },
    ],
    expected: 'Process pipeline runs without 500 errors',
  },

  // ═══════════════════════════════════════════
  // 10. STREAMING SCAN (30s WOW MOMENT)
  // ═══════════════════════════════════════════

  {
    id: 'SCAN-01',
    name: 'Streaming scan endpoint works',
    category: 'Scan',
    priority: 'P0',
    type: 'api',
    description: 'SSE stream returns commitment events',
    preconditions: ['Logged in', 'Has emails'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments/scan-stream?hours=168', verify: 'Returns SSE stream' },
      { action: 'check_response', verify: 'Receives status event with total/filtered counts' },
      { action: 'check_response', verify: 'Receives commitment events (or done event if no new commitments)' },
      { action: 'check_response', verify: 'Stream ends with done event containing duration_ms' },
    ],
    expected: 'SSE stream delivers events correctly, ends cleanly',
  },

  // ═══════════════════════════════════════════
  // 11. COMMITMENT ACTIONS (API)
  // ═══════════════════════════════════════════

  {
    id: 'ACT-01',
    name: 'Mark commitment done via API',
    category: 'Actions',
    priority: 'P0',
    type: 'api',
    description: 'POST /api/commitments/actions with mark_done',
    preconditions: ['Has pending commitment'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments', verify: 'Get a commitment ID' },
      { action: 'api_call', target: 'POST /api/commitments/actions', data: '{ commitmentId, action: "mark_done" }', verify: 'Returns 200' },
      { action: 'api_call', target: 'GET /api/commitments/stats', verify: 'Stats updated' },
    ],
    expected: 'Commitment status changes to done, stats reflect change',
  },

  {
    id: 'ACT-02',
    name: 'Draft reply via API',
    category: 'Actions',
    priority: 'P0',
    type: 'api',
    description: 'POST /api/commitments/actions with draft_reply',
    preconditions: ['Has i_promised commitment with contact_email'],
    steps: [
      { action: 'api_call', target: 'POST /api/commitments/actions', data: '{ commitmentId, action: "draft_reply" }', verify: 'Returns 200 with to, subject, body' },
      { action: 'check_response', verify: 'body is non-empty AI-generated text' },
      { action: 'check_response', verify: 'to matches contact email' },
    ],
    expected: 'AI generates contextual reply draft',
  },

  {
    id: 'ACT-03',
    name: 'Send nudge via API',
    category: 'Actions',
    priority: 'P1',
    type: 'api',
    description: 'POST /api/commitments/actions with send_nudge',
    preconditions: ['Has they_promised commitment'],
    steps: [
      { action: 'api_call', target: 'POST /api/commitments/actions', data: '{ commitmentId, action: "send_nudge" }', verify: 'Returns 200 with draft' },
      { action: 'check_response', verify: 'Draft contains polite follow-up language' },
      { action: 'check_response', verify: 'Tone matches waiting duration (gentle/firm/urgent)' },
    ],
    expected: 'Nudge draft with appropriate escalation tone',
  },

  // ═══════════════════════════════════════════
  // 12. EMAIL SENDING
  // ═══════════════════════════════════════════

  {
    id: 'SEND-01',
    name: 'Send reply endpoint supports IMAP/SMTP',
    category: 'Email Send',
    priority: 'P0',
    type: 'api',
    description: 'POST /api/send-reply works for both Gmail and IMAP accounts',
    preconditions: ['Has IMAP account (163)'],
    steps: [
      { action: 'api_call', target: 'POST /api/send-reply', data: '{ to, subject, body, fromEmail: "nkliyonghu@163.com" }', verify: 'Returns 200 or sends email' },
    ],
    expected: 'Email sent via SMTP for IMAP accounts',
  },

  // ═══════════════════════════════════════════
  // 13. NAVIGATION & SIDEBAR
  // ═══════════════════════════════════════════

  {
    id: 'NAV-01',
    name: 'All sidebar navigation links work',
    category: 'Navigation',
    priority: 'P0',
    type: 'flow',
    description: 'Every sidebar link navigates to correct page without errors',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Loads' },
      { action: 'click', target: 'Sidebar: Inbox', verify: '/dashboard/inbox loads' },
      { action: 'click', target: 'Sidebar: Calendar', verify: '/dashboard/calendar loads' },
      { action: 'click', target: 'Sidebar: Contacts', verify: '/dashboard/contacts loads' },
      { action: 'click', target: 'Sidebar: Trips', verify: '/dashboard/trips loads' },
      { action: 'click', target: 'Sidebar: Meetings', verify: '/dashboard/meetings loads' },
      { action: 'click', target: 'Sidebar: Family', verify: '/dashboard/family loads' },
      { action: 'click', target: 'Sidebar: Tasks', verify: '/dashboard/tasks loads' },
      { action: 'click', target: 'Sidebar: Settings', verify: '/dashboard/settings loads' },
    ],
    expected: 'All 9 sidebar links navigate correctly, zero console errors',
  },

  // ═══════════════════════════════════════════
  // 14. API HEALTH CHECKS
  // ═══════════════════════════════════════════

  {
    id: 'API-01',
    name: 'All critical API endpoints respond',
    category: 'API Health',
    priority: 'P0',
    type: 'api',
    description: 'Every API returns 200 (or 401 for unauthed)',
    preconditions: ['Server running'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/commitments/stats', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/emails', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/settings', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/briefing', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/accounts', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/contacts', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/family-calendar', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/calendar/events', verify: '200 or 401' },
      { action: 'api_call', target: 'GET /api/alerts', verify: '200 or 401' },
    ],
    expected: 'No 500 errors on any endpoint',
  },

  {
    id: 'API-02',
    name: 'Streaming scan endpoint no crash',
    category: 'API Health',
    priority: 'P0',
    type: 'api',
    description: 'SSE endpoint handles gracefully even with no data',
    preconditions: ['Server running'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments/scan-stream?hours=1', verify: 'Returns SSE headers' },
      { action: 'check_response', verify: 'Receives done event (possibly with 0 commitments)' },
    ],
    expected: 'No crash, stream ends cleanly',
  },

  // ═══════════════════════════════════════════
  // 15. DATA INTEGRITY
  // ═══════════════════════════════════════════

  {
    id: 'DATA-01',
    name: 'Commitment stats match actual data',
    category: 'Data',
    priority: 'P0',
    type: 'data',
    description: 'Stats API numbers match actual commitment records',
    preconditions: ['Logged in'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments', verify: 'Get all commitments' },
      { action: 'api_call', target: 'GET /api/commitments/stats', verify: 'Get stats' },
      { action: 'compare', verify: 'needs_action count = i_promised with pending/in_progress/overdue status' },
      { action: 'compare', verify: 'waiting_on_them count = they_promised with pending/in_progress status' },
    ],
    expected: 'Stats perfectly match actual commitment records',
  },

  {
    id: 'DATA-02',
    name: 'No duplicate commitments from same email',
    category: 'Data',
    priority: 'P1',
    type: 'data',
    description: 'Processing an email twice does not create duplicate commitments',
    preconditions: ['Has processed emails'],
    steps: [
      { action: 'api_call', target: 'GET /api/commitments', verify: 'Get all' },
      { action: 'check_data', verify: 'No two commitments have same title + contact_email + source_email_id' },
    ],
    expected: 'Zero duplicate commitments',
  },

  {
    id: 'DATA-03',
    name: 'Email sync dedup across sources',
    category: 'Data',
    priority: 'P1',
    type: 'data',
    description: 'Same email from different sync runs is not duplicated',
    preconditions: ['Has synced emails'],
    steps: [
      { action: 'api_call', target: 'POST /api/sync', verify: 'Sync completes' },
      { action: 'api_call', target: 'POST /api/sync', verify: 'Second sync completes' },
      { action: 'check_data', verify: 'Email count did not increase from second sync (no new emails)' },
    ],
    expected: 'Duplicate sync does not create duplicate emails',
  },

  // ═══════════════════════════════════════════
  // 16. ERROR HANDLING
  // ═══════════════════════════════════════════

  {
    id: 'ERR-01',
    name: 'Invalid API requests return proper errors',
    category: 'Errors',
    priority: 'P1',
    type: 'api',
    description: 'Bad requests get 400/404, not 500',
    preconditions: ['Server running'],
    steps: [
      { action: 'api_call', target: 'POST /api/commitments/actions', data: '{}', verify: 'Returns 400, not 500' },
      { action: 'api_call', target: 'GET /api/emails/nonexistent-id', verify: 'Returns 404, not 500' },
      { action: 'api_call', target: 'POST /api/accounts/add-imap', data: '{}', verify: 'Returns 400 with message' },
    ],
    expected: 'Proper HTTP status codes, no uncaught 500s',
  },

  {
    id: 'ERR-02',
    name: 'Graceful handling of LLM API failure',
    category: 'Errors',
    priority: 'P1',
    type: 'api',
    description: 'If DeepSeek API is down, app shows error not crash',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'check_element', target: 'Briefing card', verify: 'Shows briefing or "error loading" state, NOT blank page crash' },
    ],
    expected: 'App degrades gracefully when LLM unavailable',
  },

  // ═══════════════════════════════════════════
  // 17. MOBILE RESPONSIVENESS
  // ═══════════════════════════════════════════

  {
    id: 'MOB-01',
    name: 'Dashboard responsive on mobile',
    category: 'Mobile',
    priority: 'P1',
    type: 'ui',
    description: 'Dashboard works on 375px (iPhone) viewport',
    preconditions: ['Logged in'],
    steps: [
      { action: 'set_viewport', data: '375x812', verify: 'Viewport set' },
      { action: 'navigate', target: '/dashboard', verify: 'Page loads' },
      { action: 'check_element', target: 'Stats cards', verify: 'Cards stack vertically, not overflow' },
      { action: 'check_element', target: 'Sidebar', verify: 'Sidebar hidden or hamburger menu' },
      { action: 'check_element', target: 'Commitment cards', verify: 'Cards fit screen width' },
      { action: 'set_viewport', data: '1280x720', verify: 'Restore desktop' },
    ],
    expected: 'Dashboard usable on mobile without horizontal scroll',
  },

  {
    id: 'MOB-02',
    name: 'Landing page responsive on mobile',
    category: 'Mobile',
    priority: 'P1',
    type: 'ui',
    description: 'Landing page works on mobile',
    preconditions: [],
    steps: [
      { action: 'set_viewport', data: '375x812', verify: 'Viewport set' },
      { action: 'navigate', target: '/', verify: 'Page loads' },
      { action: 'check_element', target: 'Hero text', verify: 'Readable, not overflowing' },
      { action: 'check_element', target: 'CTA button', verify: 'Full width, tappable' },
      { action: 'set_viewport', data: '1280x720', verify: 'Restore desktop' },
    ],
    expected: 'Landing page fully usable on mobile',
  },

  // ═══════════════════════════════════════════
  // 18. ONBOARDING FLOW
  // ═══════════════════════════════════════════

  {
    id: 'ONBD-01',
    name: 'Onboarding page renders',
    category: 'Onboarding',
    priority: 'P0',
    type: 'ui',
    description: 'Onboarding 3-step flow renders correctly',
    preconditions: ['Logged in', 'Onboarding not completed (new user)'],
    steps: [
      { action: 'navigate', target: '/onboarding', verify: 'Page loads' },
      { action: 'check_element', target: 'Step indicators', verify: 'Shows 3 steps' },
      { action: 'check_element', target: 'Channel connection options', verify: 'Shows email/WhatsApp options' },
      { action: 'check_console', verify: 'No errors' },
    ],
    expected: 'Onboarding flow renders with step 1 active',
  },

  // ═══════════════════════════════════════════
  // 19. CROSS-FEATURE FLOWS
  // ═══════════════════════════════════════════

  {
    id: 'FLOW-01',
    name: 'Email → Commitment → Action full loop',
    category: 'Integration',
    priority: 'P0',
    type: 'flow',
    description: 'Complete flow: seed email → process → commitment appears → draft reply',
    preconditions: ['Logged in', 'Has email account'],
    steps: [
      { action: 'seed_data', data: 'Insert test email with clear commitment', verify: 'Email in DB' },
      { action: 'api_call', target: 'POST /api/sync/process', verify: 'Process completes' },
      { action: 'navigate', target: '/dashboard', verify: 'Dashboard loads' },
      { action: 'check_element', target: 'New commitment card', verify: 'Commitment from test email appears' },
      { action: 'click', target: '"Draft Reply" on new commitment', verify: 'Draft modal opens' },
      { action: 'check_text', target: 'Draft body', verify: 'AI draft references the commitment context' },
    ],
    expected: 'Complete email → commitment → action flow works end to end',
  },

  {
    id: 'FLOW-02',
    name: 'Sync → Inbox → Detail → Reply flow',
    category: 'Integration',
    priority: 'P0',
    type: 'flow',
    description: 'Sync emails, view in inbox, open detail, draft reply',
    preconditions: ['Logged in', 'Has email account with emails'],
    steps: [
      { action: 'api_call', target: 'POST /api/sync', verify: 'Sync completes with email count > 0' },
      { action: 'navigate', target: '/dashboard/inbox', verify: 'Inbox loads with emails' },
      { action: 'click', target: 'First email', verify: 'Detail panel opens' },
      { action: 'check_element', target: 'Email body', verify: 'Body content visible' },
    ],
    expected: 'Full inbox flow works without errors',
  },

  {
    id: 'FLOW-03',
    name: 'Settings change reflects in briefing',
    category: 'Integration',
    priority: 'P2',
    type: 'flow',
    description: 'Changing timezone in settings affects briefing content',
    preconditions: ['Logged in'],
    steps: [
      { action: 'navigate', target: '/dashboard/settings', verify: 'Page loads' },
      { action: 'select', target: 'Timezone dropdown', data: 'Asia/Singapore', verify: 'Timezone selected' },
      { action: 'wait_for', target: '"Saved" indicator', data: '3s', verify: 'Saved' },
      { action: 'navigate', target: '/dashboard', verify: 'Dashboard loads' },
      { action: 'api_call', target: 'GET /api/briefing?refresh=1', verify: 'Briefing regenerates' },
    ],
    expected: 'Briefing reflects updated timezone',
  },
]

// ─────────────────────────────────────────────
// Summary stats
// ─────────────────────────────────────────────

export function getTestSummary() {
  const total = TEST_CASES.length
  const byCategory: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byType: Record<string, number> = {}

  for (const tc of TEST_CASES) {
    byCategory[tc.category] = (byCategory[tc.category] || 0) + 1
    byPriority[tc.priority] = (byPriority[tc.priority] || 0) + 1
    byType[tc.type] = (byType[tc.type] || 0) + 1
  }

  return { total, byCategory, byPriority, byType }
}

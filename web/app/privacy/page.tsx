'use client'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 31, 2026</p>

      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
          <p>Sophia is an AI-powered productivity assistant operated by ActuaryHelp Pte Ltd, Singapore. Contact: privacy@actuaryhelp.com</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b"><th className="text-left py-2">Data Category</th><th className="text-left py-2">Source</th><th className="text-left py-2">Purpose</th></tr></thead>
            <tbody>
              <tr className="border-b"><td className="py-2">Email metadata & content</td><td>Gmail, Outlook, IMAP</td><td>Commitment extraction, reply drafting</td></tr>
              <tr className="border-b"><td className="py-2">Calendar events</td><td>Google Calendar, Outlook</td><td>Schedule management, conflict detection</td></tr>
              <tr className="border-b"><td className="py-2">WhatsApp messages</td><td>Your self-chat only</td><td>AI assistant interaction</td></tr>
              <tr className="border-b"><td className="py-2">Contact information</td><td>Email headers</td><td>Relationship tracking</td></tr>
              <tr className="border-b"><td className="py-2">Family schedule</td><td>Manual input</td><td>Work-life conflict detection</td></tr>
              <tr className="border-b"><td className="py-2">Trip & expense data</td><td>Email detection + manual</td><td>Travel management</td></tr>
              <tr className="border-b"><td className="py-2">Account information</td><td>Registration</td><td>Authentication</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. How We Process Your Data</h2>
          <p>Your data is processed by AI to extract commitments, draft replies, detect conflicts, and provide proactive advice. <strong>AI processing is performed by third-party providers:</strong></p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Default:</strong> DeepSeek (servers in China) — your email content and messages are sent to DeepSeek&apos;s API for AI analysis</li>
            <li><strong>Alternative:</strong> You can configure your own AI provider (OpenAI, Claude, Groq, etc.) in Settings</li>
          </ul>
          <p className="mt-2 text-red-700 font-medium">By using the default AI provider, you consent to your data being processed on servers in China.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Data Storage</h2>
          <p>Your data is stored in Supabase (Sydney, Australia). Data is encrypted in transit (TLS) and sensitive credentials (API keys, OAuth tokens) are encrypted at rest using AES-256-GCM.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
          <p>You can configure your data retention period in Settings (30-365 days, default 90 days). Data older than your retention period is automatically deleted.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <p>Under the Singapore Personal Data Protection Act (PDPA) and EU General Data Protection Regulation (GDPR), you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access:</strong> Export all your data (Settings → Export JSON)</li>
            <li><strong>Correction:</strong> Edit your profile and commitments in the app</li>
            <li><strong>Deletion:</strong> Delete your account and all data (Settings → Delete Account)</li>
            <li><strong>Portability:</strong> Download your data in JSON format</li>
            <li><strong>Objection:</strong> Contact us to opt out of AI processing</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Third-Party Email Data</h2>
          <p>When Sophia scans your inbox, it processes emails from third parties who have not directly consented to AI analysis. This processing is based on our legitimate interest in providing you with commitment tracking services. You can exclude specific contacts from AI scanning in Settings.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. WhatsApp Integration</h2>
          <p><strong>Important:</strong> Sophia&apos;s WhatsApp integration uses an unofficial connection method (not Meta Business API). This may violate WhatsApp&apos;s Terms of Service. Your WhatsApp account could be temporarily or permanently restricted by Meta. We are not responsible for any account restrictions resulting from this integration.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Cookies</h2>
          <p>We use essential cookies for authentication (Supabase session). No analytics or tracking cookies are used.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Data Breach</h2>
          <p>In the event of a data breach, we will notify the Singapore PDPC within 3 calendar days and affected users without undue delay.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
          <p>For privacy inquiries: privacy@actuaryhelp.com</p>
          <p>For PDPA complaints: <a href="https://www.pdpc.gov.sg" className="text-primary underline" target="_blank" rel="noopener noreferrer">www.pdpc.gov.sg</a></p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">12. Changes</h2>
          <p>We will notify you of material changes to this policy via email or in-app notification.</p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t text-sm text-gray-400">
        <a href="/" className="hover:underline">← Back to Sophia</a>
      </div>
    </div>
  )
}

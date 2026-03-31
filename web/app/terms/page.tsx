'use client'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 31, 2026</p>

      <div className="prose prose-sm max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Service Description</h2>
          <p>Sophia is an AI-powered productivity assistant that helps you manage emails, calendar, commitments, contacts, travel, and family schedules. Sophia uses artificial intelligence to analyze your data and provide recommendations.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. AI Processing</h2>
          <p>By using Sophia, you acknowledge that:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your emails, calendar events, and messages are processed by third-party AI providers</li>
            <li>The default AI provider is DeepSeek (China). You can change this in Settings</li>
            <li>AI-generated content (reply drafts, commitment extraction, recommendations) may contain errors</li>
            <li>You are responsible for reviewing all AI-drafted content before sending</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. WhatsApp Integration</h2>
          <p><strong>Risk Acknowledgment:</strong> Sophia&apos;s WhatsApp integration uses an unofficial, community-developed connection method. By connecting WhatsApp, you acknowledge:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>This may violate WhatsApp&apos;s Terms of Service</li>
            <li>Meta may temporarily or permanently restrict your WhatsApp account</li>
            <li>We cannot guarantee uninterrupted WhatsApp service</li>
            <li>We are not liable for any WhatsApp account restrictions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Your Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Review all AI-drafted emails before sending</li>
            <li>Ensure the accuracy of commitments and deadlines</li>
            <li>Maintain the security of your account credentials</li>
            <li>Comply with applicable laws when using Sophia for business communications</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
          <p>Sophia is provided &quot;as is&quot; without warranty. We are not liable for:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Missed commitments or deadlines due to AI extraction errors</li>
            <li>Incorrect AI-generated content sent on your behalf</li>
            <li>WhatsApp account restrictions due to unofficial integration</li>
            <li>Data loss due to service interruptions</li>
            <li>Business decisions made based on Sophia&apos;s recommendations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Data and Privacy</h2>
          <p>See our <a href="/privacy" className="text-primary underline">Privacy Policy</a> for details on data collection, processing, and your rights.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Account Termination</h2>
          <p>You can delete your account at any time (Settings → Delete Account). All your data will be permanently deleted. We may suspend accounts that violate these terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Governing Law</h2>
          <p>These terms are governed by the laws of Singapore. Disputes will be resolved in the courts of Singapore.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
          <p>Questions about these terms: legal@actuaryhelp.com</p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t text-sm text-gray-400">
        <a href="/" className="hover:underline">← Back to Sophia</a>
      </div>
    </div>
  )
}

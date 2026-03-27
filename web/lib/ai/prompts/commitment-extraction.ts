/**
 * AI prompt for extracting commitments from OUTBOUND emails and messages.
 * Scans what the user promised to do, and what they're waiting for others to do.
 */

export const COMMITMENT_EXTRACTION_SYSTEM = `You are an AI assistant that extracts commitments from outbound messages (emails and WhatsApp messages sent BY the user).

Analyze the sent message and identify two types of commitments:

1. **i_promised**: Things the user committed to do for someone else.
   - Patterns: "I'll", "I will", "Let me", "I can", "Will do", "Sure", "I'll get back to you", "好的我来", "我这边处理", "收到马上办"

2. **waiting_on_them**: Things the user asked someone else to do.
   - Patterns: "Could you", "Please send", "Can you", "Let me know", "Looking forward to", "请你", "麻烦帮忙", "什么时候能"

For each commitment found, provide:
- type: "i_promised" | "waiting_on_them"
- title: Concise description (verb-first, e.g., "Send pitch deck to David")
- due_date: ISO date if a deadline is mentioned or implied, null otherwise
- due_reason: Why this date
- confidence: 0.0-1.0

Rules:
- Only extract genuine commitments, not pleasantries
- "Thanks" / "Got it" / "OK" alone are NOT commitments
- Be conservative: confidence < 0.5 will be filtered out
- Detect language automatically (English/Chinese/mixed)

Respond in JSON:
{
  "commitments": [...],
  "summary": "One sentence summary of what was promised/requested"
}`

export const COMMITMENT_EXTRACTION_USER = (message: {
  to: string
  subject: string
  body: string
  date: string
  channel: 'email' | 'whatsapp'
}) => `Channel: ${message.channel}
To: ${message.to}
Subject: ${message.subject}
Date: ${message.date}

${message.body.slice(0, 3000)}`

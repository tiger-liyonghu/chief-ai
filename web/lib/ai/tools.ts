/**
 * OpenAI-compatible function/tool definitions for Chief AI.
 *
 * These replace the text-based [ACTION:] parsing with proper function calling.
 * Providers that support tools (OpenAI, DeepSeek, Groq, Claude) use these
 * natively. For providers without tool support (some Ollama models), the chat
 * route falls back to text-based action parsing.
 */

import type OpenAI from 'openai'

export type ChiefTool = OpenAI.Chat.Completions.ChatCompletionTool

export const CHIEF_TOOLS: ChiefTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task for the user',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title (start with a verb)',
          },
          priority: {
            type: 'number',
            enum: [1, 2, 3],
            description: '1=urgent, 2=this week, 3=later',
          },
          due_date: {
            type: 'string',
            description: 'ISO date string if known (e.g. 2026-04-01)',
          },
          due_reason: {
            type: 'string',
            description: 'Why this due date was chosen',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: 'Mark a task as done',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title (or partial match) to complete',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_reply',
      description: 'Draft an email reply for the user to review before sending',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body text' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'forward_email',
      description: 'Forward an email to someone (needs user confirmation)',
      parameters: {
        type: 'object',
        properties: {
          subject_match: {
            type: 'string',
            description: 'Keywords to find the email to forward',
          },
          to: { type: 'string', description: 'Recipient email address' },
          note: {
            type: 'string',
            description: 'Optional note to include when forwarding',
          },
        },
        required: ['subject_match', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search across emails, tasks, and events',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Create a calendar event and optionally invite attendees',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: {
            type: 'string',
            description: 'ISO datetime (e.g. 2026-04-01T14:00:00)',
          },
          end_time: {
            type: 'string',
            description: 'ISO datetime (e.g. 2026-04-01T15:00:00)',
          },
          attendee_emails: {
            type: 'array',
            items: { type: 'string' },
            description: 'Email addresses to invite',
          },
          location: { type: 'string' },
          description: { type: 'string' },
          create_meet_link: {
            type: 'boolean',
            description: 'Whether to generate a Google Meet link',
          },
        },
        required: ['title', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_place',
      description:
        'Recommend nearby restaurants/cafes in Singapore for a meal type',
      parameters: {
        type: 'object',
        properties: {
          area: {
            type: 'string',
            description:
              'Singapore area (e.g. Raffles Place, Marina Bay, Orchard)',
          },
          type: {
            type: 'string',
            enum: [
              'breakfast',
              'morning_break',
              'lunch',
              'afternoon_break',
              'dinner',
              'late_night',
            ],
            description: 'Meal type',
          },
          business_meal: {
            type: 'boolean',
            description: 'Whether this is for a business meeting',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_expense',
      description: 'Log a travel or business expense',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['flight', 'hotel', 'transport', 'meal', 'other'],
            description: 'Expense category',
          },
          merchant_name: {
            type: 'string',
            description: 'Name of merchant or vendor',
          },
          amount: { type: 'number', description: 'Amount spent' },
          currency: {
            type: 'string',
            description: 'Currency code (e.g. SGD, USD, JPY)',
          },
          expense_date: {
            type: 'string',
            description: 'Date of expense (YYYY-MM-DD)',
          },
          notes: { type: 'string', description: 'Optional notes' },
        },
        required: ['category', 'merchant_name', 'amount', 'currency', 'expense_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_relationships',
      description:
        'Check relationship health — which contacts are going cold, who needs attention',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_debrief',
      description:
        'Run a structured retrospective/review for a time period',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['week', 'month'],
            description: 'Time period to review (default: week)',
          },
        },
        required: [],
      },
    },
  },
]

/**
 * Map from tool function names to the legacy ACTION type names used in
 * executeActions(). This lets us reuse the existing action execution logic.
 */
export const TOOL_TO_ACTION_TYPE: Record<string, string> = {
  create_task: 'CREATE_TASK',
  complete_task: 'COMPLETE_TASK',
  draft_reply: 'DRAFT_REPLY',
  forward_email: 'FORWARD_EMAIL',
  search: 'SEARCH',
  create_event: 'CREATE_EVENT',
  recommend_place: 'RECOMMEND_PLACE',
  create_expense: 'CREATE_EXPENSE',
  query_relationships: 'QUERY_RELATIONSHIPS',
  run_debrief: 'RUN_DEBRIEF',
}

/**
 * Providers known to support OpenAI-compatible function calling.
 */
const TOOL_CAPABLE_PROVIDERS = new Set([
  'deepseek',
  'openai',
  'claude',
  'groq',
])

/**
 * Check whether a provider supports function calling.
 * Ollama and unknown/custom providers fall back to text-based action parsing.
 */
export function supportsTools(provider: string): boolean {
  return TOOL_CAPABLE_PROVIDERS.has(provider)
}

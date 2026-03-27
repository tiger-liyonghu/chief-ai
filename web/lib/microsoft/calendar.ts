/**
 * Microsoft Graph API — Calendar operations.
 */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

interface GraphEvent {
  id: string
  subject: string
  bodyPreview: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location: { displayName: string } | null
  attendees: Array<{
    emailAddress: { name: string; address: string }
    status: { response: string }
  }>
  onlineMeeting: { joinUrl: string } | null
  isRecurrence: boolean
}

/**
 * List calendar events within a date range.
 */
export async function listEvents(
  accessToken: string,
  startDate?: string,
  endDate?: string,
): Promise<GraphEvent[]> {
  const now = new Date()
  const start = startDate || new Date(now.getTime() - 14 * 86400000).toISOString()
  const end = endDate || new Date(now.getTime() + 14 * 86400000).toISOString()

  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $top: '100',
    $select: 'id,subject,bodyPreview,start,end,location,attendees,onlineMeeting,isRecurrence',
    $orderby: 'start/dateTime',
  })

  const res = await fetch(`${GRAPH_BASE}/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph listEvents failed: ${res.status} ${err?.error?.message || ''}`)
  }

  const data = await res.json()
  return data.value || []
}

/**
 * Parse a Graph event into our common calendar event format.
 */
export function parseGraphEvent(event: GraphEvent) {
  return {
    googleEventId: event.id, // reusing field name for compatibility
    title: event.subject || '(no title)',
    description: event.bodyPreview || null,
    startTime: event.start.dateTime.endsWith('Z') ? event.start.dateTime : event.start.dateTime + 'Z',
    endTime: event.end.dateTime.endsWith('Z') ? event.end.dateTime : event.end.dateTime + 'Z',
    location: event.location?.displayName || null,
    meetingLink: event.onlineMeeting?.joinUrl || null,
    attendees: (event.attendees || []).map(a => ({
      email: a.emailAddress.address,
      name: a.emailAddress.name,
      responseStatus: a.status.response,
    })),
    isRecurring: event.isRecurrence || false,
  }
}

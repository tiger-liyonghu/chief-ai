import { google } from 'googleapis'
import { getOAuth2Client } from './auth'

function getCalendarClient(accessToken: string) {
  const auth = getOAuth2Client()
  auth.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth })
}

export async function listEvents(accessToken: string, timeMin?: string, timeMax?: string) {
  const cal = getCalendarClient(accessToken)
  const now = new Date()
  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin: timeMin || now.toISOString(),
    timeMax: timeMax || new Date(now.getTime() + 14 * 86400000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })
  return res.data.items || []
}

export async function getEvent(accessToken: string, eventId: string) {
  const cal = getCalendarClient(accessToken)
  const res = await cal.events.get({
    calendarId: 'primary',
    eventId,
  })
  return res.data
}

// ─── Event creation / mutation ──────────────────────────────────────────────

interface CreateEventParams {
  title: string
  description?: string
  startTime: string      // ISO 8601
  endTime: string        // ISO 8601
  location?: string
  attendeeEmails?: string[]
  createMeetLink?: boolean
  timeZone?: string
}

export async function createEvent(accessToken: string, params: CreateEventParams) {
  const cal = getCalendarClient(accessToken)
  const tz = params.timeZone || 'Asia/Singapore'

  const requestBody: any = {
    summary: params.title,
    description: params.description || undefined,
    start: { dateTime: params.startTime, timeZone: tz },
    end: { dateTime: params.endTime, timeZone: tz },
    location: params.location || undefined,
  }

  if (params.attendeeEmails && params.attendeeEmails.length > 0) {
    requestBody.attendees = params.attendeeEmails.map(email => ({ email }))
  }

  if (params.createMeetLink) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `chief-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  const res = await cal.events.insert({
    calendarId: 'primary',
    requestBody,
    sendUpdates: 'all',
    conferenceDataVersion: params.createMeetLink ? 1 : 0,
  })

  return res.data
}

interface UpdateEventParams {
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  location?: string
  attendeeEmails?: string[]
  timeZone?: string
}

export async function updateEvent(accessToken: string, eventId: string, params: UpdateEventParams) {
  const cal = getCalendarClient(accessToken)
  const tz = params.timeZone || 'Asia/Singapore'

  const requestBody: any = {}
  if (params.title !== undefined) requestBody.summary = params.title
  if (params.description !== undefined) requestBody.description = params.description
  if (params.location !== undefined) requestBody.location = params.location
  if (params.startTime) requestBody.start = { dateTime: params.startTime, timeZone: tz }
  if (params.endTime) requestBody.end = { dateTime: params.endTime, timeZone: tz }
  if (params.attendeeEmails) {
    requestBody.attendees = params.attendeeEmails.map(email => ({ email }))
  }

  const res = await cal.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody,
    sendUpdates: 'all',
  })

  return res.data
}

export async function deleteEvent(accessToken: string, eventId: string) {
  const cal = getCalendarClient(accessToken)
  await cal.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  })
}

export async function respondToEvent(
  accessToken: string,
  eventId: string,
  response: 'accepted' | 'declined' | 'tentative',
  userEmail: string
) {
  const cal = getCalendarClient(accessToken)

  // Fetch current event to get existing attendees
  const event = await cal.events.get({ calendarId: 'primary', eventId })
  const attendees = (event.data.attendees || []).map(a => {
    if (a.email === userEmail) {
      return { ...a, responseStatus: response }
    }
    return a
  })

  const res = await cal.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: { attendees },
    sendUpdates: 'all',
  })

  return res.data
}

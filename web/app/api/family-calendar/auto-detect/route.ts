import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/family-calendar/auto-detect
 * Scans calendar_events for family-related events and inserts them
 * into family_calendar with source='google_calendar'.
 * Deduplicates by google_event_id.
 */

// Calendar names that indicate family/personal calendars
const FAMILY_CALENDAR_NAMES = [
  'family', 'personal', 'home', '家庭', '个人', '家人',
]

// Keywords in event titles that indicate family events, grouped by event_type
const KEYWORD_MAP: Record<string, { type: string; keywords: string[] }> = {
  important_date: {
    type: 'important_date',
    keywords: [
      'birthday', 'anniversary', 'wedding', '生日', '纪念日', '结婚',
      '婚礼', '周年',
    ],
  },
  hard_constraint: {
    type: 'hard_constraint',
    keywords: [
      'pickup', 'pick up', 'drop off', 'dropoff', '接送', '接孩子', '送孩子',
      'piano', 'ballet', 'swim', 'tutor', '钢琴课', '芭蕾', '游泳课', '补习',
      '课外班', '兴趣班', 'lesson', 'class', '培训',
    ],
  },
  school_cycle: {
    type: 'school_cycle',
    keywords: [
      'school', 'exam', 'semester', 'holiday', 'vacation', 'spring break',
      'summer break', '学校', '考试', '学期', '假期', '寒假', '暑假',
      '开学', '家长会', 'parent-teacher', 'pta', 'report card',
    ],
  },
  family_commitment: {
    type: 'family_commitment',
    keywords: [
      'kids', 'children', 'family', 'doctor', 'dentist', 'pediatric',
      '孩子', '儿童', '家庭', '看医生', '牙医', '儿科',
      '动物园', 'zoo', 'playground', '游乐场', 'outing', '出游',
      'dinner with family', '全家', '家人',
    ],
  },
}

function isFamilyCalendar(calendarName: string | null): boolean {
  if (!calendarName) return false
  const lower = calendarName.toLowerCase()
  return FAMILY_CALENDAR_NAMES.some(name => lower.includes(name))
}

function detectEventType(title: string): { type: string; matched: string } | null {
  const lower = (title || '').toLowerCase()

  // Check each category in priority order
  for (const [, config] of Object.entries(KEYWORD_MAP)) {
    for (const kw of config.keywords) {
      if (lower.includes(kw)) {
        return { type: config.type, matched: kw }
      }
    }
  }
  return null
}

function extractFamilyMember(title: string): string | null {
  // Simple heuristic: look for common name patterns
  // e.g. "Emily钢琴课", "Pick up Emily", "Emily's birthday"
  const patterns = [
    /(\w+)['']s\s+(birthday|lesson|class|pickup|drop)/i,
    /pick\s*up\s+(\w+)/i,
    /drop\s*off?\s+(\w+)/i,
    /([\u4e00-\u9fff]+)(钢琴|芭蕾|游泳|补习|生日|课)/,
    /(\w+)\s+(piano|ballet|swim|tutor|birthday|lesson)/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch calendar events for the user (last 90 days + future)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 90)

    const { data: calendarEvents, error: calErr } = await admin
      .from('calendar_events')
      .select('id, title, start_time, end_time, calendar_name, google_event_id, attendees, location, recurrence')
      .eq('user_id', user.id)
      .gte('start_time', pastDate.toISOString())
      .order('start_time', { ascending: true })
      .limit(500)

    if (calErr) {
      console.error('Failed to fetch calendar events:', calErr)
      return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
    }

    if (!calendarEvents || calendarEvents.length === 0) {
      return NextResponse.json({ detected: 0, skipped_duplicates: 0 })
    }

    // Fetch existing google_event_ids in family_calendar for dedup
    const { data: existingEntries } = await admin
      .from('family_calendar')
      .select('google_event_id')
      .eq('user_id', user.id)
      .eq('source', 'google_calendar')
      .not('google_event_id', 'is', null)

    const existingGoogleIds = new Set(
      (existingEntries || []).map(e => e.google_event_id).filter(Boolean)
    )

    let detected = 0
    let skippedDuplicates = 0

    for (const event of calendarEvents) {
      const isFromFamilyCal = isFamilyCalendar(event.calendar_name)
      const detection = detectEventType(event.title)

      // Must match either family calendar name OR family keyword in title
      if (!isFromFamilyCal && !detection) continue

      // Dedup by google_event_id
      if (event.google_event_id && existingGoogleIds.has(event.google_event_id)) {
        skippedDuplicates++
        continue
      }

      const eventType = detection?.type || 'family_commitment'
      const familyMember = extractFamilyMember(event.title)

      // Parse start/end dates and times from the ISO datetime
      const startDt = new Date(event.start_time)
      const endDt = event.end_time ? new Date(event.end_time) : null

      const startDate = startDt.toISOString().slice(0, 10)
      const endDate = endDt ? endDt.toISOString().slice(0, 10) : null
      const startTime = startDt.toTimeString().slice(0, 5) // HH:MM
      const endTime = endDt ? endDt.toTimeString().slice(0, 5) : null

      // Detect recurrence from Google Calendar recurrence rules
      let recurrence = 'none'
      let recurrenceDay: number | null = null
      if (event.recurrence) {
        const rrule = Array.isArray(event.recurrence) ? event.recurrence.join(' ') : String(event.recurrence)
        if (rrule.includes('WEEKLY')) {
          recurrence = 'weekly'
          recurrenceDay = startDt.getDay()
        } else if (rrule.includes('DAILY')) {
          recurrence = 'daily'
        } else if (rrule.includes('MONTHLY')) {
          recurrence = 'monthly'
        } else if (rrule.includes('YEARLY')) {
          recurrence = 'yearly'
        }
      }

      const { error: insertErr } = await admin
        .from('family_calendar')
        .insert({
          user_id: user.id,
          event_type: eventType,
          title: event.title,
          description: detection ? `Auto-detected: matched keyword "${detection.matched}"${isFromFamilyCal ? `, from calendar "${event.calendar_name}"` : ''}` : `Auto-detected: from calendar "${event.calendar_name}"`,
          start_date: startDate,
          end_date: endDate,
          start_time: startTime,
          end_time: endTime,
          recurrence,
          recurrence_day: recurrenceDay,
          family_member: familyMember,
          source: 'google_calendar',
          google_event_id: event.google_event_id || null,
          google_calendar_id: event.calendar_name || null,
          remind_days_before: eventType === 'important_date' ? 3 : 1,
        })

      if (insertErr) {
        console.error('Failed to insert family event:', event.title, insertErr)
        continue
      }

      // Track for dedup within this batch
      if (event.google_event_id) {
        existingGoogleIds.add(event.google_event_id)
      }

      detected++
    }

    return NextResponse.json({
      detected,
      skipped_duplicates: skippedDuplicates,
      total_scanned: calendarEvents.length,
    })
  } catch (error: any) {
    console.error('Family calendar auto-detect error:', error)
    return NextResponse.json({ error: error.message || 'Auto-detect failed' }, { status: 500 })
  }
}

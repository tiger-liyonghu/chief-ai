/**
 * Browser Notification utilities for Chief of Staff.
 * Uses the Web Notifications API for departure reminders and overdue email alerts.
 */

export function requestNotificationPermission(): void {
  if (typeof window === 'undefined') return
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function canSendNotifications(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && Notification.permission === 'granted'
}

export function sendNotification(
  title: string,
  body: string,
  options?: {
    url?: string
    tag?: string
    icon?: string
  }
): void {
  if (!canSendNotifications()) return

  try {
    const n = new Notification(title, {
      body,
      icon: options?.icon || '/icon-192.png',
      tag: options?.tag, // prevents duplicate notifications with same tag
      silent: false,
    })

    if (options?.url) {
      n.onclick = () => {
        window.focus()
        window.open(options.url, '_self')
        n.close()
      }
    }
  } catch {
    // Safari on iOS doesn't support the Notification constructor
    // Fail silently
  }
}

/**
 * Send a departure reminder notification.
 * Uses a tag to prevent duplicate notifications for the same event.
 */
export function sendDepartureNotification(
  eventTitle: string,
  minutesUntilDepart: number,
  departBy: string
): void {
  const title =
    minutesUntilDepart <= 0
      ? 'Time to leave now!'
      : `Leave in ${minutesUntilDepart} min`
  const body = `${eventTitle} — depart by ${departBy}`

  sendNotification(title, body, {
    tag: `departure-${eventTitle}`,
    url: '/dashboard',
  })
}

/**
 * Send an overdue email alert notification.
 */
export function sendOverdueEmailNotification(count: number): void {
  if (count <= 0) return

  sendNotification('Overdue emails need attention', `You have ${count} email${count > 1 ? 's' : ''} waiting > 24 hours for a reply.`, {
    tag: 'overdue-emails',
    url: '/dashboard',
  })
}

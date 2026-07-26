export const NOTIFICATION_CATEGORIES = {
  NEW_EVENT: {
    id: "new_event",
    title: "New Event",
    description: "A new event has been created",
    deepLink: "events",
  },
  EVENT_REMINDER: {
    id: "event_reminder",
    title: "Event Reminder",
    description: "Reminder for an upcoming event",
    deepLink: "events",
  },
  ANNOUNCEMENT: {
    id: "announcement",
    title: "Announcement",
    description: "General announcement from MT Club",
    deepLink: "home",
  },
  ATTENDANCE_REMINDER: {
    id: "attendance_reminder",
    title: "Attendance Reminder",
    description: "Reminder to mark your attendance",
    deepLink: "attendance",
  },
  ACHIEVEMENT: {
    id: "achievement",
    title: "Achievement Unlocked",
    description: "You've earned a new achievement",
    deepLink: "achievements",
  },
  GENERAL_NEWS: {
    id: "general_news",
    title: "News",
    description: "General news from MT Club",
    deepLink: "home",
  },
};

export function buildNotificationPayload(category, data = {}) {
  const cat = NOTIFICATION_CATEGORIES[category.toUpperCase()];
  if (!cat) return null;

  return {
    title: cat.title,
    body: data.body || cat.description,
    category: cat.id,
    data: {
      screen: data.screen || cat.deepLink,
      id: data.id || null,
      category: cat.id,
      ...data,
    },
  };
}

import { CalendarX, ImageOff, Users, Search, Inbox, FileText } from "lucide-react";

const ICONS = {
  events: CalendarX,
  gallery: ImageOff,
  team: Users,
  search: Search,
  default: Inbox,
  attendance: FileText,
};

export default function EmptyState({
  type = "default",
  title = "Nothing here yet",
  description = "",
  action,
  actionLabel,
}) {
  const Icon = ICONS[type] || ICONS.default;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        <Icon size={36} className="text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="px-6 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 active:scale-95 transition-all duration-200"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

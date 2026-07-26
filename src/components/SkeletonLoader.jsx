export default function SkeletonLoader({ type = "card" }) {
  if (type === "card") {
    return (
      <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 animate-pulse">
        <div className="h-48 bg-white/10" />
        <div className="p-5 space-y-3">
          <div className="h-5 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
          <div className="h-10 bg-white/10 rounded-xl" />
        </div>
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/10 rounded w-1/3" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="space-y-2">
        <div className="h-10 bg-white/10 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (type === "page") {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
              <div className="h-40 bg-white/10" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

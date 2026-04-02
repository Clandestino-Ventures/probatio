export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Upload zone skeleton */}
        <div className="h-40 bg-carbon border-2 border-dashed border-slate rounded-lg animate-pulse" />

        {/* Section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-28 bg-graphite rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-carbon border border-slate rounded-lg p-4 h-24 animate-pulse" />
            ))}
          </div>
        </div>

        {/* Recent section skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-16 bg-graphite rounded animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-carbon border border-slate rounded-md p-4 h-20 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

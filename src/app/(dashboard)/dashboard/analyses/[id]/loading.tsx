export default function AnalysisLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Header skeleton */}
        <div className="bg-carbon border border-slate rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-graphite rounded animate-pulse" />
              <div className="flex gap-4">
                <div className="h-4 w-20 bg-graphite rounded animate-pulse" />
                <div className="h-4 w-24 bg-graphite rounded animate-pulse" />
                <div className="h-4 w-16 bg-graphite rounded animate-pulse" />
              </div>
              <div className="h-5 w-32 bg-graphite rounded animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-28 bg-graphite rounded-md animate-pulse" />
              <div className="h-9 w-36 bg-graphite rounded-md animate-pulse" />
            </div>
          </div>
        </div>

        {/* Audio player skeleton */}
        <div className="bg-carbon border border-slate rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-graphite rounded-full animate-pulse" />
            <div className="h-3 w-20 bg-graphite rounded animate-pulse" />
          </div>
          <div className="h-16 bg-graphite rounded animate-pulse" />
        </div>

        {/* Executive summary skeleton */}
        <div className="bg-carbon border border-slate rounded-lg p-6">
          <div className="h-5 w-40 bg-graphite rounded animate-pulse mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-graphite rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-graphite rounded animate-pulse" />
            <div className="h-3 w-4/6 bg-graphite rounded animate-pulse" />
          </div>
        </div>

        {/* Match card skeletons */}
        <div className="space-y-4">
          <div className="h-5 w-28 bg-graphite rounded animate-pulse" />
          {[1, 2].map((i) => (
            <div key={i} className="bg-carbon border border-slate rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-graphite rounded animate-pulse" />
                  <div className="h-3 w-24 bg-graphite rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-graphite rounded-full animate-pulse" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j}>
                    <div className="h-3 w-12 bg-graphite rounded animate-pulse mb-1" />
                    <div className="h-1.5 bg-graphite rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Chain of custody skeleton */}
        <div className="bg-carbon border border-slate rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 bg-graphite rounded animate-pulse" />
            <div className="h-4 w-32 bg-graphite rounded animate-pulse" />
            <div className="h-4 w-16 bg-graphite rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

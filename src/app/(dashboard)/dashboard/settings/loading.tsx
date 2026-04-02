export default function Loading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="animate-pulse space-y-4 p-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-white/5 rounded" />
        <div className="h-64 w-full bg-white/5 rounded-lg" />
        <div className="h-32 w-full bg-white/5 rounded-lg" />
      </div>
    </div>
  );
}


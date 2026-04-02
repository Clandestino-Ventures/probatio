import Link from "next/link";

export default function AnalysisNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold text-bone mb-2">Analysis not found</h2>
        <p className="text-sm text-ash mb-6">
          This analysis doesn't exist or you don't have access to it.
        </p>
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-forensic-blue text-bone rounded-md text-sm font-medium hover:bg-forensic-blue/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

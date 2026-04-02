import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian text-bone px-4">
      <span className="font-display text-6xl tracking-wide text-bone/20 mb-4">404</span>
      <h1 className="text-xl font-semibold mb-2">Page not found</h1>
      <p className="text-sm text-ash mb-8 text-center max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="px-4 py-2 bg-forensic-blue text-bone rounded-md text-sm font-medium hover:bg-forensic-blue/90 transition-colors"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="px-4 py-2 border border-slate text-ash rounded-md text-sm hover:text-bone hover:border-ash transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

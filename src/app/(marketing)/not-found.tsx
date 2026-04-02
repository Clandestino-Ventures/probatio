import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-obsidian text-bone px-4">
      <h1 className="font-display text-5xl tracking-wide uppercase mb-4">
        404
      </h1>
      <p className="text-ash text-lg mb-8">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center px-6 py-3 bg-forensic-blue text-bone rounded-md text-sm font-medium hover:bg-forensic-blue/90 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}

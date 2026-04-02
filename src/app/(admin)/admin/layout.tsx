export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-obsidian text-bone">
      <div className="border-b border-signal-red/30 bg-signal-red/5 px-6 py-2">
        <span className="text-xs font-mono text-signal-red uppercase tracking-wider">
          Platform Admin — Clandestino Ventures Internal
        </span>
      </div>
      {children}
    </div>
  );
}

export default function MapSkeleton() {
  return (
    <div
      aria-label="Loading Telemetry Stream"
      aria-busy="true"
      className="flex h-[calc(100vh-4rem)] w-full bg-slate-950 text-slate-100 animate-pulse"
    >
      <div className="flex-1 h-full bg-slate-900 border-r border-slate-800 relative">
        <div className="absolute top-6 left-6 h-9 w-36 bg-slate-800 rounded-xl" />
        <div className="absolute bottom-6 left-6 h-8 w-64 bg-slate-800 rounded-xl" />
      </div>
      <div className="w-[440px] h-full bg-slate-950 p-4 space-y-3">
        <div className="h-6 w-48 bg-slate-800 rounded mb-4" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-28 w-full bg-slate-900 rounded-xl border border-slate-800/60" />
        ))}
      </div>
    </div>
  );
}

type LoadingSkeletonProps = {
  rows?: number;
  colSpan: number;
};

export function LoadingSkeleton({ rows = 3, colSpan }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={`loading-row-${index}`} className="border-b border-zinc-800/70">
          <td colSpan={colSpan} className="py-3">
            <div className="relative overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
              <div className="space-y-2">
                <div className="h-3 w-2/5 rounded bg-zinc-800" />
                <div className="h-3 w-4/5 rounded bg-zinc-800/80" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-[-40%] w-[38%] animate-[shimmer_1.2s_linear_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

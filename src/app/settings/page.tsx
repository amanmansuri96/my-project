import { CSVUploadForm } from "@/components/settings/csv-upload-form";
import { RefreshButton } from "@/components/leaderboard/refresh-button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const recentLogs = await prisma.refreshLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">
          Manage data sources and trigger refreshes
        </p>
      </div>

      <CSVUploadForm />

      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">Manual Refresh</h2>
        <RefreshButton />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Refresh Logs</h2>
        <div className="space-y-2">
          {recentLogs.length === 0 && (
            <p className="text-sm text-gray-400">No refresh history yet</p>
          )}
          {recentLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 text-sm border rounded-md px-4 py-2"
            >
              <span
                className={
                  log.status === "success"
                    ? "text-green-600 font-medium"
                    : "text-red-600 font-medium"
                }
              >
                {log.status}
              </span>
              <span className="text-gray-500">
                {log.startedAt.toLocaleString("en-GB")}
              </span>
              {log.agentCount && (
                <span className="text-gray-500">
                  {log.agentCount} agents, {log.ticketCount} tickets
                </span>
              )}
              {log.errorMsg && (
                <span className="text-red-500 truncate max-w-xs">
                  {log.errorMsg}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

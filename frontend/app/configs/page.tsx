"use client";

import { CaretDown, CaretUp, SlidersHorizontal } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { StatusMessage } from "@/components/StatusMessage";
import {
  requireAuthConfig,
  requireUuid,
  signedJsonRequest,
  toPathSegment,
} from "@/lib/cloudconfig";
import { useActiveAuth, useConfigStore } from "@/lib/store";
import type { ConfigItem } from "@/lib/types";

export default function ConfigsPage() {
  const auth = useActiveAuth();
  const activeServerId = useConfigStore((state) => state.activeServerId);
  const [listProjectId, setListProjectId] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [configKey, setConfigKey] = useState("");
  const [configValue, setConfigValue] = useState("{\n  \"example\": true\n}");
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedValueRows, setExpandedValueRows] = useState<Record<string, boolean>>(
    {},
  );
  const requestEpochRef = useRef(0);
  const activeAuthFingerprint = auth
    ? `${auth.baseUrl}|${auth.clientId}|${auth.privateKeyPem}`
    : "";

  useEffect(() => {
    requestEpochRef.current += 1;
    setConfigs([]);
    setExpandedValueRows({});
    setMessage("");
    setError("");
    setLoading(false);
  }, [activeServerId, activeAuthFingerprint]);

  async function listConfigs() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      const projectId = toPathSegment(requireUuid(listProjectId, "Project ID"));
      const response = await signedJsonRequest<ConfigItem[]>(
        currentAuth,
        "GET",
        `/admin/projects/${projectId}/configs`,
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setConfigs(response);
      setMessage(`Loaded ${response.length} configs.`);
    });
  }

  async function upsertConfig() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      const projectId = toPathSegment(requireUuid(targetProjectId, "Project ID"));
      if (!configKey.trim()) {
        throw new Error("Config key is required.");
      }
      // Validate JSON locally before sending.
      JSON.parse(configValue);
      await signedJsonRequest<ConfigItem>(
        currentAuth,
        "POST",
        `/admin/projects/${projectId}/configs`,
        { key: configKey.trim(), value: configValue },
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setMessage(`Config ${configKey.trim()} upserted.`);
    });
  }

  async function runWithFeedback(task: (requestEpoch: number) => Promise<void>) {
    const requestEpoch = requestEpochRef.current;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await task(requestEpoch);
    } catch (taskError) {
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }
      setError(
        taskError instanceof Error ? taskError.message : "Unknown request error.",
      );
    } finally {
      if (requestEpoch === requestEpochRef.current) {
        setLoading(false);
      }
    }
  }

  function toggleValueRow(configId: string) {
    setExpandedValueRows((current) => ({
      ...current,
      [configId]: !current[configId],
    }));
  }

  return (
    <ConsoleFrame
      title="Configs"
      description="Read and write project-scoped config values."
    >
      <section className="border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">List project configs</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Project ID</span>
            <input
              className="focus-ring w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={listProjectId}
              onChange={(event) => setListProjectId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Fetches all key/value versions for the selected project.
            </span>
          </label>
          <button
            type="button"
            onClick={listConfigs}
            disabled={loading}
            className="focus-ring interactive rounded-md border border-zinc-600 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load configs
          </button>
        </div>
      </section>

      <section className="mt-6 border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Upsert config value</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Project ID</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={targetProjectId}
              onChange={(event) => setTargetProjectId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              This project receives the config update.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Config key</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
              placeholder="feature_flags.billing"
              value={configKey}
              onChange={(event) => setConfigKey(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Dot notation is useful for grouped config domains.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">JSON value</span>
            <textarea
              className="focus-ring min-h-36 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder='{"feature_flag": true}'
              value={configValue}
              onChange={(event) => setConfigValue(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Value is validated as JSON before the request is sent.
            </span>
          </label>
          <button
            type="button"
            onClick={upsertConfig}
            disabled={loading}
            className="focus-ring interactive w-fit rounded-md border border-emerald-700/80 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Upsert config
          </button>
        </div>
      </section>

      <section className="mt-6 border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Config list</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  Key
                </th>
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  Version
                </th>
                <th className="py-2 pr-4 text-xs uppercase tracking-wider text-zinc-500">
                  Updated At
                </th>
                <th className="py-2 text-xs uppercase tracking-wider text-zinc-500">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && configs.length === 0 ? (
                <LoadingSkeleton rows={3} colSpan={4} />
              ) : null}
              {configs.map((config) => {
                const hasExpandableValue =
                  config.value.length > 34 || config.value.includes("\n");
                return (
                  <tr
                    key={config.id}
                    className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/50"
                  >
                    <td className="py-2 pr-4">{config.key}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{config.version}</td>
                    <td className="py-2 pr-4 text-xs text-zinc-400">{config.updated_at}</td>
                    <td className="py-2">
                      <div className="space-y-1">
                        {expandedValueRows[config.id] ? (
                          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-xs text-zinc-200">
                            {config.value}
                          </pre>
                        ) : (
                          <p className="max-w-[34ch] truncate font-mono text-xs text-zinc-300">
                            {config.value}
                          </p>
                        )}
                        {hasExpandableValue ? (
                          <button
                            type="button"
                            onClick={() => toggleValueRow(config.id)}
                            className="focus-ring interactive inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                          >
                            {expandedValueRows[config.id] ? (
                              <>
                                <CaretUp className="size-3.5" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <CaretDown className="size-3.5" />
                                Expand
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && configs.length === 0 && (
                <tr>
                  <td className="py-4" colSpan={4}>
                    <EmptyState
                      icon={<SlidersHorizontal className="size-5" weight="duotone" />}
                      title="No configs loaded"
                      description="Load a project to inspect its config values and version history."
                      actionLabel="Load configs"
                      onAction={listConfigs}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <StatusMessage
        text={message}
        variant="success"
        onDismiss={() => setMessage("")}
      />
      <StatusMessage text={error} variant="error" onDismiss={() => setError("")} />
    </ConsoleFrame>
  );
}

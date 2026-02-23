"use client";

import { useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import {
  ensureAuthConfig,
  requireUuid,
  signedJsonRequest,
  toPathSegment,
} from "@/lib/cloudconfig";
import { useAuthConfig } from "@/lib/useAuthConfig";
import type { ConfigItem } from "@/lib/types";

export default function ConfigsPage() {
  const { auth, setAuth } = useAuthConfig();
  const [listProjectId, setListProjectId] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [configKey, setConfigKey] = useState("");
  const [configValue, setConfigValue] = useState("{\n  \"example\": true\n}");
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function listConfigs() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      const projectId = toPathSegment(requireUuid(listProjectId, "Project ID"));
      const response = await signedJsonRequest<ConfigItem[]>(
        auth,
        "GET",
        `/admin/projects/${projectId}/configs`,
      );
      setConfigs(response);
      setMessage(`Loaded ${response.length} configs.`);
    });
  }

  async function upsertConfig() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      const projectId = toPathSegment(requireUuid(targetProjectId, "Project ID"));
      if (!configKey.trim()) {
        throw new Error("Config key is required.");
      }
      // Validate JSON locally before sending.
      JSON.parse(configValue);
      await signedJsonRequest<ConfigItem>(
        auth,
        "POST",
        `/admin/projects/${projectId}/configs`,
        { key: configKey.trim(), value: configValue },
      );
      setMessage(`Config ${configKey.trim()} upserted.`);
    });
  }

  async function runWithFeedback(task: () => Promise<void>) {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await task();
    } catch (taskError) {
      setError(
        taskError instanceof Error ? taskError.message : "Unknown request error.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConsoleFrame
      title="Configs"
      description="Read and write project-scoped config values."
      auth={auth}
      onAuthChange={setAuth}
    >
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">List project configs</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Project ID"
            value={listProjectId}
            onChange={(event) => setListProjectId(event.target.value)}
          />
          <button
            type="button"
            onClick={listConfigs}
            disabled={loading}
            className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load configs
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Upsert config value</h2>
        <div className="mt-3 grid gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Project ID"
            value={targetProjectId}
            onChange={(event) => setTargetProjectId(event.target.value)}
          />
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Config key"
            value={configKey}
            onChange={(event) => setConfigKey(event.target.value)}
          />
          <textarea
            className="min-h-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder='{"feature_flag": true}'
            value={configValue}
            onChange={(event) => setConfigValue(event.target.value)}
          />
          <button
            type="button"
            onClick={upsertConfig}
            disabled={loading}
            className="w-fit rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Upsert config
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Config list</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-zinc-200">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Updated At</th>
                <th className="py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id} className="border-b border-zinc-800">
                  <td className="py-2 pr-4">{config.key}</td>
                  <td className="py-2 pr-4">{config.version}</td>
                  <td className="py-2 pr-4">{config.updated_at}</td>
                  <td className="py-2 font-mono text-xs">{config.value}</td>
                </tr>
              ))}
              {configs.length === 0 && (
                <tr>
                  <td className="py-3 text-zinc-400" colSpan={4}>
                    No configs loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && (
        <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-950 p-3 text-sm text-emerald-100">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-md border border-red-700 bg-red-950 p-3 text-sm text-red-100">
          {error}
        </p>
      )}
    </ConsoleFrame>
  );
}

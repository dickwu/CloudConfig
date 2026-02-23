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
import type { ClientPermission } from "@/lib/types";

export default function PermissionsPage() {
  const { auth, setAuth } = useAuthConfig();
  const [grantClientId, setGrantClientId] = useState("");
  const [grantProjectId, setGrantProjectId] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [revokeClientId, setRevokeClientId] = useState("");
  const [revokeProjectId, setRevokeProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function grantPermission() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      const clientId = toPathSegment(requireUuid(grantClientId, "Client ID"));
      const projectId = requireUuid(grantProjectId, "Project ID");

      const response = await signedJsonRequest<ClientPermission>(
        auth,
        "POST",
        `/admin/clients/${clientId}/permissions`,
        {
          project_id: projectId,
          can_read: canRead,
          can_write: canWrite,
        },
      );

      setMessage(
        `Permission saved (read=${String(response.can_read)}, write=${String(response.can_write)}).`,
      );
    });
  }

  async function revokePermission() {
    await runWithFeedback(async () => {
      ensureAuthConfig(auth);
      const clientId = toPathSegment(requireUuid(revokeClientId, "Client ID"));
      const projectId = toPathSegment(requireUuid(revokeProjectId, "Project ID"));

      await signedJsonRequest<undefined>(
        auth,
        "DELETE",
        `/admin/clients/${clientId}/permissions/${projectId}`,
      );

      setMessage("Permission revoked.");
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
      title="Permissions"
      description="Grant and revoke per-project client permissions."
      auth={auth}
      onAuthChange={setAuth}
    >
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Grant permission</h2>
        <div className="mt-3 grid gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Client ID"
            value={grantClientId}
            onChange={(event) => setGrantClientId(event.target.value)}
          />
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Project ID"
            value={grantProjectId}
            onChange={(event) => setGrantProjectId(event.target.value)}
          />
          <div className="flex gap-6 text-sm text-zinc-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canRead}
                onChange={(event) => setCanRead(event.target.checked)}
              />
              Can read
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canWrite}
                onChange={(event) => setCanWrite(event.target.checked)}
              />
              Can write
            </label>
          </div>
          <button
            type="button"
            onClick={grantPermission}
            disabled={loading}
            className="w-fit rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save permission
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Revoke permission</h2>
        <div className="mt-3 grid gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Client ID"
            value={revokeClientId}
            onChange={(event) => setRevokeClientId(event.target.value)}
          />
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            placeholder="Project ID"
            value={revokeProjectId}
            onChange={(event) => setRevokeProjectId(event.target.value)}
          />
          <button
            type="button"
            onClick={revokePermission}
            disabled={loading}
            className="w-fit rounded-md border border-red-700 px-4 py-2 text-red-200 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Revoke permission
          </button>
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

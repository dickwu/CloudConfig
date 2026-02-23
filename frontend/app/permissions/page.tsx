"use client";

import { useEffect, useRef, useState } from "react";

import { ConsoleFrame } from "@/components/ConsoleFrame";
import { StatusMessage } from "@/components/StatusMessage";
import {
  requireAuthConfig,
  requireUuid,
  signedJsonRequest,
  toPathSegment,
} from "@/lib/cloudconfig";
import { useActiveAuth, useConfigStore } from "@/lib/store";
import type { ClientPermission } from "@/lib/types";

export default function PermissionsPage() {
  const auth = useActiveAuth();
  const activeServerId = useConfigStore((state) => state.activeServerId);
  const [grantClientId, setGrantClientId] = useState("");
  const [grantProjectId, setGrantProjectId] = useState("");
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [revokeClientId, setRevokeClientId] = useState("");
  const [revokeProjectId, setRevokeProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestEpochRef = useRef(0);
  const activeAuthFingerprint = auth
    ? `${auth.baseUrl}|${auth.clientId}|${auth.privateKeyPem}`
    : "";

  useEffect(() => {
    requestEpochRef.current += 1;
    setMessage("");
    setError("");
    setLoading(false);
  }, [activeServerId, activeAuthFingerprint]);

  async function grantPermission() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      const clientId = toPathSegment(requireUuid(grantClientId, "Client ID"));
      const projectId = requireUuid(grantProjectId, "Project ID");

      const response = await signedJsonRequest<ClientPermission>(
        currentAuth,
        "POST",
        `/admin/clients/${clientId}/permissions`,
        {
          project_id: projectId,
          can_read: canRead,
          can_write: canWrite,
        },
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }

      setMessage(
        `Permission saved (read=${String(response.can_read)}, write=${String(response.can_write)}).`,
      );
    });
  }

  async function revokePermission() {
    await runWithFeedback(async (requestEpoch) => {
      const currentAuth = requireAuthConfig(auth);
      const clientId = toPathSegment(requireUuid(revokeClientId, "Client ID"));
      const projectId = toPathSegment(requireUuid(revokeProjectId, "Project ID"));

      await signedJsonRequest<undefined>(
        currentAuth,
        "DELETE",
        `/admin/clients/${clientId}/permissions/${projectId}`,
      );
      if (requestEpoch !== requestEpochRef.current) {
        return;
      }

      setMessage("Permission revoked.");
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

  return (
    <ConsoleFrame
      title="Permissions"
      description="Grant and revoke per-project client permissions."
    >
      <section className="border-t border-zinc-800 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Grant permission</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Client ID</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={grantClientId}
              onChange={(event) => setGrantClientId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Target client that should receive access.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Project ID</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={grantProjectId}
              onChange={(event) => setGrantProjectId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Project where this client should have read or write permission.
            </span>
          </label>
          <div className="grid gap-2">
            <span className="text-sm text-zinc-200">Access flags</span>
            <div className="flex flex-wrap gap-6 text-sm text-zinc-200">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={canRead}
                  onChange={(event) => setCanRead(event.target.checked)}
                  className="focus-ring size-4 rounded border border-zinc-600 bg-zinc-950 accent-emerald-500"
                />
                Can read
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={canWrite}
                  onChange={(event) => setCanWrite(event.target.checked)}
                  className="focus-ring size-4 rounded border border-zinc-600 bg-zinc-950 accent-emerald-500"
                />
                Can write
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={grantPermission}
            disabled={loading}
            className="focus-ring interactive w-fit rounded-md border border-emerald-700/80 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save permission
          </button>
        </div>
      </section>

      <section className="mt-6 border-t border-red-900/60 bg-red-950/10 pt-6">
        <h2 className="text-lg font-medium text-zinc-100">Revoke permission</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Client ID</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={revokeClientId}
              onChange={(event) => setRevokeClientId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Access will be removed for this client.
            </span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-zinc-200">Project ID</span>
            <input
              className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100 placeholder:text-zinc-500"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={revokeProjectId}
              onChange={(event) => setRevokeProjectId(event.target.value)}
            />
            <span className="text-xs text-zinc-500">
              Permission record for this project is permanently removed.
            </span>
          </label>
          <button
            type="button"
            onClick={revokePermission}
            disabled={loading}
            className="focus-ring interactive w-fit rounded-md border border-red-800/80 bg-red-950/30 px-4 py-2 text-sm text-red-200 hover:border-red-600 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Revoke permission
          </button>
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

"use client";

import { CheckCircle, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { StatusMessage } from "@/components/StatusMessage";
import { ensureAuthConfig } from "@/lib/cloudconfig";
import type { ServerConfig } from "@/lib/store";
import { useConfigStore, useIsConfigured } from "@/lib/store";

type ConfigModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ServerFormState = {
  alias: string;
  baseUrl: string;
  clientId: string;
  privateKeyPem: string;
};

const emptyForm: ServerFormState = {
  alias: "",
  baseUrl: "",
  clientId: "",
  privateKeyPem: "",
};

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function ConfigModal({ isOpen, onClose }: ConfigModalProps) {
  const servers = useConfigStore((state) => state.servers);
  const activeServerId = useConfigStore((state) => state.activeServerId);
  const addServer = useConfigStore((state) => state.addServer);
  const updateServer = useConfigStore((state) => state.updateServer);
  const removeServer = useConfigStore((state) => state.removeServer);
  const setActiveServer = useConfigStore((state) => state.setActiveServer);
  const isConfigured = useIsConfigured();

  const [createForm, setCreateForm] = useState<ServerFormState>(emptyForm);
  const [setAsActiveOnCreate, setSetAsActiveOnCreate] = useState(true);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ServerFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const canClose = isConfigured;
  const nextDefaultAlias = useMemo(
    () => `Server ${servers.length + 1}`,
    [servers.length],
  );

  function clearTransientState() {
    setEditingServerId(null);
    setMessage("");
    setError("");
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initialFocusElements = getFocusableElements(dialogRef.current);
    if (initialFocusElements.length > 0) {
      initialFocusElements[0].focus();
    } else {
      dialogRef.current?.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && canClose) {
        event.preventDefault();
        clearTransientState();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      const focusIsInside = Boolean(
        activeElement && dialogRef.current?.contains(activeElement),
      );

      if (event.shiftKey) {
        if (!focusIsInside || activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else if (!focusIsInside || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, canClose, onClose]);

  function validateForm(form: ServerFormState): string | null {
    try {
      ensureAuthConfig({
        baseUrl: form.baseUrl,
        clientId: form.clientId,
        privateKeyPem: form.privateKeyPem,
      });
      return null;
    } catch (validationError) {
      if (validationError instanceof Error) {
        return validationError.message;
      }
      return "Invalid server configuration.";
    }
  }

  function updateCreateField(field: keyof ServerFormState, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditField(field: keyof ServerFormState, value: string) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  function handleOpenEditor(server: ServerConfig) {
    setEditingServerId(server.id);
    setEditForm({
      alias: server.alias,
      baseUrl: server.baseUrl,
      clientId: server.clientId,
      privateKeyPem: server.privateKeyPem,
    });
    setMessage("");
    setError("");
  }

  function handleClose() {
    if (!canClose) {
      return;
    }
    clearTransientState();
    onClose();
  }

  function handleCreateServer() {
    setMessage("");
    setError("");
    const validationError = validateForm(createForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    const alias = createForm.alias.trim() || nextDefaultAlias;
    const serverId = addServer({
      alias,
      baseUrl: createForm.baseUrl,
      clientId: createForm.clientId,
      privateKeyPem: createForm.privateKeyPem,
    });
    if (setAsActiveOnCreate) {
      setActiveServer(serverId);
    }
    setCreateForm(emptyForm);
    setMessage(`Saved server "${alias}".`);
  }

  function handleSaveEdit() {
    if (!editingServerId) {
      return;
    }
    setMessage("");
    setError("");
    const validationError = validateForm(editForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    const alias = editForm.alias.trim() || nextDefaultAlias;
    updateServer(editingServerId, { ...editForm, alias });
    setEditingServerId(null);
    setMessage(`Updated server "${alias}".`);
  }

  function handleDeleteServer(server: ServerConfig) {
    const deletingActive = server.id === activeServerId;
    const confirmMessage = deletingActive
      ? `Delete active server "${server.alias}"?`
      : `Delete server "${server.alias}"?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    removeServer(server.id);
    if (editingServerId === server.id) {
      setEditingServerId(null);
    }
    setMessage(`Deleted server "${server.alias}".`);
    setError("");
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Config Management"
            tabIndex={-1}
            ref={dialogRef}
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 100, damping: 20 },
            }}
            exit={{ opacity: 0, y: 6, scale: 0.985 }}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-[0_30px_50px_-28px_rgba(16,185,129,0.9)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">Config Management</h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Manage multiple servers and choose the active target for API requests.
                </p>
                {!canClose ? (
                  <p className="mt-2 text-sm text-amber-200">
                    Add at least one complete server before closing this modal.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={!canClose}
                className="focus-ring interactive rounded-md border border-zinc-600 p-2 text-zinc-100 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close config management"
              >
                <X className="size-4" />
              </button>
            </div>

            <section className="mt-5">
              <h3 className="text-base font-medium text-zinc-100">Saved servers</h3>
              <div className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/70">
                {servers.map((server) => {
                  const isActive = server.id === activeServerId;
                  const alias = server.alias || "Unnamed";
                  return (
                    <div
                      key={server.id}
                      className="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${isActive ? "pulse-soft bg-emerald-400" : "bg-zinc-600"}`}
                          />
                          <p className="text-sm font-medium text-zinc-100">{alias}</p>
                          {isActive ? (
                            <span className="rounded-full border border-emerald-700/80 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                              Active
                            </span>
                          ) : null}
                        </div>
                        <p className="font-mono text-xs text-zinc-400">{server.baseUrl}</p>
                        <p className="font-mono text-xs text-zinc-500">{server.clientId}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(server)}
                          className="focus-ring interactive inline-flex items-center gap-1.5 rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-100 hover:border-zinc-400"
                        >
                          <PencilSimple className="size-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveServer(server.id)}
                          disabled={isActive}
                          className="focus-ring interactive inline-flex items-center gap-1.5 rounded-md border border-emerald-700/80 px-3 py-1.5 text-xs text-emerald-200 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle className="size-3.5" weight="duotone" />
                          Set active
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteServer(server)}
                          className="focus-ring interactive inline-flex items-center gap-1.5 rounded-md border border-red-800/80 px-3 py-1.5 text-xs text-red-200 hover:border-red-600 hover:bg-red-950/40"
                        >
                          <Trash className="size-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
                {servers.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-400">No servers saved yet.</div>
                ) : null}
              </div>
            </section>

            {editingServerId ? (
              <section className="mt-5 border-t border-zinc-800 pt-5">
                <h3 className="text-base font-medium text-zinc-100">Edit server</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2 text-sm">
                    <span className="text-zinc-200">Alias</span>
                    <input
                      className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                      value={editForm.alias}
                      onChange={(event) => updateEditField("alias", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-zinc-200">Server URL</span>
                    <input
                      className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                      placeholder="http://127.0.0.1:8080"
                      value={editForm.baseUrl}
                      onChange={(event) => updateEditField("baseUrl", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm md:col-span-2">
                    <span className="text-zinc-200">Admin Client ID</span>
                    <input
                      className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100"
                      value={editForm.clientId}
                      onChange={(event) => updateEditField("clientId", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm md:col-span-2">
                    <span className="text-zinc-200">Admin Private Key (PEM)</span>
                    <textarea
                      className="focus-ring min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
                      value={editForm.privateKeyPem}
                      onChange={(event) =>
                        updateEditField("privateKeyPem", event.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="focus-ring interactive rounded-md border border-emerald-700/80 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 hover:border-emerald-500"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingServerId(null)}
                    className="focus-ring interactive rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-100 hover:border-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}

            <section className="mt-5 border-t border-zinc-800 pt-5">
              <h3 className="text-base font-medium text-zinc-100">Add server</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-200">Alias</span>
                  <input
                    className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                    placeholder={nextDefaultAlias}
                    value={createForm.alias}
                    onChange={(event) => updateCreateField("alias", event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-zinc-200">Server URL</span>
                  <input
                    className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                    placeholder="http://127.0.0.1:8080"
                    value={createForm.baseUrl}
                    onChange={(event) => updateCreateField("baseUrl", event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="text-zinc-200">Admin Client ID</span>
                  <input
                    className="focus-ring rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-zinc-100"
                    value={createForm.clientId}
                    onChange={(event) => updateCreateField("clientId", event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="text-zinc-200">Admin Private Key (PEM)</span>
                  <textarea
                    className="focus-ring min-h-24 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    value={createForm.privateKeyPem}
                    onChange={(event) => updateCreateField("privateKeyPem", event.target.value)}
                  />
                </label>
              </div>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  checked={setAsActiveOnCreate}
                  onChange={(event) => setSetAsActiveOnCreate(event.target.checked)}
                  className="focus-ring size-4 rounded border border-zinc-600 bg-zinc-950 accent-emerald-500"
                />
                Set as active after saving
              </label>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleCreateServer}
                  className="focus-ring interactive rounded-md border border-emerald-700/80 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 hover:border-emerald-500"
                >
                  Save server
                </button>
              </div>
            </section>

            <StatusMessage
              text={message}
              variant="success"
              onDismiss={() => setMessage("")}
            />
            <StatusMessage text={error} variant="error" onDismiss={() => setError("")} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

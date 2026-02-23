"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import { isAuthConfigComplete, type AuthConfig } from "@/lib/cloudconfig";

const STORAGE_KEY = "cloudconfig.servers";
const LEGACY_STORAGE_KEY = "cloudconfig.console.auth";

type LegacyAuthFields = Pick<AuthConfig, "baseUrl" | "clientId">;

export type ServerConfig = {
  id: string;
  alias: string;
  baseUrl: string;
  clientId: string;
  privateKeyPem: string;
};

type ServerConfigInput = Omit<ServerConfig, "id">;

type ConfigStoreState = {
  servers: ServerConfig[];
  activeServerId: string | null;
  hasHydrated: boolean;
  addServer: (server: ServerConfigInput) => string;
  updateServer: (id: string, patch: Partial<ServerConfigInput>) => void;
  removeServer: (id: string) => void;
  setActiveServer: (id: string) => void;
  importLegacySessionConfig: () => void;
  ensureActiveServer: () => void;
  setHasHydrated: (value: boolean) => void;
};

type PersistedState = Pick<ConfigStoreState, "servers" | "activeServerId">;

export const useConfigStore = create<ConfigStoreState>()(
  persist(
    (set, get) => ({
      servers: [],
      activeServerId: null,
      hasHydrated: false,
      addServer: (server) => {
        const id = crypto.randomUUID();
        const nextServer: ServerConfig = {
          id,
          alias: server.alias.trim(),
          baseUrl: server.baseUrl.trim(),
          clientId: server.clientId.trim(),
          privateKeyPem: server.privateKeyPem,
        };
        set((state) => ({
          servers: [...state.servers, nextServer],
          activeServerId: state.activeServerId ?? id,
        }));
        return id;
      },
      updateServer: (id, patch) => {
        set((state) => ({
          servers: state.servers.map((server) => {
            if (server.id !== id) {
              return server;
            }
            return {
              ...server,
              ...patch,
              alias: patch.alias === undefined ? server.alias : patch.alias.trim(),
              baseUrl:
                patch.baseUrl === undefined ? server.baseUrl : patch.baseUrl.trim(),
              clientId:
                patch.clientId === undefined
                  ? server.clientId
                  : patch.clientId.trim(),
            };
          }),
        }));
      },
      removeServer: (id) => {
        set((state) => {
          const servers = state.servers.filter((server) => server.id !== id);
          if (servers.length === 0) {
            return { servers, activeServerId: null };
          }
          const activeServerId =
            state.activeServerId === id ? servers[0].id : state.activeServerId;
          return { servers, activeServerId };
        });
      },
      setActiveServer: (id) => {
        set((state) => {
          if (!state.servers.some((server) => server.id === id)) {
            return {};
          }
          return { activeServerId: id };
        });
      },
      importLegacySessionConfig: () => {
        if (typeof window === "undefined") {
          return;
        }
        const state = get();
        if (state.servers.length > 0) {
          return;
        }
        const raw = window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) {
          return;
        }
        try {
          const parsed = JSON.parse(raw) as Partial<LegacyAuthFields>;
          const baseUrl = parsed.baseUrl?.trim() ?? "";
          const clientId = parsed.clientId?.trim() ?? "";
          if (!baseUrl && !clientId) {
            window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
            return;
          }
          const migrated: ServerConfig = {
            id: crypto.randomUUID(),
            alias: "Migrated",
            baseUrl,
            clientId,
            privateKeyPem: "",
          };
          set({ servers: [migrated], activeServerId: migrated.id });
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
          window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      },
      ensureActiveServer: () => {
        set((state) => {
          if (state.servers.length === 0) {
            return { activeServerId: null };
          }
          const hasValidActive = state.servers.some(
            (server) => server.id === state.activeServerId,
          );
          if (hasValidActive) {
            return {};
          }
          return { activeServerId: state.servers[0].id };
        });
      },
      setHasHydrated: (value) => {
        set({ hasHydrated: value });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({
        servers: state.servers,
        activeServerId: state.activeServerId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!state) {
          return;
        }
        if (error) {
          state.setHasHydrated(true);
          return;
        }
        state.importLegacySessionConfig();
        state.ensureActiveServer();
        state.setHasHydrated(true);
      },
    },
  ),
);

export function useActiveAuth(): AuthConfig | null {
  return useConfigStore(
    useShallow((state) => {
      if (!state.activeServerId) {
        return null;
      }
      const activeServer = state.servers.find(
        (server) => server.id === state.activeServerId,
      );
      if (!activeServer) {
        return null;
      }
      return {
        baseUrl: activeServer.baseUrl,
        clientId: activeServer.clientId,
        privateKeyPem: activeServer.privateKeyPem,
      };
    }),
  );
}

export function useIsConfigured(): boolean {
  return useConfigStore((state) => {
    if (!state.hasHydrated) {
      return true;
    }
    if (!state.activeServerId) {
      return false;
    }
    const activeServer = state.servers.find(
      (server) => server.id === state.activeServerId,
    );
    if (!activeServer) {
      return false;
    }
    return isAuthConfigComplete({
      baseUrl: activeServer.baseUrl,
      clientId: activeServer.clientId,
      privateKeyPem: activeServer.privateKeyPem,
    });
  });
}

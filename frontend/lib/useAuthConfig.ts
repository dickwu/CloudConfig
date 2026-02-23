"use client";

import { useEffect, useState } from "react";

import type { AuthConfig } from "@/lib/cloudconfig";

const STORAGE_KEY = "cloudconfig.console.auth";
type StoredAuthFields = Pick<AuthConfig, "baseUrl" | "clientId">;
let inMemoryPrivateKeyPem = "";

const defaultAuthConfig: AuthConfig = {
  baseUrl: "http://127.0.0.1:8080",
  clientId: "",
  privateKeyPem: "",
};

export function useAuthConfig() {
  const [auth, setAuth] = useState<AuthConfig>(() => readStoredAuthConfig());

  useEffect(() => {
    inMemoryPrivateKeyPem = auth.privateKeyPem;
    const stored: StoredAuthFields = {
      baseUrl: auth.baseUrl,
      clientId: auth.clientId,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [auth]);

  return { auth, setAuth };
}

export function updateAuthField(
  current: AuthConfig,
  field: keyof AuthConfig,
  value: string,
): AuthConfig {
  return { ...current, [field]: value };
}

function readStoredAuthConfig(): AuthConfig {
  if (typeof window === "undefined") {
    return defaultAuthConfig;
  }

  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultAuthConfig;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredAuthFields>;
    return {
      baseUrl: parsed.baseUrl ?? defaultAuthConfig.baseUrl,
      clientId: parsed.clientId ?? defaultAuthConfig.clientId,
      privateKeyPem: inMemoryPrivateKeyPem,
    };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return defaultAuthConfig;
  }
}

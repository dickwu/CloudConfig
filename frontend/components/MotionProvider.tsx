"use client";

import type { ReactNode } from "react";

import { MotionConfig } from "framer-motion";

type MotionProviderProps = {
  children: ReactNode;
};

export function MotionProvider({ children }: MotionProviderProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

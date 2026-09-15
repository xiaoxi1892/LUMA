"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Discovery } from "@/lib/matter/types";
const prompts: [Discovery, string][] = [["detach", "pull it apart"], ["hold", "stay a little longer"], ["doubleClick", "try a double tap"], ["merge", "bring them together"], ["throw", "give it a little momentum"], ["modeSwitch", "there is another state"]];
export function useDiscovery() {
  const found = useRef(new Set<Discovery>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hint, setHint] = useState("pull it apart");
  const discover = useCallback((event: Discovery) => {
    if (found.current.has(event)) return;
    found.current.add(event);
    if (event !== "drag") setHint("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setHint(prompts.find(([key]) => !found.current.has(key))?.[1] ?? ""); }, 10000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { hint, discover };
}

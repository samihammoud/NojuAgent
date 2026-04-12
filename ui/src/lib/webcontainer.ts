import { WebContainer } from "@webcontainer/api";

// WebContainer.boot() can only be called once per page load.
// This singleton ensures we reuse the same instance across remounts.
let instance: WebContainer | null = null;
let booting: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (booting) return booting;

  booting = WebContainer.boot().then((wc) => {
    instance = wc;
    return wc;
  });

  return booting;
}

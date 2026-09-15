import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "components/BlobMesh.tsx",
      "components/Scene.tsx",
      "components/experience/*.tsx",
      "components/matter/*.tsx",
      "components/particles/*.tsx",
      "components/sand/*.tsx",
      "components/playground/*.tsx",
    ],
    // R3F deliberately mutates Three objects and uniforms in useFrame/effects.
    // These are imperative simulation objects, never React-rendered state.
    rules: { "react-hooks/immutability": "off" },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "artifacts/**"]),
]);

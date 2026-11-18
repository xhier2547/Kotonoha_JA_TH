import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: [
    "kuromoji",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sql.js",
  ],
  outputFileTracingIncludes: {
    "/api/dictionary": [
      "src/data/generated/jmdict-common.json",
      "src/data/generated/kanjidic2.json",
    ],
    "/api/kanji-stroke": ["src/data/generated/kanjivg-strokes.json"],
    "/api/translate": ["src/data/generated/jmdict-common.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

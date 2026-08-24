/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // better-sqlite3 is a native module — keep it out of the bundler.
    serverComponentsExternalPackages: ["better-sqlite3"],
    // Without this, file tracing sweeps data/bhargo.db into the standalone
    // build — the company's books, copied into a build artifact and from there
    // into any image or archive made from it. Never ship the data with the app.
    //
    // Named precisely: a broad "data/**" also matches Next's own
    // dist/lib/metadata/… and quietly removes files the server needs to boot.
    outputFileTracingExcludes: { "*": ["./data/*.db", "./data/*.db-*"] },
  },

  // Produces a self-contained server in .next/standalone, so the container
  // carries the app and nothing else — no node_modules to ship around.
  output: "standalone",
};

export default nextConfig;

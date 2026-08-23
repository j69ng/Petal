"use client";

import { useEffect } from "react";

/** The last resort: a failure in the layout itself, so this page carries its own html shell. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        route: `${window.location.pathname} (layout)`,
        stack: error.stack,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#1b1a17" }}>
        <div style={{ maxWidth: "28rem", margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Bhargo could not load</h1>
          <p style={{ color: "#6f6a61", fontSize: "0.875rem", marginTop: "0.5rem" }}>
            Your records are safe. This has been reported. Try again in a moment.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#8a5a2b",
              color: "white",
              border: 0,
              borderRadius: "0.25rem",
              padding: "0.75rem 1.25rem",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

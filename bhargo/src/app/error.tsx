"use client";

import { useEffect, useState } from "react";

/**
 * What the company sees when something breaks: a plain sentence and a short
 * code — no stack trace, no jargon, nothing to interpret. The details go to
 * whoever maintains Bhargo, silently, in the same moment.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        route: window.location.pathname,
        stack: error.stack,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRef(data?.ref ?? null))
      .catch(() => setRef(null));
  }, [error]);

  return (
    <div className="max-w-md mx-auto mt-12 text-center">
      <h1 className="text-xl font-semibold">That did not work</h1>
      <p className="text-mute text-sm mt-2">
        Nothing you entered has been lost. Try again — and if it keeps happening, this has already
        been reported.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mt-6">
        <button onClick={reset} className="btn">
          Try again
        </button>
        <a href="/" className="btn-quiet">
          Back to the start
        </a>
      </div>

      {ref && (
        <p className="text-xs text-mute mt-6">
          If you need to mention it, the reference is <span className="font-mono">{ref}</span>.
        </p>
      )}
    </div>
  );
}

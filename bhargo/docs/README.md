# Documents

Two templates, rendered to PDF with a headless browser so the layout is
controlled rather than left to a word processor.

| File | What it is |
| --- | --- |
| `overview.html` | What the software does and — plainly — what it does not do. For handing to a client before they commit. |
| `licence.html` | Exclusive licence agreement: dedicated to one company, no resale, copyright retained, remedies for unauthorised use. |

## Rendering them

```bash
node scripts/render-docs.mjs
```

Produces `Bhargo-Software-Overview.pdf` and
`Bhargo-Software-Licence-Agreement.pdf` beside the templates.

## The signature

`licence.html` expects `docs/signature.png` — a scan of the signature with the
paper removed, so it sits on the signature line rather than in a white box. That
file and the finished PDFs are deliberately **not** committed: a signature image
in a repository is a signature available to anyone who can read the repository.
Keep it locally, and store signed contracts wherever the company's other signed
paperwork lives.

To prepare a new one from a photograph or scan, see `scripts/prepare-signature.py`.

## Before either document is used

The licence is a working draft, not legal advice. Contract law, copyright
remedies and enforceable penalties differ by jurisdiction — have a lawyer read
it before anyone signs.

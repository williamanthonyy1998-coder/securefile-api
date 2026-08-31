# SecureFile merge-ready package

This package is based on the merged SecureFile tree that contains the local SecureFile improvements
and the partner `faiz` history as an ancestor.

Important:
- Source remains TypeScript; no application source was converted to `.js`.
- `.env` and local production secrets are intentionally excluded. Keep your existing environment files.
- `node_modules`, build output, `.git`, and local storage are excluded.
- Do not use `git push --force` on the production `main` branch.

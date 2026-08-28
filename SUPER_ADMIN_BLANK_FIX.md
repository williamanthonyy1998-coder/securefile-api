# Super Admin blank-page fix

The Super Admin page now:
- uses the authenticated application shell
- displays a loading state
- displays API errors instead of failing silently
- handles an empty company list
- refreshes data safely
- uses BigInt-safe JSON serialization on the API
- has an API client that handles non-JSON errors safely

After replacing the source, restart Vite/backend so the browser loads the updated bundle.

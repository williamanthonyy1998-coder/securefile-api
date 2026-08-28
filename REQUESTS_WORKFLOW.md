# SecureFile access-request workflow

1. A user requests access to exactly one file or folder.
2. The API rejects self-requests and rejects requests where the requester already has view access.
3. The approver selector is populated only from company users who currently have `share` permission for that resource.
4. The request creates one AccessRequest and one Approval record in a transaction.
5. The requester sees only their own request history.
6. The approver sees only Approval records assigned to them, never their own requests.
7. Approve/Reject is server-authorized by `approverId`; client-side filtering is not a security boundary.
8. Approval creates an internal Share for the requester with view permission and the requested download permission.
9. Rejection grants no access.
10. A requester cannot approve, reject, or mutate their own request.

For personal folders, the owner (or an explicitly shared user with Share permission) must approve; company-admin privilege does not bypass personal-folder privacy.

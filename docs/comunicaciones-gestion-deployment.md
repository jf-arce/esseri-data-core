# Communications management deployment

Keep the integration pull request in draft until the backend and frontend reviews are complete. Do not deploy either slice on its own.

## Release checklist

1. Apply the release's full Alembic migration chain before serving traffic. Both withdrawal and editing migrations are prerequisites for ordinary Communications reads.
2. Verify that an active publication is visible to its recipients and that withdrawing it removes it from the inbox, calendar, and notification list. Its existing link must open the withdrawal notice, not the original message.
3. Use a controlled test recipient to verify the withdrawal email and retry behavior before enabling the production rollout.

## Rollback restriction

After a withdrawal, draft deletion, or published edit has been recorded, use a fix-forward rollback strategy: leave the new schema in place and deploy a version that understands the new fields. An application-only rollback to a version predating this feature can expose withdrawn publications again, restore deleted drafts to listings, or show original content instead of its correction. The Alembic downgrade guards do not prevent an application-only rollback.

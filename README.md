# Backend TODO & Feature Status

## Planned (TODO)
- [ ] Add notification feature
- [ ] Add streak enabling
- [ ] Badges support
- [ ] Multilanguage support
- [ ] Private account
- [ ] Following feature
- [ ] Add tiles
- [ ] PWA support
- [ ] Filtering expenses
- [ ] Analytical support

## Implemented
- [x] Add expense with validation, payment mode normalization, and optional `occurredAt` (defaults to now)
- [x] Fetch daily expenses by local date with timezone offset handling and hidden/onlyHidden filters
- [x] Soft hide/restore expenses via `deleted` flag
- [x] Update expense fields (amount, category, notes, payment mode, currency, occurredAt)
- [x] Auth-protected routes using `userAuth`

## Axiom logging
- Install `@axiomhq/js` (already added to this project).
- Configure the following environment variables so logs ingest to Axiom; otherwise the logger falls back to console in non-production:

```
AXIOM_TOKEN=your-axiom-api-token
AXIOM_ORG_ID=your-org-id       # optional if you use the default US region
AXIOM_DATASET=expense-tracker
```
- The middleware in [src/app.ts](src/app.ts#L19-L40) sends request logs with method, path, status, duration, IP, and user agent.

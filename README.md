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

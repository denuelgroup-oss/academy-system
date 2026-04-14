# Currency to USD Task

## Steps
- [x] 1. Create TODO.md
- [ ] 2. Edit public_html/assets/js/app.js: Update fmtCurrency from 'L ' → '$ '
- [x] 3. Edit public_html/expenses.html: Replace all "L 0.00"/"L0.00" → "$ 0.00"/"$0.00", "Net bal. L0.00" → "Net bal. $0.00"
- [x] 4. Verify: Open public_html/expenses.html (command below)
- [ ] 5. Complete task

## Test Command
```bash
cd public_html && python -m http.server 8000
```
View http://localhost:8000/expenses.html – check "$ 0.00" displays.

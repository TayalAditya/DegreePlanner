# Approved Students Import

## Simple CSV Format

Place your CSV file here: `approved-students.csv`

### Format: One roll number per line

```
b23243
b23244
b23245
b22156
b24001
```

That's it! The script will:
- ✅ Generate email: `rollnumber@students.iitmandi.ac.in`
- ✅ Extract batch year from roll number (b23xxx = 2023)
- ✅ Auto-fill name from Google when student logs in
- ✅ Student sets their branch in settings after first login

## How to Import:

1. Create `approved-students.csv` with roll numbers
2. Run: `npm run import-users`
3. Done! Only approved students can login.

## Example CSV:
```
b23243
b23244
b22156
```

## Also supports Excel:
- Save as `approved-students.xlsx` with roll numbers in first column

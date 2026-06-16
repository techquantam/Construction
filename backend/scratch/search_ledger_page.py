import re

file_path = r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\ledger\page.tsx"

terms = ["qty", "unit", "rate", "plotMeasurement", "debitAmount"]

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    line_num = i + 1
    for term in terms:
        if re.search(r'\b' + term + r'\b', line, re.IGNORECASE):
            print(f"Line {line_num}: {line.strip()}")
            break

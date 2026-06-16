import re

file_path = r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\ledger\page.tsx"

terms = ["TableHead", "QTY", "UNIT", "RATE", "qtyValForPlot"]

with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    line_num = i + 1
    for term in terms:
        if re.search(r'\b' + term + r'\b', line, re.IGNORECASE):
            safe_line = line.strip().encode('ascii', errors='ignore').decode('ascii')
            print(f"Line {line_num}: {safe_line}")
            break

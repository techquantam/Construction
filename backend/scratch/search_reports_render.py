with open(r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\reports\page.tsx", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    line_num = i + 1
    if 'reportType === "daybook"' in line or 'reportType === "ledger"' in line or 'reportType == "daybook"' in line or 'reportType == "ledger"' in line:
        safe_line = line.strip().encode('ascii', errors='ignore').decode('ascii')
        print(f"Line {line_num}: {safe_line}")

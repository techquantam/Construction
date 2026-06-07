with open(r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\ledger\page.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if ".select()" in line:
        print(f"Line {i+1}: {line.strip()}")

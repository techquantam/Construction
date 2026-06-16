with open(r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\reports\page.tsx", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

if "parseInputDate" in content:
    print("Found parseInputDate!")
else:
    print("parseInputDate not found.")

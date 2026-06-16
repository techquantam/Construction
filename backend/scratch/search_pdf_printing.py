import os
import re

frontend_dir = r"c:\Users\ADMIN\Desktop\Building\frontend\src"

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith((".tsx", ".ts", ".js")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "jspdf" in content.lower() or "print" in content.lower():
                    print(f"File: {path}")
                    lines = content.splitlines()
                    count = 0
                    for idx, line in enumerate(lines):
                        if "jspdf" in line.lower() or "autotable" in line.lower() or "print" in line.lower():
                            safe_line = line.strip().encode('ascii', errors='ignore').decode('ascii')
                            print(f"  Line {idx+1}: {safe_line}")
                            count += 1
                            if count > 10:
                                print("  ... truncated ...")
                                break
                    print("-" * 50)

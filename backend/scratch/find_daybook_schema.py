import os
import re

backend_dir = r"c:\Users\ADMIN\Desktop\Building\backend"

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith((".ts", ".js", ".json", ".prisma")):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if "model Daybook" in content or "Schema" in content:
                    print(f"File: {path}")
                    # print some lines of the schema
                    lines = content.splitlines()
                    for line in lines[:50]:
                        print(line)
                    print("-" * 50)

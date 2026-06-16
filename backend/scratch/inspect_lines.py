file_path = r"c:\Users\ADMIN\Desktop\Building\frontend\src\app\(dashboard)\challan\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(2465, 2520):
    print(f"{i+1}: {repr(lines[i])}")

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

lines = text.split('\n')
for idx, line in enumerate(lines):
    if "'" in line:
        # Ignore lines that are comments or js strings (which typically start or end with ')
        # Let's print all of them anyway to be safe
        print(f"Line {idx+1}: {line.strip()}")

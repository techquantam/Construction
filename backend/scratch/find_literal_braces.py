with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

lines = text.split('\n')
for idx, line in enumerate(lines):
    # Check if } is used as text, e.g. not preceded by spaces or part of JS structure
    if "}" in line:
        stripped = line.strip()
        # If the line contains } but it looks like text (e.g. inside JSX text)
        # Let's print any line containing } that is inside JSX render area
        if idx >= 1072 and idx <= 2176:
            # Let's print it to examine
            print(f"Line {idx+1}: {stripped}")

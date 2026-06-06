with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text_normalized = text.replace("\r\n", "\n")
lines = text_normalized.split('\n')

# Line 2175 is index 2174, let's insert after it
print("Line 2175:", repr(lines[2174]))
lines.insert(2175, "    </div>")

new_content = '\n'.join(lines)

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Missing closing div added successfully!")

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text_normalized = text.replace("\r\n", "\n")
lines = text_normalized.split('\n')

# Line 1952 is index 1951
print("Line 1952 before:", repr(lines[1951]))
lines[1951] = "      )}" # This must be exactly closing parenthesis ) followed by closing brace }

# Line 2173 is index 2172
print("Line 2173 before:", repr(lines[2172]))
lines[2172] = "      )}" # This must be exactly closing parenthesis ) followed by closing brace }

new_content = '\n'.join(lines)

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Both modals corrected with ) followed by } successfully!")

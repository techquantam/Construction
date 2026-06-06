with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text_normalized = text.replace("\r\n", "\n")

# Correct the first modal (showCreateLedgerModal) ending at line 1952
# We normalize any incorrect closing tags to the correct ')}'
lines = text_normalized.split('\n')

print("Original line 1952:", repr(lines[1951]))
lines[1951] = "      )}"

print("Original line 2173:", repr(lines[2172]))
lines[2172] = "      )}"

new_content = '\n'.join(lines)

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Both modals adjusted successfully!")

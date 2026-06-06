with open("frontend/src/app/(dashboard)/daybook/page.tsx", "rb") as f:
    content = f.read()

# Replace any \r\r\n or \r\n with \n, then write back with standard LF \n
cleaned = content.replace(b"\r\r\n", b"\n").replace(b"\r\n", b"\n").replace(b"\r", b"\n")

with open("frontend/src/app/(dashboard)/daybook/page.tsx", "wb") as f:
    f.write(cleaned)

print("Line endings cleaned successfully!")

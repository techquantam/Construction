with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

target = '<span className="w-32 text-left uppercase tracking-wide">PARTY\'S NAME :</span>'
replacement = '<span className="w-32 text-left uppercase tracking-wide">{"PARTY\'S NAME :"}</span>'

if target in text:
    text = text.replace(target, replacement)
    with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
        f.write(text)
    print("PARTY'S NAME single quote wrapped successfully!")
else:
    # Try with different endings or normalized spacing
    text_norm = text.replace("\r\n", "\n")
    target_norm = '<span className="w-32 text-left uppercase tracking-wide">PARTY\'S NAME :</span>'
    if target_norm in text_norm:
        text_norm = text_norm.replace(target_norm, replacement)
        with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
            f.write(text_norm)
        print("PARTY'S NAME single quote wrapped successfully (normalized)!")
    else:
        print("Target not found for single quote wrap!")

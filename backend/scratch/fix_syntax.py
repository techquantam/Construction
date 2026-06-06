with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
    text = f.read()

text_normalized = text.replace("\r\n", "\n")
target = "            </form>\n          </div>\n        </div>\n      )}"
replacement = "            </form>\n          </div>\n        </div>\n      )})"

if target in text_normalized:
    text_normalized = text_normalized.replace(target, replacement)
    text_crlf = text_normalized.replace("\n", "\r\n")
    with open("frontend/src/app/(dashboard)/daybook/page.tsx", "w", encoding="utf-8") as f:
        f.write(text_crlf)
    print("Replacement successful!")
else:
    print("Target not found!")

import re

def check_tags():
    with open("frontend/src/app/(dashboard)/daybook/page.tsx", "r", encoding="utf-8") as f:
        text = f.read()

    lines = text.split('\n')
    jsx_lines = lines[1071:2176]
    jsx_text = '\n'.join(jsx_lines)

    i = 0
    length = len(jsx_text)
    tag_stack = []
    
    def get_line_num(pos):
        return jsx_text[:pos].count('\n') + 1072

    while i < length:
        char = jsx_text[i]
        
        # Skip JSX comments
        if jsx_text[i:i+3] == '{/*':
            end = jsx_text.find('*/}', i)
            if end != -1:
                i = end + 3
            else:
                i += 3
            continue
            
        # Skip HTML comments
        if jsx_text[i:i+4] == '<!--':
            end = jsx_text.find('-->', i)
            if end != -1:
                i = end + 4
            else:
                i += 4
            continue
            
        # Tag matching
        if char == '<':
            if i + 1 < length and jsx_text[i+1] == '/':
                end = jsx_text.find('>', i)
                if end != -1:
                    tag_content = jsx_text[i+2:end].strip()
                    tag_name = tag_content.split()[0] if tag_content else ""
                    tag_name = re.sub(r'[^a-zA-Z0-9.-]', '', tag_name)
                    line_num = get_line_num(i)
                    
                    if tag_stack:
                        top = tag_stack.pop()
                        if top[0] != tag_name:
                            print(f"Mismatched closing tag </{tag_name}> on line {line_num}. Expected </{top[0]}> (opened on line {top[1]})")
                            tag_stack.append(top)
                        else:
                            if tag_name.lower() == 'div':
                                print(f"Div closed: popped div from line {top[1]} at line {line_num}")
                    else:
                        print(f"Extra closing tag </{tag_name}> on line {line_num}")
                    i = end + 1
                    continue
            
            # Opening tag
            match = re.match(r'^<([a-zA-Z][a-zA-Z0-9.-]*)', jsx_text[i:])
            if match:
                tag_name = match.group(1)
                scan = i + len(tag_name) + 1
                tag_end = -1
                in_dq = False
                in_sq = False
                
                while scan < length:
                    c = jsx_text[scan]
                    if c == '"' and not in_sq:
                        in_dq = not in_dq
                    elif c == "'" and not in_dq:
                        in_sq = not in_sq
                    elif not in_dq and not in_sq:
                        if c == '>':
                            tag_end = scan
                            break
                    scan += 1
                    
                if tag_end != -1:
                    is_self_closing = False
                    if jsx_text[tag_end-1] == '/':
                        is_self_closing = True
                    elif jsx_text[tag_end-2:tag_end] == '/>':
                        is_self_closing = True
                        
                    if tag_name.lower() in ['input', 'br', 'hr', 'img', 'meta', 'link', 'textarea']:
                        is_self_closing = True
                        
                    if not is_self_closing:
                        line_num = get_line_num(i)
                        tag_stack.append((tag_name, line_num))
                        if tag_name.lower() == 'div':
                            print(f"Div opened: pushed div from line {line_num}")
                    i = tag_end + 1
                    continue
                    
        i += 1
        
    print("Check finished.")
    print("Unclosed tags stack size:", len(tag_stack))
    for t in tag_stack:
        print(f"  <{t[0]}> opened on line {t[1]} was never closed")

if __name__ == '__main__':
    check_tags()

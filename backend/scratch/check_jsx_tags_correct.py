import re

def check_jsx_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    i = 0
    length = len(content)
    
    in_single_quote = False
    in_double_quote = False
    in_backtick = False
    in_line_comment = False
    in_block_comment = False
    
    tag_stack = []
    
    def get_line_num(pos):
        return content[:pos].count('\n') + 1
        
    while i < length:
        char = content[i]
        
        # Handle escape sequence
        if char == '\\' and (in_single_quote or in_double_quote or in_backtick):
            i += 2
            continue
            
        # Handle comments
        if in_line_comment:
            if char == '\n':
                in_line_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if char == '*' and i + 1 < length and content[i+1] == '/':
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue
            
        # Handle strings
        if in_single_quote:
            if char == "'":
                in_single_quote = False
            i += 1
            continue
            
        if in_double_quote:
            if char == '"':
                in_double_quote = False
            i += 1
            continue
            
        if in_backtick:
            if char == '`':
                in_backtick = False
            i += 1
            continue
            
        # Comment check
        if char == '/' and i + 1 < length:
            if content[i+1] == '/':
                in_line_comment = True
                i += 2
                continue
            elif content[i+1] == '*':
                in_block_comment = True
                i += 2
                continue
                
        # String check
        if char == "'":
            in_single_quote = True
            i += 1
            continue
        if char == '"':
            in_double_quote = True
            i += 1
            continue
        if char == '`':
            in_backtick = True
            i += 1
            continue
            
        # JSX Tag Check (only outside strings/comments)
        # Filters out TS generics like useState<string> by ensuring '<' is not preceded by an alphanumeric char
        if char == '<' and (i == 0 or not content[i-1].isalnum() or content[i-1] == ' '):
            
            # Check if it's a comment start <!--
            if content[i:i+4] == '<!--':
                end_idx = content.find('-->', i)
                if end_idx != -1:
                    i = end_idx + 3
                else:
                    i += 4
                continue
                
            # Check if it's a closing tag </Tag>
            if i + 1 < length and content[i+1] == '/':
                end_idx = content.find('>', i)
                if end_idx != -1:
                    tag_name = content[i+2:end_idx].strip().split()[0]
                    tag_name = re.sub(r'[^a-zA-Z0-9.-]', '', tag_name)
                    line_num = get_line_num(i)
                    if tag_stack:
                        top = tag_stack.pop()
                        if top[0] != tag_name:
                            print(f"Mismatched closing tag </{tag_name}> on line {line_num}. Expected </{top[0]}> (opened on line {top[1]})")
                            tag_stack.append(top)
                    else:
                        print(f"Extra closing tag </{tag_name}> on line {line_num}")
                    i = end_idx + 1
                    continue
                    
            # Check if it's a regular tag <Tag
            match = re.match(r'^<([a-zA-Z][a-zA-Z0-9.-]*)', content[i:])
            if match:
                tag_name = match.group(1)
                tag_end_idx = -1
                in_tag_double_quote = False
                in_tag_single_quote = False
                scan_idx = i + len(tag_name) + 1
                
                while scan_idx < length:
                    scan_char = content[scan_idx]
                    if scan_char == '"' and not in_tag_single_quote:
                        in_tag_double_quote = not in_tag_double_quote
                    elif scan_char == "'" and not in_tag_double_quote:
                        in_tag_single_quote = not in_tag_single_quote
                    elif not in_tag_double_quote and not in_tag_single_quote:
                        if scan_char == '>':
                            tag_end_idx = scan_idx
                            break
                    scan_idx += 1
                    
                if tag_end_idx != -1:
                    is_self_closing = False
                    if content[tag_end_idx-1] == '/':
                        is_self_closing = True
                    elif content[tag_end_idx-2:tag_end_idx] == '/>':
                        is_self_closing = True
                        
                    # Treat standard HTML self-closing tags as self-closing
                    if tag_name.lower() in ['input', 'br', 'hr', 'img', 'meta', 'link']:
                        is_self_closing = True
                        
                    if not is_self_closing:
                        tag_stack.append((tag_name, get_line_num(i)))
                        
                    i = tag_end_idx + 1
                    continue
                    
        i += 1
        
    print("JSX tag checking finished.")
    print("Unclosed tags remaining in stack:", len(tag_stack))
    for tag in tag_stack:
        print(f"  Tag <{tag[0]}> opened on line {tag[1]} was never closed")

if __name__ == '__main__':
    check_jsx_tags('frontend/src/app/(dashboard)/daybook/page.tsx')

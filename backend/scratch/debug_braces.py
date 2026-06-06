import sys

def debug_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Total character length:", len(content))
    print("Total lines in split:", len(content.split('\n')))
    print("Total lines by content.count('\\n'):", content.count('\n'))

    brace_stack = []
    
    i = 0
    length = len(content)
    line_num = 1
    col_num = 1
    
    in_single_quote = False
    in_double_quote = False
    in_backtick = False
    in_line_comment = False
    in_block_comment = False
    
    while i < length:
        char = content[i]
        
        # Line/col tracking
        if char == '\n':
            line_num += 1
            col_num = 1
        else:
            col_num += 1
            
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
            
        # Braces
        if char == '{':
            brace_stack.append(('brace', line_num, col_num))
        elif char == '}':
            if brace_stack:
                top = brace_stack.pop()
                
        elif char == '(':
            brace_stack.append(('paren', line_num, col_num))
        elif char == ')':
            found = False
            temp_stack = []
            while brace_stack:
                top = brace_stack.pop()
                if top[0] == 'paren':
                    found = True
                    break
                else:
                    temp_stack.append(top)
            if not found:
                brace_stack.extend(reversed(temp_stack))
            else:
                brace_stack.extend(reversed(temp_stack))
                
        i += 1
        
    print(f"End state - in_single_quote: {in_single_quote}, in_double_quote: {in_double_quote}, in_backtick: {in_backtick}, in_line_comment: {in_line_comment}, in_block_comment: {in_block_comment}")
    print(f"Unmatched elements in stack: {len(brace_stack)}")
    for elem in brace_stack:
        print(f"Unmatched: {elem}")

if __name__ == '__main__':
    debug_file('frontend/src/app/(dashboard)/daybook/page.tsx')

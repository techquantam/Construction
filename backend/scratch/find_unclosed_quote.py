import sys

def find_unclosed_quote(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    i = 0
    length = len(content)
    line_num = 1
    col_num = 1
    
    in_single_quote = False
    in_double_quote = False
    in_backtick = False
    in_line_comment = False
    in_block_comment = False
    
    quote_start_line = 0
    quote_start_col = 0
    
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
            quote_start_line = line_num
            quote_start_col = col_num
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
            
        i += 1
        
    if in_single_quote:
        print(f"Unclosed single quote started at line {quote_start_line}, col {quote_start_col}")
        # print context around the start line
        lines = content.split('\n')
        start_idx = max(0, quote_start_line - 3)
        end_idx = min(len(lines), quote_start_line + 3)
        for idx in range(start_idx, end_idx):
            prefix = ">>> " if idx == quote_start_line - 1 else "    "
            print(f"{prefix}{idx+1}: {lines[idx]}")
    else:
        print("No unclosed single quote found!")

if __name__ == '__main__':
    find_unclosed_quote('frontend/src/app/(dashboard)/daybook/page.tsx')

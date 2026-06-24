
import re

with open('C:/Users/yuanx/Desktop/mud游戏/saibo-xiuxian/src/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the admin section boundaries
start_marker = '// ===== ADMIN PANEL ====='
end_marker = 'res.send(html);\n});'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("ERROR: Could not find admin section markers")
    exit(1)

end_idx += len(end_marker)

old_section = content[start_idx:end_idx]
print(f"Found admin section: {len(old_section)} chars at offset {start_idx}")
print(f"First 100 chars: {old_section[:100]}")
print(f"Last 100 chars: {old_section[-100:]}")


import sys

with open('C:/Users/yuanx/Desktop/mud游戏/saibo-xiuxian/src/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '// ===== ADMIN PANEL ====='
# Find the closing of the admin GET route
start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: start marker not found")
    sys.exit(1)

# Find the next section marker after admin panel
next_marker = '// ===== Phase 7'
end_idx = content.find(next_marker, start_idx)
if end_idx == -1:
    print("ERROR: end marker not found")
    sys.exit(1)

old_section = content[start_idx:end_idx]
print(f"Removing {len(old_section)} chars from offset {start_idx}")

# Read the new admin section
with open('C:/Users/yuanx/Desktop/mud游戏/saibo-xiuxian/new_admin.js', 'r', encoding='utf-8') as f:
    new_admin = f.read()

new_content = content[:start_idx] + new_admin + '\n\n' + content[end_idx:]

with open('C:/Users/yuanx/Desktop/mud游戏/saibo-xiuxian/src/server.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"SUCCESS: Replaced admin section. New file: {len(new_content)} chars")

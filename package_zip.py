import zipfile
import os
import shutil

zip_filename = 'netlify-ready-game.zip'

files_and_dirs = [
    'netlify.toml',
    'package.json',
    'package-lock.json',
    'words.js',
    'README.md',
    'public',
    'netlify'
]

print("Creating POSIX-compliant zip archive...")
with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for item in files_and_dirs:
        if os.path.isfile(item):
            # Normalize with forward slash
            arcname = item.replace('\\', '/')
            zipf.write(item, arcname)
            print(f"Added file: {arcname}")
        elif os.path.isdir(item):
            for root, dirs, files in os.walk(item):
                for f in files:
                    full_path = os.path.join(root, f)
                    arcname = full_path.replace('\\', '/')
                    zipf.write(full_path, arcname)
                    print(f"Added dir file: {arcname}")

# Copy to Desktop
desktop_dir = os.path.join(os.path.expanduser('~'), 'OneDrive', 'Desktop')
if not os.path.exists(desktop_dir):
    desktop_dir = os.path.join(os.path.expanduser('~'), 'Desktop')

desktop_dest = os.path.join(desktop_dir, zip_filename)
shutil.copy2(zip_filename, desktop_dest)
print(f"✓ Copied successfully to: {desktop_dest}")

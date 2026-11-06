import os
import glob
import re
import subprocess

print("Installing GitHub Copilot...")
os.system("code --install-extension GitHub.copilot")

print("Applying HTML and CSS updates...")
def update_files(file_pattern, replacements):
    for path in glob.glob(file_pattern, recursive=True):
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            for old, new in replacements:
                content = re.sub(old, new, content)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception:
            pass

global_replacements = [
    (r"max-height:\s*90vh", "max-height: 80vh"),
    (r"<i>ALR</i>", "ALR"),
    (r"<textarea([^>]*)>", r'<textarea\1 style="resize: vertical; max-width: 100%;">'),
    (r"padding:\s*0;", "padding: 20px; overflow: hidden;")
]
update_files("**/*.html", global_replacements)

tech_replacements = [
    (r"Applications</h2>", "Apps</h2>"),
    (r"Home \|\|", "Tech ||")
]
update_files("tech/index.html", tech_replacements)

suite_replacements = [
    (r"Expand All", "Show All"),
    (r"Collapse All", "Show All")
]
update_files("suite/index.html", suite_replacements)

print("Installing webp tools...")
os.system("brew install webp")

print("Committing and pushing to GitHub...")
os.system("git add . && git commit -m 'Apply all layout and text updates' && git push")
print("Update complete.")
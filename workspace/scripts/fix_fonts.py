import re

for fname, color_main, color_light in [
    ("spanish-hw-gusano-watercolor.html", "#6b8c5a", "#8bab6e"),
    ("spanish-hw-lombriz-watercolor.html", "#8b6b4a", "#a88b6a")
]:
    with open(fname, "r") as f:
        html = f.read()
    
    # Add ABeeZee font import (clean print/school font)
    html = html.replace(
        "@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Patrick+Hand&display=swap');",
        "@import url('https://fonts.googleapis.com/css2?family=ABeeZee&family=Caveat:wght@400;600;700&family=Patrick+Hand&display=swap');"
    )
    
    # Change letter-big to print font
    html = re.sub(
        r'\.letter-big \{[^}]+\}',
        f""".letter-big {{
  font-family: 'ABeeZee', sans-serif;
  font-size: 80pt;
  color: {color_main};
  font-weight: 400;
  line-height: 1;
}}""",
        html
    )
    
    # Change letter-small to print font
    html = re.sub(
        r'\.letter-small \{[^}]+\}',
        f""".letter-small {{
  font-family: 'ABeeZee', sans-serif;
  font-size: 60pt;
  color: {color_light};
  font-weight: 400;
  line-height: 1;
}}""",
        html
    )
    
    # Change trace-letter to print font
    html = re.sub(
        r'\.trace-letter \{[^}]+\}',
        """.trace-letter {
  font-family: 'ABeeZee', sans-serif;
  font-size: 36pt;
  color: #c8b99a;
  margin-right: 0.3in;
  position: relative;
  bottom: -0.05in;
}""",
        html
    )
    
    with open(fname, "w") as f:
        f.write(html)
    print(f"Fixed {fname}")


# Maze / puzzle practice

Golden anchor: pass `anchorIds: ["geometry-maze"]` to generate_image
so the output matches the Homa maze-practice bar (labeled START and
FINISH flags, a problem at every decision point with two answer
choices, the correct answer advancing the path, light themed
doodles). Write your own prompt with your own content; the anchor
sets the visual bar, not the specifics.

A maze that transforms rote drill into a navigation challenge.
Correct answers advance through the maze; wrong answers hit dead
ends. Self-checking without needing an answer key. This is the format
when the parent asks for mazes, puzzle worksheets, or gamified
practice.

Works for: math facts (follow the correct products), phonics (follow
the CVC words), vocabulary matching, sight words, any fact-based
drill that has right/wrong answers.

Design patterns (all binding for mazes):

- **Clear start/finish markers**: labeled "START" and "FINISH" with
  bold borders or arrows. The child knows exactly where to begin.
- **Decision points with answer choices**: each fork in the path
  presents a problem or question. The correct answer leads forward;
  wrong answers dead-end visibly.
- **Dead ends are visible**: wrong paths should clearly terminate
  (wall, blocked path) so the child self-corrects without an
  answer key.
- **Progressive difficulty**: early decision points are easier;
  later ones are harder. Graduated on-ramp within one maze.
- **Themed illustrations**: the maze path can weave through themed
  artwork (space, jungle, ocean) to make it visually engaging.
- **Answer labels at decision points**: large, clear text for each
  answer choice (`font-size: 18px; font-weight: 600;`).
- **Path width**: wide enough for a pencil line (~20px visual width
  in the maze artwork).

```html
<style>
  .maze-container { position: relative; width: 100%; }
  .maze-img { width: 100%; display: block; }
  .maze-label { position: absolute; font-family: 'Fredoka', sans-serif;
    font-size: 18px; font-weight: 600; color: var(--homa-ink);
    background: rgba(255,255,255,0.85); padding: 2px 8px;
    border-radius: 4px; }
  .maze-start { position: absolute; font-family: 'Fredoka', sans-serif;
    font-size: 14px; font-weight: 700; color: #4caf50;
    letter-spacing: 0.1em; text-transform: uppercase; }
  .maze-finish { position: absolute; font-family: 'Fredoka', sans-serif;
    font-size: 14px; font-weight: 700; color: #e25b45;
    letter-spacing: 0.1em; text-transform: uppercase; }
</style>

<div class="maze-container">
  <img class="maze-img" src="{generated_maze_image_url}" alt="practice maze" />
  <span class="maze-start" style="top: 5%; left: 8%;">Start</span>
  <span class="maze-finish" style="bottom: 5%; right: 8%;">Finish</span>
  <!-- Position answer labels at each decision point -->
  <span class="maze-label" style="top: 20%; left: 30%;">7 x 8 = 56</span>
  <span class="maze-label" style="top: 20%; left: 60%;">7 x 8 = 54</span>
  <!-- repeat for each fork -->
</div>
```

Path choice: hybrid is preferred. Use generate_image for the maze
artwork and paths (the organic, hand-drawn feel is the whole point),
then overlay answer labels at decision points with HTML absolute
positioning. For very simple mazes (few forks, no theming),
image-direct works. Include the answer text in the image prompt.

# Be a Nobody at Rome

A local Flask web game about ordinary, low-status lives in Ancient Rome. The game is still powered by JSON, but you can now write stories in easy `.txt` files and run a converter instead of manually building complicated JSON.

## Run the Game

### Option 1: Flask

```bash
pip install -r requirements.txt
python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

### Option 2: Live Server / Simple Web Server

Open the root file:

```text
index.html
```

If you use VS Code Live Server, open the project folder `rome_nobody_game/`, then start Live Server from the root `index.html`. This mode loads:

```text
data/stories.json
data/achievements.json
static/css/style.css
static/js/game.js
```

## Convert Raw Story Text

Paste story text into files inside:

```text
data/raw_stories/
```

Then run:

```bash
python convert_story.py
```

The converter reads every `.txt` file in `data/raw_stories/` and rewrites:

```text
data/stories.json
```

The game loads `stories.json`, so run the converter again whenever you change a raw story file.

## Simple Story Format

Use this when the story is just dates in order with no choices:

```text
TITLE: The Fighter
ROLE: gladiator

83 B.C. ;; First event text here.
More lines for the same date can go here.

80 B.C. ;; Next event text here.
More lines for the next date can go here.
```

In simple format:

- `TITLE` becomes the story title shown on the story screen.
- `ROLE` must be one of `gladiator`, `poet`, `blacksmith`, `merchant`, `soldier`, or `builder`.
- The date and first story line are separated by `;;`.
- IDs are created automatically.
- Each block connects to the next block automatically.
- The last block becomes an ending automatically.

## Structured Story Format

Use this when you need exact IDs, images, branches, endings, or achievements:

```text
TITLE: The Fighter
ROLE: gladiator
START: fighter_83

---
DATE: 83 B.C.
ID: fighter_83
TEXT:
You are born into a family in a small tribe.
Your mother luckily did not die during childbirth.
NEXT: fighter_choice

---
DATE: 73 B.C.
ID: fighter_choice
TEXT:
A slave whispers that men are planning to escape tonight.
CHOICES:
- Follow the rebels => fighter_rebel
- Stay in the school => fighter_school

---
DATE: 71 B.C.
ID: fighter_rebel
TEXT:
You followed the rebellion south.
ENDING: true
ACHIEVEMENT: gladiator_rebel_ending
```

Supported structured fields:

- `DATE`: heading shown before the text.
- `ID`: unique node name.
- `TEXT`: story text. Multiple lines are allowed.
- `IMAGE`: optional image path.
- `NEXT`: next node for a normal Continue button.
- `CHOICES`: decision buttons, written as `- Button label => target_node`.
- `RANDOM_CHOICES`: hidden random branches, written like choices. The player will not pick; the game chooses one randomly.
- `ENDING`: use `true` for an ending node.
- `ACHIEVEMENT`: achievement ID to unlock at the ending.

Example random branch:

```text
RANDOM_CHOICES:
- Poor scenario => poet_poor_start
- Rich scenario => poet_rich_start
```

## Add Images

Put image files in:

```text
static/images/
```

Reference them in a structured block:

```text
IMAGE: /static/images/gladiator_1.png
```

If the image is missing, the game skips it and continues.

## Add Achievements

Achievements are defined in:

```text
data/achievements.json
```

Example:

```json
"gladiator_rebel_ending": {
  "title": "Chains Broken",
  "description": "You followed rebellion into history.",
  "role": "Gladiator"
}
```

Reference the same ID from an ending block:

```text
ENDING: true
ACHIEVEMENT: gladiator_rebel_ending
```

Unlocked achievements are saved in browser `localStorage`, so they stay unlocked after refresh.

## Project Structure

```text
rome_nobody_game/
├── app.py
├── convert_story.py
├── requirements.txt
├── README.md
├── data/
│   ├── raw_stories/
│   │   ├── gladiator.txt
│   │   ├── poet.txt
│   │   ├── blacksmith.txt
│   │   ├── merchant.txt
│   │   ├── soldier.txt
│   │   └── builder.txt
│   ├── stories.json
│   └── achievements.json
├── static/
│   ├── css/style.css
│   ├── js/game.js
│   ├── images/
│   └── sounds/achievement.mp3
└── templates/index.html
```

## JSON Notes

You normally should not edit `data/stories.json` by hand now. Edit `data/raw_stories/*.txt`, then run `python convert_story.py`.

You can still edit `data/achievements.json` directly because it is short and separate from the story text.

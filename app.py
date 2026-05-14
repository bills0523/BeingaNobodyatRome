import json
from pathlib import Path

from flask import Flask, jsonify, render_template


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__)


@app.route("/")
def index():
    """Serve the single-page game interface."""
    return render_template("index.html")


@app.route("/data/stories")
def stories():
    """Send story data to the browser as JSON."""
    return jsonify(_read_json("stories.json"))


@app.route("/data/achievements")
def achievements():
    """Send achievement data to the browser as JSON."""
    return jsonify(_read_json("achievements.json"))


def _read_json(filename):
    path = DATA_DIR / filename
    with path.open(encoding="utf-8") as file:
        return json.load(file)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

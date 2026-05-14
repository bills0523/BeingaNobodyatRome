import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "data" / "raw_stories"
OUTPUT_PATH = BASE_DIR / "data" / "stories.json"

ROLE_NAMES = {
    "gladiator": "Gladiator",
    "poet": "Poet",
    "blacksmith": "Blacksmith",
    "merchant": "Merchant",
    "soldier": "Soldier",
    "builder": "Builder",
}

FIELD_NAMES = {
    "DATE",
    "ID",
    "TEXT",
    "IMAGE",
    "NEXT",
    "CHOICES",
    "RANDOM_CHOICES",
    "ENDING",
    "ACHIEVEMENT",
}


def main():
    stories = {}

    for path in sorted(RAW_DIR.glob("*.txt")):
        raw_text = path.read_text(encoding="utf-8").strip()
        if not raw_text:
            continue

        story = parse_story(raw_text, path.stem)
        stories[story["role_key"]] = {
            "display_name": ROLE_NAMES.get(story["role_key"], story["role_key"].title()),
            "intro_title": story["title"],
            "starting_node": story["starting_node"],
            "nodes": story["nodes"],
        }

    OUTPUT_PATH.write_text(json.dumps(stories, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(BASE_DIR)} with {len(stories)} role stories.")


def parse_story(raw_text, default_role):
    metadata, body = split_metadata(raw_text)
    role_key = metadata.get("ROLE", default_role).strip().lower()
    title = metadata.get("TITLE", ROLE_NAMES.get(role_key, role_key.title())).strip()
    start = metadata.get("START", "").strip()

    if "---" in body or "DATE:" in body:
        nodes_in_order = parse_structured_blocks(body, role_key)
    else:
        nodes_in_order = parse_simple_blocks(body, role_key)

    if not nodes_in_order:
        raise ValueError(f"No story blocks found for role '{role_key}'.")

    connect_nodes(nodes_in_order)
    nodes = {node["id"]: node for node in nodes_in_order}
    starting_node = start or nodes_in_order[0]["id"]

    if starting_node not in nodes:
        raise ValueError(f"START points to missing node '{starting_node}' in role '{role_key}'.")

    return {
        "role_key": role_key,
        "title": title,
        "starting_node": starting_node,
        "nodes": nodes,
    }


def split_metadata(raw_text):
    metadata = {}
    body_lines = []
    in_body = False

    for line in raw_text.splitlines():
        stripped = line.strip()
        metadata_match = re.match(r"^(TITLE|ROLE|START):\s*(.*)$", stripped, re.IGNORECASE)

        if not in_body and metadata_match:
            metadata[metadata_match.group(1).upper()] = metadata_match.group(2).strip()
            continue

        if stripped:
            in_body = True
        body_lines.append(line)

    return metadata, "\n".join(body_lines).strip()


def parse_structured_blocks(body, role_key):
    raw_blocks = [block.strip() for block in re.split(r"(?m)^\s*---\s*$", body) if block.strip()]
    nodes = []

    for index, block in enumerate(raw_blocks):
        fields = parse_fields(block)
        date = fields.get("DATE", "").strip()
        node_id = fields.get("ID", "").strip() or make_node_id(role_key, date, index)
        text = fields.get("TEXT", "").strip()
        choices = parse_choices(fields.get("CHOICES", ""))
        random_choices = parse_choices(fields.get("RANDOM_CHOICES", ""))
        is_ending = parse_bool(fields.get("ENDING", "false"))

        nodes.append(make_node(
            node_id=node_id,
            date=date,
            text=text,
            image=blank_to_none(fields.get("IMAGE", "")),
            next_node=blank_to_none(fields.get("NEXT", "")),
            choices=choices,
            random_choices=random_choices,
            is_ending=is_ending,
            achievement=blank_to_none(fields.get("ACHIEVEMENT", "")),
        ))

    return nodes


def parse_fields(block):
    fields = {}
    current_field = None
    current_lines = []

    for line in block.splitlines():
        match = re.match(r"^([A-Z_]+):\s*(.*)$", line.strip(), re.IGNORECASE)
        field_name = match.group(1).upper() if match else ""

        if match and field_name in FIELD_NAMES:
            if current_field:
                fields[current_field] = "\n".join(current_lines).strip()
            current_field = field_name
            first_value = match.group(2)
            current_lines = [first_value] if first_value else []
        elif current_field:
            current_lines.append(line)

    if current_field:
        fields[current_field] = "\n".join(current_lines).strip()

    return fields


def parse_choices(raw_choices):
    choices = []

    for line in raw_choices.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        stripped = stripped[1:].strip() if stripped.startswith("-") else stripped
        if "=>" not in stripped:
            raise ValueError(f"Choice line must use '=>': {line}")

        label, next_node = stripped.split("=>", 1)
        choices.append({
            "label": label.strip(),
            "next_node": next_node.strip(),
        })

    return choices or None


def parse_simple_blocks(body, role_key):
    blocks = []
    current_date = ""
    current_lines = []

    for line in body.splitlines():
        if ";;" in line:
            if current_date:
                blocks.append((current_date, "\n".join(current_lines).strip()))
            current_date, first_text = line.split(";;", 1)
            current_date = current_date.strip()
            current_lines = [first_text.strip()]
        else:
            if current_date:
                current_lines.append(line.rstrip())

    if current_date:
        blocks.append((current_date, "\n".join(current_lines).strip()))

    nodes = []
    for index, (date, text) in enumerate(blocks):
        nodes.append(make_node(
            node_id=make_node_id(role_key, date, index),
            date=date,
            text=text,
        ))

    return nodes


def connect_nodes(nodes):
    for index, node in enumerate(nodes):
        has_choices = bool(node["choices"])
        has_random_choices = bool(node["random_choices"])
        has_next = bool(node["next_node"])

        if not node["is_ending"] and not has_choices and not has_random_choices and not has_next and index < len(nodes) - 1:
            node["next_node"] = nodes[index + 1]["id"]

    last = nodes[-1]
    if not last["choices"] and not last["random_choices"] and not last["next_node"]:
        last["is_ending"] = True


def make_node(
    node_id,
    date,
    text,
    image=None,
    next_node=None,
    choices=None,
    random_choices=None,
    is_ending=False,
    achievement=None,
):
    return {
        "id": node_id,
        "date": date,
        "text": text,
        "image": image,
        "next_node": next_node,
        "choices": choices,
        "random_choices": random_choices,
        "is_ending": is_ending,
        "achievement": achievement,
    }


def make_node_id(role_key, date, index):
    slug = re.sub(r"[^a-z0-9]+", "_", date.lower()).strip("_")
    return f"{role_key}_{slug or index + 1}"


def parse_bool(value):
    return str(value).strip().lower() in {"true", "yes", "1", "ending"}


def blank_to_none(value):
    value = str(value).strip()
    return value or None


if __name__ == "__main__":
    main()

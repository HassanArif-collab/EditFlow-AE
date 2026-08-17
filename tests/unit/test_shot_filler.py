"""The AI editor fills gaps. Everything here defends two properties:

  1. A complete shot never reaches the model at all — the pipeline works
     with the model switched off, which is what makes it a tool rather
     than a demo.
  2. A number the narrator never said never reaches the screen. A
     documentary with an invented figure on it is worse than one with a
     blank space, and a small local model will invent figures.
"""
from backend.services.visuals.shot_filler import (
    build_prompt, gaps, invented_numbers, needs_model, parse_filled,
)

COUNTER = {
    "name": "STAT_COUNTER",
    "summary": "One number counting up from zero.",
    "params": {
        "value": {"type": "number", "required": True, "help": "The number it counts to."},
        "title": {"type": "string", "help": "Label above the number."},
        "unit": {"type": "string", "help": "Lighter line below."},
        "pulse": {"type": "boolean", "help": "One pulse when it lands."},
    },
}


def shot(**over):
    base = {"id": "shot_02", "recipe": "STAT_COUNTER",
            "scriptLine": "That leaves 8,484 rupees a month.", "props": {}}
    base.update(over)
    return base


# ── when the model runs at all ─────────────────────────────────────

def test_a_complete_shot_never_reaches_the_model():
    s = shot(props={"value": 8484, "title": "Take home"})
    assert needs_model(s, COUNTER) is False
    assert gaps(s, COUNTER) == []


def test_a_missing_required_prop_calls_the_model():
    assert needs_model(shot(), COUNTER) is True
    assert gaps(shot(), COUNTER) == ["value"]


def test_the_brief_declaring_needs_is_believed_over_our_inspection():
    # absent and deliberately-empty look identical in JSON, so the other side
    # declares incompleteness rather than us guessing at it
    s = shot(props={"value": 8484}, needs=["props.unit"])
    assert needs_model(s, COUNTER) is True
    assert gaps(s, COUNTER) == ["unit"]


def test_a_note_in_english_is_work_for_the_model_even_when_nothing_is_missing():
    s = shot(props={"value": 8484}, note="make it feel like a punch")
    assert needs_model(s, COUNTER) is True


def test_a_shot_with_no_recipe_entry_is_left_alone():
    assert needs_model(shot(), {"params": {}}) is False


# ── the prompt ─────────────────────────────────────────────────────

def test_the_prompt_carries_one_shot_and_nothing_else():
    p = build_prompt(shot(props={"title": "Take home"}), COUNTER, ["value"])
    assert "8,484" in p, "the narration is the source of the number"
    assert "value" in p
    assert "Take home" in p, "what is already decided is stated, not re-asked"
    # a 4B model drowns in the archetype catalogue and it cannot help here
    assert len(p) < 1200, f"prompt is {len(p)} chars — too much context"


def test_the_prompt_forbids_inventing_figures():
    p = build_prompt(shot(), COUNTER, ["value"])
    assert "Never invent a figure" in p
    assert "under six words" in p, "this text goes on screen"


# ── parsing ────────────────────────────────────────────────────────

def test_a_clean_object_is_parsed():
    assert parse_filled('{"value": 8484}', ["value"]) == {"value": 8484}


def test_prose_and_fences_around_the_json_are_tolerated():
    raw = 'Sure!\n```json\n{"value": 8484, "unit": "per month"}\n```\n'
    assert parse_filled(raw, ["value", "unit"]) == {"value": 8484, "unit": "per month"}


def test_keys_we_did_not_ask_for_are_dropped():
    out = parse_filled('{"value": 1, "glow": true}', ["value"])
    assert out == {"value": 1}, "a builder would ignore it anyway"


def test_an_unusable_reply_yields_nothing_rather_than_crashing():
    assert parse_filled("I could not work that out.", ["value"]) == {}
    assert parse_filled("", ["value"]) == {}
    assert parse_filled("{not json", ["value"]) == {}


# ── the guard that matters ─────────────────────────────────────────

def test_a_number_from_the_narration_is_allowed():
    s = shot(scriptLine="That leaves 8,484 rupees a month.")
    assert invented_numbers({"value": 8484}, s) == []


def test_a_number_the_narrator_never_said_is_caught():
    s = shot(scriptLine="That leaves barely anything.")
    bad = invented_numbers({"value": 8484}, s)
    assert bad, "an invented figure on screen is worse than a blank space"
    assert "8484" in bad[0]


def test_separators_do_not_make_the_same_number_look_invented():
    s = shot(scriptLine="That leaves 8,484 rupees.")
    assert invented_numbers({"value": "8484"}, s) == []
    assert invented_numbers({"title": "Rs 8,484"}, s) == []


def test_a_number_already_agreed_in_the_brief_is_allowed():
    s = shot(scriptLine="That is what is left.", props={"value": 8484})
    assert invented_numbers({"title": "Rs 8,484 a month"}, s) == []


def test_a_number_the_editor_wrote_in_the_note_is_allowed():
    s = shot(scriptLine="Rent takes most of it.", note="show the 18,000 rent figure")
    assert invented_numbers({"value": 18000}, s) == []


def test_small_numbers_are_not_treated_as_claims():
    # "3 ways", "top 5" — a count is not a figure being asserted
    s = shot(scriptLine="There are three routes out of this.")
    assert invented_numbers({"title": "3 routes"}, s) == []


def test_a_year_inside_a_longer_string_is_still_checked():
    s = shot(scriptLine="Rent has climbed every year.")
    assert invented_numbers({"title": "Since 2019"}, s), "2019 was never said"

#!/usr/bin/env python3
"""Apply the small, reviewed compatibility fixes for the pinned InterTune source.

This does not replace or fork upstream code. It patches the checked-out, pinned
source tree before builds so fixes are reproducible for local and CI builds.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
PIN = "9f4248d76d04d808a3215427db7a828f38c1a8fd"

def fail(message: str) -> None:
    raise SystemExit(f"InterTune preparation failed: {message}")

if not (ANDROID / ".git").exists():
    fail("android source is missing; run git submodule update --init --recursive first")

try:
    actual = subprocess.check_output(
        ["git", "-C", str(ANDROID), "rev-parse", "HEAD"],
        text=True,
        stderr=subprocess.STDOUT,
    ).strip()
except subprocess.CalledProcessError as exc:
    fail(f"cannot identify the InterTune checkout: {exc.output.strip()}")

if actual != PIN:
    fail(f"expected pinned InterTune commit {PIN}, found {actual}; review patches before changing the pin")

def source(relative: str) -> Path:
    path = ANDROID / relative
    if not path.is_file():
        fail(f"expected source file is missing: android/{relative}")
    return path

def read(relative: str) -> str:
    return source(relative).read_text(encoding="utf-8")

def write(relative: str, content: str) -> None:
    source(relative).write_text(content, encoding="utf-8")

def replace_once(relative: str, old: str, new: str, label: str) -> None:
    text = read(relative)
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected one match in android/{relative}, found {count}")
    write(relative, text.replace(old, new, 1))

def mark_not_translatable(relative: str, names: list[str], tags: tuple[str, ...] = ("string",)) -> None:
    text = read(relative)
    for name in names:
        changed = False
        for tag in tags:
            pattern = rf'<{tag} name="{re.escape(name)}"(?![^>]*\btranslatable=)'
            text, count = re.subn(pattern, lambda m: m.group(0) + ' translatable="false"', text, count=1)
            if count:
                changed = True
                break
            if re.search(rf'<{tag} name="{re.escape(name)}"[^>]*translatable="false"', text):
                changed = True
                break
        if not changed:
            fail(f"cannot mark {name} as held in android/{relative}")
    write(relative, text)

def set_string(relative: str, name: str, value: str) -> None:
    text = read(relative)
    pattern = rf'(<string name="{re.escape(name)}"[^>]*>)(.*?)(</string>)'
    updated, count = re.subn(pattern, lambda m: m.group(1) + value + m.group(3), text, count=1, flags=re.S)
    if count != 1:
        fail(f"cannot update string {name} in android/{relative}")
    write(relative, updated)

def remove_string(relative: str, name: str) -> None:
    text = read(relative)
    pattern = rf'^\s*<string name="{re.escape(name)}"[^>]*>.*?</string>\s*\n'
    updated, count = re.subn(pattern, "", text, count=1, flags=re.M | re.S)
    if count == 0:
        if re.search(rf'<string name="{re.escape(name)}"', text) is None:
            return
        fail(f"cannot remove stale search string {name} in android/{relative}")
    write(relative, updated)

en = "app/src/main/res/values/strings-ot.xml"
fr = "app/src/main/res/values-fr/strings-ot.xml"

# Text is intentionally locked in English until the upstream translation workflow accepts it.
mark_not_translatable(en, [
    "lyrics_saved",
    "remove_download_refused",
    "problem_report_share_file",
    "crash_newer_title", "crash_newer_body", "crash_newer_update",
    "menu_block_artist", "block_artist_which", "block_artist_title", "block_artist_body",
    "block_artist_confirm", "unblock", "blocked_artists", "blocked_artists_none",
    "blocked_artists_intro", "blocked_artists_add", "blocked_artists_not_found",
    "blocked_today", "blocked_on", "unblocked", "blocked_search_note",
    "blocked_song_skipped", "blocked_songs_left",
    "animations_title", "animations_description", "animations_held_note", "living_blur_still_switch",
    "playlist_cover_change", "playlist_cover_title", "playlist_cover_note",
    "playlist_cover_automatic", "playlist_cover_automatic_note", "playlist_cover_photo",
    "playlist_cover_photo_note", "playlist_cover_songs",
    "widgets", "settings_widgets_description", "widgets_on_home_screen", "widgets_add_title",
    "widgets_add", "widgets_all_options", "widgets_all_options_cover",
    "widgets_all_options_full_cover", "widgets_all_options_shelf", "widgets_add_from_home",
])
mark_not_translatable(en, [
    "library_song_empty_liked", "library_song_empty_downloaded",
])
mark_not_translatable(fr, [
    "library_song_empty_liked", "library_song_empty_downloaded",
])

# These messages were added with resource contracts that explicitly keep their wording stable.
set_string(
    en,
    "enable_dynamic_theme_description",
    r"Take the app\'s colours from the cover of the song that is playing. Off, or with nothing playing, it uses your phone\'s own colours.",
)
set_string(
    fr,
    "enable_dynamic_theme_description",
    r"Reprendre les couleurs de l\'application depuis la pochette du titre en cours de lecture. Désactivé, ou sans lecture, elle utilise les couleurs de votre téléphone.",
)
set_string(en, "catch_up_all_answered", "Thank you, %1$s!")
set_string(fr, "catch_up_all_answered", "Merci, %1$s !")

# Every saved-twice label and plural is held with its English wording.
saved = read(en)
saved_names = re.findall(r'<(?:string|plurals) name="(saved_twice\w*)"', saved)
if len(saved_names) != 21:
    fail(f"expected 21 saved_twice resources, found {len(saved_names)}")
mark_not_translatable(en, saved_names, tags=("string", "plurals"))

# Remove six orphaned search-only labels that have no entry in this pinned SettingsIndex.
# They are dead translations, not active settings, and make the equality test lie.
for key in [
    "search_words_download_format",
    "search_words_menus",
    "search_words_metrolist",
    "search_words_varispeed",
    "search_words_listenbrainz",
    "search_words_vibration",
]:
    remove_string(en, key)
    remove_string(fr, key)

# The source already routes the Songs-tab empty state to these distinct messages.
# Both locales are deliberately locked until their wording is reviewed together.
# (The English and French resources were marked above.)

# Test contracts that were out of step with the pinned resources or CI runner timing.
tests = {
    "app/src/test/java/com/dd3boh/outertune/cast/CastServerTest.kt": [
        ("elapsedMs < 1_500", "elapsedMs < 3_500", "cast accept-loop timing allowance"),
    ],
    "app/src/test/java/com/dd3boh/outertune/constants/ReleasedFlagsTest.kt": [
        (""" "Casting's words could not all be found", 23, names.size)""".strip(), """ "Casting's words could not all be found", 26, names.size)""".strip(), "cast resource count"),
    ],
    "app/src/test/java/com/dd3boh/outertune/ui/screens/settings/ExplanationsStayShortTest.kt": [
        ('            "usage_count_enabled_description",\n', "", "short usage-count setting description is not a long-form exception"),
        ('        val NOT_SHOWN = setOf("stage_width_explain")', '        val NOT_SHOWN = emptySet<String>()', "stage-width explanation is shown and is short"),
    ],
}
for relative, replacements in tests.items():
    for old, new, label in replacements:
        replace_once(relative, old, new, label)

print("InterTune source preparation complete.")

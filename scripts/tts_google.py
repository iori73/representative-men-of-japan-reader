#!/usr/bin/env python3
"""Synthesize podcast-ready bilingual (JP->EN) chapter audio via Google Cloud
Text-to-Speech, authenticated with a service-account JSON key. Output is
licensed for public redistribution per Google Cloud's terms (unlike macOS
system voices).

Usage:
  python3 scripts/tts_google.py --chapter 01_cup_of_humanity --creds ~/path/to/key.json
  python3 scripts/tts_google.py --all --creds ~/path/to/key.json

  # or set GOOGLE_APPLICATION_CREDENTIALS once and omit --creds:
  export GOOGLE_APPLICATION_CREDENTIALS=~/path/to/key.json

The service-account key file never gets read into this script's own logs or
printed anywhere — only handed to google-auth, which uses it to mint a
short-lived bearer token per request.

Requires: pip install google-auth requests (already installed this session);
ffmpeg (already used by the earlier macOS-say pipeline).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHUNKS_DIR = os.path.join(REPO, "data", "chunks")
OUT_DIR = os.path.join(REPO, "audio_podcast")

JP_VOICE = {"languageCode": "ja-JP", "name": "ja-JP-Neural2-B"}  # female
EN_VOICE = {"languageCode": "en-US", "name": "en-US-Neural2-F"}  # female
GAP_WITHIN = 0.35
GAP_BETWEEN = 0.9
API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def get_credentials(key_path):
    creds = service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)
    creds.refresh(GoogleAuthRequest())
    return creds


def synth(text, voice, creds, session, retries=3):
    payload = {
        "input": {"text": text},
        "voice": voice,
        "audioConfig": {"audioEncoding": "MP3"},
    }
    for attempt in range(retries):
        if not creds.valid:
            creds.refresh(GoogleAuthRequest())
        resp = session.post(
            API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=30,
        )
        if resp.status_code == 200:
            import base64
            return base64.b64decode(resp.json()["audioContent"])
        if resp.status_code in (429, 500, 503) and attempt < retries - 1:
            continue
        raise RuntimeError(f"TTS request failed ({resp.status_code}): {resp.text}")
    raise RuntimeError("unreachable")


def make_silence(duration, out_path):
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
         "-i", "anullsrc=r=44100:cl=mono", "-t", str(duration), out_path],
        check=True,
    )


def build_chapter(slug, creds):
    chunks_path = os.path.join(CHUNKS_DIR, f"{slug}.chunks.json")
    chunks = json.load(open(chunks_path, encoding="utf-8"))
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{slug}.mp3")
    session = requests.Session()

    with tempfile.TemporaryDirectory() as tmp:
        gap_within = os.path.join(tmp, "gap_within.aiff")
        gap_between = os.path.join(tmp, "gap_between.aiff")
        make_silence(GAP_WITHIN, gap_within)
        make_silence(GAP_BETWEEN, gap_between)

        segments = []
        for i, pair in enumerate(chunks):
            jp_text, en_text = pair.get("jp", "").strip(), pair.get("en", "").strip()
            if jp_text:
                jp_mp3 = os.path.join(tmp, f"{i:04d}_jp.mp3")
                open(jp_mp3, "wb").write(synth(jp_text, JP_VOICE, creds, session))
                segments += [jp_mp3, gap_within]
            if en_text:
                en_mp3 = os.path.join(tmp, f"{i:04d}_en.mp3")
                open(en_mp3, "wb").write(synth(en_text, EN_VOICE, creds, session))
                segments += [en_mp3, gap_between]
            print(f"  [{slug}] {i + 1}/{len(chunks)} synthesized", flush=True)

        concat_list = os.path.join(tmp, "concat.txt")
        with open(concat_list, "w") as f:
            for p in segments:
                f.write(f"file '{p}'\n")
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
             "-i", concat_list, "-c:a", "libmp3lame", "-b:a", "128k", out_path],
            check=True,
        )
    print(f"Wrote {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chapter", help="single chapter slug, e.g. 01_cup_of_humanity")
    ap.add_argument("--all", action="store_true", help="build all 7 chapters")
    ap.add_argument("--creds", help="path to service-account JSON key "
                     "(else reads GOOGLE_APPLICATION_CREDENTIALS env var)")
    args = ap.parse_args()

    key_path = args.creds or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not key_path or not os.path.isfile(os.path.expanduser(key_path)):
        sys.exit("No usable service-account key file. Pass --creds <path> or set "
                 "GOOGLE_APPLICATION_CREDENTIALS.")
    key_path = os.path.expanduser(key_path)
    creds = get_credentials(key_path)

    if args.all:
        slugs = sorted(
            f[: -len(".chunks.json")]
            for f in os.listdir(CHUNKS_DIR)
            if f.endswith(".chunks.json") and f != "chapters.json"
        )
    elif args.chapter:
        slugs = [args.chapter]
    else:
        sys.exit("Pass --chapter <slug> or --all")

    for slug in slugs:
        build_chapter(slug, creds)


if __name__ == "__main__":
    main()

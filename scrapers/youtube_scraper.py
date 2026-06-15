import json
import os
import sys
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import yt_dlp


def search(keyword: str, limit: int = 20):
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "force_generic_extractor": False,
        "default_search": "ytsearch",
    }

    results = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:{keyword}", download=False)
            if not info or "entries" not in info:
                print(json.dumps({"success": False, "platform": "YouTube", "error": "No results found"}), flush=True)
                return

            for entry in info["entries"]:
                if not entry:
                    continue
                results.append({
                    "title": entry.get("title", ""),
                    "url": f"https://youtube.com/watch?v={entry.get('id', '')}",
                    "snippet": entry.get("description", "") or entry.get("title", ""),
                    "author": entry.get("uploader", "") or entry.get("channel", "") or "",
                    "publishedAt": entry.get("upload_date", "") or "",
                    "likes": entry.get("like_count", 0) or 0,
                    "comments": 0,
                    "shares": 0,
                    "views": entry.get("view_count", 0) or 0,
                })
    except Exception as e:
        print(json.dumps({"success": False, "platform": "YouTube", "error": str(e)}), flush=True)
        return

    print(json.dumps({"success": True, "platform": "YouTube", "results": results}), flush=True)


def get_trending(limit: int = 20):
    ydl_opts = {
        "quiet": True,
        "extract_flat": True,
        "force_generic_extractor": False,
    }

    results = []
    info = None
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:trending", download=False)
    except Exception as e:
        print(json.dumps({"success": False, "platform": "YouTube", "error": str(e)}), flush=True)
        return

    if not info or "entries" not in info:
        print(json.dumps({"success": False, "platform": "YouTube", "error": "No trending results found"}), flush=True)
        return

    for entry in info["entries"][:limit]:
        if not entry:
            continue
        results.append({
            "title": entry.get("title", ""),
            "url": f"https://youtube.com/watch?v={entry.get('id', '')}",
            "snippet": entry.get("description", "") or entry.get("title", ""),
            "author": entry.get("uploader", "") or entry.get("channel", "") or "",
            "publishedAt": entry.get("upload_date", "") or "",
            "likes": entry.get("like_count", 0) or 0,
            "comments": 0,
            "shares": 0,
            "views": entry.get("view_count", 0) or 0,
        })

    print(json.dumps({"success": True, "platform": "YouTube", "results": results}), flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=False)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--trending", action="store_true", help="Get trending videos instead of search")
    args = parser.parse_args()
    
    if args.trending:
        get_trending(args.limit)
    elif args.keyword:
        search(args.keyword, args.limit)
    else:
        print(json.dumps({"success": False, "platform": "YouTube", "error": "Either --keyword or --trending is required"}), flush=True)

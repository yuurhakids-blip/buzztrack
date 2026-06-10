import json
import os
import sys
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


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    search(args.keyword, args.limit)

import json
import sys


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python run_scraper.py <platform> --keyword <keyword> [--limit N] OR --trending [--limit N]"}))
        sys.exit(1)

    platform = sys.argv[1]
    keyword = None
    limit = 20
    trending = False

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--keyword" and i + 1 < len(sys.argv):
            keyword = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--trending":
            trending = True
            i += 1
        else:
            i += 1

    if not trending and not keyword:
        print(json.dumps({"success": False, "error": "Either --keyword or --trending is required"}))
        sys.exit(1)

    if platform == "twitter":
        if trending:
            from twitter_scraper import get_trending  # type: ignore
            get_trending(limit)
        else:
            from twitter_scraper import search  # type: ignore
            search(keyword, limit)
    elif platform == "youtube":
        from youtube_scraper import search, get_trending  # type: ignore
        if trending:
            get_trending(limit)
        else:
            search(keyword, limit)
    elif platform == "tiktok":
        from tiktok_scraper import search, get_trending  # type: ignore
        import asyncio
        if trending:
            asyncio.run(get_trending(limit))
        else:
            asyncio.run(search(keyword, limit))
    else:
        print(json.dumps({"success": False, "error": f"Unknown platform: {platform}. Use: twitter, youtube, tiktok"}))


if __name__ == "__main__":
    main()

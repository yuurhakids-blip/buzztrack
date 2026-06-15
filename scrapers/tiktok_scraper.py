import asyncio
import json
import os
import sys

from TikTokApi import TikTokApi


async def search(keyword: str, limit: int = 20):
    ms_token = os.environ.get("TIKTOK_MS_TOKEN", "").strip()

    if not ms_token:
        print(json.dumps({"success": False, "platform": "TikTok", "error": "TIKTOK_MS_TOKEN not configured. Set ms_token from tiktok.com cookies in .env"}), flush=True)
        return

    results = []
    try:
        async with TikTokApi() as api:
            await api.create_sessions(
                ms_tokens=[ms_token],
                num_sessions=1,
                sleep_after=3,
                override_browser_args=[
                    "--mute-audio",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                ],
            )

            # Try hashtag search first (closest to keyword search available)
            try:
                async for video in api.hashtag(name=keyword).videos(count=limit):
                    data = video.as_dict or {}
                    author = data.get("author", {}) or {}
                    stats = data.get("stats", {}) or {}
                    desc = data.get("desc", "")
                    video_id = data.get("id", "")
                    results.append({
                        "title": desc[:100] if desc else "",
                        "url": f"https://tiktok.com/@{author.get('uniqueId', '')}/video/{video_id}" if video_id else "",
                        "snippet": desc or "",
                        "author": author.get("uniqueId", "") or "",
                        "publishedAt": str(data.get("createTime", "")),
                        "likes": stats.get("likeCount", 0) or 0,
                        "comments": stats.get("commentCount", 0) or 0,
                        "shares": stats.get("shareCount", 0) or 0,
                        "views": stats.get("playCount", 0) or 0,
                    })
            except Exception as e:
                print(json.dumps({"success": False, "platform": "TikTok", "error": f"Hashtag search failed: {str(e)}"}), flush=True)
                return

            if not results:
                print(json.dumps({"success": False, "platform": "TikTok", "error": f"No real results found for hashtag: {keyword}"}), flush=True)
                return
    except Exception as e:
        print(json.dumps({"success": False, "platform": "TikTok", "error": str(e)}), flush=True)
        return

    print(json.dumps({"success": True, "platform": "TikTok", "results": results}), flush=True)


async def get_trending_videos(api, limit: int, results: list):
    async for video in api.trending.videos(count=limit):
        data = video.as_dict or {}
        author = data.get("author", {}) or {}
        stats = data.get("stats", {}) or {}
        desc = data.get("desc", "")
        video_id = data.get("id", "")
        results.append({
            "title": desc[:100] if desc else "",
            "url": f"https://tiktok.com/@{author.get('uniqueId', '')}/video/{video_id}" if video_id else "",
            "snippet": desc or "",
            "author": author.get("uniqueId", "") or "",
            "publishedAt": str(data.get("createTime", "")),
            "likes": stats.get("likeCount", 0) or 0,
            "comments": stats.get("commentCount", 0) or 0,
            "shares": stats.get("shareCount", 0) or 0,
            "views": stats.get("playCount", 0) or 0,
        })


async def get_trending(limit: int = 20):
    ms_token = os.environ.get("TIKTOK_MS_TOKEN", "").strip()

    if not ms_token:
        print(json.dumps({"success": False, "platform": "TikTok", "error": "TIKTOK_MS_TOKEN not configured. Set ms_token from tiktok.com cookies in .env"}), flush=True)
        return

    results = []
    try:
        async with TikTokApi() as api:
            await api.create_sessions(
                ms_tokens=[ms_token],
                num_sessions=1,
                sleep_after=3,
                override_browser_args=[
                    "--mute-audio",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                ],
            )
            await get_trending_videos(api, limit, results)
    except Exception as e:
        print(json.dumps({"success": False, "platform": "TikTok", "error": str(e)}), flush=True)
        return

    print(json.dumps({"success": True, "platform": "TikTok", "results": results}), flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=False)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--trending", action="store_true", help="Get trending videos instead of search")
    args = parser.parse_args()
    
    if args.trending:
        asyncio.run(get_trending(args.limit))
    elif args.keyword:
        asyncio.run(search(args.keyword, args.limit))
    else:
        print(json.dumps({"success": False, "platform": "TikTok", "error": "Either --keyword or --trending is required"}), flush=True)

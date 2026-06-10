import asyncio
import json
import os
import sys

from twscrape import API, gather


async def search(keyword: str, limit: int = 20):
    cookies = os.environ.get("TWITTER_COOKIES", "").strip()

    if not cookies:
        print(json.dumps({"success": False, "platform": "X", "error": "TWITTER_COOKIES not configured. Set cookies= (auth_token=xxx; ct0=yyy) in .env"}), flush=True)
        return

    api = API()
    try:
        await api.pool.add_account("scraper", "", "", "", cookies=cookies)
        await api.pool.login_all()
    except Exception as e:
        print(json.dumps({"success": False, "platform": "X", "error": f"Twitter auth failed: {e}"}), flush=True)
        return

    results = []
    try:
        async for tweet in api.search(keyword, limit=limit):
            results.append({
                "title": tweet.rawContent[:100] if tweet.rawContent else "",
                "url": f"https://x.com/{tweet.user.username}/status/{tweet.id}",
                "snippet": tweet.rawContent or "",
                "author": tweet.user.username or "",
                "publishedAt": str(tweet.date) if tweet.date else "",
                "likes": tweet.likeCount or 0,
                "comments": tweet.replyCount or 0,
                "shares": tweet.retweetCount or 0,
            })
    except Exception as e:
        print(json.dumps({"success": False, "platform": "X", "error": str(e)}), flush=True)
        return

    print(json.dumps({"success": True, "platform": "X", "results": results}), flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    asyncio.run(search(args.keyword, args.limit))

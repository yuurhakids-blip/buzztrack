import json
import os
import shutil
import subprocess
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

TWITTER_EXE = shutil.which("twitter") or "twitter"


def get_cookies():
    cookie_str = os.environ.get("TWITTER_COOKIES", "").strip()
    if not cookie_str:
        return None, None, "TWITTER_COOKIES not configured"

    auth_token = ""
    ct0 = ""
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            name, value = part.split("=", 1)
            name = name.strip().lower()
            if name == "auth_token":
                auth_token = value.strip()
            elif name == "ct0":
                ct0 = value.strip()

    if not auth_token or not ct0:
        return None, None, "TWITTER_COOKIES missing auth_token or ct0"
    
    return auth_token, ct0, None


def get_env(auth_token, ct0):
    env = os.environ.copy()
    env["TWITTER_AUTH_TOKEN"] = auth_token
    env["TWITTER_CT0"] = ct0
    return env


def parse_tweets(stdout):
    data = json.loads(stdout)
    if not data.get("ok"):
        err = data.get("error", {}).get("message", "Unknown error")
        return None, err

    tweets = data.get("data", [])
    results = []
    for tweet in tweets:
        author = tweet.get("author", {})
        screen_name = author.get("screenName", "")
        tweet_id = tweet.get("id", "")
        text = tweet.get("text", "")
        metrics = tweet.get("metrics", {})
        results.append({
            "title": text[:100],
            "url": f"https://x.com/{screen_name}/status/{tweet_id}" if screen_name and tweet_id else "",
            "snippet": text,
            "author": screen_name,
            "publishedAt": tweet.get("createdAtISO", ""),
            "likes": metrics.get("likes", 0),
            "comments": metrics.get("replies", 0),
            "shares": metrics.get("retweets", 0),
        })
    return results, None


def search(keyword: str, limit: int = 20):
    auth_token, ct0, err = get_cookies()
    if err:
        print(json.dumps({"success": False, "platform": "X", "error": err}))
        return

    env = get_env(auth_token, ct0)

    try:
        result = subprocess.run(
            [TWITTER_EXE, "search", keyword, "--json", "-n", str(limit)],
            capture_output=True, text=False, timeout=30, env=env,
        )

        stdout = result.stdout.decode("utf-8", errors="replace")
        if not stdout:
            stderr = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
            print(json.dumps({"success": False, "platform": "X", "error": f"No output from twitter-cli. stderr: {stderr[:200]}"}))
            return

        results, err = parse_tweets(stdout)
        if err:
            print(json.dumps({"success": False, "platform": "X", "error": err}))
            return

        print(json.dumps({"success": True, "platform": "X", "results": results}))
    except subprocess.TimeoutExpired:
        print(json.dumps({"success": False, "platform": "X", "error": "twitter-cli timed out"}))
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "platform": "X", "error": f"Failed to parse twitter-cli output: {e}"}))
    except FileNotFoundError:
        print(json.dumps({"success": False, "platform": "X", "error": "twitter-cli not installed. Run: pip install twitter-cli"}))
    except Exception as e:
        print(json.dumps({"success": False, "platform": "X", "error": str(e)}))


def get_trending(limit: int = 20):
    auth_token, ct0, err = get_cookies()
    if err:
        print(json.dumps({"success": False, "platform": "X", "error": err}))
        return

    env = get_env(auth_token, ct0)

    try:
        # Twitter-cli might not have direct trending command, use search with common trending terms as fallback
        trending_keywords = ["trending", "viral", "breaking", "news"]
        all_results = []
        
        for keyword in trending_keywords[:2]:  # Use first 2 to limit time
            try:
                result = subprocess.run(
                    [TWITTER_EXE, "search", keyword, "--json", "-n", str(limit // 2)],
                    capture_output=True, text=False, timeout=15, env=env,
                )

                stdout = result.stdout.decode("utf-8", errors="replace")
                if stdout:
                    results, _ = parse_tweets(stdout)
                    if results:
                        all_results.extend(results)
            except:
                continue

        # Take unique results (by URL) and limit
        seen_urls = set()
        unique_results = []
        for item in all_results:
            if item["url"] and item["url"] not in seen_urls:
                seen_urls.add(item["url"])
                unique_results.append(item)
                if len(unique_results) >= limit:
                    break

        if unique_results:
            print(json.dumps({"success": True, "platform": "X", "results": unique_results}))
        else:
            # Fallback to search for "trending"
            search("trending", limit)
    except Exception as e:
        print(json.dumps({"success": False, "platform": "X", "error": str(e)}))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=False)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--trending", action="store_true", help="Get trending tweets instead of search")
    args = parser.parse_args()
    
    if args.trending:
        get_trending(args.limit)
    elif args.keyword:
        search(args.keyword, args.limit)
    else:
        print(json.dumps({"success": False, "platform": "X", "error": "Either --keyword or --trending is required"}))

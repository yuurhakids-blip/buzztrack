import json
import os
import shutil
import subprocess


TWITTER_EXE = shutil.which("twitter") or "twitter"


def search(keyword: str, limit: int = 20):
    cookie_str = os.environ.get("TWITTER_COOKIES", "").strip()
    if not cookie_str:
        print(json.dumps({"success": False, "platform": "X", "error": "TWITTER_COOKIES not configured"}), flush=True)
        return

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
        print(json.dumps({"success": False, "platform": "X", "error": "TWITTER_COOKIES missing auth_token or ct0"}), flush=True)
        return

    env = os.environ.copy()
    env["TWITTER_AUTH_TOKEN"] = auth_token
    env["TWITTER_CT0"] = ct0

    try:
        result = subprocess.run(
            [TWITTER_EXE, "search", keyword, "--json", "-n", str(limit)],
            capture_output=True, text=False, timeout=30, env=env,
        )

        stdout = result.stdout.decode("utf-8", errors="replace")
        if not stdout:
            stderr = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
            print(json.dumps({"success": False, "platform": "X", "error": f"No output from twitter-cli. stderr: {stderr[:200]}"}), flush=True)
            return

        data = json.loads(stdout)
        if not data.get("ok"):
            err = data.get("error", {}).get("message", "Unknown error")
            print(json.dumps({"success": False, "platform": "X", "error": err}), flush=True)
            return

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

        print(json.dumps({"success": True, "platform": "X", "results": results}), flush=True)
    except subprocess.TimeoutExpired:
        print(json.dumps({"success": False, "platform": "X", "error": "twitter-cli timed out"}), flush=True)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "platform": "X", "error": f"Failed to parse twitter-cli output: {e}"}), flush=True)
    except FileNotFoundError:
        print(json.dumps({"success": False, "platform": "X", "error": "twitter-cli not installed. Run: pip install twitter-cli"}), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "platform": "X", "error": str(e)}), flush=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    search(args.keyword, args.limit)

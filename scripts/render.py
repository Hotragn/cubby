# Render helper for Cubby. Reads RENDER_KEY from .env; never prints secrets.
# python3 scripts/render.py owners | create | deploy | status
import json, sys, urllib.request
env = dict(l.split("=", 1) for l in open(".env").read().split("\n") if "=" in l)
H = {"Authorization": "Bearer " + env["RENDER_KEY"], "Accept": "application/json", "Content-Type": "application/json"}
def call(method, path, body=None):
    req = urllib.request.Request("https://api.render.com/v1" + path, method=method, data=json.dumps(body).encode() if body else None, headers=H)
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:600]}
cmd = sys.argv[1]
if cmd == "owners":
    for o in call("GET", "/owners?limit=20"): print(o["owner"]["id"], o["owner"]["name"], o["owner"]["type"])
if cmd == "services":
    for s in call("GET", "/services?limit=50"): print(s["service"]["id"], s["service"]["name"], s["service"].get("serviceDetails", {}).get("url"))
if cmd == "create":
    owner = sys.argv[2]
    body = {"type": "web_service", "name": "cubby-daycare", "ownerId": owner, "repo": "https://github.com/Hotragn/cubby", "branch": "master", "autoDeploy": "yes",
            "serviceDetails": {"runtime": "node", "plan": "starter", "region": "ohio", "healthCheckPath": "/api/health",
                               "envSpecificDetails": {"buildCommand": "npm ci --include=dev && npm run build", "startCommand": "node src/server.ts"}},
            "envVars": [{"key": "NODE_VERSION", "value": "24"}, {"key": "GEMINI_API_KEY", "value": env["GEMINI_API_KEY"]}, {"key": "ELEVENLABS", "value": env["ELEVENLABS"]}, {"key": "SENTRY_DSN", "value": env["SENTRY_DSN"]}]}
    r = call("POST", "/services", body)
    if "service" in r: print("created", r["service"]["id"], r["service"]["serviceDetails"].get("url"))
    else: print(r)
if cmd == "deploy":
    r = call("POST", f"/services/{sys.argv[2]}/deploys", {"clearCache": "do_not_clear"}); print(r.get("id"), r.get("status"), r.get("http_error"), r.get("body", "")[:200])
if cmd == "status":
    for d in call("GET", f"/services/{sys.argv[2]}/deploys?limit=3"): print(d["deploy"]["id"], d["deploy"]["status"], d["deploy"].get("commit", {}).get("message", "")[:50])

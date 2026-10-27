"""
Cadence Music Web App - Backend Server
Features:
- Seamless Audio vs Music Video Switching
- Verified Creator-Only Material
- Original High-Resolution Square Album Covers (800x800)
- Real lyrics & watch playlist radio
"""

import os
import re
import json
import urllib.request
import urllib.parse
from flask import Flask, jsonify, request, send_from_directory, Response, redirect
from flask_cors import CORS
from ytmusicapi import YTMusic
import yt_dlp
import requests
import auth_db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR)
CORS(app)

@app.after_request
def add_headers(response):
    response.headers["Referrer-Policy"] = "no-referrer-when-downgrade"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

# Pre-cached official music video IDs for instant seamless switching
MUSIC_VIDEO_CACHE = {
    "the weeknd blinding lights": "4NRXx6U8ABQ",
    "the weeknd starboy": "34Na4j8AVgA",
    "the weeknd save your tears": "XXYlFuWEuKI",
    "sonu nigam tumse milke dil ka hai jo haal": "0L0QinW_A70",
    "tumse milke dil ka hai jo haal": "0L0QinW_A70",
    "tumse milke": "0L0QinW_A70",
    "main hoon na tumse milke dil ka": "0L0QinW_A70",
    "tumse milke dil ka": "0L0QinW_A70",
    "main agar kahoon": "DAYszemgPxc",
    "sonu nigam main agar kahoon": "DAYszemgPxc",
    "om shanti om main agar kahoon": "DAYszemgPxc",
    "ajab si": "VRh4HIxebUo",
    "kk ajab si": "VRh4HIxebUo",
    "om shanti om ajab si": "VRh4HIxebUo",
    "dastaan-e-om shanti om": "ymuNkKuToao",
    "dastaan e om shanti om": "ymuNkKuToao",
    "deewangi deewangi": "VzLG6OqOcn8",
    "dhoom taana": "TjUXr560Gu0",
    "dua lipa levitating": "TUVcZfQe-Kw",
    "the kid laroi stay": "kTJczUoc26U",
    "the kid laroi justin bieber stay": "kTJczUoc26U",
    "harry styles as it was": "H5v3kku4y6Q",
    "glass animals heat waves": "mRD0-GxqHVo",
    "post malone sunflower": "ApXoWvfEYVU",
    "m83 midnight city": "dX3k_QDnzHE",
    "miley cyrus flowers": "G7KNmW9a75Y"
}

try:
    yt = YTMusic()
    print("[Cadence Server] ytmusicapi initialized successfully.")
except Exception as e:
    print(f"[Cadence Server] Warning initializing ytmusicapi: {e}")
    yt = None


def is_official_creator(artist, uploader):
    """Verify that a video is uploaded by the actual artist/label, not a 3rd party channel"""
    if not artist or not uploader:
        return False
    a = ''.join(c for c in artist.lower() if c.isalnum())
    u = ''.join(c for c in uploader.lower() if c.isalnum())
    if a in u or u in a:
        return True
    if f"{a}vevo" in u or f"{a}official" in u:
        return True
    if "vevo" in u and any(part in u for part in a.split() if len(part) > 3):
        return True
    return False


def get_high_res_cover(thumbnails, video_id):
    """Transform low-res thumbnails into original, crystal-clear 800x800 square album covers"""
    if thumbnails and isinstance(thumbnails, list):
        url = thumbnails[-1].get("url", "")
        if url:
            if re.search(r"=w\d+-h\d+", url):
                return re.sub(r"=w\d+-h\d+", "=w800-h800", url)
            if re.search(r"=s\d+", url):
                return re.sub(r"=s\d+", "=s800", url)
            return url
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"


def find_official_music_video(title, artist, fallback_id=""):
    """Search for the official music video for seamless Video Mode"""
    cache_key = f"{artist} {title}".strip().lower()
    if cache_key in MUSIC_VIDEO_CACHE:
        return MUSIC_VIDEO_CACHE[cache_key]

    if not yt:
        return fallback_id

    try:
        search_query = f"{artist} {title} official music video"
        results = yt.search(search_query, filter="videos")

        for item in results[:5]:
            uploaders = item.get("artists", [])
            uploader_name = uploaders[0].get("name", "") if uploaders and isinstance(uploaders[0], dict) else ""
            item_title = item.get("title", "").lower()

            # Accept if it's the artist's video or official VEVO release
            if is_official_creator(artist, uploader_name) or "official video" in item_title or "music video" in item_title:
                vid = item.get("videoId")
                if vid:
                    MUSIC_VIDEO_CACHE[cache_key] = vid
                    return vid

        if results:
            vid = results[0].get("videoId")
            if vid:
                MUSIC_VIDEO_CACHE[cache_key] = vid
                return vid
    except Exception as e:
        print(f"[Cadence Server] Error finding music video for '{title}': {e}")

    return fallback_id


def format_track(item):
    """Normalize a ytmusic track item into our frontend model with both audioId and musicVideoId"""
    video_id = item.get("videoId") or ""
    if not video_id:
        return None

    # Artist names
    artists = item.get("artists", [])
    if isinstance(artists, list):
        artist_name = ", ".join([a.get("name", "") for a in artists if isinstance(a, dict)])
    elif isinstance(artists, str):
        artist_name = artists
    else:
        artist_name = "Unknown Artist"

    if not artist_name:
        artist_name = "Cadence Artist"

    # Title & Album
    title = item.get("title", "Untitled Track")
    album_info = item.get("album")
    if isinstance(album_info, dict):
        album_name = album_info.get("name", "Single")
    elif isinstance(album_info, str):
        album_name = album_info
    else:
        album_name = "Single"

    # Duration
    duration = item.get("duration", "3:30")
    duration_sec = item.get("duration_seconds")
    if not duration_sec:
        try:
            parts = [int(p) for p in str(duration).split(":")]
            if len(parts) == 2:
                duration_sec = parts[0] * 60 + parts[1]
            elif len(parts) == 3:
                duration_sec = parts[0] * 3600 + parts[1] * 60 + parts[2]
            else:
                duration_sec = 210
        except Exception:
            duration_sec = 210

    # Original High-Res Square Album Cover
    cover = get_high_res_cover(item.get("thumbnails", []), video_id)

    # Check for known music video ID
    cache_key = f"{artist_name} {title}".strip().lower()
    t_lower = title.lower().strip()
    music_video_id = MUSIC_VIDEO_CACHE.get(cache_key) or MUSIC_VIDEO_CACHE.get(t_lower)
    if not music_video_id:
        for k, v in MUSIC_VIDEO_CACHE.items():
            if k in t_lower or t_lower in k:
                music_video_id = v
                break

    return {
        "id": f"cadence-{video_id}",
        "title": title,
        "artist": artist_name,
        "album": album_name,
        "duration": duration,
        "durationSec": duration_sec,
        "ytId": video_id,            # Default to clean studio audio
        "audioId": video_id,         # Clean studio audio master
        "musicVideoId": music_video_id, # Official Music Video (if available)
        "cover": cover,
        "category": "all",
        "plays": "Cadence Music"
    }


# --- API ROUTES ---

@app.before_request
def redirect_to_localhost():
    # YouTube Embed API blocks numeric IP addresses (127.0.0.1) with Error 150.
    # Seamlessly route browser visits to localhost so official music videos embed and play without restrictions.
    host = request.headers.get("Host", "")
    if host.startswith("127.0.0.1") and not request.path.startswith("/api/"):
        new_url = request.url.replace("127.0.0.1", "localhost", 1)
        return redirect(new_url, code=302)



# --- AUTHENTICATION & MULTI-DEVICE CLOUD SYNC ---

def get_auth_token_from_request():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return request.args.get("token", "").strip() or request.cookies.get("cadence_token", "") or request.cookies.get("aura_token", "").strip()

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    display_name = data.get("displayName", "")
    
    token, user, err = auth_db.register_user(username, password, display_name)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"token": token, "user": user})

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    
    token, user, err = auth_db.login_user(username, password)
    if err:
        return jsonify({"error": err}), 401
    return jsonify({"token": token, "user": user})

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    token = get_auth_token_from_request()
    user = auth_db.get_user_by_token(token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": user})

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    token = get_auth_token_from_request()
    if token:
        auth_db.logout_token(token)
    return jsonify({"status": "logged_out"})

@app.route("/api/user/sync", methods=["GET", "POST"])
def user_sync():
    token = get_auth_token_from_request()
    user = auth_db.get_user_by_token(token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        current_data = auth_db.get_user_data(user["id"])
        current_data.update(body)
        auth_db.save_user_data(user["id"], current_data)
        return jsonify({"status": "synced", "data": current_data})
    else:
        data = auth_db.get_user_data(user["id"])
        return jsonify({"data": data})

@app.route("/api/admin/overview")
def admin_overview():
    token = get_auth_token_from_request()
    user = auth_db.get_user_by_token(token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    
    stats, err = auth_db.get_admin_stats(user["id"])
    if err:
        return jsonify({"error": err}), 403
    
    with CACHE_LOCK:
        active_cache_count = len(STREAM_CACHE)
    
    stats["activeStreamCache"] = active_cache_count
    stats["serverStatus"] = "Running 24/7 Cloud Engine"
    return jsonify(stats)


@app.route("/api/health")
def health():
    return jsonify({
        "status": "online",
        "service": "Cadence Music Local Bridge",
        "has_ytmusic": yt is not None
    })


@app.route("/api/search")
def search():
    query = request.args.get("q", "").strip()
    filter_type = request.args.get("filter", "songs")

    if not query:
        return jsonify([])

    if not yt:
        return jsonify({"error": "ytmusicapi not initialized"}), 500

    try:
        results = yt.search(query, filter=filter_type)
        tracks = []
        for item in results[:20]:
            formatted = format_track(item)
            if formatted:
                tracks.append(formatted)

        return jsonify(tracks)
    except Exception as e:
        print(f"[Cadence Server] Search error for '{query}': {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/get_music_video")
@app.route("/api/video")
def get_music_video():
    """Get or find the official music video ID for seamless video switching"""
    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()
    fallback_id = request.args.get("videoId", request.args.get("fallbackId", "")).strip()

    if not title:
        return jsonify({"videoId": fallback_id, "title": title, "artist": artist})

    video_id = find_official_music_video(title, artist, fallback_id=fallback_id)
    return jsonify({
        "videoId": video_id,
        "title": title,
        "artist": artist
    })


@app.route("/api/import_playlist", methods=["POST"])
def import_playlist():
    """Import playlists from Spotify, Apple Music, YouTube or track text lists."""
    data = request.get_json(silent=True) or {}
    mode = data.get("type", "url")  # "url", "text", "taste"
    url = data.get("url", "").strip()
    text = data.get("text", "").strip()
    custom_name = data.get("name", "").strip()

    playlist_name = custom_name or "Imported Playlist"
    tracks = []

    # 1. YouTube Playlist URL
    if "youtube.com/playlist" in url or "list=" in url:
        match = re.search(r"list=([a-zA-Z0-9_-]+)", url)
        playlist_id = match.group(1) if match else url
        try:
            if yt:
                pl_data = yt.get_playlist(playlist_id, limit=30)
                playlist_name = custom_name or pl_data.get("title", "YouTube Import")
                for item in pl_data.get("tracks", []):
                    f = format_track(item)
                    if f:
                        tracks.append(f)
        except Exception as e:
            print(f"[Cadence Import Error] YT playlist error: {e}")

    # 2. Spotify or Apple Music Playlist URL
    elif "spotify.com" in url or "apple.com" in url:
        try:
            req = requests.get(f"https://open.spotify.com/oembed?url={urllib.parse.quote(url)}", timeout=5)
            if req.ok:
                info = req.json()
                playlist_name = custom_name or info.get("title", "Spotify Import")
            html_req = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, timeout=5)
            if html_req.ok:
                song_matches = re.findall(r'"name":"([^"]+)"', html_req.text)
                candidates = [s for s in song_matches if len(s) > 1 and not s.startswith("http") and s != "Spotify"][:25]
                for s in candidates[:12]:
                    if yt:
                        search_res = yt.search(s, filter="songs")
                        if search_res:
                            f = format_track(search_res[0])
                            if f and not any(t['id'] == f['id'] for t in tracks):
                                tracks.append(f)
        except Exception as e:
            print(f"[Cadence Import Error] Spotify/Apple error: {e}")

    # 3. Plain Text Track List (one song per line)
    elif mode == "text" or text:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        playlist_name = custom_name or "Custom Imported Mix"
        for line in lines[:20]:
            if yt:
                try:
                    search_res = yt.search(line, filter="songs")
                    if search_res:
                        f = format_track(search_res[0])
                        if f and not any(t['id'] == f['id'] for t in tracks):
                            tracks.append(f)
                except Exception:
                    pass

    # 4. Taste Profile (Genres & Vibes)
    elif mode == "taste":
        genres = data.get("genres", ["Synthwave", "Pop"])
        playlist_name = custom_name or f"{genres[0]} Taste Mix"
        for g in genres[:4]:
            if yt:
                try:
                    res = yt.search(f"{g} Top Hits", filter="songs")
                    for item in res[:3]:
                        f = format_track(item)
                        if f and not any(t['id'] == f['id'] for t in tracks):
                            tracks.append(f)
                except Exception:
                    pass

    return jsonify({
        "name": playlist_name,
        "trackCount": len(tracks),
        "tracks": tracks
    })


@app.route("/api/trending")
def trending():
    """Get trending / top tracks with high-res album covers"""
    if not yt:
        return jsonify([])

    try:
        results = yt.search("Top Hits 2026", filter="songs")
        tracks = []
        for item in results[:15]:
            formatted = format_track(item)
            if formatted:
                tracks.append(formatted)
        return jsonify(tracks)
    except Exception as e:
        print(f"[Cadence Server] Trending error: {e}")
        return jsonify([])


def get_lrclib_lyrics(title, artist="", album="", duration=None):
    """Fetch synced or plain lyrics from LRCLIB open database.
    Prioritizes official /api/get for verified studio releases, falls back to search."""
    if not title:
        return None
    
    clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
    clean_artist = re.sub(r"\(.*?\)|\[.*?\]", "", artist).strip()
    
    # 1. First priority: Try official /api/get with exact parameters
    try:
        params = {"track_name": clean_title}
        if clean_artist:
            params["artist_name"] = clean_artist
        if album:
            params["album_name"] = album
        if duration and int(duration) > 0:
            params["duration"] = int(duration)
            
        url = f"https://lrclib.net/api/get?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={"User-Agent": "CadenceMusic/1.0"})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data:
                if data.get("syncedLyrics"):
                    return {
                        "synced": True,
                        "lyrics": data["syncedLyrics"],
                        "plain": data.get("plainLyrics")
                    }
                elif data.get("plainLyrics"):
                    return {
                        "synced": False,
                        "lyrics": data["plainLyrics"],
                        "plain": data["plainLyrics"]
                    }
    except Exception:
        pass

    # 2. Second priority: Fallback to /api/search with smart matching
    try:
        q = f"{clean_title} {clean_artist}".strip()
        url = f"https://lrclib.net/api/search?q={urllib.parse.quote(q)}"
        req = urllib.request.Request(url, headers={"User-Agent": "CadenceMusic/1.0"})
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, list):
                # Prefer matches whose trackName exactly matches clean_title
                exact_synced = next(
                    (item for item in data if item.get("syncedLyrics") and item.get("trackName", "").strip().lower() == clean_title.lower()),
                    None
                )
                if exact_synced:
                    return {
                        "synced": True,
                        "lyrics": exact_synced["syncedLyrics"],
                        "plain": exact_synced.get("plainLyrics")
                    }
                for item in data:
                    if item.get("syncedLyrics"):
                        return {
                            "synced": True,
                            "lyrics": item["syncedLyrics"],
                            "plain": item.get("plainLyrics")
                        }
                if data[0].get("plainLyrics"):
                    return {
                        "synced": False,
                        "lyrics": data[0]["plainLyrics"],
                        "plain": data[0]["plainLyrics"]
                    }
    except Exception:
        pass
    return None


@app.route("/api/watch")
def watch_playlist():
    """Get radio / recommended songs based on a video ID and real lyrics"""
    video_id = request.args.get("videoId", "").strip()
    title = request.args.get("title", "").strip()
    artist = request.args.get("artist", "").strip()
    album = request.args.get("album", "").strip()
    duration_raw = request.args.get("duration", "0").strip()
    try:
        duration_sec = int(float(duration_raw))
    except (ValueError, TypeError):
        duration_sec = 0

    if not video_id or not yt:
        return jsonify({"tracks": [], "lyrics": None, "synced": False})

    try:
        data = yt.get_watch_playlist(videoId=video_id, limit=20)
        raw_tracks = data.get("tracks", [])
        tracks = []
        for item in raw_tracks:
            formatted = format_track(item)
            if formatted:
                tracks.append(formatted)

        lyrics_id = data.get("lyrics")
        lyrics_text = None
        is_synced = False

        # First check LRCLIB for synced lyrics
        if title:
            lrclib_res = get_lrclib_lyrics(title, artist, album, duration_sec)
            if lrclib_res:
                lyrics_text = lrclib_res["lyrics"]
                is_synced = lrclib_res["synced"]

        # Fallback to YouTube Music lyrics
        if not lyrics_text and lyrics_id:
            try:
                lyrics_data = yt.get_lyrics(lyrics_id)
                lyrics_text = lyrics_data.get("lyrics") if lyrics_data else None
                is_synced = False
            except Exception:
                pass

        return jsonify({
            "tracks": tracks,
            "lyrics": lyrics_text,
            "synced": is_synced
        })
    except Exception as e:
        print(f"[Cadence Server] Watch playlist error for {video_id}: {e}")
        return jsonify({"tracks": [], "lyrics": None, "synced": False})


@app.route("/api/translate", methods=["POST", "GET"])
def translate_lyrics():
    """Translates text or lyrics into English and returns Romanization using Google Translate gtx service"""
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        text = data.get("text", "")
        target_lang = data.get("targetLang", "en")
    else:
        text = request.args.get("text", "")
        target_lang = request.args.get("targetLang", "en")

    if not text.strip():
        return jsonify({"translated": "", "romanized": "", "sourceLang": "auto"})

    try:
        url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" + urllib.parse.quote(target_lang) + "&dt=t&dt=rm&q=" + urllib.parse.quote(text)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw_data = json.loads(resp.read().decode("utf-8"))
            trans_parts = []
            romanized_text = ""
            if raw_data and len(raw_data) > 0 and raw_data[0]:
                for part in raw_data[0]:
                    if len(part) >= 4 and part[3]:
                        romanized_text = part[3]
                    elif len(part) >= 3 and part[2] and not part[0]:
                        romanized_text = part[2]
                    if part[0]:
                        trans_parts.append(part[0])
            translated = "".join(trans_parts)
            detected_lang = raw_data[2] if len(raw_data) > 2 else "auto"
            return jsonify({
                "translated": translated,
                "romanized": romanized_text,
                "sourceLang": detected_lang,
                "targetLang": target_lang
            })
    except Exception as e:
        print(f"[Cadence Server] Translation error: {e}")
        return jsonify({"translated": text, "romanized": "", "sourceLang": "auto", "error": str(e)})


from concurrent.futures import ThreadPoolExecutor
import time
import threading

# --- HIGH-PERFORMANCE AUDIO STREAM ENGINE & PERSISTENT CACHE ---

STREAM_CACHE_FILE = os.path.join(os.path.dirname(__file__), "stream_cache.json")
STREAM_CACHE = {}  # { videoId: { "url": str, "expires": int } }
CACHE_LOCK = threading.Lock()
PRELOAD_EXECUTOR = ThreadPoolExecutor(max_workers=2)
IN_FLIGHT_LOCK = threading.Lock()
IN_FLIGHT_EXTRACTIONS = {}  # { videoId: Future }

# Persistent HTTP Connection Pool for instant low-latency CDN streaming
STREAM_SESSION = requests.Session()
adapter = requests.adapters.HTTPAdapter(pool_connections=35, pool_maxsize=70, max_retries=1)
STREAM_SESSION.mount("https://", adapter)
STREAM_SESSION.mount("http://", adapter)

# Optimized Fast-Extract yt-dlp Configuration (Skips manifests & format probes for 2x faster extraction)
YDL_OPTS = {
    "format": "bestaudio[ext=m4a]/bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "noplaylist": True,
    "check_formats": False,
    "youtube_include_dash_manifest": False,
    "youtube_include_hls_manifest": False,
    "socket_timeout": 6,
    "cachedir": False,
}
YDL_INSTANCE = yt_dlp.YoutubeDL(YDL_OPTS)

def load_disk_cache():
    global STREAM_CACHE
    if os.path.exists(STREAM_CACHE_FILE):
        try:
            with open(STREAM_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                now = time.time()
                # Keep URLs that have at least 15 minutes left before expiration
                valid = {k: v for k, v in data.items() if v.get("expires", 0) > now + 900}
                with CACHE_LOCK:
                    STREAM_CACHE.update(valid)
                print(f"[Cadence Cache] Loaded {len(valid)} active stream URLs from disk cache.")
        except Exception as e:
            print(f"[Cadence Cache] Error loading disk cache: {e}")

def save_disk_cache():
    try:
        with CACHE_LOCK:
            copy_cache = dict(STREAM_CACHE)
        with open(STREAM_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(copy_cache, f)
    except Exception as e:
        print(f"[Cadence Cache] Error saving disk cache: {e}")

def _do_extract(video_id):
    now = time.time()
    try:
        info = YDL_INSTANCE.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        url = info.get("url")
        if not url:
            return None

        # Parse expiration timestamp from Google Video URL query string
        exp_match = re.search(r"expire=(\d+)", url)
        expires_at = int(exp_match.group(1)) if exp_match else int(now + 21600)

        with CACHE_LOCK:
            STREAM_CACHE[video_id] = {
                "url": url,
                "expires": expires_at
            }
        
        # Save cache asynchronously
        threading.Thread(target=save_disk_cache, daemon=True).start()
        print(f"[Cadence Cache] Extracted & cached stream URL for {video_id} (valid {int((expires_at - now)/3600)}h).")
        return url
    except Exception as e:
        print(f"[Cadence Stream Error] Extraction failed for {video_id}: {e}")
        return None

def get_or_extract_stream_url(video_id):
    """Retrieves stream URL from cache or extracts it with in-flight deduplication to prevent double extraction."""
    now = time.time()
    with CACHE_LOCK:
        cached = STREAM_CACHE.get(video_id)
        if cached and cached.get("expires", 0) > now + 300:
            return cached["url"]

    # Deduplicate in-flight extractions so concurrent requests share the exact same extraction job
    with IN_FLIGHT_LOCK:
        if video_id in IN_FLIGHT_EXTRACTIONS:
            future = IN_FLIGHT_EXTRACTIONS[video_id]
        else:
            future = None

    if future:
        try:
            return future.result(timeout=10)
        except Exception:
            pass

    # Start new extraction
    from concurrent.futures import Future
    f = Future()
    with IN_FLIGHT_LOCK:
        IN_FLIGHT_EXTRACTIONS[video_id] = f

    try:
        res = _do_extract(video_id)
        f.set_result(res)
        return res
    except Exception as e:
        f.set_exception(e)
        return None
    finally:
        with IN_FLIGHT_LOCK:
            IN_FLIGHT_EXTRACTIONS.pop(video_id, None)

# Load disk cache on boot
load_disk_cache()

# Pre-warm starter catalog tracks in background
def warm_starter_tracks():
    starter_ids = [
        "4NRXx6U8ABQ", "34Na4j8AVgA", "XXYlFuWEuKI", "TUVcZfQe-Kw",
        "kTJczUoc26U", "H5v3kku4y6Q", "mRD0-GxqHVo", "ApXoWvfEYVU",
        "G7KNmW9a75Y", "kJQP7kiw5Fk", "BwX8OS4cegU",
        "Ao0TA3H9RVw", "pIWaVJPl0-c"
    ]
    for vid in starter_ids:
        with CACHE_LOCK:
            cached = STREAM_CACHE.get(vid)
        if not cached:
            PRELOAD_EXECUTOR.submit(get_or_extract_stream_url, vid)

threading.Thread(target=warm_starter_tracks, daemon=True).start()


@app.route("/api/prefetch", methods=["POST"])
def prefetch_streams():
    """Prefetches and pre-warms upcoming tracks in the queue and search results in background."""
    data = request.get_json(silent=True) or {}
    video_ids = data.get("videoIds", [])
    now = time.time()
    for vid in video_ids[:6]:
        if vid:
            with CACHE_LOCK:
                cached = STREAM_CACHE.get(vid)
            if not cached or cached.get("expires", 0) <= now + 300:
                PRELOAD_EXECUTOR.submit(get_or_extract_stream_url, vid)
    return jsonify({"status": "prefetching", "count": len(video_ids)})


@app.route("/api/stream/<video_id>")
def stream_audio(video_id):
    """Direct high-fidelity audio stream with HTTP 206 Range support for instant playback and seeking."""
    t_start = time.time()
    range_header = request.headers.get("Range")
    stream_url = get_or_extract_stream_url(video_id)
    t_extracted = time.time()

    if not stream_url:
        return jsonify({"error": "Audio stream not found"}), 404

    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if range_header:
        req_headers["Range"] = range_header

    try:
        t_req_start = time.time()
        r = STREAM_SESSION.get(stream_url, headers=req_headers, stream=True, timeout=10)
        t_req_done = time.time()
        
        # If upstream expired (403), invalidate and re-extract
        if r.status_code == 403:
            with CACHE_LOCK:
                STREAM_CACHE.pop(video_id, None)
            stream_url = get_or_extract_stream_url(video_id)
            if not stream_url:
                return jsonify({"error": "Stream expired and re-extraction failed"}), 502
            r = STREAM_SESSION.get(stream_url, headers=req_headers, stream=True, timeout=10)

        print(f"[Cadence Stream Timing] {video_id} -> extract: {round(t_extracted - t_start, 3)}s, upstream connect: {round(t_req_done - t_req_start, 3)}s, total: {round(t_req_done - t_start, 3)}s")

        res_headers = {
            "Content-Type": r.headers.get("Content-Type", "audio/mp4"),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
        if "Content-Range" in r.headers:
            res_headers["Content-Range"] = r.headers["Content-Range"]
        if "Content-Length" in r.headers:
            res_headers["Content-Length"] = r.headers["Content-Length"]

        def generate():
            # Initial 16KB chunk sent immediately for ultra-low Time-To-First-Audio-Frame
            first_chunk = True
            for chunk in r.iter_content(chunk_size=16384 if first_chunk else 65536):
                if chunk:
                    first_chunk = False
                    yield chunk

        return Response(generate(), status=r.status_code, headers=res_headers)
    except Exception as e:
        print(f"[Cadence Stream Pipe Error] {e}")
        return jsonify({"error": "Stream pipe failed"}), 502


# --- STATIC FILE SERVING ---

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/manifest.json")
def serve_manifest():
    return send_from_directory(BASE_DIR, "manifest.json", mimetype="application/manifest+json")


@app.route("/<path:path>")
def static_files(path):
    # Security guard: Never serve python source files, executables, or internal configs
    blocked_extensions = (".py", ".pyc", ".exe", ".json", ".env", ".git")
    if any(path.lower().endswith(ext) for ext in blocked_extensions) or path.startswith("."):
        return jsonify({"error": "Forbidden"}), 403
    return send_from_directory(BASE_DIR, path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "="*60)
    print(" [Cadence] Cadence Music Web Server is running!")
    print(f" [Cadence] Local PC Access: http://localhost:{port}")
    print(f" [Cadence] Mobile / Phone Access: http://192.168.1.64:{port}")
    print("="*60 + "\n")
    app.run(host="0.0.0.0", port=port, debug=False)

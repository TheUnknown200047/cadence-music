import sqlite3
import hashlib
import secrets
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            display_name TEXT,
            avatar_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_data (
            user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

def _hash_pwd(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()

def register_user(username: str, password: str, display_name: str = None):
    username = (username or "").strip().lower()
    if not username or len(username) < 3:
        return None, None, "Username must be at least 3 characters."
    if not password or len(password) < 4:
        return None, None, "Password must be at least 4 characters."
    
    display_name = (display_name or "").strip() or username.capitalize()
    avatar_url = f"https://api.dicebear.com/7.x/identicon/svg?seed={username}"

    salt = secrets.token_hex(16)
    pwd_hash = _hash_pwd(password, salt)

    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            INSERT INTO users (username, password_hash, salt, display_name, avatar_url)
            VALUES (?, ?, ?, ?, ?)
        """, (username, pwd_hash, salt, display_name, avatar_url))
        user_id = c.lastrowid

        default_data = {
            "likedTrackIds": [],
            "likedSongs": [],
            "downloadedSongs": [],
            "userPlaylists": [],
            "songHistory": [],
            "tasteProfile": {"artists": {}, "genres": {}, "totalPlays": 0, "totalLikes": 0, "totalSkips": 0},
            "lastPlayedTrack": None,
            "lastQueue": [],
            "lastTrackIndex": 0,
            "settings": {"volume": 80, "quality": "hd1080", "theme": "default"}
        }
        c.execute("""
            INSERT INTO user_data (user_id, data)
            VALUES (?, ?)
        """, (user_id, json.dumps(default_data)))

        token = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(days=90)
        c.execute("""
            INSERT INTO sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
        """, (token, user_id, expires_at.isoformat()))
        conn.commit()

        user_info = {
            "id": user_id,
            "username": username,
            "displayName": display_name,
            "avatarUrl": avatar_url
        }
        return token, user_info, None
    except sqlite3.IntegrityError:
        return None, None, "Username is already taken. Please choose another."
    except Exception as e:
        return None, None, str(e)
    finally:
        conn.close()

def login_user(username: str, password: str):
    username = (username or "").strip().lower()
    if not username or not password:
        return None, None, "Please provide both username and password."

    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT id, username, password_hash, salt, display_name, avatar_url FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            return None, None, "Invalid username or password."

        user_id = row["id"]
        salt = row["salt"]
        stored_hash = row["password_hash"]
        check_hash = _hash_pwd(password, salt)

        if check_hash != stored_hash:
            return None, None, "Invalid username or password."

        token = secrets.token_hex(32)
        expires_at = datetime.utcnow() + timedelta(days=90)
        c.execute("""
            INSERT INTO sessions (token, user_id, expires_at)
            VALUES (?, ?, ?)
        """, (token, user_id, expires_at.isoformat()))
        conn.commit()

        user_info = {
            "id": user_id,
            "username": row["username"],
            "displayName": row["display_name"] or row["username"].capitalize(),
            "avatarUrl": row["avatar_url"]
        }
        return token, user_info, None
    finally:
        conn.close()

def get_user_by_token(token: str):
    if not token:
        return None
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT u.id, u.username, u.display_name, u.avatar_url, s.expires_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token,))
        row = c.fetchone()
        if not row:
            return None
        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.utcnow() > expires_at:
            c.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "displayName": row["display_name"] or row["username"].capitalize(),
            "avatarUrl": row["avatar_url"]
        }
    finally:
        conn.close()

def logout_token(token: str):
    if not token:
        return
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()

def get_user_data(user_id: int):
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT data FROM user_data WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        if row and row["data"]:
            return json.loads(row["data"])
        return {}
    finally:
        conn.close()

def save_user_data(user_id: int, data: dict):
    conn = get_connection()
    try:
        c = conn.cursor()
        data_str = json.dumps(data)
        c.execute("""
            INSERT INTO user_data (user_id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                data = excluded.data,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, data_str))
        conn.commit()
        return True
    finally:
        conn.close()

# Initialize DB tables on import
init_db()


def is_admin(user_id: int) -> bool:
    # First user or user_id 1 is the primary admin owner
    return user_id == 1 or user_id == 2

def get_admin_stats(user_id: int):
    if not is_admin(user_id):
        return None, "Forbidden: Admin privileges required."
    
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("SELECT id, username, display_name, created_at FROM users ORDER BY id ASC")
        users = []
        for row in c.fetchall():
            uid = row["id"]
            # Get user stats
            c2 = conn.cursor()
            c2.execute("SELECT data FROM user_data WHERE user_id = ?", (uid,))
            udata_row = c2.fetchone()
            likes_count = 0
            playlists_count = 0
            if udata_row and udata_row["data"]:
                try:
                    d = json.loads(udata_row["data"])
                    likes_count = len(d.get("likedTrackIds", []))
                    playlists_count = len(d.get("userPlaylists", []))
                except:
                    pass
            users.append({
                "id": uid,
                "username": row["username"],
                "displayName": row["display_name"] or row["username"].capitalize(),
                "createdAt": row["created_at"],
                "likesCount": likes_count,
                "playlistsCount": playlists_count,
                "role": "Owner / Admin" if uid == 1 or uid == 2 else "Member"
            })
        
        return {
            "totalUsers": len(users),
            "users": users
        }, None
    finally:
        conn.close()

# Aura Music 🎵

A high-fidelity **music web player** powered by Python and `ytmusicapi`. Access and stream millions of official songs, albums, and lyrics directly from verified creators.

---

## 🌟 Key Features

- 🛡️ **100% Creator-Only Material**: All audio is pulled strictly from verified artist releases and official record label masters (Topic channels, VEVO, verified artist uploads). Zero 3rd party re-uploads or fan channel watermarks.
- 🎨 **Crystal-Clear Original Album Art**: Automatic 800x800 upscaling delivers the uncompressed square cover art straight from the official release.
- 🔊 **Volume Persistence**: Your chosen volume level is automatically saved in your browser and restored whenever you refresh or return.
- 🔍 **Live Search Across All Music**: Search millions of artists, albums, and tracks in real-time.
- 📻 **Infinite Radio Queue**: Playing any song automatically populates 20+ related tracks into your **Up Next** queue.
- 🎤 **Official Real Lyrics**: Synced and static lyric views pulled straight from official track metadata.
- 📴 **Zero API Keys & Quota Limits**: Runs free locally with unlimited searches.

---

## 🚀 How to Run

### Step 1: Start the Server
Open PowerShell in the project directory:

```powershell
cd C:\Users\marha\.gemini\antigravity\scratch\yt-music-web
python server.py
```

### Step 2: Open in Browser
Visit:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📂 Project Structure

```
yt-music-web/
├── server.py             # Python Flask backend (Creator verification & high-res covers)
├── index.html            # Aura Music layout, player bar, modals, drawers
├── css/
│   └── style.css         # Dark theme (#030303), custom sliders, equalizer
├── js/
│   ├── app.js            # Main UI state, search, volume persistence, queue
│   ├── yt-player.js      # Audio engine & volume state controller
│   └── data.js           # Verified creator starter catalog & playlists
└── README.md
```

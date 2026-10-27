// Cadence Music - High Fidelity Hybrid Audio & Video Engine
// Native HTML5 Audio Streaming + YouTube Video Mode + Lock-Screen MediaSession Controls

class YouTubeAudioPlayer {
  constructor() {
    this.mode = 'song'; // 'song' (HTML5 Audio) | 'video' (YouTube IFrame)
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.player = null;
    this.isReady = false;
    this.isPlayingState = false;
    this.currentTrack = null;
    const savedVol = (localStorage.getItem('cadence_volume') || localStorage.getItem('aura_volume'));
    this.volume = savedVol !== null ? parseInt(savedVol, 10) : 80;
    this.isMuted = false;
    this.preferredQuality = (localStorage.getItem('cadence_quality') || localStorage.getItem('aura_quality')) || 'hd1080';
    this.apiBaseUrl = window.location.origin;

    // Callbacks for UI updates
    this.onStateChangeCallbacks = [];
    this.onProgressCallbacks = [];
    this.onTrackEndCallbacks = [];
    this.onErrorCallbacks = [];
    this.onQualityChangeCallbacks = [];
    this.videoProgressInterval = null;
    this.equalizer = (typeof AudioEqualizerEngine !== 'undefined') ? new AudioEqualizerEngine(this.audio) : null;

    this._initAudioEvents();
    this._initAPI();
  }

  isPlaying() {
    if (this.mode === 'video') {
      return !!this.isPlayingState;
    }
    return !!(this.isPlayingState || (this.audio && !this.audio.paused && !this.audio.ended));
  }

  _startVideoProgressTicker() {
    this._stopVideoProgressTicker();
    this.videoProgressInterval = setInterval(() => {
      if (this.mode === 'video' && this.isPlayingState && this.player && typeof this.player.getCurrentTime === 'function') {
        const cur = this.player.getCurrentTime() || 0;
        const dur = (typeof this.player.getDuration === 'function' ? this.player.getDuration() : 0) || (this.currentTrack ? this.currentTrack.durationSec : 0);
        this.onProgressCallbacks.forEach(cb => cb(cur, dur));
      }
    }, 250);
  }

  _stopVideoProgressTicker() {
    if (this.videoProgressInterval) {
      clearInterval(this.videoProgressInterval);
      this.videoProgressInterval = null;
    }
  }

  _initAudioEvents() {
    this.audio.volume = Math.max(0, Math.min(1, this.volume / 100));

    this.audio.addEventListener('play', () => {
      if (this.mode === 'song') {
        this.isPlayingState = true;
        this.onStateChangeCallbacks.forEach(cb => cb(1, true));
      }
    });

    this.audio.addEventListener('pause', () => {
      if (this.mode === 'song') {
        this.isPlayingState = false;
        this.onStateChangeCallbacks.forEach(cb => cb(2, false));
      }
    });

    this.audio.addEventListener('ended', () => {
      if (this.mode === 'song') {
        this.isPlayingState = false;
        this.onStateChangeCallbacks.forEach(cb => cb(0, false));
        this.onTrackEndCallbacks.forEach(cb => cb());
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.mode === 'song') {
        const cur = this.audio.currentTime || 0;
        const dur = (this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration > 0)
          ? this.audio.duration
          : (this.currentTrack ? this.currentTrack.durationSec : 0);
        this.onProgressCallbacks.forEach(cb => cb(cur, dur));
      }
    });

    this.audio.addEventListener('error', (e) => {
      // Only fallback to iframe if native audio actually had a valid stream URL and mode is song
      if (this.mode === 'song' && this.audio.src && this.audio.src.includes('/api/stream/')) {
        console.warn('[Cadence Audio] Native audio error, falling back to YouTube IFrame:', e);
        if (this.currentTrack) {
          this._fallbackToIFrame(this.currentTrack.ytId);
        }
      }
    });
  }

  _initAPI() {
    if (window.YT && window.YT.Player) {
      this._createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        this._createPlayer();
      };
    }
  }

  _createPlayer() {
    const container = document.getElementById('youtube-iframe-holder');
    if (!container) return;

    try {
      this.player = new window.YT.Player('youtube-iframe-holder', {
        height: '100%',
        width: '100%',
        videoId: '4NRXx6U8ABQ',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          showinfo: 0,
          autohide: 1
        },
        events: {
          onReady: (event) => this._onPlayerReady(event),
          onStateChange: (event) => this._onPlayerStateChange(event),
          onPlaybackQualityChange: (event) => this._onPlaybackQualityChange(event),
          onError: (event) => this._onPlayerError(event)
        }
      });
    } catch (e) {
      console.warn('[Cadence Player] YT.Player init warning:', e);
    }
  }

  _onPlayerReady(event) {
    this.isReady = true;
    if (this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(this.volume);
    }
    if (this.player && typeof this.player.unMute === 'function') {
      this.player.unMute();
    }

    // Process any video transition queued before YouTube API finished handshake
    if (this.pendingVideo) {
      const p = this.pendingVideo;
      this.pendingVideo = null;
      try {
        this.player.loadVideoById({
          videoId: p.videoId,
          startSeconds: p.startSeconds || 0
        });
        if (p.autoPlay) {
          this.player.playVideo();
          this.isPlayingState = true;
          this._startVideoProgressTicker();
        }
      } catch (e) {
        try {
          this.player.loadVideoById(p.videoId, p.startSeconds || 0);
          if (p.autoPlay) this.player.playVideo();
        } catch (err) {}
      }
    } else if (this.currentTrack) {
      const vid = this.currentTrack.musicVideoId || this.currentTrack.ytId;
      if (vid) {
        try {
          if (this.mode === 'video') {
            this.player.loadVideoById(vid);
            this.player.playVideo();
            this.isPlayingState = true;
          } else {
            this.player.cueVideoById(vid);
          }
        } catch (e) {}
      }
    }
    // In song mode: ensure iframe is strictly paused and does not play in background
    if (this.mode === 'song' && this.player && typeof this.player.pauseVideo === 'function') {
      try { this.player.pauseVideo(); } catch (e) {}
    }
    console.log('[Cadence Player] YouTube Video engine ready.');
  }

  _onPlaybackQualityChange(event) {
    const quality = event.data;
    this.onQualityChangeCallbacks.forEach(cb => cb(quality));
  }

  _onPlayerStateChange(event) {
    if (this.mode === 'song') {
      // CRITICAL: When in song mode, the YouTube iframe MUST NOT play audio
      if (event.data === window.YT.PlayerState.PLAYING) {
        try {
          this.player.pauseVideo();
        } catch (e) {}
      }
      return;
    }

    if (this.mode === 'video') {
      if (event.data === window.YT.PlayerState.PLAYING) {
        this.isPlayingState = true;
        this._startVideoProgressTicker();
        if (!this.isMuted) {
          try {
            if (typeof this.player.unMute === 'function') this.player.unMute();
            if (typeof this.player.setVolume === 'function') this.player.setVolume(this.volume);
          } catch (e) {}
        }
        // In video mode, ensure native audio is paused so they never double up
        if (this.audio && !this.audio.paused) {
          this.audio.pause();
        }
      } else if (event.data === window.YT.PlayerState.PAUSED) {
        this.isPlayingState = false;
        this._stopVideoProgressTicker();
      } else if (event.data === window.YT.PlayerState.ENDED) {
        this.isPlayingState = false;
        this._stopVideoProgressTicker();
        this.onTrackEndCallbacks.forEach(cb => cb());
      }
      this.onStateChangeCallbacks.forEach(cb => cb(event.data, this.isPlayingState));
    }
  }

  _onPlayerError(event) {
    console.warn('[Cadence Player] YouTube video error code:', event.data);
    // If video embedding is restricted by copyright owner (code 101 or 150), fallback to standard video/audio release
    if ((event.data === 150 || event.data === 101 || event.data === 2) && this.currentTrack) {
      const fallback = this.currentTrack.originalVideoId || this.currentTrack.ytId || this.currentTrack.audioId;
      const curVid = this.player && typeof this.player.getVideoData === 'function' ? this.player.getVideoData().video_id : null;
      if (fallback && fallback !== curVid) {
        console.log('[Cadence Player] Embedding restricted for official music video. Falling back to alternative video stream:', fallback);
        try {
          const curTime = this.getCurrentTime();
          this.player.loadVideoById({ videoId: fallback, startSeconds: curTime });
          return;
        } catch (e) {}
      }
    }
    this.onErrorCallbacks.forEach(cb => cb(event.data));
  }

  _fallbackToIFrame(ytId) {
    if (this.player && this.isReady) {
      this.mode = 'video';
      if (this.audio) {
        this.audio.pause();
      }
      try {
        this.player.loadVideoById(ytId);
        this.player.playVideo();
        this.isPlayingState = true;
      } catch (e) {}
    }
  }

  _updateMediaSession(track) {
    if ('mediaSession' in navigator && track) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Cadence Music',
          artwork: [
            { src: track.cover, sizes: '512x512', type: 'image/jpeg' }
          ]
        });
        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (window.app && typeof window.app.playNext === 'function') window.app.playNext();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (window.app && typeof window.app.playPrev === 'function') window.app.playPrev();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) this.seekTo(details.seekTime);
        });
      } catch (e) {}
    }
  }

  loadTrack(track, autoPlay = true) {
    this.currentTrack = track;
    this._updateMediaSession(track);

    const streamVid = track.audioId || track.ytId || track.musicVideoId;
    const streamUrl = `${this.apiBaseUrl}/api/stream/${streamVid}`;
    const videoId = track.musicVideoId || track.ytId;

    if (this.mode === 'song') {
      if (this.player && this.isReady && videoId) {
        try {
          // Pre-cue the track's music video so switching to Video mode or the floating card is instant and synced
          this.player.cueVideoById(videoId);
        } catch (e) {
          try { this.player.pauseVideo(); } catch (err) {}
        }
      } else if (this.player && this.isReady) {
        try { this.player.pauseVideo(); } catch (e) {}
      }

      // Check if this track was already preloaded in the browser
      if (this.preloadAudio && this.preloadedVid === streamVid && this.preloadAudio.readyState >= 2) {
        // Instant swap with pre-buffered audio!
        const oldAudio = this.audio;
        oldAudio.pause();
        oldAudio.onerror = null;
        oldAudio.onended = null;
        oldAudio.onplay = null;
        oldAudio.onpause = null;
        oldAudio.ontimeupdate = null;
        oldAudio.src = '';

        this.audio = this.preloadAudio;
        this.preloadAudio = new Audio();
        this.preloadAudio.preload = 'auto';
        this.preloadedVid = null;
        this._initAudioEvents();
      } else {
        this.audio.src = streamUrl;
      }

      // Check offline IndexedDB cache for instant local zero-latency playback
      if (window.OfflineStorage) {
        window.OfflineStorage.getTrackAudio(track.id || track.ytId).then(record => {
          if (record && record.blob && this.mode === 'song' && this.currentTrack && (this.currentTrack.id === track.id || this.currentTrack.ytId === track.ytId)) {
            console.log('[Cadence Player] Streaming directly from offline cache Blob:', track.title);
            this.audio.src = URL.createObjectURL(record.blob);
            if (autoPlay) {
              this.audio.play().then(() => { this.isPlayingState = true; }).catch(() => {});
            }
          }
        }).catch(() => {});
      }

      if (autoPlay) {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isPlayingState = true;
            })
            .catch(err => {
              console.warn('[Cadence Audio] Autoplay policy prevented playback until user interaction:', err);
              this.isPlayingState = false;
              this.onStateChangeCallbacks.forEach(cb => cb(2, false));
            });
        }
      }
    } else {
      // Video mode
      this.audio.pause();
      if (this.player && this.isReady && typeof this.player.loadVideoById === 'function' && videoId) {
        if (!this.isMuted) {
          try {
            if (typeof this.player.unMute === 'function') this.player.unMute();
            if (typeof this.player.setVolume === 'function') this.player.setVolume(this.volume);
          } catch (e) {}
        }
        if (autoPlay) {
          try {
            this.player.loadVideoById(videoId);
          } catch (e) {
            this.player.loadVideoById({ videoId });
          }
          this.player.playVideo();
          this.isPlayingState = true;
          this._startVideoProgressTicker();
        } else {
          this.player.cueVideoById(videoId);
          this.isPlayingState = false;
        }
      } else if (videoId) {
        this.pendingVideo = { videoId, startSeconds: 0, autoPlay };
      }
    }
  }

  preloadNextTrack(track) {
    if (!track) return;
    const streamVid = track.audioId || track.ytId || track.musicVideoId;
    if (!streamVid) return;

    // 1. Tell backend to pre-extract and keep stream URL active in memory/disk cache
    try {
      fetch(`${this.apiBaseUrl}/api/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: [streamVid] })
      }).catch(() => {});
    } catch (e) {}

    // 2. Pre-buffer initial audio in browser for instant gapless start
    if (!this.preloadAudio) {
      this.preloadAudio = new Audio();
      this.preloadAudio.preload = 'auto';
    }
    const streamUrl = `${this.apiBaseUrl}/api/stream/${streamVid}`;
    if (this.preloadedVid !== streamVid) {
      this.preloadedVid = streamVid;
      this.preloadAudio.src = streamUrl;
      this.preloadAudio.load();
    }
  }

  switchVideoPreservingTime(newVideoId, autoPlay = true) {
    const vid = (typeof newVideoId === 'string' && newVideoId)
      ? newVideoId
      : (this.currentTrack ? (this.currentTrack.musicVideoId || this.currentTrack.ytId) : null);
    const curTime = this.getCurrentTime();
    this.mode = 'video';
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }

    if (this.player && this.isReady && typeof this.player.loadVideoById === 'function' && vid) {
      if (!this.isMuted) {
        try {
          if (typeof this.player.unMute === 'function') this.player.unMute();
          if (typeof this.player.setVolume === 'function') this.player.setVolume(this.volume);
        } catch (e) {}
      }
      try {
        this.player.loadVideoById({
          videoId: vid,
          startSeconds: curTime || 0
        });
        if (autoPlay) {
          this.player.playVideo();
          this.isPlayingState = true;
          this._startVideoProgressTicker();
        }
      } catch (e) {
        try {
          this.player.loadVideoById(vid, curTime || 0);
          if (autoPlay) this.player.playVideo();
          this.isPlayingState = true;
          this._startVideoProgressTicker();
        } catch (err) {
          console.warn('Error switching to video:', err);
        }
      }
    } else if (vid) {
      this.pendingVideo = { videoId: vid, startSeconds: curTime || 0, autoPlay };
    }
  }

  switchToVideoPreservingTime(newVideoId, autoPlay = true) {
    return this.switchVideoPreservingTime(newVideoId, autoPlay);
  }

  switchToSongPreservingTime() {
    this._stopVideoProgressTicker();
    const curTime = this.getCurrentTime();
    this.mode = 'song';
    if (this.player && this.isReady) {
      try { this.player.pauseVideo(); } catch (e) {}
    }
    const streamVid = this.currentTrack ? (this.currentTrack.audioId || this.currentTrack.ytId || this.currentTrack.musicVideoId) : null;
    if (this.audio && streamVid) {
      const streamUrl = `${this.apiBaseUrl}/api/stream/${streamVid}`;
      if (!this.audio.src || !this.audio.src.includes(streamVid)) {
        this.audio.src = streamUrl;
      }
      this.audio.currentTime = curTime || 0;
      this.audio.play().then(() => {
        this.isPlayingState = true;
      }).catch(() => {});
    }
  }

  play() {
    if (this.equalizer) this.equalizer.resume();
    if (this.mode === 'song') {
      // Stop and pause YouTube iframe so ONLY the native studio audio plays
      if (this.player && this.isReady && typeof this.player.pauseVideo === 'function') {
        try { this.player.pauseVideo(); } catch (e) {}
      }
      if (this.audio) {
        this.audio.play().then(() => {
          this.isPlayingState = true;
        }).catch(err => console.warn('Play error:', err));
      }
    } else {
      // In video mode: play video unmuted with full fidelity
      if (this.player && this.isReady && typeof this.player.playVideo === 'function') {
        if (!this.isMuted) {
          try {
            if (typeof this.player.unMute === 'function') this.player.unMute();
            if (typeof this.player.setVolume === 'function') this.player.setVolume(this.volume);
          } catch (e) {}
        }
        this.player.playVideo();
        this.isPlayingState = true;
        this._startVideoProgressTicker();
      }
      if (this.audio && !this.audio.paused) {
        this.audio.pause();
      }
    }
  }

  pause() {
    this._stopVideoProgressTicker();
    // ALWAYS pause BOTH native audio and YouTube iframe
    if (this.audio) {
      this.audio.pause();
    }
    if (this.player && this.isReady && typeof this.player.pauseVideo === 'function') {
      try { this.player.pauseVideo(); } catch (e) {}
    }
    this.isPlayingState = false;
  }

  togglePlay() {
    if (this.isPlayingState) {
      this.pause();
    } else {
      this.play();
    }
  }

  getCurrentTime() {
    if (this.mode === 'video' && this.player && typeof this.player.getCurrentTime === 'function') {
      return this.player.getCurrentTime() || 0;
    }
    return this.audio ? this.audio.currentTime || 0 : 0;
  }

  getDuration() {
    if (this.mode === 'video' && this.player && typeof this.player.getDuration === 'function') {
      return this.player.getDuration() || (this.currentTrack ? this.currentTrack.durationSec : 0);
    }
    if (this.audio && this.audio.duration && !isNaN(this.audio.duration) && this.audio.duration > 0) {
      return this.audio.duration;
    }
    return this.currentTrack ? this.currentTrack.durationSec || 0 : 0;
  }

  seekTo(seconds) {
    const sec = Math.max(0, parseFloat(seconds));
    if (isNaN(sec)) return;

    if (this.audio) {
      try {
        if (typeof this.audio.fastSeek === 'function') {
          this.audio.fastSeek(sec);
        } else {
          this.audio.currentTime = sec;
        }
        if (!this.isPlayingState) {
          this.audio.play().catch(() => {});
          this.isPlayingState = true;
        }
      } catch (e) {
        console.warn('Audio seek error:', e);
      }
    }

    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(sec, true);
        if (this.mode === 'video' && !this.isPlayingState) {
          this.player.playVideo();
          this.isPlayingState = true;
        }
      } catch (e) {
        console.warn('IFrame seek error:', e);
      }
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(100, val));
    try {
      localStorage.setItem('cadence_volume', this.volume.toString());
    } catch (e) {}

    const normalized = this.volume / 100;
    if (this.audio) {
      this.audio.volume = normalized;
      if (this.volume > 0) this.audio.muted = false;
    }
    if (this.player && this.isReady && typeof this.player.setVolume === 'function') {
      this.player.setVolume(this.volume);
      if (this.volume > 0 && this.isMuted) {
        this.player.unMute();
        this.isMuted = false;
      }
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.audio) this.audio.muted = this.isMuted;
    if (this.player && this.isReady) {
      if (this.isMuted) {
        this.player.mute();
      } else {
        this.player.unMute();
      }
    }
    return this.isMuted;
  }

  setPlaybackQuality(quality) {
    this.preferredQuality = quality;
    try {
      localStorage.setItem('cadence_quality', quality);
    } catch (e) {}
    if (this.player && this.isReady && typeof this.player.setPlaybackQuality === 'function') {
      try {
        this.player.setPlaybackQuality(quality);
      } catch (e) {}
    }
  }

  getPlaybackQuality() {
    if (this.player && this.isReady && typeof this.player.getPlaybackQuality === 'function') {
      try {
        const q = this.player.getPlaybackQuality();
        if (q) return q;
      } catch (e) {}
    }
    return this.preferredQuality || 'auto';
  }

  getAvailableQualityLevels() {
    if (this.player && this.isReady && typeof this.player.getAvailableQualityLevels === 'function') {
      try {
        const lvls = this.player.getAvailableQualityLevels();
        if (Array.isArray(lvls) && lvls.length > 0) return lvls;
      } catch (e) {}
    }
    return ['hd1080', 'hd720', 'large', 'medium', 'small', 'auto'];
  }

  onStateChange(cb) { this.onStateChangeCallbacks.push(cb); }
  onProgress(cb) { this.onProgressCallbacks.push(cb); }
  onTrackEnd(cb) { this.onTrackEndCallbacks.push(cb); }
  onError(cb) { this.onErrorCallbacks.push(cb); }
  onQualityChange(cb) { this.onQualityChangeCallbacks.push(cb); }
}

window.audioPlayer = new YouTubeAudioPlayer();

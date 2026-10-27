// Cadence Music Web Application Core Engine

class YouTubeMusicApp {
  constructor() {
    let savedLastTrack = null;
    try {
      savedLastTrack = JSON.parse((localStorage.getItem('cadence_last_played_track') || localStorage.getItem('aura_last_played_track')) || 'null');
    } catch (e) {}

    if (savedLastTrack && savedLastTrack.title) {
      this.currentTrack = savedLastTrack;
      try {
        const savedQueue = JSON.parse((localStorage.getItem('cadence_last_queue') || localStorage.getItem('aura_last_queue')) || 'null');
        this.queue = Array.isArray(savedQueue) && savedQueue.length > 0 ? savedQueue : [savedLastTrack];
      } catch (e) {
        this.queue = [savedLastTrack];
      }
      this.currentTrackIndex = parseInt((localStorage.getItem('cadence_last_track_index') || localStorage.getItem('aura_last_track_index')) || '0', 10);
      if (this.currentTrackIndex < 0 || this.currentTrackIndex >= this.queue.length) {
        this.currentTrackIndex = 0;
      }
    } else {
      this.currentTrack = null;
      this.queue = [];
      this.currentTrackIndex = -1;
    }
    this.currentView = 'home';
    this.currentCategory = 'all';
    this.isShuffled = false;
    this.repeatMode = 0; // 0: none, 1: all, 2: one
    try {
      const savedIds = JSON.parse((localStorage.getItem('cadence_liked_track_ids') || localStorage.getItem('aura_liked_track_ids')) || 'null');
      this.likedTrackIds = Array.isArray(savedIds) ? new Set(savedIds) : new Set();
    } catch (e) {
      this.likedTrackIds = new Set();
    }

    try {
      this.likedSongsList = JSON.parse((localStorage.getItem('cadence_liked_songs') || localStorage.getItem('aura_liked_songs')) || '[]');
      if (!Array.isArray(this.likedSongsList)) {
        this.likedSongsList = [];
      }
    } catch (e) {
      this.likedSongsList = [];
    }

    try {
      this.downloadedSongsList = JSON.parse((localStorage.getItem('cadence_downloaded_songs') || localStorage.getItem('aura_downloaded_songs')) || '[]');
    } catch (e) {
      this.downloadedSongsList = [];
    }
    this.dislikedTrackIds = new Set();
    this.isVideoPanelOpen = false;
    this.currentMediaMode = 'song'; // 'song' | 'video'
    this.isQueueOpen = false;
    this.isLyricsOpen = false;
    this.isFullscreen = false;
    this.fullscreenMode = 'song'; // 'song' | 'video'
    this.turntableRpm = 33;
    this.playedSongTitles = new Set();

    // Lyrics State (Interactive & Synced)
    this.currentLyrics = [];
    this.rawLyricsText = null;
    this.translatedLyricsText = null;
    this.isLyricsTranslated = false;
    this.activeLyricIndex = -1;

    // Backend Connection
    this.apiBaseUrl = window.location.origin.includes('5000') ? window.location.origin : 'http://127.0.0.1:5000';
    this.isBackendOnline = false;
    this.searchDebounceTimer = null;
    this.prefetchedVids = new Set();
    this.isExtendingQueue = false;
    this.lastQueueExtendIndex = -1;
    this.currentImportTab = 'url';
    this.sleepTimerInterval = null;
    this.sleepTimerRemainingSec = 0;
    this.sleepTimerMode = 'off';
    this.pipWindow = null;
    this.previousView = 'home';
    this.currentPlaylistData = null;
    this.similarArtistCache = {};
    this.fetchingSimilarArtist = null;
    this.quickPicksAdjacentCache = {};
    this.isFetchingQuickPicksAdjacent = false;
    this.authToken = (localStorage.getItem('cadence_auth_token') || localStorage.getItem('aura_auth_token')) || null;
    this.currentUser = null;
    try {
      this.currentUser = JSON.parse((localStorage.getItem('cadence_auth_user') || localStorage.getItem('aura_auth_user')) || 'null');
    } catch (e) {
      this.currentUser = null;
    }
    this.authMode = 'login';
    this.syncDebounceTimer = null;
    try {
      this.userPlaylists = JSON.parse((localStorage.getItem('cadence_user_playlists') || localStorage.getItem('aura_user_playlists')) || '[]');
    } catch (e) {
      this.userPlaylists = [];
    }

    // Search History Storage
    try {
      this.searchHistory = JSON.parse((localStorage.getItem('cadence_search_history') || localStorage.getItem('aura_search_history')) || '[]');
    } catch (e) {
      this.searchHistory = [];
    }

    // Song Listening History & Taste Engine Storage
    try {
      this.songHistory = JSON.parse((localStorage.getItem('cadence_song_history') || localStorage.getItem('aura_song_history')) || '[]');
      if (!Array.isArray(this.songHistory)) this.songHistory = [];
    } catch (e) {
      this.songHistory = [];
    }

    this.currentTrackRecorded = false;
    this.currentTrackListenedSeconds = 0;
    this.userClosedFloatingPanel = false;

    this.sanitizeSongHistory();
    this.init();
  }

  prefetchVid(vid) {
    if (!vid || !this.isBackendOnline) return;
    if (this.prefetchedVids.has(vid)) return;
    this.prefetchedVids.add(vid);
    fetch(`${this.apiBaseUrl}/api/prefetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds: [vid] })
    }).catch(() => {});
  }

  prefetchTrackById(trackId) {
    const track = (YTM_DATA && YTM_DATA.tracks) ? YTM_DATA.tracks.find(t => t.id === trackId) : null;
    if (!track) return;
    const vid = track.audioId || track.ytId || track.musicVideoId;
    this.prefetchVid(vid);
  }

  async init() {
    this.initTheme();
    this.initCustomBackground();
    this.initTasteEngine();
    this.initAuth();
    this.updateAuthUI();
    this.renderCategoryPills();
    this.renderSidebarPlaylists();
    this.renderSupermix();
    this.renderSimilarArtists();
    this.renderListenAgain();
    this.renderHeavyRotation();
    this.renderQuickPicks();
    this.renderRecommendedPlaylists();
    this.renderTrending();
    this.renderGenres();
    this.renderLibrary();
    this.renderSearchHistory();
    this.renderHistoryView();
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.updatePlayerBar(this.currentTrack, false);
    this.bindEvents();
    this.initDraggablePanel();
    if (this.currentTrack) {
      if (window.innerWidth >= 768) { this.showFloatingPanel('song'); }
    } else {
      const floatPanel = document.getElementById('floating-video-window');
      if (floatPanel) floatPanel.classList.add('hidden');
    }

    // Speculatively pre-warm top starter quick picks in the background for instant playback
    if (YTM_DATA && Array.isArray(YTM_DATA.tracks)) {
      const topVids = YTM_DATA.tracks.slice(0, 8).map(t => t.audioId || t.ytId).filter(Boolean);
      if (topVids.length > 0) {
        fetch(`${this.apiBaseUrl}/api/prefetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds: topVids })
        }).catch(() => {});
      }
    }

    // Restore saved volume
    const savedVol = (localStorage.getItem('cadence_volume') || localStorage.getItem('aura_volume'));
    const initialVol = savedVol !== null ? parseInt(savedVol, 10) : 80;
    const volumeSlider = document.getElementById('volume-slider');
    const fsVolume = document.getElementById('fs-volume');
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-primary').trim() || '#8b5cf6';
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-secondary').trim() || '#d946ef';

    if (volumeSlider) {
      volumeSlider.value = initialVol;
      volumeSlider.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${initialVol}%, #3a3a3a ${initialVol}%, #3a3a3a 100%)`;
    }
    if (fsVolume) {
      fsVolume.value = initialVol;
      fsVolume.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${initialVol}%, #3a3a3a ${initialVol}%, #3a3a3a 100%)`;
    }
    this.updateVolumeIcon(initialVol);
    if (window.audioPlayer) {
      window.audioPlayer.setVolume(initialVol);
    }

    // Restore and sync quality
    const savedQuality = (localStorage.getItem('cadence_quality') || localStorage.getItem('aura_quality')) || 'hd1080';
    this.updateQualityUI(savedQuality);

    // Hook YouTube player callbacks
    if (window.audioPlayer) {
      window.audioPlayer.onStateChange((state, isPlaying) => {
        this.updatePlayPauseUI(isPlaying);
      });

      window.audioPlayer.onProgress((currentTime, duration) => {
        this.updateProgressUI(currentTime, duration);
        // YouTube Music style attribution:
        // Automatically queued songs only count as played if listened to for at least 30 seconds
        if (!this.currentTrackRecorded && this.currentTrack && currentTime >= 30) {
          this.currentTrackRecorded = true;
          this.recordSongPlay(this.currentTrack);
        }
      });

      window.audioPlayer.onQualityChange((quality) => {
        this.updateQualityUI(quality);
      });

      window.audioPlayer.onTrackEnd(() => {
        // Track finished to completion: record as listened if not already recorded
        if (!this.currentTrackRecorded && this.currentTrack) {
          this.currentTrackRecorded = true;
          this.recordSongPlay(this.currentTrack);
        }
        this.handleTrackEnded();
      });
    }

    // Close quality dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#quality-selector-container') && !e.target.closest('#cinema-quality-container')) {
        const drop1 = document.getElementById('quality-menu-dropdown');
        const drop2 = document.getElementById('cinema-quality-dropdown');
        if (drop1) drop1.classList.add('hidden');
        if (drop2) drop2.classList.add('hidden');
      }
    });

    // Check backend status
    await this.checkBackendStatus();

    // Refresh icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async checkBackendStatus() {
    const statusBadge = document.querySelector('#sidebar .border-t span.flex');
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/health`, { method: 'GET' });
      if (res.ok) {
        this.isBackendOnline = true;
        if (statusBadge) {
          statusBadge.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-emerald-400 font-medium">Cadence Online</span>
          `;
        }
        console.log('[Cadence] Connected to local backend.');
        this.loadLiveTrending();
      }
    } catch (e) {
      this.isBackendOnline = false;
      if (statusBadge) {
        statusBadge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-amber-500"></span>
          <span class="text-amber-400">Offline Mode</span>
        `;
      }
    }
  }

  async loadLiveTrending() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/trending`);
      if (res.ok) {
        const liveTracks = await res.json();
        if (Array.isArray(liveTracks) && liveTracks.length > 0) {
          const container = document.getElementById('trending-tracks-grid');
          if (container) {
            container.innerHTML = liveTracks.slice(0, 4).map(t => `
              <div class="bg-ytm-card hover:bg-ytm-hover p-3 rounded-xl cursor-pointer transition-colors flex items-center gap-3 group" onclick="app.playLiveTrack(${JSON.stringify(t).replace(/"/g, '&quot;')})">
                <div class="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                  <img src="${t.cover}" alt="${t.title}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId}/hqdefault.jpg'" class="w-full h-full object-cover">
                  <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <i data-lucide="play" class="w-5 h-5 text-white fill-current"></i>
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="font-semibold text-sm truncate text-white">${t.title}</h4>
                  <p class="text-xs text-ytm-muted truncate">${t.artist}</p>
                  <span class="text-[10px] text-zinc-500 font-medium">${t.plays}</span>
                </div>
              </div>
            `).join('');
            if (window.lucide) window.lucide.createIcons();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live trending:', e);
    }
  }

  // --- RENDERING METHODS ---

  renderCategoryPills() {
    const container = document.getElementById('category-pills-bar');
    if (!container) return;

    const pillsHtml = YTM_DATA.categories.map(cat => `
      <button 
        class="badge-pill px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap border border-[#333] ${this.currentCategory === cat.id ? 'active' : 'bg-[#1e1e1e] text-zinc-300 hover:bg-[#2e2e2e]'}"
        onclick="app.selectCategory('${cat.id}')"
      >
        ${cat.label}
      </button>
    `).join('');

    const tasteBtnHtml = `
      <button 
        class="px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 border border-violet-500/40 text-violet-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm ml-auto shrink-0"
        onclick="app.openModal('taste-profile-modal')"
        title="View YouTube Music Taste Profile & Recommendations Algorithm"
      >
        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-400"></i>
        <span>Taste Algorithm</span>
      </button>
    `;

    container.innerHTML = pillsHtml + tasteBtnHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  selectCategory(catId) {
    this.currentCategory = catId;
    this.renderCategoryPills();
    this.renderQuickPicks();
  }


  getLikedTracks() {
    const list = Array.isArray(this.likedSongsList) ? [...this.likedSongsList] : [];
    if (window.YTM_DATA && Array.isArray(YTM_DATA.tracks)) {
      YTM_DATA.tracks.forEach(t => {
        if (this.likedTrackIds.has(t.id) && !list.some(lt => (lt.id === t.id || (lt.ytId && lt.ytId === t.ytId)))) {
          list.push(t);
        }
      });
    }
    return list;
  }

  getDownloadedTracks() {
    return Array.isArray(this.downloadedSongsList) ? this.downloadedSongsList : [];
  }

  playDefaultPlaylist(type) {
    let tracks = [];
    let name = '';
    if (type === 'liked') {
      tracks = this.getLikedTracks();
      name = 'Liked Songs';
    } else if (type === 'downloaded') {
      tracks = this.getDownloadedTracks();
      name = 'Downloaded';
    }

    if (!tracks || tracks.length === 0) {
      this.showToast(`No tracks in ${name} yet`, 'info', 'text-amber-400');
      return;
    }

    this.playedSongTitles.clear();
    this.queue = [...tracks];
    this.lastQueueExtendIndex = -1;
    this.currentTrackIndex = 0;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing ${name} (${tracks.length} songs)`, 'play', 'text-emerald-400');
  }

  // --- PLAYLIST DETAIL VIEW ENGINE (Browse Content Before Playing) ---

  navigateBackFromPlaylist() {
    const target = (this.previousView && this.previousView !== 'playlist') ? this.previousView : 'home';
    this.navigate(target);
  }

  openDefaultPlaylist(type) {
    let tracks = [];
    let title = '';
    let description = '';
    let badge = 'SYSTEM PLAYLIST';
    let curator = 'Auto-generated';
    let cover = '';

    if (type === 'liked') {
      tracks = this.getLikedTracks();
      title = 'Liked Songs';
      description = 'Auto-playlist of all tracks you have added to your Favorites and Liked songs collection.';
      badge = 'FAVORITES';
      curator = 'Your Profile';
      const pick = tracks.length > 0 ? (tracks[Math.floor(Math.random() * tracks.length)] || tracks[0]) : null;
      cover = (pick && pick.cover)
        ? pick.cover
        : ((tracks.length > 0 && tracks[0].cover)
          ? tracks[0].cover
          : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80');
    } else if (type === 'downloaded') {
      tracks = this.getDownloadedTracks();
      title = 'Downloaded Songs';
      description = 'High-fidelity audio cached locally on your device for seamless offline listening.';
      badge = 'OFFLINE CACHE';
      curator = 'Local Storage';
      const pick = tracks.length > 0 ? (tracks[Math.floor(Math.random() * tracks.length)] || tracks[0]) : null;
      cover = (pick && pick.cover)
        ? pick.cover
        : ((tracks.length > 0 && tracks[0].cover)
          ? tracks[0].cover
          : 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80');
    }

    this.renderPlaylistViewContent({
      id: `default-${type}`,
      type: 'default',
      defaultType: type,
      title,
      description,
      badge,
      curator,
      cover,
      tracks
    });
  }

  openPlaylist(playlistId) {
    const pl = (typeof YTM_DATA !== 'undefined' && YTM_DATA.playlists) 
      ? YTM_DATA.playlists.find(p => p.id === playlistId)
      : null;
    if (!pl) return;

    const tracks = pl.trackIds
      ? pl.trackIds.map(id => (YTM_DATA.tracks || []).find(t => t.id === id)).filter(Boolean)
      : [];

    const cover = pl.cover || ((tracks.length > 0 && tracks[0].cover) ? tracks[0].cover : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80');

    this.renderPlaylistViewContent({
      id: pl.id,
      type: 'curated',
      title: pl.title,
      description: pl.subtitle || 'Curated playlist on Cadence Music',
      badge: 'FEATURED PLAYLIST',
      curator: 'Cadence Music',
      cover,
      tracks
    });
  }

  openUserPlaylist(index) {
    if (!this.userPlaylists || !this.userPlaylists[index]) return;
    const pl = this.userPlaylists[index];
    const tracks = pl.tracks || [];
    const cover = (tracks.length > 0 && tracks[0].cover)
      ? tracks[0].cover
      : (pl.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80');

    this.renderPlaylistViewContent({
      id: `user-${index}`,
      userIndex: index,
      type: 'user',
      title: pl.name,
      description: pl.description || 'Custom playlist created by you',
      badge: 'CUSTOM PLAYLIST',
      curator: 'You',
      cover,
      tracks
    });
  }

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  renderPlaylistViewContent(playlistData) {
    this.currentPlaylistData = playlistData;
    this.navigate('playlist');

    const coverEl = document.getElementById('playlist-view-cover');
    const badgeEl = document.getElementById('playlist-view-badge');
    const titleEl = document.getElementById('playlist-view-title');
    const descEl = document.getElementById('playlist-view-description');
    const curatorEl = document.getElementById('playlist-view-curator');
    const statsEl = document.getElementById('playlist-view-stats');
    const tracksContainer = document.getElementById('playlist-view-tracks-list');

    if (coverEl) coverEl.src = playlistData.cover || '';
    if (badgeEl) badgeEl.innerText = playlistData.badge || 'PLAYLIST';
    if (titleEl) titleEl.innerText = playlistData.title || 'Untitled Playlist';
    if (descEl) descEl.innerText = playlistData.description || '';
    if (curatorEl) curatorEl.innerText = playlistData.curator || 'Cadence Music';

    const tracks = playlistData.tracks || [];
    if (statsEl) {
      statsEl.innerText = `${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`;
    }

    if (!tracksContainer) return;

    if (tracks.length === 0) {
      tracksContainer.innerHTML = `
        <div class="py-16 text-center border border-dashed border-zinc-800 rounded-2xl space-y-2 my-2 bg-white/[0.01]">
          <div class="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <i data-lucide="music-2" class="w-6 h-6"></i>
          </div>
          <p class="text-sm font-semibold text-zinc-300">No tracks in this playlist yet</p>
          <p class="text-xs text-zinc-500 max-w-sm mx-auto font-mono-code">Browse tracks or search songs to add them to this playlist.</p>
        </div>
      `;
    } else {
      tracksContainer.innerHTML = tracks.map((t, idx) => {
        const isCurrent = this.currentTrack && this.normalizeSongTitle(this.currentTrack.title) === this.normalizeSongTitle(t.title);
        const isLiked = this.likedTrackIds && this.likedTrackIds.has(t.id);
        const escapedTrackJson = JSON.stringify(t).replace(/"/g, '&quot;');

        return `
          <div 
            class="playlist-track-row group grid grid-cols-12 items-center px-4 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer ${isCurrent ? 'bg-violet-600/15 border border-violet-500/30' : 'border border-transparent'}"
            onclick="app.playPlaylistTrack(${idx})"
            data-track-index="${idx}"
            data-song-id="${t.id}"
          >
            <!-- Col 1: Index / Play Icon / Equalizer -->
            <div class="col-span-1 flex items-center justify-center">
              ${isCurrent ? `
                <div class="playing-indicator text-violet-400 group-hover:hidden">
                  <i data-lucide="volume-2" class="w-4 h-4 animate-pulse"></i>
                </div>
              ` : `
                <span class="text-xs font-mono-code text-zinc-500 group-hover:hidden">${idx + 1}</span>
              `}
              <div class="hidden group-hover:block">
                <i data-lucide="play" class="w-3.5 h-3.5 text-white fill-current"></i>
              </div>
            </div>

            <!-- Col 2: Title, Artist, Thumbnail -->
            <div class="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0 pr-2">
              <img 
                src="${t.cover || ''}" 
                alt="${this.escapeHtml(t.title)}" 
                referrerpolicy="no-referrer" 
                onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId || ''}/hqdefault.jpg'" 
                class="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm border border-white/5"
              >
              <div class="min-w-0 flex-1">
                <h4 class="font-semibold text-sm truncate ${isCurrent ? 'text-violet-300 font-bold' : 'text-white group-hover:text-violet-300'} transition-colors">
                  ${this.escapeHtml(t.title)}
                </h4>
                <p class="text-xs text-zinc-400 truncate group-hover:text-zinc-300">${this.escapeHtml(t.artist)}</p>
              </div>
            </div>

            <!-- Col 3: Album / Source / Genre (hidden on small screens) -->
            <div class="hidden sm:block sm:col-span-4 min-w-0 pr-2">
              <span class="text-xs text-zinc-400 truncate block font-mono-code">${this.escapeHtml(t.album || t.artist + ' - Single')}</span>
            </div>

            <!-- Col 4: Actions & Duration -->
            <div class="col-span-5 sm:col-span-2 flex items-center justify-end gap-2.5 text-xs text-zinc-400 font-mono-code pr-1">
              <!-- Like button -->
              <button 
                onclick="event.stopPropagation(); app.toggleLike('${t.id}')" 
                class="p-1 rounded-md hover:text-white transition-colors" 
                title="${isLiked ? 'Unlike' : 'Like'}"
              >
                <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-zinc-500 hover:text-white'}"></i>
              </button>

              <!-- Context menu button -->
              <button 
                onclick="event.stopPropagation(); app.showSongContextMenu(event, ${escapedTrackJson})" 
                class="p-1 rounded-md text-zinc-500 hover:text-white transition-colors" 
                title="More actions"
              >
                <i data-lucide="more-vertical" class="w-4 h-4"></i>
              </button>

              <!-- Duration -->
              <span class="w-10 text-right">${t.duration || '3:30'}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  playPlaylistTrack(index) {
    if (!this.currentPlaylistData || !this.currentPlaylistData.tracks || !this.currentPlaylistData.tracks[index]) return;
    this.playedSongTitles.clear();
    this.queue = [...this.currentPlaylistData.tracks];
    this.lastQueueExtendIndex = -1;
    this.currentTrackIndex = index;
    this.playQueueIndex(index, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.updatePlaylistTrackActiveState();
  }

  playCurrentViewPlaylist(shuffle = false) {
    if (!this.currentPlaylistData || !this.currentPlaylistData.tracks || this.currentPlaylistData.tracks.length === 0) {
      this.showToast('No tracks in playlist to play', 'info', 'text-amber-400');
      return;
    }
    let tracks = [...this.currentPlaylistData.tracks];
    if (shuffle) {
      tracks = this.shuffleArray(tracks);
    }
    this.playedSongTitles.clear();
    this.queue = tracks;
    this.lastQueueExtendIndex = -1;
    this.currentTrackIndex = 0;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.updatePlaylistTrackActiveState();
    this.showToast(`${shuffle ? 'Shuffled' : 'Playing'} ${this.currentPlaylistData.title}`, 'play', 'text-emerald-400');
  }

  updatePlaylistTrackActiveState() {
    if (this.currentView !== 'playlist') return;
    const rows = document.querySelectorAll('.playlist-track-row');
    rows.forEach(row => {
      const idx = parseInt(row.getAttribute('data-track-index'), 10);
      const isCurrent = this.currentPlaylistData && 
        this.currentPlaylistData.tracks && 
        this.currentPlaylistData.tracks[idx] && 
        this.currentTrack && 
        this.normalizeSongTitle(this.currentPlaylistData.tracks[idx].title) === this.normalizeSongTitle(this.currentTrack.title);

      row.classList.toggle('bg-violet-600/15', !!isCurrent);
      row.classList.toggle('border-violet-500/30', !!isCurrent);
      row.classList.toggle('border-transparent', !isCurrent);

      const titleEl = row.querySelector('h4');
      if (titleEl) {
        titleEl.classList.toggle('text-violet-300', !!isCurrent);
        titleEl.classList.toggle('font-bold', !!isCurrent);
      }
    });
  }

  renderSidebarPlaylists() {
    const container = document.getElementById('sidebar-playlists');
    const countBadge = document.getElementById('sidebar-playlist-count');
    if (!container) return;

    const likedCount = this.getLikedTracks().length;
    const downloadedCount = this.getDownloadedTracks().length;
    const totalPlaylists = 2 + (this.userPlaylists ? this.userPlaylists.length : 0);

    if (countBadge) countBadge.innerText = totalPlaylists;

    // 1. Two Default System Playlists: Liked Songs & Downloaded
    const defaultPlaylistsHtml = `
      <div class="space-y-1 mb-2 pb-2 border-b border-zinc-800/80">
        <!-- Liked Songs Default Playlist -->
        <div 
          class="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-all border border-transparent hover:border-zinc-800"
          onclick="app.openDefaultPlaylist('liked')"
          title="View Liked Songs"
        >
          <div class="flex items-center gap-2.5 truncate pr-2">
            <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-600 to-fuchsia-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <i data-lucide="heart" class="w-3.5 h-3.5 fill-current"></i>
            </div>
            <span class="truncate font-semibold text-white group-hover:text-rose-300 transition-colors">Liked Songs</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              onclick="event.stopPropagation(); app.playDefaultPlaylist('liked')" 
              class="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-zinc-400 transition-opacity" 
              title="Play Liked Songs"
            >
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <span class="text-[10px] font-mono-code text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md">${likedCount}</span>
          </div>
        </div>

        <!-- Downloaded Default Playlist -->
        <div 
          class="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-all border border-transparent hover:border-zinc-800"
          onclick="app.openDefaultPlaylist('downloaded')"
          title="View Downloaded Songs"
        >
          <div class="flex items-center gap-2.5 truncate pr-2">
            <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <i data-lucide="arrow-down-to-line" class="w-3.5 h-3.5"></i>
            </div>
            <span class="truncate font-semibold text-white group-hover:text-cyan-300 transition-colors">Downloaded</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              onclick="event.stopPropagation(); app.playDefaultPlaylist('downloaded')" 
              class="opacity-0 group-hover:opacity-100 p-1 hover:text-cyan-400 text-zinc-400 transition-opacity" 
              title="Play Downloaded Songs"
            >
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <span class="text-[10px] font-mono-code text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded-md">${downloadedCount}</span>
          </div>
        </div>
      </div>
    `;

    // 2. Custom User Playlists
    let userPlaylistsHtml = '';
    if (!this.userPlaylists || this.userPlaylists.length === 0) {
      userPlaylistsHtml = `
        <div class="px-3 py-2.5 text-center border border-dashed border-zinc-800/60 rounded-xl space-y-0.5 my-1">
          <div class="text-[11px] text-zinc-400 font-medium">No custom playlists</div>
          <div class="text-[10px] text-zinc-500">Create new or import from URL</div>
        </div>
      `;
    } else {
      userPlaylistsHtml = this.userPlaylists.map((pl, idx) => `
        <div 
          class="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors border border-transparent hover:border-zinc-800"
          onclick="app.openUserPlaylist(${idx})"
          title="View ${this.escapeHtml(pl.name)}"
        >
          <div class="flex items-center gap-2 truncate pr-2">
            <i data-lucide="music" class="w-3.5 h-3.5 theme-accent-color shrink-0"></i>
            <span class="truncate font-medium">${this.escapeHtml(pl.name)}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              onclick="event.stopPropagation(); app.playUserPlaylist(${idx})" 
              class="opacity-0 group-hover:opacity-100 p-1 hover:text-violet-400 text-zinc-400 transition-opacity" 
              title="Play Playlist"
            >
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <span class="text-[10px] font-mono-code text-zinc-500">${pl.tracks ? pl.tracks.length : 0}</span>
          </div>
        </div>
      `).join('');
    }

    container.innerHTML = defaultPlaylistsHtml + userPlaylistsHtml;
    if (window.lucide) window.lucide.createIcons();
  }

  // --- YOUTUBE MUSIC HOME SHELVES (Listen Again, In Heavy Rotation, Quick Picks) ---

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const sec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (sec < 60) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }

  getListenAgainTracks() {
    if (!this.songHistory || !Array.isArray(this.songHistory)) return [];
    const seen = new Set();
    const list = [];
    const sorted = [...this.songHistory].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    for (const t of sorted) {
      const norm = this.normalizeSongTitle(t.title);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      list.push(t);
    }
    return list;
  }

  getRotationTracks() {
    if (!this.songHistory || !Array.isArray(this.songHistory)) return [];
    // Strictly requires 2-3+ plays to qualify for Heavy Rotation
    const filtered = this.songHistory.filter(t => (t.playCount || 0) >= 2);
    return filtered.sort((a, b) => {
      const diff = (b.playCount || 0) - (a.playCount || 0);
      if (diff !== 0) return diff;
      return (b.lastPlayed || 0) - (a.lastPlayed || 0);
    });
  }

  renderSongCardHtml(track, badgeHtml = '') {
    const isCurrent = this.currentTrack && (this.currentTrack.id === track.id || this.currentTrack.ytId === track.ytId);
    const isLiked = this.likedTrackIds && this.likedTrackIds.has(track.id || track.ytId);
    return `
      <div class="song-card flex items-center gap-3 p-2.5 rounded-xl ${isCurrent ? 'bg-violet-950/20 border border-violet-500/40' : 'bg-zinc-900/30 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-800'} group relative cursor-pointer transition-all" onmouseenter="app.prefetchVid('${track.audioId || track.ytId}')" onclick="app.playLiveTrack(${JSON.stringify(track).replace(/"/g, '&quot;')})">
        <div class="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700/60 shadow">
          <img src="${track.cover}" alt="${track.title}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${track.ytId}/hqdefault.jpg'" class="w-full h-full object-cover">
          <div class="play-overlay absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
            <i data-lucide="${isCurrent ? 'volume-2' : 'play'}" class="w-5 h-5 text-white fill-current"></i>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-bold text-xs sm:text-sm text-white truncate group-hover:text-violet-300 transition-colors">${track.title}</div>
          <div class="text-[11px] text-zinc-400 truncate">${track.artist}</div>
          ${badgeHtml ? `<div class="mt-0.5">${badgeHtml}</div>` : ''}
        </div>

        <div class="text-xs text-zinc-500 font-mono pr-1">${track.duration || '3:30'}</div>

        <button 
          class="p-1.5 text-zinc-400 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" 
          onclick="event.stopPropagation(); app.toggleLike('${track.id || track.ytId}')"
          title="Like"
        >
          <i data-lucide="heart" class="w-4 h-4 ${isLiked ? 'text-rose-500 fill-current' : ''}"></i>
        </button>
      </div>
    `;
  }

  renderListenAgain() {
    const section = document.getElementById('listen-again-section');
    const container = document.getElementById('listen-again-grid');
    if (!section || !container) return;

    const tracks = this.getListenAgainTracks();
    if (tracks.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = tracks.slice(0, 16).map(track => {
      const badge = `<span class="text-[10px] text-zinc-400 font-mono-code">${this.formatTimeAgo(track.lastPlayed)}</span>`;
      return this.renderSongCardHtml(track, badge);
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderHeavyRotation() {
    const section = document.getElementById('heavy-rotation-section');
    const container = document.getElementById('heavy-rotation-grid');
    if (!section || !container) return;

    const tracks = this.getRotationTracks();
    if (tracks.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = tracks.slice(0, 16).map(track => {
      const count = track.playCount || 2;
      const badge = count >= 3
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono-code"><i data-lucide="flame" class="w-3 h-3 text-rose-400"></i> ${count} plays</span>`
        : `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono-code">${count} plays • In Rotation</span>`;
      return this.renderSongCardHtml(track, badge);
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  getQuickPicksTracks() {
    const catalog = (window.YTM_DATA && Array.isArray(YTM_DATA.tracks)) ? [...YTM_DATA.tracks] : [];
    const likedTracks = this.getLikedTracks();
    const topAffinityArtists = this.getTopAffinityArtists(6);
    const topGenres = this.getTopAffinityGenres(4).map(g => g.category);

    // Listened songs set: songs the user has already played or listened to
    const listenedNorms = new Set();
    if (Array.isArray(this.songHistory)) {
      this.songHistory.forEach(h => {
        if (h && h.title) listenedNorms.add(this.normalizeSongTitle(h.title));
      });
    }
    if (this.currentTrack && this.currentTrack.title) {
      listenedNorms.add(this.normalizeSongTitle(this.currentTrack.title));
    }
    if (this.playedSongTitles) {
      this.playedSongTitles.forEach(t => {
        if (t) listenedNorms.add(this.normalizeSongTitle(t));
      });
    }

    const hasListened = (track) => {
      if (!track || !track.title) return true;
      const norm = this.normalizeSongTitle(track.title);
      return listenedNorms.has(norm);
    };

    // User's liked artists & primary names
    const likedArtistMap = new Map();
    likedTracks.forEach(t => {
      const parsed = this.extractIndividualArtists(t.artist);
      parsed.forEach(a => likedArtistMap.set(a.toLowerCase(), a));
    });
    topAffinityArtists.forEach(a => {
      likedArtistMap.set(a.name.toLowerCase(), a.name);
    });

    const candidatePool = [];
    const seenCandidateNorms = new Set();

    const addCandidate = (t, reason, score = 0) => {
      if (!t || !t.title || hasListened(t)) return;
      const norm = this.normalizeSongTitle(t.title);
      if (seenCandidateNorms.has(norm)) return;
      seenCandidateNorms.add(norm);
      candidatePool.push({
        ...t,
        _adjacencyReason: reason,
        _adjacencyScore: score
      });
    };

    // 1. YouTube Music radio / search cache of adjacent tracks for liked songs & artists
    if (this.quickPicksAdjacentCache) {
      Object.entries(this.quickPicksAdjacentCache).forEach(([key, list]) => {
        if (Array.isArray(list)) {
          list.forEach((t, idx) => {
            addCandidate(t, `Adjacent to ${key}`, 120 - idx);
          });
        }
      });
    }

    // 2. Local catalog tracks: unlistened songs by liked / top affinity artists
    catalog.forEach(t => {
      const art = (t.artist || '').toLowerCase();
      for (const [lowerArt, dispArt] of likedArtistMap.entries()) {
        if (art.includes(lowerArt)) {
          addCandidate(t, `Similar to ${dispArt}`, 90);
          break;
        }
      }
    });

    // 3. Local catalog tracks: unlistened songs matching user's top genres/categories
    catalog.forEach(t => {
      if (topGenres.includes(t.category)) {
        addCandidate(t, `In your taste profile`, 60);
      }
    });

    // 4. Category filtering if category pill is selected
    if (this.currentCategory !== 'all') {
      const catFiltered = candidatePool.filter(t => t.category === this.currentCategory);
      if (catFiltered.length >= 6) {
        // Boost category matches to top
        catFiltered.forEach(t => { t._adjacencyScore = (t._adjacencyScore || 0) + 50; });
      }
    }

    // 5. Cold-start / fallback if user hasn't built history yet:
    // Include unlistened catalog tracks across diverse categories so there's always 16 discovery tracks
    if (candidatePool.length < 16) {
      catalog.forEach(t => {
        if (!hasListened(t) && !seenCandidateNorms.has(this.normalizeSongTitle(t.title))) {
          if (this.currentCategory === 'all' || t.category === this.currentCategory) {
            addCandidate(t, 'Discovery pick', 30);
          }
        }
      });
    }

    // Sort candidates by adjacency score descending
    candidatePool.sort((a, b) => (b._adjacencyScore || 0) - (a._adjacencyScore || 0));

    // Speculatively fetch live adjacent songs from YouTube Music in the background
    this.ensureQuickPicksAdjacentFetched(likedTracks, topAffinityArtists);

    return candidatePool.slice(0, 16);
  }

  async ensureQuickPicksAdjacentFetched(likedTracks, topAffinityArtists) {
    if (!this.isBackendOnline || this.isFetchingQuickPicksAdjacent) return;
    if (!this.quickPicksAdjacentCache) this.quickPicksAdjacentCache = {};

    const targets = [];
    if (topAffinityArtists && topAffinityArtists.length > 0) {
      for (const a of topAffinityArtists.slice(0, 3)) {
        if (!this.quickPicksAdjacentCache[a.name]) {
          targets.push({ type: 'artist', name: a.name });
        }
      }
    }
    if (likedTracks && likedTracks.length > 0 && targets.length < 3) {
      for (const t of likedTracks.slice(0, 3)) {
        const vid = t.audioId || t.ytId;
        if (vid && !this.quickPicksAdjacentCache[t.title]) {
          targets.push({ type: 'watch', videoId: vid, title: t.title, artist: t.artist });
        }
      }
    }

    if (targets.length === 0) return;

    this.isFetchingQuickPicksAdjacent = true;
    try {
      let updated = false;
      for (const item of targets.slice(0, 2)) {
        if (item.type === 'watch') {
          const res = await fetch(`${this.apiBaseUrl}/api/watch?videoId=${item.videoId}`);
          if (res.ok) {
            const data = await res.json();
            const tracks = Array.isArray(data.tracks) ? data.tracks : [];
            if (tracks.length > 0) {
              this.quickPicksAdjacentCache[item.title] = tracks.slice(0, 12);
              updated = true;
            }
          }
        } else if (item.type === 'artist') {
          const res = await fetch(`${this.apiBaseUrl}/api/search?q=${encodeURIComponent(item.name)}&filter=songs`);
          if (res.ok) {
            const data = await res.json();
            const tracks = Array.isArray(data) ? data : (data.tracks || []);
            if (tracks.length > 0) {
              this.quickPicksAdjacentCache[item.name] = tracks.slice(0, 12);
              updated = true;
            }
          }
        }
      }
      if (updated) {
        this.renderQuickPicks();
      }
    } catch (err) {
      console.warn('Background adjacent fetch failed:', err);
    } finally {
      this.isFetchingQuickPicksAdjacent = false;
    }
  }


  // --- AUTHENTICATION & MULTI-DEVICE CLOUD SYNC ENGINE ---

  async initAuth() {
    if (!this.authToken) {
      this.updateAuthUI();
      return;
    }

    try {
      const res = await fetch(`${this.apiBaseUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem('cadence_auth_user', JSON.stringify(this.currentUser));
        this.updateAuthUI();
        // Sync latest cloud data down to this device
        await this.pullCloudSyncData();
      } else {
        // Invalid or expired token
        this.authToken = null;
        this.currentUser = null;
        localStorage.removeItem('cadence_auth_token'); localStorage.removeItem('aura_auth_token');
        localStorage.removeItem('cadence_auth_user'); localStorage.removeItem('aura_auth_user');
        this.updateAuthUI();
      }
    } catch (e) {
      console.warn('Auth verify error:', e);
      this.updateAuthUI();
    }
  }

  updateAuthUI() {
    const loginBtn = document.getElementById('header-login-btn');
    const userBtn = document.getElementById('header-user-btn');
    const userInitial = document.getElementById('header-user-initial');
    const userName = document.getElementById('header-user-name');
    const menuDisplayName = document.getElementById('user-menu-display-name');
    const menuUsername = document.getElementById('user-menu-username');

    const settingsInitial = document.getElementById('settings-user-initial');
    const settingsName = document.getElementById('settings-user-display-name');
    const settingsBadge = document.getElementById('settings-user-badge');
    const settingsSub = document.getElementById('settings-user-sub');
    const settingsAuthBtn = document.getElementById('settings-auth-btn');

    if (this.currentUser) {
      const name = this.currentUser.displayName || this.currentUser.username || 'User';
      const initial = name.charAt(0).toUpperCase();

      if (loginBtn) loginBtn.classList.add('hidden');
      if (userBtn) userBtn.classList.remove('hidden');
      if (userInitial) userInitial.textContent = initial;
      if (userName) userName.textContent = name;
      if (menuDisplayName) menuDisplayName.textContent = name;
      if (menuUsername) menuUsername.textContent = `@${this.currentUser.username}`;

      if (settingsInitial) settingsInitial.textContent = initial;
      if (settingsName) settingsName.textContent = name;
      if (settingsBadge) {
        settingsBadge.textContent = 'CLOUD SYNCED';
        settingsBadge.className = 'text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      }
      if (settingsSub) settingsSub.textContent = `@${this.currentUser.username} • Synced with Phone & PC`;
      if (settingsAuthBtn) {
        settingsAuthBtn.textContent = 'Sign Out';
        settingsAuthBtn.className = 'px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all';
        settingsAuthBtn.onclick = () => { this.logout(); this.closeSettingsModal(); };
      }
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userBtn) userBtn.classList.add('hidden');

      if (settingsInitial) settingsInitial.textContent = 'G';
      if (settingsName) settingsName.textContent = 'Guest Mode';
      if (settingsBadge) {
        settingsBadge.textContent = 'LOCAL ONLY';
        settingsBadge.className = 'text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-zinc-700/60 text-zinc-300 border border-zinc-600/50';
      }
      if (settingsSub) settingsSub.textContent = 'Sign in to sync with your phone';
      if (settingsAuthBtn) {
        settingsAuthBtn.textContent = 'Sign In / Sync';
        settingsAuthBtn.className = 'px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-semibold transition-all';
        settingsAuthBtn.onclick = () => { this.openAuthModal('login'); this.closeSettingsModal(); };
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  openAuthModal(mode = 'login') {
    this.switchAuthMode(mode);
    const modal = document.getElementById('auth-modal');
    const errBanner = document.getElementById('auth-error-banner');
    if (errBanner) errBanner.classList.add('hidden');
    const pwdInput = document.getElementById('auth-password');
    if (pwdInput) pwdInput.value = '';
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  switchAuthMode(mode) {
    this.authMode = mode;
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const displayNameGroup = document.getElementById('auth-displayname-group');
    const submitText = document.getElementById('auth-submit-text');
    const errBanner = document.getElementById('auth-error-banner');
    if (errBanner) errBanner.classList.add('hidden');

    if (mode === 'register') {
      if (tabLogin) {
        tabLogin.className = 'flex-1 py-2 rounded-xl text-zinc-400 hover:text-white transition-all text-center';
      }
      if (tabRegister) {
        tabRegister.className = 'flex-1 py-2 rounded-xl text-white bg-zinc-800/90 shadow-sm transition-all text-center';
      }
      if (displayNameGroup) displayNameGroup.classList.remove('hidden');
      if (submitText) submitText.textContent = 'Create Account & Sync';
    } else {
      if (tabLogin) {
        tabLogin.className = 'flex-1 py-2 rounded-xl text-white bg-zinc-800/90 shadow-sm transition-all text-center';
      }
      if (tabRegister) {
        tabRegister.className = 'flex-1 py-2 rounded-xl text-zinc-400 hover:text-white transition-all text-center';
      }
      if (displayNameGroup) displayNameGroup.classList.add('hidden');
      if (submitText) submitText.textContent = 'Sign In';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  toggleUserMenu(force) {
    const menu = document.getElementById('header-user-menu');
    if (!menu) return;
    if (force !== undefined) {
      if (force) menu.classList.remove('hidden');
      else menu.classList.add('hidden');
    } else {
      menu.classList.toggle('hidden');
    }
  }

  async handleAuthSubmit() {
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const displayNameInput = document.getElementById('auth-displayname');
    const errBanner = document.getElementById('auth-error-banner');
    const errText = document.getElementById('auth-error-text');
    const submitBtn = document.getElementById('auth-submit-btn');

    const username = (usernameInput ? usernameInput.value : '').trim();
    const password = (passwordInput ? passwordInput.value : '').trim();
    const displayName = (displayNameInput ? displayNameInput.value : '').trim();

    if (!username || !password) {
      if (errBanner && errText) {
        errText.textContent = 'Please enter both username and password.';
        errBanner.classList.remove('hidden');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-75');
    }

    try {
      const endpoint = this.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = { username, password };
      if (this.authMode === 'register' && displayName) {
        payload.displayName = displayName;
      }

      const res = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      this.authToken = data.token;
      this.currentUser = data.user;
      localStorage.setItem('cadence_auth_token', this.authToken);
      localStorage.setItem('cadence_auth_user', JSON.stringify(this.currentUser));

      this.closeAuthModal();
      this.updateAuthUI();

      if (this.authMode === 'register') {
        // Upload current local library to initialize new cloud profile
        await this.pushCloudSyncData(false);
        this.showToast(`Account created! Synced to cloud.`, 'check-circle-2', 'text-emerald-400');
      } else {
        // Logged in: download cloud library
        await this.pullCloudSyncData();
        this.showToast(`Welcome back, ${this.currentUser.displayName || username}! Library synced.`, 'cloud', 'text-cyan-400');
      }
    } catch (err) {
      if (errBanner && errText) {
        errText.textContent = err.message || 'Authentication error';
        errBanner.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75');
      }
    }
  }

  async logout() {
    if (this.authToken) {
      try {
        await fetch(`${this.apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.authToken}` }
        });
      } catch (e) {}
    }
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('cadence_auth_token'); localStorage.removeItem('aura_auth_token');
    localStorage.removeItem('cadence_auth_user'); localStorage.removeItem('aura_auth_user');
    this.updateAuthUI();
    this.showToast('Signed out of Cadence Cloud', 'log-out', 'text-zinc-400');
  }

  async pullCloudSyncData() {
    if (!this.authToken) return;
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/user/sync`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
      if (!res.ok) return;
      const json = await res.json();
      const cloud = json.data;
      if (!cloud) return;

      // Merge Cloud Liked Tracks
      if (Array.isArray(cloud.likedTrackIds)) {
        this.likedTrackIds = new Set(cloud.likedTrackIds);
        localStorage.setItem('cadence_liked_track_ids', JSON.stringify(Array.from(this.likedTrackIds)));
      }
      if (Array.isArray(cloud.likedSongs)) {
        this.likedSongsList = cloud.likedSongs;
        localStorage.setItem('cadence_liked_songs', JSON.stringify(this.likedSongsList));
      }

      // Merge Cloud User Playlists
      if (Array.isArray(cloud.userPlaylists)) {
        this.userPlaylists = cloud.userPlaylists;
        localStorage.setItem('cadence_user_playlists', JSON.stringify(this.userPlaylists));
      }

      // Merge Cloud Taste Profile
      if (cloud.tasteProfile && typeof cloud.tasteProfile === 'object') {
        this.tasteProfile = cloud.tasteProfile;
        localStorage.setItem('cadence_taste_profile', JSON.stringify(this.tasteProfile));
      }

      // Merge Cloud Song History
      if (Array.isArray(cloud.songHistory)) {
        this.songHistory = cloud.songHistory;
        localStorage.setItem('cadence_song_history', JSON.stringify(this.songHistory));
      }

      // Refresh all dependent views
      this.renderSidebarPlaylists();
      this.renderLibrary();
      this.renderSupermix();
      this.renderSimilarArtists();
      this.renderQuickPicks();
      this.renderListenAgain();
      this.renderHeavyRotation();
      if (this.currentView === 'history') this.renderHistoryView();
    } catch (e) {
      console.warn('Pull cloud sync error:', e);
    }
  }

  pushCloudSyncData(debounce = true) {
    if (!this.authToken) return;

    const doPush = async () => {
      try {
        const payload = {
          likedTrackIds: Array.from(this.likedTrackIds || []),
          likedSongs: this.likedSongsList || [],
          downloadedSongs: this.downloadedSongsList || [],
          userPlaylists: this.userPlaylists || [],
          songHistory: this.songHistory ? this.songHistory.slice(0, 50) : [],
          tasteProfile: this.tasteProfile || {},
          lastPlayedTrack: this.currentTrack || null,
          lastQueue: this.queue ? this.queue.slice(0, 20) : [],
          lastTrackIndex: this.currentTrackIndex || 0,
          settings: {
            volume: (localStorage.getItem('cadence_volume') || localStorage.getItem('aura_volume')) || 80,
            quality: (localStorage.getItem('cadence_quality') || localStorage.getItem('aura_quality')) || 'hd1080',
            theme: (localStorage.getItem('cadence_theme') || localStorage.getItem('aura_theme')) || 'default'
          }
        };

        await fetch(`${this.apiBaseUrl}/api/user/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`
          },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn('Push cloud sync error:', e);
      }
    };

    if (debounce) {
      if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = setTimeout(doPush, 1000);
    } else {
      doPush();
    }
  }

  manualSyncCloud() {
    this.showToast('Syncing with Cadence Cloud...', 'loader-2', 'text-cyan-400');
    this.pushCloudSyncData(false);
    setTimeout(async () => {
      await this.pullCloudSyncData();
      this.showToast('Library synchronized across devices!', 'check-circle-2', 'text-emerald-400');
    }, 600);
  }

  renderQuickPicks() {
    const container = document.getElementById('quick-picks-grid');
    const subtitleEl = document.getElementById('quick-picks-subtitle');
    if (!container) return;

    const tracks = this.getQuickPicksTracks();
    const likedTracks = this.getLikedTracks();
    const topAffinityArtists = this.getTopAffinityArtists(3);

    // Update subtitle to highlight adjacency & discovery
    if (subtitleEl) {
      if (topAffinityArtists.length > 0) {
        subtitleEl.textContent = `Songs adjacent to ${topAffinityArtists[0].name} • Unheard picks`;
      } else if (likedTracks.length > 0) {
        subtitleEl.textContent = `Adjacent to your favorites • Songs you might like`;
      } else {
        subtitleEl.textContent = `Start radio from a song • Discovery picks`;
      }
    }

    container.innerHTML = tracks.map((track) => {
      let badgeText = track._adjacencyReason || track.plays || track.category || 'Quick pick';
      const badge = `<span class="text-[10px] text-cyan-400/90 font-medium font-mono-code truncate block">${badgeText}</span>`;
      return this.renderSongCardHtml(track, badge);
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  playAllListenAgain() {
    const tracks = this.getListenAgainTracks();
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks].slice(0, 20);
    this.currentTrackIndex = 0;
    this.lastQueueExtendIndex = -1;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing Listen again (${this.queue.length} songs)`, 'play', 'text-violet-400');
  }

  playAllRotation() {
    const tracks = this.getRotationTracks();
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks].slice(0, 20);
    this.currentTrackIndex = 0;
    this.lastQueueExtendIndex = -1;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing In heavy rotation (${this.queue.length} songs)`, 'flame', 'text-rose-400');
  }

  // --- YOUTUBE MUSIC TASTE PROFILE & RECOMMENDATION SHELVES ---

  initTasteEngine() {
    try {
      this.tasteProfile = JSON.parse((localStorage.getItem('cadence_taste_profile') || localStorage.getItem('aura_taste_profile')) || 'null');
    } catch (e) {
      this.tasteProfile = null;
    }
    if (!this.tasteProfile || typeof this.tasteProfile !== 'object') {
      this.tasteProfile = {
        artists: {},
        genres: {},
        totalPlays: 0,
        totalLikes: 0,
        totalSkips: 0
      };
    }
    // Seed initial taste from existing listening history if available
    if (this.tasteProfile.totalPlays === 0 && Array.isArray(this.songHistory) && this.songHistory.length > 0) {
      this.songHistory.forEach(h => {
        const art = (h.artist || 'Unknown').trim();
        const cat = h.category || 'all';
        const cnt = h.playCount || 1;
        if (!this.tasteProfile.artists[art]) this.tasteProfile.artists[art] = { score: 0, plays: 0, lastHeard: h.lastPlayed || Date.now() };
        this.tasteProfile.artists[art].plays += cnt;
        this.tasteProfile.artists[art].score += (cnt >= 2 ? cnt * 3 : cnt * 2);

        if (!this.tasteProfile.genres[cat]) this.tasteProfile.genres[cat] = { score: 0, plays: 0 };
        this.tasteProfile.genres[cat].plays += cnt;
        this.tasteProfile.genres[cat].score += cnt * 2;
        this.tasteProfile.totalPlays += cnt;
      });
    }
  }

  saveTasteProfile() {
    try {
      localStorage.setItem('cadence_taste_profile', JSON.stringify(this.tasteProfile));
    } catch (e) {}
  }

  extractIndividualArtists(rawArtist) {
    if (!rawArtist) return [];
    return rawArtist
      .split(/[,&/]|(?:\s+(?:feat\.?|ft\.?|with|and|vs\.?)\s+)/i)
      .map(a => a.trim())
      .filter(a => a.length > 0 && !/^(feat|ft|remix|official|video)$/i.test(a));
  }

  getPrimaryArtistName(rawArtist) {
    const list = this.extractIndividualArtists(rawArtist);
    return list[0] || (rawArtist ? rawArtist.trim() : '');
  }

  updateTasteFromPlay(track, isFullListen = false) {
    if (!track || !track.title) return;
    if (!this.tasteProfile) this.initTasteEngine();

    const artists = this.extractIndividualArtists(track.artist);
    if (artists.length === 0) artists.push((track.artist || 'Unknown Artist').trim());
    const cat = track.category || 'all';

    artists.forEach((art, idx) => {
      const weight = idx === 0 ? (isFullListen ? 3 : 2) : 1;
      if (!this.tasteProfile.artists[art]) {
        this.tasteProfile.artists[art] = { score: 0, plays: 0, lastHeard: Date.now() };
      }
      this.tasteProfile.artists[art].plays = (this.tasteProfile.artists[art].plays || 0) + 1;
      this.tasteProfile.artists[art].score = (this.tasteProfile.artists[art].score || 0) + weight;
      this.tasteProfile.artists[art].lastHeard = Date.now();
    });

    if (!this.tasteProfile.genres[cat]) {
      this.tasteProfile.genres[cat] = { score: 0, plays: 0 };
    }
    this.tasteProfile.genres[cat].plays = (this.tasteProfile.genres[cat].plays || 0) + 1;
    this.tasteProfile.genres[cat].score = (this.tasteProfile.genres[cat].score || 0) + 2;

    this.tasteProfile.totalPlays = (this.tasteProfile.totalPlays || 0) + 1;
    this.saveTasteProfile();

    this.renderSupermix();
    this.renderSimilarArtists();
  }

  recordTasteLike(track, isLiked) {
    if (!track) return;
    if (!this.tasteProfile) this.initTasteEngine();
    const artists = this.extractIndividualArtists(track.artist);
    if (artists.length === 0) artists.push((track.artist || 'Unknown Artist').trim());
    const cat = track.category || 'all';

    artists.forEach((art, idx) => {
      const delta = idx === 0 ? (isLiked ? 5 : -5) : (isLiked ? 2.5 : -2.5);
      if (!this.tasteProfile.artists[art]) {
        this.tasteProfile.artists[art] = { score: 0, plays: 0, lastHeard: Date.now() };
      }
      this.tasteProfile.artists[art].score = Math.max(0, (this.tasteProfile.artists[art].score || 0) + delta);
    });

    if (!this.tasteProfile.genres[cat]) {
      this.tasteProfile.genres[cat] = { score: 0, plays: 0 };
    }
    this.tasteProfile.genres[cat].score = Math.max(0, (this.tasteProfile.genres[cat].score || 0) + (isLiked ? 4 : -4));
    this.tasteProfile.totalLikes = Math.max(0, (this.tasteProfile.totalLikes || 0) + (isLiked ? 1 : -1));
    this.saveTasteProfile();
    this.renderSupermix();
  }

  recordTasteSkip(track) {
    if (!track) return;
    if (!this.tasteProfile) this.initTasteEngine();
    const artist = (track.artist || 'Unknown Artist').trim();
    if (this.tasteProfile.artists[artist]) {
      this.tasteProfile.artists[artist].score = Math.max(0, this.tasteProfile.artists[artist].score - 1.5);
    }
    this.tasteProfile.totalSkips = (this.tasteProfile.totalSkips || 0) + 1;
    this.saveTasteProfile();
  }

  toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  getTopAffinityArtists(limit = 5) {
    if (!this.tasteProfile || !this.tasteProfile.artists) return [];

    // Group and consolidate any unparsed legacy or variant artist keys by clean primary name
    const consolidated = {};
    for (const [rawKey, data] of Object.entries(this.tasteProfile.artists)) {
      const primary = this.getPrimaryArtistName(rawKey);
      if (!primary) continue;
      const cleanKey = this.toTitleCase(primary);
      if (!consolidated[cleanKey]) {
        consolidated[cleanKey] = {
          name: cleanKey,
          rawKeys: [rawKey],
          score: 0,
          plays: 0,
          lastHeard: 0
        };
      } else {
        consolidated[cleanKey].rawKeys.push(rawKey);
      }
      consolidated[cleanKey].score += (data.score || 0);
      consolidated[cleanKey].plays += (data.plays || 0);
      consolidated[cleanKey].lastHeard = Math.max(consolidated[cleanKey].lastHeard, data.lastHeard || 0);
    }

    const list = Object.values(consolidated).filter(a => a.score > 0);
    list.sort((a, b) => b.score - a.score || b.plays - a.plays || b.lastHeard - a.lastHeard);
    const totalScore = list.reduce((sum, a) => sum + a.score, 0) || 1;
    return list.slice(0, limit).map(a => ({
      ...a,
      percent: Math.min(100, Math.round((a.score / totalScore) * 100))
    }));
  }

  getTopAffinityGenres(limit = 4) {
    if (!this.tasteProfile || !this.tasteProfile.genres) return [];
    const list = Object.entries(this.tasteProfile.genres).map(([cat, data]) => ({
      category: cat,
      score: data.score || 0,
      plays: data.plays || 0
    })).filter(g => g.category !== 'all' && g.score > 0);

    list.sort((a, b) => b.score - a.score || b.plays - a.plays);
    return list.slice(0, limit);
  }

  getSupermixTracks() {
    const catalog = (typeof YTM_DATA !== 'undefined' && Array.isArray(YTM_DATA.tracks)) ? [...YTM_DATA.tracks] : [];
    if (catalog.length === 0) return [];

    const topArtists = this.getTopAffinityArtists(4).map(a => a.name.toLowerCase());
    const topGenres = this.getTopAffinityGenres(3).map(g => g.category);

    if (topArtists.length === 0 && (!this.songHistory || this.songHistory.length === 0)) {
      return [];
    }

    const seenNorms = new Set();
    const result = [];

    // 1. 60% Familiar favorites: tracks the user has listened to or liked by their top artists
    const familiarPool = [];
    if (Array.isArray(this.songHistory)) {
      this.songHistory.forEach(t => {
        const art = (t.artist || '').toLowerCase();
        if (topArtists.some(a => art.includes(a)) || (t.playCount && t.playCount >= 2)) {
          familiarPool.push(t);
        }
      });
    }

    catalog.forEach(t => {
      const art = (t.artist || '').toLowerCase();
      if (topArtists.some(a => art.includes(a))) {
        familiarPool.push(t);
      }
    });

    // 2. 40% Discovery picks: tracks in their top genres/moods from artists they haven't replayed heavily
    const discoveryPool = catalog.filter(t => {
      const art = (t.artist || '').toLowerCase();
      const inTopArtist = topArtists.some(a => art.includes(a));
      const inTopGenre = topGenres.includes(t.category);
      return !inTopArtist && inTopGenre;
    });

    familiarPool.sort(() => Math.random() - 0.5);
    discoveryPool.sort(() => Math.random() - 0.5);

    for (const t of familiarPool) {
      const norm = this.normalizeSongTitle(t.title);
      if (!seenNorms.has(norm)) {
        seenNorms.add(norm);
        result.push(t);
        if (result.length >= 10) break;
      }
    }

    for (const t of discoveryPool) {
      const norm = this.normalizeSongTitle(t.title);
      if (!seenNorms.has(norm)) {
        seenNorms.add(norm);
        result.push(t);
        if (result.length >= 16) break;
      }
    }

    for (const t of catalog) {
      const norm = this.normalizeSongTitle(t.title);
      if (!seenNorms.has(norm)) {
        seenNorms.add(norm);
        result.push(t);
        if (result.length >= 16) break;
      }
    }

    return result;
  }

  getSimilarArtistTracks() {
    const topArtists = this.getTopAffinityArtists(1);
    if (topArtists.length === 0) return { artistName: null, tracks: [] };

    const rawTopArtist = topArtists[0].name;
    const primaryArtist = this.getPrimaryArtistName(rawTopArtist);
    if (!primaryArtist) return { artistName: null, tracks: [] };

    if (!this.similarArtistCache) this.similarArtistCache = {};

    // 1. If we have dynamically fetched songs for this artist from YouTube Music
    if (this.similarArtistCache[primaryArtist] && this.similarArtistCache[primaryArtist].length > 0) {
      return { artistName: primaryArtist, tracks: this.similarArtistCache[primaryArtist] };
    }

    const catalog = (typeof YTM_DATA !== 'undefined' && Array.isArray(YTM_DATA.tracks)) ? [...YTM_DATA.tracks] : [];
    const normPrimary = primaryArtist.toLowerCase();
    const sameArtistTracks = catalog.filter(t => (t.artist || '').toLowerCase().includes(normPrimary));

    if (sameArtistTracks.length > 0) {
      const artistCategory = sameArtistTracks[0].category || 'energize';
      const relatedTracks = catalog.filter(t => {
        const art = (t.artist || '').toLowerCase();
        return !art.includes(normPrimary) && t.category === artistCategory;
      });

      const combined = [...sameArtistTracks, ...relatedTracks];
      const seen = new Set();
      const tracks = [];
      for (const t of combined) {
        const norm = this.normalizeSongTitle(t.title);
        if (!seen.has(norm)) {
          seen.add(norm);
          tracks.push(t);
          if (tracks.length >= 12) break;
        }
      }
      return { artistName: primaryArtist, tracks };
    }

    // 2. Artist not in local static catalog: fetch real tracks from YouTube Music backend
    if (this.isBackendOnline && this.fetchingSimilarArtist !== primaryArtist) {
      this.fetchSimilarTracksForArtist(primaryArtist);
    }

    // Do NOT fallback to completely unrelated western tracks from 'energize'
    return { artistName: primaryArtist, tracks: [] };
  }

  async fetchSimilarTracksForArtist(artistName) {
    if (!artistName || this.fetchingSimilarArtist === artistName) return;
    this.fetchingSimilarArtist = artistName;
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/search?q=${encodeURIComponent(artistName)}&filter=songs`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.tracks || []);
        if (list.length > 0) {
          if (!this.similarArtistCache) this.similarArtistCache = {};
          this.similarArtistCache[artistName] = list.slice(0, 16);
          this.renderSimilarArtists();
        }
      }
    } catch (err) {
      console.warn('Failed to fetch similar artist tracks:', err);
    } finally {
      this.fetchingSimilarArtist = null;
    }
  }

  renderSupermix() {
    const section = document.getElementById('supermix-section');
    const grid = document.getElementById('supermix-grid');
    if (!section || !grid) return;

    const tracks = this.getSupermixTracks();
    if (!tracks || tracks.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = tracks.slice(0, 16).map(track => {
      const isDiscovery = !this.songHistory.some(h => this.normalizeSongTitle(h.title) === this.normalizeSongTitle(track.title));
      const badge = isDiscovery 
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono-code"><i data-lucide="sparkles" class="w-2.5 h-2.5 text-amber-400"></i> Discovery</span>`
        : `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30 font-mono-code">Your Favorite</span>`;
      return this.renderSongCardHtml(track, badge);
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderSimilarArtists() {
    const section = document.getElementById('similar-artists-section');
    const titleEl = document.getElementById('similar-artists-title');
    const grid = document.getElementById('similar-artists-grid');
    if (!section || !grid) return;

    const { artistName, tracks } = this.getSimilarArtistTracks();
    if (!artistName || !tracks || tracks.length === 0) {
      section.classList.add('hidden');
      return;
    }

    if (titleEl) titleEl.textContent = `Similar to ${artistName}`;
    section.classList.remove('hidden');
    grid.innerHTML = tracks.slice(0, 16).map(track => {
      const badge = `<span class="text-[10px] text-zinc-400 font-mono-code">${track.artist}</span>`;
      return this.renderSongCardHtml(track, badge);
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  playAllSupermix() {
    const tracks = this.getSupermixTracks();
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentTrackIndex = 0;
    this.lastQueueExtendIndex = -1;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing My Supermix (${this.queue.length} personalized songs)`, 'sparkles', 'text-amber-400');
  }

  playAllSimilarArtists() {
    const { artistName, tracks } = this.getSimilarArtistTracks();
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentTrackIndex = 0;
    this.lastQueueExtendIndex = -1;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing Similar to ${artistName} (${this.queue.length} songs)`, 'play', 'text-violet-400');
  }

  syncTasteProfileUI() {
    const artistsContainer = document.getElementById('taste-top-artists');
    const genresContainer = document.getElementById('taste-top-genres');
    const statusBadge = document.getElementById('taste-status-badge');

    const topArtists = this.getTopAffinityArtists(5);
    const topGenres = this.getTopAffinityGenres(5);
    const totalPlays = this.tasteProfile?.totalPlays || 0;

    if (statusBadge) {
      if (totalPlays >= 8) {
        statusBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        statusBadge.textContent = 'Personalized Profile';
      } else if (totalPlays >= 2) {
        statusBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-violet-500/20 text-violet-300 border border-violet-500/30';
        statusBadge.textContent = 'Developing Taste';
      } else {
        statusBadge.className = 'px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-zinc-800 text-zinc-400 border border-zinc-700';
        statusBadge.textContent = 'Fresh Profile (Start Playing)';
      }
    }

    if (artistsContainer) {
      if (topArtists.length === 0) {
        artistsContainer.innerHTML = '<div class="text-xs text-zinc-500 py-2">No listening data yet. Play a few songs or click Simulate below!</div>';
      } else {
        artistsContainer.innerHTML = topArtists.map(a => `
          <div class="group/artist p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-transparent hover:border-zinc-800">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-bold text-white truncate pr-2">${this.escapeHtml(a.name)}</span>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] font-mono-code text-violet-400 font-bold">${a.percent}% affinity • ${a.plays} plays</span>
                <button 
                  onclick="app.removeTasteArtist('${this.escapeHtml(a.name)}')" 
                  class="opacity-0 group-hover/artist:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition-opacity rounded" 
                  title="Remove from taste"
                >
                  <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
            <div class="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" style="width: ${a.percent}%"></div>
            </div>
          </div>
        `).join('');
      }
    }

    if (genresContainer) {
      if (topGenres.length === 0) {
        genresContainer.innerHTML = '<span class="text-xs text-zinc-500">No genre data yet</span>';
      } else {
        genresContainer.innerHTML = topGenres.map(g => `
          <span class="px-2.5 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-xs font-semibold text-zinc-200 capitalize flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
            ${g.category} (${g.score} pts)
          </span>
        `).join('');
      }
    }
    if (window.lucide) window.lucide.createIcons();
  }

  addUserTasteArtist(artistName = null) {
    const inputEl = document.getElementById('taste-input-artist');
    const rawName = artistName || (inputEl ? inputEl.value : '');
    const clean = this.getPrimaryArtistName(rawName);

    if (!clean) {
      this.showToast('Please enter an artist name', 'info', 'text-amber-400');
      return;
    }

    const titleArtist = this.toTitleCase(clean);
    if (!this.tasteProfile) this.initTasteEngine();
    if (!this.tasteProfile.artists[titleArtist]) {
      this.tasteProfile.artists[titleArtist] = { score: 0, plays: 0, lastHeard: Date.now() };
    }
    this.tasteProfile.artists[titleArtist].score += 15;
    this.tasteProfile.artists[titleArtist].plays += 4;
    this.tasteProfile.artists[titleArtist].lastHeard = Date.now();
    this.tasteProfile.totalPlays = (this.tasteProfile.totalPlays || 0) + 4;
    this.saveTasteProfile();

    if (inputEl) inputEl.value = '';

    // Fetch similar tracks dynamically from YouTube Music
    // 1. Try local backend if connected
    if (this.isBackendOnline) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/api/search?q=${encodeURIComponent(clean)}`);
        if (res.ok) {
          const liveTracks = await res.json();
          if (Array.isArray(liveTracks) && liveTracks.length > 0) {
            this.renderSearchResults(liveTracks, listEl);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend search error, falling back to standalone search engines:', err);
      }
    }

    // 2. Native Android Bridge (Zero Server, Zero CORS, Instant YouTube Search on Phone)
    if (window.AndroidBridge && typeof window.AndroidBridge.search === 'function') {
      try {
        const rawJson = window.AndroidBridge.search(clean);
        if (rawJson && !rawJson.includes('"error"')) {
          const ytData = JSON.parse(rawJson);
          const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const tracks = [];
          for (const sec of sections) {
            const contents = sec.itemSectionRenderer?.contents || [];
            for (const it of contents) {
              if (it.videoRenderer && it.videoRenderer.videoId) {
                const vr = it.videoRenderer;
                const vid = vr.videoId;
                const title = vr.title?.runs?.[0]?.text || clean;
                const artist = vr.ownerText?.runs?.[0]?.text || 'Artist';
                const dur = vr.lengthText?.simpleText || '3:30';
                const thumbs = vr.thumbnail?.thumbnails || [];
                const cover = thumbs[thumbs.length - 1]?.url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
                tracks.push({
                  id: 'yt-' + vid,
                  title: title,
                  artist: artist,
                  album: 'YouTube Music',
                  duration: dur,
                  durationSec: 210,
                  ytId: vid,
                  audioId: vid,
                  musicVideoId: vid,
                  cover: cover,
                  category: 'all',
                  plays: 'Verified Release'
                });
              }
            }
          }
          if (tracks.length > 0) {
            this.renderSearchResults(tracks, listEl);
            return;
          }
        }
      } catch (bridgeErr) {
        console.warn('AndroidBridge search error:', bridgeErr);
      }
    }

    // 3. Fast Public YouTube Search (yt.chocolatemoo53.com)
    try {
      const invRes = await fetch(`https://yt.chocolatemoo53.com/api/v1/search?q=${encodeURIComponent(clean)}&type=video`, { signal: AbortSignal.timeout(4000) });
      if (invRes.ok) {
        const items = await invRes.json();
        if (Array.isArray(items) && items.length > 0) {
          const liveTracks = items.slice(0, 20).map(item => ({
            id: 'yt-' + item.videoId,
            title: item.title,
            artist: item.author || 'Artist',
            album: 'YouTube Music',
            duration: item.lengthSeconds ? Math.floor(item.lengthSeconds / 60) + ':' + (item.lengthSeconds % 60).toString().padStart(2, '0') : '3:30',
            durationSec: item.lengthSeconds || 210,
            ytId: item.videoId,
            audioId: item.videoId,
            musicVideoId: item.videoId,
            cover: (item.videoThumbnails && item.videoThumbnails[0]) ? item.videoThumbnails[0].url : `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
            category: 'all',
            plays: 'Official Track'
          }));
          this.renderSearchResults(liveTracks, listEl);
          return;
        }
      }
    } catch (e) {}

    // 4. iTunes 100M+ Global Catalog Search (Guaranteed 100% CORS & Uptime on any device)
    try {
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=song&limit=25`, { signal: AbortSignal.timeout(4000) });
      if (itunesRes.ok) {
        const data = await itunesRes.json();
        const results = data.results || [];
        if (results.length > 0) {
          const tracks = results.map(r => {
            const durSec = Math.round((r.trackTimeMillis || 210000) / 1000);
            const m = Math.floor(durSec / 60);
            const s = (durSec % 60).toString().padStart(2, '0');
            const cleanCover = (r.artworkUrl100 || '').replace('100x100bb', '600x600bb');
            return {
              id: 'itunes-' + r.trackId,
              title: r.trackName,
              artist: r.artistName,
              album: r.collectionName || 'Official Release',
              duration: `${m}:${s}`,
              durationSec: durSec,
              ytId: null,
              audioId: null,
              musicVideoId: null,
              cover: cleanCover,
              category: 'all',
              plays: 'Official Master'
            };
          });
          this.renderSearchResults(tracks, listEl);
          return;
        }
      }
    } catch (itunesErr) {}

    const localClean = clean.toLowerCase();
    const results = YTM_DATA.tracks.filter(t => 
      t.title.toLowerCase().includes(localClean) || 
      t.artist.toLowerCase().includes(localClean) ||
      t.album.toLowerCase().includes(localClean)
    );

    if (results.length === 0) {
      listEl.innerHTML = `
        <div class="col-span-full py-12 text-center space-y-3">
          <p class="text-zinc-400">No tracks found matching "${clean}".</p>
          <button class="bg-ytm-red hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-full mt-2" onclick="app.openAddTrackModal()">
            Play Video ID / URL instead
          </button>
        </div>
      `;
    } else {
      this.renderSearchResults(results, listEl);
    }
  }

  renderSearchResults(tracks, container) {
    // Speculatively pre-warm top 3 search results in background for instant playback on click
    if (Array.isArray(tracks)) {
      const topVids = tracks.slice(0, 3).map(t => t.audioId || t.ytId).filter(Boolean);
      if (topVids.length > 0) {
        fetch(`${this.apiBaseUrl}/api/prefetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds: topVids })
        }).catch(() => {});
      }
    }

    container.innerHTML = tracks.map(t => `
      <div class="song-card flex items-center gap-3 p-3 rounded-xl bg-ytm-card hover:bg-ytm-hover cursor-pointer group" onmouseenter="app.prefetchVid('${t.audioId || t.ytId}')" onclick="app.playLiveTrack(${JSON.stringify(t).replace(/"/g, '&quot;')})">
        <div class="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
          <img src="${t.cover}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId}/hqdefault.jpg'" class="w-full h-full object-cover">
          <div class="play-overlay absolute inset-0 bg-black/60 opacity-0 flex items-center justify-center transition-opacity">
            <i data-lucide="play" class="w-6 h-6 text-white fill-current"></i>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm truncate text-white">${t.title}</div>
          <div class="text-xs text-ytm-muted truncate">${t.artist} • ${t.album}</div>
        </div>
        <div class="text-xs font-mono text-ytm-muted">${t.duration}</div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  clearSearch() {
    const input = document.getElementById('global-search-input');
    if (input) input.value = '';
    const mobileInput = document.getElementById('mobile-search-input');
    if (mobileInput) mobileInput.value = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    const mobileClearBtn = document.getElementById('mobile-clear-search-btn');
    if (mobileClearBtn) mobileClearBtn.classList.add('hidden');
    this.closeSearchHistory();
    this.navigate('home');
  }

  /* ---------------------------------------------------- */
  /* SEARCH HISTORY SYSTEM                                */
  /* ---------------------------------------------------- */

  renderSearchHistory() {
    const listEl = document.getElementById('search-history-list');
    const mobileListEl = document.getElementById('mobile-search-history-list');

    const html = (this.searchHistory && this.searchHistory.length > 0)
      ? this.searchHistory.map((query) => `
          <div class="flex items-center justify-between px-3.5 py-2 hover:bg-zinc-800/80 cursor-pointer group transition-colors" onclick="app.selectSearchHistoryItem('${query.replace(/'/g, "\\'")}')">
            <div class="flex items-center gap-2.5 min-w-0 text-xs text-zinc-300 group-hover:text-white">
              <i data-lucide="history" class="w-3.5 h-3.5 text-zinc-500 group-hover:text-violet-400 shrink-0"></i>
              <span class="truncate">${query}</span>
            </div>
            <button 
              onclick="event.stopPropagation(); app.deleteSearchHistoryItem('${query.replace(/'/g, "\\'")}', event)" 
              class="p-1 text-zinc-500 hover:text-zinc-200 rounded-md transition-colors"
              title="Remove from history"
            >
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          </div>
        `).join('')
      : `<div class="px-3.5 py-4 text-center text-xs text-zinc-500">No recent searches</div>`;

    if (listEl) listEl.innerHTML = html;
    if (mobileListEl) mobileListEl.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  addSearchHistory(query) {
    if (!query || typeof query !== 'string') return;
    const clean = query.trim();
    if (!clean) return;

    this.searchHistory = this.searchHistory.filter(q => q.toLowerCase() !== clean.toLowerCase());
    this.searchHistory.unshift(clean);
    if (this.searchHistory.length > 15) {
      this.searchHistory = this.searchHistory.slice(0, 15);
    }
    try {
      localStorage.setItem('cadence_search_history', JSON.stringify(this.searchHistory));
    } catch (e) {}
    this.renderSearchHistory();
  }

  deleteSearchHistoryItem(query, e) {
    if (e) e.stopPropagation();
    this.searchHistory = this.searchHistory.filter(q => q !== query);
    try {
      localStorage.setItem('cadence_search_history', JSON.stringify(this.searchHistory));
    } catch (e) {}
    this.renderSearchHistory();
  }

  clearSearchHistory() {
    this.searchHistory = [];
    localStorage.removeItem('cadence_search_history'); localStorage.removeItem('aura_search_history');
    this.renderSearchHistory();
    this.closeSearchHistory();
  }

  openSearchHistory(isMobile = false) {
    if (!this.searchHistory || this.searchHistory.length === 0) return;
    if (isMobile) {
      const mobDropdown = document.getElementById('mobile-search-history-dropdown');
      if (mobDropdown) mobDropdown.classList.remove('hidden');
    } else {
      const dropdown = document.getElementById('search-history-dropdown');
      if (dropdown) dropdown.classList.remove('hidden');
    }
    this.renderSearchHistory();
  }

  closeSearchHistory() {
    const dropdown = document.getElementById('search-history-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    const mobDropdown = document.getElementById('mobile-search-history-dropdown');
    if (mobDropdown) mobDropdown.classList.add('hidden');
  }

  selectSearchHistoryItem(query) {
    const input = document.getElementById('global-search-input');
    const mobileInput = document.getElementById('mobile-search-input');
    if (input) input.value = query;
    if (mobileInput) mobileInput.value = query;
    this.closeSearchHistory();
    this.handleSearch(query);
  }

  /* ---------------------------------------------------- */
  /* SONG LISTENING HISTORY & ADAPTIVE TASTE ENGINE       */
  /* ---------------------------------------------------- */

  sanitizeSongHistory() {
    if (!Array.isArray(this.songHistory)) {
      this.songHistory = [];
      return;
    }
    // Deduplicate by normalized title + artist, preserving highest playCount and latest lastPlayed
    const map = new Map();
    for (const item of this.songHistory) {
      if (!item || !item.title) continue;
      const key = this.normalizeSongTitle(item.title) + '___' + (item.artist || '').trim().toLowerCase();
      const count = Math.max(1, parseInt(item.playCount, 10) || 1);
      const time = item.lastPlayed || Date.now();
      if (!map.has(key)) {
        map.set(key, { ...item, playCount: count, lastPlayed: time });
      } else {
        const existing = map.get(key);
        existing.playCount = Math.max(existing.playCount, count);
        existing.lastPlayed = Math.max(existing.lastPlayed || 0, time);
      }
    }
    this.songHistory = Array.from(map.values());
    try {
      localStorage.setItem('cadence_song_history', JSON.stringify(this.songHistory));
    } catch (e) {}
  }

  recordSongPlay(track) {
    if (!track || !track.title) return;
    const trackId = track.id || track.ytId || track.audioId;
    if (!trackId) return;

    const normTitle = this.normalizeSongTitle(track.title);
    const normArtist = (track.artist || '').trim().toLowerCase();

    const existingIndex = this.songHistory.findIndex(h => 
      (h.id && h.id === trackId) || 
      (h.ytId && h.ytId === track.ytId) || 
      (this.normalizeSongTitle(h.title) === normTitle && (h.artist || '').trim().toLowerCase() === normArtist)
    );

    if (existingIndex !== -1) {
      const existing = this.songHistory[existingIndex];
      existing.playCount = (existing.playCount || 1) + 1;
      existing.lastPlayed = Date.now();
      if (track.cover) existing.cover = track.cover;
      if (track.ytId) existing.ytId = track.ytId;
      if (track.audioId) existing.audioId = track.audioId;
      if (track.musicVideoId) existing.musicVideoId = track.musicVideoId;
      if (track.duration) existing.duration = track.duration;
      if (track.durationSec) existing.durationSec = track.durationSec;
      this.songHistory.splice(existingIndex, 1);
      this.songHistory.unshift(existing);
    } else {
      const historyItem = {
        id: trackId,
        ytId: track.ytId || trackId,
        audioId: track.audioId || track.ytId || trackId,
        musicVideoId: track.musicVideoId || null,
        title: track.title,
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Cadence Direct',
        cover: track.cover || `https://img.youtube.com/vi/${track.ytId}/hqdefault.jpg`,
        duration: track.duration || '3:30',
        durationSec: track.durationSec || 210,
        category: track.category || 'all',
        playCount: 1,
        lastPlayed: Date.now()
      };
      this.songHistory.unshift(historyItem);
    }

    if (this.songHistory.length > 200) {
      this.songHistory = this.songHistory.slice(0, 200);
    }

    try {
      localStorage.setItem('cadence_song_history', JSON.stringify(this.songHistory));
    } catch (e) {}

    // Dynamic Homepage update across YouTube Music recommendation shelves & Taste Engine
    this.updateTasteFromPlay(track);
    this.renderSupermix();
    this.renderSimilarArtists();
    this.renderListenAgain();
    this.renderHeavyRotation();
    this.renderQuickPicks();

    if (this.currentView === 'history') {
      this.renderHistoryView();
    }
  }

  renderHistoryView() {
    const container = document.getElementById('history-tracks-list');
    if (!container) return;

    if (!this.songHistory || this.songHistory.length === 0) {
      container.className = 'col-span-12';
      container.innerHTML = `
        <div class="col-span-12 py-16 text-center space-y-4 max-w-md mx-auto">
          <div class="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto shadow-inner">
            <i data-lucide="history" class="w-8 h-8"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-bold text-white">No listening history yet</h3>
            <p class="text-xs text-zinc-400 leading-relaxed">
              As you spin records, search artists, and play songs, your taste history will be archived here and shape your custom homepage rotation.
            </p>
          </div>
          <button onclick="app.navigate('home')" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors">
            Explore Homepage
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3';
    
    // Sort by most recently played
    const sorted = [...this.songHistory].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

    container.innerHTML = sorted.map((track) => {
      const relTime = this.formatRelativeTime(track.lastPlayed);
      const isCurrent = this.currentTrack && (this.currentTrack.id === track.id || this.currentTrack.ytId === track.ytId);
      return `
        <div class="song-card flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/80 border ${isCurrent ? 'border-violet-500/60 bg-violet-950/20' : 'border-zinc-800/80'} group relative cursor-pointer transition-all" onclick="app.playLiveTrack(${JSON.stringify(track).replace(/"/g, '&quot;')})">
          <div class="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700/60 shadow">
            <img src="${track.cover}" alt="${track.title}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${track.ytId}/hqdefault.jpg'" class="w-full h-full object-cover">
            <div class="play-overlay absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <i data-lucide="${isCurrent ? 'volume-2' : 'play'}" class="w-5 h-5 text-white fill-current"></i>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="font-bold text-xs sm:text-sm text-white truncate group-hover:text-violet-300 transition-colors">${track.title}</div>
            <div class="text-[11px] text-zinc-400 truncate">${track.artist}</div>
            <div class="flex items-center gap-2 mt-0.5 text-[10px] font-mono-code text-zinc-500">
              <span class="px-1.5 py-0.2 rounded bg-zinc-800/90 text-violet-300 border border-violet-500/20">${track.playCount || 1} ${track.playCount === 1 ? 'play' : 'plays'}</span>
              <span>•</span>
              <span>${relTime}</span>
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              class="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
              onclick="event.stopPropagation(); app.removeHistoryItem('${track.id || track.ytId}')"
              title="Remove from history"
            >
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return 'Recently';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  clearSongHistory() {
    this.songHistory = [];
    localStorage.removeItem('cadence_song_history'); localStorage.removeItem('aura_song_history');
    this.renderHistoryView();
    this.renderListenAgain();
    this.renderHeavyRotation();
    this.renderQuickPicks();
    this.showToast('Listening history cleared', 'trash-2', 'text-zinc-400');
  }

  removeHistoryItem(trackId) {
    this.songHistory = this.songHistory.filter(h => (h.id !== trackId && h.ytId !== trackId));
    try {
      localStorage.setItem('cadence_song_history', JSON.stringify(this.songHistory));
    } catch (e) {}
    this.renderHistoryView();
    this.renderListenAgain();
    this.renderHeavyRotation();
    this.renderQuickPicks();
  }

  playAllHistory() {
    if (!this.songHistory || this.songHistory.length === 0) return;
    const sorted = [...this.songHistory].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    this.queue = [...sorted];
    this.currentTrackIndex = 0;
    this.playLiveTrack(this.queue[0], true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
  }

  // --- MOBILE NAVIGATION & SEARCH HELPERS ---

  toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    
    if (window.innerWidth < 768) {
      const isCurrentlyOpen = !sidebar.classList.contains('-translate-x-full');
      const shouldOpen = force !== undefined ? force : !isCurrentlyOpen;
      
      if (shouldOpen) {
        sidebar.classList.remove('-translate-x-full');
        if (backdrop) backdrop.classList.remove('hidden');
      } else {
        sidebar.classList.add('-translate-x-full');
        if (backdrop) backdrop.classList.add('hidden');
      }
    } else {
      // Desktop: Ignore close requests from page navigation
      if (force === false) return;
      const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
      const shouldCollapse = force !== undefined ? !force : !isCollapsed;
      sidebar.classList.toggle('sidebar-collapsed', shouldCollapse);
    }
  }

  toggleMobileSearch(open) {
    const mobileSearchBar = document.getElementById('mobile-search-bar');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    if (!mobileSearchBar) return;

    if (open) {
      mobileSearchBar.classList.remove('hidden');
      if (mobileSearchInput) {
        setTimeout(() => mobileSearchInput.focus(), 50);
      }
    } else {
      mobileSearchBar.classList.add('hidden');
    }
  }

  focusMobileSearch() {
    this.navigate('search');
    this.toggleMobileSearch(true);
  }

  clearMobileSearch() {
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileClearBtn = document.getElementById('mobile-clear-search-btn');
    if (mobileSearchInput) {
      mobileSearchInput.value = '';
      mobileSearchInput.focus();
    }
    if (mobileClearBtn) mobileClearBtn.classList.add('hidden');
    this.clearSearch();
  }

  filterByGenre(genreName) {
    this.selectCategory('all');
    this.navigate('home');
  }

  filterByMood(moodId) {
    this.selectCategory(moodId);
    this.navigate('home');
  }

  // --- EVENT BINDINGS ---


  // --- AMBIENT WALLPAPER, CONTEXT MENU & POWER TOOLS ---

  initCustomBackground() {
    const customBg = (localStorage.getItem('cadence_custom_bg') || localStorage.getItem('aura_custom_bg'));
    const backdrop = document.getElementById('ambient-backdrop');
    if (!backdrop) return;
    if (customBg) {
      backdrop.style.backgroundImage = `url("${customBg}")`;
      backdrop.classList.add('active');
    } else {
      backdrop.classList.remove('active');
      backdrop.style.backgroundImage = '';
    }
  }

  makeBackground(track) {
    const t = track || this.currentTrack;
    if (!t || !t.cover) return;
    localStorage.setItem('cadence_custom_bg', t.cover);
    this.initCustomBackground();
    this.showToast('Cover set as ambient background wallpaper!', 'image', 'text-emerald-400');
  }

  resetBackground() {
    localStorage.removeItem('cadence_custom_bg'); localStorage.removeItem('aura_custom_bg');
    this.initCustomBackground();
    this.showToast('Ambient background wallpaper reset to default', 'rotate-ccw', 'text-amber-400');
  }

  showToast(message, iconName = 'check', iconColorClass = 'text-emerald-400') {
    const toast = document.getElementById('cadence-toast');
    const msgEl = document.getElementById('cadence-toast-msg');
    const iconEl = document.getElementById('cadence-toast-icon');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    if (iconEl) {
      iconEl.setAttribute('data-lucide', iconName);
      iconEl.setAttribute('class', `w-4 h-4 ${iconColorClass} shrink-0`);
      if (window.lucide) window.lucide.createIcons();
    }

    toast.classList.remove('opacity-0', 'translate-y-3', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-3', 'pointer-events-none');
    }, 2800);
  }

  fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {}
    document.body.removeChild(textArea);
  }

  shareTrack(track) {
    const t = track || this.currentTrack;
    if (!t) return;
    const shareUrl = t.ytId ? `https://youtu.be/${t.ytId}` : window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast(`Share link copied: "${t.title}"!`, 'share-2', 'text-purple-400');
      }).catch(() => {
        this.fallbackCopyText(shareUrl);
        this.showToast(`Share link copied: "${t.title}"`, 'share-2', 'text-purple-400');
      });
    } else {
      this.fallbackCopyText(shareUrl);
      this.showToast(`Share link copied: "${t.title}"`, 'share-2', 'text-purple-400');
    }
  }

  toggleLikeContext(track) {
    const t = track || this.currentTrack;
    if (!t) return;
    const trackId = t.id || t.ytId;
    this.toggleLike(trackId);
    const isLiked = this.likedTrackIds.has(trackId);
    this.showToast(isLiked ? `Saved "${t.title}" to Liked Songs` : `Removed "${t.title}" from Liked Songs`, 'heart', isLiked ? 'text-rose-500' : 'text-zinc-400');
  }

  openPlaylistPicker(track) {
    this.playlistTargetTrack = track || this.currentTrack;
    const modal = document.getElementById('playlist-picker-modal');
    const listEl = document.getElementById('playlist-picker-list');
    const subtitle = document.getElementById('picker-track-subtitle');
    if (!modal || !listEl) return;

    if (subtitle && this.playlistTargetTrack) {
      subtitle.textContent = `Adding "${this.playlistTargetTrack.title}" by ${this.playlistTargetTrack.artist}`;
    }

    const defaultItems = `
      <div class="space-y-1 mb-2 pb-2 border-b border-zinc-800">
        <div onclick="app.addTrackToDefaultPlaylist('liked')" class="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/80 cursor-pointer border border-rose-900/30 hover:border-rose-500/50 transition-all group">
          <div class="flex items-center gap-2.5 truncate">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-fuchsia-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <i data-lucide="heart" class="w-4 h-4 fill-current"></i>
            </div>
            <div class="truncate">
              <div class="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors">Liked Songs</div>
              <div class="text-[10px] text-zinc-500 font-mono-code">${this.getLikedTracks().length} songs</div>
            </div>
          </div>
          <i data-lucide="plus" class="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"></i>
        </div>

        <div onclick="app.addTrackToDefaultPlaylist('downloaded')" class="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/80 cursor-pointer border border-cyan-900/30 hover:border-cyan-500/50 transition-all group">
          <div class="flex items-center gap-2.5 truncate">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <i data-lucide="arrow-down-to-line" class="w-4 h-4"></i>
            </div>
            <div class="truncate">
              <div class="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">Downloaded</div>
              <div class="text-[10px] text-zinc-500 font-mono-code">${this.getDownloadedTracks().length} songs</div>
            </div>
          </div>
          <i data-lucide="plus" class="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"></i>
        </div>
      </div>
    `;

    let customItems = '';
    if (!this.userPlaylists || this.userPlaylists.length === 0) {
      customItems = `
        <div class="p-3 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          No custom playlists yet. Create one below!
        </div>
      `;
    } else {
      customItems = this.userPlaylists.map((pl, idx) => `
        <div onclick="app.addTrackToPlaylist(${idx})" class="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-800/80 cursor-pointer border border-zinc-800/60 hover:border-violet-500/40 transition-all group">
          <div class="flex items-center gap-2.5 truncate">
            <img src="${pl.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'}" class="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10 shrink-0">
            <div class="truncate">
              <div class="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors truncate">${this.escapeHtml(pl.name)}</div>
              <div class="text-[10px] text-zinc-500 font-mono-code">${(pl.tracks || []).length} songs</div>
            </div>
          </div>
          <i data-lucide="plus" class="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors"></i>
        </div>
      `).join('');
    }

    listEl.innerHTML = defaultItems + customItems;
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  addTrackToDefaultPlaylist(type) {
    if (!this.playlistTargetTrack) return;
    if (type === 'liked') {
      const trackId = this.playlistTargetTrack.id || this.playlistTargetTrack.ytId;
      if (!this.likedTrackIds.has(trackId)) {
        this.toggleLike(trackId, this.playlistTargetTrack);
        this.showToast(`Saved "${this.playlistTargetTrack.title}" to Liked Songs`, 'heart', 'text-rose-500');
      } else {
        this.showToast(`"${this.playlistTargetTrack.title}" is already in Liked Songs`, 'info', 'text-amber-400');
      }
    } else if (type === 'downloaded') {
      this.downloadTrack(this.playlistTargetTrack);
    }
    this.closeModal('playlist-picker-modal');
  }

  addTrackToPlaylist(playlistIdx) {
    if (!this.playlistTargetTrack) return;
    const pl = this.userPlaylists[playlistIdx];
    if (!pl) return;

    if (!pl.tracks) pl.tracks = [];
    const exists = pl.tracks.some(t => (t.id && t.id === this.playlistTargetTrack.id) || (t.ytId && t.ytId === this.playlistTargetTrack.ytId));
    if (exists) {
      this.showToast(`Already in "${pl.name}"`, 'info', 'text-amber-400');
    } else {
      pl.tracks.push(this.playlistTargetTrack);
      if (!pl.cover && this.playlistTargetTrack.cover) {
        pl.cover = this.playlistTargetTrack.cover;
      }
      try {
        localStorage.setItem('cadence_user_playlists', JSON.stringify(this.userPlaylists));
      } catch (e) {}
      this.renderSidebarPlaylists();
      this.showToast(`Added "${this.playlistTargetTrack.title}" to "${pl.name}"!`, 'check', 'text-emerald-400');
    }

    this.closeModal('playlist-picker-modal');
  }

  createPlaylistFromPicker() {
    const input = document.getElementById('picker-new-playlist-input');
    if (!input || !input.value.trim() || !this.playlistTargetTrack) return;

    const name = input.value.trim();
    const newPl = {
      id: 'pl-user-' + Date.now(),
      name: name,
      description: 'Custom playlist created by you',
      tracks: [this.playlistTargetTrack],
      cover: this.playlistTargetTrack.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'
    };

    this.userPlaylists.unshift(newPl);
    try {
      localStorage.setItem('cadence_user_playlists', JSON.stringify(this.userPlaylists));
    } catch (e) {}
    this.renderSidebarPlaylists();
    input.value = '';
    this.closeModal('playlist-picker-modal');
    this.showToast(`Created "${name}" with "${this.playlistTargetTrack.title}"!`, 'check', 'text-emerald-400');
  }

  openContextMenu(e, track) {
    if (!track) return;
    this.contextTrack = track;
    const menu = document.getElementById('song-context-menu');
    if (!menu) return;

    const coverEl = document.getElementById('ctx-cover');
    const titleEl = document.getElementById('ctx-title');
    const artistEl = document.getElementById('ctx-artist');
    const likeLabel = document.getElementById('ctx-like-label');
    const likeIcon = document.getElementById('ctx-like-icon');
    const resetBgBtn = document.getElementById('ctx-btn-reset-bg');

    if (coverEl) coverEl.src = track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
    if (titleEl) titleEl.textContent = track.title || 'Unknown Song';
    if (artistEl) artistEl.textContent = track.artist || 'Unknown Artist';

    const trackId = track.id || track.ytId;
    const isLiked = this.likedTrackIds.has(trackId);
    if (likeLabel) likeLabel.textContent = isLiked ? 'Liked' : 'Like Song';
    if (likeIcon) {
      if (isLiked) {
        likeIcon.classList.add('fill-current', 'text-rose-500');
      } else {
        likeIcon.classList.remove('fill-current');
      }
    }

    if (resetBgBtn) {
      const hasCustomBg = !!(localStorage.getItem('cadence_custom_bg') || localStorage.getItem('aura_custom_bg'));
      resetBgBtn.classList.toggle('hidden', !hasCustomBg);
      resetBgBtn.classList.toggle('flex', hasCustomBg);
    }

    menu.classList.remove('hidden');
    const menuWidth = 240;
    const menuHeight = 360;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > winWidth) {
      posX = Math.max(10, winWidth - menuWidth - 10);
    }
    if (posY + menuHeight > winHeight) {
      posY = Math.max(10, winHeight - menuHeight - 10);
    }

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;

    if (window.lucide) window.lucide.createIcons();
  }

  closeContextMenu() {
    const menu = document.getElementById('song-context-menu');
    if (menu) menu.classList.add('hidden');
  }

  handleContextAction(action) {
    const track = this.contextTrack;
    this.closeContextMenu();
    if (!track) return;

    switch (action) {
      case 'play_now':
        this.playLiveTrack(track, true);
        break;
      case 'play_next':
        this.queue.splice(this.currentTrackIndex + 1, 0, track);
        this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
        this.showToast(`Playing "${track.title}" next`, 'corner-down-right', 'text-indigo-400');
        break;
      case 'add_queue':
        this.queue.push(track);
        this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
        this.showToast(`Added "${track.title}" to queue`, 'list-plus', 'text-blue-400');
        break;
      case 'start_radio':
        this.showToast(`Starting Radio station for "${track.title}"...`, 'radio', 'text-fuchsia-400');
        this.playLiveTrack(track, true);
        if (this.isBackendOnline) {
          fetch(`${this.apiBaseUrl}/api/search?q=${encodeURIComponent(track.artist + ' music')}`)
            .then(res => res.json())
            .then(data => {
              if (data.results && data.results.length > 0) {
                const radioTracks = data.results.filter(t => (t.id || t.ytId) !== (track.id || track.ytId));
                this.queue = [track, ...radioTracks];
                this.currentTrackIndex = 0;
                this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
              }
            }).catch(() => {});
        }
        break;
      case 'toggle_like':
        this.toggleLikeContext(track);
        break;
      case 'add_to_playlist':
        this.openPlaylistPicker(track);
        break;
      case 'make_background':
        this.makeBackground(track);
        break;
      case 'reset_background':
        this.resetBackground();
        break;
      case 'download':
        this.downloadTrack(track);
        break;
      case 'share':
        this.shareTrack(track);
        break;
      case 'view_lyrics':
        this.toggleLyrics(true);
        break;
      case 'copy_youtube_link':
        const ytLink = `https://youtu.be/${track.ytId || track.audioId}`;
        this.fallbackCopyText(ytLink);
        this.showToast(`YouTube link copied!`, 'link', 'text-zinc-300');
        break;
    }
  }

  bindEvents() {
    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-view');
        if (v) this.navigate(v);
      });
    });

    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());

    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => this.playPrev());

    const shuffleBtn = document.getElementById('btn-shuffle');
    if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.toggleShuffle());

    const repeatBtn = document.getElementById('btn-repeat');
    if (repeatBtn) repeatBtn.addEventListener('click', () => this.toggleRepeat());

    const likeBtn = document.getElementById('btn-like');
    if (likeBtn) likeBtn.addEventListener('click', () => this.toggleLike(this.currentTrack.id));

    const dislikeBtn = document.getElementById('btn-dislike');
    if (dislikeBtn) dislikeBtn.addEventListener('click', () => this.toggleDislike(this.currentTrack.id));

    // Progress Scrubber Sliders (Main, Fullscreen, Cinema)
    const progressSliders = ['player-progress', 'fs-progress', 'cinema-progress'];
    progressSliders.forEach(id => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('input', (e) => {
          this.isScrubbing = true;
          const percent = parseFloat(e.target.value);
          const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-primary').trim() || '#8b5cf6';
          const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-secondary').trim() || '#d946ef';
          progressSliders.forEach(sId => {
            const s = document.getElementById(sId);
            if (s) {
              s.value = percent;
              s.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${percent}%, #27272a ${percent}%, #27272a 100%)`;
            }
          });
          const dur = (window.audioPlayer && typeof window.audioPlayer.getDuration === 'function' && window.audioPlayer.getDuration() > 0)
            ? window.audioPlayer.getDuration()
            : ((this.currentTrack && this.currentTrack.durationSec > 0) ? this.currentTrack.durationSec : this.durationSec);
          if (dur > 0) {
            const targetSec = (percent / 100) * dur;
            const timeCurrent = document.getElementById('time-current');
            const fsTimeCurrent = document.getElementById('fs-time-current');
            const cinemaTimeCurrent = document.getElementById('cinema-time-current');
            const deckElapsed = document.getElementById('deck-elapsed-time');
            const formatted = this.formatSeconds(targetSec);
            if (timeCurrent) timeCurrent.innerText = formatted;
            if (fsTimeCurrent) fsTimeCurrent.innerText = formatted;
            if (cinemaTimeCurrent) cinemaTimeCurrent.innerText = formatted;
            if (deckElapsed) deckElapsed.innerText = formatted;
          }
        });

        slider.addEventListener('change', (e) => {
          const percent = parseFloat(e.target.value);
          const dur = (window.audioPlayer && typeof window.audioPlayer.getDuration === 'function' && window.audioPlayer.getDuration() > 0)
            ? window.audioPlayer.getDuration()
            : ((this.currentTrack && this.currentTrack.durationSec > 0) ? this.currentTrack.durationSec : this.durationSec);
          if (dur > 0 && window.audioPlayer) {
            const targetSec = (percent / 100) * dur;
            window.audioPlayer.seekTo(targetSec);
          }
          setTimeout(() => {
            this.isScrubbing = false;
          }, 150);
        });
      }
    });

    // Volume Sliders (Main & Fullscreen)
    const volSliders = ['volume-slider', 'fs-volume'];
    volSliders.forEach(id => {
      const slider = document.getElementById(id);
      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-primary').trim() || '#8b5cf6';
          const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-secondary').trim() || '#d946ef';
          volSliders.forEach(sId => {
            const s = document.getElementById(sId);
            if (s) {
              s.value = val;
              s.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${val}%, #3a3a3a ${val}%, #3a3a3a 100%)`;
            }
          });
          if (window.audioPlayer) window.audioPlayer.setVolume(val);
          try { localStorage.setItem('cadence_volume', val.toString()); } catch (err) {}
          this.updateVolumeIcon(val);
        });
      }
    });

    const volumeIconBtn = document.getElementById('btn-volume-icon');
    if (volumeIconBtn) {
      volumeIconBtn.addEventListener('click', () => {
        if (window.audioPlayer) {
          const isMuted = window.audioPlayer.toggleMute();
          this.updateVolumeIcon(isMuted ? 0 : window.audioPlayer.volume);
        }
      });
    }

    const toggleQueueBtn = document.getElementById('toggle-queue-btn');
    if (toggleQueueBtn) toggleQueueBtn.addEventListener('click', () => this.toggleQueue());

    const closeQueueBtn = document.getElementById('close-queue-btn');
    if (closeQueueBtn) closeQueueBtn.addEventListener('click', () => this.toggleQueue(false));

    const toggleLyricsBtn = document.getElementById('toggle-lyrics-btn');
    if (toggleLyricsBtn) toggleLyricsBtn.addEventListener('click', () => this.toggleLyrics());

    const closeLyricsBtn = document.getElementById('close-lyrics-btn');
    if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', () => this.toggleLyrics(false));

    const closeVideoPanelBtn = document.getElementById('close-video-panel-btn');
    if (closeVideoPanelBtn) closeVideoPanelBtn.addEventListener('click', () => this.closeFloatingPanel());

    // Search bar
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
      searchInput.addEventListener('focus', () => this.openSearchHistory(false));
      searchInput.addEventListener('click', () => this.openSearchHistory(false));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSearch(e.target.value);
      });
    }

    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) clearSearchBtn.addEventListener('click', () => this.clearSearch());

    const quickUrlBtn = document.getElementById('quick-url-btn');
    if (quickUrlBtn) quickUrlBtn.addEventListener('click', () => this.openAddTrackModal());

    const addTrackModalBtn = document.getElementById('add-track-modal-btn');
    if (addTrackModalBtn) addTrackModalBtn.addEventListener('click', () => this.openAddTrackModal());

    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // Mobile Search Bar Event Listeners
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileClearBtn = document.getElementById('mobile-clear-search-btn');
    if (mobileSearchInput) {
      mobileSearchInput.addEventListener('focus', () => this.openSearchHistory(true));
      mobileSearchInput.addEventListener('click', () => this.openSearchHistory(true));
      mobileSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (mobileClearBtn) mobileClearBtn.classList.toggle('hidden', !val);
        const desktopSearch = document.getElementById('global-search-input');
        if (desktopSearch) desktopSearch.value = val;
        this.handleSearchInput(val);
      });
      mobileSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleSearch(e.target.value);
        }
      });
    }

    // Close Search History on click outside
    document.addEventListener('click', (e) => {
      const desktopSearch = document.getElementById('desktop-search-container');
      const mobileSearch = document.getElementById('mobile-search-container');
      const searchDropdown = document.getElementById('search-history-dropdown');
      const mobileSearchDropdown = document.getElementById('mobile-search-history-dropdown');

      const isInsideDesktop = desktopSearch && desktopSearch.contains(e.target);
      const isInsideMobile = mobileSearch && mobileSearch.contains(e.target);

      if (!isInsideDesktop && !isInsideMobile) {
        if (searchDropdown) searchDropdown.classList.add('hidden');
        if (mobileSearchDropdown) mobileSearchDropdown.classList.add('hidden');
      }
    });

    // Master Pro Keyboard Shortcuts Listener
    window.addEventListener('keydown', (e) => {
      // Ignore if user is currently typing in an input, textarea, select, or editable element
      const activeEl = document.activeElement;
      if (activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.isContentEditable)) {
        return;
      }

      const code = e.code;
      const key = e.key;

      if (key === 'Escape') {
        this.closeContextMenu();
        ['equalizer-modal', 'sleep-timer-modal', 'radio-tuner-modal', 'keyboard-shortcuts-modal', 'playlist-modal'].forEach(id => {
          const m = document.getElementById(id);
          if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
        });
        if (this.isFullscreen) {
          this.toggleFullscreen();
        }
        return;
      }

      if (code === 'Space' || code === 'KeyK') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (code === 'KeyJ') {
        e.preventDefault();
        this.seekRelative(-5);
      } else if (code === 'KeyL') {
        e.preventDefault();
        this.seekRelative(5);
      } else if (code === 'KeyV') {
        e.preventDefault();
        this.toggleVideoMode();
      } else if (code === 'KeyN' || (code === 'ArrowRight' && e.shiftKey)) {
        e.preventDefault();
        this.playNext();
      } else if (code === 'KeyP' || (code === 'ArrowLeft' && e.shiftKey)) {
        e.preventDefault();
        this.playPrev();
      } else if (code === 'KeyM') {
        e.preventDefault();
        this.toggleMute();
      } else if (code === 'KeyF') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (code === 'KeyQ') {
        e.preventDefault();
        this.toggleQueue();
      } else if (code === 'KeyE') {
        e.preventDefault();
        this.openModal('equalizer');
      } else if (code === 'KeyT') {
        e.preventDefault();
        this.openModal('radio-tuner');
      } else if (code === 'KeyS') {
        e.preventDefault();
        this.openModal('sleep-timer');
      } else if (code === 'KeyD') {
        e.preventDefault();
        this.toggleDownloadCurrentTrack();
      } else if (key === '?' || (code === 'Slash' && e.shiftKey)) {
        e.preventDefault();
        this.openModal('keyboard-shortcuts');
      }
    });


    // Song Right Click Context Menu Delegated Listener
    document.addEventListener('contextmenu', (e) => {
      // 1. Right click on player bar or floating panel or turntable
      if (e.target.closest('#player-cover, #player-title, #player-artist, #video-panel, #vinyl-record-wrap, .turntable-container')) {
        e.preventDefault();
        this.openContextMenu(e, this.currentTrack);
        return;
      }

      // 2. Right click on any song card, list item or album
      const card = e.target.closest('.song-card, .album-card, [data-track-json], [data-track-id], [onclick*="playLiveTrack"], [onclick*="playTrackById"], [onclick*="playQueueIndex"]');
      if (card) {
        e.preventDefault();
        let track = null;

        const jsonAttr = card.getAttribute('data-track-json');
        if (jsonAttr) {
          try { track = JSON.parse(jsonAttr); } catch (err) {}
        }

        if (!track) {
          const idAttr = card.getAttribute('data-track-id');
          if (idAttr && window.YTM_DATA && YTM_DATA.tracks) {
            track = YTM_DATA.tracks.find(t => t.id === idAttr || t.ytId === idAttr);
          }
        }

        if (!track) {
          const onclickAttr = card.getAttribute('onclick') || '';
          const matchLive = onclickAttr.match(/playLiveTrack\(({.*?})\)/);
          if (matchLive) {
            try {
              const unescaped = matchLive[1].replace(/&quot;/g, '"');
              track = JSON.parse(unescaped);
            } catch (err) {}
          }

          const matchId = onclickAttr.match(/playTrackById\(['"](.*?)['"]\)/);
          if (matchId && window.YTM_DATA && YTM_DATA.tracks) {
            track = YTM_DATA.tracks.find(t => t.id === matchId[1] || t.ytId === matchId[1]);
          }

          const matchQueue = onclickAttr.match(/playQueueIndex\((\d+)\)/);
          if (matchQueue && this.queue) {
            track = this.queue[parseInt(matchQueue[1], 10)];
          }
        }

        if (!track) {
          const titleEl = card.querySelector('.font-bold, .font-semibold, h4, h3');
          const artistEl = card.querySelector('.text-zinc-400, .text-zinc-500, p');
          const imgEl = card.querySelector('img');
          if (titleEl) {
            track = {
              id: 'custom-' + Date.now(),
              title: titleEl.textContent.trim(),
              artist: artistEl ? artistEl.textContent.trim() : 'Unknown Artist',
              cover: imgEl ? imgEl.src : ''
            };
          }
        }

        if (track) {
          this.openContextMenu(e, track);
        }
      }
    });

    // Close Context Menu on Left Click or Escape
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('song-context-menu');
      if (menu && !menu.contains(e.target)) {
        this.closeContextMenu();
      }
    });


    // Cinema Mode Auto-Hide Controls & Cursor on Idle
    let cinemaHideTimeout = null;
    document.addEventListener('mousemove', () => {
      if (!this.isFullscreen || this.fullscreenMode !== 'video') return;
      const panel = document.getElementById('video-panel');
      if (!panel) return;
      panel.classList.remove('cinema-idle');
      clearTimeout(cinemaHideTimeout);
      cinemaHideTimeout = setTimeout(() => {
        if (this.isFullscreen && this.fullscreenMode === 'video' && window.audioPlayer && window.audioPlayer.isPlaying()) {
          panel.classList.add('cinema-idle');
        }
      }, 3500);
    });

    // Native fullscreen change handler
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.isFullscreen) {
        this.toggleFullscreen();
      }
    });
  }

  updateVolumeIcon(val) {
    const icon = document.getElementById('volume-icon');
    if (!icon) return;
    if (val === 0) {
      icon.setAttribute('data-lucide', 'volume-x');
    } else if (val < 50) {
      icon.setAttribute('data-lucide', 'volume-1');
    } else {
      icon.setAttribute('data-lucide', 'volume-2');
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

// Instantiate on DOM load or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.app) window.app = new YouTubeMusicApp();
  });
} else {
  if (!window.app) window.app = new YouTubeMusicApp();
}

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
      this.showFloatingPanel('song');
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
    if (this.isBackendOnline) {
      this.fetchSimilarTracksForArtist(titleArtist);
    }

    this.syncTasteProfileUI();
    this.renderSupermix();
    this.renderSimilarArtists();
    this.showToast(`Added "${titleArtist}" to your Taste Profile!`, 'sparkles', 'text-emerald-400');
  }

  addUserTasteGenre(genreTitle, categoryKey, sampleArtist = null) {
    if (!this.tasteProfile) this.initTasteEngine();
    if (!this.tasteProfile.genres[categoryKey]) {
      this.tasteProfile.genres[categoryKey] = { score: 0, plays: 0 };
    }
    this.tasteProfile.genres[categoryKey].score += 8;
    this.tasteProfile.genres[categoryKey].plays += 3;
    this.tasteProfile.totalPlays = (this.tasteProfile.totalPlays || 0) + 3;

    if (sampleArtist) {
      const artName = this.toTitleCase(sampleArtist);
      if (!this.tasteProfile.artists[artName]) {
        this.tasteProfile.artists[artName] = { score: 0, plays: 0, lastHeard: Date.now() };
      }
      this.tasteProfile.artists[artName].score += 10;
      this.tasteProfile.artists[artName].plays += 3;
      this.tasteProfile.artists[artName].lastHeard = Date.now();
      if (this.isBackendOnline) this.fetchSimilarTracksForArtist(artName);
    }

    this.saveTasteProfile();
    this.syncTasteProfileUI();
    this.renderSupermix();
    this.renderSimilarArtists();
    this.showToast(`Added ${genreTitle} to your taste!`, 'sparkles', 'text-violet-300');
  }

  removeTasteArtist(artistName) {
    if (!this.tasteProfile || !this.tasteProfile.artists) return;
    const norm = artistName.toLowerCase();
    for (const key of Object.keys(this.tasteProfile.artists)) {
      if (key.toLowerCase() === norm || this.getPrimaryArtistName(key).toLowerCase() === norm) {
        delete this.tasteProfile.artists[key];
      }
    }
    this.saveTasteProfile();
    this.syncTasteProfileUI();
    this.renderSupermix();
    this.renderSimilarArtists();
    this.showToast(`Removed "${artistName}" from your taste`, 'trash-2', 'text-zinc-400');
  }

  simulateTaste(style) {
    if (style === 'synthwave') {
      const t1 = { title: 'Blinding Lights', artist: 'The Weeknd', category: 'energize', ytId: '4NRXx6U8ABQ', playCount: 4 };
      const t2 = { title: 'Starboy', artist: 'The Weeknd', category: 'energize', ytId: '34Na4j8AVgA', playCount: 3 };
      const t3 = { title: 'Save Your Tears', artist: 'The Weeknd', category: 'energize', ytId: 'XXYlFuWEuKI', playCount: 2 };
      const t4 = { title: 'Midnight City', artist: 'M83', category: 'energize', ytId: 'dX3k_QDnzHE', playCount: 2 };
      [t1, t2, t3, t4].forEach(t => {
        this.recordSongPlay(t);
        this.updateTasteFromPlay(t, true);
      });
      this.showToast('Simulated 4 plays of The Weeknd & Synth-pop!', 'sparkles', 'text-violet-300');
    } else if (style === 'chill') {
      const t1 = { title: 'coffee', artist: 'beabadoobee', category: 'relax', ytId: '2b43b6rXjX0', playCount: 3 };
      const t2 = { title: 'Get You', artist: 'Daniel Caesar', category: 'relax', ytId: 'uQFVqltOGuA', playCount: 3 };
      const t3 = { title: 'Death Bed', artist: 'Powfu', category: 'relax', ytId: 'jJPMnTXl63E', playCount: 2 };
      [t1, t2, t3].forEach(t => {
        this.recordSongPlay(t);
        this.updateTasteFromPlay(t, true);
      });
      this.showToast('Simulated Chill & Lo-Fi taste profile!', 'sparkles', 'text-emerald-300');
    }
    this.syncTasteProfileUI();
  }

  resetTasteProfile() {
    this.tasteProfile = {
      artists: {},
      genres: {},
      totalPlays: 0,
      totalLikes: 0,
      totalSkips: 0
    };
    this.songHistory = [];
    localStorage.removeItem('cadence_taste_profile'); localStorage.removeItem('aura_taste_profile');
    localStorage.removeItem('cadence_song_history'); localStorage.removeItem('aura_song_history');
    this.renderSupermix();
    this.renderSimilarArtists();
    this.renderListenAgain();
    this.renderHeavyRotation();
    this.syncTasteProfileUI();
    this.showToast('Taste profile & history reset', 'rotate-ccw', 'text-zinc-400');
  }

  playAllQuickPicks() {
    const tracks = this.getQuickPicksTracks();
    if (!tracks || tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentTrackIndex = 0;
    this.lastQueueExtendIndex = -1;
    this.playQueueIndex(0, true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    this.showToast(`Playing Quick picks (${this.queue.length} adjacent songs)`, 'play', 'text-emerald-400');
  }

  renderRecommendedPlaylists() {
    const container = document.getElementById('recommended-playlists-grid');
    if (!container) return;

    container.innerHTML = YTM_DATA.playlists.map(pl => `
      <div class="album-card bg-ytm-surface p-3 rounded-xl cursor-pointer group" onclick="app.openPlaylist('${pl.id}')" title="View playlist">
        <div class="relative aspect-square rounded-lg overflow-hidden mb-3 shadow-md">
          <img src="${pl.cover}" alt="${pl.title}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/BwX8OS4cegU/hqdefault.jpg'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <button onclick="event.stopPropagation(); app.playPlaylist('${pl.id}')" title="Play playlist" class="album-play-btn absolute bottom-2 right-2 w-10 h-10 rounded-full bg-ytm-red text-white flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-lg transition-all hover:scale-110 active:scale-95">
            <i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i>
          </button>
        </div>
        <h3 class="font-bold text-sm truncate text-white">${pl.title}</h3>
        <p class="text-xs text-ytm-muted line-clamp-2 mt-0.5 leading-relaxed">${pl.subtitle}</p>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderTrending() {
    const container = document.getElementById('trending-tracks-grid');
    if (!container) return;

    const list = [...YTM_DATA.tracks].reverse().slice(0, 4);
    container.innerHTML = list.map(t => `
      <div class="bg-ytm-card hover:bg-ytm-hover p-3 rounded-xl cursor-pointer transition-colors flex items-center gap-3 group" onclick="app.playTrackById('${t.id}')">
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

  renderGenres() {
    const container = document.getElementById('genres-grid');
    if (!container) return;

    container.innerHTML = YTM_DATA.genres.map(g => `
      <div class="h-28 rounded-xl bg-gradient-to-br ${g.color} p-4 flex flex-col justify-between cursor-pointer hover:scale-[1.02] transition-transform shadow" onclick="app.filterByGenre('${g.name}')">
        <i data-lucide="${g.icon}" class="w-6 h-6 text-white/80"></i>
        <span class="font-bold text-sm text-white drop-shadow">${g.name}</span>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderLibrary() {
    const container = document.getElementById('library-playlists-grid');
    const likedContainer = document.getElementById('library-liked-list');
    const downloadedContainer = document.getElementById('library-downloaded-list');
    const likedCountBadge = document.getElementById('library-liked-count');
    const downloadedCountBadge = document.getElementById('library-downloaded-count');

    const likedTracks = this.getLikedTracks();
    const downloadedTracks = this.getDownloadedTracks();

    if (likedCountBadge) likedCountBadge.innerText = `${likedTracks.length} ${likedTracks.length === 1 ? 'song' : 'songs'}`;
    if (downloadedCountBadge) downloadedCountBadge.innerText = `${downloadedTracks.length} ${downloadedTracks.length === 1 ? 'song' : 'songs'}`;

    if (container) {
      const defaultCards = `
        <!-- Default Playlist Card: Liked Songs -->
        <div class="album-card bg-gradient-to-br from-rose-950/40 to-fuchsia-950/20 border border-rose-900/30 hover:border-rose-500/50 p-3.5 rounded-2xl cursor-pointer group transition-all" onclick="app.openDefaultPlaylist('liked')" title="View Liked Songs">
          <div class="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-gradient-to-tr from-rose-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
            <i data-lucide="heart" class="w-10 h-10 text-white fill-current"></i>
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <button onclick="event.stopPropagation(); app.playDefaultPlaylist('liked')" title="Play Liked Songs" class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"><i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i></button>
            </div>
          </div>
          <h4 class="font-bold text-sm text-white truncate group-hover:text-rose-300 transition-colors">Liked Songs</h4>
          <span class="text-xs text-zinc-400 font-mono-code">Default Playlist • ${likedTracks.length} songs</span>
        </div>

        <!-- Default Playlist Card: Downloaded -->
        <div class="album-card bg-gradient-to-br from-cyan-950/40 to-emerald-950/20 border border-cyan-900/30 hover:border-cyan-500/50 p-3.5 rounded-2xl cursor-pointer group transition-all" onclick="app.openDefaultPlaylist('downloaded')" title="View Downloaded Songs">
          <div class="relative aspect-square rounded-xl overflow-hidden mb-2.5 bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center shadow-lg">
            <i data-lucide="arrow-down-to-line" class="w-10 h-10 text-white"></i>
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <button onclick="event.stopPropagation(); app.playDefaultPlaylist('downloaded')" title="Play Downloaded Songs" class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"><i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i></button>
            </div>
          </div>
          <h4 class="font-bold text-sm text-white truncate group-hover:text-cyan-300 transition-colors">Downloaded</h4>
          <span class="text-xs text-zinc-400 font-mono-code">Default Playlist • ${downloadedTracks.length} songs</span>
        </div>
      `;

      const customCards = (this.userPlaylists || []).map((pl, idx) => `
        <div class="album-card bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800 hover:border-violet-500/40 p-3.5 rounded-2xl cursor-pointer group transition-all" onclick="app.openUserPlaylist(${idx})" title="View ${this.escapeHtml(pl.name)}">
          <div class="relative aspect-square rounded-xl overflow-hidden mb-2.5 shadow">
            <img src="${pl.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <button onclick="event.stopPropagation(); app.playUserPlaylist(${idx})" title="Play Playlist" class="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"><i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i></button>
            </div>
          </div>
          <h4 class="font-bold text-sm text-white truncate group-hover:text-violet-300 transition-colors">${this.escapeHtml(pl.name)}</h4>
          <span class="text-xs text-zinc-400 font-mono-code">Playlist • ${(pl.tracks || []).length} songs</span>
        </div>
      `).join('');

      container.innerHTML = defaultCards + customCards;
    }

    // Liked Songs List in Library
    if (likedContainer) {
      if (likedTracks.length === 0) {
        likedContainer.innerHTML = `
          <div class="p-6 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1">
            <div class="text-xs text-zinc-400 font-semibold">No liked songs yet</div>
            <div class="text-[11px] text-zinc-500">Right click any song or click the heart button to save songs here</div>
          </div>
        `;
      } else {
        likedContainer.innerHTML = likedTracks.map((t, idx) => `
          <div class="song-card flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/30 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-800 cursor-pointer group transition-all" onclick="app.playLiveTrack(${JSON.stringify(t).replace(/"/g, '&quot;')})">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-5 text-xs font-mono text-zinc-500 text-right">${idx + 1}</span>
              <img src="${t.cover}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId}/hqdefault.jpg'" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0">
              <div class="truncate">
                <div class="font-bold text-xs sm:text-sm text-white group-hover:text-rose-300 transition-colors truncate">${t.title}</div>
                <div class="text-[11px] text-zinc-400 truncate">${t.artist}</div>
              </div>
            </div>
            <div class="flex items-center gap-4 text-xs text-zinc-400 font-mono">
              <span class="hidden sm:inline">${t.album || ''}</span>
              <span>${t.duration || '3:30'}</span>
              <button onclick="event.stopPropagation(); app.toggleLike('${t.id || t.ytId}', ${JSON.stringify(t).replace(/"/g, '&quot;')})" class="p-1 text-rose-500 hover:scale-110 transition-transform" title="Unlike">
                <i data-lucide="heart" class="w-4 h-4 fill-current"></i>
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    // Downloaded Songs List in Library
    if (downloadedContainer) {
      if (downloadedTracks.length === 0) {
        downloadedContainer.innerHTML = `
          <div class="p-6 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1">
            <div class="text-xs text-zinc-400 font-semibold">No downloaded songs yet</div>
            <div class="text-[11px] text-zinc-500">Right click any song and choose "Download Track" to save songs here</div>
          </div>
        `;
      } else {
        downloadedContainer.innerHTML = downloadedTracks.map((t, idx) => `
          <div class="song-card flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/30 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-800 cursor-pointer group transition-all" onclick="app.playLiveTrack(${JSON.stringify(t).replace(/"/g, '&quot;')})">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-5 text-xs font-mono text-zinc-500 text-right">${idx + 1}</span>
              <img src="${t.cover}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId}/hqdefault.jpg'" class="w-10 h-10 rounded-lg object-cover shadow-sm shrink-0">
              <div class="truncate">
                <div class="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-300 transition-colors truncate">${t.title}</div>
                <div class="text-[11px] text-zinc-400 truncate">${t.artist}</div>
              </div>
            </div>
            <div class="flex items-center gap-4 text-xs text-zinc-400 font-mono">
              <span class="hidden sm:inline">${t.album || ''}</span>
              <span>${t.duration || '3:30'}</span>
              <span class="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <i data-lucide="check" class="w-3 h-3"></i> Saved
              </span>
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }


  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  clampQueue(max = 100) {
    if (!this.queue || this.queue.length <= max) return;
    const curIdx = this.currentTrackIndex || 0;
    if (curIdx > 20) {
      const dropCount = Math.min(curIdx - 10, this.queue.length - max);
      if (dropCount > 0) {
        this.queue.splice(0, dropCount);
        this.currentTrackIndex -= dropCount;
      }
    }
  }

  renderQueue() {
    const container = document.getElementById('queue-tracks-list');
    const badge = document.getElementById('queue-badge');
    this.clampQueue(100);
    if (badge) badge.innerText = this.queue.length;
    if (container) {
      container.innerHTML = this.queue.map((t, index) => {
        const isCurrent = this.currentTrack && (this.currentTrack.id === t.id || this.currentTrack.ytId === t.ytId);
        return `
          <div 
            class="flex items-center justify-between p-2 rounded-lg ${isCurrent ? 'bg-ytm-hover border border-red-900/40' : 'hover:bg-[#1a1a1a]'} cursor-pointer group"
            onclick="app.playQueueIndex(${index}, true)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-4 text-xs font-mono text-zinc-500">${index + 1}</span>
              <img src="${t.cover}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${t.ytId}/hqdefault.jpg'" class="w-9 h-9 rounded object-cover shrink-0">
              <div class="truncate">
                <div class="font-medium text-xs truncate ${isCurrent ? 'text-ytm-red font-bold' : 'text-white'}">${t.title}</div>
                <div class="text-[11px] text-ytm-muted truncate">${t.artist}</div>
              </div>
            </div>

            <div class="flex items-center gap-1">
              ${isCurrent ? '<span class="text-[10px] font-bold text-ytm-red uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-950/40">Playing</span>' : ''}
              <span class="text-[11px] text-ytm-muted font-mono">${t.duration}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Orbit Upcoming Wing (Top 4 upcoming songs in vinyl deck)
    const orbitContainer = document.getElementById('orbit-tracks-list');
    if (orbitContainer && this.queue.length > 0) {
      const upcoming = [];
      for (let i = 1; i <= Math.min(4, this.queue.length - 1); i++) {
        const nextIdx = (this.currentTrackIndex + i) % this.queue.length;
        if (this.queue[nextIdx]) {
          upcoming.push({ track: this.queue[nextIdx], index: nextIdx });
        }
      }

      orbitContainer.innerHTML = upcoming.map(({ track, index }) => `
        <div onclick="app.playQueueIndex(${index})" class="p-2.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 hover:border-violet-500/50 cursor-pointer transition-all flex items-center gap-3 group">
          <div class="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-zinc-700">
            <img src="${track.cover}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://img.youtube.com/vi/${track.ytId}/hqdefault.jpg'" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <i data-lucide="play" class="w-3.5 h-3.5 text-white fill-current"></i>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-xs text-white truncate group-hover:text-violet-300">${track.title}</div>
            <div class="text-[10px] text-zinc-400 truncate">${track.artist}</div>
          </div>
          <span class="text-[11px] font-mono-code text-zinc-500">${track.duration}</span>
        </div>
      `).join('');

      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- NAVIGATION & ROUTING ---

  navigate(viewName) {
    if (this.currentView && this.currentView !== 'playlist') {
      this.previousView = this.currentView;
    }
    this.currentView = viewName;
    const views = ['home', 'explore', 'library', 'search', 'history', 'playlist'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle('hidden', v !== viewName);
    });

    if (viewName === 'history') {
      this.renderHistoryView();
    }

    // Desktop nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      const target = link.getAttribute('data-view');
      const isActive = target === viewName;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.className = 'nav-link active w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-violet-600/20 border border-violet-500/40 text-violet-300 shadow-md shadow-violet-500/10';
        const icon = link.querySelector('i');
        if (icon) icon.className = 'w-4 h-4 text-violet-400';
      } else {
        link.className = 'nav-link w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-zinc-900/70 border border-transparent hover:border-zinc-800 transition-all font-medium';
        const icon = link.querySelector('i');
        if (icon) icon.className = 'w-4 h-4 text-zinc-400';
      }
    });

    // Mobile bottom nav buttons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = btn.getAttribute('data-view');
      const isActive = target === viewName;
      btn.classList.toggle('text-white', isActive);
      btn.classList.toggle('text-zinc-400', !isActive);
      const icon = btn.querySelector('i');
      if (icon) icon.classList.toggle('text-white', isActive);
    });

    // Close mobile drawer on navigation ONLY on mobile
    if (window.innerWidth < 768) {
      this.toggleSidebar(false);
    }

    const mainEl = document.getElementById('main-content');
    if (mainEl) mainEl.scrollTop = 0;
  }

  // --- PLAYBACK CONTROL (Instant 0ms Switching & Smart Deduplication) ---

  normalizeSongTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/\(.*?\)/g, '')   // remove (feat. ...), (Official Video), (Bonus Track), (Remix)
      .replace(/\[.*?\]/g, '')   // remove [From ...]
      .replace(/- remake cover/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  playLiveTrack(track, replaceQueue = true) {
    if (replaceQueue) {
      // Start fresh dynamic radio queue for this song instead of repeating default starter songs
      this.queue = [track];
      this.currentTrackIndex = 0;
      this.lastQueueExtendIndex = -1;
      const norm = this.normalizeSongTitle(track.title);
      this.playedSongTitles = new Set(norm ? [norm] : []);
      this.playQueueIndex(0, true);
    } else {
      const existingIndex = this.queue.findIndex(t => t.ytId === track.ytId);
      if (existingIndex !== -1) {
        this.playQueueIndex(existingIndex, true);
      } else {
        this.queue.splice(this.currentTrackIndex + 1, 0, track);
        this.playQueueIndex(this.currentTrackIndex + 1, true);
      }
    }
  }

  playTrackById(trackId) {
    const track = YTM_DATA.tracks.find(t => t.id === trackId) || this.queue.find(t => t.id === trackId);
    if (track) {
      this.playLiveTrack(track, true);
    }
  }

  playQueueIndex(index, isExplicit = false) {
    if (index < 0 || index >= this.queue.length) return;
    this.currentTrackIndex = index;
    this.currentTrack = this.queue[index];

    if (this.currentTrack && this.currentTrack.title) {
      const norm = this.normalizeSongTitle(this.currentTrack.title);
      if (norm) this.playedSongTitles.add(norm);
    }

    // Select Music Video if currently in Video Mode, otherwise Clean Studio Audio Master
    let targetId = this.currentTrack.audioId || this.currentTrack.originalVideoId || this.currentTrack.ytId;
    if (this.isVideoPanelOpen && this.currentTrack.musicVideoId) {
      targetId = this.currentTrack.musicVideoId;
    }
    this.currentTrack.ytId = targetId;

    this.updatePlayerBar(this.currentTrack, true);
    if (this.currentTrack) {
      try {
        localStorage.setItem('cadence_last_played_track', JSON.stringify(this.currentTrack));
        localStorage.setItem('cadence_last_queue', JSON.stringify(this.queue.slice(0, 30)));
        localStorage.setItem('cadence_last_track_index', this.currentTrackIndex.toString());
      } catch (e) {}
    }

    // Attribution Engine:
    // Only record immediately if this was an explicit user click (top song of queue / clicked song)
    if (isExplicit) {
      this.currentTrackRecorded = true;
      this.recordSongPlay(this.currentTrack);
    } else {
      // Auto-advance / upcoming queue track: only count if user listens for >= 30 seconds
      this.currentTrackRecorded = false;
      this.currentTrackListenedSeconds = 0;
    }
    if (!this.userClosedFloatingPanel) {
      const isVideoActive = window.audioPlayer && window.audioPlayer.mode === 'video';
      this.showFloatingPanel(isVideoActive ? 'video' : 'song');
    }
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();

    // YouTube Music Automix Continuous Flow:
    // When user reaches 15th song in queue (index >= 14 or remaining <= 5), dynamically append more similar tracks
    if ((index >= 14 || (this.queue.length - index <= 5 && this.queue.length >= 15)) && this.lastQueueExtendIndex !== index) {
      this.extendQueueWithSimilarTracks();
    }

    // 1. INSTANT PLAYBACK (Zero Delay / 0ms)
    if (window.audioPlayer) {
      window.audioPlayer.loadTrack(this.currentTrack, true);
    }

    // 2. Fetch lyrics & radio asynchronously in the background (Non-blocking)
    if (this.isBackendOnline) {
      const queryId = this.currentTrack.audioId || this.currentTrack.originalVideoId || this.currentTrack.ytId;
      if (queryId) this.fetchRadioAndLyrics(queryId);
    }

    // 3. Pre-buffer upcoming tracks for instant 0ms transitions
    const nextTrack = this.queue[this.currentTrackIndex + 1];
    const afterNextTrack = this.queue[this.currentTrackIndex + 2];
    if (window.audioPlayer && nextTrack) {
      window.audioPlayer.preloadNextTrack(nextTrack);
    }
    if (afterNextTrack) {
      const vid2 = afterNextTrack.audioId || afterNextTrack.ytId || afterNextTrack.musicVideoId;
      if (vid2) {
        fetch(`${this.apiBaseUrl}/api/prefetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds: [vid2] })
        }).catch(() => {});
      }
    }
  }

  async fetchRadioAndLyrics(videoId) {
    try {
      const title = this.currentTrack ? this.currentTrack.title : '';
      const artist = this.currentTrack ? this.currentTrack.artist : '';
      const album = this.currentTrack ? (this.currentTrack.album || '') : '';
      const dur = this.currentTrack ? (this.currentTrack.durationSec || 0) : 0;
      const res = await fetch(`${this.apiBaseUrl}/api/watch?videoId=${videoId}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&duration=${dur}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics) {
          this.setLiveLyrics(this.currentTrack, data.lyrics, data.synced);
        }

        if (Array.isArray(data.tracks) && data.tracks.length > 0) {
          const freshTracks = data.tracks.filter(nt => this.isUniqueQueueCandidate(nt));

          if (freshTracks.length > 0) {
            const MAX_QUEUE = 20;
            const slots = Math.max(0, MAX_QUEUE - this.queue.length);
            if (slots > 0) {
              this.queue.push(...freshTracks.slice(0, slots));
            }
            this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
          }
        }
      }
    } catch (e) {
      console.warn('Radio fetch error:', e);
    }
  }

  isUniqueQueueCandidate(t) {
    if (!t || !t.title) return false;
    const norm = this.normalizeSongTitle(t.title);
    if (!norm) return false;

    // 1. Skip if already played in this listening session
    if (this.playedSongTitles && this.playedSongTitles.has(norm)) return false;

    // 2. Skip if song title already exists anywhere in current queue
    const titleInQueue = this.queue.some(qt => this.normalizeSongTitle(qt.title) === norm);
    if (titleInQueue) return false;

    // 3. Skip if video ID matches any track in current queue
    const ntIds = [t.ytId, t.audioId, t.musicVideoId, t.id].filter(Boolean);
    const idInQueue = this.queue.some(qt => 
      ntIds.includes(qt.ytId) || 
      (qt.audioId && ntIds.includes(qt.audioId)) || 
      (qt.musicVideoId && ntIds.includes(qt.musicVideoId))
    );
    if (idInQueue) return false;

    return true;
  }

  async extendQueueWithSimilarTracks() {
    if (this.isExtendingQueue) return;
    this.isExtendingQueue = true;
    this.lastQueueExtendIndex = this.currentTrackIndex;

    try {
      const current = this.currentTrack || this.queue[this.currentTrackIndex] || (this.queue.length > 0 ? this.queue[this.queue.length - 1] : null);
      if (!current) {
        this.isExtendingQueue = false;
        return;
      }

      const seedVideoId = current.audioId || current.originalVideoId || current.ytId;
      const seedTitle = current.title || '';
      const seedArtist = current.artist || '';
      const seedCategory = current.category || 'all';

      const candidateTracks = [];
      const seenNorms = new Set();

      const addCandidate = (cand) => {
        if (!cand || !cand.title) return false;
        const norm = this.normalizeSongTitle(cand.title);
        if (seenNorms.has(norm)) return false;
        if (!this.isUniqueQueueCandidate(cand)) return false;
        seenNorms.add(norm);
        candidateTracks.push({
          id: cand.id || `flow-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: cand.title,
          artist: cand.artist || 'Unknown Artist',
          album: cand.album || 'Single',
          duration: cand.duration || '3:30',
          durationSec: cand.durationSec || 210,
          cover: cand.cover || `https://img.youtube.com/vi/${cand.ytId || 'dQw4w9WgXcQ'}/hqdefault.jpg`,
          ytId: cand.ytId || cand.audioId,
          audioId: cand.audioId || cand.ytId,
          musicVideoId: cand.musicVideoId || null,
          category: cand.category || seedCategory || 'all'
        });
        return true;
      };

      // 1. YouTube Music algorithmic watch playlist from backend
      if (this.isBackendOnline && seedVideoId) {
        try {
          const res = await fetch(`${this.apiBaseUrl}/api/watch?videoId=${seedVideoId}&title=${encodeURIComponent(seedTitle)}&artist=${encodeURIComponent(seedArtist)}&category=${encodeURIComponent(seedCategory)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.tracks)) {
              for (const t of data.tracks) {
                addCandidate(t);
              }
            }
          }
        } catch (e) {
          console.warn('[Cadence Flow] Watch playlist fetch failed:', e);
        }
      }

      // 2. Backend Search for related songs by artist if we need more candidates
      if (this.isBackendOnline && candidateTracks.length < 15 && seedArtist) {
        try {
          const searchRes = await fetch(`${this.apiBaseUrl}/api/search?q=${encodeURIComponent(seedArtist + ' radio')}`);
          if (searchRes.ok) {
            const sData = await searchRes.json();
            if (Array.isArray(sData.results)) {
              for (const t of sData.results) {
                addCandidate(t);
              }
            }
          }
        } catch (e) {
          console.warn('[Cadence Flow] Search fallback failed:', e);
        }
      }

      // 3. Local catalog fallback (instant & works offline) from YTM_DATA.tracks
      if (candidateTracks.length < 15 && window.YTM_DATA && Array.isArray(YTM_DATA.tracks)) {
        // Group 1: Same artist
        const sameArtist = YTM_DATA.tracks.filter(t => 
          t.artist && seedArtist && t.artist.toLowerCase() === seedArtist.toLowerCase()
        );
        // Group 2: Same category / mood
        const sameCategory = YTM_DATA.tracks.filter(t => 
          seedCategory !== 'all' && t.category === seedCategory
        );
        // Group 3: Other discovery tracks from catalog
        const others = YTM_DATA.tracks;

        for (const pool of [sameArtist, sameCategory, others]) {
          for (const t of pool) {
            addCandidate(t);
            if (candidateTracks.length >= 20) break;
          }
          if (candidateTracks.length >= 20) break;
        }
      }

      // 4. Rank candidate tracks using YouTube Music Taste Vector Scoring Formula
      if (this.tasteProfile && candidateTracks.length > 1) {
        const topArtists = this.getTopAffinityArtists(5);
        const topGenres = this.getTopAffinityGenres(5);
        const artistMap = new Map(topArtists.map(a => [a.name.toLowerCase(), a.score]));
        const genreMap = new Map(topGenres.map(g => [g.category.toLowerCase(), g.score]));

        candidateTracks.sort((a, b) => {
          const artA = (a.artist || '').toLowerCase();
          const artB = (b.artist || '').toLowerCase();
          const genA = (a.category || '').toLowerCase();
          const genB = (b.category || '').toLowerCase();

          let scoreA = (artistMap.get(artA) || 0) * 3.0 + (genreMap.get(genA) || 0) * 2.0;
          let scoreB = (artistMap.get(artB) || 0) * 3.0 + (genreMap.get(genB) || 0) * 2.0;

          if (genA === seedCategory) scoreA += 2.0;
          if (genB === seedCategory) scoreB += 2.0;

          return scoreB - scoreA;
        });
      }

      // Append up to 15-20 similar songs
      const tracksToAdd = candidateTracks.slice(0, 20);

      if (tracksToAdd.length > 0) {
        this.queue.push(...tracksToAdd);
        this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();

        // Preload upcoming track
        const nextTrack = this.queue[this.currentTrackIndex + 1];
        if (window.audioPlayer && nextTrack) {
          window.audioPlayer.preloadNextTrack(nextTrack);
        }

        this.showToast(`Automix: +${tracksToAdd.length} similar songs added to queue`, 'sparkles', 'text-amber-400');
        console.log(`[Cadence Flow] Reached 15th song -> Appended ${tracksToAdd.length} similar songs. Total queue: ${this.queue.length}`);
      }
    } catch (err) {
      console.error('[Cadence Flow] Error in extendQueueWithSimilarTracks:', err);
    } finally {
      this.isExtendingQueue = false;
    }
  }

  setLiveLyrics(track, lyricsText, isSynced = false) {
    if (!track || !lyricsText) return;
    this.rawLyricsText = lyricsText;
    this.translatedLyricsText = null;
    this.romanizedLyricsText = null;
    this.isLyricsTranslated = false;
    this.activeLyricIndex = -1;

    const rawLines = lyricsText.split('\n');
    const parsed = [];
    const syncRegex = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
    let hasValidTimestamps = false;

    // Check if synced LRC format
    for (const rawLine of rawLines) {
      const match = rawLine.trim().match(syncRegex);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseFloat('0.' + match[3]) : 0;
        const time = min * 60 + sec + ms;
        const text = match[4].trim();
        if (text) {
          parsed.push({ time, text, romanized: null, translatedText: null });
          hasValidTimestamps = true;
        }
      }
    }

    // If not timestamped, assign proportional timestamps across track duration
    if (!hasValidTimestamps || parsed.length < 3) {
      parsed.length = 0;
      const cleanLines = rawLines.map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('['));
      const dur = (track && track.durationSec && track.durationSec > 30) ? track.durationSec : 210;
      const startTime = 12;
      const endTime = Math.max(startTime + 10, dur - 15);
      const step = cleanLines.length > 1 ? (endTime - startTime) / cleanLines.length : 5;

      cleanLines.forEach((lineText, idx) => {
        const t = Math.round((startTime + idx * step) * 10) / 10;
        parsed.push({ time: t, text: lineText, romanized: null, translatedText: null });
      });
    }

    this.currentLyrics = parsed;
    this.renderLyricsUI();
  }

  renderLyricsUI() {
    const el = document.getElementById('lyrics-content');
    const fsBox = document.getElementById('fs-lyrics-box');
    const track = this.currentTrack;
    if (!track) return;

    if (!this.currentLyrics || this.currentLyrics.length === 0) {
      if (el) {
        el.innerHTML = `
          <div class="text-xs uppercase tracking-widest text-ytm-red font-bold mb-4 select-none text-center">${track.title}</div>
          <p class="text-zinc-500 text-xs py-8 text-center">No lyrics available for this track.</p>
        `;
      }
      if (fsBox) {
        fsBox.innerHTML = `<div class="text-zinc-500 text-sm py-4">No lyrics available.</div>`;
      }
      return;
    }

    // Drawer HTML (Clean Song Title with Peak Font, 3-Tier Translated or Standard)
    if (el) {
      el.innerHTML = `
        <div class="text-xs uppercase tracking-widest text-ytm-red font-bold mb-4 select-none text-center">${track.title}</div>
        <div class="space-y-1 text-left max-w-sm mx-auto" id="lyrics-lines-container">
          ${this.currentLyrics.map((item, idx) => {
            const cls = idx === this.activeLyricIndex ? 'active-lyric' : (idx < this.activeLyricIndex ? 'played-lyric' : 'upcoming-lyric');
            if (this.isLyricsTranslated) {
              // 3-Tier Format: Original script top, Romanized middle, English translation bottom
              return `
                <div 
                  class="lyric-line-block ${cls} group mb-5 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10" 
                  data-idx="${idx}" 
                  data-time="${item.time}" 
                  onclick="window.app.seekToLyric(${item.time})"
                  title="Jump to ${this.formatSeconds(item.time)}"
                >
                  <div class="text-xs text-zinc-400 font-medium mb-1 tracking-wide leading-relaxed select-none">
                    ${item.text}
                  </div>
                  <div class="romanized-line text-lg font-bold text-zinc-100 group-hover:text-white leading-snug tracking-tight">
                    ${item.romanized || item.text}
                  </div>
                  <div class="text-xs text-zinc-400/90 mt-1 font-normal select-none">
                    ${item.translatedText || ''}
                  </div>
                </div>
              `;
            } else {
              // Standard Original format
              return `
                <div 
                  class="lyric-line-block ${cls} group mb-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10" 
                  data-idx="${idx}" 
                  data-time="${item.time}" 
                  onclick="window.app.seekToLyric(${item.time})"
                  title="Jump to ${this.formatSeconds(item.time)}"
                >
                  <div class="romanized-line text-base font-bold text-zinc-200 group-hover:text-white leading-relaxed">
                    ${item.text}
                  </div>
                </div>
              `;
            }
          }).join('')}
        </div>
        <div class="text-zinc-600 text-[11px] mt-8 text-center flex items-center justify-center gap-1.5 select-none">
          <span>💡 Click any lyric to jump to that moment</span>
        </div>
      `;
    }

    // Fullscreen Box HTML
    if (fsBox) {
      fsBox.innerHTML = this.currentLyrics.map((item, idx) => {
        const cls = idx === this.activeLyricIndex ? 'active-lyric' : (idx < this.activeLyricIndex ? 'played-lyric' : 'upcoming-lyric');
        if (this.isLyricsTranslated) {
          return `
            <div 
              class="lyric-line-block ${cls} group mb-5 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10" 
              data-idx="${idx}" 
              data-time="${item.time}" 
              onclick="window.app.seekToLyric(${item.time})"
              title="Jump to ${this.formatSeconds(item.time)}"
            >
              <div class="text-xs text-zinc-400 font-medium mb-1 tracking-wide select-none">
                ${item.text}
              </div>
              <div class="romanized-line text-xl font-bold text-zinc-100 group-hover:text-white leading-snug">
                ${item.romanized || item.text}
              </div>
              <div class="text-xs text-zinc-400/90 mt-1 select-none">
                ${item.translatedText || ''}
              </div>
            </div>
          `;
        } else {
          return `
            <div 
              class="lyric-line-block ${cls} group mb-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/10" 
              data-idx="${idx}" 
              data-time="${item.time}" 
              onclick="window.app.seekToLyric(${item.time})"
              title="Jump to ${this.formatSeconds(item.time)}"
            >
              <div class="romanized-line text-lg font-bold text-zinc-200 group-hover:text-white leading-relaxed">
                ${item.text}
              </div>
            </div>
          `;
        }
      }).join('');
    }
  }

  seekToLyric(timeSeconds) {
    const sec = Math.max(0, parseFloat(timeSeconds));
    if (isNaN(sec)) return;
    console.log('[Cadence Lyrics] Seeking to second:', sec);
    if (window.audioPlayer) {
      window.audioPlayer.seekTo(sec);
    }
    const dur = (this.currentTrack && this.currentTrack.durationSec) || 200;
    this.updateProgressUI(sec, dur);
    this.syncLyricsProgress(sec);
  }

  syncLyricsProgress(currentTime) {
    if (!this.currentLyrics || this.currentLyrics.length === 0) return;
    // 0.18s anticipation offset so lyric lines light up right as vocal attack begins
    const syncTime = currentTime + 0.18;
    let newIdx = -1;
    for (let i = 0; i < this.currentLyrics.length; i++) {
      if (syncTime >= this.currentLyrics[i].time) {
        newIdx = i;
      } else {
        break;
      }
    }

    if (newIdx !== this.activeLyricIndex) {
      this.activeLyricIndex = newIdx;
      const allLines = document.querySelectorAll('.lyric-line-block, .lyric-line');
      allLines.forEach(lineEl => {
        const idx = parseInt(lineEl.getAttribute('data-idx'), 10);
        if (idx === newIdx) {
          lineEl.classList.add('active-lyric');
          lineEl.classList.remove('played-lyric', 'upcoming-lyric');
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (idx < newIdx) {
          lineEl.classList.remove('active-lyric', 'upcoming-lyric');
          lineEl.classList.add('played-lyric');
        } else {
          lineEl.classList.remove('active-lyric', 'played-lyric');
          lineEl.classList.add('upcoming-lyric');
        }
      });
    }
  }

  async toggleLyricsTranslation() {
    if (!this.currentLyrics || this.currentLyrics.length === 0) return;
    this.isLyricsTranslated = !this.isLyricsTranslated;
    const btnLabel = document.getElementById('translate-btn-label');
    const fsBtnLabel = document.getElementById('fs-translate-btn-label');
    const btn = document.getElementById('btn-translate-lyrics');
    const fsBtn = document.getElementById('fs-btn-translate-lyrics');

    if (this.isLyricsTranslated) {
      if (!this.translatedLyricsText) {
        if (btnLabel) btnLabel.innerText = 'Translating...';
        if (fsBtnLabel) fsBtnLabel.innerText = 'Translating...';
        try {
          const plainText = this.currentLyrics.map(l => l.text).join('\n');
          const res = await fetch(`${this.apiBaseUrl}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: plainText, targetLang: 'en' })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.translated) {
              this.translatedLyricsText = data.translated;
              this.romanizedLyricsText = data.romanized;
              const transLines = data.translated.split('\n');
              const romanLines = data.romanized ? data.romanized.split('\n') : [];
              this.currentLyrics.forEach((l, idx) => {
                l.translatedText = transLines[idx] || l.text;
                l.romanized = (romanLines && romanLines[idx]) || '';
              });
            }
          }
        } catch (e) {
          console.warn('Translation error:', e);
        }
      }

      if (btnLabel) btnLabel.innerText = 'Original';
      if (fsBtnLabel) fsBtnLabel.innerText = 'Original';
      if (btn) btn.classList.add('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');
      if (fsBtn) fsBtn.classList.add('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');
    } else {
      if (btnLabel) btnLabel.innerText = 'Translate';
      if (fsBtnLabel) fsBtnLabel.innerText = 'Translate';
      if (btn) btn.classList.remove('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');
      if (fsBtn) fsBtn.classList.remove('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');
    }

    this.renderLyricsUI();
    if (window.lucide) window.lucide.createIcons();
  }

  togglePlayPause() {
    if (!this.currentTrack) {
      if (this.queue && this.queue.length > 0) {
        this.playQueueIndex(0, true);
        return;
      }
      if (typeof YTM_DATA !== 'undefined' && Array.isArray(YTM_DATA.tracks) && YTM_DATA.tracks.length > 0) {
        this.playLiveTrack(YTM_DATA.tracks[0], true);
        return;
      }
      this.showToast('Select a song to start listening', 'info', 'text-amber-400');
      return;
    }
    if (window.audioPlayer) {
      window.audioPlayer.togglePlay();
    }
  }

  playNext() {
    if (this.repeatMode === 2) {
      this.playQueueIndex(this.currentTrackIndex);
      return;
    }

    let nextIdx = this.currentTrackIndex + 1;

    // Autoplay Radio Flow: Ensure more similar songs are appended when approaching end or reaching 15th song
    if ((nextIdx >= 14 || (this.queue.length - nextIdx <= 5)) && this.lastQueueExtendIndex !== nextIdx) {
      this.extendQueueWithSimilarTracks();
    }

    if (nextIdx >= this.queue.length) {
      if (this.repeatMode === 1) {
        nextIdx = 0;
      } else {
        return;
      }
    }
    this.playQueueIndex(nextIdx);
  }

  playPrev() {
    let prevIdx = this.currentTrackIndex - 1;
    if (prevIdx < 0) {
      prevIdx = this.queue.length - 1;
    }
    this.playQueueIndex(prevIdx);
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    const btn = document.getElementById('btn-shuffle');
    if (btn) {
      btn.classList.toggle('text-ytm-red', this.isShuffled);
      btn.classList.toggle('text-ytm-muted', !this.isShuffled);
    }

    if (this.isShuffled) {
      const cur = this.queue[this.currentTrackIndex];
      const others = this.queue.filter((_, i) => i !== this.currentTrackIndex);
      others.sort(() => Math.random() - 0.5);
      this.queue = [cur, ...others];
      this.currentTrackIndex = 0;
    } else {
      this.queue = [...YTM_DATA.tracks];
      this.currentTrackIndex = this.queue.findIndex(t => t.id === this.currentTrack.id);
    }
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat');
    if (!btn) return;

    if (this.repeatMode === 0) {
      btn.className = 'p-1.5 text-ytm-muted hover:text-white transition-colors';
      btn.innerHTML = '<i data-lucide="repeat" class="w-4 h-4"></i>';
    } else if (this.repeatMode === 1) {
      btn.className = 'p-1.5 text-ytm-red transition-colors';
      btn.innerHTML = '<i data-lucide="repeat" class="w-4 h-4"></i>';
    } else {
      btn.className = 'p-1.5 text-ytm-red transition-colors relative';
      btn.innerHTML = '<i data-lucide="repeat-1" class="w-4 h-4"></i>';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  handleTrackEnded() {
    if (this.sleepTimerMode === 'end_of_track') {
      this.cancelSleepTimer();
      if (window.audioPlayer) window.audioPlayer.pause();
      this.showToast('Sleep timer: Playback paused at end of track', 'moon', 'text-indigo-400');
      return;
    }
    this.playNext();
  }

  playPlaylist(playlistId) {
    const pl = YTM_DATA.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const tracks = pl.trackIds
      .map(id => YTM_DATA.tracks.find(t => t.id === id))
      .filter(Boolean);

    if (tracks.length > 0) {
      this.playedSongTitles.clear();
      this.queue = [...tracks].slice(0, 20);
      this.lastQueueExtendIndex = -1;
      this.playQueueIndex(0);
    }
  }

  // --- UI STATE UPDATES ---

  updatePlayerBar(track, isPlaying = true) {
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');
    const coverEl = document.getElementById('player-cover');
    const totalTimeEl = document.getElementById('time-duration');
    const likeBtn = document.getElementById('btn-like');
    const dislikeBtn = document.getElementById('btn-dislike');

    const floatCover = document.getElementById('floating-cover-img');
    const floatTitle = document.getElementById('floating-cover-title');
    const floatArtist = document.getElementById('floating-cover-artist');

    const vinylArt = document.getElementById('vinyl-label-art');
    const vinylTitle = document.getElementById('vinyl-label-title');
    const vinylArtist = document.getElementById('vinyl-label-artist');
    const deckTitle = document.getElementById('deck-track-title');
    const deckArtist = document.getElementById('deck-track-artist');
    const deckTotalTime = document.getElementById('deck-total-time');

    const mCover = document.getElementById('mobile-player-cover');
    const mTitle = document.getElementById('mobile-player-title');
    const mArtist = document.getElementById('mobile-player-artist');

    const fsTitle = document.getElementById('fs-title');
    const fsArtist = document.getElementById('fs-artist');
    const fsAlbum = document.getElementById('fs-album');
    const fsCover = document.getElementById('fs-cover');

    if (!track) {
      const defaultCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
      if (titleEl) titleEl.innerText = 'No track playing';
      if (artistEl) artistEl.innerText = 'Select a track to start';
      if (coverEl) coverEl.src = defaultCover;
      if (totalTimeEl) totalTimeEl.innerText = '0:00';

      if (floatTitle) floatTitle.innerText = 'No track playing';
      if (floatArtist) floatArtist.innerText = 'Cadence Music';
      if (floatCover) floatCover.src = defaultCover;

      if (vinylArt) vinylArt.src = defaultCover;
      if (vinylTitle) vinylTitle.innerText = 'Cadence Music';
      if (vinylArtist) vinylArtist.innerText = 'Vinyl Deck Ready';
      if (deckTitle) deckTitle.innerText = 'Select a track to play';
      if (deckArtist) deckArtist.innerText = 'Cadence Direct • Ready';
      if (deckTotalTime) deckTotalTime.innerText = '0:00';

      if (mTitle) mTitle.innerText = 'No track playing';
      if (mArtist) mArtist.innerText = 'Cadence Music';
      if (mCover) mCover.src = defaultCover;

      if (fsTitle) fsTitle.innerText = 'No track playing';
      if (fsArtist) fsArtist.innerText = 'Cadence Music';
      if (fsAlbum) fsAlbum.innerText = 'Ready to stream';
      if (fsCover) fsCover.src = defaultCover;
      return;
    }

    if (titleEl) titleEl.innerText = track.title;
    if (artistEl) artistEl.innerText = track.artist;
    if (coverEl) coverEl.src = track.cover;
    if (totalTimeEl) totalTimeEl.innerText = track.duration;
    this.updateDownloadButtonState(track);

    // Mini Floating Window: Song Cover View
    if (floatCover) floatCover.src = track.cover;
    if (floatTitle) floatTitle.innerText = track.title;
    if (floatArtist) floatArtist.innerText = track.artist;

    // If currently in video mode, keep YouTube iframe synced to current track
    if (window.audioPlayer && window.audioPlayer.mode === 'video') {
      const vid = track.musicVideoId || track.ytId;
      if (vid) {
        window.audioPlayer.switchVideoPreservingTime(vid, isPlaying);
      }
    }

    // Vinyl Platter & Deck Transport Sync
    if (vinylArt) vinylArt.src = track.cover;
    if (vinylTitle) vinylTitle.innerText = track.title;
    if (vinylArtist) vinylArtist.innerText = track.artist;
    if (deckTitle) deckTitle.innerText = track.title;
    if (deckArtist) deckArtist.innerText = `${track.artist} • ${track.album || 'Cadence Direct'}`;
    if (deckTotalTime) deckTotalTime.innerText = track.duration;

    // Mobile Mini-Player Sync
    if (mCover) mCover.src = track.cover;
    if (mTitle) mTitle.innerText = track.title;
    if (mArtist) mArtist.innerText = track.artist;

    // Fullscreen and Cinema state sync
    const fsAmbient = document.getElementById('fs-ambient-bg');
    const cinemaTitle = document.getElementById('cinema-title');
    const cinemaArtist = document.getElementById('cinema-artist');
    const fsTotalTime = document.getElementById('fs-time-duration');
    const cinemaTotalTime = document.getElementById('cinema-time-duration');

    if (fsTitle) fsTitle.innerText = track.title;
    if (fsArtist) fsArtist.innerText = track.artist;
    if (fsAlbum) fsAlbum.innerText = track.album;
    if (fsCover) fsCover.src = track.cover;
    if (fsAmbient) fsAmbient.style.backgroundImage = `url('${track.cover}')`;
    if (cinemaTitle) cinemaTitle.innerText = track.title;
    if (cinemaArtist) cinemaArtist.innerText = track.artist;
    if (fsTotalTime) fsTotalTime.innerText = track.duration;
    if (cinemaTotalTime) cinemaTotalTime.innerText = track.duration;

    if (likeBtn) {
      const isLiked = this.likedTrackIds.has(track.id);
      likeBtn.classList.toggle('text-ytm-red', isLiked);
      likeBtn.classList.toggle('text-ytm-muted', !isLiked);
      const fsLike = document.getElementById('fs-btn-like');
      if (fsLike) {
        fsLike.classList.toggle('text-ytm-red', isLiked);
        fsLike.classList.toggle('text-zinc-400', !isLiked);
      }
    }

    if (dislikeBtn) {
      const isDisliked = this.dislikedTrackIds.has(track.id);
      dislikeBtn.classList.toggle('text-ytm-red', isDisliked);
      dislikeBtn.classList.toggle('text-ytm-muted', !isDisliked);
    }

    this.updatePlayPauseUI(isPlaying);
    this.updateLyricsContent(track);
  }

  updatePlayPauseUI(isPlaying) {
    const playPauseIcon = document.getElementById('play-pause-icon');
    const fsPlayIcon = document.getElementById('fs-play-icon');
    const cinemaPlayIcon = document.getElementById('cinema-play-icon');
    const coverPlayIcon = document.getElementById('floating-cover-play-icon');
    const mobilePlayIcon = document.getElementById('mobile-play-icon');
    const equalizer = document.getElementById('equalizer');

    // Vinyl Deck Platter & Articulated Tonearm Sync
    const vinylDisc = document.getElementById('vinyl-disc');
    const tonearm = document.getElementById('tonearm');
    const deckPlayIcon = document.getElementById('deck-play-icon');
    const deckPlayText = document.getElementById('deck-play-text');
    const vinylCenterIcon = document.getElementById('vinyl-center-play-icon');

    if (vinylDisc) {
      vinylDisc.classList.toggle('spin-paused', !isPlaying);
    }
    if (tonearm) {
      if (!isPlaying) {
        tonearm.classList.add('tonearm-resting');
        tonearm.style.transform = 'rotate(-10deg)';
      } else {
        tonearm.classList.remove('tonearm-resting');
        const cur = this.currentSec || 0;
        const dur = (this.currentTrack && this.currentTrack.durationSec > 0) ? this.currentTrack.durationSec : (this.durationSec || 200);
        const ratio = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0;
        const angle = 0 + (ratio * 12);
        tonearm.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }
    }
    if (deckPlayIcon) {
      deckPlayIcon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    }
    if (deckPlayText) {
      deckPlayText.innerText = isPlaying ? 'Pause' : 'Play';
    }
    if (vinylCenterIcon) {
      vinylCenterIcon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    }

    [playPauseIcon, fsPlayIcon, cinemaPlayIcon, coverPlayIcon, mobilePlayIcon].forEach(icon => {
      if (icon) {
        if (isPlaying) {
          icon.setAttribute('data-lucide', 'pause');
          icon.classList.remove('translate-x-0.5');
        } else {
          icon.setAttribute('data-lucide', 'play');
          icon.classList.add('translate-x-0.5');
        }
      }
    });

    if (window.lucide) window.lucide.createIcons();

    if (equalizer) {
      equalizer.style.opacity = isPlaying ? '1' : '0.2';
    }
  }

  updateProgressUI(currentTime, duration) {
    if (this.isScrubbing) return;
    const progressSlider = document.getElementById('player-progress');
    const fsProgress = document.getElementById('fs-progress');
    const cinemaProgress = document.getElementById('cinema-progress');
    const timeCurrent = document.getElementById('time-current');
    const fsTimeCurrent = document.getElementById('fs-time-current');
    const cinemaTimeCurrent = document.getElementById('cinema-time-current');
    const timeDuration = document.getElementById('time-duration');
    const fsTimeDuration = document.getElementById('fs-time-duration');
    const cinemaTimeDuration = document.getElementById('cinema-time-duration');

    const formattedCur = this.formatSeconds(currentTime);
    if (timeCurrent) timeCurrent.innerText = formattedCur;
    if (fsTimeCurrent) fsTimeCurrent.innerText = formattedCur;
    if (cinemaTimeCurrent) cinemaTimeCurrent.innerText = formattedCur;

    // Deck Scrubber & Timestamps
    const deckElapsed = document.getElementById('deck-elapsed-time');
    const deckTotal = document.getElementById('deck-total-time');
    const deckFill = document.getElementById('deck-progress-bar-fill');
    if (deckElapsed) deckElapsed.innerText = formattedCur;

    this.syncLyricsProgress(currentTime);
    this.currentSec = currentTime;
    this.durationSec = duration;

    // Realistic physical vinyl tonearm groove tracking across microgrooves
    const tonearm = document.getElementById('tonearm');
    if (tonearm) {
      const isPlaying = window.audioPlayer 
        ? (typeof window.audioPlayer.isPlaying === 'function' ? window.audioPlayer.isPlaying() : !!window.audioPlayer.isPlayingState) 
        : !!this.isPlayingState;
      if (!isPlaying) {
        tonearm.classList.add('tonearm-resting');
        tonearm.style.transform = 'rotate(-10deg)';
      } else {
        tonearm.classList.remove('tonearm-resting');
        const dur = (duration && duration > 0) 
          ? duration 
          : ((this.currentTrack && this.currentTrack.durationSec > 0) ? this.currentTrack.durationSec : 200);
        const ratio = dur > 0 ? Math.min(1, Math.max(0, currentTime / dur)) : 0;
        // Real LP geometry: 0deg (outer lead-in groove) to 12deg (inner run-out groove just outside label)
        const angle = 0 + (ratio * 12);
        tonearm.style.transform = `rotate(${angle.toFixed(2)}deg)`;
      }
    }

    if (duration > 0) {
      const formattedDur = this.formatSeconds(duration);
      if (timeDuration) timeDuration.innerText = formattedDur;
      if (fsTimeDuration) fsTimeDuration.innerText = formattedDur;
      if (cinemaTimeDuration) cinemaTimeDuration.innerText = formattedDur;
      if (deckTotal) deckTotal.innerText = formattedDur;

      const percent = Math.min(100, Math.max(0, (currentTime / duration) * 100));
      if (deckFill) deckFill.style.width = `${percent}%`;

      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-primary').trim() || '#8b5cf6';
      const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-secondary').trim() || '#d946ef';

      [progressSlider, fsProgress, cinemaProgress].forEach(slider => {
        if (slider) {
          slider.value = percent;
          slider.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${percent}%, #27272a ${percent}%, #27272a 100%)`;
        }
      });
      const mobileMiniProgress = document.getElementById('mobile-mini-progress');
      if (mobileMiniProgress) {
        mobileMiniProgress.style.width = `${percent}%`;
        mobileMiniProgress.style.background = `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`;
      }
    }
  }

  /* ---------------------------------------------------- */
  /* COLOR THEME ENGINE & ACCOUNT SETTINGS                */
  /* ---------------------------------------------------- */
  initTheme() {
    const savedTheme = (localStorage.getItem('cadence_theme') || localStorage.getItem('aura_theme')) || 'violet';
    this.setTheme(savedTheme, false);
  }

  setTheme(themeName, notify = true) {
    const validThemes = ['violet', 'emerald', 'amber', 'crimson', 'cyan'];
    if (!validThemes.includes(themeName)) {
      themeName = 'violet';
    }
    this.currentTheme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('cadence_theme', themeName);

    // Update active state in theme cards inside settings modal
    document.querySelectorAll('#theme-selection-grid .theme-card').forEach(card => {
      const cardTheme = card.getAttribute('data-theme-card');
      if (cardTheme === themeName) {
        card.classList.add('border-violet-500', 'bg-zinc-800/90', 'ring-1', 'ring-violet-500/40', 'active');
      } else {
        card.classList.remove('border-violet-500', 'bg-zinc-800/90', 'ring-1', 'ring-violet-500/40', 'active');
      }
    });

    const badge = document.getElementById('current-theme-badge');
    if (badge) {
      const themeLabels = {
        violet: 'Neon Violet',
        emerald: 'Matrix Emerald',
        amber: 'Solar Amber',
        crimson: 'Phantom Crimson',
        cyan: 'Electric Cyan'
      };
      badge.innerText = themeLabels[themeName] || themeName;
    }

    // Refresh range sliders with active theme accent colors
    this.refreshSliderAccents();

    // Re-sync turntable RPM buttons styling
    this.setTurntableRpm(this.turntableRpm || 33);
  }

  refreshSliderAccents() {
    const progressSlider = document.getElementById('player-progress');
    const fsProgress = document.getElementById('fs-progress');
    const cinemaProgress = document.getElementById('cinema-progress');
    const volumeSlider = document.getElementById('volume-slider');
    const fsVolume = document.getElementById('fs-volume');

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-primary').trim() || '#8b5cf6';
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent-secondary').trim() || '#d946ef';

    [progressSlider, fsProgress, cinemaProgress].forEach(slider => {
      if (slider) {
        const val = slider.value || 0;
        slider.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${val}%, #27272a ${val}%, #27272a 100%)`;
      }
    });

    [volumeSlider, fsVolume].forEach(slider => {
      if (slider) {
        const val = slider.value || 80;
        slider.style.background = `linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} ${val}%, #3a3a3a ${val}%, #3a3a3a 100%)`;
      }
    });
  }

  openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
      // Ensure current theme card has active class
      if (this.currentTheme) {
        this.setTheme(this.currentTheme, false);
      }
    }
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /* ---------------------------------------------------- */
  /* PLAYLIST & MUSIC TASTE IMPORT ENGINE                 */
  /* ---------------------------------------------------- */
  openImportModal() {
    const modal = document.getElementById('import-playlist-modal');
    if (modal) {
      modal.classList.remove('hidden');
      this.setImportTab('url');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  setImportTab(tab) {
    this.currentImportTab = tab;
    const tabUrl = document.getElementById('import-tab-url');
    const tabText = document.getElementById('import-tab-text');
    const tabTaste = document.getElementById('import-tab-taste');

    const secUrl = document.getElementById('import-section-url');
    const secText = document.getElementById('import-section-text');
    const secTaste = document.getElementById('import-section-taste');

    [tabUrl, tabText, tabTaste].forEach(t => {
      if (t) {
        t.classList.remove('bg-zinc-800', 'text-white', 'shadow');
        t.classList.add('text-zinc-400');
      }
    });

    [secUrl, secText, secTaste].forEach(s => {
      if (s) s.classList.add('hidden');
    });

    if (tab === 'url') {
      if (tabUrl) { tabUrl.classList.add('bg-zinc-800', 'text-white', 'shadow'); tabUrl.classList.remove('text-zinc-400'); }
      if (secUrl) secUrl.classList.remove('hidden');
    } else if (tab === 'text') {
      if (tabText) { tabText.classList.add('bg-zinc-800', 'text-white', 'shadow'); tabText.classList.remove('text-zinc-400'); }
      if (secText) secText.classList.remove('hidden');
    } else if (tab === 'taste') {
      if (tabTaste) { tabTaste.classList.add('bg-zinc-800', 'text-white', 'shadow'); tabTaste.classList.remove('text-zinc-400'); }
      if (secTaste) secTaste.classList.remove('hidden');
    }
  }

  async submitImportPlaylist() {
    const btn = document.getElementById('btn-submit-import');
    const statusMsg = document.getElementById('import-status-msg');
    const originalText = btn ? btn.innerHTML : 'Import to Cadence';

    let payload = { type: this.currentImportTab || 'url' };

    if (payload.type === 'url') {
      const urlInput = document.getElementById('import-url-input');
      const nameInput = document.getElementById('import-name-input');
      payload.url = urlInput ? urlInput.value.trim() : '';
      payload.name = nameInput ? nameInput.value.trim() : '';
      if (!payload.url) {
        alert('Please paste a Spotify, Apple Music, or YouTube playlist URL.');
        return;
      }
    } else if (payload.type === 'text') {
      const textInput = document.getElementById('import-text-input');
      payload.text = textInput ? textInput.value.trim() : '';
      if (!payload.text) {
        alert('Please paste at least one song name.');
        return;
      }
    } else if (payload.type === 'taste') {
      const activeChips = Array.from(document.querySelectorAll('#taste-chips-grid .theme-accent-pill')).map(b => b.innerText.replace(/^[^\w]+/, '').trim());
      payload.genres = activeChips.length > 0 ? activeChips : ['Synthwave', 'R&B', 'Pop'];
      payload.name = `${payload.genres[0]} Mix`;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-1">⏳</span> Importing...`;
    }
    if (statusMsg) {
      statusMsg.className = 'text-xs font-mono-code p-2.5 rounded-xl border border-violet-500/40 bg-violet-600/10 text-violet-300';
      statusMsg.innerText = 'Connecting to catalog and resolving tracks...';
      statusMsg.classList.remove('hidden');
    }

    try {
      const res = await fetch(`${this.apiBaseUrl}/api/import_playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.tracks && data.tracks.length > 0) {
          const newPl = {
            id: 'imported_' + Date.now(),
            name: data.name || 'Imported Playlist',
            tracks: data.tracks,
            cover: data.tracks[0].cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'
          };
          this.userPlaylists.unshift(newPl);
          try {
            localStorage.setItem('cadence_user_playlists', JSON.stringify(this.userPlaylists));
          } catch (e) {}

          this.renderSidebarPlaylists();

          if (statusMsg) {
            statusMsg.className = 'text-xs font-mono-code p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-600/10 text-emerald-400';
            statusMsg.innerText = `✓ Successfully imported "${newPl.name}" (${newPl.tracks.length} tracks)!`;
          }

          setTimeout(() => {
            this.closeModal('import-playlist-modal');
            this.playUserPlaylist(0);
          }, 1200);
          return;
        } else {
          throw new Error('No tracks found or matched');
        }
      } else {
        throw new Error('Import request failed');
      }
    } catch (err) {
      if (statusMsg) {
        statusMsg.className = 'text-xs font-mono-code p-2.5 rounded-xl border border-red-500/40 bg-red-600/10 text-red-400';
        statusMsg.innerText = `Notice: ${err.message || 'Could not resolve songs. Check the link or paste track titles directly.'}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  playUserPlaylist(index) {
    const pl = this.userPlaylists[index];
    if (!pl || !pl.tracks || pl.tracks.length === 0) return;
    this.queue = [...pl.tracks];
    this.currentTrackIndex = 0;
    this.playLiveTrack(this.queue[0], true);
    this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
  }

  setTurntableRpm(rpm) {
    this.turntableRpm = rpm;
    const disc = document.getElementById('vinyl-disc');
    const btn33 = document.getElementById('rpm-33-btn');
    const btn45 = document.getElementById('rpm-45-btn');
    const footerBtn33 = document.getElementById('footer-rpm-33-btn');
    const footerBtn45 = document.getElementById('footer-rpm-45-btn');
    const labelRpm = document.getElementById('vinyl-label-rpm');

    if (disc) {
      disc.classList.toggle('spinning-33', rpm === 33);
      disc.classList.toggle('spinning-45', rpm === 45);
    }
    if (btn33) {
      btn33.className = rpm === 33
        ? 'px-2.5 py-1 rounded-lg theme-btn-active font-bold transition-all shadow-sm'
        : 'px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all';
    }
    if (btn45) {
      btn45.className = rpm === 45
        ? 'px-2.5 py-1 rounded-lg theme-btn-active font-bold transition-all shadow-sm'
        : 'px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition-all';
    }
    if (footerBtn33) {
      footerBtn33.className = rpm === 33
        ? 'px-2 py-0.5 rounded-lg font-bold text-white theme-btn-active transition-colors'
        : 'px-2 py-0.5 rounded-lg text-zinc-500 hover:text-white transition-colors';
    }
    if (footerBtn45) {
      footerBtn45.className = rpm === 45
        ? 'px-2 py-0.5 rounded-lg font-bold text-white theme-btn-active transition-colors'
        : 'px-2 py-0.5 rounded-lg text-zinc-500 hover:text-white transition-colors';
    }
    if (labelRpm) {
      labelRpm.innerText = rpm === 33 ? '33⅓ RPM • STEREO' : '45 RPM • HIGH-FIDELITY';
    }
  }

  selectVinylMood(el, moodCategory) {
    document.querySelectorAll('.vinyl-mood-node').forEach(n => {
      n.classList.remove('active');
      n.className = 'vinyl-mood-node p-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800 cursor-pointer transition-all flex items-center justify-between group';
      const bpm = n.querySelector('.mood-bpm');
      if (bpm) {
        bpm.className = 'text-[11px] font-mono-code text-zinc-500 mood-bpm';
      }
    });

    if (el) {
      el.className = 'vinyl-mood-node active p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between group';
      const bpm = el.querySelector('.mood-bpm');
      if (bpm) {
        bpm.className = 'text-[11px] font-mono-code font-bold mood-bpm';
      }
    }

    this.filterByMood(moodCategory);
  }

  formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  toggleLike(trackId, trackObj = null) {
    const isLiked = this.likedTrackIds.has(trackId);
    if (isLiked) {
      this.likedTrackIds.delete(trackId);
      this.likedSongsList = this.likedSongsList.filter(t => t.id !== trackId && t.ytId !== trackId);
    } else {
      this.likedTrackIds.add(trackId);
      this.dislikedTrackIds.delete(trackId);

      let track = trackObj;
      if (!track && this.currentTrack && (this.currentTrack.id === trackId || this.currentTrack.ytId === trackId)) {
        track = this.currentTrack;
      }
      if (!track && window.YTM_DATA && Array.isArray(YTM_DATA.tracks)) {
        track = YTM_DATA.tracks.find(t => t.id === trackId || t.ytId === trackId);
      }
      if (!track && this.queue) {
        track = this.queue.find(t => t.id === trackId || t.ytId === trackId);
      }

      if (track) {
        const exists = this.likedSongsList.some(t => (t.id && t.id === track.id) || (t.ytId && t.ytId === track.ytId));
        if (!exists) {
          this.likedSongsList.unshift(track);
        }
      }
    }

    try {
      localStorage.setItem('cadence_liked_songs', JSON.stringify(this.likedSongsList));
      localStorage.setItem('cadence_liked_track_ids', JSON.stringify([...this.likedTrackIds]));
    } catch (e) {}

    this.updatePlayerBar(this.currentTrack, window.audioPlayer ? window.audioPlayer.isPlayingState : false);
    this.renderQuickPicks();
    this.renderSidebarPlaylists();
    this.renderLibrary();
    this.pushCloudSyncData();
    if (this.currentView === 'playlist' && this.currentPlaylistData) {
      if (this.currentPlaylistData.id === 'default-liked') {
        this.openDefaultPlaylist('liked');
      } else {
        this.renderPlaylistViewContent(this.currentPlaylistData);
      }
    }
  }

  toggleDislike(trackId) {
    if (this.dislikedTrackIds.has(trackId)) {
      this.dislikedTrackIds.delete(trackId);
    } else {
      this.dislikedTrackIds.add(trackId);
      this.likedTrackIds.delete(trackId);
    }
    this.updatePlayerBar(this.currentTrack, window.audioPlayer ? window.audioPlayer.isPlayingState : false);
  }

  // --- DRAWERS & MODALS ---

  _applyDrawerStates() {
    const queueDrawer = document.getElementById('queue-drawer');
    const lyricsDrawer = document.getElementById('lyrics-drawer');
    const panel = document.getElementById('video-panel');
    const toggleQueueBtn = document.getElementById('toggle-queue-btn');
    const toggleLyricsBtn = document.getElementById('toggle-lyrics-btn');
    const appBody = document.getElementById('app-body-container');
    const mainContent = document.getElementById('main-content');

    // Queue Drawer
    if (queueDrawer) {
      if (this.isQueueOpen) {
        queueDrawer.classList.remove('translate-x-full', 'invisible', 'pointer-events-none');
        queueDrawer.classList.add('drawer-open');
      } else {
        queueDrawer.classList.add('translate-x-full', 'invisible', 'pointer-events-none');
        queueDrawer.classList.remove('drawer-open');
      }
    }

    // Lyrics Drawer
    if (lyricsDrawer) {
      if (this.isLyricsOpen) {
        lyricsDrawer.classList.remove('translate-x-full', 'invisible', 'pointer-events-none');
        lyricsDrawer.classList.add('drawer-open');
      } else {
        lyricsDrawer.classList.add('translate-x-full', 'invisible', 'pointer-events-none');
        lyricsDrawer.classList.remove('drawer-open');
      }
    }

    // Auto-shift floating cover/video window to the left if not manually dragged by user
    if (panel) {
      const anyDrawerOpen = this.isQueueOpen || this.isLyricsOpen;
      if (anyDrawerOpen && !panel.classList.contains('user-dragged')) {
        panel.classList.add('shifted-left');
      } else {
        panel.classList.remove('shifted-left');
      }
    }

    // Active button indicators in bottom player bar
    if (toggleQueueBtn) {
      toggleQueueBtn.classList.toggle('text-ytm-red', !!this.isQueueOpen);
    }
    if (toggleLyricsBtn) {
      toggleLyricsBtn.classList.toggle('text-ytm-red', !!this.isLyricsOpen);
    }

    // Hard reset any accidental horizontal container scroll
    if (appBody) appBody.scrollLeft = 0;
    if (mainContent) mainContent.scrollLeft = 0;
    window.scrollTo({ left: 0 });
  }

  toggleQueue(force) {
    const targetState = typeof force === 'boolean' ? force : !this.isQueueOpen;
    this.isQueueOpen = targetState;
    if (this.isQueueOpen) {
      this.isLyricsOpen = false;
    }
    this._applyDrawerStates();
  }

  toggleLyrics(force) {
    const targetState = typeof force === 'boolean' ? force : !this.isLyricsOpen;
    this.isLyricsOpen = targetState;
    if (this.isLyricsOpen) {
      this.isQueueOpen = false;
    }
    this._applyDrawerStates();
  }

  toggleMiniPanelVisibility() {
    const panel = document.getElementById('video-panel');
    if (panel) {
      if (panel.classList.contains('video-hidden')) {
        panel.classList.remove('video-hidden');
        panel.classList.add('video-active');
      } else {
        panel.classList.remove('video-active');
        panel.classList.add('video-hidden');
      }
    }
  }

  toggleQualityMenu(target = 'mini') {
    const miniDropdown = document.getElementById('quality-menu-dropdown');
    const cinemaDropdown = document.getElementById('cinema-quality-dropdown');
    if (target === 'cinema') {
      if (cinemaDropdown) cinemaDropdown.classList.toggle('hidden');
      if (miniDropdown) miniDropdown.classList.add('hidden');
    } else {
      if (miniDropdown) miniDropdown.classList.toggle('hidden');
      if (cinemaDropdown) cinemaDropdown.classList.add('hidden');
    }
  }

  changeQuality(quality) {
    if (window.audioPlayer) {
      window.audioPlayer.setPlaybackQuality(quality);
    }
    this.updateQualityUI(quality);
    const drop1 = document.getElementById('quality-menu-dropdown');
    const drop2 = document.getElementById('cinema-quality-dropdown');
    if (drop1) drop1.classList.add('hidden');
    if (drop2) drop2.classList.add('hidden');
  }

  updateQualityUI(quality) {
    const qualityMap = {
      'highres': '4K',
      'hd1440': '1440p',
      'hd1080': '1080p HD',
      'hd720': '720p HD',
      'large': '480p',
      'medium': '360p',
      'small': '240p',
      'tiny': '144p',
      'auto': 'Auto',
      'default': 'Auto'
    };
    const labelText = qualityMap[quality] || (quality ? quality.toUpperCase() : 'Auto');
    const miniBadge = document.getElementById('quality-badge-label');
    const cinemaBadge = document.getElementById('cinema-quality-label');
    if (miniBadge) miniBadge.innerText = labelText;
    if (cinemaBadge) cinemaBadge.innerText = labelText;

    document.querySelectorAll('.quality-check').forEach(el => {
      if (el.getAttribute('data-q') === quality) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  updateModeUI(mode = 'song') {
    this.currentMediaMode = mode;
    const isVideo = mode === 'video';

    // 1. Footer dual-pill buttons
    const songPill = document.getElementById('toggle-song-btn');
    const videoPill = document.getElementById('toggle-video-btn');
    const label = document.getElementById('video-mode-label');

    if (songPill && videoPill) {
      if (isVideo) {
        songPill.className = 'px-3 py-1 rounded-full text-zinc-400 hover:text-white transition-all flex items-center gap-1.5';
        videoPill.className = 'px-3 py-1 rounded-full font-bold text-white bg-violet-600/50 border border-violet-500/50 transition-all flex items-center gap-1.5 shadow-sm';
      } else {
        songPill.className = 'px-3 py-1 rounded-full font-bold text-white bg-white/20 border border-white/20 transition-all flex items-center gap-1.5 shadow-sm';
        videoPill.className = 'px-3 py-1 rounded-full text-zinc-400 hover:text-white transition-all flex items-center gap-1.5';
      }
    } else if (videoPill && label) {
      if (isVideo) {
        label.textContent = 'Song';
        videoPill.innerHTML = '<i data-lucide="disc" class="w-3.5 h-3.5 text-emerald-400"></i><span id="video-mode-label">Song</span>';
        videoPill.classList.add('border-emerald-500/40', 'bg-emerald-950/30', 'text-emerald-300');
        videoPill.classList.remove('border-zinc-800', 'text-zinc-300');
      } else {
        label.textContent = 'Video';
        videoPill.innerHTML = '<i data-lucide="tv" class="w-3.5 h-3.5 text-violet-400"></i><span id="video-mode-label">Video</span>';
        videoPill.classList.remove('border-emerald-500/40', 'bg-emerald-950/30', 'text-emerald-300');
        videoPill.classList.add('border-zinc-800', 'text-zinc-300');
      }
    }

    // 2. Fullscreen modal mode buttons
    const fsSongBtn = document.getElementById('fs-mode-song-btn');
    const fsVideoBtn = document.getElementById('fs-mode-video-btn');
    if (fsSongBtn && fsVideoBtn) {
      if (isVideo) {
        fsSongBtn.className = 'px-4 py-1 rounded-full text-xs font-bold transition-all text-zinc-400 hover:text-white';
        fsVideoBtn.className = 'px-4 py-1 rounded-full text-xs font-bold transition-all text-white bg-violet-600/50 shadow';
      } else {
        fsSongBtn.className = 'px-4 py-1 rounded-full text-xs font-bold transition-all text-white bg-white/20 shadow';
        fsVideoBtn.className = 'px-4 py-1 rounded-full text-xs font-bold transition-all text-zinc-400 hover:text-white';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  async setMediaMode(mode = 'song') {
    this.currentMediaMode = mode;
    const isVideo = mode === 'video';
    const panel = document.getElementById('video-panel');
    const fsOverlay = document.getElementById('fullscreen-overlay');

    if (isVideo) {
      this.isVideoPanelOpen = true;
      if (panel) {
        panel.classList.remove('video-hidden', 'hidden', 'song-card-mode');
        panel.classList.add('video-active', 'video-card-mode');
        if (this.isFullscreen) {
          panel.classList.add('fullscreen-video-mode');
        }
      }
      if (this.isFullscreen && fsOverlay) {
        fsOverlay.classList.remove('fs-open');
        fsOverlay.classList.add('fs-closed');
      }

      let vid = this.currentTrack ? (this.currentTrack.musicVideoId || this.currentTrack.ytId) : null;
      if (this.currentTrack && !this.currentTrack.musicVideoId && this.isBackendOnline) {
        try {
          const res = await fetch(`${this.apiBaseUrl}/api/get_music_video?title=${encodeURIComponent(this.currentTrack.title)}&artist=${encodeURIComponent(this.currentTrack.artist)}&fallbackId=${this.currentTrack.ytId || ''}`);
          if (res.ok) {
            const data = await res.json();
            if (data.videoId) {
              this.currentTrack.musicVideoId = data.videoId;
              vid = data.videoId;
            }
          }
        } catch (e) {
          console.warn('[Cadence Video] Error resolving music video:', e);
        }
      }

      if (window.audioPlayer) {
        if (window.audioPlayer.mode !== 'video') {
          window.audioPlayer.switchVideoPreservingTime(vid, true);
        } else {
          window.audioPlayer.play();
        }
      }

      this.updateModeUI('video');
      this.showToast('Switched to Video mode', 'tv', 'text-violet-400');
    } else {
      // Switch back to Song mode
      this.isVideoPanelOpen = false;
      if (panel) {
        panel.classList.remove('video-card-mode', 'fullscreen-video-mode');
        panel.classList.add('song-card-mode');
        if (!this.userClosedFloatingPanel) {
          panel.classList.remove('video-hidden', 'hidden');
          panel.classList.add('video-active');
        }
      }

      if (this.isFullscreen) {
        this.fullscreenMode = 'song';
        if (fsOverlay) {
          fsOverlay.classList.remove('fs-closed');
          fsOverlay.classList.add('fs-open');
        }
        this.syncFullscreenUI();
      }

      if (window.audioPlayer && window.audioPlayer.mode === 'video') {
        window.audioPlayer.switchToSongPreservingTime();
      }

      this.updateModeUI('song');
      this.showToast('Switched to Song mode', 'disc', 'text-emerald-400');
    }
  }

  showFloatingPanel(mode = 'song') {
    const panel = document.getElementById('video-panel');
    if (!panel) return;
    panel.classList.remove('video-hidden', 'hidden');
    panel.classList.add('video-active');
    this.userClosedFloatingPanel = false;
    this.setMediaMode(mode);
  }

  async setFloatingPanelMode(mode = 'song') {
    return this.setMediaMode(mode);
  }

  closeFloatingPanel() {
    this.isVideoPanelOpen = false;
    const panel = document.getElementById('video-panel');
    if (panel) {
      panel.classList.remove('video-active', 'video-card-mode', 'song-card-mode', 'fullscreen-video-mode');
      panel.classList.add('video-hidden', 'hidden');
    }
    this.userClosedFloatingPanel = true;
    if (this.isFullscreen && this.fullscreenMode === 'video') {
      this.toggleFullscreen();
    }
  }

  async openCoverPopup() {
    await this.setMediaMode('song');
  }

  async openVideoPopup() {
    await this.setMediaMode('video');
  }

  async toggleVideoMode() {
    const isVideo = this.currentMediaMode === 'video' || (window.audioPlayer && window.audioPlayer.mode === 'video');
    await this.setMediaMode(isVideo ? 'song' : 'video');
  }

  async toggleVideoPanel() {
    await this.toggleVideoMode();
  }

  initDraggablePanel() {
    const panel = document.getElementById('video-panel');
    if (!panel) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    const onMouseDown = (e) => {
      // Don't drag if clicking buttons, inputs, links, sliders
      if (e.target.closest('button, input, select, a, .video-click-catcher')) return;
      if (e.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
      hasMoved = false;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!hasMoved && Math.hypot(dx, dy) > 4) {
          hasMoved = true;
          panel.classList.add('user-dragged');
          panel.classList.remove('shifted-left');
          panel.style.transition = 'none';
        }

        if (hasMoved) {
          let newLeft = initialLeft + dx;
          let newTop = initialTop + dy;
          const maxLeft = window.innerWidth - panel.offsetWidth - 10;
          const maxTop = window.innerHeight - panel.offsetHeight - 80;
          panel.style.left = `${Math.max(10, Math.min(maxLeft, newLeft))}px`;
          panel.style.top = `${Math.max(10, Math.min(maxTop, newTop))}px`;
          panel.style.right = 'auto';
        }
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          panel.style.transition = '';
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    panel.addEventListener('mousedown', onMouseDown);
  }

  // --- FULL SCREEN (SONG & VIDEO MODES) ---

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    const fsOverlay = document.getElementById('fullscreen-overlay');
    const videoPanel = document.getElementById('video-panel');

    const isVideo = (window.audioPlayer && window.audioPlayer.mode === 'video') ||
                    (videoPanel && videoPanel.classList.contains('video-card-mode') && !videoPanel.classList.contains('hidden'));

    if (this.isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      if (isVideo) {
        // Video Fullscreen Cinema Mode
        this.fullscreenMode = 'video';
        this.isVideoPanelOpen = true;
        if (videoPanel) {
          videoPanel.classList.remove('video-hidden', 'hidden');
          videoPanel.classList.add('video-active', 'video-card-mode', 'fullscreen-video-mode');
        }
        if (fsOverlay) {
          fsOverlay.classList.remove('fs-open');
          fsOverlay.classList.add('fs-closed');
        }
      } else {
        // Song Fullscreen (Apple Music style ambient dynamic blur & lyrics)
        this.fullscreenMode = 'song';
        if (fsOverlay) {
          fsOverlay.classList.remove('fs-closed');
          fsOverlay.classList.add('fs-open');
        }
        if (videoPanel) {
          videoPanel.classList.remove('fullscreen-video-mode');
        }
      }
      this.syncFullscreenUI();
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (fsOverlay) {
        fsOverlay.classList.remove('fs-open');
        fsOverlay.classList.add('fs-closed');
      }
      if (videoPanel) {
        videoPanel.classList.remove('fullscreen-video-mode');
      }
    }
  }

  async setFullscreenMode(mode) {
    this.fullscreenMode = mode;
    this.isFullscreen = true;
    await this.setMediaMode(mode);
  }

  syncFullscreenUI() {
    const fsTitle = document.getElementById('fs-title');
    const fsArtist = document.getElementById('fs-artist');
    const fsAlbum = document.getElementById('fs-album');
    const fsCover = document.getElementById('fs-cover');
    const fsAmbient = document.getElementById('fs-ambient-bg');
    const cinemaTitle = document.getElementById('cinema-title');
    const cinemaArtist = document.getElementById('cinema-artist');

    if (this.currentTrack) {
      if (fsTitle) fsTitle.innerText = this.currentTrack.title;
      if (fsArtist) fsArtist.innerText = this.currentTrack.artist;
      if (fsAlbum) fsAlbum.innerText = this.currentTrack.album;
      if (fsCover) fsCover.src = this.currentTrack.cover;
      if (fsAmbient) fsAmbient.style.backgroundImage = `url('${this.currentTrack.cover}')`;
      if (cinemaTitle) cinemaTitle.innerText = this.currentTrack.title;
      if (cinemaArtist) cinemaArtist.innerText = this.currentTrack.artist;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  updateLyricsContent(track) {
    if (!track) return;
    this.currentLyrics = [];
    this.rawLyricsText = null;
    this.translatedLyricsText = null;
    this.isLyricsTranslated = false;
    this.activeLyricIndex = -1;

    const btnLabel = document.getElementById('translate-btn-label');
    const fsBtnLabel = document.getElementById('fs-translate-btn-label');
    const btn = document.getElementById('btn-translate-lyrics');
    const fsBtn = document.getElementById('fs-btn-translate-lyrics');
    if (btnLabel) btnLabel.innerText = 'Translate';
    if (fsBtnLabel) fsBtnLabel.innerText = 'Translate';
    if (btn) btn.classList.remove('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');
    if (fsBtn) fsBtn.classList.remove('bg-indigo-900/60', 'border-indigo-500/60', 'text-white');

    const el = document.getElementById('lyrics-content');
    const fsBox = document.getElementById('fs-lyrics-box');
    if (el) {
      el.innerHTML = `
        <div class="text-sm font-black tracking-wider uppercase text-white mb-4 text-center select-none">${track.title}</div>
        <div class="py-12 flex flex-col items-center justify-center space-y-3 text-zinc-500">
          <i data-lucide="loader" class="w-6 h-6 animate-spin text-ytm-red"></i>
          <span class="text-xs">Fetching lyrics...</span>
        </div>
      `;
    }
    if (fsBox) {
      fsBox.innerHTML = `
        <div class="py-6 text-zinc-500 text-sm">Loading lyrics...</div>
      `;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  openAddTrackModal() {
    const modal = document.getElementById('custom-track-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const targetId = modalId.endsWith('-modal') ? modalId : `${modalId}-modal`;
    const modal = document.getElementById(targetId) || document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  openModal(modalId) {
    const targetId = modalId.endsWith('-modal') ? modalId : `${modalId}-modal`;
    const modal = document.getElementById(targetId) || document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    if (modal.id === 'equalizer-modal') {
      this.syncEqualizerUI();
    } else if (modal.id === 'sleep-timer-modal') {
      this.syncSleepTimerUI();
    } else if (modal.id === 'radio-tuner-modal') {
      this.updateTunerLabels();
    } else if (modal.id === 'taste-profile-modal') {
      this.syncTasteProfileUI();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------------------------------------------------- */
  /* PRO SUITE: EQUALIZER, SLEEP TIMER, TUNER, OFFLINE    */
  /* ---------------------------------------------------- */

  // --- EQUALIZER METHODS ---
  setEqPreset(presetKey) {
    if (window.audioPlayer && window.audioPlayer.equalizer) {
      window.audioPlayer.equalizer.applyPreset(presetKey);
    }
    this.syncEqualizerUI();
    this.showToast(`Equalizer: ${presetKey.replace('_', ' ').toUpperCase()}`, 'activity', 'text-emerald-400');
  }

  handleEqSlider(bandIndex, db) {
    const val = parseFloat(db) || 0;
    const label = document.getElementById(`eq-val-${bandIndex}`);
    if (label) label.textContent = `${val >= 0 ? '+' : ''}${val}dB`;
    if (window.audioPlayer && window.audioPlayer.equalizer) {
      window.audioPlayer.equalizer.setGain(bandIndex, val);
    }
  }

  toggleNormalization(enabled) {
    if (window.audioPlayer && window.audioPlayer.equalizer) {
      window.audioPlayer.equalizer.setNormalization(enabled);
      this.showToast(enabled ? 'Volume Leveler Active' : 'Volume Leveler Off', 'sliders-horizontal', 'text-emerald-400');
    }
  }

  resetEq() {
    if (window.audioPlayer && window.audioPlayer.equalizer) {
      window.audioPlayer.equalizer.reset();
    }
    this.syncEqualizerUI();
    this.showToast('Equalizer reset to Flat', 'rotate-ccw', 'text-zinc-400');
  }

  syncEqualizerUI() {
    const eq = window.audioPlayer?.equalizer;
    if (!eq) return;

    eq.frequencies.forEach((_, idx) => {
      const slider = document.getElementById(`eq-slider-${idx}`);
      const label = document.getElementById(`eq-val-${idx}`);
      const val = eq.gains[idx] || 0;
      if (slider) slider.value = val;
      if (label) label.textContent = `${val >= 0 ? '+' : ''}${val}dB`;
    });

    const container = document.getElementById('eq-presets-container');
    if (container) {
      container.querySelectorAll('button').forEach(btn => {
        const p = btn.getAttribute('data-eq-preset');
        if (p === eq.activePreset) {
          btn.className = 'px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        } else {
          btn.className = 'px-3 py-1 rounded-xl text-xs font-semibold bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800';
        }
      });
    }

    const norm = document.getElementById('eq-norm-toggle');
    if (norm) norm.checked = eq.normalizationEnabled;
  }

  // --- SLEEP TIMER METHODS ---
  setSleepTimer(minutesOrOption) {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }

    const badge = document.getElementById('sleep-timer-badge');
    const status = document.getElementById('sleep-timer-status');

    if (minutesOrOption === 'end_of_track') {
      this.sleepTimerMode = 'end_of_track';
      if (badge) {
        badge.classList.remove('hidden');
        badge.textContent = 'Track';
      }
      if (status) status.textContent = 'Active: Stops after current track';
      this.showToast('Sleep timer: Stop at end of track', 'moon', 'text-indigo-400');
      this.closeModal('sleep-timer-modal');
      return;
    }

    const mins = parseInt(minutesOrOption, 10);
    if (!mins || mins <= 0) return;

    this.sleepTimerMode = mins;
    this.sleepTimerRemainingSec = mins * 60;

    if (badge) {
      badge.classList.remove('hidden');
      badge.textContent = `${mins}m`;
    }
    if (status) status.textContent = `Active: ${mins} minutes remaining`;

    this.sleepTimerInterval = setInterval(() => {
      this.sleepTimerRemainingSec--;

      if (this.sleepTimerRemainingSec % 60 === 0) {
        const remMins = Math.ceil(this.sleepTimerRemainingSec / 60);
        if (badge) badge.textContent = `${remMins}m`;
        if (status) status.textContent = `Active: ${remMins} minutes remaining`;
      }

      // Smooth volume fade-out over last 15 seconds
      if (this.sleepTimerRemainingSec <= 15 && this.sleepTimerRemainingSec > 0) {
        if (window.audioPlayer && window.audioPlayer.audio) {
          const fadeRatio = this.sleepTimerRemainingSec / 15;
          window.audioPlayer.audio.volume = Math.max(0, (window.audioPlayer.volume / 100) * fadeRatio);
        }
      }

      if (this.sleepTimerRemainingSec <= 0) {
        clearInterval(this.sleepTimerInterval);
        this.sleepTimerInterval = null;
        if (window.audioPlayer) {
          window.audioPlayer.pause();
          if (window.audioPlayer.audio) {
            window.audioPlayer.audio.volume = window.audioPlayer.volume / 100;
          }
        }
        if (badge) badge.classList.add('hidden');
        if (status) status.textContent = 'Timer is currently inactive';
        this.showToast('Sleep timer finished: Playback paused', 'moon', 'text-indigo-400');
      }
    }, 1000);

    this.showToast(`Sleep timer set for ${mins} minutes`, 'moon', 'text-indigo-400');
    this.closeModal('sleep-timer-modal');
  }

  cancelSleepTimer() {
    if (this.sleepTimerInterval) {
      clearInterval(this.sleepTimerInterval);
      this.sleepTimerInterval = null;
    }
    this.sleepTimerMode = 'off';
    this.sleepTimerRemainingSec = 0;
    const badge = document.getElementById('sleep-timer-badge');
    const status = document.getElementById('sleep-timer-status');
    if (badge) badge.classList.add('hidden');
    if (status) status.textContent = 'Timer is currently inactive';
    if (window.audioPlayer && window.audioPlayer.audio) {
      window.audioPlayer.audio.volume = window.audioPlayer.volume / 100;
    }
    this.showToast('Sleep timer turned off', 'moon', 'text-zinc-400');
    this.closeModal('sleep-timer-modal');
  }

  setCustomSleepTimer() {
    const input = document.getElementById('custom-sleep-input');
    if (!input) return;
    const mins = parseInt(input.value, 10);
    if (!mins || isNaN(mins) || mins <= 0) {
      this.showToast('Please enter valid minutes (e.g. 20, 75, 120)', 'alert-circle', 'text-amber-400');
      return;
    }
    this.setSleepTimer(mins);
  }

  syncSleepTimerUI() {
    const status = document.getElementById('sleep-timer-status');
    if (!status) return;
    if (this.sleepTimerMode === 'end_of_track') {
      status.textContent = 'Active: Stops after current track';
    } else if (this.sleepTimerRemainingSec > 0) {
      const mins = Math.ceil(this.sleepTimerRemainingSec / 60);
      status.textContent = `Active: ${mins} minutes remaining`;
    } else {
      status.textContent = 'Timer is currently inactive';
    }
  }

  // --- RADIO TUNER METHODS ---
  updateTunerLabels() {
    const vSlider = document.getElementById('tuner-variety-slider');
    const sSlider = document.getElementById('tuner-selection-slider');
    const mSlider = document.getElementById('tuner-mood-slider');

    const vLabel = document.getElementById('tuner-variety-label');
    const sLabel = document.getElementById('tuner-selection-label');
    const mLabel = document.getElementById('tuner-mood-label');

    if (vSlider && vLabel) {
      const v = parseInt(vSlider.value, 10);
      vLabel.textContent = v === 1 ? 'Familiar Hits' : (v === 3 ? 'Discover New' : 'Balanced');
    }
    if (sSlider && sLabel) {
      const s = parseInt(sSlider.value, 10);
      sLabel.textContent = s === 1 ? 'Deep Cuts' : (s === 3 ? 'Top Hits' : 'Popular & Deep Mix');
    }
    if (mSlider && mLabel) {
      const m = parseInt(mSlider.value, 10);
      mLabel.textContent = m === 1 ? 'Chill & Relax' : (m === 3 ? 'High Energy & Upbeat' : 'All Vibes');
    }
  }

  async applyRadioTuner() {
    const vSlider = document.getElementById('tuner-variety-slider');
    const sSlider = document.getElementById('tuner-selection-slider');
    const mSlider = document.getElementById('tuner-mood-slider');

    const variety = vSlider ? parseInt(vSlider.value, 10) : 2;
    const selection = sSlider ? parseInt(sSlider.value, 10) : 2;
    const mood = mSlider ? parseInt(mSlider.value, 10) : 2;

    this.showToast('Tuning Automix queue...', 'sliders', 'text-violet-400');

    let pool = (window.YTM_DATA && Array.isArray(YTM_DATA.tracks)) ? [...YTM_DATA.tracks] : [];

    // Filter by mood
    if (mood === 1) {
      pool = pool.filter(t => ['relax', 'focus', 'commute'].includes(t.category) || (t.durationSec && t.durationSec > 200));
    } else if (mood === 3) {
      pool = pool.filter(t => ['energize', 'workout', 'party'].includes(t.category));
    }

    // Filter by selection / popularity
    if (selection === 1) {
      pool.reverse();
    } else if (selection === 3) {
      pool.sort((a, b) => (b.plays || '').localeCompare(a.plays || ''));
    } else {
      pool = pool.sort(() => Math.random() - 0.5);
    }

    if (pool.length > 0) {
      const cur = this.currentTrack || pool[0];
      const others = pool.filter(t => (t.id || t.ytId) !== (cur.id || cur.ytId));
      this.queue = [cur, ...others].slice(0, 20);
      this.currentTrackIndex = 0;
      this.renderQueue();
    if (this.currentView === 'playlist') this.updatePlaylistTrackActiveState();
    }

    const vText = variety === 1 ? 'Familiar' : (variety === 3 ? 'Discover' : 'Blend');
    const mText = mood === 1 ? 'Chill' : (mood === 3 ? 'Upbeat' : 'Standard');
    this.showToast(`Radio Tuned: ${mText} • ${vText}`, 'sparkles', 'text-violet-300');
    this.closeModal('radio-tuner-modal');
  }

  // --- OFFLINE INDEXEDDB DOWNLOAD METHODS ---
  async updateDownloadButtonState(track) {
    if (!track) return;
    const btn = document.getElementById('btn-player-download');
    const icon = document.getElementById('player-download-icon');
    if (!btn || !icon) return;

    const isDownloaded = window.OfflineStorage ? await window.OfflineStorage.isTrackDownloaded(track.id || track.ytId) : false;
    if (isDownloaded) {
      btn.className = 'p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors';
      btn.title = 'Downloaded for Offline (Click to remove)';
      icon.setAttribute('data-lucide', 'check-circle-2');
    } else {
      btn.className = 'p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors';
      btn.title = 'Download for Offline (D)';
      icon.setAttribute('data-lucide', 'download');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async toggleDownloadCurrentTrack() {
    if (!this.currentTrack) return;
    const track = this.currentTrack;
    const trackId = track.id || track.ytId;

    if (!window.OfflineStorage) {
      this.showToast('Offline storage not available', 'alert-circle', 'text-amber-400');
      return;
    }

    const isDownloaded = await window.OfflineStorage.isTrackDownloaded(trackId);
    if (isDownloaded) {
      await window.OfflineStorage.removeTrack(trackId);
      this.downloadedSongsList = this.downloadedSongsList.filter(t => (t.id || t.ytId) !== trackId);
      localStorage.setItem('cadence_downloaded_songs', JSON.stringify(this.downloadedSongsList));
      this.showToast(`Removed "${track.title}" from offline downloads`, 'trash-2', 'text-zinc-400');
      this.updateDownloadButtonState(track);
      this.renderSidebarPlaylists();
      if (this.currentView === 'library') this.renderLibrary();
      if (this.currentView === 'playlist' && this.currentPlaylistData && this.currentPlaylistData.id === 'default-downloaded') {
        this.openDefaultPlaylist('downloaded');
      }
      return;
    }

    this.showToast(`Downloading "${track.title}" for offline...`, 'loader-2', 'text-cyan-400');
    const streamVid = track.audioId || track.ytId || track.musicVideoId;
    const streamUrl = `${this.apiBaseUrl}/api/stream/${streamVid}`;

    try {
      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error('Stream fetch failed');
      const blob = await res.blob();
      await window.OfflineStorage.saveTrackAudio(track, blob);

      if (!this.downloadedSongsList.some(t => (t.id || t.ytId) === trackId)) {
        this.downloadedSongsList.unshift(track);
        localStorage.setItem('cadence_downloaded_songs', JSON.stringify(this.downloadedSongsList));
      }

      this.showToast(`"${track.title}" downloaded for offline!`, 'check-circle-2', 'text-emerald-400');
      this.updateDownloadButtonState(track);
      if (this.currentView === 'library') this.renderLibrary();
    } catch (err) {
      console.warn('Download error:', err);
      this.showToast('Download failed, stream unavailable', 'alert-triangle', 'text-rose-400');
    }
  }

  async downloadTrack(track) {
    if (!track) return;
    if (this.currentTrack && (this.currentTrack.id === track.id || this.currentTrack.ytId === track.ytId)) {
      await this.toggleDownloadCurrentTrack();
      return;
    }

    const trackId = track.id || track.ytId;
    if (!window.OfflineStorage) return;

    this.showToast(`Downloading "${track.title}"...`, 'loader-2', 'text-cyan-400');
    const streamVid = track.audioId || track.ytId || track.musicVideoId;
    const streamUrl = `${this.apiBaseUrl}/api/stream/${streamVid}`;

    try {
      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error('Stream fetch failed');
      const blob = await res.blob();
      await window.OfflineStorage.saveTrackAudio(track, blob);

      if (!this.downloadedSongsList.some(t => (t.id || t.ytId) === trackId)) {
        this.downloadedSongsList.unshift(track);
        localStorage.setItem('cadence_downloaded_songs', JSON.stringify(this.downloadedSongsList));
      }

      this.showToast(`"${track.title}" downloaded!`, 'check-circle-2', 'text-emerald-400');
      this.renderSidebarPlaylists();
      if (this.currentView === 'library') this.renderLibrary();
      if (this.currentView === 'playlist' && this.currentPlaylistData && this.currentPlaylistData.id === 'default-downloaded') {
        this.openDefaultPlaylist('downloaded');
      }
    } catch (err) {
      console.warn('Download error:', err);
      this.showToast('Download failed', 'alert-triangle', 'text-rose-400');
    }
  }

  // --- PICTURE-IN-PICTURE METHOD ---
  async togglePictureInPicture() {
    if (this.pipWindow) {
      try {
        this.pipWindow.close();
      } catch (e) {}
      this.pipWindow = null;
      return;
    }

    // 1. Chrome Document Picture-in-Picture API
    if ('documentPictureInPicture' in window) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({
          width: 440,
          height: 250
        });
        this.pipWindow = pipWin;

        [...document.styleSheets].forEach(styleSheet => {
          try {
            const cssRules = [...styleSheet.cssRules].map(r => r.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            pipWin.document.head.appendChild(link);
          }
        });

        const videoHolder = document.getElementById('youtube-iframe-holder');
        const originalParent = document.getElementById('main-video-wrapper');
        if (videoHolder && pipWin.document.body) {
          pipWin.document.body.style.margin = '0';
          pipWin.document.body.style.background = '#000';
          pipWin.document.body.style.display = 'flex';
          pipWin.document.body.style.alignItems = 'center';
          pipWin.document.body.style.justifyContent = 'center';
          pipWin.document.body.appendChild(videoHolder);
        }

        pipWin.addEventListener('pagehide', () => {
          if (videoHolder && originalParent) {
            originalParent.appendChild(videoHolder);
          }
          this.pipWindow = null;
          this.showToast('Exited Picture-in-Picture', 'picture-in-picture', 'text-zinc-400');
        });

        this.showToast('Picture-in-Picture active', 'picture-in-picture-2', 'text-cyan-400');
        return;
      } catch (err) {
        console.warn('Document PiP notice:', err);
      }
    }

    // 2. Native HTML5 Video Element PiP Fallback
    const nativeVideo = document.querySelector('video');
    if (nativeVideo && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          this.showToast('Exited Picture-in-Picture', 'picture-in-picture', 'text-zinc-400');
        } else {
          await nativeVideo.requestPictureInPicture();
          this.showToast('Picture-in-Picture active', 'picture-in-picture-2', 'text-cyan-400');
        }
        return;
      } catch (e) {
        console.warn('Native video PiP failed:', e);
      }
    }

    // 3. Fallback: Show floating mini video window
    this.showFloatingPanel('video');
    this.showToast('Floating Video Player Active', 'tv', 'text-violet-400');
  }

  // --- KEYBOARD SHORTCUT HELPERS ---
  seekRelative(sec) {
    if (!window.audioPlayer) return;
    const cur = window.audioPlayer.getCurrentTime();
    const dur = window.audioPlayer.getDuration();
    const nextTime = Math.max(0, Math.min(dur || 9999, cur + sec));
    window.audioPlayer.seekTo(nextTime);
    this.showToast(sec > 0 ? `+${sec}s` : `${sec}s`, 'clock', 'text-zinc-300');
  }

  toggleMute() {
    if (!window.audioPlayer) return;
    window.audioPlayer.toggleMute();
    const isM = window.audioPlayer.isMuted;
    this.showToast(isM ? 'Muted' : 'Unmuted', isM ? 'volume-x' : 'volume-2', 'text-zinc-300');
  }

  showUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) modal.classList.remove('hidden');
  }

  submitCustomTrack() {
    const input = document.getElementById('custom-yt-input');
    const titleInput = document.getElementById('custom-title-input');
    const artistInput = document.getElementById('custom-artist-input');

    const rawVal = input ? input.value.trim() : '';
    if (!rawVal) return;

    const ytId = this.extractYouTubeId(rawVal);
    if (!ytId) {
      alert('Could not parse YouTube Video ID or URL. Please verify the link or enter an 11-character video ID.');
      return;
    }

    const title = (titleInput && titleInput.value.trim()) || `Custom Track (${ytId})`;
    const artist = (artistInput && artistInput.value.trim()) || 'YouTube Stream';

    const newTrack = {
      id: 'custom-' + Date.now(),
      title: title,
      artist: artist,
      album: 'Custom Import',
      duration: 'LIVE',
      durationSec: 180,
      ytId: ytId,
      audioId: ytId,
      musicVideoId: ytId,
      cover: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      category: 'all',
      plays: 'User Upload'
    };

    YTM_DATA.tracks.unshift(newTrack);
    this.queue = [newTrack];
    this.playQueueIndex(0);
    this.closeModal('custom-track-modal');

    if (input) input.value = '';
    if (titleInput) titleInput.value = '';
    if (artistInput) artistInput.value = '';
    this.renderQuickPicks();
    this.pushCloudSyncData();
  }

  extractYouTubeId(urlOrId) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
      return urlOrId;
    }
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  }

  // --- LIVE & LOCAL SEARCH ---

  handleSearchInput(query) {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.handleSearch(query);
    }, 350);
  }

  async handleSearch(query) {
    const clean = query.trim();
    if (!clean) {
      this.clearSearch();
      return;
    }

    if (!clean.includes('http')) {
      this.addSearchHistory(clean);
    }
    this.closeSearchHistory();

    const directId = this.extractYouTubeId(clean);
    if (directId && clean.includes('http')) {
      const customTrack = {
        id: 'direct-' + Date.now(),
        title: 'Playing from Link',
        artist: 'Stream',
        album: 'Direct Stream',
        duration: 'Live',
        durationSec: 200,
        ytId: directId,
        audioId: directId,
        musicVideoId: directId,
        cover: `https://img.youtube.com/vi/${directId}/hqdefault.jpg`,
        category: 'all',
        plays: 'Direct Link'
      };
      this.queue = [customTrack];
      this.playQueueIndex(0);
      return;
    }

    this.navigate('search');
    const titleEl = document.getElementById('search-query-title');
    if (titleEl) titleEl.innerText = `"${clean}"`;

    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) clearBtn.classList.remove('hidden');

    const listEl = document.getElementById('search-results-list');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="col-span-full py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <div class="w-7 h-7 border-2 border-ytm-red border-t-transparent rounded-full animate-spin"></div>
        <p class="text-xs">Searching tracks on Cadence Music...</p>
      </div>
    `;

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
        console.warn('Backend search error, falling back to local catalog:', err);
      }
    }

    // Standalone Phone Search Fallback (Zero PC / Server Required)
    try {
      const invRes = await fetch(`https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(clean)}&type=video`, { signal: AbortSignal.timeout(4000) });
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
            plays: 'YouTube Music'
          }));
          this.renderSearchResults(liveTracks, listEl);
          return;
        }
      }
    } catch (e) {
      try {
        const pipedRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(clean)}&filter=music_songs`, { signal: AbortSignal.timeout(4000) });
        if (pipedRes.ok) {
          const data = await pipedRes.json();
          const items = data.items || [];
          const liveTracks = items.filter(i => i.type === 'stream' && i.url).slice(0, 20).map(item => {
            const vid = item.url.replace('/watch?v=', '');
            return {
              id: 'yt-' + vid,
              title: item.title,
              artist: item.uploaderName || 'Artist',
              album: 'YouTube Music',
              duration: item.duration ? Math.floor(item.duration / 60) + ':' + (item.duration % 60).toString().padStart(2, '0') : '3:30',
              durationSec: item.duration || 210,
              ytId: vid,
              audioId: vid,
              musicVideoId: vid,
              cover: item.thumbnail || `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
              category: 'all',
              plays: item.views ? `${(item.views / 1000000).toFixed(1)}M plays` : 'YouTube Music'
            };
          });
          if (liveTracks.length > 0) {
            this.renderSearchResults(liveTracks, listEl);
            return;
          }
        }
      } catch (e2) {}
    }

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

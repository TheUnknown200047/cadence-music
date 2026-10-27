// Cadence Music Pro Suite - Equalizer (Web Audio API) & Offline Storage Engine (IndexedDB)

class AudioEqualizerEngine {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.ctx = null;
    this.source = null;
    this.filters = [];
    this.compressor = null;
    this.preamp = null;
    this.isInitialized = false;

    this.frequencies = [60, 250, 1000, 4000, 12000];
    this.presets = {
      flat: [0, 0, 0, 0, 0],
      bass_boost: [8, 6, 2, 0, 1],
      vocal_boost: [-2, 1, 6, 4, 2],
      electronic: [6, 4, -1, 3, 6],
      rock: [5, 3, -1, 4, 6],
      acoustic: [4, 2, 1, 3, 4],
      lofi_warmth: [5, 4, -2, -3, -6]
    };

    this.activePreset = 'flat';
    this.normalizationEnabled = true;
    this.gains = [0, 0, 0, 0, 0];
  }

  init() {
    if (this.isInitialized || !this.audioElement) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Configure media element
      this.audioElement.crossOrigin = 'anonymous';
      this.source = this.ctx.createMediaElementSource(this.audioElement);

      // Create 5 parametric equalizer filters
      this.filters = this.frequencies.map((freq, idx) => {
        const filter = this.ctx.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === this.frequencies.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = this.gains[idx] || 0;
        return filter;
      });

      // Volume Normalization Compressor (ReplayGain)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(this.normalizationEnabled ? -18 : 0, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      // Master Preamp
      this.preamp = this.ctx.createGain();
      this.preamp.gain.value = 1.0;

      // Connect graph: source -> filter0 -> ... -> filter4 -> compressor -> preamp -> destination
      let curr = this.source;
      for (const f of this.filters) {
        curr.connect(f);
        curr = f;
      }
      curr.connect(this.compressor);
      this.compressor.connect(this.preamp);
      this.preamp.connect(this.ctx.destination);

      this.isInitialized = true;
      this.loadSettings();
      console.log('[Equalizer Engine] Web Audio Parametric Equalizer connected successfully.');
    } catch (e) {
      console.warn('[Equalizer Engine] Web Audio init notice (awaiting gesture):', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setGain(bandIndex, db) {
    if (!this.isInitialized) this.init();
    const val = parseFloat(db) || 0;
    this.gains[bandIndex] = val;
    if (this.filters[bandIndex] && this.ctx) {
      this.filters[bandIndex].gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
      this.activePreset = 'custom';
      this.saveSettings();
    }
  }

  applyPreset(presetKey) {
    if (!this.isInitialized) this.init();
    const presetGains = this.presets[presetKey];
    if (!presetGains) return;
    this.activePreset = presetKey;
    presetGains.forEach((db, i) => {
      this.gains[i] = db;
      if (this.filters[i] && this.ctx) {
        this.filters[i].gain.setTargetAtTime(db, this.ctx.currentTime, 0.05);
      }
    });
    this.saveSettings();
  }

  setNormalization(enabled) {
    this.normalizationEnabled = !!enabled;
    if (this.compressor && this.ctx) {
      this.compressor.threshold.setTargetAtTime(this.normalizationEnabled ? -18 : 0, this.ctx.currentTime, 0.05);
      this.saveSettings();
    }
  }

  reset() {
    this.applyPreset('flat');
    this.setNormalization(true);
  }

  loadSettings() {
    try {
      const saved = JSON.parse((localStorage.getItem('cadence_eq_settings') || localStorage.getItem('aura_eq_settings')) || 'null');
      if (saved) {
        if (saved.preset && this.presets[saved.preset]) {
          this.applyPreset(saved.preset);
        } else if (Array.isArray(saved.gains)) {
          saved.gains.forEach((g, i) => this.setGain(i, g));
        }
        if (typeof saved.normalization === 'boolean') {
          this.setNormalization(saved.normalization);
        }
      }
    } catch (e) {}
  }

  saveSettings() {
    try {
      localStorage.setItem('cadence_eq_settings', JSON.stringify({
        preset: this.activePreset,
        gains: this.gains,
        normalization: this.normalizationEnabled
      }));
    } catch (e) {}
  }
}

class OfflineStorageEngine {
  constructor() {
    this.dbName = 'CadenceMusicOfflineDB';
    this.version = 1;
    this.db = null;
    this.initPromise = this.init();
  }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e);
    });
  }

  async saveTrackAudio(track, blob) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const record = {
          id: track.id || track.ytId,
          ytId: track.ytId || track.audioId,
          audioId: track.audioId || track.ytId,
          musicVideoId: track.musicVideoId || null,
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          album: track.album || 'Single',
          duration: track.duration || '3:30',
          durationSec: track.durationSec || 210,
          cover: track.cover,
          category: track.category || 'all',
          blob: blob,
          sizeBytes: blob.size,
          downloadedAt: Date.now()
        };
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getTrackAudio(trackId) {
    await this.initPromise;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        const req = store.get(trackId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async isTrackDownloaded(trackId) {
    const record = await this.getTrackAudio(trackId);
    return !!record;
  }

  async removeTrack(trackId) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const req = store.delete(trackId);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllTracks() {
    await this.initPromise;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('tracks', 'readonly');
        const store = tx.objectStore('tracks');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (err) {
        resolve([]);
      }
    });
  }

  // Aliases for developer ergonomics
  async saveTrack(track, blob) {
    return this.saveTrackAudio(track, blob);
  }
  async isDownloaded(trackId) {
    return this.isTrackDownloaded(trackId);
  }
  async getTrackBlob(trackId) {
    const rec = await this.getTrackAudio(trackId);
    return rec ? rec.blob : null;
  }
  async getDownloadedTracks() {
    return this.getAllTracks();
  }

  async getTotalStorageBytes() {
    const all = await this.getAllTracks();
    return all.reduce((sum, t) => sum + (t.sizeBytes || 0), 0);
  }

  async clearAll() {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('tracks', 'readwrite');
        const store = tx.objectStore('tracks');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }
}

// Global Singletons & Class Exports
window.AudioEqualizerEngine = AudioEqualizerEngine;
window.OfflineStorageEngine = OfflineStorageEngine;
window.OfflineStorage = new OfflineStorageEngine();

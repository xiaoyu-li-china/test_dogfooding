class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.plugins = new Map();
    this.eventHandlers = new Map();
    this.isInitialized = false;
    this.isPlaying = false;
    this.duration = 0;
    this.startTime = 0;
    this.pauseTime = 0;
    this.audioBuffer = null;
    this.animationFrameId = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      this.gainNode = this.audioContext.createGain();
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
      
      this.isInitialized = true;
      
      this.plugins.forEach((plugin) => {
        if (plugin.init) {
          plugin.init(this.audioContext, this.gainNode);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioEngine:', error);
      return false;
    }
  }

  async loadAudio(bufferOrUrl) {
    if (!this.isInitialized) {
      await this.init();
    }

    this.stop();

    try {
      let arrayBuffer;

      if (bufferOrUrl instanceof ArrayBuffer) {
        arrayBuffer = bufferOrUrl;
      } else if (typeof bufferOrUrl === 'string') {
        const response = await fetch(bufferOrUrl);
        arrayBuffer = await response.arrayBuffer();
      } else if (bufferOrUrl instanceof Blob) {
        arrayBuffer = await bufferOrUrl.arrayBuffer();
      } else {
        throw new Error('Unsupported audio source type');
      }

      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.duration = this.audioBuffer.duration;
      
      this.emit('loaded', { duration: this.duration });
      
      return this.duration;
    } catch (error) {
      console.error('Failed to load audio:', error);
      this.emit('error', error);
      throw error;
    }
  }

  play(offset = 0) {
    if (!this.isInitialized || !this.audioBuffer) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.stop();

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    
    let outputNode = this.sourceNode;
    
    this.plugins.forEach((plugin) => {
      if (plugin.enabled && plugin.connect) {
        outputNode = plugin.connect(outputNode);
      }
    });
    
    outputNode.connect(this.gainNode);

    const startOffset = offset > 0 ? offset : this.pauseTime;
    this.sourceNode.start(0, startOffset);
    this.startTime = this.audioContext.currentTime - startOffset;
    this.pauseTime = 0;
    this.isPlaying = true;

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.emit('ended');
      }
    };

    this.startTimeUpdate();
    this.emit('play');
  }

  pause() {
    if (!this.isPlaying || !this.sourceNode) return;

    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.sourceNode.stop();
    this.sourceNode = null;
    this.isPlaying = false;
    this.stopTimeUpdate();
    this.emit('pause');
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {}
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
    this.stopTimeUpdate();
    this.emit('stop');
  }

  seek(time) {
    if (!this.audioBuffer) return;

    const wasPlaying = this.isPlaying;
    
    if (this.isPlaying) {
      this.stop();
    }
    
    this.pauseTime = Math.max(0, Math.min(time, this.duration));
    
    if (wasPlaying) {
      this.play(this.pauseTime);
    }
    
    this.emit('seek', { time: this.pauseTime });
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
      this.emit('volumechange', { volume });
    }
  }

  getVolume() {
    return this.gainNode ? this.gainNode.gain.value : 0;
  }

  getCurrentTime() {
    if (!this.isInitialized) return 0;
    
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pauseTime;
  }

  getDuration() {
    return this.duration;
  }

  getWaveformData() {
    if (!this.analyserNode) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getFrequencyData() {
    if (!this.analyserNode) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  registerPlugin(name, plugin) {
    this.plugins.set(name, {
      ...plugin,
      enabled: false,
    });

    if (this.isInitialized && plugin.init) {
      plugin.init(this.audioContext, this.gainNode);
    }
  }

  enablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin && !plugin.enabled) {
      plugin.enabled = true;
      if (plugin.onEnable) {
        plugin.onEnable();
      }
      this.emit('pluginEnabled', { name });
    }
  }

  disablePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.enabled) {
      plugin.enabled = false;
      if (plugin.onDisable) {
        plugin.onDisable();
      }
      this.emit('pluginDisabled', { name });
    }
  }

  togglePlugin(name) {
    const plugin = this.plugins.get(name);
    if (plugin) {
      if (plugin.enabled) {
        this.disablePlugin(name);
      } else {
        this.enablePlugin(name);
      }
    }
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  setPluginParam(name, param, value) {
    const plugin = this.plugins.get(name);
    if (plugin && plugin.params && param in plugin.params) {
      plugin.params[param].value = value;
      if (plugin.onParamChange) {
        plugin.onParamChange(param, value);
      }
      this.emit('pluginParamChanged', { name, param, value });
    }
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach((handler) => handler(data));
    }
  }

  startTimeUpdate() {
    const update = () => {
      if (this.isPlaying) {
        this.emit('timeupdate', {
          currentTime: this.getCurrentTime(),
          duration: this.duration,
        });
        this.animationFrameId = requestAnimationFrame(update);
      }
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  stopTimeUpdate() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy() {
    this.stop();
    
    this.plugins.forEach((plugin) => {
      if (plugin.destroy) {
        plugin.destroy();
      }
    });
    this.plugins.clear();
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.analyserNode) {
      this.analyserNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.eventHandlers.clear();
    this.isInitialized = false;
    this.audioBuffer = null;
  }
}

export default AudioEngine;

import { AudioEngine } from '../index';

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.nodes = [];
  }

  createBufferSource() {
    const source = {
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      onended: null,
    };
    this.nodes.push(source);
    return source;
  }

  createGain() {
    const gain = {
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    this.nodes.push(gain);
    return gain;
  }

  createAnalyser() {
    const analyser = {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteTimeDomainData: jest.fn(),
      getByteFrequencyData: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    this.nodes.push(analyser);
    return analyser;
  }

  createBiquadFilter() {
    const filter = {
      type: 'peaking',
      frequency: { value: 0 },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    this.nodes.push(filter);
    return filter;
  }

  createConvolver() {
    const convolver = {
      buffer: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    this.nodes.push(convolver);
    return convolver;
  }

  createBuffer(channels, length, sampleRate) {
    const buffer = {
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: jest.fn().mockReturnValue(new Float32Array(length)),
    };
    return buffer;
  }

  decodeAudioData() {
    return Promise.resolve({
      duration: 10,
      length: 441000,
      sampleRate: 44100,
    });
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

describe('AudioEngine', () => {
  let engine;
  let originalAudioContext;

  beforeEach(() => {
    jest.useFakeTimers();
    originalAudioContext = window.AudioContext;
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = MockAudioContext;
    window.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 16));
    window.cancelAnimationFrame = jest.fn(id => clearTimeout(id));
    
    engine = new AudioEngine();
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    if (engine && engine.isInitialized) {
      engine.destroy();
    }
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await engine.init();
      
      expect(result).toBe(true);
      expect(engine.isInitialized).toBe(true);
      expect(engine.audioContext).toBeInstanceOf(MockAudioContext);
      expect(engine.gainNode).toBeDefined();
      expect(engine.analyserNode).toBeDefined();
    });

    it('should not reinitialize if already initialized', async () => {
      await engine.init();
      const audioContextBefore = engine.audioContext;
      
      await engine.init();
      
      expect(engine.audioContext).toBe(audioContextBefore);
    });
  });

  describe('Load Audio', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should load audio from ArrayBuffer', async () => {
      const arrayBuffer = new ArrayBuffer(1000);
      
      await engine.loadAudio(arrayBuffer);
      
      expect(engine.audioBuffer).toBeDefined();
      expect(engine.duration).toBe(10);
    });

    it('should load audio from Blob', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/wav' });
      blob.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(1000));
      
      await engine.loadAudio(blob);
      
      expect(engine.audioBuffer).toBeDefined();
    });

    it('should emit loaded event with duration', async () => {
      const mockHandler = jest.fn();
      engine.on('loaded', mockHandler);
      
      const arrayBuffer = new ArrayBuffer(1000);
      await engine.loadAudio(arrayBuffer);
      
      expect(mockHandler).toHaveBeenCalledWith({ duration: 10 });
    });

    it('should stop current playback before loading new audio', async () => {
      const stopSpy = jest.spyOn(engine, 'stop');
      const arrayBuffer = new ArrayBuffer(1000);
      
      await engine.loadAudio(arrayBuffer);
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Playback Controls', () => {
    beforeEach(async () => {
      await engine.init();
      const arrayBuffer = new ArrayBuffer(1000);
      await engine.loadAudio(arrayBuffer);
    });

    it('should play audio', () => {
      const emitSpy = jest.spyOn(engine, 'emit');
      
      engine.play();
      
      expect(engine.isPlaying).toBe(true);
      expect(engine.sourceNode).toBeDefined();
      expect(emitSpy).toHaveBeenCalledWith('play');
    });

    it('should resume suspended audio context before playing', async () => {
      engine.audioContext.state = 'suspended';
      const resumeSpy = jest.spyOn(engine.audioContext, 'resume');
      
      engine.play();
      
      expect(resumeSpy).toHaveBeenCalled();
    });

    it('should pause audio', () => {
      const emitSpy = jest.spyOn(engine, 'emit');
      engine.play();
      
      engine.pause();
      
      expect(engine.isPlaying).toBe(false);
      expect(engine.pauseTime).toBeGreaterThan(0);
      expect(emitSpy).toHaveBeenCalledWith('pause');
    });

    it('should stop audio', () => {
      const emitSpy = jest.spyOn(engine, 'emit');
      engine.play();
      
      engine.stop();
      
      expect(engine.isPlaying).toBe(false);
      expect(engine.pauseTime).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith('stop');
    });

    it('should seek to specific time', () => {
      const emitSpy = jest.spyOn(engine, 'emit');
      
      engine.seek(5);
      
      expect(engine.pauseTime).toBe(5);
      expect(emitSpy).toHaveBeenCalledWith('seek', { time: 5 });
    });

    it('should clamp seek time between 0 and duration', () => {
      engine.seek(-1);
      expect(engine.pauseTime).toBe(0);
      
      engine.seek(100);
      expect(engine.pauseTime).toBe(10);
    });
  });

  describe('Volume Control', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should set volume', () => {
      const emitSpy = jest.spyOn(engine, 'emit');
      
      engine.setVolume(0.5);
      
      expect(engine.gainNode.gain.value).toBe(0.5);
      expect(emitSpy).toHaveBeenCalledWith('volumechange', { volume: 0.5 });
    });

    it('should clamp volume between 0 and 1', () => {
      engine.setVolume(-1);
      expect(engine.gainNode.gain.value).toBe(0);
      
      engine.setVolume(2);
      expect(engine.gainNode.gain.value).toBe(1);
    });

    it('should get current volume', () => {
      engine.setVolume(0.75);
      
      expect(engine.getVolume()).toBe(0.75);
    });
  });

  describe('Time Tracking', () => {
    beforeEach(async () => {
      await engine.init();
      const arrayBuffer = new ArrayBuffer(1000);
      await engine.loadAudio(arrayBuffer);
    });

    it('should return current time when playing', () => {
      engine.audioContext.currentTime = 5;
      engine.play();
      
      const currentTime = engine.getCurrentTime();
      
      expect(currentTime).toBeGreaterThan(0);
    });

    it('should return pause time when paused', () => {
      engine.play();
      engine.pauseTime = 3;
      engine.isPlaying = false;
      
      expect(engine.getCurrentTime()).toBe(3);
    });

    it('should return duration', () => {
      expect(engine.getDuration()).toBe(10);
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should register event handlers', () => {
      const handler = jest.fn();
      
      engine.on('test', handler);
      
      expect(engine.eventHandlers.has('test')).toBe(true);
      expect(engine.eventHandlers.get('test')).toContain(handler);
    });

    it('should unregister event handlers', () => {
      const handler = jest.fn();
      engine.on('test', handler);
      
      engine.off('test', handler);
      
      expect(engine.eventHandlers.get('test')).not.toContain(handler);
    });

    it('should emit events and call handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      engine.on('test', handler1);
      engine.on('test', handler2);
      
      engine.emit('test', { data: 'test' });
      
      expect(handler1).toHaveBeenCalledWith({ data: 'test' });
      expect(handler2).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await engine.init();
    });

    it('should destroy all resources', () => {
      const disconnectGainSpy = jest.spyOn(engine.gainNode, 'disconnect');
      const disconnectAnalyserSpy = jest.spyOn(engine.analyserNode, 'disconnect');
      const closeSpy = jest.spyOn(engine.audioContext, 'close');
      
      engine.destroy();
      
      expect(disconnectGainSpy).toHaveBeenCalled();
      expect(disconnectAnalyserSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      expect(engine.isInitialized).toBe(false);
      expect(engine.audioBuffer).toBeNull();
    });
  });
});

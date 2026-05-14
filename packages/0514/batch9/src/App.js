import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { createAudioEngine } from './audio';

const { ipcRenderer } = window.require ? window.require('electron').ipcRenderer : null;

function App() {
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoop, setIsLoop] = useState(false);
  const [lyrics, setLyrics] = useState([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [plugins, setPlugins] = useState({
    equalizer: { enabled: false, params: {} },
    reverb: { enabled: false, params: {} },
  });
  const [volume, setVolume] = useState(0.8);
  
  const audioEngineRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const currentUrlRef = useRef(null);
  const lyricsContainerRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    const initAudio = async () => {
      if (!audioEngineRef.current) {
        audioEngineRef.current = createAudioEngine();
        await audioEngineRef.current.init();
        
        const equalizer = audioEngineRef.current.getPlugin('equalizer');
        const reverb = audioEngineRef.current.getPlugin('reverb');
        setPlugins({
          equalizer: { enabled: false, params: equalizer ? equalizer.params : {} },
          reverb: { enabled: false, params: reverb ? reverb.params : {} },
        });

        audioEngineRef.current.on('play', () => setIsPlaying(true));
        audioEngineRef.current.on('pause', () => setIsPlaying(false));
        audioEngineRef.current.on('stop', () => setIsPlaying(false));
        audioEngineRef.current.on('timeupdate', ({ currentTime: time, duration: dur }) => {
          setCurrentTime(time);
          setDuration(dur);
          updateCurrentLyric(time);
        });
        audioEngineRef.current.on('loaded', ({ duration: dur }) => setDuration(dur));
        audioEngineRef.current.on('ended', () => handlePlayNextOrStop());

        audioEngineRef.current.setVolume(volume);
      }
    };

    initAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const drawWaveform = () => {
      if (canvasRef.current && audioEngineRef.current && audioEngineRef.current.isInitialized) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dataArray = audioEngineRef.current.getWaveformData();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4a4a6a';
        ctx.beginPath();
        
        const sliceWidth = canvas.width / dataArray.length;
        let x = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          
          x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        const progressX = duration > 0 ? (currentTime / duration) * canvas.width : 0;
        if (progressX > 0) {
          ctx.fillStyle = '#e94560';
          ctx.fillRect(0, 0, progressX, canvas.height);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = '#e94560';
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };
    
    drawWaveform();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentTime, duration]);

  const updateCurrentLyric = useCallback((time) => {
    if (lyrics.length === 0) return;
    
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= time) {
        index = i;
      } else {
        break;
      }
    }
    
    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index);
      
      if (!isUserScrollingRef.current && lyricsContainerRef.current && index >= 0) {
        const lyricElements = lyricsContainerRef.current.querySelectorAll('.lyric-line');
        if (lyricElements[index]) {
          lyricElements[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }, [lyrics, currentLyricIndex]);

  const handleLyricScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2000);
  };

  const selectFolder = async () => {
    if (!ipcRenderer) return;
    const folderPath = await ipcRenderer.invoke('select-folder');
    if (folderPath) {
      const musicFiles = await ipcRenderer.invoke('scan-music', folderPath);
      setPlaylist(musicFiles);
      setCurrentIndex(-1);
      setLyrics([]);
      setCurrentLyricIndex(-1);
    }
  };

  const loadAndPlay = async (index) => {
    if (!ipcRenderer || !playlist[index] || !audioEngineRef.current) return;
    
    try {
      audioEngineRef.current.stop();
      
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
      
      const lrcContent = await ipcRenderer.invoke('read-lyrics', playlist[index].path);
      if (lrcContent) {
        const lines = lrcContent.split('\n');
        const parsedLyrics = [];
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
        
        lines.forEach(line => {
          const matches = [...line.matchAll(timeRegex)];
          if (matches.length > 0) {
            const text = line.replace(timeRegex, '').trim();
            matches.forEach(match => {
              const minutes = parseInt(match[1]);
              const seconds = parseInt(match[2]);
              const milliseconds = parseInt(match[3].padEnd(3, '0'));
              const time = minutes * 60 + seconds + milliseconds / 1000;
              
              if (text) {
                parsedLyrics.push({ time, text });
              }
            });
          }
        });
        
        setLyrics(parsedLyrics.sort((a, b) => a.time - b.time));
        setCurrentLyricIndex(-1);
      } else {
        setLyrics([]);
        setCurrentLyricIndex(-1);
      }
      
      const fileBuffer = await ipcRenderer.invoke('read-file', playlist[index].path);
      await audioEngineRef.current.loadAudio(fileBuffer);
      audioEngineRef.current.play();
      
      setCurrentIndex(index);
    } catch (error) {
      console.error('加载音乐失败:', error);
    }
  };

  const togglePlay = () => {
    if (!audioEngineRef.current) return;
    
    if (isPlaying) {
      audioEngineRef.current.pause();
    } else {
      audioEngineRef.current.play();
    }
  };

  const playPrev = () => {
    if (playlist.length === 0) return;
    
    if (currentIndex > 0) {
      loadAndPlay(currentIndex - 1);
    } else {
      loadAndPlay(playlist.length - 1);
    }
  };

  const handlePlayNextOrStop = () => {
    if (currentIndex < playlist.length - 1) {
      loadAndPlay(currentIndex + 1);
    } else if (isLoop && playlist.length > 0) {
      loadAndPlay(0);
    } else {
      setIsPlaying(false);
    }
  };

  const playNext = () => {
    if (playlist.length === 0) return;
    
    if (currentIndex < playlist.length - 1) {
      loadAndPlay(currentIndex + 1);
    } else if (isLoop) {
      loadAndPlay(0);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(newVolume);
    }
  };

  const togglePlugin = (pluginName) => {
    if (!audioEngineRef.current) return;
    
    audioEngineRef.current.togglePlugin(pluginName);
    const plugin = audioEngineRef.current.getPlugin(pluginName);
    setPlugins(prev => ({
      ...prev,
      [pluginName]: {
        enabled: plugin.enabled,
        params: plugin.params
      }
    }));
  };

  const updatePluginParam = (pluginName, paramName, value) => {
    if (!audioEngineRef.current) return;
    
    audioEngineRef.current.setPluginParam(pluginName, paramName, value);
    const plugin = audioEngineRef.current.getPlugin(pluginName);
    setPlugins(prev => ({
      ...prev,
      [pluginName]: {
        ...prev[pluginName],
        params: plugin.params
      }
    }));
  };

  const setEqualizerPreset = (preset) => {
    if (!audioEngineRef.current) return;
    
    const plugin = audioEngineRef.current.getPlugin('equalizer');
    if (plugin && plugin.setPreset) {
      plugin.setPreset(preset);
      setPlugins(prev => ({
        ...prev,
        equalizer: {
          ...prev.equalizer,
          params: plugin.params
        }
      }));
    }
  };

  const setReverbPreset = (preset) => {
    if (!audioEngineRef.current) return;
    
    const plugin = audioEngineRef.current.getPlugin('reverb');
    if (plugin && plugin.setPreset) {
      plugin.setPreset(preset);
      setPlugins(prev => ({
        ...prev,
        reverb: {
          ...prev.reverb,
          params: plugin.params
        }
      }));
    }
  };

  const handleCanvasClick = (e) => {
    if (!audioEngineRef.current || duration === 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekTime = (x / rect.width) * duration;
    audioEngineRef.current.seek(seekTime);
    setCurrentTime(seekTime);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🎵 音乐播放器</h1>
        <button className="add-btn" onClick={selectFolder}>
          + 添加音乐文件夹
        </button>
      </header>

      <div className="main-content">
        <div className="playlist-section">
          <h2>播放列表 ({playlist.length})</h2>
          <div className="playlist">
            {playlist.length === 0 ? (
              <div className="empty-state">
                <p>暂无音乐</p>
                <p className="hint">点击上方按钮添加音乐文件夹</p>
              </div>
            ) : (
              playlist.map((track, index) => (
                <div
                  key={index}
                  className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => loadAndPlay(index)}
                >
                  <span className="track-index">{index + 1}</span>
                  <span className="track-name">{track.name}</span>
                  <span className="track-ext">{track.extension}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="player-section">
          <div className="now-playing">
            {currentIndex >= 0 && playlist[currentIndex] ? (
              <h3>正在播放: {playlist[currentIndex].name}</h3>
            ) : (
              <h3>选择一首音乐开始播放</h3>
            )}
          </div>

          <div className="lyrics-container" ref={lyricsContainerRef} onScroll={handleLyricScroll}>
            {lyrics.length === 0 ? (
              <div className="no-lyrics">
                <p>暂无歌词</p>
                <p className="hint">请确保同目录下有同名 .lrc 文件</p>
              </div>
            ) : (
              lyrics.map((lyric, index) => (
                <div
                  key={index}
                  className={`lyric-line ${index === currentLyricIndex ? 'active' : ''}`}
                >
                  {lyric.text}
                </div>
              ))
            )}
          </div>

          <div className="waveform-container">
            <canvas 
              ref={canvasRef} 
              className="waveform-canvas"
              onClick={handleCanvasClick}
            ></canvas>
          </div>

          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="volume-control">
            <span>🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume}
              onChange={handleVolumeChange}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>

          <div className="controls">
            <button 
              className={`control-btn loop-btn ${isLoop ? 'active' : ''}`} 
              onClick={() => setIsLoop(!isLoop)}
              title={isLoop ? '循环播放已开启' : '循环播放已关闭'}
            >
              🔁
            </button>
            <button className="control-btn prev-btn" onClick={playPrev}>
              ⏮
            </button>
            <button className="control-btn play-btn" onClick={togglePlay}>
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button className="control-btn next-btn" onClick={playNext}>
              ⏭
            </button>
          </div>

          <div className="effects-panel">
            <div className="effect-section">
              <div className="effect-header">
                <h3>🎛️ 均衡器</h3>
                <button 
                  className={`effect-toggle ${plugins.equalizer.enabled ? 'active' : ''}`}
                  onClick={() => togglePlugin('equalizer')}
                >
                  {plugins.equalizer.enabled ? '开启' : '关闭'}
                </button>
              </div>
              
              <div className="preset-buttons">
                {['flat', 'rock', 'pop', 'jazz', 'bass', 'vocal'].map(preset => (
                  <button 
                    key={preset} 
                    className="preset-btn"
                    onClick={() => setEqualizerPreset(preset)}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
              
              <div className="equalizer-sliders">
                {Object.entries(plugins.equalizer.params).map(([key, param]) => (
                  <div key={key} className="slider-container">
                    <label>{param.label}</label>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step="0.1"
                      value={param.value}
                      onChange={(e) => updatePluginParam('equalizer', key, parseFloat(e.target.value))}
                    />
                    <span>{param.value.toFixed(1)} dB</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="effect-section">
              <div className="effect-header">
                <h3>🌊 混响</h3>
                <button 
                  className={`effect-toggle ${plugins.reverb.enabled ? 'active' : ''}`}
                  onClick={() => togglePlugin('reverb')}
                >
                  {plugins.reverb.enabled ? '开启' : '关闭'}
                </button>
              </div>
              
              <div className="preset-buttons">
                {['small', 'medium', 'large', 'hall', 'church'].map(preset => (
                  <button 
                    key={preset} 
                    className="preset-btn"
                    onClick={() => setReverbPreset(preset)}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
              
              <div className="reverb-sliders">
                {Object.entries(plugins.reverb.params).map(([key, param]) => (
                  <div key={key} className="slider-container">
                    <label>{param.label}</label>
                    <input
                      type="range"
                      min={param.min}
                      max={param.max}
                      step="0.1"
                      value={param.value}
                      onChange={(e) => updatePluginParam('reverb', key, parseFloat(e.target.value))}
                    />
                    <span>{param.value.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

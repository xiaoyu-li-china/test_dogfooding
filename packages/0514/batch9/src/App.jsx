import React, { useState, useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }

function App() {
  const [playlist, setPlaylist] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const wavesurferRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#4a4a6a',
        progressColor: '#e94560',
        cursorColor: '#ff6b6b',
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        height: 120,
        normalize: true,
        backend: 'WebAudio'
      })

      wavesurferRef.current.on('ready', () => {
        setDuration(wavesurferRef.current.getDuration())
      })

      wavesurferRef.current.on('audioprocess', () => {
        setCurrentTime(wavesurferRef.current.getCurrentTime())
      })

      wavesurferRef.current.on('finish', () => {
        handleNext()
      })
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
      }
    }
  }, [])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAddFolder = async () => {
    if (!ipcRenderer) return
    
    const folderPath = await ipcRenderer.invoke('select-folder')
    if (folderPath) {
      const musicFiles = await ipcRenderer.invoke('scan-music-folder', folderPath)
      setPlaylist(prev => [...prev, ...musicFiles])
    }
  }

  const playSong = (index) => {
    if (index >= 0 && index < playlist.length && wavesurferRef.current) {
      const song = playlist[index]
      wavesurferRef.current.load(`file://${song.path}`)
      setCurrentIndex(index)
      setIsPlaying(true)
      setTimeout(() => {
        wavesurferRef.current.play()
      }, 500)
    }
  }

  const togglePlayPause = () => {
    if (wavesurferRef.current && currentIndex >= 0) {
      wavesurferRef.current.playPause()
      setIsPlaying(!isPlaying)
    }
  }

  const handlePrev = () => {
    if (playlist.length > 0) {
      const newIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1
      playSong(newIndex)
    }
  }

  const handleNext = () => {
    if (playlist.length > 0) {
      const newIndex = currentIndex < playlist.length - 1 ? currentIndex + 1 : 0
      playSong(newIndex)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎵 音乐播放器</h1>
        <button className="add-folder-btn" onClick={handleAddFolder}>
          + 添加音乐文件夹
        </button>
      </header>

      <div className="main-content">
        <div className="playlist">
          <div className="playlist-header">
            播放列表 ({playlist.length} 首)
          </div>
          <div className="playlist-items">
            {playlist.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <p>暂无音乐</p>
                <p>点击上方按钮添加音乐文件夹</p>
              </div>
            ) : (
              playlist.map((song, index) => (
                <div
                  key={index}
                  className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
                  onClick={() => playSong(index)}
                >
                  <span className="index">{index + 1}</span>
                  <div className="info">
                    <div className="name">{song.name}</div>
                    <div className="ext">{song.ext.toUpperCase()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="player">
          <div className="now-playing">
            {currentIndex >= 0 && playlist[currentIndex] ? (
              <div className="song-name">{playlist[currentIndex].name}</div>
            ) : (
              <div className="no-song">选择一首音乐开始播放</div>
            )}
          </div>

          <div className="waveform-container">
            <div id="waveform" ref={containerRef}></div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="controls">
            <button className="control-btn" onClick={handlePrev}>
              ⏮
            </button>
            <button className="control-btn play-pause" onClick={togglePlayPause}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="control-btn" onClick={handleNext}>
              ⏭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

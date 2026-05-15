class AnnotationTool {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = video;
        this.annotations = [];
        this.currentTool = 'select';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.strokeColor = '#ff0000';
        this.strokeWidth = 3;
        this.mouseHighlight = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.highlightPulse = 0;
        this.selectedAnnotation = null;
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.resizeCanvas();
        this.bindEvents();
        this.startAnimationLoop();
    }

    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.redraw();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;

        if (this.currentTool === 'select') {
            this.selectedAnnotation = this.findAnnotationAt(pos.x, pos.y);
            if (this.selectedAnnotation) {
                this.dragging = true;
                this.dragOffsetX = pos.x - this.selectedAnnotation.x;
                this.dragOffsetY = pos.y - this.selectedAnnotation.y;
            }
            this.redraw();
            return;
        }

        if (this.currentTool === 'text') {
            const text = prompt('请输入标注文字：');
            if (text) {
                this.annotations.push({
                    type: 'text',
                    x: pos.x,
                    y: pos.y,
                    text: text,
                    color: this.strokeColor,
                    size: this.strokeWidth * 4 + 12
                });
                this.redraw();
            }
            return;
        }

        this.isDrawing = true;
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;

        if (this.dragging && this.selectedAnnotation) {
            this.selectedAnnotation.x = pos.x - this.dragOffsetX;
            this.selectedAnnotation.y = pos.y - this.dragOffsetY;
            if (this.selectedAnnotation.type === 'rect' || this.selectedAnnotation.type === 'arrow') {
                this.selectedAnnotation.x2 = this.selectedAnnotation.x + (this.selectedAnnotation.width || 0);
                this.selectedAnnotation.y2 = this.selectedAnnotation.y + (this.selectedAnnotation.height || 0);
            }
            this.redraw();
            return;
        }

        if (!this.isDrawing) return;

        if (this.currentTool === 'rect') {
            this.tempRect = {
                type: 'rect',
                x: Math.min(this.startX, pos.x),
                y: Math.min(this.startY, pos.y),
                width: Math.abs(pos.x - this.startX),
                height: Math.abs(pos.y - this.startY),
                color: this.strokeColor,
                lineWidth: this.strokeWidth
            };
        } else if (this.currentTool === 'arrow') {
            this.tempArrow = {
                type: 'arrow',
                x: this.startX,
                y: this.startY,
                x2: pos.x,
                y2: pos.y,
                color: this.strokeColor,
                lineWidth: this.strokeWidth
            };
        }

        this.redraw();
    }

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentTool === 'rect' && this.tempRect && this.tempRect.width > 5 && this.tempRect.height > 5) {
            this.annotations.push({...this.tempRect});
        } else if (this.currentTool === 'arrow' && this.tempArrow) {
            const dx = this.tempArrow.x2 - this.tempArrow.x;
            const dy = this.tempArrow.y2 - this.tempArrow.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                this.annotations.push({...this.tempArrow});
            }
        }

        this.tempRect = null;
        this.tempArrow = null;
        this.redraw();
    }

    findAnnotationAt(x, y) {
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const ann = this.annotations[i];
            if (this.isPointInAnnotation(x, y, ann)) {
                return ann;
            }
        }
        return null;
    }

    isPointInAnnotation(x, y, ann) {
        const threshold = 10;
        if (ann.type === 'rect') {
            return x >= ann.x - threshold && x <= ann.x + ann.width + threshold &&
                   y >= ann.y - threshold && y <= ann.y + ann.height + threshold;
        } else if (ann.type === 'arrow') {
            const dist = this.pointToLineDistance(x, y, ann.x, ann.y, ann.x2, ann.y2);
            return dist < threshold;
        } else if (ann.type === 'text') {
            const textWidth = ann.text.length * ann.size * 0.6;
            return x >= ann.x - threshold && x <= ann.x + textWidth + threshold &&
                   y >= ann.y - ann.size && y <= ann.y + threshold;
        }
        return false;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    setTool(tool) {
        this.currentTool = tool;
        this.selectedAnnotation = null;
        this.dragging = false;
        if (tool === 'select') {
            this.canvas.classList.remove('active');
        } else {
            this.canvas.classList.add('active');
        }
    }

    clearAll() {
        this.annotations = [];
        this.selectedAnnotation = null;
        this.redraw();
    }

    startAnimationLoop() {
        const animate = () => {
            this.highlightPulse = (this.highlightPulse + 0.1) % (Math.PI * 2);
            if (this.mouseHighlight) {
                this.redraw();
            }
            requestAnimationFrame(animate);
        };
        animate();
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.annotations.forEach(ann => {
            this.drawAnnotation(ann, ann === this.selectedAnnotation);
        });

        if (this.tempRect) {
            this.drawRect(this.tempRect, false);
        }
        if (this.tempArrow) {
            this.drawArrow(this.tempArrow, false);
        }

        if (this.mouseHighlight) {
            this.drawMouseHighlight();
        }
    }

    drawAnnotation(ann, selected = false) {
        if (ann.type === 'rect') {
            this.drawRect(ann, selected);
        } else if (ann.type === 'arrow') {
            this.drawArrow(ann, selected);
        } else if (ann.type === 'text') {
            this.drawText(ann, selected);
        }
    }

    drawRect(ann, selected) {
        const ctx = this.ctx;
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.lineWidth;
        ctx.setLineDash(selected ? [5, 5] : []);
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        ctx.setLineDash([]);
    }

    drawArrow(ann, selected) {
        const ctx = this.ctx;
        const headLength = 20;
        const angle = Math.atan2(ann.y2 - ann.y, ann.x2 - ann.x);

        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.lineWidth;
        ctx.setLineDash(selected ? [5, 5] : []);
        
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.x2, ann.y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(
            ann.x2 - headLength * Math.cos(angle - Math.PI / 6),
            ann.y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(
            ann.x2 - headLength * Math.cos(angle + Math.PI / 6),
            ann.y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawText(ann, selected) {
        const ctx = this.ctx;
        ctx.font = `${ann.size}px Arial`;
        ctx.fillStyle = ann.color;
        
        const x = ann.x;
        const y = ann.y + ann.size / 2;
        
        if (selected) {
            const textWidth = ctx.measureText(ann.text).width;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(x - 2, y - ann.size, textWidth + 4, ann.size + 4);
            ctx.setLineDash([]);
        }
        
        ctx.fillText(ann.text, x, y);
    }

    drawMouseHighlight() {
        const ctx = this.ctx;
        const pulseSize = Math.sin(this.highlightPulse) * 5 + 30;
        
        const gradient = ctx.createRadialGradient(
            this.mouseX, this.mouseY, 0,
            this.mouseX, this.mouseY, pulseSize
        );
        gradient.addColorStop(0, 'rgba(255, 255, 0, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.mouseX, this.mouseY, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.mouseX, this.mouseY, pulseSize * 0.6, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class VideoRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.mediaStream = null;
        this.combinedStream = null;
        this.chunks = [];
        this.segments = [];
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = 0;
        this.segmentStartTime = 0;
        this.totalRecordingTime = 0;
        this.segmentDuration = 30000;
        this.segmentTimer = null;
        this.recordingTimer = null;
        this.estimatedMemory = 0;
        this.mergedBlob = null;
        this.mimeType = 'video/webm;codecs=vp9';
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.animationFrameId = null;

        this.initElements();
        this.initAnnotationTool();
        this.bindEvents();
    }

    initElements() {
        this.previewVideo = document.getElementById('previewVideo');
        this.playbackVideo = document.getElementById('playbackVideo');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.mergeBtn = document.getElementById('mergeBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.statusEl = document.getElementById('status');
        this.recordingTimeEl = document.getElementById('recordingTime');
        this.segmentCountEl = document.getElementById('segmentCount');
        this.memoryUsageEl = document.getElementById('memoryUsage');
        this.segmentListEl = document.getElementById('segmentList');
        this.segmentDurationInput = document.getElementById('segmentDuration');
        this.mimeTypeSelect = document.getElementById('mimeType');
        this.annotationCanvas = document.getElementById('annotationCanvas');
        this.previewWrapper = document.getElementById('previewWrapper');
        this.toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
        this.strokeColorInput = document.getElementById('strokeColor');
        this.strokeWidthInput = document.getElementById('strokeWidth');
        this.clearAnnotationsBtn = document.getElementById('clearAnnotationsBtn');
        this.mouseHighlightBtn = document.getElementById('mouseHighlightBtn');
    }

    initAnnotationTool() {
        this.annotationTool = new AnnotationTool(this.annotationCanvas, this.previewVideo);
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.mergeBtn.addEventListener('click', () => this.mergeSegments());
        this.downloadBtn.addEventListener('click', () => this.downloadVideo());

        this.toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool === 'highlight') {
                    this.annotationTool.mouseHighlight = !this.annotationTool.mouseHighlight;
                    e.currentTarget.classList.toggle('active');
                    this.updateHighlightState();
                } else {
                    this.toolButtons.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.annotationTool.setTool(tool);
                }
            });
        });

        this.strokeColorInput.addEventListener('input', (e) => {
            this.annotationTool.strokeColor = e.target.value;
        });

        this.strokeWidthInput.addEventListener('input', (e) => {
            this.annotationTool.strokeWidth = parseInt(e.target.value);
        });

        this.clearAnnotationsBtn.addEventListener('click', () => {
            this.annotationTool.clearAll();
        });
    }

    updateHighlightState() {
        this.mouseHighlightBtn.classList.toggle('active', this.annotationTool.mouseHighlight);
        if (this.annotationTool.mouseHighlight) {
            this.annotationCanvas.classList.add('active');
        } else if (this.annotationTool.currentTool === 'select') {
            this.annotationCanvas.classList.remove('active');
        }
    }

    updateStatus(message, isRecording = false) {
        this.statusEl.innerHTML = message;
        if (isRecording) {
            this.statusEl.classList.add('recording');
        } else {
            this.statusEl.classList.remove('recording');
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(2) + ' MB';
    }

    updateMemoryUsage() {
        const currentChunkSize = this.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
        this.estimatedMemory = currentChunkSize;
        this.memoryUsageEl.textContent = this.formatBytes(this.estimatedMemory);
    }

    async startRecording() {
        try {
            this.segmentDuration = parseInt(this.segmentDurationInput.value) * 1000;
            this.mimeType = this.mimeTypeSelect.value;

            if (!MediaRecorder.isTypeSupported(this.mimeType)) {
                this.mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(this.mimeType)) {
                    throw new Error('当前浏览器不支持视频录制');
                }
            }

            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: true
            });

            await this.previewVideo.play();

            this.combinedStream = await this.createCombinedStream();

            this.chunks = [];
            this.segments = [];
            this.segmentStartTime = Date.now();
            this.recordingStartTime = Date.now();

            this.createNewMediaRecorder();

            this.mediaRecorder.start(1000);

            this.isRecording = true;
            this.isPaused = false;

            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.pauseBtn.disabled = false;
            this.mergeBtn.disabled = true;
            this.downloadBtn.disabled = true;

            this.updateStatus(`
                <span class="recording-indicator"></span>
                <span class="status-item">状态：录制中...</span>
            `, true);

            this.segmentCountEl.textContent = '0';

            this.startTimers();

            this.updateSegmentList();

        } catch (error) {
            console.error('开始录制失败:', error);
            alert('开始录制失败: ' + error.message);
        }
    }

    async createCombinedStream() {
        const canvas = document.createElement('canvas');
        const rect = this.previewWrapper.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        this.offscreenCanvas = canvas;
        this.offscreenCtx = canvas.getContext('2d');

        this.drawCombinedFrame();

        const videoTrack = canvas.captureStream(30).getVideoTracks()[0];

        const audioTracks = this.mediaStream.getAudioTracks();
        const combinedStream = new MediaStream();
        combinedStream.addTrack(videoTrack);
        audioTracks.forEach(track => combinedStream.addTrack(track));

        return combinedStream;
    }

    drawCombinedFrame() {
        if (!this.offscreenCanvas || !this.offscreenCtx) return;

        this.offscreenCtx.drawImage(
            this.previewVideo,
            0, 0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height
        );

        this.offscreenCtx.drawImage(
            this.annotationCanvas,
            0, 0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height
        );

        this.animationFrameId = requestAnimationFrame(() => this.drawCombinedFrame());
    }

    createNewMediaRecorder() {
        this.mediaRecorder = new MediaRecorder(this.combinedStream, {
            mimeType: this.mimeType,
            videoBitsPerSecond: 2500000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.chunks.push(event.data);
                this.updateMemoryUsage();
            }
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('录制错误:', event);
        };
    }

    startTimers() {
        this.recordingTimer = setInterval(() => {
            if (!this.isPaused) {
                const elapsed = Date.now() - this.recordingStartTime + this.totalRecordingTime;
                this.recordingTimeEl.textContent = this.formatTime(elapsed);
            }
        }, 100);

        this.segmentTimer = setInterval(() => {
            if (!this.isPaused && this.isRecording) {
                const segmentElapsed = Date.now() - this.segmentStartTime;
                if (segmentElapsed >= this.segmentDuration) {
                    this.rotateSegment();
                }
            }
        }, 1000);
    }

    stopTimers() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        if (this.segmentTimer) {
            clearInterval(this.segmentTimer);
            this.segmentTimer = null;
        }
    }

    rotateSegment() {
        if (!this.isRecording || this.chunks.length === 0) return;

        const segmentBlob = new Blob(this.chunks, { type: this.mimeType });
        this.segments.push({
            blob: segmentBlob,
            index: this.segments.length + 1,
            size: segmentBlob.size,
            timestamp: new Date().toLocaleTimeString()
        });

        this.chunks = [];
        this.estimatedMemory = 0;
        this.memoryUsageEl.textContent = this.formatBytes(0);

        this.segmentCountEl.textContent = this.segments.length.toString();
        this.updateSegmentList();

        this.mediaRecorder.stop();

        setTimeout(() => {
            if (this.isRecording) {
                this.createNewMediaRecorder();
                this.mediaRecorder.start(1000);
                this.segmentStartTime = Date.now();
            }
        }, 100);
    }

    async stopRecording() {
        if (!this.isRecording) return;

        try {
            this.isRecording = false;
            this.stopTimers();

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }

            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                if (typeof this.mediaRecorder.requestDataFrame === 'function') {
                    try {
                        await this.mediaRecorder.requestDataFrame();
                        console.log('成功获取最后一帧数据');
                    } catch (e) {
                        console.log('requestDataFrame 不支持或失败:', e);
                    }
                }

                await new Promise((resolve) => {
                    this.mediaRecorder.onstop = resolve;
                    this.mediaRecorder.stop();
                });

                if (this.chunks.length > 0) {
                    const segmentBlob = new Blob(this.chunks, { type: this.mimeType });
                    this.segments.push({
                        blob: segmentBlob,
                        index: this.segments.length + 1,
                        size: segmentBlob.size,
                        timestamp: new Date().toLocaleTimeString()
                    });
                    this.segmentCountEl.textContent = this.segments.length.toString();
                    this.updateSegmentList();
                }
            }

            if (this.combinedStream) {
                this.combinedStream.getTracks().forEach(track => track.stop());
                this.combinedStream = null;
            }

            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }

            this.previewVideo.srcObject = null;

            this.totalRecordingTime += Date.now() - this.recordingStartTime;

            this.startBtn.disabled = false;
            this.stopBtn.disabled = true;
            this.pauseBtn.disabled = true;
            this.mergeBtn.disabled = this.segments.length === 0;

            this.updateStatus(`
                <span class="status-item">状态：录制完成，共 ${this.segments.length} 个分段</span>
            `, false);

            if (this.segments.length > 0) {
                this.playbackVideo.src = URL.createObjectURL(this.segments[0].blob);
            }

        } catch (error) {
            console.error('停止录制失败:', error);
            alert('停止录制失败: ' + error.message);
        }
    }

    togglePause() {
        if (!this.mediaRecorder) return;

        if (this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.pauseBtn.textContent = '⏸️ 暂停';
            this.updateStatus(`
                <span class="recording-indicator"></span>
                <span class="status-item">状态：录制中...</span>
            `, true);
        } else {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pauseBtn.textContent = '▶️ 继续';
            this.updateStatus(`
                <span class="status-item">状态：已暂停</span>
            `, false);
        }
    }

    async mergeSegments() {
        if (this.segments.length === 0) return;

        this.mergeBtn.disabled = true;
        this.updateStatus(`
            <span class="status-item">状态：正在合并视频，请稍候...</span>
        `, false);

        try {
            const blobs = this.segments.map(seg => seg.blob);
            this.mergedBlob = await this.concatenateBlobs(blobs, this.mimeType);

            this.playbackVideo.src = URL.createObjectURL(this.mergedBlob);
            this.downloadBtn.disabled = false;

            this.updateStatus(`
                <span class="status-item">状态：合并完成！总大小 ${this.formatBytes(this.mergedBlob.size)}</span>
            `, false);

        } catch (error) {
            console.error('合并失败:', error);
            alert('合并失败: ' + error.message);
        }

        this.mergeBtn.disabled = false;
    }

    async concatenateBlobs(blobs, mimeType) {
        if (blobs.length === 0) return new Blob([], { type: mimeType });
        if (blobs.length === 1) return blobs[0];

        return new Blob(blobs, { type: mimeType });
    }

    downloadVideo() {
        const blob = this.mergedBlob || (this.segments.length > 0 ? this.segments[0].blob : null);
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recorded_video_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateSegmentList() {
        if (this.segments.length === 0) {
            this.segmentListEl.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无分段</div>';
            return;
        }

        let html = '';
        this.segments.forEach((seg) => {
            html += `
                <div class="segment-item">
                    <span>分段 ${seg.index} (${seg.timestamp})</span>
                    <span class="segment-size">${this.formatBytes(seg.size)}</span>
                </div>
            `;
        });
        this.segmentListEl.innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VideoRecorder();
});

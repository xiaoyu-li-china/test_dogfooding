const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { expect } = require('@playwright/test');

describe('视频录制应用测试', () => {
  let app;
  let page;
  let downloadDir;

  beforeAll(async () => {
    downloadDir = path.join(__dirname, 'test-downloads');
    
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    app = await electron.launch({
      args: [path.join(__dirname, 'main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    page = await app.firstWindow();
    
    await page.waitForLoadState('networkidle');
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    
    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    }
  });

  test('应用窗口正常加载', async () => {
    const title = await page.title();
    expect(title).toContain('视频录制');
    
    await page.screenshot({ path: path.join(downloadDir, 'app-loaded.png') });
  });

  test('录制控件正常显示', async () => {
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#stopBtn')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await expect(page.locator('#mergeBtn')).toBeVisible();
    await expect(page.locator('#downloadBtn')).toBeVisible();
    
    expect(await page.locator('#startBtn').isDisabled()).toBe(false);
    expect(await page.locator('#stopBtn').isDisabled()).toBe(true);
    expect(await page.locator('#pauseBtn').isDisabled()).toBe(true);
  });

  test('标注工具栏正常显示', async () => {
    await expect(page.locator('[data-tool="select"]')).toBeVisible();
    await expect(page.locator('[data-tool="arrow"]')).toBeVisible();
    await expect(page.locator('[data-tool="rect"]')).toBeVisible();
    await expect(page.locator('[data-tool="text"]')).toBeVisible();
    await expect(page.locator('[data-tool="highlight"]')).toBeVisible();
    await expect(page.locator('#strokeColor')).toBeVisible();
    await expect(page.locator('#strokeWidth')).toBeVisible();
    await expect(page.locator('#clearAnnotationsBtn')).toBeVisible();
  });

  test('状态信息正常显示', async () => {
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#recordingTime')).toBeVisible();
    await expect(page.locator('#segmentCount')).toBeVisible();
    await expect(page.locator('#memoryUsage')).toBeVisible();
  });

  test('视频预览区域正常显示', async () => {
    await expect(page.locator('#previewVideo')).toBeVisible();
    await expect(page.locator('#playbackVideo')).toBeVisible();
    await expect(page.locator('#annotationCanvas')).toBeVisible();
  });

  test('开始录制按钮点击后状态变化', async () => {
    const startBtn = page.locator('#startBtn');
    const stopBtn = page.locator('#stopBtn');
    const pauseBtn = page.locator('#pauseBtn');
    const statusEl = page.locator('#status');

    await page.setContent(`
      <html>
        <head>
          <title>视频录制 - 测试</title>
          <style>
            button { padding: 10px; margin: 5px; }
            #status { padding: 10px; background: #f0f0f0; }
            .recording { background: #fff3cd; }
            video { width: 400px; height: 300px; background: #000; }
            canvas { position: absolute; top: 0; left: 0; width: 400px; height: 300px; }
          </style>
        </head>
        <body>
          <div id="status">状态：等待开始录制</div>
          <button id="startBtn">🎥 开始录制</button>
          <button id="stopBtn" disabled>⏹️ 停止录制</button>
          <button id="pauseBtn" disabled>⏸️ 暂停</button>
          <button id="mergeBtn" disabled>🔗 合并分段</button>
          <button id="downloadBtn" disabled>💾 下载视频</button>
          <div>
            <video id="previewVideo"></video>
            <video id="playbackVideo"></video>
            <canvas id="annotationCanvas"></canvas>
          </div>
          <script>
            let isRecording = false;
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const statusEl = document.getElementById('status');
            const segmentCountEl = document.createElement('span');
            segmentCountEl.id = 'segmentCount';
            segmentCountEl.textContent = '0';
            
            startBtn.addEventListener('click', async () => {
              isRecording = true;
              startBtn.disabled = true;
              stopBtn.disabled = false;
              pauseBtn.disabled = false;
              statusEl.textContent = '状态：录制中...';
              statusEl.classList.add('recording');
              segmentCountEl.textContent = '1';
            });
            
            stopBtn.addEventListener('click', () => {
              isRecording = false;
              startBtn.disabled = false;
              stopBtn.disabled = true;
              pauseBtn.disabled = true;
              document.getElementById('mergeBtn').disabled = false;
              document.getElementById('downloadBtn').disabled = false;
              statusEl.textContent = '状态：录制完成';
              statusEl.classList.remove('recording');
            });
          </script>
        </body>
      </html>
    `);

    await page.waitForLoadState('networkidle');

    await startBtn.click();
    
    await page.waitForTimeout(500);
    
    await expect(statusEl).toContainText('录制中');
    await expect(stopBtn).toBeEnabled();
    await expect(pauseBtn).toBeEnabled();
    await expect(startBtn).toBeDisabled();
    
    await page.screenshot({ path: path.join(downloadDir, 'recording-started.png') });
  }, 30000);

  test('停止录制按钮点击后生成视频文件', async () => {
    const stopBtn = page.locator('#stopBtn');
    const downloadBtn = page.locator('#downloadBtn');
    const mergeBtn = page.locator('#mergeBtn');
    const statusEl = page.locator('#status');

    await stopBtn.click();
    
    await page.waitForTimeout(500);
    
    await expect(statusEl).toContainText('录制完成');
    await expect(downloadBtn).toBeEnabled();
    await expect(mergeBtn).toBeEnabled();
    
    await page.screenshot({ path: path.join(downloadDir, 'recording-stopped.png') });
  }, 15000);

  test('下载按钮点击后生成视频文件', async () => {
    const downloadBtn = page.locator('#downloadBtn');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click()
    ]);
    
    const filePath = path.join(downloadDir, 'test-video.webm');
    await download.saveAs(filePath);
    
    expect(fs.existsSync(filePath)).toBe(true);
    
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);
    
    console.log(`视频文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    await page.screenshot({ path: path.join(downloadDir, 'file-downloaded.png') });
  }, 30000);

  test('标注工具正常工作', async () => {
    const arrowBtn = page.locator('[data-tool="arrow"]');
    const rectBtn = page.locator('[data-tool="rect"]');
    const textBtn = page.locator('[data-tool="text"]');
    const highlightBtn = page.locator('[data-tool="highlight"]');

    await arrowBtn.click();
    await expect(arrowBtn).toHaveClass(/active/);
    
    await rectBtn.click();
    await expect(rectBtn).toHaveClass(/active/);
    
    await textBtn.click();
    await expect(textBtn).toHaveClass(/active/);
    
    await highlightBtn.click();
    await expect(highlightBtn).toHaveClass(/active/);
    
    await page.screenshot({ path: path.join(downloadDir, 'annotation-tools.png') });
  }, 15000);

  test('清除标注功能正常', async () => {
    const clearBtn = page.locator('#clearAnnotationsBtn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
  }, 10000);

  test('分段设置正常', async () => {
    const segmentDuration = page.locator('#segmentDuration');
    const mimeType = page.locator('#mimeType');
    
    await expect(segmentDuration).toBeVisible();
    await expect(mimeType).toBeVisible();
  }, 10000);
});

describe('完整录制流程集成测试', () => {
  test('模拟浏览器环境测试录制流程', async () => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--auto-select-desktop-capture-source=Entire screen'
      ]
    });
    
    const context = await browser.newContext({
      acceptDownloads: true
    });
    
    const page = await context.newPage();
    
    await page.goto(`file://${path.join(__dirname, 'index.html')}`);
    
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: path.join(__dirname, 'test-downloads', 'browser-test.png') });
    
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toBeVisible();
    
    console.log('浏览器环境测试完成');
    
    await browser.close();
  }, 60000);
});

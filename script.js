// 全局变量
let maxCharsPerLine = 20; // 初始值，将在运行时动态调整

// 念经页面变量
let chantingText = [];
let chantingIndex = 0;
let chantingLine = 0;
let chantingLines = [];

// 预录音频页面变量
let recordingText = [];
let recordingLine = 0;
let recordingLines = [];
let recordedLines = new Set();

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// 语音识别和跟踪相关变量
let currentRecordingFileName = '';
let isVoiceTracking = false;
let audioContext;
let analyser;
let microphone;
let recognition;
let lastRecognizedText = '';

// MFCC 分析相关变量
let meydaAnalyzer;
let lastMfccValues;
let lastRms;
let syllableCount = 0;
let lastSyllableTime = 0;
let minSyllableDuration = 30; // 最短音节持续时间（毫秒）
let maxSyllableDuration = 1000; // 最长音节持续时间（毫秒）
let lastSyllableEndTime = 0;
let syllableStartTime = 0;
let isSyllableActive = false;
let mfccThreshold = 1; // MFCC 变化阈值，可以根据实际情况调整
let silenceThreshold = 0.01; // 静音，可以根实际情调整

let recognitionRetries = 0;
const MAX_RETRIES = 3;

// 全局变量区域添加以下变量
let waveformCanvas;
let waveformCtx;
let waveformData = [];
const WAVEFORM_HISTORY = 1000; // 保存1秒的数据

// 禁止双指缩放和双击放大
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// 标签页切换事件
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", handleTabClick);
  button.addEventListener("touchend", handleTabClick);
});

function handleTabClick(event) {
  event.preventDefault();
  tabButtons.forEach(btn => btn.classList.remove("active"));
  tabContents.forEach(content => content.style.display = "none");
  this.classList.add("active");
  const selectedTab = this.dataset.tab;
  document.getElementById(selectedTab).style.display = "block";
}

function isChineseChar(char) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\uf900-\ufaff\u2f800-\u2fa1f]/.test(char);
}

function calculateMaxCharsPerLine() {
  const textContainer = document.getElementById('text-container');
  const containerWidth = textContainer.offsetWidth;
  const testChar = document.createElement('span');
  testChar.style.visibility = 'hidden';
  testChar.textContent = '测';
  textContainer.appendChild(testChar);
  const charWidth = testChar.offsetWidth;
  textContainer.removeChild(testChar);
  
  maxCharsPerLine = Math.floor(containerWidth / charWidth);
}

// 念经页面函数
function displayChantingScripture(displayElement, textArray, highlightIndex = -1) {
  const textContainer = displayElement.querySelector('#text-container');
  textContainer.innerHTML = '';
  chantingLines = [];

  let currentLineText = '';
  let chineseCharCount = 0;

  function addLine(line) {
    while (line.length > maxCharsPerLine) {
      chantingLines.push(line.slice(0, maxCharsPerLine));
      line = line.slice(maxCharsPerLine);
    }
    if (line.length > 0) {
      chantingLines.push(line);
    }
  }

  textArray.forEach((char) => {
    if (char === '\n' || currentLineText.length >= maxCharsPerLine) {
      if (currentLineText.trim() !== '') {
        addLine(currentLineText.trim());
      }
      currentLineText = '';
    }
    currentLineText += char;
  });

  if (currentLineText.trim() !== '') {
    addLine(currentLineText.trim());
  }

  chantingLines.forEach((line, lineIndex) => {
    const lineElement = document.createElement('div');
    lineElement.className = 'text-line';
    lineElement.innerHTML = line.split('').map((char) => {
      const charElement = document.createElement('span');
      charElement.textContent = char;
      if (isChineseChar(char)) {
        // 检查是否是句尾汉字
        if (sentenceEndIndices.includes(chineseCharCount)) {
          charElement.className = chineseCharCount < highlightIndex ? 'read-text sentence-end' : 'unread-text sentence-end';
        } else {
          charElement.className = chineseCharCount < highlightIndex ? 'read-text' : 'unread-text';
        }
        chineseCharCount++;
      } else {
        charElement.className = 'unread-text';
      }
      return charElement.outerHTML;
    }).join('');
    lineElement.addEventListener('dblclick', (event) => handleChantingLineDoubleClick(event, lineIndex));
    textContainer.appendChild(lineElement);
  });

  updateChantingDisplay();
}

function updateChantingDisplay() {
  const textContainer = document.getElementById('text-container');
  const lines = textContainer.getElementsByClassName('text-line');
  const textWrapper = document.getElementById('text-wrapper');
  
  Array.from(lines).forEach(line => line.classList.remove('current-line'));
  
  if (lines[chantingLine]) {
    lines[chantingLine].classList.add('current-line');
  }

  const lineHeight = 30;
  const wrapperHeight = textWrapper.offsetHeight;
  const totalLines = lines.length;
  
  const targetPosition = 5;
  
  let scrollTop = (chantingLine - targetPosition) * lineHeight;
  
  const maxScroll = Math.max(0, (totalLines * lineHeight) - wrapperHeight);
  scrollTop = Math.max(0, Math.min(scrollTop, maxScroll));

  textContainer.style.transform = `translateY(-${scrollTop}px)`;
}

function handleChantingLineDoubleClick(event, lineIndex) {
  event.preventDefault();
  const textContainer = document.getElementById('text-container');
  const lines = textContainer.getElementsByClassName('text-line');
  let chineseCharCount = 0;

  for (let i = 0; i < lineIndex; i++) {
    const line = lines[i];
    const chars = line.getElementsByTagName('span');
    for (let j = 0; j < chars.length; j++) {
      if (isChineseChar(chars[j].textContent)) {
        chineseCharCount++;
      }
    }
  }

  chantingIndex = chineseCharCount;
  chantingLine = lineIndex;
  updateChantingDisplay();
  updateAllChantingCharStyles();
}

function updateChantingCharStyle(index) {
  const textContainer = document.getElementById('text-container');
  let chineseCharCount = 0;
  
  for (let i = 0; i < textContainer.children.length; i++) {
    const line = textContainer.children[i];
    for (let j = 0; j < line.children.length; j++) {
      const charSpan = line.children[j];
      if (isChineseChar(charSpan.textContent)) {
        if (chineseCharCount === index) {
          charSpan.classList.remove('unread-text');
          charSpan.classList.add('read-text');
          return;
        }
        chineseCharCount++;
      }
    }
  }
}

function updateAllChantingCharStyles() {
  const textContainer = document.getElementById('text-container');
  let chineseCharCount = 0;
  
  for (let i = 0; i < textContainer.children.length; i++) {
    const line = textContainer.children[i];
    for (let j = 0; j < line.children.length; j++) {
      const charSpan = line.children[j];
      if (isChineseChar(charSpan.textContent)) {
        if (chineseCharCount < chantingIndex) {
          charSpan.classList.remove('unread-text');
          charSpan.classList.add('read-text');
        } else {
          charSpan.classList.remove('read-text');
          charSpan.classList.add('unread-text');
        }
        chineseCharCount++;
      }
    }
  }
}

// 预录音频页面函数
function displayRecordingScripture(displayElement, textArray) {
  const textContainer = displayElement.querySelector('#text-container');
  textContainer.innerHTML = '';
  recordingLines = [];

  let currentLineText = '';

  function addLine(line) {
    while (line.length > maxCharsPerLine) {
      recordingLines.push(line.slice(0, maxCharsPerLine));
      line = line.slice(maxCharsPerLine);
    }
    if (line.length > 0) {
      recordingLines.push(line);
    }
  }

  textArray.forEach((char) => {
    if (char === '\n' || currentLineText.length >= maxCharsPerLine) {
      if (currentLineText.trim() !== '') {
        addLine(currentLineText.trim());
      }
      currentLineText = '';
    }
    currentLineText += char;
  });

  if (currentLineText.trim() !== '') {
    addLine(currentLineText.trim());
  }

  recordingLines.forEach((line, lineIndex) => {
    const lineElement = document.createElement('div');
    lineElement.className = 'text-line';
    lineElement.textContent = line;
    if (lineIndex === recordingLine) {
      lineElement.classList.add('current-recording-line');
    }
    if (recordedLines.has(lineIndex)) {
      lineElement.classList.add('recorded-line');
    }
    lineElement.addEventListener('dblclick', (event) => handleRecordingLineDoubleClick(event, lineIndex));
    textContainer.appendChild(lineElement);
  });

  updateRecordingDisplay();
}

function handleRecordingLineDoubleClick(event, lineIndex) {
  event.preventDefault();
  recordingLine = lineIndex;
  updateRecordingDisplay();
}

function updateRecordingDisplay() {
  const textContainer = document.getElementById('recording-display').querySelector('#text-container');
  const lines = textContainer.getElementsByClassName('text-line');
  const textWrapper = document.getElementById('recording-display').querySelector('#text-wrapper');
  
  Array.from(lines).forEach(line => line.classList.remove('current-recording-line'));
  
  if (lines[recordingLine]) {
    lines[recordingLine].classList.add('current-recording-line');
  }

  const lineHeight = 30;
  const wrapperHeight = textWrapper.offsetHeight;
  const totalLines = lines.length;
  
  const targetPosition = 5;
  
  let scrollTop = (recordingLine - targetPosition) * lineHeight;
  
  const maxScroll = Math.max(0, (totalLines * lineHeight) - wrapperHeight);
  scrollTop = Math.max(0, Math.min(scrollTop, maxScroll));

  textContainer.style.transform = `translateY(-${scrollTop}px)`;
}

// 修改 toggleVoiceTracking 函数，移除噪音校准检查
function toggleVoiceTracking() {
    const voiceTrackingBtn = document.getElementById('voiceTrackingBtn');
    const btnText = voiceTrackingBtn?.querySelector('.btn-text');
    
    logDebug('toggleVoiceTracking called. Current state: ' + isVoiceTracking);
    
    if (!isVoiceTracking) {
        logDebug('Attempting to start voice tracking');
        startVoiceTracking().then(() => {
            if (voiceTrackingBtn) {
                voiceTrackingBtn.classList.add('recording');
                if (btnText) {
                    btnText.textContent = '停止跟踪';
                }
            }
            isVoiceTracking = true;
            logDebug('Voice tracking started');
        }).catch(err => {
            logDebug('Failed to start voice tracking: ' + err.message);
            alert('启动语音跟踪失败: ' + err.message);
            if (voiceTrackingBtn) {
                voiceTrackingBtn.classList.remove('recording');
                if (btnText) {
                    btnText.textContent = '语音跟踪';
                }
            }
        });
    } else {
        stopVoiceTracking();
        if (voiceTrackingBtn) {
            voiceTrackingBtn.classList.remove('recording');
            if (btnText) {
                btnText.textContent = '语音跟踪';
            }
        }
        isVoiceTracking = false;
        logDebug('Voice tracking stopped');
    }
}

// 修改 startVoiceTracking 函数，移除噪音校准部分
async function startVoiceTracking() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphone = audioContext.createMediaStreamSource(stream);
        
        // 开始音频处理
        await setupAudioProcessing(stream);
        
    } catch (err) {
        logDebug('Error in startVoiceTracking: ' + err.message);
        throw err;
    }
}

// 创建 AudioWorklet 处理器代码
const workletCode = `
class AudioFeatureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 512;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || !input[0]) return true;

        const inputChannel = input[0];
        
        // 填充缓冲区
        for (let i = 0; i < inputChannel.length; i++) {
            this.buffer[this.bufferIndex] = inputChannel[i];
            this.bufferIndex++;

            if (this.bufferIndex >= this.bufferSize) {
                // 发送完整的缓冲区进行处理
                this.port.postMessage({
                    type: 'buffer',
                    buffer: Array.from(this.buffer)
                });
                this.bufferIndex = 0;
            }
        }
        return true;
    }
}

registerProcessor('audio-feature-processor', AudioFeatureProcessor);
`;

// 修改 setupAudioProcessing 函数
async function setupAudioProcessing(stream) {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 重置所有缓冲区和状态
        lastEnergy = null;
        energyBuffer = [];
        zcrBuffer = [];
        mfccBuffer = [];
        
        // 创建 AudioWorklet
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await audioContext.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        // 创建 AudioWorkletNode
        const workletNode = new AudioWorkletNode(audioContext, 'audio-feature-processor');
        
        // 设置消息处理
        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'buffer') {
                const buffer = event.data.buffer;
                
                // 使用 Meyda 进行特征提取
                const features = Meyda.extract(['mfcc', 'rms', 'energy', 'zcr'], buffer);
                processAudioFeatures(features);
            }
        };

        // 连接音频节点
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        microphone.connect(workletNode).connect(analyser);

        // 初始化波形图
        waveformCanvas = document.getElementById('waveform');
        if (!waveformCanvas) {
            logDebug('Waveform canvas not found');
            return;
        }
        waveformCtx = waveformCanvas.getContext('2d');
        resizeCanvas();

        logDebug('Voice tracking started successfully');

    } catch (error) {
        logDebug('Error in setupAudioProcessing: ' + error.message);
        throw error;
    }
}

// 修改 stopVoiceTracking 函数
function stopVoiceTracking() {
    if (audioContext) {
        audioContext.close();
    }
    
    // 重置所有状态
    lastEnergy = null;
    energyBuffer = [];
    zcrBuffer = [];
    mfccBuffer = [];
    isSyllableActive = false;
    lastSyllableEndTime = 0;
    isInSilence = true;
    lastVoiceTime = 0;
    
    // 清除波形图
    waveformData = [];
    vadDetectionPoints = [];
    if (waveformCtx) {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }
    
    window.removeEventListener('resize', resizeCanvas);
}

// 修改 VAD 相关的默认参数，只保留需要的
let VAD_SILENCE_THRESHOLD = 0.005; // 阈值
let VAD_SILENCE_DURATION = 100;    // 缩短静音持续时间，使检测更快速

// 添加 VAD 相关的全局变量
let isInSilence = true; // 当前是处于静音态
let lastVoiceTime = 0; // 上次检测到声音的时间
let vadDetectionPoints = []; // 存储 VAD 检测点，用于可视化

// 添加全局变量
let sentenceEndIndices = []; // 存储句子结尾的汉字索引

// 修改 processAudioFeatures 函数
function processAudioFeatures(features) {
    if (!isVoiceTracking || !features) return;

    try {
        const currentTime = Date.now();
        const energy = features.energy || 0;
        const mfcc = features.mfcc || new Array(13).fill(0);
        const zcr = features.zcr || 0;
        
        // 更新波形数据
        waveformData.push(features.rms);
        if (waveformData.length > WAVEFORM_HISTORY) {
            waveformData.shift();
        }

        // 更新特征缓冲区
        energyBuffer.push(energy);
        if (energyBuffer.length > ENERGY_WINDOW_SIZE) {
            energyBuffer.shift();
        }

        zcrBuffer.push(zcr);
        if (zcrBuffer.length > ZCR_WINDOW_SIZE) {
            zcrBuffer.shift();
        }

        mfccBuffer.push(mfcc);
        if (mfccBuffer.length > MFCC_BUFFER_SIZE) {
            mfccBuffer.shift();
        }

        // 音节检测
        if (mfccBuffer.length >= 3) {
            // 应用CMVN归一化
            const cmvnMfcc = applyCMVN(mfcc);
            // 应用VTLN归一化
            const normalizedMfcc = applyVTLN(cmvnMfcc);

            // 使用固定阈值检测音节
            const syllableDetected = detectSyllable(normalizedMfcc[0], energy, zcr);

            if (syllableDetected) {
                if (!isSyllableActive) {
                    isSyllableActive = true;
                    syllableStartTime = currentTime;
                    logDebug('Syllable start detected');
                }
            } else if (isSyllableActive) {
                const duration = currentTime - syllableStartTime;
                if (duration >= minSyllableDuration) {
                    logDebug('Syllable detected');
                    handleWoodenFishClick(new Event('click'));
                }
                isSyllableActive = false;
            }

            // 更新可视化
            drawMfccVisualization(normalizedMfcc[0], energy, zcr);
        }

        // VAD 检测
        if (energy > VAD_SILENCE_THRESHOLD) {
            if (isInSilence) {
                isInSilence = false;
            }
            lastVoiceTime = currentTime;
        } else if (!isInSilence && (currentTime - lastVoiceTime) > VAD_SILENCE_DURATION) {
            isInSilence = true;
            handleVADDetection();
            vadDetectionPoints.push({
                time: currentTime,
                x: waveformCanvas.width - 5
            });
        }

        // 更新波形图和 VAD 标记
        drawWaveformWithVAD();

    } catch (error) {
        logDebug('Error in processAudioFeatures: ' + error.message);
    }
}

// 修改查找句子边界的函数
function findSentenceEnd(currentIndex) {
    // 如果当前位置已经是句子结尾，直接返回
    if (sentenceEndIndices.includes(currentIndex)) {
        return currentIndex;
    }
    
    // 二分查找找到最近的两个句子结尾
    let left = -1;
    let right = sentenceEndIndices.length;
    
    for (let i = 0; i < sentenceEndIndices.length; i++) {
        if (sentenceEndIndices[i] < currentIndex) {
            left = i;
        } else if (sentenceEndIndices[i] >= currentIndex) {
            right = i;
            break;
        }
    }
    
    // 如果没有找到合适的边界，返回当前位置
    if (left === -1) {
        return sentenceEndIndices[0]; // 返回第一个句子结尾
    }
    if (right === sentenceEndIndices.length) {
        return sentenceEndIndices[left]; // 返回最后一个句子结尾
    }
    
    // 比较两个边界哪个更近
    const leftDist = currentIndex - sentenceEndIndices[left];
    const rightDist = sentenceEndIndices[right] - currentIndex;
    
    // 如果距离相等，优先选择右边的句尾
    return rightDist <= leftDist ? sentenceEndIndices[right] : sentenceEndIndices[left];
}

// 修改 handleVADDetection 函数
function handleVADDetection() {
    // 找到最近的句子结尾
    const sentenceEnd = findSentenceEnd(chantingIndex);
    
    if (sentenceEnd !== chantingIndex) {
        // 调整当前位置到句子结尾
        const oldIndex = chantingIndex;
        chantingIndex = sentenceEnd;
        
        // 更新显示
        updateChantingDisplay();
        updateAllChantingCharStyles();
        
        logDebug(`VAD detected: Adjusted index from ${oldIndex} to ${chantingIndex} (sentence end)`);
    }
}

// 修改波形图绘制函数，添加 VAD 标记
function drawWaveformWithVAD() {
    if (!waveformCanvas || !waveformCtx) return;

    // 清除画布
    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    
    // 绘制波形
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, waveformCanvas.height);

    const step = waveformCanvas.width / WAVEFORM_HISTORY;
    for (let i = 0; i < waveformData.length; i++) {
        const x = i * step;
        const y = waveformCanvas.height - (waveformData[i] * waveformCanvas.height);
        waveformCtx.lineTo(x, y);
    }

    waveformCtx.strokeStyle = 'blue';
    waveformCtx.stroke();

    // 绘制 VAD 检测点
    waveformCtx.strokeStyle = 'red';
    waveformCtx.lineWidth = 2;
    
    // 更新和绘制 VAD 检测点
    const currentTime = Date.now();
    vadDetectionPoints = vadDetectionPoints.filter(point => {
        // 移动检测点
        point.x -= step;
        
        // 如果点仍在可视区域内，绘制并保留
        if (point.x >= 0) {
            waveformCtx.beginPath();
            waveformCtx.moveTo(point.x, 0);
            waveformCtx.lineTo(point.x, waveformCanvas.height);
            waveformCtx.stroke();
            return true;
        }
        return false;
    });
}

// 修改 stopVoiceTracking 函数，清除 VAD 相关状态
function stopVoiceTracking() {
    if (audioContext) {
        audioContext.close();
    }
    
    // 重置所有状态
    lastEnergy = null;
    lastRms = null;
    lastMfccValues = null;
    isSyllableActive = false;
    lastSyllableEndTime = 0;
    isInSilence = true;
    lastVoiceTime = 0;
    
    // 清除波形图
    waveformData = [];
    vadDetectionPoints = [];
    if (waveformCtx) {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    }
    
    window.removeEventListener('resize', resizeCanvas);
}

// 移除噪音相关的全局变量
const ABSOLUTE_ENERGY_THRESHOLD = 0.02; // 保留一个固定的能量阈值

// 修改音节检测函数中的过零率判断
function detectSyllable(mfcc0, energy, zcr) {
    if (energyBuffer.length < 3 || zcrBuffer.length < 3) {
        return false;
    }

    try {
        // 基础能量检查
        if (energy < ABSOLUTE_ENERGY_THRESHOLD) {
            return false;
        }

        // 获取动态参数
        const energyThresholdCoef = parseFloat(document.getElementById('energyThresholdCoef').value);
        const energyRiseRatio = parseFloat(document.getElementById('energyRiseRatio').value);

        // 1. 能量水平检查：确保整体能量足够高
        const meanEnergy = mean(energyBuffer);
        const stdEnergy = standardDeviation(energyBuffer, meanEnergy);
        const energyThreshold = meanEnergy + energyThresholdCoef * stdEnergy;
        const isEnergyHigh = energy > energyThreshold;

        // 2. 能量突变检查：检测音节起始
        const recentEnergies = energyBuffer.slice(-3);
        const energyRise = recentEnergies[2] > recentEnergies[0] * energyRiseRatio;

        // 3. 过零率检查
        const meanZcr = mean(zcrBuffer);
        const stdZcr = standardDeviation(zcrBuffer, meanZcr);
        const zcrThreshold = meanZcr + stdZcr;
        const isZcrValid = zcr < zcrThreshold;

        // 添加调试输出
        logDebug(`Energy Level: ${energy.toFixed(4)} / ${energyThreshold.toFixed(4)} (${isEnergyHigh})`);
        logDebug(`Energy Rise: ${(recentEnergies[2]/recentEnergies[0]).toFixed(2)}x (${energyRise})`);
        logDebug(`ZCR: ${zcr.toFixed(4)} / ${zcrThreshold.toFixed(4)} (${isZcrValid})`);

        // 组合判断：
        // - 要求能量水平足够高或者有明显的能量突变
        // - 同时要求过零率合适（避免噪音）
        return (isEnergyHigh || energyRise) && isZcrValid;

    } catch (error) {
        logDebug('Error in detectSyllable: ' + error.message);
        return false;
    }
}

// 修改 isPeakInWindow 函数使其更稳健
function isPeakInWindow(value, window, windowSize = 3) {
    if (!Array.isArray(window) || window.length < windowSize) {
        return false;
    }

    try {
        const center = Math.floor(windowSize / 2);
        const start = Math.max(0, window.length - windowSize);
        const segment = window.slice(start);

        if (segment.length < windowSize) {
            return false;
        }

        const centerValue = segment[center];
        return segment.every((v, i) => {
            if (i === center) return true;
            return v < centerValue;
        });

    } catch (error) {
        logDebug('Error in isPeakInWindow: ' + error.message);
        return false;
    }
}

// 修改 resizeCanvas 函数
function resizeCanvas() {
  const container = document.querySelector('.waveform-container');
  if (waveformCanvas && container) {
    waveformCanvas.width = container.offsetWidth;
    waveformCanvas.height = container.offsetHeight;
  }
}

// 修改 drawMfccVisualization 函数，调整显示比例和确保所有曲线可见
function drawMfccVisualization(mfcc0, energy, zcr) {
    if (!waveformCanvas || !waveformCtx) return;
    
    const height = waveformCanvas.height;
    const width = waveformCanvas.width;
    
    // 清除上一帧
    waveformCtx.clearRect(0, 0, width, height/2);
    
    // 调整显示比例
    const mfccScale = 4.0;  // 增加MFCC显示比例
    const energyScale = 3.0; // 增加能量显示比例
    const zcrScale = 2.0;    // 增加过零率显示比例
    
    // 绘制MFCC曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'green';
    waveformCtx.lineWidth = 2;
    const y = height/4 - (mfcc0 * height/4 * mfccScale);
    const mfccX = width - 5;
    waveformCtx.moveTo(mfccX - 1, y);
    waveformCtx.lineTo(mfccX, y);
    waveformCtx.stroke();
    
    // 绘制能量曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'red';
    const energyY = height/2 - (energy * height/4 * energyScale);
    waveformCtx.moveTo(mfccX - 1, energyY);
    waveformCtx.lineTo(mfccX, energyY);
    waveformCtx.stroke();
    
    // 绘制过零率曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'blue';
    const zcrY = height/2 - (zcr * height/4 * zcrScale);
    waveformCtx.moveTo(mfccX - 1, zcrY);
    waveformCtx.lineTo(mfccX, zcrY);
    waveformCtx.stroke();
}

// 修改 drawWaveform 函数，调整波形显示比例
function drawWaveform() {
    if (!waveformCanvas || !waveformCtx) return;

    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, waveformCanvas.height);

    const step = waveformCanvas.width / WAVEFORM_HISTORY;
    const amplitudeScale = 3.0; // 增加波形振幅的显示比例

    for (let i = 0; i < waveformData.length; i++) {
        const x = i * step;
        const y = waveformCanvas.height - (waveformData[i] * waveformCanvas.height * amplitudeScale);
        waveformCtx.lineTo(x, y);
    }

    waveformCtx.strokeStyle = 'blue';
    waveformCtx.stroke();
}

// 在全局变量区域添加以下变量
let syllableStartX = -1;
let syllableEndX = -1;

// 在文件开头添加这个函数
function logDebug(message) {
  console.log(message);
  //const debugInfo = document.getElementById('debugInfo');
  //if (debugInfo) {
  //  debugInfo.innerHTML += message + '<br>';
  //}
}

// 在全局变量区域添加 MFCC 处理相关变量
let featureProcessor = null;
let mfccBuffer = [];
const MFCC_BUFFER_SIZE = 10; // 保存最近10帧的MFCC数据用于归一化

// 添加 CMVN 归一化函数
function applyCMVN(mfcc) {
    const numCoeffs = mfcc.length;
    const mean = new Array(numCoeffs).fill(0);
    const variance = new Array(numCoeffs).fill(0);
    
    // 计算均值
    mfccBuffer.forEach(frame => {
        frame.forEach((value, i) => {
            mean[i] += value;
        });
    });
    mean.forEach((value, i) => {
        mean[i] /= mfccBuffer.length;
    });
    
    // 计算方差
    mfccBuffer.forEach(frame => {
        frame.forEach((value, i) => {
            variance[i] += Math.pow(value - mean[i], 2);
        });
    });
    variance.forEach((value, i) => {
        variance[i] = Math.sqrt(variance[i] / mfccBuffer.length);
    });
    
    // 应用归一化
    return mfcc.map((value, i) => 
        (value - mean[i]) / (variance[i] + 1e-10)
    );
}

// 添加峰值检测函数
function isPeak(value) {
    if (mfccBuffer.length < 3) return false;
    
    const prevFrame = mfccBuffer[mfccBuffer.length - 2][0];
    const nextFrame = mfccBuffer[mfccBuffer.length - 1][0];
    
    return value > prevFrame && 
           value > nextFrame && 
           value > mfccThreshold;
}

// 修改波形可视化，添加MFCC曲线
function drawMfccVisualization(mfcc0) {
    if (!waveformCanvas || !waveformCtx) return;
    
    const height = waveformCanvas.height;
    const width = waveformCanvas.width;
    
    // 在波形图上方绘制MFCC曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'green';
    waveformCtx.lineWidth = 2;
    
    // 将MFCC值映射到画布高度的上半部分
    const y = height/4 - (mfcc0 * height/4);
    
    // 移动整个曲线
    const mfccX = width - 5; // 在右侧绘最新值
    waveformCtx.moveTo(mfccX - 1, y);
    waveformCtx.lineTo(mfccX, y);
    
    waveformCtx.stroke();
}

// 在全局变量区域添加新的变量
const VTLN_ALPHA = 0.9; // VTLN 缩放因子
let ENERGY_WINDOW_SIZE = 20; // 能量计算窗口大小
let ZCR_WINDOW_SIZE = 20; // 过零率计算窗口大小
let energyBuffer = [];
let zcrBuffer = [];

// 添加 VTLN 归一化函数
function applyVTLN(mfcc) {
    const numCoeffs = mfcc.length;
    const warpedMfcc = new Array(numCoeffs);
    
    // 第0阶系数不进行变换
    warpedMfcc[0] = mfcc[0];
    
    // 对其他系数进行频率缩放
    for (let i = 1; i < numCoeffs; i++) {
        const warpedIndex = Math.floor(i * VTLN_ALPHA);
        if (warpedIndex < numCoeffs) {
            warpedMfcc[i] = mfcc[warpedIndex];
        } else {
            warpedMfcc[i] = mfcc[numCoeffs - 1];
        }
    }
    
    return warpedMfcc;
}

// 计算过零率
function calculateZCR(signal) {
    let zcr = 0;
    for (let i = 1; i < signal.length; i++) {
        if ((signal[i] >= 0 && signal[i-1] < 0) || 
            (signal[i] < 0 && signal[i-1] >= 0)) {
            zcr++;
        }
    }
    return zcr / (signal.length - 1);
}

// 计算短时能量
function calculateEnergy(signal) {
    return signal.reduce((sum, sample) => sum + sample * sample, 0) / signal.length;
}

// 计算均值
function mean(array) {
    return array.reduce((sum, value) => sum + value, 0) / array.length;
}

// 计算标准差
function standardDeviation(array, meanValue) {
    const variance = array.reduce((sum, value) => {
        const diff = value - meanValue;
        return sum + diff * diff;
    }, 0) / array.length;
    return Math.sqrt(variance);
}

// 修改可视化函数以显示更多信息
function drawMfccVisualization(mfcc0, energy, zcr) {
    if (!waveformCanvas || !waveformCtx) return;
    
    const height = waveformCanvas.height;
    const width = waveformCanvas.width;
    
    // 清除上一帧
    waveformCtx.clearRect(0, 0, width, height/2);
    
    // 绘制MFCC曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'green';
    waveformCtx.lineWidth = 2;
    const y = height/4 - (mfcc0 * height/4);
    const mfccX = width - 5;
    waveformCtx.moveTo(mfccX - 1, y);
    waveformCtx.lineTo(mfccX, y);
    waveformCtx.stroke();
    
    // 绘制能量曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'red';
    const energyY = height/2 - (energy * height/4);
    waveformCtx.moveTo(mfccX - 1, energyY);
    waveformCtx.lineTo(mfccX, energyY);
    waveformCtx.stroke();
    
    // 绘制过零率曲线
    waveformCtx.beginPath();
    waveformCtx.strokeStyle = 'blue';
    const zcrY = height/2 - (zcr * height/4);
    waveformCtx.moveTo(mfccX - 1, zcrY);
    waveformCtx.lineTo(mfccX, zcrY);
    waveformCtx.stroke();
}

// 修改参数控制面板，移除噪音相关设置
function updateParameterControls() {
    const parameterControls = document.getElementById('parameterControls');
    if (!parameterControls) return;

    const controls = `
        <div class="parameter-group">
            <h3>音节检测</h3>
            <div class="parameter-item">
                <label>能量阈值系数:</label>
                <input type="range" id="energyThresholdCoef" min="0.1" max="0.5" step="0.05" value="0.3">
                <span id="energyThresholdCoefValue">0.3</span>
            </div>
            <div class="parameter-item">
                <label>能量突变比例:</label>
                <input type="range" id="energyRiseRatio" min="1.1" max="1.3" step="0.01" value="1.2">
                <span id="energyRiseRatioValue">1.2</span>
            </div>
        </div>
        <div class="parameter-group">
            <h3>特征提取</h3>
            <div class="parameter-item">
                <label>MFCC缓冲区大小:</label>
                <input type="range" id="mfccBufferSize" min="2" max="10" step="1" value="3">
                <span id="mfccBufferSizeValue">3</span>
            </div>
            <div class="parameter-item">
                <label>特征窗口大小:</label>
                <input type="range" id="featureWindowSize" min="5" max="20" step="1" value="10">
                <span id="featureWindowSizeValue">10</span>
            </div>
        </div>
    `;
    
    parameterControls.innerHTML = controls;
    
    // ... 保留其他参数的事件监听器 ...
}

// 修改参数控制面板，移除噪音相关设置
function updateParameterControls() {
    const parameterControls = document.getElementById('parameterControls');
    if (!parameterControls) return;

    const controls = `
        <div class="parameter-group">
            <h3>音节检测</h3>
            <div class="parameter-item">
                <label>能量阈值系数:</label>
                <input type="range" id="energyThresholdCoef" min="0.1" max="0.5" step="0.05" value="0.3">
                <span id="energyThresholdCoefValue">0.3</span>
            </div>
            <div class="parameter-item">
                <label>能量突变比例:</label>
                <input type="range" id="energyRiseRatio" min="1.1" max="1.3" step="0.01" value="1.2">
                <span id="energyRiseRatioValue">1.2</span>
            </div>
        </div>
        <div class="parameter-group">
            <h3>特征提取</h3>
            <div class="parameter-item">
                <label>MFCC缓冲区大小:</label>
                <input type="range" id="mfccBufferSize" min="2" max="10" step="1" value="3">
                <span id="mfccBufferSizeValue">3</span>
            </div>
            <div class="parameter-item">
                <label>特征窗口大小:</label>
                <input type="range" id="featureWindowSize" min="5" max="20" step="1" value="10">
                <span id="featureWindowSizeValue">10</span>
            </div>
        </div>
    `;
    
    parameterControls.innerHTML = controls;
    
    // ... 保留其他参数的事件监听器 ...
}

// 确保在 DOMContentLoaded 事件中添加事件监听器
document.addEventListener('DOMContentLoaded', function() {
  const voiceTrackingBtn = document.getElementById('voiceTrackingBtn');
  voiceTrackingBtn.addEventListener('click', toggleVoiceTracking);
  voiceTrackingBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    toggleVoiceTracking();
  });

  // 木鱼按钮事件
  const woodenFishButton = document.getElementById("woodenFishButton");
  woodenFishButton.addEventListener("mousedown", handleWoodenFishClick);
  woodenFishButton.addEventListener("touchstart", handleWoodenFishClick);

  // 初始化显示
  calculateMaxCharsPerLine();

  // 添加窗口大小变化的监听器
  window.addEventListener('resize', function() {
    calculateMaxCharsPerLine();
    if (chantingText.length > 0) {
      displayChantingScripture(document.getElementById("chanting-display"), chantingText, chantingIndex);
    }
    if (recordingText.length > 0) {
      displayRecordingScripture(document.getElementById("recording-display"), recordingText);
    }
  });

  // 初始化 IndexedDB
  const dbRequest = indexedDB.open('RecordingsDB', 1);
  dbRequest.onupgradeneeded = function(event) {
    const db = event.target.result;
    db.createObjectStore('recordings');
  };

  const chantingSelect = document.getElementById("chanting-select");
  const recordingSelect = document.getElementById("recording-select");
  const chantingDisplay = document.getElementById("chanting-display");
  const recordingDisplay = document.getElementById("recording-display");

  // 加载fileList.json来获取data目录中的文件
  fetch('fileList.json')
    .then(response => response.json())
    .then(data => {
      const fileNames = data.files;
      fileNames.forEach(file => {
        let option = document.createElement("option");
        option.value = file;
        option.text = file;
        chantingSelect.appendChild(option);
        recordingSelect.appendChild(option.cloneNode(true));
      });
    });

  // 念经页面的经书选择事件
  chantingSelect.addEventListener("change", function() {
    const selectedValue = this.value;
    if (selectedValue) {
      fetch(`data/${selectedValue}`)
        .then(response => response.text())
        .then(text => {
          chantingText = text.split('');
          chantingIndex = 0;
          chantingLine = 0;
          // 分析文本，生成句子结尾索引数组
          analyzeSentenceStructure(chantingText);
          displayChantingScripture(chantingDisplay, chantingText, chantingIndex);
        });
    }
  });

  // 预录音频页面的经书选择事件
  recordingSelect.addEventListener("change", function() {
    const selectedValue = this.value;
    if (selectedValue) {
      fetch(`data/${selectedValue}`)
        .then(response => response.text())
        .then(text => {
          recordingText = text.split('');
          recordingLine = 0;
          recordedLines.clear();
          displayRecordingScripture(recordingDisplay, recordingText);
        });
    }
  });

  // 修改滑块事件监听器，增加元素存在性检查
  const silenceThresholdSlider = document.getElementById('silenceThreshold');
  if (silenceThresholdSlider) {
    silenceThresholdSlider.addEventListener('input', function() {
      silenceThreshold = parseFloat(this.value);
      const valueDisplay = document.getElementById('silenceThresholdValue');
      if (valueDisplay) {
        valueDisplay.textContent = silenceThreshold.toFixed(2);
      }
      console.log('Silence Threshold updated:', silenceThreshold);
    });
  }

  const minSyllableDurationSlider = document.getElementById('minSyllableDuration');
  if (minSyllableDurationSlider) {
    minSyllableDurationSlider.addEventListener('input', function() {
      minSyllableDuration = parseInt(this.value);
      const valueDisplay = document.getElementById('minSyllableDurationValue');
      if (valueDisplay) {
        valueDisplay.textContent = minSyllableDuration;
      }
      console.log('Min Syllable Duration updated:', minSyllableDuration);
    });
  }

  const maxSyllableDurationSlider = document.getElementById('maxSyllableDuration');
  if (maxSyllableDurationSlider) {
    maxSyllableDurationSlider.addEventListener('input', function() {
      maxSyllableDuration = parseInt(this.value);
      const valueDisplay = document.getElementById('maxSyllableDurationValue');
      if (valueDisplay) {
        valueDisplay.textContent = maxSyllableDuration;
      }
      console.log('Max Syllable Duration updated:', maxSyllableDuration);
    });
  }

  const mfccThresholdSlider = document.getElementById('mfccThreshold');
  if (mfccThresholdSlider) {
    mfccThresholdSlider.addEventListener('input', function() {
      mfccThreshold = parseFloat(this.value);
      const valueDisplay = document.getElementById('mfccThresholdValue');
      if (valueDisplay) {
        valueDisplay.textContent = mfccThreshold.toFixed(2);
      }
      console.log('MFCC Threshold updated:', mfccThreshold);
    });
  }

  // 调试模式切换
  const debugMode = document.getElementById('debugMode');
  const debugPanel = document.getElementById('debugPanel');
  
  if (debugMode && debugPanel) {
    debugMode.addEventListener('change', function() {
      debugPanel.style.display = this.checked ? 'block' : 'none';
      if (this.checked) {
        resizeCanvas();
      }
    });
  }

  // 初始化参数控制界面
  // 确保在调用 updateParameterControls 之前已经创建了必要的DOM元素
  const parameterControls = document.getElementById('parameterControls');
  if (parameterControls) {
    updateParameterControls();
  }

  // 添加设备信息
  logDebug('User Agent: ' + navigator.userAgent);
  logDebug('Platform: ' + navigator.platform);
  
  // 检查是否支持 getUserMedia
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    logDebug('getUserMedia is supported');
  } else {
    logDebug('getUserMedia is not supported');
  }

  // 添加更详细的浏览器支持检查
  logDebug('Checking browser support...');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    logDebug('Modern getUserMedia is supported');
  } else if (navigator.getUserMedia || navigator.webkitGetUserMedia || 
             navigator.mozGetUserMedia || navigator.msGetUserMedia) {
    logDebug('Legacy getUserMedia is supported');
  } else {
    logDebug('getUserMedia is not supported');
    alert('您的浏览器不支持访问麦克风。尝试使用最新版本的Chrome、Firefox或Safari浏览器。');
  }
});

// 添加保存录音的函数
function saveRecording(fileName, audioBlob) {
  // 这里使用 IndexedDB 来存储录音
  // 注意：在实际应用，您可能需要考虑存储容量限制和数据持久化的问题
  const request = indexedDB.open('RecordingsDB', 1);

  request.onerror = function(event) {
    console.error("IndexedDB error:", event.target.error);
  };

  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['recordings'], 'readwrite');
    const objectStore = transaction.objectStore('recordings');

    const addRequest = objectStore.put(audioBlob, fileName);

    addRequest.onerror = function(event) {
      console.error("Error saving recording:", event.target.error);
    };

    addRequest.onsuccess = function(event) {
      console.log("Recording saved successfully");
    };
  };

  request.onupgradeneeded = function(event) {
    const db = event.target.result;
    db.createObjectStore('recordings');
  };
}

// 木鱼按钮事件
function handleWoodenFishClick(event) {
  event.preventDefault();
  let chineseCharCount = 0;
  for (let i = 0; i < chantingText.length; i++) {
    if (isChineseChar(chantingText[i])) {
      if (chineseCharCount === chantingIndex) {
        updateChantingCharStyle(chantingIndex);
        chantingIndex++;
        updateChantingDisplay();
        break;
      }
      chineseCharCount++;
    }
  }
  const textContainer = document.getElementById('text-container');
  const currentLineElement = textContainer.children[chantingLine];
  if (currentLineElement) {
    const nextChineseChar = Array.from(currentLineElement.children).find(span => 
      isChineseChar(span.textContent) && span.classList.contains('unread-text')
    );
    if (!nextChineseChar) {
      chantingLine++;
      updateChantingDisplay();
    }
  }
}

// 修改文本分析函数
function analyzeSentenceStructure(text) {
    sentenceEndIndices = [];
    let chineseCharCount = -1; // 从-1开始计数，这样第一个汉字的索引就是0
    let lastEndIndex = -1;

    // 定义标点符号正则表达式（包含所有中英文标点和换行符）
    const PUNCTUATION_REGEX = /[，。！？；：、,.!?;:\n\r""''「」『』（）()《》〈〉【】［］]/;
    
    for (let i = 0; i < text.length; i++) {
        if (isChineseChar(text[i])) {
            chineseCharCount++;
            // 如果前面有标点符号，且这个位置还没记录过
            if (i > 0 && PUNCTUATION_REGEX.test(text[i-1]) && chineseCharCount - 1 !== lastEndIndex) {
                sentenceEndIndices.push(chineseCharCount - 1);
                lastEndIndex = chineseCharCount - 1;
                logDebug(`Found sentence end at index ${chineseCharCount - 1}, char: ${text[i-1]}`);
            }
        } else if (PUNCTUATION_REGEX.test(text[i])) {
            // 如果检测到标点符号，记录前一个汉字为句尾
            if (chineseCharCount >= 0 && chineseCharCount !== lastEndIndex) {
                sentenceEndIndices.push(chineseCharCount);
                lastEndIndex = chineseCharCount;
                logDebug(`Found sentence end at index ${chineseCharCount}, char: ${text[i-1]}`);
            }
        }
    }
    
    // 如果文本末尾有汉字但没有标点，也将其作为句子结尾
    if (chineseCharCount >= 0 && chineseCharCount !== lastEndIndex) {
        sentenceEndIndices.push(chineseCharCount);
        logDebug(`Added final sentence end at index ${chineseCharCount}`);
    }

    // 将句尾索引转换为句首索引
    sentenceEndIndices = sentenceEndIndices.map(index => index + 1);
    
    // 确保包含第一个句首（0）
    if (!sentenceEndIndices.includes(0)) {
        sentenceEndIndices.unshift(0);
    }
    
    // 排序确保索引有序
    sentenceEndIndices.sort((a, b) => a - b);

    logDebug('Sentence start indices:', sentenceEndIndices);
    logDebug('Total Chinese characters:', chineseCharCount + 1);
    
    // 打印每个句首的汉字，用于调试
    sentenceEndIndices.forEach(index => {
        let charIndex = -1;
        let targetChar = '';
        for (let i = 0; i < text.length; i++) {
            if (isChineseChar(text[i])) {
                charIndex++;
                if (charIndex === index) {
                    targetChar = text[i];
                    break;
                }
            }
        }
        logDebug(`Sentence start at index ${index}: ${targetChar}`);
    });
}

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

// 在全局变量区域添加以下变量
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
        charElement.className = chineseCharCount < highlightIndex ? 'read-text' : 'unread-text';
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

// 修改 toggleVoiceTracking 函数
function toggleVoiceTracking() {
  const voiceTrackingBtn = document.getElementById('voiceTrackingBtn');
  const btnText = voiceTrackingBtn.querySelector('.btn-text');
  
  logDebug('toggleVoiceTracking called. Current state: ' + isVoiceTracking);
  
  if (!isVoiceTracking) {
    logDebug('Attempting to start voice tracking');
    startVoiceTracking().then(() => {
      voiceTrackingBtn.classList.add('recording');
      btnText.textContent = '停止跟踪';
      isVoiceTracking = true;
      logDebug('Voice tracking started');
    }).catch(err => {
      logDebug('Failed to start voice tracking: ' + err.message);
      alert('启动语音跟踪失败: ' + err.message);
    });
  } else {
    stopVoiceTracking();
    voiceTrackingBtn.classList.remove('recording');
    btnText.textContent = '语音跟踪';
    isVoiceTracking = false;
    logDebug('Voice tracking stopped');
  }
}

// 新的 startVoiceTracking 函数
async function startVoiceTracking() {
  logDebug('Starting voice tracking...');
  try {
    logDebug('Checking getUserMedia support...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // 旧版 API 兼容
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || 
                               navigator.mozGetUserMedia || navigator.msGetUserMedia;
      
      if (!navigator.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      logDebug('Using legacy getUserMedia API');
      const stream = await new Promise((resolve, reject) => {
        navigator.getUserMedia({ audio: true }, resolve, reject);
      });
      logDebug('Microphone access granted');
      setupAudioProcessing(stream);
    } else {
      logDebug('Using modern getUserMedia API');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      logDebug('Microphone access granted');
      setupAudioProcessing(stream);
    }
  } catch (err) {
    logDebug('Error in startVoiceTracking: ' + err.message);
    alert('无法访问麦克风: ' + err.message);
  }
}

function setupAudioProcessing(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  microphone = audioContext.createMediaStreamSource(stream);
  microphone.connect(analyser);
  
  logDebug('Audio context and analyser set up');

  // 初始化波形图
  waveformCanvas = document.getElementById('waveform');
  if (!waveformCanvas) {
    logDebug('Waveform canvas not found');
    return;
  }
  waveformCtx = waveformCanvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  logDebug('Waveform canvas initialized');

  meydaAnalyzer = Meyda.createMeydaAnalyzer({
    audioContext: audioContext,
    source: microphone,
    bufferSize: 512,
    featureExtractors: ['mfcc', 'rms'],
    callback: analyzeAudio
  });
  
  logDebug('Meyda analyzer created');
  meydaAnalyzer.start();
  logDebug('Voice tracking started successfully');
}

// 修改 resizeCanvas 函数
function resizeCanvas() {
  const container = document.querySelector('.waveform-container');
  if (waveformCanvas && container) {
    waveformCanvas.width = container.offsetWidth;
    waveformCanvas.height = container.offsetHeight;
  }
}

// 修改 analyzeAudio 函数
function analyzeAudio(features) {
  if (!isVoiceTracking) return;

  const mfcc = features.mfcc;
  const rms = features.rms;
  const currentTime = Date.now();

  // 更新波形数据
  waveformData.push(rms);
  if (waveformData.length > WAVEFORM_HISTORY) {
    waveformData.shift();
  }

  // 绘制波形图
  drawWaveform();

  if (lastMfccValues) {
    const mfccDifference = euclideanDistance(mfcc, lastMfccValues);

    // 更新 MFCC 信息显示
    updateMfccInfo(mfcc, mfccDifference);

    // 音节检测逻辑
    if (!isSyllableActive && rms > silenceThreshold && mfccDifference > mfccThreshold) {
      // 音节开始
      isSyllableActive = true;
      syllableStartTime = currentTime;
      console.log('Syllable start detected');
    } else if (isSyllableActive) {
      if (rms <= silenceThreshold || currentTime - syllableStartTime > maxSyllableDuration) {
        // 音节结束
        if (currentTime - syllableStartTime >= minSyllableDuration) {
          console.log('Syllable detected');
          handleWoodenFishClick(new Event('click'));
        } else {
          console.log('Syllable too short, ignored');
        }
        isSyllableActive = false;
      }
    }
  }

  lastMfccValues = mfcc;
}

function euclideanDistance(arr1, arr2) {
  return Math.sqrt(arr1.reduce((sum, value, index) => {
    const diff = value - arr2[index];
    return sum + diff * diff;
  }, 0));
}

// 添加 updateMfccInfo 函数
function updateMfccInfo(mfcc, mfccDifference) {
  const currentMfccElement = document.getElementById('currentMfcc');
  const mfccDifferenceElement = document.getElementById('mfccDifference');
  
  if (currentMfccElement) {
    currentMfccElement.textContent = JSON.stringify(mfcc.map(v => v.toFixed(2)));
  }
  if (mfccDifferenceElement) {
    mfccDifferenceElement.textContent = mfccDifference.toFixed(2);
  }
}

// 修改 drawWaveform 函数
function drawWaveform() {
  if (!waveformCanvas || !waveformCtx) return;

  waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  
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

  // 绘制阈值线
  waveformCtx.beginPath();
  waveformCtx.moveTo(0, waveformCanvas.height - (silenceThreshold * waveformCanvas.height));
  waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height - (silenceThreshold * waveformCanvas.height));
  waveformCtx.strokeStyle = 'red';
  waveformCtx.stroke();
}

// 修改 stopVoiceTracking 函数
function stopVoiceTracking() {
  if (meydaAnalyzer) {
    meydaAnalyzer.stop();
  }
  if (audioContext) {
    audioContext.close();
  }
  lastMfccValues = null;
  lastRms = null;
  isSyllableActive = false;
  lastSyllableEndTime = 0;
  
  // 清除波形图
  waveformData = [];
  if (waveformCtx) {
    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
  }
  
  window.removeEventListener('resize', resizeCanvas);
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

  // ... 其他事件监听器 ...

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

  // 修改滑块事件监听器
  document.getElementById('silenceThreshold').addEventListener('input', function() {
    silenceThreshold = parseFloat(this.value);
    document.getElementById('silenceThresholdValue').textContent = silenceThreshold.toFixed(2);
    console.log('Silence Threshold updated:', silenceThreshold);
  });

  document.getElementById('minSyllableDuration').addEventListener('input', function() {
    minSyllableDuration = parseInt(this.value);
    document.getElementById('minSyllableDurationValue').textContent = minSyllableDuration;
    console.log('Min Syllable Duration updated:', minSyllableDuration);
  });

  document.getElementById('maxSyllableDuration').addEventListener('input', function() {
    maxSyllableDuration = parseInt(this.value);
    document.getElementById('maxSyllableDurationValue').textContent = maxSyllableDuration;
    console.log('Max Syllable Duration updated:', maxSyllableDuration);
  });

  document.getElementById('mfccThreshold').addEventListener('input', function() {
    mfccThreshold = parseFloat(this.value);
    document.getElementById('mfccThresholdValue').textContent = mfccThreshold.toFixed(2);
    console.log('MFCC Threshold updated:', mfccThreshold);
  });

  // 调试模式切换
  const debugCheckbox = document.getElementById('debugMode');
  const debugPanel = document.getElementById('debugPanel');
  debugCheckbox.addEventListener('change', function() {
    debugPanel.style.display = this.checked ? 'block' : 'none';
    if (this.checked) resizeCanvas();
  });

  // 添加调试信息显示区域
  const debugContainer = document.querySelector('.debug-container');
  const debugInfo = document.createElement('div');
  debugInfo.id = 'debugInfo';
  debugInfo.style.maxHeight = '200px';
  debugInfo.style.overflowY = 'scroll';
  debugContainer.appendChild(debugInfo);

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
    alert('您的浏览器不支持访问麦克风。请尝试使用最新版本的Chrome、Firefox或Safari浏览器。');
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


/**
 * script.js - 翻译与语音合成前端逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
    const inputText = document.getElementById('input-text');
    const outputText = document.getElementById('output-text');
    const sourceLangSelect = document.getElementById('source-lang');
    const targetLangSelect = document.getElementById('target-lang');
    const translateBtn = document.getElementById('translate-btn');
    const translateForm = document.getElementById('translate-form');
    const errorMessage = document.getElementById('error-message'); // 翻译错误

    const healthStatusIndicator = document.getElementById('health-status');
    const apiVersionSpan = document.getElementById('api-version');

    const manageApiBtn = document.getElementById('manage-api-btn');
    const manageModal = document.getElementById('manage-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const apiUrlInput = document.getElementById('api-url-input'); // 翻译 API URL
    const apiTokenInput = document.getElementById('api-token-input'); // 翻译 API Token
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const modalStatus = document.getElementById('modal-status');

    const swapLanguagesBtn = document.getElementById('swap-languages-btn');
    const clearInputBtn = document.getElementById('clear-input-btn');
    const copyOutputBtn = document.getElementById('copy-output-btn');
    const copySuccessMsg = document.getElementById('copy-success-msg');

    // TTS 相关 DOM
    const speakOutputBtn = document.getElementById('speak-output-btn'); // 朗读/暂停/生成中 按钮
    const speakControls = document.getElementById('speak-controls');    // 朗读控制容器
    const audioPlayer = document.getElementById('audio-player');        // 音频播放器
    const ttsErrorMessage = document.getElementById('tts-error-message'); // TTS 错误消息
    const ttsApiUrlInput = document.getElementById('tts-api-url-input');  // TTS API URL 输入框
    const ttsApiKeyInput = document.getElementById('tts-api-key-input');  // TTS API Key 输入框
    const ttsVoiceSelect = document.getElementById('tts-voice-select'); // TTS 音色选择下拉框
    // 新增滑块和值显示元素
    const ttsRateSlider = document.getElementById('tts-rate-slider');
    const ttsRateValue = document.getElementById('tts-rate-value');
    const ttsPitchSlider = document.getElementById('tts-pitch-slider');
    const ttsPitchValue = document.getElementById('tts-pitch-value');
    const downloadAudioBtn = document.getElementById('download-audio-btn'); // 下载按钮
    const progressBarContainer = document.getElementById('progress-bar-container'); // 进度条容器
    const audioProgressBar = document.getElementById('audio-progress-bar'); // 进度条 input range
    const audioTimeDisplay = document.getElementById('audio-time-display'); // 时间显示 span


    // --- 状态变量 ---
    let apiBaseUrl = localStorage.getItem('apiBaseUrl') || '';
    let apiAuthToken = localStorage.getItem('apiAuthToken') || '';
    let ttsApiUrl = localStorage.getItem('ttsApiUrl') || '';
    let ttsApiKey = localStorage.getItem('ttsApiKey') || '';
    let ttsVoiceName = localStorage.getItem('ttsVoiceName') || 'zh-CN-XiaoxiaoMultilingualNeural'; // 默认音色
    // 新增语速和语调状态变量
    let ttsRate = parseInt(localStorage.getItem('ttsRate') || '0', 10);
    let ttsPitch = parseInt(localStorage.getItem('ttsPitch') || '0', 10);

    let copyTimeout = null;
    let debounceTimer = null;
    let ttsApiCooldownTimer = null; // TTS API 调用冷却计时器
    const TTS_API_COOLDOWN = 5000; // TTS API 冷却时间 (毫秒) - 应用于每次分片请求
    const TTS_MAX_CHARS = 2000; // API 单次最大字符数限制
    let currentAudioBlobUrl = null; // 存储当前可下载的音频 URL
    let isDraggingProgressBar = false; // 标记是否正在拖动进度条
    let wasPlayingBeforeDrag = false; // 记录拖动前是否在播放
    let currentSynthesisController = null; // 用于中止进行中的多片段合成


    // --- 常量 ---
    const DEBOUNCE_DELAY = 500; // 防抖延迟时间（毫秒）
    // TTS 音色选项
    const ttsVoiceOptions = {
        "zh-CN-XiaoxiaoMultilingualNeural": "晓晓 多语言", "zh-CN-XiaoxiaoNeural": "晓晓", "zh-CN-YunxiNeural": "云希",
        "zh-CN-YunjianNeural": "云健", "zh-CN-XiaoyiNeural": "晓伊", "zh-CN-YunyangNeural": "云扬", "zh-CN-XiaochenNeural": "晓辰",
        "zh-CN-XiaochenMultilingualNeural": "晓辰 多语言", "zh-CN-XiaohanNeural": "晓涵", "zh-CN-XiaomengNeural": "晓梦",
        "zh-CN-XiaomoNeural": "晓墨", "zh-CN-XiaoqiuNeural": "晓秋", "zh-CN-XiaorouNeural": "晓柔", "zh-CN-XiaoruiNeural": "晓睿",
        "zh-CN-XiaoshuangNeural": "晓双", "zh-CN-XiaoxiaoDialectsNeural": "晓晓 方言", "zh-CN-XiaoyanNeural": "晓颜", "zh-CN-XiaoyouNeural": "晓悠",
        "zh-CN-XiaoyuMultilingualNeural": "晓宇 多语言", "zh-CN-XiaozhenNeural": "晓甄", "zh-CN-YunfengNeural": "云枫", "zh-CN-YunhaoNeural": "云皓",
        "zh-CN-YunjieNeural": "云杰", "zh-CN-YunxiaNeural": "云夏", "zh-CN-YunyeNeural": "云野", "zh-CN-YunyiMultilingualNeural": "云逸 多语言",
        "zh-CN-YunzeNeural": "云泽", "zh-CN-YunfanMultilingualNeural": "云帆 多语言", "zh-CN-YunxiaoMultilingualNeural": "云萧 多语言",
        "zh-CN-guangxi-YunqiNeural": "云奇 广西", "zh-CN-henan-YundengNeural": "云登 河南", "zh-CN-liaoning-XiaobeiNeural": "晓北 辽宁",
        "zh-CN-liaoning-YunbiaoNeural": "云彪 辽宁", "zh-CN-shaanxi-XiaoniNeural": "晓妮 山西", "zh-CN-shandong-YunxiangNeural": "云翔 山东",
        "zh-CN-sichuan-YunxiNeural": "云希 四川", "zh-HK-HiuMaanNeural": "晓曼 粤语", "zh-HK-WanLungNeural": "云龙 粤语",
        "zh-HK-HiuGaaiNeural": "晓佳 粤语", "zh-TW-HsiaoChenNeural": "晓臻 台湾", "zh-TW-YunJheNeural": "云哲 台湾", "zh-TW-HsiaoYuNeural": "晓雨 台湾"
    };

    // --- 初始化设置 ---
    populateVoiceOptions();
    loadSettings(); // loadSettings 会处理滑块的初始值
    checkApiHealth();
    getApiVersion();

    // --- 函数定义 ---

    /**
     * 填充 TTS 音色选择下拉框。
     */
    function populateVoiceOptions() {
        ttsVoiceSelect.innerHTML = ''; // 清空现有选项
        for (const [value, text] of Object.entries(ttsVoiceOptions)) {
            const option = document.createElement('option'); option.value = value; option.textContent = text; ttsVoiceSelect.appendChild(option);
        }
        ttsVoiceSelect.value = ttsVoiceName;
    }

    /**
     * 从 localStorage 加载所有 API 设置到弹窗的输入字段中。
     */
    function loadSettings() {
        apiBaseUrl = localStorage.getItem('apiBaseUrl') || ''; apiAuthToken = localStorage.getItem('apiAuthToken') || '';
        ttsApiUrl = localStorage.getItem('ttsApiUrl') || ''; ttsApiKey = localStorage.getItem('ttsApiKey') || '';
        ttsVoiceName = localStorage.getItem('ttsVoiceName') || 'zh-CN-XiaoxiaoMultilingualNeural';
        // 加载语速和语调
        ttsRate = parseInt(localStorage.getItem('ttsRate') || '0', 10);
        ttsPitch = parseInt(localStorage.getItem('ttsPitch') || '0', 10);

        apiUrlInput.value = apiBaseUrl; apiTokenInput.value = apiAuthToken;
        ttsApiUrlInput.value = ttsApiUrl; ttsApiKeyInput.value = ttsApiKey; ttsVoiceSelect.value = ttsVoiceName;
        // 设置滑块和显示值
        ttsRateSlider.value = ttsRate; ttsRateValue.textContent = ttsRate;
        ttsPitchSlider.value = ttsPitch; ttsPitchValue.textContent = ttsPitch;
    }

    /**
     * 保存所有 API 设置到 localStorage。
     * @returns {boolean} - 是否保存成功
     */
    function saveSettings() {
        const newTranslateUrl = apiUrlInput.value.trim().replace(/\/$/, ''); const newTranslateToken = apiTokenInput.value.trim();
        const newTtsUrl = ttsApiUrlInput.value.trim().replace(/\/$/, ''); const newTtsKey = ttsApiKeyInput.value.trim();
        const newTtsVoice = ttsVoiceSelect.value;
        // 获取滑块值
        const newTtsRate = parseInt(ttsRateSlider.value, 10);
        const newTtsPitch = parseInt(ttsPitchSlider.value, 10);

        // 验证 (保持不变)
        if (!newTranslateUrl) { showModalStatus("翻译 API 基地址不能为空。", "error"); return false; }
        try { new URL(newTranslateUrl); } catch (_) { showModalStatus("无效的翻译 API 基地址格式。", "error"); return false; }
        if (newTtsUrl) { try { new URL(newTtsUrl); } catch (_) { showModalStatus("无效的语音 API 地址格式。", "error"); return false; } }

        // 更新全局变量和 localStorage
        apiBaseUrl = newTranslateUrl; apiAuthToken = newTranslateToken; ttsApiUrl = newTtsUrl; ttsApiKey = newTtsKey;
        ttsVoiceName = newTtsVoice; ttsRate = newTtsRate; ttsPitch = newTtsPitch;

        localStorage.setItem('apiBaseUrl', apiBaseUrl); localStorage.setItem('apiAuthToken', apiAuthToken);
        localStorage.setItem('ttsApiUrl', ttsApiUrl); localStorage.setItem('ttsApiKey', ttsApiKey);
        localStorage.setItem('ttsVoiceName', ttsVoiceName);
        localStorage.setItem('ttsRate', ttsRate.toString()); // 保存为字符串
        localStorage.setItem('ttsPitch', ttsPitch.toString()); // 保存为字符串

        showModalStatus("设置已保存！", "success"); return true;
    }

    /**
     * 在弹窗中显示状态消息。
     */
    function showModalStatus(message, type) {
        modalStatus.textContent = message; modalStatus.className = `modal-status ${type}`;
        setTimeout(() => { modalStatus.textContent = ''; modalStatus.className = 'modal-status'; }, 3000);
    }

     /**
      * 清除主页面的错误消息 (包括翻译和TTS)。
      */
    function clearErrorMessage() { errorMessage.textContent = ''; ttsErrorMessage.textContent = ''; }

    /**
     * 在主页面显示错误消息。
     */
    function showErrorMessage(message, isTtsError = false) {
        console.error(isTtsError ? "TTS 错误:" : "翻译错误:", message);
        const targetElement = isTtsError ? ttsErrorMessage : errorMessage;
        const prefix = isTtsError ? '语音合成错误' : '翻译错误'; const fullMessage = `${prefix}: ${message}`;
        if (targetElement.textContent !== fullMessage) { targetElement.textContent = fullMessage; }
    }

    /**
     * 检查翻译 API 的 /health 端点状态。
     */
    async function checkApiHealth() {
        if (!apiBaseUrl) { healthStatusIndicator.className = 'status-indicator unhealthy'; healthStatusIndicator.title = '翻译 API 地址未设置'; return; }
        healthStatusIndicator.className = 'status-indicator loading'; healthStatusIndicator.title = '正在检查翻译 API 状态...';
        try {
            const response = await fetch(`${apiBaseUrl}/health`, { method: 'GET', headers: { 'Accept': '*/*', 'User-Agent': 'TranslateWebApp/1.0' }});
            if (response.ok) { const data = await response.json(); if (data.status === 'ok') { healthStatusIndicator.className = 'status-indicator healthy'; healthStatusIndicator.title = `翻译 API 健康 (状态: ${data.status})`; } else { healthStatusIndicator.className = 'status-indicator unhealthy'; healthStatusIndicator.title = `翻译 API 状态异常: ${data.status || '未知状态'}`; } }
            else { healthStatusIndicator.className = 'status-indicator unhealthy'; healthStatusIndicator.title = `翻译 API 健康检查失败: ${response.status} ${response.statusText}`; }
        } catch (error) { console.error('翻译 API 健康检查失败:', error); healthStatusIndicator.className = 'status-indicator unhealthy'; healthStatusIndicator.title = `翻译 API 健康检查错误: ${error.message}`; }
    }

    /**
     * 从 /version 端点获取翻译 API 版本信息。
     */
    async function getApiVersion() {
         if (!apiBaseUrl) { apiVersionSpan.textContent = 'N/A (未设置翻译 API)'; return; }
         apiVersionSpan.textContent = '加载中...';
         try {
             const response = await fetch(`${apiBaseUrl}/version`, { method: 'GET', headers: { 'Accept': '*/*', 'User-Agent': 'TranslateWebApp/1.0' }});
             if (response.ok) { const data = await response.json(); apiVersionSpan.textContent = data.version || '未知版本'; }
             else { apiVersionSpan.textContent = `错误 (${response.status})`; console.error('获取翻译 API 版本失败:', response.statusText); }
         } catch (error) { apiVersionSpan.textContent = '错误'; console.error('获取翻译 API 版本失败:', error); }
    }

    /**
     * 防抖函数。
     */
    function debounce(func, delay) {
        return function() {
            const context = this; const args = arguments; clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (inputText.value.trim()) { func.apply(context, args); }
                else { resetAudioState(true); } // 清空输入时重置并清空输出
            }, delay);
        }
    }

    /**
     * 重置音频播放状态和相关 UI。
     */
    function resetAudioState(clearOutput = false) {
        console.log("Resetting audio state.");
        if (currentSynthesisController) { currentSynthesisController.abort(); currentSynthesisController = null; console.log("Aborted ongoing synthesis."); }
        audioPlayer.pause(); audioPlayer.removeAttribute('src'); audioPlayer.load();
        if (currentAudioBlobUrl) { URL.revokeObjectURL(currentAudioBlobUrl); currentAudioBlobUrl = null; }
        speakOutputBtn.disabled = false; speakOutputBtn.textContent = '朗读';
        progressBarContainer.style.display = 'none'; audioProgressBar.value = 0; audioTimeDisplay.textContent = "0:00 / 0:00";
        downloadAudioBtn.style.display = 'none'; downloadAudioBtn.disabled = true;
        isDraggingProgressBar = false; wasPlayingBeforeDrag = false;
        if (clearOutput) { outputText.value = ''; }
    }

    /**
     * 处理文本翻译逻辑。
     */
    async function handleTranslation() {
        console.log("Handling translation."); clearErrorMessage(); resetAudioState();
        const textToTranslate = inputText.value.trim();
        if (!textToTranslate) { outputText.value = ''; return; }
        if (!apiBaseUrl) { showErrorMessage("请先在“管理”中设置翻译 API 地址。", false); return; }
        const sourceLang = sourceLangSelect.value; const targetLang = targetLangSelect.value;
        translateBtn.disabled = true; translateBtn.textContent = '翻译中...'; outputText.value = '正在加载...';
        try {
            const headers = { 'Content-Type': 'application/json', 'Accept': '*/*', 'User-Agent': 'TranslateWebApp/1.0' }; if (apiAuthToken) { headers['Authorization'] = apiAuthToken; }
            const response = await fetch(`${apiBaseUrl}/translate`, { method: 'POST', headers: headers, body: JSON.stringify({ from: sourceLang, to: targetLang, text: textToTranslate })}); const data = await response.json();
            if (response.ok) { if (data && data.result !== undefined) { if (inputText.value.trim() === textToTranslate) { outputText.value = data.result; } else { console.log("Input changed, ignoring old result."); }} else { if (inputText.value.trim() === textToTranslate) { showErrorMessage("Invalid API response.", false); outputText.value = ''; }}}
            else { if (inputText.value.trim() === textToTranslate) { const e = data?.error || data?.message || `HTTP ${response.status}`; showErrorMessage(`Translation failed: ${e}`, false); outputText.value = ''; }}
        } catch (error) { if (inputText.value.trim() === textToTranslate) { showErrorMessage(`Network error: ${error.message}`, false); outputText.value = ''; }}
        finally { translateBtn.disabled = false; translateBtn.textContent = '翻译'; }
    }

    /**
     * 交换源语言和目标语言。
     */
    function swapLanguages() {
        const v1 = sourceLangSelect.value; const v2 = targetLangSelect.value; sourceLangSelect.value = v2; targetLangSelect.value = v1;
        if(outputText.value.trim() && outputText.value !== '正在加载...') { resetAudioState(); }
    }

    /**
     * 清除输入、输出、错误和音频状态。
     */
    function clearInput() { inputText.value = ''; clearErrorMessage(); clearTimeout(debounceTimer); resetAudioState(true); inputText.focus(); }

    /**
     * 复制输出文本框的内容。
     * 检查 navigator.clipboard 是否可用，如果不可用则回退。
     */
    function copyOutput() {
        const text = outputText.value;
        if (!text || text === '正在加载...') {
            showCopyMessage("没有可复制的内容", true);
            return;
        }

        // 检查 Clipboard API 是否可用且在安全上下文中
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    showCopyMessage("已复制!", false);
                })
                .catch(err => {
                    console.error('Clipboard API copy failed:', err);
                    // 如果 Clipboard API 失败（可能由于权限或其他原因），尝试回退
                    fallbackCopyText(text);
                });
        } else {
            // 如果 Clipboard API 不可用（非 HTTPS/localhost 或旧浏览器），使用回退方法
            console.warn('Clipboard API not available or context is insecure. Using fallback.');
            fallbackCopyText(text);
        }
    }

    /**
     * 使用 document.execCommand 的回退复制方法。
     * @param {string} text - 要复制的文本。
     */
    function fallbackCopyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // --- 样式设置，防止影响页面布局和滚动 ---
        textArea.style.position = 'fixed'; // 固定定位，脱离文档流
        textArea.style.top = '-9999px';    // 移到屏幕外
        textArea.style.left = '-9999px';   // 移到屏幕外
        textArea.style.width = '2em';      // 足够小即可
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        // --- 样式设置结束 ---

        document.body.appendChild(textArea);
        textArea.focus(); // 需要获取焦点才能选中
        textArea.select(); // 选中 textarea 中的内容

        try {
            const successful = document.execCommand('copy'); // 执行复制命令
            if (successful) {
                showCopyMessage("已复制! (Fallback)", false);
            } else {
                console.error('Fallback copy command failed');
                showCopyMessage("复制失败 (Fallback)", true);
            }
        } catch (err) {
            console.error('Fallback copy error:', err);
            showCopyMessage("复制失败 (Fallback)", true);
        }

        document.body.removeChild(textArea); // 移除临时 textarea
    }


     /**
     * 显示复制成功/失败的提示信息。
     */
    function showCopyMessage(message, isError) { if (copyTimeout) clearTimeout(copyTimeout); copySuccessMsg.textContent = message; copySuccessMsg.style.color = isError ? '#f44336' : '#4CAF50'; copySuccessMsg.classList.add('show'); copyTimeout = setTimeout(() => { copySuccessMsg.classList.remove('show'); copyTimeout = null; }, 1500); }

    // --- 文本转语音 (TTS) 函数 ---

    function isApiCoolingDown() { return ttsApiCooldownTimer && Date.now() < ttsApiCooldownTimer; }
    function setApiCooldown() { ttsApiCooldownTimer = Date.now() + TTS_API_COOLDOWN; }

    /**
     * 处理朗读按钮的点击事件 (播放/暂停切换 或 触发合成)。
     */
    function handleSpeakButtonClick() {
        console.log("Speak click. Src:", audioPlayer.src, "State:", audioPlayer.readyState, "URL:", currentAudioBlobUrl);
        if (speakOutputBtn.textContent.includes('生成中') && currentSynthesisController) { console.log("Aborting synthesis..."); resetAudioState(); return; }
        if (currentAudioBlobUrl && audioPlayer.readyState >= 1) { if (audioPlayer.paused) { console.log("Audio exists, play."); audioPlayer.play().catch(e => { console.error("Play failed:", e); showErrorMessage("无法播放音频。", true); speakOutputBtn.disabled = false; speakOutputBtn.textContent = '朗读'; }); } else { console.log("Audio playing, pause."); audioPlayer.pause(); } }
        else { console.log("No valid audio, initiate TTS."); textToSpeech(); }
    }

    /**
     * 将文本（可能很长）转换为语音并尝试自动播放。
     */
    async function textToSpeech() {
        clearErrorMessage(); const textToSpeak = outputText.value.trim();
        if (!textToSpeak || textToSpeak === '正在加载...') { showErrorMessage("没有可朗读的文本。", true); return; }
        if (!ttsApiUrl || !ttsApiKey) { showErrorMessage("请设置语音 API。", true); return; }
        if (isApiCoolingDown()) { showErrorMessage(`请稍候...`, true); return; } // 仅显示等待信息，按钮状态不变

        resetAudioState(); console.log("Starting TTS process...");
        speakOutputBtn.disabled = true; speakOutputBtn.textContent = '准备中...';
        progressBarContainer.style.display = 'none'; downloadAudioBtn.style.display = 'none'; downloadAudioBtn.disabled = true;

        const chunks = splitText(textToSpeak, TTS_MAX_CHARS);
        if (chunks.length === 0) { resetAudioState(); return; }
        console.log(`Split into ${chunks.length} chunk(s).`);

        const audioBlobs = []; currentSynthesisController = new AbortController(); const signal = currentSynthesisController.signal;
        try {
            for (let i = 0; i < chunks.length; i++) {
                 if (signal.aborted) { throw new DOMException("合成被中止", "AbortError"); }
                 speakOutputBtn.textContent = `生成中 ${i + 1}/${chunks.length}...`; console.log(`Synthesizing chunk ${i + 1}...`);
                 while (isApiCoolingDown()) { if (signal.aborted) { throw new DOMException("合成被中止", "AbortError"); } const wait = ttsApiCooldownTimer - Date.now(); console.log(`Cooldown wait: ${wait}ms`); await new Promise(r => setTimeout(r, Math.max(50, wait))); }
                 // !! 调用 synthesizeChunk 时传递语速和语调 !!
                 const chunkBlob = await synthesizeChunk(chunks[i], ttsRate, ttsPitch, signal); // 传递 rate 和 pitch
                 audioBlobs.push(chunkBlob); setApiCooldown();
            }
            if (audioBlobs.length > 0) {
                console.log("Concatenating blobs..."); const finalBlob = new Blob(audioBlobs, { type: audioBlobs[0].type });
                if (currentAudioBlobUrl) { URL.revokeObjectURL(currentAudioBlobUrl); } currentAudioBlobUrl = URL.createObjectURL(finalBlob);
                audioPlayer.src = currentAudioBlobUrl; audioPlayer.load();
                downloadAudioBtn.disabled = false; downloadAudioBtn.style.display = 'inline-block';
                const autoplayHandler = () => {
                    console.log("Autoplay triggered by 'canplay'."); speakOutputBtn.disabled = false;
                    audioPlayer.play().catch(e => { console.error("Autoplay failed:", e); showErrorMessage("浏览器阻止了自动播放", true); speakOutputBtn.textContent = '暂停'; }); // 失败也显示暂停，让用户点击播放
                };
                audioPlayer.removeEventListener('canplay', autoplayHandler); audioPlayer.addEventListener('canplay', autoplayHandler, { once: true });
                setTimeout(() => { if (speakOutputBtn.textContent.includes('生成中')) { console.warn("Timeout waiting for 'canplay'. Enabling button."); speakOutputBtn.disabled = false; speakOutputBtn.textContent = '朗读'; showErrorMessage("音频加载可能较慢，请稍后尝试。", true); } }, 7000);
            } else { throw new Error("No audio data generated."); }
        } catch (error) {
            if (error.name === 'AbortError') { console.log("Synthesis aborted."); showErrorMessage("合成已取消。", true); }
            else { console.error("TTS process failed:", error); showErrorMessage(`合成失败: ${error.message}`, true); }
            resetAudioState();
        } finally { currentSynthesisController = null; }
    }

    /**
     * 合成单个文本片段。
     * @param {string} textChunk - 要合成的文本片段。
     * @param {number} rate - 语速值。
     * @param {number} pitch - 语调值。
     * @param {AbortSignal} signal - 用于中止请求的 AbortSignal。
     * @returns {Promise<Blob>} 返回合成后的音频 Blob。
     */
    async function synthesizeChunk(textChunk, rate, pitch, signal) { // 添加 rate 和 pitch 参数
        if (!textChunk) { throw new Error("Invalid text chunk"); }
        const voice = ttsVoiceName;
        const outputFormat = 'audio-24khz-48kbitrate-mono-mp3';
        // !! 在 URL 中使用传入的 rate 和 pitch !!
        let url = `${ttsApiUrl}?t=${encodeURIComponent(textChunk)}&v=${encodeURIComponent(voice)}&r=${encodeURIComponent(rate)}&p=${encodeURIComponent(pitch)}&o=${outputFormat}`;

        const response = await fetch(url, { method: 'GET', headers: { 'x-api-key': ttsApiKey, 'Accept': 'audio/*' }, signal: signal });
        if (signal.aborted) { throw new DOMException("请求被中止", "AbortError"); }
        if (response.ok) {
            const blob = await response.blob();
            if (blob.type.startsWith('audio/')) { return blob; }
            else { const txt = await blob.text(); throw new Error(`Invalid audio type (${blob.type}): ${txt.substring(0,100)}`); }
        } else {
            let e = `HTTP ${response.status}`; try{ const d=await response.json();e=d?.error||d?.message||e; }catch(_){} try{ const t=await response.text();e=t||e; }catch(_){} throw new Error(`API request failed: ${e}`);
        }
    }

    /**
     * 将长文本分割成适合 API 的块。
     */
    function splitText(text, maxLength) {
        const chunks = []; let remainingText = text.trim(); const sentenceEndings = /[.。？！!?;\n]+/;
        while (remainingText.length > 0) {
            if (remainingText.length <= maxLength) { chunks.push(remainingText); break; }
            let splitPos = -1; let searchStart = Math.max(0, maxLength - 100); let potentialEnd = remainingText.substring(searchStart, maxLength + 100); let match; let lastMatchIndex = -1;
            const regex = new RegExp(sentenceEndings.source, 'g');
            while ((match = regex.exec(potentialEnd)) !== null) { let indexInOriginal = searchStart + match.index + match[0].length; if (indexInOriginal <= maxLength) { lastMatchIndex = indexInOriginal; } else { if (lastMatchIndex === -1 && indexInOriginal <= maxLength + 50) { lastMatchIndex = indexInOriginal; } break; }}
            splitPos = lastMatchIndex;
            if (splitPos <= 0 || splitPos > maxLength + 50) { splitPos = maxLength; let lastSpace = remainingText.lastIndexOf(' ', splitPos); if(lastSpace > maxLength * 0.8) { splitPos = lastSpace + 1; }}
            chunks.push(remainingText.substring(0, splitPos).trim()); remainingText = remainingText.substring(splitPos).trim();
        }
        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * 处理音频下载。
     */
    function downloadAudio() {
        if (!currentAudioBlobUrl || audioPlayer.readyState < 1) { showErrorMessage("没有可下载的音频。", true); return; }
        const link = document.createElement('a'); link.href = currentAudioBlobUrl; const t = outputText.value.substring(0, 20).replace(/\s+/g, '_').replace(/[^\w-]/g, ''); const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); const fn = `speech_${t||'audio'}_${ts}.mp3`; link.download = fn;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    /**
     * 格式化时间（秒 -> mm:ss）。
     */
    function formatTime(seconds) { const t = Math.max(0, Math.floor(seconds)); const m = Math.floor(t / 60); const s = t % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; }

    // --- 事件监听器 ---

    translateForm.addEventListener('submit', (event) => { event.preventDefault(); clearTimeout(debounceTimer); handleTranslation(); });
    const debouncedTranslate = debounce(handleTranslation, DEBOUNCE_DELAY);
    inputText.addEventListener('input', () => { const text = inputText.value.trim(); if (text) { debouncedTranslate(); } else { resetAudioState(true); }}); // 重置并清空输出
    manageApiBtn.addEventListener('click', () => { loadSettings(); modalStatus.textContent = ''; modalStatus.className = 'modal-status'; manageModal.style.display = 'block'; });
    closeModalBtn.addEventListener('click', () => { manageModal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target === manageModal) { manageModal.style.display = 'none'; }});
    saveSettingsBtn.addEventListener('click', () => { if (saveSettings()) { setTimeout(() => { manageModal.style.display = 'none'; checkApiHealth(); getApiVersion(); clearErrorMessage(); resetAudioState(); }, 1000); }});
    swapLanguagesBtn.addEventListener('click', swapLanguages);
    clearInputBtn.addEventListener('click', clearInput);
    copyOutputBtn.addEventListener('click', copyOutput); // copyOutput 函数已修改
    speakOutputBtn.addEventListener('click', handleSpeakButtonClick);
    downloadAudioBtn.addEventListener('click', downloadAudio);

    // !! 新增滑块事件监听 !!
    ttsRateSlider.addEventListener('input', () => {
        ttsRateValue.textContent = ttsRateSlider.value;
    });
    ttsPitchSlider.addEventListener('input', () => {
        ttsPitchValue.textContent = ttsPitchSlider.value;
    });


    // -- 音频事件监听 --
    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("loadedmetadata. Duration:", audioPlayer.duration, "State:", audioPlayer.readyState);
        if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            audioProgressBar.max = audioPlayer.duration; audioProgressBar.value = audioPlayer.currentTime;
            audioTimeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
            progressBarContainer.style.display = 'flex'; // 显示进度条
        } else { progressBarContainer.style.display = 'none'; console.warn("Invalid duration:", audioPlayer.duration); }
    });
    audioPlayer.addEventListener('timeupdate', () => { if (!isDraggingProgressBar && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { audioProgressBar.value = audioPlayer.currentTime; audioTimeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`; } });
    audioPlayer.addEventListener('play', () => { console.log("Play event."); speakOutputBtn.disabled = false; speakOutputBtn.textContent = '暂停'; if(!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { progressBarContainer.style.display = 'flex'; } });
    audioPlayer.addEventListener('playing', () => { console.log("Playing event."); speakOutputBtn.disabled = false; speakOutputBtn.textContent = '暂停'; });
    audioPlayer.addEventListener('pause', () => { console.log("Pause event. Ended:", audioPlayer.ended); speakOutputBtn.disabled = false; speakOutputBtn.textContent = '朗读'; if (audioPlayer.ended) { console.log("Ended."); audioPlayer.currentTime = 0; audioProgressBar.value = 0; if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { audioTimeDisplay.textContent = `${formatTime(0)} / ${formatTime(audioPlayer.duration)}`; } else { audioTimeDisplay.textContent = "0:00 / 0:00"; } } });
    audioPlayer.addEventListener('error', (e) => { if (audioPlayer.hasAttribute('src') && audioPlayer.getAttribute('src') !== '') { showErrorMessage('音频播放错误。', true); console.error("Audio error:", e); resetAudioState(); } else { console.log("Ignored audio error (no valid src)."); } });

    // --- 进度条拖动 ---
    audioProgressBar.addEventListener('input', () => { if (audioPlayer.readyState >= 1 && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { audioTimeDisplay.textContent = `${formatTime(audioProgressBar.value)} / ${formatTime(audioPlayer.duration)}`; } });
    audioProgressBar.addEventListener('mousedown', (e) => { if (audioPlayer.readyState >= 1 && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) { isDraggingProgressBar = true; wasPlayingBeforeDrag = !audioPlayer.paused; if (wasPlayingBeforeDrag) { audioPlayer.pause(); } console.log(`Drag start. Was playing: ${wasPlayingBeforeDrag}`); } else { e.preventDefault(); } });
    // --- 修复: 原来的 mouseup 逻辑在某些浏览器下可能导致无法重新播放 ---
    // 改用 'change' 事件结合 mouseup/touchend 清理标记
    const endDrag = () => {
        if (isDraggingProgressBar) {
             console.log("Drag end.");
             const seekTime = parseFloat(audioProgressBar.value);
             if (!isNaN(seekTime) && audioPlayer.readyState >= 1) {
                 console.log(`Seeking audio to: ${seekTime}`);
                 audioPlayer.currentTime = seekTime;
             }
             // 只有在拖动前是播放状态时，才尝试在拖动结束后恢复播放
             if (wasPlayingBeforeDrag) {
                 console.log("Attempting to play after drag end.");
                 // 短暂延迟可能有助于确保 seek 完成
                 setTimeout(() => {
                     audioPlayer.play().catch(e => {
                         console.error("Play after seek failed:", e);
                         showErrorMessage("无法从该位置播放。", true);
                         speakOutputBtn.disabled = false;
                         speakOutputBtn.textContent = '朗读';
                     });
                 }, 50); // 50ms 延迟
             }
             isDraggingProgressBar = false; // 清除拖动标记
             wasPlayingBeforeDrag = false; // 重置状态
         }
    };
    audioProgressBar.addEventListener('mouseup', endDrag);
    audioProgressBar.addEventListener('touchend', endDrag); // 触摸设备支持

    // 也可以在 change 事件处理 seek，但 mouseup/touchend 更好用于恢复播放状态
    audioProgressBar.addEventListener('change', () => {
        if (!isDraggingProgressBar && audioPlayer.readyState >= 1) { // 确保不是拖动中途触发的 change
            const seekTime = parseFloat(audioProgressBar.value);
            if (!isNaN(seekTime)) {
                console.log(`Seek via 'change' event to: ${seekTime}`);
                audioPlayer.currentTime = seekTime;
                // 通常 change 后不需要自动播放，用户可能只是点击了进度条
                if(audioPlayer.paused) {
                   audioTimeDisplay.textContent = `${formatTime(seekTime)} / ${formatTime(audioPlayer.duration)}`;
                }
            }
        }
    });


}); // DOMContentLoaded 结束
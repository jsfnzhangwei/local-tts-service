/**
 * script.js - 翻译与语音合成前端逻辑
 */
document.addEventListener('DOMContentLoaded', async () => { // 改为 async 函数
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
    const ttsRateSlider = document.getElementById('tts-rate-slider');
    const ttsRateValue = document.getElementById('tts-rate-value');
    const ttsPitchSlider = document.getElementById('tts-pitch-slider');
    const ttsPitchValue = document.getElementById('tts-pitch-value');
    const downloadAudioBtn = document.getElementById('download-audio-btn'); // 下载按钮
    const progressBarContainer = document.getElementById('progress-bar-container'); // 进度条容器
    const audioProgressBar = document.getElementById('audio-progress-bar'); // 进度条 input range
    const audioTimeDisplay = document.getElementById('audio-time-display'); // 时间显示 span


    // --- 状态变量 (初始值可能由 fetchDefaults 覆盖) ---
    let apiBaseUrl = '';
    let apiAuthToken = '';
    let ttsApiUrl = '';
    let ttsApiKey = '';
    let ttsVoiceName = 'zh-CN-XiaoxiaoMultilingualNeural'; // 硬编码默认值
    let ttsRate = 0; // 硬编码默认值
    let ttsPitch = 0; // 硬编码默认值

    let copyTimeout = null;
    let debounceTimer = null;
    let ttsApiCooldownTimer = null;
    const TTS_API_COOLDOWN = 5000;
    const TTS_MAX_CHARS = 2000;
    let currentAudioBlobUrl = null;
    let isDraggingProgressBar = false;
    let wasPlayingBeforeDrag = false;
    let currentSynthesisController = null;


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
    populateVoiceOptions(); // 先填充选项
    await fetchAndLoadInitialSettings(); // *** 调用新的初始化函数 ***
    checkApiHealth(); // 可以在 fetchAndLoadInitialSettings 后调用
    getApiVersion(); // 可以在 fetchAndLoadInitialSettings 后调用

    // --- 函数定义 ---

    /**
     * *** 新增函数：获取后端配置并加载初始设置 ***
     */
    async function fetchAndLoadInitialSettings() {
        console.log("Fetching default configuration from server...");
        let defaults = {};
        try {
            // 获取后端 /api/config 提供的默认值
            const response = await fetch('/api/config'); // 使用相对路径
            if (response.ok) {
                defaults = await response.json();
                console.log("Received defaults:", defaults);
            } else {
                console.warn(`Failed to fetch default config: ${response.status}`);
            }
        } catch (error) {
            console.error("Error fetching default config:", error);
            // 即使获取失败，也继续尝试加载 localStorage 或硬编码值
        }

        // 加载设置，优先级：localStorage > fetched defaults > hardcoded defaults
        apiBaseUrl = localStorage.getItem('apiBaseUrl') ?? defaults.translateApiUrl ?? '';
        apiAuthToken = localStorage.getItem('apiAuthToken') ?? defaults.translateApiToken ?? '';
        ttsApiUrl = localStorage.getItem('ttsApiUrl') ?? defaults.ttsApiUrl ?? '';
        ttsApiKey = localStorage.getItem('ttsApiKey') ?? defaults.ttsApiKey ?? '';
        ttsVoiceName = localStorage.getItem('ttsVoiceName') ?? 'zh-CN-XiaoxiaoMultilingualNeural'; // 使用硬编码作为最终备选
        // 确保 rate/pitch 是数字
        ttsRate = parseInt(localStorage.getItem('ttsRate') ?? defaults.ttsRate ?? '0', 10);
        ttsPitch = parseInt(localStorage.getItem('ttsPitch') ?? defaults.ttsPitch ?? '0', 10);
        // 纠正可能因解析错误导致的 NaN
        if (isNaN(ttsRate)) ttsRate = 0;
        if (isNaN(ttsPitch)) ttsPitch = 0;


        console.log("Final initial settings loaded:", { apiBaseUrl, apiAuthToken, ttsApiUrl, ttsApiKey, ttsVoiceName, ttsRate, ttsPitch });

        // 更新弹窗中的输入字段值 (loadSettings 的职责现在部分移到这里)
        updateModalInputs();
    }

    /**
     * *** 新增函数：用当前状态变量更新弹窗输入字段 ***
     */
     function updateModalInputs() {
        apiUrlInput.value = apiBaseUrl;
        apiTokenInput.value = apiAuthToken;
        ttsApiUrlInput.value = ttsApiUrl;
        ttsApiKeyInput.value = ttsApiKey;
        // 确保下拉框和滑块也更新
        if (ttsVoiceOptions[ttsVoiceName]) { // 检查值是否有效
             ttsVoiceSelect.value = ttsVoiceName;
        } else {
             console.warn(`Saved voice ${ttsVoiceName} not found in options, using default.`);
             ttsVoiceSelect.value = 'zh-CN-XiaoxiaoMultilingualNeural'; // 重置为已知默认值
             ttsVoiceName = ttsVoiceSelect.value; // 更新状态变量
             localStorage.setItem('ttsVoiceName', ttsVoiceName); // 更新存储
        }
        ttsRateSlider.value = ttsRate;
        ttsRateValue.textContent = ttsRate;
        ttsPitchSlider.value = ttsPitch;
        ttsPitchValue.textContent = ttsPitch;
    }


    /**
     * 填充 TTS 音色选择下拉框。
     */
    function populateVoiceOptions() {
        ttsVoiceSelect.innerHTML = ''; // 清空现有选项
        for (const [value, text] of Object.entries(ttsVoiceOptions)) {
            const option = document.createElement('option'); option.value = value; option.textContent = text; ttsVoiceSelect.appendChild(option);
        }
        // ttsVoiceSelect.value = ttsVoiceName; // 不在这里设置，由 fetchAndLoadInitialSettings 统一处理
    }

    /**
     * 从弹窗输入字段加载设置（现在主要用于“管理”按钮点击时显示当前状态）。
     */
    function loadSettingsIntoModal() {
        // 这个函数现在只是为了确保弹窗显示的是当前的、最新的状态变量值
        updateModalInputs();
    }

    /**
     * 保存所有 API 设置到 localStorage。(只保存到 localStorage)
     * @returns {boolean} - 是否保存成功
     */
    function saveSettings() {
        const newTranslateUrl = apiUrlInput.value.trim().replace(/\/$/, '');
        const newTranslateToken = apiTokenInput.value.trim();
        const newTtsUrl = ttsApiUrlInput.value.trim().replace(/\/$/, '');
        const newTtsKey = ttsApiKeyInput.value.trim();
        const newTtsVoice = ttsVoiceSelect.value;
        const newTtsRate = parseInt(ttsRateSlider.value, 10);
        const newTtsPitch = parseInt(ttsPitchSlider.value, 10);

        // 验证
        if (!newTranslateUrl) { showModalStatus("翻译 API 基地址不能为空。", "error"); return false; }
        try { new URL(newTranslateUrl); } catch (_) { showModalStatus("无效的翻译 API 基地址格式。", "error"); return false; }
        if (newTtsUrl) { try { new URL(newTtsUrl); } catch (_) { showModalStatus("无效的语音 API 地址格式。", "error"); return false; } }

        // 更新全局变量
        apiBaseUrl = newTranslateUrl;
        apiAuthToken = newTranslateToken;
        ttsApiUrl = newTtsUrl;
        ttsApiKey = newTtsKey;
        ttsVoiceName = newTtsVoice;
        ttsRate = isNaN(newTtsRate) ? 0 : newTtsRate; // 确保是数字
        ttsPitch = isNaN(newTtsPitch) ? 0 : newTtsPitch; // 确保是数字

        // *** 只保存到 localStorage ***
        localStorage.setItem('apiBaseUrl', apiBaseUrl);
        localStorage.setItem('apiAuthToken', apiAuthToken);
        localStorage.setItem('ttsApiUrl', ttsApiUrl);
        localStorage.setItem('ttsApiKey', ttsApiKey);
        localStorage.setItem('ttsVoiceName', ttsVoiceName);
        localStorage.setItem('ttsRate', ttsRate.toString());
        localStorage.setItem('ttsPitch', ttsPitch.toString());

        showModalStatus("设置已保存！(仅本地存储)", "success");
        return true;
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
    function clearErrorMessage() {
        errorMessage.textContent = '';
        ttsErrorMessage.textContent = '';
    }

    /**
     * 在主页面显示错误消息。
     */
    function showErrorMessage(message, isTtsError = false) {
        console.error(isTtsError ? "TTS 错误:" : "翻译错误:", message);
        const targetElement = isTtsError ? ttsErrorMessage : errorMessage;
        const prefix = isTtsError ? '语音合成错误' : '翻译错误';
        const fullMessage = `${prefix}: ${message}`;
        if (targetElement.textContent !== fullMessage) {
             targetElement.textContent = fullMessage;
        }
    }

    /**
     * 检查翻译 API 的 /health 端点状态。
     */
    async function checkApiHealth() {
        if (!apiBaseUrl) {
            healthStatusIndicator.className = 'status-indicator unhealthy';
            healthStatusIndicator.title = '翻译 API 地址未设置';
            return;
        }
        healthStatusIndicator.className = 'status-indicator loading';
        healthStatusIndicator.title = '正在检查翻译 API 状态...';
        try {
            // 注意：翻译API的健康检查可能不需要Token，如果需要，则需添加
            const headers = { 'Accept': '*/*', 'User-Agent': 'TranslateWebApp/1.0' };
            // if (apiAuthToken) { headers['Authorization'] = apiAuthToken; } // 如果健康检查需要Token，取消此行注释

            const response = await fetch(`${apiBaseUrl}/health`, { method: 'GET', headers: headers });
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'ok') {
                    healthStatusIndicator.className = 'status-indicator healthy';
                    healthStatusIndicator.title = `翻译 API 健康 (状态: ${data.status})`;
                } else {
                    healthStatusIndicator.className = 'status-indicator unhealthy';
                    healthStatusIndicator.title = `翻译 API 状态异常: ${data.status || '未知状态'}`;
                }
            } else {
                healthStatusIndicator.className = 'status-indicator unhealthy';
                healthStatusIndicator.title = `翻译 API 健康检查失败: ${response.status} ${response.statusText}`;
            }
        } catch (error) {
            console.error('翻译 API 健康检查失败:', error);
            healthStatusIndicator.className = 'status-indicator unhealthy';
            healthStatusIndicator.title = `翻译 API 健康检查错误: ${error.message}`;
        }
    }

    /**
     * 从 /version 端点获取翻译 API 版本信息。
     */
    async function getApiVersion() {
         if (!apiBaseUrl) {
             apiVersionSpan.textContent = 'N/A (未设置翻译 API)';
             return;
         }
         apiVersionSpan.textContent = '加载中...';
         try {
             // 注意：版本获取可能不需要Token，如果需要，则需添加
             const headers = { 'Accept': '*/*', 'User-Agent': 'TranslateWebApp/1.0' };
            // if (apiAuthToken) { headers['Authorization'] = apiAuthToken; } // 如果版本获取需要Token，取消此行注释

             const response = await fetch(`${apiBaseUrl}/version`, { method: 'GET', headers: headers });
             if (response.ok) {
                 const data = await response.json();
                 apiVersionSpan.textContent = data.version || '未知版本';
             } else {
                 apiVersionSpan.textContent = `错误 (${response.status})`;
                 console.error('获取翻译 API 版本失败:', response.statusText);
             }
         } catch (error) {
             apiVersionSpan.textContent = '错误';
             console.error('获取翻译 API 版本失败:', error);
         }
    }

    /**
     * 防抖函数。
     */
    function debounce(func, delay) {
        // 返回一个函数，这个函数会在最后一次调用后等待 delay 毫秒再执行 func
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer); // 清除之前的计时器
            debounceTimer = setTimeout(() => {
                // 检查输入框是否还有内容，防止清空时触发翻译
                if (inputText.value.trim()) {
                    func.apply(context, args); // 执行真正的函数
                } else {
                    // 如果输入框清空了，也重置音频状态并清空输出
                    resetAudioState(true);
                }
            }, delay);
        }
    }

    /**
     * 重置音频播放状态和相关 UI。
     */
    function resetAudioState(clearOutput = false) {
        console.log("Resetting audio state.");
        if (currentSynthesisController) {
             currentSynthesisController.abort(); // 中止进行中的合成请求
             currentSynthesisController = null;
             console.log("Aborted ongoing synthesis.");
        }
        audioPlayer.pause();
        audioPlayer.removeAttribute('src'); // 移除 src 属性
        audioPlayer.load(); // 重新加载 audio 元素以应用更改

        if (currentAudioBlobUrl) {
            URL.revokeObjectURL(currentAudioBlobUrl); // 释放之前创建的 Blob URL
            currentAudioBlobUrl = null;
        }

        speakOutputBtn.disabled = false;
        speakOutputBtn.textContent = '朗读';
        progressBarContainer.style.display = 'none'; // 隐藏进度条
        audioProgressBar.value = 0; // 重置进度条值
        audioTimeDisplay.textContent = "0:00 / 0:00"; // 重置时间显示
        downloadAudioBtn.style.display = 'none'; // 隐藏下载按钮
        downloadAudioBtn.disabled = true;

        isDraggingProgressBar = false; // 重置拖动状态
        wasPlayingBeforeDrag = false;

        if (clearOutput) {
            outputText.value = ''; // 如果需要，清空输出文本框
        }
    }

    /**
     * 处理文本翻译逻辑。
     */
    async function handleTranslation() {
        console.log("Handling translation.");
        clearErrorMessage(); // 清除之前的错误信息
        resetAudioState();   // 重置音频状态

        const textToTranslate = inputText.value.trim();
        if (!textToTranslate) {
            outputText.value = ''; // 如果输入为空，清空输出
            return;
        }

        if (!apiBaseUrl) {
            showErrorMessage("请先在“管理”中设置翻译 API 地址。", false);
            return;
        }

        const sourceLang = sourceLangSelect.value;
        const targetLang = targetLangSelect.value;

        translateBtn.disabled = true; // 禁用翻译按钮
        translateBtn.textContent = '翻译中...';
        outputText.value = '正在加载...'; // 显示加载状态

        try {
            const headers = {
                'Content-Type': 'application/json',
                'Accept': '*/*', // 明确接受任何响应类型
                'User-Agent': 'TranslateWebApp/1.0' // 添加 User-Agent
            };
            // 如果设置了 Token，添加到请求头
            if (apiAuthToken) {
                headers['Authorization'] = apiAuthToken; // 通常使用 Bearer Token
                // headers['Authorization'] = `Bearer ${apiAuthToken}`; // 或者根据你的API要求调整
            }

            const response = await fetch(`${apiBaseUrl}/translate`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    from: sourceLang,
                    to: targetLang,
                    text: textToTranslate
                })
            });

            const data = await response.json(); // 尝试解析 JSON 响应

            // 检查输入是否在请求期间被改变
            if (inputText.value.trim() !== textToTranslate) {
                console.log("Input text changed during translation, ignoring result.");
                // 不更新输出，保持 "正在加载..." 或用户的新输入对应的状态
                return;
            }


            if (response.ok) {
                if (data && data.result !== undefined) {
                     outputText.value = data.result; // 更新输出文本框
                } else {
                    // API 成功响应但数据格式不符合预期
                    showErrorMessage("API 响应格式无效。", false);
                    outputText.value = ''; // 清空输出
                }
            } else {
                // API 返回错误状态码
                const errorMsg = data?.error || data?.message || `HTTP 错误 ${response.status}`;
                showErrorMessage(`翻译失败: ${errorMsg}`, false);
                outputText.value = ''; // 清空输出
            }
        } catch (error) {
            // 网络错误或其他异常
            // 再次检查输入是否已改变
            if (inputText.value.trim() === textToTranslate) {
                 showErrorMessage(`网络或处理错误: ${error.message}`, false);
                 outputText.value = ''; // 清空输出
            } else {
                console.log("Input changed during network error, ignoring error display.");
            }
        } finally {
            // 无论成功或失败，都恢复翻译按钮状态
            translateBtn.disabled = false;
            translateBtn.textContent = '翻译';
            // 如果 outputText 仍然是 '正在加载...'，说明请求失败或被忽略，清空它
            if (outputText.value === '正在加载...') {
                 outputText.value = '';
            }
        }
    }

    /**
     * 交换源语言和目标语言。
     */
    function swapLanguages() {
        const tempLang = sourceLangSelect.value;
        sourceLangSelect.value = targetLangSelect.value;
        targetLangSelect.value = tempLang;
        // 如果输出区有内容，重置音频状态，因为语言变了，之前的音频无效了
        if(outputText.value.trim() && outputText.value !== '正在加载...') {
            resetAudioState(); // 不需要清空输出区
        }
    }

    /**
     * 清除输入、输出、错误和音频状态。
     */
    function clearInput() {
        inputText.value = '';        // 清空输入框
        clearErrorMessage();       // 清除错误信息
        clearTimeout(debounceTimer); // 清除可能正在等待的防抖计时器
        resetAudioState(true);     // 重置音频状态并清空输出框
        inputText.focus();         // 将焦点移回输入框
    }

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
    function showCopyMessage(message, isError) {
        if (copyTimeout) clearTimeout(copyTimeout); // 清除之前的计时器
        copySuccessMsg.textContent = message;
        copySuccessMsg.style.color = isError ? '#f44336' : '#4CAF50'; // 设置颜色
        copySuccessMsg.classList.add('show'); // 显示提示
        copyTimeout = setTimeout(() => {
            copySuccessMsg.classList.remove('show'); // 隐藏提示
            copyTimeout = null; // 清除计时器 ID
        }, 1500); // 1.5秒后隐藏
    }

    // --- 文本转语音 (TTS) 函数 ---

    function isApiCoolingDown() {
        return ttsApiCooldownTimer && Date.now() < ttsApiCooldownTimer;
    }
    function setApiCooldown() {
        ttsApiCooldownTimer = Date.now() + TTS_API_COOLDOWN;
    }

    /**
     * 处理朗读按钮的点击事件 (播放/暂停切换 或 触发合成)。
     */
    function handleSpeakButtonClick() {
        console.log("Speak click. Src:", audioPlayer.src, "State:", audioPlayer.readyState, "URL:", currentAudioBlobUrl);

        // 如果正在合成中，点击则取消合成
        if (speakOutputBtn.textContent.includes('生成中') && currentSynthesisController) {
            console.log("Aborting synthesis...");
            resetAudioState(); // 重置状态（会中止请求）
            return;
        }

        // 如果已有可播放的音频
        if (currentAudioBlobUrl && audioPlayer.readyState >= 1) { // readyState >= 1 表示至少元数据已加载
            if (audioPlayer.paused) {
                console.log("Audio exists, play.");
                audioPlayer.play().catch(e => {
                    console.error("Play failed:", e);
                    showErrorMessage("无法播放音频。", true);
                    // 即使播放失败，也要确保按钮状态正确
                    speakOutputBtn.disabled = false;
                    speakOutputBtn.textContent = '朗读';
                });
            } else {
                console.log("Audio playing, pause.");
                audioPlayer.pause();
            }
        }
        else {
            // 没有可播放的音频，开始合成
            console.log("No valid audio, initiate TTS.");
            textToSpeech();
        }
    }

    /**
     * 将文本（可能很长）转换为语音并尝试自动播放。
     */
    async function textToSpeech() {
        clearErrorMessage(); // 清除之前的错误
        const textToSpeak = outputText.value.trim();

        if (!textToSpeak || textToSpeak === '正在加载...') {
            showErrorMessage("没有可朗读的文本。", true);
            return;
        }
        if (!ttsApiUrl || !ttsApiKey) {
            showErrorMessage("请在“管理”中设置语音 API 地址和 Key。", true);
            return;
        }

        // 检查冷却时间
        if (isApiCoolingDown()) {
            const timeLeft = Math.ceil((ttsApiCooldownTimer - Date.now()) / 1000);
            showErrorMessage(`请稍候 ${timeLeft} 秒...`, true);
            return; // 阻止执行
        }

        resetAudioState(); // 重置之前的音频状态
        console.log("Starting TTS process...");
        speakOutputBtn.disabled = true; // 禁用按钮
        speakOutputBtn.textContent = '准备中...';
        progressBarContainer.style.display = 'none'; // 隐藏进度条
        downloadAudioBtn.style.display = 'none'; // 隐藏下载按钮
        downloadAudioBtn.disabled = true;

        const chunks = splitText(textToSpeak, TTS_MAX_CHARS); // 分割文本
        if (chunks.length === 0) {
            resetAudioState(); // 如果没有有效文本块，重置
            return;
        }
        console.log(`Split into ${chunks.length} chunk(s).`);

        const audioBlobs = [];
        currentSynthesisController = new AbortController(); // 创建中止控制器
        const signal = currentSynthesisController.signal;

        try {
            for (let i = 0; i < chunks.length; i++) {
                 if (signal.aborted) { // 检查是否已中止
                     throw new DOMException("合成被中止", "AbortError");
                 }
                 speakOutputBtn.textContent = `生成中 ${i + 1}/${chunks.length}...`; // 更新按钮文本
                 console.log(`Synthesizing chunk ${i + 1}...`);

                 // 等待冷却结束
                 while (isApiCoolingDown()) {
                     if (signal.aborted) { throw new DOMException("合成被中止", "AbortError"); }
                     const wait = ttsApiCooldownTimer - Date.now();
                     console.log(`Cooldown wait: ${wait}ms`);
                     await new Promise(r => setTimeout(r, Math.max(50, wait))); // 等待
                 }

                 // 调用 API 合成单个片段，传递当前语速和语调
                 const chunkBlob = await synthesizeChunk(chunks[i], ttsRate, ttsPitch, signal);
                 audioBlobs.push(chunkBlob);
                 setApiCooldown(); // 设置下一次冷却开始时间
            }

            // 如果成功合成了所有片段
            if (audioBlobs.length > 0) {
                console.log("Concatenating blobs...");
                // 合并所有音频 Blob
                const finalBlob = new Blob(audioBlobs, { type: audioBlobs[0].type });

                if (currentAudioBlobUrl) {
                    URL.revokeObjectURL(currentAudioBlobUrl); // 释放旧的 URL
                }
                currentAudioBlobUrl = URL.createObjectURL(finalBlob); // 创建新的 URL

                audioPlayer.src = currentAudioBlobUrl; // 设置播放器源
                audioPlayer.load(); // 加载音频

                downloadAudioBtn.disabled = false; // 启用下载按钮
                downloadAudioBtn.style.display = 'inline-block'; // 显示下载按钮

                // 使用 canplay 事件尝试自动播放
                const autoplayHandler = () => {
                    console.log("Autoplay triggered by 'canplay'.");
                    speakOutputBtn.disabled = false; // 启用朗读按钮
                    // 尝试播放
                    audioPlayer.play().catch(e => {
                        console.error("Autoplay failed:", e);
                        showErrorMessage("浏览器阻止了自动播放，请手动点击“暂停”再点击“朗读”", true);
                        // 即使自动播放失败，按钮也应该变为“暂停”状态，让用户可以点击播放
                        speakOutputBtn.textContent = '暂停';
                    });
                };
                // 移除旧监听器，添加新监听器 (确保只触发一次)
                audioPlayer.removeEventListener('canplay', autoplayHandler);
                audioPlayer.addEventListener('canplay', autoplayHandler, { once: true });

                // 设置超时，防止 'canplay' 事件不触发
                setTimeout(() => {
                    if (speakOutputBtn.textContent.includes('生成中')) {
                        console.warn("Timeout waiting for 'canplay'. Enabling button.");
                        speakOutputBtn.disabled = false;
                        speakOutputBtn.textContent = '朗读';
                        showErrorMessage("音频加载可能较慢，请稍后尝试。", true);
                    }
                }, 7000); // 7 秒超时

            } else {
                // 虽然循环完成但没有得到 Blob
                throw new Error("No audio data generated.");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Synthesis aborted by user.");
                showErrorMessage("合成已取消。", true);
            } else {
                console.error("TTS process failed:", error);
                showErrorMessage(`合成失败: ${error.message}`, true);
            }
            resetAudioState(); // 出错时重置状态
        } finally {
            currentSynthesisController = null; // 清理中止控制器
            // 确保按钮最终恢复可用状态，除非仍在播放
             if (!audioPlayer.paused) {
                 // 如果仍在播放（例如自动播放成功），保持“暂停”状态
                 speakOutputBtn.textContent = '暂停';
                 speakOutputBtn.disabled = false;
             } else if (!speakOutputBtn.textContent.includes('朗读')) {
                  // 如果处理结束但按钮不是“朗读”，则恢复
                  speakOutputBtn.textContent = '朗读';
                  speakOutputBtn.disabled = false;
             }

        }
    }

    /**
     * 合成单个文本片段。
     * @param {string} textChunk - 要合成的文本片段。
     * @param {number} rate - 语速值。
     * @param {number} pitch - 语调值。
     * @param {AbortSignal} signal - 用于中止请求的 AbortSignal。
     * @returns {Promise<Blob>} 返回合成后的音频 Blob。
     */
    async function synthesizeChunk(textChunk, rate, pitch, signal) {
        if (!textChunk) {
            throw new Error("Invalid text chunk provided to synthesizeChunk");
        }
        const voice = ttsVoiceName; // 使用全局状态
        const outputFormat = 'audio-24khz-48kbitrate-mono-mp3'; // 或其他支持的格式

        // 构建带参数的 URL
        // 使用 encodeURIComponent 确保特殊字符被正确编码
        let url = `${ttsApiUrl}?t=${encodeURIComponent(textChunk)}&v=${encodeURIComponent(voice)}&r=${encodeURIComponent(rate)}&p=${encodeURIComponent(pitch)}&o=${outputFormat}`;

        try {
            const response = await fetch(url, {
                method: 'GET', // 假设你的代理是 GET 请求
                headers: {
                    'x-api-key': ttsApiKey, // 使用全局状态的 API Key
                    'Accept': 'audio/*' // 告诉服务器期望接收音频
                },
                signal: signal // 传递 AbortSignal 以便可以取消请求
            });

            if (signal.aborted) {
                throw new DOMException("请求被中止", "AbortError");
            }

            if (response.ok) {
                const blob = await response.blob();
                // 基础验证：确保响应是音频类型
                if (blob.type.startsWith('audio/')) {
                    return blob;
                } else {
                    // 如果类型不对，尝试读取文本内容以获取错误信息
                    const txt = await blob.text();
                    console.error("Received non-audio content:", txt);
                    throw new Error(`服务器返回了无效的音频类型 (${blob.type})`);
                }
            } else {
                // 处理 API 错误响应
                let errorDetail = `HTTP 错误 ${response.status}`;
                try {
                    // 尝试解析 JSON 错误信息
                    const errorData = await response.json();
                    errorDetail = errorData?.error || errorData?.message || errorDetail;
                } catch (_) {
                    try {
                         // 尝试解析文本错误信息
                         const errorText = await response.text();
                         errorDetail = errorText || errorDetail;
                    } catch (e) {
                         console.error("Error reading error response body:", e);
                    }
                }
                throw new Error(`API 请求失败: ${errorDetail}`);
            }
        } catch (error) {
             // 捕获 fetch 本身的错误（网络问题等）或上面抛出的错误
             if (error.name === 'AbortError') {
                 console.log("Synthesize chunk fetch aborted.");
             } else {
                 console.error("Error in synthesizeChunk:", error);
             }
             throw error; // 重新抛出，让上层调用者处理
        }
    }

    /**
     * 将长文本分割成适合 API 的块。优先按标点分割。
     */
    function splitText(text, maxLength) {
        const chunks = [];
        let remainingText = text.trim();
        // 匹配常见的中英文句末标点，以及换行符
        const sentenceEndings = /[.。？！!?;\n]+/;

        while (remainingText.length > 0) {
            if (remainingText.length <= maxLength) {
                chunks.push(remainingText); // 剩余部分小于等于最大长度，直接添加
                break; // 完成分割
            }

            let splitPos = -1;
            // 尝试在 maxLength 附近找到一个合适的标点符号
            // 从 maxLength 往前找一段距离 (e.g., 100 chars)，再往后找一点 (e.g., 50 chars)
            // 以防标点正好在 maxLength 边缘
            let searchEnd = Math.min(remainingText.length, maxLength + 50);
            let searchArea = remainingText.substring(0, searchEnd);
            let lastValidPunctuationIndex = -1;

            // 正则查找所有标点位置
            const punctuationRegex = new RegExp(sentenceEndings.source, 'g');
            let match;
            while ((match = punctuationRegex.exec(searchArea)) !== null) {
                let index = match.index + match[0].length; // 标点结束的位置
                if (index <= maxLength) {
                    lastValidPunctuationIndex = index; // 记录最后一个不超过 maxLength 的标点位置
                } else {
                    // 如果第一个标点就超过 maxLength，但仍在 maxLength+50 范围内，
                    // 并且我们还没找到任何合适的标点，就用这个超出的点
                    if (lastValidPunctuationIndex === -1) {
                       lastValidPunctuationIndex = index;
                    }
                    break; // 不再往后找标点
                }
            }

            splitPos = lastValidPunctuationIndex;


            // 如果找不到合适的标点分割点
            if (splitPos <= 0) {
                // 直接在 maxLength 处硬分割
                splitPos = maxLength;
                // 尝试在硬分割点前回溯找到最后一个空格，避免单词被切开
                let lastSpace = remainingText.lastIndexOf(' ', splitPos);
                // 只有当空格位置比较靠后时才使用（例如，在 80% 长度之后）
                if(lastSpace > maxLength * 0.8) {
                    splitPos = lastSpace + 1; // 在空格后分割
                }
                 console.warn(`No suitable punctuation found, splitting at position ${splitPos}.`);
            }

            // 添加分割出的块
            chunks.push(remainingText.substring(0, splitPos).trim());
            // 更新剩余文本
            remainingText = remainingText.substring(splitPos).trim();
        }

        // 过滤掉可能的空块
        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * 处理音频下载。
     */
    function downloadAudio() {
        if (!currentAudioBlobUrl || audioPlayer.readyState < 1) {
            showErrorMessage("没有可下载的音频。", true);
            return;
        }

        const link = document.createElement('a');
        link.href = currentAudioBlobUrl;

        // 生成文件名
        const textSnippet = outputText.value.substring(0, 20) // 取前20个字符
                             .replace(/\s+/g, '_')       // 空格替换为下划线
                             .replace(/[^\w-]/g, '');   // 移除除字母、数字、下划线、连字符外的所有字符
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); // 格式化时间戳
        const filename = `speech_${textSnippet || 'audio'}_${timestamp}.mp3`; // 组合文件名

        link.download = filename; // 设置下载文件名

        // 触发下载
        document.body.appendChild(link); // 需要添加到 DOM 中才能触发点击
        link.click();
        document.body.removeChild(link); // 下载后移除元素
    }

    /**
     * 格式化时间（秒 -> mm:ss）。
     */
    function formatTime(seconds) {
        const totalSeconds = Math.max(0, Math.floor(seconds)); // 确保是非负整数
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        // 使用 padStart 补零，确保秒数总是两位数
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    // --- 事件监听器 ---

    translateForm.addEventListener('submit', (event) => {
        event.preventDefault(); // 阻止表单默认提交行为
        clearTimeout(debounceTimer); // 清除防抖计时器，立即执行翻译
        handleTranslation();
    });

    // 输入框输入事件处理（带防抖）
    const debouncedTranslate = debounce(handleTranslation, DEBOUNCE_DELAY);
    inputText.addEventListener('input', () => {
        const text = inputText.value.trim();
        if (text) { // 只有当输入框有内容时才触发（防抖）翻译
            debouncedTranslate();
        } else { // 如果清空了输入框
            clearErrorMessage();
            clearTimeout(debounceTimer); // 清除计时器
            resetAudioState(true); // 重置音频并清空输出
        }
    });

    // 管理弹窗相关事件
    manageApiBtn.addEventListener('click', () => {
        loadSettingsIntoModal(); // 点击管理时，加载当前设置到弹窗
        modalStatus.textContent = ''; // 清空弹窗状态消息
        modalStatus.className = 'modal-status';
        manageModal.style.display = 'block'; // 显示弹窗
    });
    closeModalBtn.addEventListener('click', () => {
        manageModal.style.display = 'none'; // 关闭弹窗
    });
    window.addEventListener('click', (event) => {
        // 点击弹窗外部区域关闭弹窗
        if (event.target === manageModal) {
            manageModal.style.display = 'none';
        }
    });
    saveSettingsBtn.addEventListener('click', () => {
        if (saveSettings()) { // 如果保存成功 (只会保存到 localStorage)
            // 保存后立即更新健康状态和版本信息
            checkApiHealth();
            getApiVersion();
            // 短暂延迟后关闭弹窗
            setTimeout(() => {
                manageModal.style.display = 'none';
            }, 800);
        }
    });

    // 其他按钮事件
    swapLanguagesBtn.addEventListener('click', swapLanguages);
    clearInputBtn.addEventListener('click', clearInput);
    copyOutputBtn.addEventListener('click', copyOutput); // copyOutput 函数已修复
    speakOutputBtn.addEventListener('click', handleSpeakButtonClick);
    downloadAudioBtn.addEventListener('click', downloadAudio);

    // TTS 滑块事件监听
    ttsRateSlider.addEventListener('input', () => {
        ttsRateValue.textContent = ttsRateSlider.value; // 更新数值显示
    });
    ttsPitchSlider.addEventListener('input', () => {
        ttsPitchValue.textContent = ttsPitchSlider.value; // 更新数值显示
    });


    // --- 音频播放器事件监听 ---
    audioPlayer.addEventListener('loadedmetadata', () => {
        console.log("loadedmetadata. Duration:", audioPlayer.duration, "State:", audioPlayer.readyState);
        if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            audioProgressBar.max = audioPlayer.duration;
            audioProgressBar.value = audioPlayer.currentTime;
            audioTimeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
            progressBarContainer.style.display = 'flex'; // 显示进度条
        } else {
            progressBarContainer.style.display = 'none'; // 隐藏进度条
            console.warn("Invalid duration on loadedmetadata:", audioPlayer.duration);
        }
    });

    audioPlayer.addEventListener('timeupdate', () => {
        // 只有在不拖动进度条时才更新
        if (!isDraggingProgressBar && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            audioProgressBar.value = audioPlayer.currentTime;
            audioTimeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
        }
    });

    audioPlayer.addEventListener('play', () => {
        console.log("Play event.");
        speakOutputBtn.disabled = false; // 确保按钮可用
        speakOutputBtn.textContent = '暂停';
        // 确保进度条可见
        if(!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
             progressBarContainer.style.display = 'flex';
        }
    });

    audioPlayer.addEventListener('playing', () => {
        // playing 事件表示实际开始播放
        console.log("Playing event.");
        speakOutputBtn.disabled = false; // 确保按钮可用
        speakOutputBtn.textContent = '暂停';
    });

    audioPlayer.addEventListener('pause', () => {
        console.log("Pause event. Ended:", audioPlayer.ended);
        speakOutputBtn.disabled = false; // 确保按钮可用
        speakOutputBtn.textContent = '朗读';
        // 如果是播放结束导致的暂停
        if (audioPlayer.ended) {
            console.log("Audio playback ended.");
            audioPlayer.currentTime = 0; // 重置播放时间到开头
            audioProgressBar.value = 0;  // 重置进度条
            // 更新时间显示
            if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
                audioTimeDisplay.textContent = `${formatTime(0)} / ${formatTime(audioPlayer.duration)}`;
            } else {
                audioTimeDisplay.textContent = "0:00 / 0:00";
            }
        }
    });

    audioPlayer.addEventListener('error', (e) => {
        // 仅在有有效 src 时报告错误，避免无 src 时的固有错误
        if (audioPlayer.hasAttribute('src') && audioPlayer.getAttribute('src') !== '') {
            showErrorMessage('音频播放错误。', true);
            console.error("Audio player error:", e);
            resetAudioState(); // 发生错误时重置状态
        } else {
            console.log("Ignored audio error event (no valid src).");
        }
    });

    // --- 进度条拖动处理 ---
    // 'input' 事件在拖动过程中实时触发
    audioProgressBar.addEventListener('input', () => {
        // 只有在元数据已加载后才更新时间显示
        if (audioPlayer.readyState >= 1 && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
             audioTimeDisplay.textContent = `${formatTime(audioProgressBar.value)} / ${formatTime(audioPlayer.duration)}`;
        }
    });

    // 鼠标按下或触摸开始时
    const startDrag = (e) => {
        // 必须有可播放的音频才能拖动
        if (audioPlayer.readyState >= 1 && !isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
            isDraggingProgressBar = true; // 设置拖动标记
            wasPlayingBeforeDrag = !audioPlayer.paused; // 记录拖动前的播放状态
            if (wasPlayingBeforeDrag) {
                audioPlayer.pause(); // 如果在播放，先暂停
            }
            console.log(`Drag start. Was playing: ${wasPlayingBeforeDrag}`);
        } else {
            // 如果音频未准备好，阻止默认的滑块行为（如果适用）
            if (e && e.preventDefault) e.preventDefault();
        }
    };
    audioProgressBar.addEventListener('mousedown', startDrag);
    audioProgressBar.addEventListener('touchstart', startDrag); // 触摸支持


    // 鼠标松开或触摸结束时
    const endDrag = () => {
        if (isDraggingProgressBar) {
             console.log("Drag end.");
             const seekTime = parseFloat(audioProgressBar.value);
             if (!isNaN(seekTime) && audioPlayer.readyState >= 1) {
                 console.log(`Seeking audio to: ${seekTime}`);
                 audioPlayer.currentTime = seekTime; // 设置播放时间
             }
             // 只有在拖动前是播放状态时，才尝试在拖动结束后恢复播放
             if (wasPlayingBeforeDrag) {
                 console.log("Attempting to play after drag end.");
                 // 使用 requestAnimationFrame 或短 setTimeout 可能有助于确保 seek 生效
                 requestAnimationFrame(() => {
                      audioPlayer.play().catch(e => {
                          console.error("Play after seek failed:", e);
                          showErrorMessage("无法从该位置播放。", true);
                          speakOutputBtn.disabled = false;
                          speakOutputBtn.textContent = '朗读';
                      });
                 });
             }
             isDraggingProgressBar = false; // 清除拖动标记
             wasPlayingBeforeDrag = false; // 重置状态
         }
    };
    audioProgressBar.addEventListener('mouseup', endDrag);
    audioProgressBar.addEventListener('touchend', endDrag); // 触摸支持


    // 'change' 事件在点击或拖动释放后触发，通常用于最终确定值
    audioProgressBar.addEventListener('change', () => {
        // 确保不是拖动过程中间触发的（虽然理论上 change 在释放后触发）
        // 并且音频已准备好
        if (!isDraggingProgressBar && audioPlayer.readyState >= 1) {
            const seekTime = parseFloat(audioProgressBar.value);
            if (!isNaN(seekTime)) {
                console.log(`Seek via 'change' event to: ${seekTime}`);
                audioPlayer.currentTime = seekTime;
                // 如果此时是暂停状态（例如用户只是点击了进度条），更新时间显示
                if(audioPlayer.paused) {
                   if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
                        audioTimeDisplay.textContent = `${formatTime(seekTime)} / ${formatTime(audioPlayer.duration)}`;
                   }
                }
            }
        }
    });


}); // DOMContentLoaded 结束
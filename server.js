require('dotenv').config(); // 加载 .env 文件中的环境变量
const express = require('express');
const cors = require('cors');
const { webcrypto } = require('node:crypto'); // 引入 Node.js 的 Web Crypto API

const app = express();
const PORT = process.env.PORT || 6911;
const API_KEY = process.env.API_KEY; // 从环境变量获取 API Key

if (!API_KEY) {
    console.error("错误：环境变量 API_KEY 未设置。请在 .env 文件或系统中设置它。");
    process.exit(1); // 退出程序
}

// --- 从原始 worker.js 移植过来的代码 (有修改) ---

const encoder = new TextEncoder();
let expiredAt = null;
let endpoint = null;
let clientId = "76a75279-2ffa-4c3d-8db8-7b47252aa41c";

// 内存缓存，用于 voiceList (简化版，无自动过期)
let voiceListCache = null;
let voiceListCacheTime = 0;
const VOICE_LIST_CACHE_TTL = 600 * 1000; // 10 分钟 (毫秒)

// --- 工具函数 (大部分与 worker.js 相同，但 crypto 使用 Node.js 版本) ---

function uuid() {
    return webcrypto.randomUUID().replace(/-/g, "");
}

async function hmacSha256(key, data) {
    const cryptoKey = await webcrypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const signature = await webcrypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    return new Uint8Array(signature);
}

async function base64ToBytes(base64) {
    const binaryString = atob(base64); // atob/btoa 在 Node.js v16+ 全局可用
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function bytesToBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes)); // atob/btoa 在 Node.js v16+ 全局可用
}

function dateFormat() {
    const formattedDate = (new Date()).toUTCString().replace(/GMT/, "").trim() + " GMT";
    return formattedDate.toLowerCase();
}

async function sign(urlStr) {
    const url = urlStr.split("://")[1];
    const encodedUrl = encodeURIComponent(url);
    const uuidStr = uuid();
    const formattedDate = dateFormat();
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
    // 注意：这个硬编码的密钥需要保持一致
    const decode = await base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
    const signData = await hmacSha256(decode, bytesToSign);
    const signBase64 = await bytesToBase64(signData);
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

async function getEndpoint() {
    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const headers = {
        "Accept-Language": "zh-Hans",
        "X-ClientVersion": "4.0.530a 5fe1dc6c",
        "X-UserId": "0f04d16a175c411e",
        "X-HomeGeographicRegion": "zh-Hans-CN",
        "X-ClientTraceId": clientId,
        "X-MT-Signature": await sign(endpointUrl), // 生成签名
        "User-Agent": "okhttp/4.5.0",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "0",
        "Accept-Encoding": "gzip"
    };
    // 使用 Node.js 的全局 fetch
    const response = await fetch(endpointUrl, {
        method: "POST",
        headers: headers
    });
    if (!response.ok) {
        throw new Error(`获取 Endpoint 失败: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function getSsml(text, voiceName, rate, pitch) {
    // SSML 结构保持不变
     return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
             <voice name="${voiceName}">
                 <mstts:express-as style="general" styledegree="1.0" role="default">
                     <prosody rate="${rate}%" pitch="${pitch}%" volume="50">${text}</prosody>
                 </mstts:express-as>
             </voice>
         </speak>`;
}

// --- Express 中间件和路由 ---

// CORS 配置
app.use(cors({
    origin: '*', // 允许所有来源，生产环境建议限制具体来源
    methods: "GET,HEAD,POST,OPTIONS",
    allowedHeaders: "Content-Type, x-api-key",
    exposedHeaders: ['Content-Disposition'], // 暴露 Content-Disposition 以支持下载文件名
    maxAge: 86400 // 预检请求缓存时间
}));

// API Key 验证中间件
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).type('text/plain').send('Unauthorized');
    }
    next();
};

// 应用 API Key 验证到需要保护的路由
app.use(['/tts', '/voices'], verifyApiKey);

// --- 路由处理 ---

// 根路径帮助信息
app.get('/', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.type('text/html').send(`
    <ol>
      <li> /tts?t=[text]&v=[voice]&r=[rate]&p=[pitch]&o=[outputFormat]&d=[download_flag] <a href="${baseUrl}/tts?t=hello, world&v=zh-CN-XiaoxiaoMultilingualNeural&r=0&p=0&o=audio-24khz-48kbitrate-mono-mp3&d=false&x-api-key=${API_KEY}">try (需要添加 x-api-key header 或作为查询参数)</a> </li>
      <li> /voices?l=[locate, like zh|zh-CN]&f=[format, 0/1/empty 0(TTS-Server)|1(MultiTTS)] <a href="${baseUrl}/voices?l=zh&f=1&x-api-key=${API_KEY}">try (需要添加 x-api-key header 或作为查询参数)</a> </li>
    </ol>
    <p><b>注意:</b> 实际调用 API 时请将 'x-api-key' 放在请求头中，而不是查询参数里。</p>
    `);
});

// 获取语音列表路由
app.get('/voices', async (req, res) => {
    const l = (req.query.l || "").toLowerCase();
    const f = req.query.f;

    try {
        let responseData;
        const now = Date.now();

        // 检查缓存
        if (voiceListCache && (now - voiceListCacheTime < VOICE_LIST_CACHE_TTL)) {
            console.log("使用缓存的 voice list");
            responseData = voiceListCache;
        } else {
            console.log("重新获取 voice list");
            const headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26",
                "X-Ms-Useragent": "SpeechStudio/2021.05.001",
                "Content-Type": "application/json",
                "Origin": "https://azure.microsoft.com",
                "Referer": "https://azure.microsoft.com"
            };
            const listResponse = await fetch("https://eastus.api.speech.microsoft.com/cognitiveservices/voices/list", { headers: headers });
            if (!listResponse.ok) {
                throw new Error(`获取 Voice List 失败: ${listResponse.status} ${listResponse.statusText}`);
            }
            responseData = await listResponse.json();
            // 更新缓存
            voiceListCache = responseData;
            voiceListCacheTime = now;
        }


        // 过滤
        if (l.length > 0) {
            responseData = responseData.filter(item => item.Locale.toLowerCase().includes(l));
        }

        // 格式化
        if (f === "0") {
             const formattedList = responseData.map(item => {
                // 保持和 Worker 一致的格式化逻辑
                 return `
- !!org.nobody.multitts.tts.speaker.Speaker
  avatar: ''
  code: ${item.ShortName}
  desc: ''
  extendUI: ''
  gender:${item.Gender === "Female" ? "0" : "1"}
  name: ${item.LocalName}
  note: 'wpm: ${item.WordsPerMinute || ""}'
  param: ''
  sampleRate: ${item.SampleRateHertz || "24000"}
  speed: 1.5
  type: 1
  volume: 1`;
             });
            return res.type('text/plain').send(formattedList.join("\n")); // 使用 text/plain 可能更合适
        } else if (f === "1") {
            const map = new Map(responseData.map(item => [item.ShortName, item.LocalName]));
            return res.json(Object.fromEntries(map));
        } else {
            return res.json(responseData);
        }
    } catch (error) {
        console.error("处理 /voices 错误:", error);
        res.status(500).type('text/plain').send(`服务器内部错误: ${error.message}`);
    }
});

// 文本转语音路由
app.get('/tts', async (req, res) => {
    // 从查询参数获取
    const text = req.query.t || "";
    const voiceName = req.query.v || "zh-CN-XiaoxiaoMultilingualNeural";
    const rate = Number(req.query.r) || 0;
    const pitch = Number(req.query.p) || 0;
    const outputFormat = req.query.o || "audio-24khz-48kbitrate-mono-mp3";
    // 将 'true' 或 '1' 视为 true，其他视为 false
    const download = ['true', '1'].includes(String(req.query.d).toLowerCase());

    if (!text) {
        return res.status(400).type('text/plain').send('缺少文本参数 "t"');
    }

    try {
        // 检查/刷新 Azure 认证令牌
        if (!expiredAt || Date.now() / 1000 > expiredAt - 60) {
             console.log("正在刷新 Azure endpoint 和 token...");
            endpoint = await getEndpoint();
            const jwt = endpoint.t.split(".")[1];
            const decodedJwt = JSON.parse(atob(jwt));
            expiredAt = decodedJwt.exp;
            clientId = uuid(); // 更新 clientId
             console.log("Endpoint 和 Token 已刷新, 剩余有效时间: " + ((expiredAt - Date.now() / 1000) / 60).toFixed(2) + " 分钟");
        } else {
             console.log("使用现有 Token, 剩余有效时间: " + ((expiredAt - Date.now() / 1000) / 60).toFixed(2) + " 分钟");
        }

        const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const headers = {
            "Authorization": endpoint.t,
            "Content-Type": "application/ssml+xml",
            "User-Agent": "okhttp/4.5.0",
            "X-Microsoft-OutputFormat": outputFormat
        };
        const ssml = getSsml(text, voiceName, rate, pitch);

        // 发送请求到 Azure TTS
        const azureResponse = await fetch(url, {
            method: "POST",
            headers: headers,
            body: ssml
        });

        if (!azureResponse.ok) {
            const errorBody = await azureResponse.text();
            console.error(`Azure TTS 请求失败: ${azureResponse.status} ${azureResponse.statusText}`, errorBody);
            // 尝试将 Azure 的错误信息传递给客户端
            return res.status(azureResponse.status).type(azureResponse.headers.get('content-type') || 'text/plain').send(errorBody || azureResponse.statusText);
        }

        // 设置响应头
        res.setHeader('Content-Type', azureResponse.headers.get('content-type') || 'audio/mpeg');
        if (download) {
            const filename = `${uuid()}.mp3`; // 假设是 mp3，可以根据 outputFormat 调整
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }

        // 流式传输音频数据
        // Node.js v18+ fetch response body is already a ReadableStream compatible with Node streams
        if (azureResponse.body && typeof azureResponse.body.pipe === 'function') {
             azureResponse.body.pipe(res);
        } else {
             // Fallback for older Node or different stream types if needed
             const buffer = await azureResponse.arrayBuffer();
             res.send(Buffer.from(buffer));
        }

    } catch (error) {
        console.error("处理 /tts 错误:", error);
        res.status(500).type('text/plain').send(`服务器内部错误: ${error.message}`);
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API Key: ${API_KEY ? '已设置' : '未设置!'}`);
});
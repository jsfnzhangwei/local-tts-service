require('dotenv').config(); // 加载 .env 文件中的环境变量
const express = require('express');
const cors = require('cors');
const { webcrypto } = require('node:crypto'); // 引入 Node.js 的 Web Crypto API
const path = require('path'); // 引入 path 模块

const app = express();
const PORT = process.env.PORT || 6911;
const API_KEY = process.env.API_KEY; // 从环境变量获取 API Key

if (!API_KEY) {
    console.error("错误：环境变量 API_KEY 未设置。请在 .env 文件或系统中设置它。");
    process.exit(1); // 退出程序
}

// --- 全局变量和缓存 ---
const encoder = new TextEncoder();
let expiredAt = null;
let endpoint = null;
let clientId = "76a75279-2ffa-4c3d-8db8-7b47252aa41c";

// 内存缓存，用于 voiceList
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

// Node.js v16+ 全局可用 atob/btoa
async function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function bytesToBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes));
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
        "X-MT-Signature": await sign(endpointUrl),
        "User-Agent": "okhttp/4.5.0",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": "0",
        "Accept-Encoding": "gzip"
    };
    const response = await fetch(endpointUrl, { method: "POST", headers: headers });
    if (!response.ok) {
        throw new Error(`获取 Endpoint 失败: ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function getSsml(text, voiceName, rate, pitch) {
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

// *** 添加静态文件服务中间件 ***
// 这会让 Express 查找并提供 /app/html (在容器内) 下的文件
// 访问 http://localhost:6911/ 会尝试加载 html/index.html
app.use(express.static(path.join(__dirname, 'html')));

// API Key 验证中间件
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).type('text/plain').send('Unauthorized');
    }
    next();
};

// 应用 API Key 验证到需要保护的 API 路由
app.use(['/tts', '/voices'], verifyApiKey);

// --- API 路由处理 ---

// 获取语音列表路由 (GET)
app.get('/voices', async (req, res) => {
    const l = (req.query.l || "").toLowerCase();
    const f = req.query.f;

    try {
        let responseData;
        const now = Date.now();
        if (voiceListCache && (now - voiceListCacheTime < VOICE_LIST_CACHE_TTL)) {
            console.log("使用缓存的 voice list");
            responseData = voiceListCache;
        } else {
            console.log("重新获取 voice list");
            const headers = { /* ... headers ... */ }; // 省略具体 headers
             const listResponse = await fetch("https://eastus.api.speech.microsoft.com/cognitiveservices/voices/list", { headers: headers });
             if (!listResponse.ok) throw new Error(`获取 Voice List 失败: ${listResponse.status} ${listResponse.statusText}`);
             responseData = await listResponse.json();
             voiceListCache = responseData;
             voiceListCacheTime = now;
        }

        if (l.length > 0) {
             responseData = responseData.filter(item => item.Locale.toLowerCase().includes(l));
        }

        if (f === "0") {
            const formattedList = responseData.map(item => `...`); // 省略格式化逻辑
            return res.type('text/plain').send(formattedList.join("\n"));
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

// 文本转语音路由 (GET)
// *** 注意：此 GET 方法在文本 ('t' 参数) 过长时，仍可能触发 431 错误 ***
app.get('/tts', async (req, res) => {
    // 从查询参数获取
    const text = req.query.t || "";
    const voiceName = req.query.v || "zh-CN-XiaoxiaoMultilingualNeural";
    const rate = Number(req.query.r) || 0;
    const pitch = Number(req.query.p) || 0;
    const outputFormat = req.query.o || "audio-24khz-48kbitrate-mono-mp3";
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
            clientId = uuid();
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
            method: "POST", // Azure TTS API 本身总是 POST
            headers: headers,
            body: ssml
        });

        if (!azureResponse.ok) {
            const errorBody = await azureResponse.text();
            console.error(`Azure TTS 请求失败: ${azureResponse.status} ${azureResponse.statusText}`, errorBody);
            return res.status(azureResponse.status).type(azureResponse.headers.get('content-type') || 'text/plain').send(errorBody || azureResponse.statusText);
        }

        // 设置响应头
        res.setHeader('Content-Type', azureResponse.headers.get('content-type') || 'audio/mpeg');
        if (download) {
            const filename = `${uuid()}.mp3`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }

        // 流式传输音频数据
        if (azureResponse.body && typeof azureResponse.body.pipe === 'function') {
            azureResponse.body.pipe(res);
        } else {
            const buffer = await azureResponse.arrayBuffer();
            res.send(Buffer.from(buffer));
        }

    } catch (error) {
        console.error("处理 /tts 错误:", error);
        res.status(500).type('text/plain').send(`服务器内部错误: ${error.message}`);
    }
});


// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`前端文件服务于根目录 /`);
    console.log(`API Key: ${API_KEY ? '已设置' : '未设置!'}`);
});
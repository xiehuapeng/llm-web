const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); 

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));  // 将 public 文件夹设置为静态文件目录

const port = 3000;

// 配置参数
const kcUrl = 'https://jiutian.10086.cn/auth/realms/TechnicalMiddlePlatform/protocol/openid-connect/token';
const modelUrl = 'https://jiutian.10086.cn/kunlun/ingress/api-safe/h3t-dfac2f/e212976e679746779539d849e0ba0673/ai-2773b9f099ca431a8aa2b2c2e6d079d4/service-63b16661ab6d4b2699ec59798ed6f567/generate';
const client_id = 'kunlun-front';
const user = 'sharpencmiot';
const password = 'Xhpws123';

// 初始化对话历史和 tokens
let access_keys = {};
let conversation_history = [];
const HISTORY_LIMIT = 5;

console.log("服务器启动中...");

// 获取 access_token 的函数
async function get_kc_act() {
    console.log("start access");
	const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    const payload = `grant_type=password&username=${user}&password=${password}&scope=openid&client_id=${client_id}`;

    const response = await axios.post(kcUrl, payload, { headers });
    access_keys['access_token'] = response.data.access_token;
    access_keys['refresh_token'] = response.data.refresh_token;

    return access_keys;
}

// 检查并刷新 access_token 的函数
async function check_token_expiration() {
    if (!access_keys.access_token || !access_keys.refresh_token) {
        // 如果 access_keys 尚未初始化，获取新的 tokens
        access_keys = await get_kc_act();
    }
	const access_token = access_keys.access_token;
    const refresh_token = access_keys.refresh_token;

    const decodedAccessToken = jwt.decode(access_token);
    const decodedRefreshToken = jwt.decode(refresh_token);

    const exp_access = decodedAccessToken.exp;
    const exp_refresh = decodedRefreshToken.exp;
    const local_time = Math.floor(Date.now() / 1000);

    if (local_time >= exp_access && local_time >= exp_refresh) {
        return await get_kc_act();
    } else if (local_time >= exp_access && local_time <= exp_refresh) {
        return await get_access_token_by_refresh_token(refresh_token);
    } else if (local_time <= exp_access) {
        return access_keys;
    }
}

// 使用 refresh_token 刷新 access_token
async function get_access_token_by_refresh_token(refresh_token) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    const payload = `grant_type=refresh_token&refresh_token=${refresh_token}&client_id=${client_id}`;

    const response = await axios.post(kcUrl, payload, { headers });
    access_keys['access_token'] = response.data.access_token;
    access_keys['refresh_token'] = response.data.refresh_token;
    return access_keys;
}

// 使用大模型生成回答的主函数
async function useModel(input_text) {
    access_keys = await check_token_expiration();

    const bearer_token = "Bearer " + access_keys.access_token;
    const headers = {
        "Authorization": bearer_token,
        "Content-Type": "application/json",
    };

    // 添加用户输入到对话历史
    conversation_history.push(`Human: ${input_text}`);
    if (conversation_history.length > HISTORY_LIMIT) {
        conversation_history = conversation_history.slice(-HISTORY_LIMIT);
    }

    const inputs = conversation_history.join("\n") + "\nAssistant:";
    const data = {
        inputs: inputs,
        parameters: {
            max_new_tokens: 512
        }
    };

    try {
        const response = await axios.post(modelUrl, data, { headers });
        const generated_text = response.data.generated_text || "模型未返回结果";

        // 将模型的回复加入对话历史
        conversation_history.push(`Assistant: ${generated_text}`);
        return generated_text;
    } catch (error) {
        console.error("请求失败:", error.response ? error.response.data : error.message);
        throw new Error("模型请求失败");
    }
}

// 设置 API 路由
app.post('/ask', async (req, res) => {
    const { question } = req.body;

    try {
        const answer = await useModel(question);
        res.json({ answer });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器正在运行在 http://localhost:${port}`);
});

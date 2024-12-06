const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors'); 

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const port = 3000;

const kcUrl = 'https://jiutian.10086.cn/auth/realms/TechnicalMiddlePlatform/protocol/openid-connect/token';
const modelUrl = 'https://jiutian.10086.cn/kunlun/ingress/api-safe/h3t-dfac2f/e212976e679746779539d849e0ba0673/ai-2773b9f099ca431a8aa2b2c2e6d079d4/service-63b16661ab6d4b2699ec59798ed6f567/generate_stream';
const client_id = 'kunlun-front';
const user = 'sharpencmiot';
const password = 'Xhpws123';

let access_keys = {};
const HISTORY_LIMIT = 6;
let conversation_history = [];

console.log("服务器启动中...");

async function get_kc_act() {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    const payload = `grant_type=password&username=${user}&password=${password}&scope=openid&client_id=${client_id}`;
    const response = await axios.post(kcUrl, payload, { headers });
    access_keys = { access_token: response.data.access_token, refresh_token: response.data.refresh_token };
    return access_keys;
}

async function check_token_expiration() {
    if (!access_keys.access_token || !access_keys.refresh_token) {
        access_keys = await get_kc_act();
    }
    const access_token = access_keys.access_token;
    const decodedAccessToken = jwt.decode(access_token);
    const exp_access = decodedAccessToken.exp;
    const local_time = Math.floor(Date.now() / 1000);

    if (local_time >= exp_access) {
        return await get_kc_act();
    }
    return access_keys;
}

async function useModel(input_text, res) {
    access_keys = await check_token_expiration();
    const bearer_token = "Bearer " + access_keys.access_token;
    const headers = {
        "Authorization": bearer_token,
        "Content-Type": "application/json",
    };

    conversation_history.push(`Human: ${input_text}`);
    if (conversation_history.length > HISTORY_LIMIT) {
        conversation_history = conversation_history.slice(-HISTORY_LIMIT);
    }

    const inputs = conversation_history.join("\n") + "\nAssistant:";
	console.log("shuru"+ "\n" + inputs+ "\n");
    const data = {
        inputs: inputs,
        parameters: {
            max_new_tokens: 512
        }
    };

    const response = await axios.post(modelUrl, data, { headers, responseType: 'stream' });
	
	let fullResponse = '';
	let currentLine = '';  // 用于拼接未完成的字符串
	
    response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        lines.forEach(line => {
            if (line.startsWith('data:')) {
                const jsonLine = line.slice(5).trim();
                if (jsonLine) {
                    res.write(`data: ${jsonLine}\n\n`);
					try {
                        // 拼接当前数据块
                        currentLine += jsonLine;
                        
                        // 如果当前行是一个有效的 JSON 字符串且以 '}' 结尾
                        if (currentLine.endsWith('}')) {
                            const parsedData = JSON.parse(currentLine);  // 解析为 JSON
                            const tokenText = parsedData.token.text;
                            //console.log('Parsed data:', parsedData);
                            fullResponse = tokenText;  // 累积返回内容
                            currentLine = '';  // 重置拼接内容
                            
                        }
                    } catch (error) {
                        //console.error('JSON 解析错误:', error.message);
                    }
				
					
                }
            }
        });
    });

    response.data.on('end', () => {
        conversation_history.push(`Assistant: ${fullResponse}`);
		//console.log(fullResponse);
		res.write('event: end\ndata: [DONE]\n\n');
        res.end();
    });
	

    response.data.on('error', (error) => {
        console.error("请求失败:", error);
        res.status(500).send("模型请求失败");
    });
}

app.post('/ask', (req, res) => {
    const { question } = req.body;
    useModel(question, res);
});

app.listen(port, () => {
    console.log(`服务器正在运行在 http://localhost:${port}`);
});

// 提交问题函数
    async function askQuestion() {
        const question = document.getElementById("question").value;
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://llm-web.onrender.com';

        const loadingElement = document.getElementById("loading");
        const chatContainer = document.getElementById("chat-container");
        const logo = document.getElementById("logo");
		const askButton = document.querySelector("button");  // 获取询问按钮

        // 如果问题为空，提醒用户
        if (!question.trim()) {
            alert("请输入一个问题！");
            return;
        }

        askButton.disabled = true;
		askButton.textContent = "回答中...";
		loadingElement.style.display = "flex"; // 显示加载中

        // 创建一个新的用户提问的消息
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.innerHTML = `<div class="bubble">${question}</div>`;
        chatContainer.appendChild(userMessage);

        // 清空输入框
        document.getElementById("question").value = "";

        // 自动滚动到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // 隐藏logo
        logo.style.display = "none";

        let lastText = ""; // 记录上一次的完整文本
        let bufferedText = ""; // 用于缓存未完成的 JSON 数据

        // 创建一个新的助理回复的消息
        const assistantMessage = document.createElement('div');
        assistantMessage.className = 'message assistant';
        assistantMessage.innerHTML = `<div class="bubble" id="answer-${Date.now()}"></div>`;
        chatContainer.appendChild(assistantMessage);

        const answerTextElement = assistantMessage.querySelector('div');

        try {
            const response = await fetch(`${baseUrl}/ask`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ question })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                bufferedText += decoder.decode(value, { stream: true });
                answerTextElement.style.display = "block"; // 显示回答区域
                loadingElement.style.display = "none"; // 隐藏加载中

                // 按行处理接收到的数据
                const lines = bufferedText.split('\n');
                for (let i = 0; i < lines.length - 1; i++) { // 忽略最后一行，因为可能是未完整的数据
                    let line = lines[i].trim();
                    if (line.startsWith('data:')) {
                        const jsonLine = line.slice(5).trim();
                        if (jsonLine && jsonLine !== "[DONE]") {
                            try {
                                const parsedData = JSON.parse(jsonLine);
                                const currentText = parsedData.token.text;

                                // 找出新增的部分文本
                                const newText = currentText.slice(lastText.length);
                                answerTextElement.innerHTML += newText; // 只添加新内容

                                lastText = currentText; // 更新 lastText
                            } catch (error) {
                                console.error("解析失败:", error);
                            }
                        }
                    }
                }

                // 保留最后一行到 bufferedText，以防止解析不完整的 JSON 数据
                bufferedText = lines[lines.length - 1];
            }

            // 自动滚动到底部
            chatContainer.scrollTop = chatContainer.scrollHeight;
            window.scrollTo(0, document.body.scrollHeight);
			askButton.disabled = false;
			askButton.textContent = "询问";

        } catch (error) {
            console.error("请求失败：", error);
            answerTextElement.innerHTML = "出错了，请稍后再试。";
        }
    }

    // 监听输入框按键事件，按Enter键也能提交问题
    document.getElementById("question").addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            event.preventDefault(); // 防止换行
            askQuestion(); // 调用提问函数
        }
    });

    // 向下滚动页面
    function scrollToBottom() {
        const chatContainer = document.getElementById("chat-container");
        chatContainer.scrollTop = chatContainer.scrollHeight;
        window.scrollTo(0, document.body.scrollHeight);
    }

    // 检查是否接近底部来控制箭头显示
    window.addEventListener('scroll', function () {
        const scrollDown = document.querySelector('.scroll-down');
        if (document.body.scrollHeight - window.innerHeight - window.scrollY <= 100) {
            scrollDown.style.display = 'none';  // 隐藏箭头
        } else {
            scrollDown.style.display = 'block';  // 显示箭头
        }
    });
const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 10000;

// 允许所有来源跨域 - 这就是“伪造厂商同意”的核心
app.use(cors({
  origin: '*',
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json({ limit: '2mb' }));

// 健康检查，给 Render 用
app.get('/', (req, res) => {
  res.send('CORS Proxy Running. POST /proxy with {endpoint, apiKey, model, messages}');
});

// 核心代理接口，完全复用你之前的 api_proxy 逻辑
app.post('/proxy', async (req, res) => {
  const { endpoint, apiKey, model, messages, temperature } = req.body;
  if (!endpoint || !apiKey) {
    return res.status(400).json({ error: '缺少 endpoint 或 apiKey' });
  }
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'glm-4-flash',
        messages: messages || [],
        temperature: temperature ?? 0.7
      })
    });
    const text = await r.text();
    // 把厂商的返回原样透传回去，但已经带上了 CORS 头
    res.status(r.status).set('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: '代理请求失败: ' + e.message });
  }
});

// 兼容公共代理的 ?url= 模式，方便你直接拼在前端
app.all('/cors/:url(*)', async (req, res) => {
  try {
    const targetUrl = req.params.url;
    const r = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json', 'Authorization': req.headers['authorization'] || '' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    const text = await r.text();
    res.status(r.status).set('Access-Control-Allow-Origin','*').send(text);
  } catch(e) {
    res.status(502).json({error:e.message});
  }
});

app.listen(PORT, () => console.log('Running on ' + PORT));

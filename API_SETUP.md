# API Setup

This project needs a small local backend because NewsAPI does not send browser CORS headers and the old `corsproxy.io` URL now returns `403`.

1. Get a NewsAPI key for Global/USA news: https://newsapi.org/
2. Get a NewsData.io key for India news: https://newsdata.io/
3. Copy `config.example.js` to `config.js`, then add your new keys:

```js
window.NEWS_APP_CONFIG = {
  newsApiGlobalKey: "c5ff0d8507894f38b29b1bdb8c31233e",
  newsApiUsKey: "c5ff0d8507894f38b29b1bdb8c31233e",
  newsDataIndiaKey: "pub_2af7ef35b41a4f8fbe6df1980ebabd23"
};
```

4. Run the backend:

```bash
python3 dev_server.py
```

5. Open http://localhost:8000/

Do not commit `config.js`; it contains real API keys and is ignored by Git.

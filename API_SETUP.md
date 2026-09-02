# API Setup

This project now reads API keys directly in the React app from `config.js`. No Python backend is required.

1. Get a NewsAPI key for Global/USA news: https://newsapi.org/
2. Get a NewsData.io key for India news: https://newsdata.io/
3. Copy `config.example.js` to `config.js`, then add your keys:

```js
window.NEWS_APP_CONFIG = {
  newsApiGlobalKey: "YOUR_NEWSAPI_KEY",
  newsApiUsKey: "YOUR_NEWSAPI_KEY",
  newsDataIndiaKey: "YOUR_NEWSDATA_KEY"
};
```

4. Open the app with any static web server or host it as static files.

Do not commit `config.js`; it contains real API keys and is ignored by Git.

Because the keys are used in browser-side React code, they are visible to users of the app. Restrict the keys in each provider dashboard when possible.

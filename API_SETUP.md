# API Setup

This project uses a small Node backend because NewsAPI does not allow browser requests from GitHub Pages on the free Developer plan.

1. Get a NewsAPI key for Global/USA news: https://newsapi.org/
2. Get a NewsData.io key for India news: https://newsdata.io/
3. Copy `config.example.js` to `config.js`, then add your keys:

```js
window.NEWS_APP_CONFIG = {
  newsApiGlobalKey: "YOUR_NEWSAPI_KEY",
  newsApiUsKey: "YOUR_NEWSAPI_KEY",
  newsDataIndiaKey: "YOUR_NEWSDATA_KEY",
};
```

4. Run the backend:

```bash
node server.js
```

5. Open http://localhost:8000/

Do not commit `config.js`; it contains real API keys and is ignored by Git.

The backend reads `config.js` on the server and does not serve it to the browser.

## GitHub Pages note

GitHub Pages cannot run `server.js`. On GitHub Pages, `frontend-api-bridge.js` falls back to NewsData.io in the browser.

For that static fallback to work, `config.js` must also be deployed. That makes the NewsData key public, so only do this with a key you are comfortable exposing in a browser app.

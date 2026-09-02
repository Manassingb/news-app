(function () {
  var host = window.location.hostname;
  var useStaticFallback =
    host.endsWith("github.io") || window.location.protocol === "file:";

  if (!useStaticFallback || !window.fetch) return;

  var nativeFetch = window.fetch.bind(window);
  var pageTokens = new Map();

  function config() {
    return window.NEWS_APP_CONFIG || {};
  }

  function key() {
    return (config().newsDataIndiaKey || "").trim();
  }

  function jsonResponse(status, payload) {
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    );
  }

  function categoryForNewsData(category) {
    return category === "general" ? "top" : category;
  }

  function requestUrl(input) {
    if (typeof input === "string") return new URL(input, window.location.href);
    if (input && input.url) return new URL(input.url, window.location.href);
    return null;
  }

  function cacheKey(type, params) {
    return [
      type,
      params.get("q") || "",
      params.get("country") || "",
      categoryForNewsData(params.get("category") || ""),
      params.get("language") || "en",
    ].join("|");
  }

  function newsDataUrl(params, options) {
    var apiKey = key();
    if (!apiKey) return null;

    var url = new URL("https://newsdata.io/api/1/news");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("language", params.get("language") || "en");

    if (options.country) url.searchParams.set("country", options.country);
    if (options.category) {
      url.searchParams.set("category", categoryForNewsData(options.category));
    }
    if (options.q) url.searchParams.set("q", options.q);

    var requestedPage = params.get("page");
    if (requestedPage && requestedPage !== "1") {
      url.searchParams.set("page", requestedPage);
    }

    return url;
  }

  function directNewsDataRequest(url) {
    var params = url.searchParams;
    var directUrl = newsDataUrl(params, {
      country: params.get("country") || "in",
      category: params.get("category") || "top",
    });

    if (!directUrl) {
      return jsonResponse(500, {
        status: "error",
        message: "Missing newsDataIndiaKey in config.js",
      });
    }

    return nativeFetch(directUrl.toString());
  }

  function newsApiShape(item) {
    return {
      title: item.title || "",
      description: item.description || item.ai_summary || item.content || "",
      urlToImage: item.image_url || null,
      url: item.link || "#",
      publishedAt: item.pubDate || item.pubDateTZ || "",
      source: {
        name: item.source_name || item.source_id || "NewsData.io",
      },
    };
  }

  function transformToNewsApiResponse(response, keyBase, requestedPage) {
    return response.json().then(function (payload) {
      var results = Array.isArray(payload.results) ? payload.results : [];
      if (payload.nextPage) {
        pageTokens.set(keyBase + "|" + (requestedPage + 1), payload.nextPage);
      }

      return jsonResponse(response.status, {
        status: payload.status === "success" ? "ok" : payload.status,
        totalResults: payload.totalResults || results.length + (payload.nextPage ? 1 : 0),
        articles: results.map(newsApiShape),
      });
    });
  }

  function newsApiFallback(url, type) {
    var params = url.searchParams;
    var apiKey = key();

    if (!apiKey) {
      return jsonResponse(500, {
        status: "error",
        message: "Missing newsDataIndiaKey in config.js",
      });
    }

    var keyBase = cacheKey(type, params);
    var requestedPage = Number(params.get("page") || "1");
    var pageToken = pageTokens.get(keyBase + "|" + requestedPage);

    var directUrl = newsDataUrl(params, {
      country: type === "top-headlines" ? params.get("country") || "us" : "",
      category: type === "top-headlines" ? params.get("category") || "top" : "",
      q: type === "everything" ? params.get("q") || "world" : "",
    });

    if (!directUrl) {
      return jsonResponse(500, {
        status: "error",
        message: "Missing newsDataIndiaKey in config.js",
      });
    }

    if (requestedPage > 1 && pageToken) {
      directUrl.searchParams.set("page", pageToken);
    } else {
      directUrl.searchParams.delete("page");
    }

    return nativeFetch(directUrl.toString()).then(function (response) {
      return transformToNewsApiResponse(response, keyBase, requestedPage);
    });
  }

  window.fetch = function (input, init) {
    var url = requestUrl(input);
    if (!url) return nativeFetch(input, init);

    if (url.pathname === "/api/newsdata/news") {
      return directNewsDataRequest(url);
    }

    if (url.pathname === "/api/newsapi/top-headlines") {
      return newsApiFallback(url, "top-headlines");
    }

    if (url.pathname === "/api/newsapi/everything") {
      return newsApiFallback(url, "everything");
    }

    return nativeFetch(input, init);
  };
})();

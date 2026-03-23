const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
    status: init.status || 200,
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/v1/health") {
      return json({ status: "ok", service: "secret-homepage-cloudflare" });
    }

    if (url.pathname === "/api/v1/session") {
      return json({
        authenticated: false,
        currentUser: null,
        people: {
          you: "구현",
          partner: "지원",
        },
        notificationUnread: 0,
        mode: "migration-bootstrap",
      });
    }

    if (url.pathname === "/api/v1/home") {
      return json({
        mode: "migration-bootstrap",
        message: "Cloudflare home API placeholder",
      });
    }

    if (url.pathname === "/api/v1/posts") {
      return json({
        items: [],
        pagination: {
          page: 1,
          perPage: 6,
          totalPages: 1,
          totalItems: 0,
        },
        mode: "migration-bootstrap",
      });
    }

    return env.ASSETS.fetch(request);
  },
};
/**
 * Platform Gateway — Cloudflare Worker
 * Routes: slug-based (m99-core.com) + custom domain (CF for SaaS)
 * KV only — never touches RDS
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;

    const tenantId = await _resolveTenant(host, url, env);
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tenantRaw = await env.KV.get(`tenant:${tenantId}`);
    if (!tenantRaw) {
      return new Response(JSON.stringify({ error: "tenant config missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const tenant = JSON.parse(tenantRaw);

    // Route to module worker via service binding
    const moduleId = _extractModule(url.pathname);
    const binding = env[`MODULE_${moduleId.toUpperCase().replace(/-/g, "_")}`];
    if (!binding) {
      return new Response(JSON.stringify({ error: `module ${moduleId} not found` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Inject tenant context as header — modules read X-Tenant-* headers
    const forwarded = new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "X-Tenant-Id": tenantId,
        "X-Tenant-Schema": tenant.schema_name,
        "X-Tenant-Tier": tenant.tier,
        "X-Tenant-Modules": JSON.stringify(tenant.modules),
      },
    });

    return binding.fetch(forwarded);
  },
};

async function _resolveTenant(host, url, env) {
  // Custom domain: domain:{host}
  const byDomain = await env.KV.get(`domain:${host}`);
  if (byDomain) return byDomain;

  // Slug-based: allen.m99-core.com → slug:allen
  const parts = host.split(".");
  if (parts.length >= 3) {
    const slug = parts[0];
    const bySlug = await env.KV.get(`slug:${slug}`);
    if (bySlug) return bySlug;
  }

  // Path-based fallback: /t/allen/...
  const match = url.pathname.match(/^\/t\/([^/]+)/);
  if (match) {
    return env.KV.get(`slug:${match[1]}`);
  }

  return null;
}

function _extractModule(pathname) {
  // /t/{slug}/{module}/... or /{module}/...
  const parts = pathname.replace(/^\//, "").split("/");
  if (parts[0] === "t" && parts.length >= 3) return parts[2];
  return parts[0] || "auth";
}

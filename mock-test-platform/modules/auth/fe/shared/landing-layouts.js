/**
 * 25 Landing Page Layouts
 * Each layout receives the same cfg object and returns an HTML string.
 * landing.html picks the layout via cfg.landing_layout.
 *
 * cfg shape (all optional, falls back to defaults):
 *   cfg.title, cfg.subtitle, cfg.announcement, cfg.stats[],
 *   cfg.features[], cfg.slides[], cfg.testimonials[],
 *   cfg.exam_date, cfg.login_label, cfg.register_label,
 *   cfg.logo, cfg.tagline, cfg.hero_img, cfg.module_name
 */

export const LAYOUTS = {

  // ── 1. Hero Center ──────────────────────────────────────────────────────────
  "hero-center": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:3.5rem 1.5rem 2rem">
      ${_logo(cfg)}
      <h1 style="font-size:clamp(1.75rem,5vw,2.75rem);font-weight:800;line-height:1.2;margin-bottom:1rem;color:var(--text)">${cfg.title || "Ace Your Exam"}</h1>
      <p style="font-size:1.0625rem;color:var(--text-muted);max-width:520px;margin:0 auto 2rem;line-height:1.6">${cfg.subtitle || "AI-powered mock tests and practice questions."}</p>
      ${_ctaBtns(cfg)}
    </section>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 2. Hero Split ────────────────────────────────────────────────────────────
  "hero-split": (cfg) => `
    ${_announcement(cfg)}
    <section style="display:grid;grid-template-columns:1fr 1fr;gap:2rem;padding:3rem 1.5rem;align-items:center;max-width:900px;margin:0 auto">
      <div>
        <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;line-height:1.2;margin-bottom:1rem;color:var(--text)">${cfg.title || "Ace Your Exam"}</h1>
        <p style="font-size:0.9375rem;color:var(--text-muted);margin-bottom:1.75rem;line-height:1.6">${cfg.subtitle || "AI-powered mock tests."}</p>
        ${_ctaBtns(cfg)}
      </div>
      <div style="text-align:center;font-size:8rem;line-height:1">${cfg.hero_emoji || "🎯"}</div>
    </section>
    ${_statsBar(cfg)}`,

  // ── 3. Minimal ───────────────────────────────────────────────────────────────
  "minimal": (cfg) => `
    <section style="min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;text-align:center">
      ${_logo(cfg)}
      <h1 style="font-size:clamp(2rem,6vw,3.5rem);font-weight:900;letter-spacing:-0.02em;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Prepare Smarter"}</h1>
      <p style="font-size:1.125rem;color:var(--text-muted);margin-bottom:2.5rem">${cfg.tagline || cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>`,

  // ── 4. Card Grid ─────────────────────────────────────────────────────────────
  "card-grid": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Everything You Need"}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 5. Slideshow ─────────────────────────────────────────────────────────────
  "slideshow": (cfg) => `
    ${_announcement(cfg)}
    <div id="slide-wrap" style="position:relative;overflow:hidden;height:320px;background:var(--surface-2);border-radius:var(--radius);margin:1rem 1rem 0">
      <div id="slides" style="display:flex;transition:transform 0.5s ease;height:100%">
        ${(cfg.slides || _defaultSlides()).map(s => `
          <div style="flex-shrink:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center">
            <div style="font-size:3.5rem;margin-bottom:1rem">${s.icon || "📚"}</div>
            <div style="font-size:1.25rem;font-weight:700;color:var(--text);margin-bottom:0.5rem">${s.title}</div>
            <div style="color:var(--text-muted);font-size:0.9rem">${s.desc || ""}</div>
          </div>`).join("")}
      </div>
      <div id="slide-dots" style="position:absolute;bottom:1rem;left:0;right:0;display:flex;justify-content:center;gap:0.375rem"></div>
    </div>
    <section style="text-align:center;padding:2rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:1rem">${cfg.title || "Start Preparing Today"}</h1>
      ${_ctaBtns(cfg)}
    </section>
    ${_statsBar(cfg)}
    <script>
      (function(){
        const slides=(${JSON.stringify(cfg.slides || _defaultSlides())});let cur=0;
        const wrap=document.getElementById('slides'),dots=document.getElementById('slide-dots');
        slides.forEach((_,i)=>{const d=document.createElement('div');d.style.cssText='width:8px;height:8px;border-radius:50%;background:var(--border);cursor:pointer;transition:background 0.2s';d.onclick=()=>go(i);dots.appendChild(d);});
        function go(n){cur=n;wrap.style.transform='translateX(-'+n*100+'%)';dots.querySelectorAll('div').forEach((d,i)=>d.style.background=i===n?'var(--primary)':'var(--border)');}
        go(0);setInterval(()=>go((cur+1)%slides.length),4000);
      })();
    </script>`,

  // ── 6. Countdown ─────────────────────────────────────────────────────────────
  "countdown": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.5rem">${cfg.title || "Exam Approaching"}</h1>
      <p style="color:var(--text-muted);margin-bottom:1.5rem">${cfg.subtitle || "Don't wait — start now."}</p>
      ${cfg.exam_date ? `
      <div style="display:flex;justify-content:center;gap:1rem;margin-bottom:2rem" id="countdown-display">
        ${["days","hours","mins","secs"].map(u=>`<div style="text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem 1.25rem;min-width:72px"><div style="font-size:2rem;font-weight:800;color:var(--primary)" id="cd-${u}">--</div><div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted)">${u}</div></div>`).join("")}
      </div>
      <script>
        (function(){
          var target=new Date("${cfg.exam_date}");
          function tick(){var now=new Date(),diff=target-now;if(diff<0)diff=0;
            var d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
            ["days","hours","mins","secs"].forEach(function(k,i){var el=document.getElementById("cd-"+k);if(el)el.textContent=[d,h,m,s][i];});}
          tick();setInterval(tick,1000);
        })();
      </script>` : ""}
      ${_ctaBtns(cfg)}
    </section>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 7. Stats Focus ───────────────────────────────────────────────────────────
  "stats-focus": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Join Thousands of Toppers"}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem">${cfg.subtitle || ""}</p>
    </section>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;padding:0 1.5rem;margin-bottom:2rem">
      ${(cfg.stats || _defaultStats()).map(s=>`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;text-align:center">
          <div style="font-size:2.25rem;font-weight:900;color:var(--primary)">${s.value}</div>
          <div style="font-size:0.8125rem;color:var(--text-muted);margin-top:0.25rem">${s.label}</div>
        </div>`).join("")}
    </div>
    <div style="padding:0 1.5rem 2rem;text-align:center">${_ctaBtns(cfg)}</div>`,

  // ── 8. Testimonials ──────────────────────────────────────────────────────────
  "testimonials": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Trusted by Toppers"}</h1>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 2rem;display:flex;flex-direction:column;gap:1rem">
      ${(cfg.testimonials || _defaultTestimonials()).map(t=>`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem">
          <div style="font-size:0.9375rem;color:var(--text);line-height:1.6;margin-bottom:0.875rem">"${t.text}"</div>
          <div style="display:flex;align-items:center;gap:0.625rem">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.875rem">${(t.name||"U")[0]}</div>
            <div><div style="font-weight:600;font-size:0.875rem">${t.name}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t.rank || ""}</div></div>
          </div>
        </div>`).join("")}
    </div>`,

  // ── 9. Dark Glass ────────────────────────────────────────────────────────────
  "dark-glass": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:3rem 1.5rem 2rem;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-dark) 100%);margin:0;border-radius:0 0 var(--radius) var(--radius)">
      <h1 style="font-size:clamp(1.75rem,5vw,2.75rem);font-weight:900;color:#fff;margin-bottom:0.75rem;text-shadow:0 2px 8px rgba(0,0,0,0.3)">${cfg.title || "Prepare Smarter"}</h1>
      <p style="color:rgba(255,255,255,0.85);margin-bottom:2rem;font-size:1rem">${cfg.subtitle || ""}</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
        <a href="login.html" style="padding:0.75rem 1.75rem;background:rgba(255,255,255,0.95);color:var(--primary);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.9375rem">${cfg.login_label || "Sign In"}</a>
        <a href="register-1.html" style="padding:0.75rem 1.75rem;background:rgba(255,255,255,0.15);color:#fff;border:2px solid rgba(255,255,255,0.6);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.9375rem;backdrop-filter:blur(8px)">${cfg.register_label || "Register Free"}</a>
      </div>
    </section>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;padding:1.5rem;margin-top:-0.5rem">
      ${(cfg.features || _defaultFeatures()).slice(0,4).map(f=>`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;backdrop-filter:blur(4px)">
          <div style="font-size:1.75rem;margin-bottom:0.625rem">${f.icon}</div>
          <div style="font-weight:600;font-size:0.875rem;margin-bottom:0.25rem">${f.title}</div>
          <div style="font-size:0.8125rem;color:var(--text-muted)">${f.desc}</div>
        </div>`).join("")}
    </div>
    ${_statsBar(cfg)}`,

  // ── 10. Magazine ─────────────────────────────────────────────────────────────
  "magazine": (cfg) => `
    ${_announcement(cfg)}
    <div style="padding:1.5rem">
      <div style="background:var(--primary);color:#fff;border-radius:var(--radius);padding:1.75rem;margin-bottom:1rem">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;opacity:0.8;margin-bottom:0.5rem">${cfg.module_name || "Mock Test Platform"}</div>
        <h1 style="font-size:clamp(1.5rem,4vw,2rem);font-weight:900;line-height:1.2;margin-bottom:1rem">${cfg.title || "Crack Your Exam"}</h1>
        ${_ctaWhite(cfg)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1rem">
        ${(cfg.features || _defaultFeatures()).slice(0,2).map(f=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1rem">
            <div style="font-size:1.5rem;margin-bottom:0.5rem">${f.icon}</div>
            <div style="font-weight:600;font-size:0.8125rem">${f.title}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem">${f.desc}</div>
          </div>`).join("")}
      </div>
      ${_statsBar(cfg)}
    </div>`,

  // ── 11. App Promo ─────────────────────────────────────────────────────────────
  "app-promo": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem">
      <div style="font-size:5rem;margin-bottom:1rem">📱</div>
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Study Anywhere, Anytime"}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem;max-width:400px;margin-left:auto;margin-right:auto">${cfg.subtitle || "Web, mobile, and desktop — all synced."}</p>
      ${_ctaBtns(cfg)}
      <div style="display:flex;justify-content:center;gap:1rem;margin-top:1.5rem;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;color:var(--text-muted)">🌐 Web</div>
        <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;color:var(--text-muted)">📱 Mobile</div>
        <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;color:var(--text-muted)">🖥️ Desktop</div>
      </div>
    </section>
    ${_statsBar(cfg)}`,

  // ── 12. Leaderboard ──────────────────────────────────────────────────────────
  "leaderboard": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2rem 1.5rem 1rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.5rem">${cfg.title || "Join the Toppers"}</h1>
      <p style="color:var(--text-muted);margin-bottom:1.5rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 1.5rem">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.75rem">Recent Toppers</div>
      ${(cfg.toppers || _defaultToppers()).map((t,i)=>`
        <div style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:0.5rem">
          <div style="font-size:1.25rem;width:28px;text-align:center">${["🥇","🥈","🥉","4️⃣","5️⃣"][i]||"🏅"}</div>
          <div style="flex:1"><div style="font-weight:600;font-size:0.875rem">${t.name}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t.exam||""}</div></div>
          <div style="font-weight:700;color:var(--primary)">${t.score||""}</div>
        </div>`).join("")}
    </div>`,

  // ── 13. Timeline ─────────────────────────────────────────────────────────────
  "timeline": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Your Path to Success"}</h1>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 2rem;position:relative">
      <div style="position:absolute;left:2.375rem;top:0;bottom:0;width:2px;background:var(--border)"></div>
      ${_defaultTimeline().map((step,i)=>`
        <div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:1.25rem;position:relative">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;z-index:1">${step.icon}</div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:0.875rem;flex:1">
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.25rem">${step.title}</div>
            <div style="font-size:0.8125rem;color:var(--text-muted)">${step.desc}</div>
          </div>
        </div>`).join("")}
    </div>`,

  // ── 14. Dashboard Preview ────────────────────────────────────────────────────
  "dashboard": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2rem 1.5rem 1rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.5rem">${cfg.title || "Track Your Progress"}</h1>
      <p style="color:var(--text-muted);margin-bottom:1.5rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 2rem">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;margin-bottom:0.75rem">
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem">Your Performance (Demo)</div>
        <div style="display:flex;gap:1rem;flex-wrap:wrap">
          ${[["Accuracy","72%"],["Tests Taken","14"],["Rank","#248"],["Streak","7d"]].map(([l,v])=>`
            <div style="flex:1;min-width:80px;text-align:center"><div style="font-size:1.5rem;font-weight:800;color:var(--primary)">${v}</div><div style="font-size:0.75rem;color:var(--text-muted)">${l}</div></div>`).join("")}
        </div>
      </div>
      ${_statsBar(cfg)}
    </div>`,

  // ── 15. Announcement ─────────────────────────────────────────────────────────
  "announcement": (cfg) => `
    <div style="background:var(--primary);color:#fff;padding:0.75rem 1.5rem;text-align:center;font-size:0.875rem;font-weight:600">
      📢 ${cfg.announcement || "New mock tests available — Start practicing now!"}
    </div>
    <section style="text-align:center;padding:2.5rem 1.5rem">
      ${_logo(cfg)}
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Prepare with Confidence"}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 2rem;display:flex;flex-direction:column;gap:0.625rem">
      ${(cfg.notices || _defaultNotices()).map(n=>`
        <div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.875rem 1rem;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:var(--radius)">
          <span style="font-size:1rem">${n.icon||"📌"}</span>
          <div><div style="font-weight:600;font-size:0.875rem">${n.title}</div><div style="font-size:0.8125rem;color:var(--text-muted)">${n.desc||""}</div></div>
        </div>`).join("")}
    </div>`,

  // ── 16. Coach Classic ────────────────────────────────────────────────────────
  "coach-classic": (cfg) => `
    <div style="background:var(--primary);padding:1.5rem;text-align:center;border-radius:0 0 1.5rem 1.5rem">
      ${_logo(cfg)}
      <h1 style="font-size:1.375rem;font-weight:800;color:#fff;margin-bottom:0.375rem">${cfg.title || "Welcome to Our Platform"}</h1>
      <p style="font-size:0.875rem;color:rgba(255,255,255,0.85);margin-bottom:1.25rem">${cfg.subtitle || ""}</p>
      <div style="display:flex;gap:0.625rem;justify-content:center">
        <a href="login.html" style="padding:0.625rem 1.5rem;background:#fff;color:var(--primary);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.875rem">${cfg.login_label||"Login"}</a>
        <a href="register-1.html" style="padding:0.625rem 1.5rem;background:rgba(255,255,255,0.2);color:#fff;border:2px solid rgba(255,255,255,0.6);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.875rem">${cfg.register_label||"Register"}</a>
      </div>
    </div>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 17. SaaS Modern ──────────────────────────────────────────────────────────
  "saas-modern": (cfg) => `
    ${_announcement(cfg)}
    <section style="padding:3rem 1.5rem;max-width:640px;margin:0 auto">
      <div style="display:inline-block;padding:0.25rem 0.875rem;background:var(--surface-2);border:1px solid var(--border);border-radius:999px;font-size:0.75rem;font-weight:700;color:var(--primary);margin-bottom:1.25rem;text-transform:uppercase;letter-spacing:0.05em">${cfg.badge || "AI-Powered"} ✨</div>
      <h1 style="font-size:clamp(1.75rem,5vw,2.75rem);font-weight:900;line-height:1.15;letter-spacing:-0.02em;color:var(--text);margin-bottom:1rem">${cfg.title || "The Smarter Way to Prepare"}</h1>
      <p style="font-size:1.0625rem;color:var(--text-muted);margin-bottom:2rem;line-height:1.6">${cfg.subtitle || "AI-generated mock tests, instant analysis, and personalised feedback."}</p>
      ${_ctaBtns(cfg)}
      <div style="display:flex;align-items:center;gap:0.75rem;margin-top:1.5rem;font-size:0.8125rem;color:var(--text-muted)">
        ${["Free to start","No credit card","10K+ students"].map(t=>`<span>✓ ${t}</span>`).join('<span style="color:var(--border)">·</span>')}
      </div>
    </section>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 18. Fullscreen ───────────────────────────────────────────────────────────
  "fullscreen": (cfg) => `
    <div style="min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1.5rem;text-align:center;background:linear-gradient(160deg,var(--bg) 60%,var(--surface-2) 100%)">
      ${_logo(cfg)}
      <h1 style="font-size:clamp(2rem,7vw,3.5rem);font-weight:900;line-height:1.1;letter-spacing:-0.025em;color:var(--text);margin-bottom:1rem">${cfg.title || "Crack Your Exam"}</h1>
      <p style="font-size:1.125rem;color:var(--text-muted);max-width:420px;margin-bottom:2.5rem;line-height:1.6">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </div>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 19. Icon Grid ────────────────────────────────────────────────────────────
  "icon-grid": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Choose Your Exam"}</h1>
      ${_ctaBtns(cfg)}
    </section>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.875rem;padding:0 1.5rem 2rem">
      ${(cfg.modules || _defaultModules()).map(m=>`
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem 0.75rem;text-align:center;cursor:pointer" onclick="window.location.href='login.html'">
          <div style="font-size:2.25rem;margin-bottom:0.5rem">${m.icon}</div>
          <div style="font-size:0.8125rem;font-weight:600;line-height:1.3">${m.name}</div>
        </div>`).join("")}
    </div>`,

  // ── 20. Progress Focus ───────────────────────────────────────────────────────
  "progress-focus": (cfg) => `
    ${_announcement(cfg)}
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Track. Improve. Succeed."}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    <div style="padding:0 1.5rem 2rem;display:flex;flex-direction:column;gap:1rem">
      ${[["Accuracy","72%",72],["Speed","85%",85],["Coverage","60%",60],["Weak Areas Improved","88%",88]].map(([l,v,p])=>`
        <div>
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:0.375rem"><span style="font-weight:500">${l}</span><span style="color:var(--primary);font-weight:700">${v}</span></div>
          <div style="background:var(--surface-2);border-radius:4px;height:8px;overflow:hidden"><div style="width:${p}%;height:100%;background:var(--primary);border-radius:4px"></div></div>
        </div>`).join("")}
    </div>`,

  // ── 21. Split Dark ───────────────────────────────────────────────────────────
  "split-dark": (cfg) => `
    <div style="min-height:260px;background:linear-gradient(135deg,var(--primary-dark) 0%,var(--primary) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5rem 1.5rem;text-align:center">
      <h1 style="font-size:clamp(1.75rem,5vw,2.5rem);font-weight:900;color:#fff;margin-bottom:0.75rem;text-shadow:0 2px 12px rgba(0,0,0,0.2)">${cfg.title || "Study Smart. Score High."}</h1>
      <p style="color:rgba(255,255,255,0.85);margin-bottom:1.75rem;font-size:1rem">${cfg.subtitle || ""}</p>
      ${_ctaWhite(cfg)}
    </div>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 22. News Ticker ──────────────────────────────────────────────────────────
  "news-ticker": (cfg) => `
    <div style="background:var(--primary);overflow:hidden;padding:0.5rem 0">
      <div id="ticker" style="display:flex;gap:3rem;white-space:nowrap;animation:ticker 20s linear infinite;color:#fff;font-size:0.8125rem;font-weight:600">
        ${Array(3).fill(cfg.ticker_items || _defaultTicker()).flat().map(t=>`<span>📌 ${t}</span>`).join(" · ")}
      </div>
    </div>
    <style>@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}</style>
    <section style="text-align:center;padding:2.5rem 1.5rem">
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Stay Updated. Stay Ahead."}</h1>
      <p style="color:var(--text-muted);margin-bottom:2rem">${cfg.subtitle || ""}</p>
      ${_ctaBtns(cfg)}
    </section>
    ${_featuresGrid(cfg)}`,

  // ── 23. Banner Stack ─────────────────────────────────────────────────────────
  "banner-stack": (cfg) => `
    <section style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      ${_logo(cfg)}
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:800;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Everything You Need"}</h1>
      ${_ctaBtns(cfg)}
    </section>
    <div style="display:flex;flex-direction:column;gap:0;margin-bottom:2rem">
      ${(cfg.banners || _defaultBanners()).map((b,i)=>`
        <div style="display:flex;align-items:center;gap:1rem;padding:1rem 1.5rem;background:${i%2===0?'var(--surface)':'var(--surface-2)'};border-top:1px solid var(--border)">
          <span style="font-size:1.75rem;flex-shrink:0">${b.icon}</span>
          <div><div style="font-weight:700;font-size:0.9375rem">${b.title}</div><div style="font-size:0.8125rem;color:var(--text-muted)">${b.desc}</div></div>
        </div>`).join("")}
    </div>`,

  // ── 24. Mobile App Showcase ──────────────────────────────────────────────────
  "mobile-app": (cfg) => `
    ${_announcement(cfg)}
    <section style="display:grid;grid-template-columns:1fr auto;gap:1.5rem;padding:2.5rem 1.5rem;align-items:center">
      <div>
        <h1 style="font-size:clamp(1.5rem,4vw,2rem);font-weight:800;line-height:1.2;color:var(--text);margin-bottom:0.75rem">${cfg.title || "Practice on the Go"}</h1>
        <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1.5rem;line-height:1.6">${cfg.subtitle || "Available on web, mobile, and desktop."}</p>
        ${_ctaBtns(cfg)}
      </div>
      <div style="font-size:5rem;flex-shrink:0">📱</div>
    </section>
    ${_statsBar(cfg)}
    ${_featuresGrid(cfg)}`,

  // ── 25. Exam Focus ───────────────────────────────────────────────────────────
  "exam-focus": (cfg) => `
    ${_announcement(cfg)}
    <div style="background:var(--primary);padding:2rem 1.5rem;text-align:center">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.75);margin-bottom:0.5rem">${cfg.module_name || "Exam Prep"}</div>
      <h1 style="font-size:clamp(1.5rem,4vw,2.25rem);font-weight:900;color:#fff;margin-bottom:0.375rem">${cfg.title || "Official Pattern Mock Tests"}</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:0.9rem;margin-bottom:1.5rem">${cfg.subtitle || ""}</p>
      ${_ctaWhite(cfg)}
    </div>
    <div style="padding:1.25rem 1.5rem;background:var(--surface-2);border-bottom:1px solid var(--border)">
      <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.625rem">Exam Details</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem">
        ${(cfg.exam_details || _defaultExamDetails()).map(d=>`
          <div style="font-size:0.8125rem"><span style="color:var(--text-muted)">${d.label}:</span> <strong>${d.value}</strong></div>`).join("")}
      </div>
    </div>
    ${_featuresGrid(cfg)}`,
};

export const LAYOUT_NAMES = Object.keys(LAYOUTS);
export const DEFAULT_LAYOUT = "hero-center";

/**
 * Render a layout by name.
 * If layoutName matches a custom layout (cfg.custom_layout.name),
 * uses simple token replacement on cfg.custom_layout.template.
 * Falls back to DEFAULT_LAYOUT if unknown.
 */
export function renderLayout(layoutName, cfg) {
  if (cfg.custom_layout?.name === layoutName && cfg.custom_layout?.template) {
    return _renderCustomLayout(cfg.custom_layout.template, cfg);
  }
  const fn = LAYOUTS[layoutName] || LAYOUTS[DEFAULT_LAYOUT];
  return fn(cfg);
}

function _renderCustomLayout(template, cfg) {
  const tokens = {
    "{{title}}": cfg.title || "",
    "{{subtitle}}": cfg.subtitle || "",
    "{{login_label}}": cfg.login_label || "Sign In",
    "{{register_label}}": cfg.register_label || "Register Free",
    "{{module_name}}": cfg.module_name || "",
    "{{announcement}}": cfg.announcement || "",
    "{{tagline}}": cfg.tagline || "",
    "{{stats_bar}}": _statsBar(cfg),
    "{{features_grid}}": _featuresGrid(cfg),
    "{{cta_btns}}": _ctaBtns(cfg),
  };
  return Object.entries(tokens).reduce((tpl, [k, v]) => tpl.replaceAll(k, v), template);
}

// ─── Shared partials ─────────────────────────────────────────────────────────

function _announcement(cfg) {
  if (!cfg.announcement) return "";
  return `<div style="background:var(--primary);color:#fff;padding:0.625rem 1.5rem;text-align:center;font-size:0.8125rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:0.5rem">
    <span>📢</span><span>${cfg.announcement}</span>
  </div>`;
}

function _logo(cfg) {
  if (!cfg.logo && !cfg.module_name) return "";
  return `<div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:center;gap:0.5rem">
    ${cfg.logo ? `<img src="${cfg.logo}" style="height:40px;object-fit:contain" alt="">` : ""}
    ${cfg.module_name ? `<span style="font-weight:800;font-size:1.125rem;color:var(--text)">${cfg.module_name}</span>` : ""}
  </div>`;
}

function _ctaBtns(cfg) {
  return `<div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
    <a href="login.html" class="btn btn-primary">${cfg.login_label || "Sign In"}</a>
    <a href="register-1.html" class="btn btn-secondary">${cfg.register_label || "Register Free"}</a>
  </div>`;
}

function _ctaWhite(cfg) {
  return `<div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
    <a href="login.html" style="padding:0.75rem 1.75rem;background:#fff;color:var(--primary);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.9375rem">${cfg.login_label || "Sign In"}</a>
    <a href="register-1.html" style="padding:0.75rem 1.75rem;background:rgba(255,255,255,0.15);color:#fff;border:2px solid rgba(255,255,255,0.5);border-radius:var(--radius);font-weight:700;text-decoration:none;font-size:0.9375rem">${cfg.register_label || "Register"}</a>
  </div>`;
}

function _statsBar(cfg) {
  const stats = cfg.stats || _defaultStats();
  return `<div style="display:flex;border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
    ${stats.map(s => `<div style="flex:1;text-align:center;padding:0.875rem 0.5rem;border-right:1px solid var(--border)">
      <div style="font-size:1.125rem;font-weight:800;color:var(--primary)">${s.value}</div>
      <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-top:0.125rem">${s.label}</div>
    </div>`).join("")}
  </div>`;
}

function _featuresGrid(cfg) {
  const features = cfg.features || _defaultFeatures();
  return `<div style="padding:1.5rem">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.875rem">
      ${features.map(f => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.125rem;text-align:center">
          <div style="font-size:1.75rem;margin-bottom:0.5rem">${f.icon}</div>
          <div style="font-weight:600;font-size:0.875rem;margin-bottom:0.25rem">${f.title}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.4">${f.desc}</div>
        </div>`).join("")}
    </div>
  </div>`;
}

// ─── Default content ──────────────────────────────────────────────────────────

function _defaultStats() {
  return [
    { value: "10K+", label: "Students" },
    { value: "500+", label: "Tests" },
    { value: "95%", label: "Pass Rate" },
    { value: "24/7", label: "Support" },
  ];
}

function _defaultFeatures() {
  return [
    { icon: "📝", title: "Mock Tests", desc: "Full-length timed tests" },
    { icon: "📊", title: "Analytics", desc: "Detailed performance reports" },
    { icon: "🎯", title: "Weak Areas", desc: "AI identifies gaps" },
    { icon: "🔁", title: "Practice", desc: "Unlimited attempts" },
    { icon: "📱", title: "All Devices", desc: "Web, mobile, desktop" },
    { icon: "🏆", title: "Rankings", desc: "Live leaderboard" },
  ];
}

function _defaultSlides() {
  return [
    { icon: "🎯", title: "Targeted Practice", desc: "Focus on what matters most for your exam" },
    { icon: "📊", title: "Smart Analytics", desc: "Know exactly where you stand" },
    { icon: "🏆", title: "Beat the Competition", desc: "Rank against thousands of aspirants" },
  ];
}

function _defaultTestimonials() {
  return [
    { name: "Rahul S.", rank: "AIR 142 — RRB Group D", text: "The mock tests felt exactly like the real exam. Cleared in first attempt!" },
    { name: "Priya M.", rank: "Selected — SSC CGL", text: "Weak area analysis helped me fix my Maths score from 45% to 82%." },
    { name: "Arjun K.", rank: "AIR 89 — RRB NTPC", text: "10 minutes of daily practice on this platform made a huge difference." },
  ];
}

function _defaultToppers() {
  return [
    { name: "Rahul S.", exam: "RRB Group D 2024", score: "89.4%" },
    { name: "Priya M.", exam: "SSC CGL 2024", score: "87.1%" },
    { name: "Arjun K.", exam: "RRB NTPC 2024", score: "85.8%" },
    { name: "Sunita R.", exam: "RRB Group D 2024", score: "84.2%" },
    { name: "Vikram P.", exam: "SSC CHSL 2024", score: "83.6%" },
  ];
}

function _defaultTimeline() {
  return [
    { icon: "📝", title: "Take a Diagnostic Test", desc: "Find your current level and weak topics" },
    { icon: "🎯", title: "Practise Weak Areas", desc: "Topic-wise questions with explanations" },
    { icon: "📊", title: "Track Your Progress", desc: "Daily score reports and improvement graphs" },
    { icon: "🔁", title: "Full Mock Tests", desc: "Exam-pattern tests with ranking" },
    { icon: "🏆", title: "Exam Day Ready", desc: "Confident, fast, and accurate" },
  ];
}

function _defaultNotices() {
  return [
    { icon: "🆕", title: "New Test Series Available", desc: "RRB Group D 2024 pattern — 50 tests added" },
    { icon: "📅", title: "Live Test This Weekend", desc: "All-India mock on Sunday 10 AM" },
    { icon: "🎯", title: "Previous Year Papers", desc: "2018–2023 fully solved with explanations" },
  ];
}

function _defaultModules() {
  return [
    { icon: "🚂", name: "RRB Group D" },
    { icon: "📋", name: "SSC CGL" },
    { icon: "🏦", name: "IBPS PO" },
    { icon: "📚", name: "SSC CHSL" },
    { icon: "🚌", name: "RRB NTPC" },
    { icon: "👮", name: "SSC GD" },
  ];
}

function _defaultTicker() {
  return [
    "New RRB Group D tests added",
    "Live test every Sunday",
    "Previous year papers available",
    "AI-generated content — for practice only",
  ];
}

function _defaultBanners() {
  return [
    { icon: "📝", title: "500+ Mock Tests", desc: "Full-length, exam-pattern timed tests" },
    { icon: "📊", title: "Smart Analytics", desc: "Topic-wise accuracy and speed tracking" },
    { icon: "🎯", title: "Weak Area Focus", desc: "AI identifies and targets your weak topics" },
    { icon: "🏆", title: "Live Rankings", desc: "Compare with thousands of aspirants" },
    { icon: "📱", title: "All Devices", desc: "Web, mobile, and desktop — synced" },
  ];
}

function _defaultExamDetails() {
  return [
    { label: "Questions", value: "100" },
    { label: "Duration", value: "90 min" },
    { label: "Marking", value: "+1 / -⅓" },
    { label: "Language", value: "EN / HI" },
  ];
}

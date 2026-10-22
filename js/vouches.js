// VouchVault Embed Widget
(function () {
  var container = document.getElementById("vouchesContainer");
  if (!container) {
    console.error("VouchVault Embed: Missing #vouchesContainer element");
    return;
  }

  var slug = window.slug || container.getAttribute("data-slug");
  if (!slug) {
    console.error("VouchVault Embed: Missing slug. Set window.slug or data-slug on the container.");
    container.innerHTML = '<p style="color:#b0b7be;text-align:center;padding:20px;">VouchVault: No bot slug configured.</p>';
    return;
  }

  var layout = container.getAttribute("data-layout") || "grid";
  var visible = parseInt(container.getAttribute("data-visible") || "0", 10) || 0; // 0 = show all
  var showProof = container.getAttribute("data-proof") === "true";
  var autoplay = container.getAttribute("data-autoplay") !== "false"; // default on
  var interval = parseInt(container.getAttribute("data-interval") || "5000", 10) || 5000;

  var scriptTag = document.querySelector('script[src*="embed/vouches.js"]');
  var baseUrl = "https://vouchvault.cc";
  if (scriptTag && scriptTag.src) {
    try {
      var url = new URL(scriptTag.src);
      baseUrl = url.origin;
    } catch (e) {
      // fallback to default
    }
  }

  container.setAttribute("data-vv-layout", layout);

  container.innerHTML = '<p style="color:#b0b7be;text-align:center;padding:20px;">Loading vouches...</p>';

  fetch(baseUrl + "/api/embed/vouches/" + encodeURIComponent(slug))
    .then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      var vouchesData = data.vouches;
      if (!Array.isArray(vouchesData) || vouchesData.length === 0) {
        container.innerHTML = '<p style="color:#b0b7be;text-align:center;padding:20px;">No vouches yet.</p>';
        return;
      }

      var displayVouches = (layout !== "carousel" && visible > 0)
        ? vouchesData.slice(0, visible)
        : vouchesData;

      container.innerHTML = "";

      if (layout === "carousel") {
        renderCarousel(displayVouches);
      } else {
        displayVouches.forEach(function (vouch) {
          container.appendChild(buildCard(vouch));
        });
      }
    })
    .catch(function (error) {
      console.error("VouchVault Embed: Error fetching vouches:", error);
      container.innerHTML = '<p style="color:#b0b7be;text-align:center;padding:20px;">Failed to load vouches.</p>';
    });

  function buildCard(vouch) {
    var vouchElement = document.createElement("div");
    vouchElement.className = "vouch";

    var username = escapeHtml(vouch.username || "Unknown");
    var userId = escapeHtml(vouch.userid || "");
    var reason = escapeHtml(vouch.reason || "");
    var pfp = vouch.userpfp && /^https?:\/\//i.test(vouch.userpfp) ? vouch.userpfp : "";
    var stars = escapeHtml(vouch.stars || "");
    var timestamp = vouch.timestamp ? new Date(vouch.timestamp).toLocaleDateString() : "";
    var proof = vouch.proof && showProof && /^https?:\/\//i.test(vouch.proof) ? vouch.proof : "";

    var html =
      '<div class="vouch-header">' +
        (pfp ? '<img src="' + pfp + '" alt="" class="user-pfp" onerror="this.style.display=\'none\'" />' : '') +
        '<span class="username">' + username + '</span>' +
        '<span class="user-id">(' + userId + ')</span>' +
      '</div>' +
      '<div class="rating">' + stars + '</div>' +
      '<p class="message">' + reason + '</p>';

    if (proof) {
      html += '<a href="' + proof + '" target="_blank" rel="noopener noreferrer" class="proof-link">View Proof</a>';
    }

    html += '<span class="timestamp">' + timestamp + '</span>';

    vouchElement.innerHTML = html;
    return vouchElement;
  }

  function renderCarousel(vouches) {
    function perView() {
      var w = container.clientWidth || window.innerWidth;
      var requested = visible > 0 ? visible : 3;
      if (w < 640) return 1;
      if (w < 1024) return Math.min(2, requested);
      return requested;
    }

    var viewport = document.createElement("div");
    viewport.className = "vv-carousel-viewport";

    var track = document.createElement("div");
    track.className = "vv-carousel-track";

    vouches.forEach(function (vouch) {
      var card = buildCard(vouch);
      card.className = "vouch vv-carousel-slide";
      track.appendChild(card);
    });

    viewport.appendChild(track);
    container.appendChild(viewport);

    var prevBtn = document.createElement("button");
    prevBtn.className = "vv-carousel-btn vv-carousel-prev";
    prevBtn.setAttribute("aria-label", "Previous");
    prevBtn.innerHTML = "&#10094;";

    var nextBtn = document.createElement("button");
    nextBtn.className = "vv-carousel-btn vv-carousel-next";
    nextBtn.setAttribute("aria-label", "Next");
    nextBtn.innerHTML = "&#10095;";

    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    var index = 0;

    function maxIndex() {
      return Math.max(0, vouches.length - perView());
    }

    function layoutSlides() {
      var pv = perView();
      var gap = 16; // keep in sync with CSS gap
      var slideWidth = (viewport.clientWidth - gap * (pv - 1)) / pv;
      var slides = track.querySelectorAll(".vv-carousel-slide");
      for (var i = 0; i < slides.length; i++) {
        slides[i].style.width = slideWidth + "px";
        slides[i].style.marginRight = gap + "px";
      }
      if (index > maxIndex()) index = maxIndex();
      update();
    }

    function update() {
      var pv = perView();
      var gap = 16;
      var slideWidth = (viewport.clientWidth - gap * (pv - 1)) / pv;
      var offset = index * (slideWidth + gap);
      track.style.transform = "translateX(" + -offset + "px)";
    }

    function go(delta) {
      var max = maxIndex();
      index += delta;
      if (index < 0) index = max;      
      if (index > max) index = 0;   
      update();
    }

    nextBtn.addEventListener("click", function () { go(1); restart(); });
    prevBtn.addEventListener("click", function () { go(-1); restart(); });

    window.addEventListener("resize", layoutSlides);
    layoutSlides();

    var timer = null;
    function start() {
      if (autoplay && vouches.length > perView()) {
        timer = setInterval(function () { go(1); }, interval);
      }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function restart() { stop(); start(); }

    container.addEventListener("mouseenter", stop);
    container.addEventListener("mouseleave", start);
    start();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();

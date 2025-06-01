(function () {
  "use strict";

  const CONFIG_KEY = "ytaf-configuration";
  const defaultConfig = {
    enableAdBlock: true,
    enableSponsorBlock: true,
    sponsorBlockManualSkips: [],
    enableSponsorBlockSponsor: true,
    enableSponsorBlockIntro: true,
    enableSponsorBlockOutro: true,
    enableSponsorBlockInteraction: true,
    enableSponsorBlockSelfPromo: true,
    enableSponsorBlockMusicOfftopic: true,
    enableShorts: true,
  };

  let localConfig;
  try {
    localConfig = JSON.parse(window.localStorage[CONFIG_KEY] || "{}");
  } catch (err) {
    localConfig = defaultConfig;
  }
  window.localConfig = localConfig;

  window.configRead = function (key) {
    if (window.localConfig[key] === undefined) {
      window.localConfig[key] = defaultConfig[key];
    }
    return window.localConfig[key];
  };

  window.configWrite = function (key, value) {
    window.localConfig[key] = value;
    window.localStorage[CONFIG_KEY] = JSON.stringify(window.localConfig);
  };

  function showToast(title, subtitle) {
    const toastCmd = {
      openPopupAction: {
        popupType: "TOAST",
        popup: {
          overlayToastRenderer: {
            title: { simpleText: title },
            subtitle: { simpleText: subtitle },
          },
        },
      },
    };
    resolveCommand(toastCmd);
  }

  function showModal(title, content, selectIndex, id, update) {
    if (!update) {
      resolveCommand({ signalAction: { signal: "POPUP_BACK" } });
    }

    const modalCmd = {
      openPopupAction: {
        popupType: "MODAL",
        popup: {
          overlaySectionRenderer: {
            overlay: {
              overlayTwoPanelRenderer: {
                actionPanel: {
                  overlayPanelRenderer: {
                    header: {
                      overlayPanelHeaderRenderer: { title: { simpleText: title } },
                    },
                    content: {
                      overlayPanelItemListRenderer: {
                        items: content,
                        selectedIndex: selectIndex,
                      },
                    },
                  },
                },
                backButton: {
                  buttonRenderer: {
                    accessibilityData: { accessibilityData: { label: "Back" } },
                    command: { signalAction: { signal: "POPUP_BACK" } },
                  },
                },
              },
            },
            dismissalCommand: { signalAction: { signal: "POPUP_BACK" } },
          },
        },
        uniqueId: id,
      },
    };

    if (update) {
      modalCmd.openPopupAction.shouldMatchUniqueId = true;
      modalCmd.openPopupAction.updateAction = true;
    }

    resolveCommand(modalCmd);
  }

  function buttonItem(title, icon, commands) {
    const button = {
      compactLinkRenderer: {
        serviceEndpoint: { commandExecutorCommand: { commands } },
      },
    };

    if (title) button.compactLinkRenderer.title = { simpleText: title.title };
    if (title.subtitle) button.compactLinkRenderer.subtitle = { simpleText: title.subtitle };
    if (icon) button.compactLinkRenderer.icon = { iconType: icon.icon };
    if (icon?.secondaryIcon) button.compactLinkRenderer.secondaryIcon = { iconType: icon.secondaryIcon };

    return button;
  }

  window.modernUI = function modernUI(update, parameters) {
    const settings = [
      { name: "Ad block", icon: "DOLLAR_SIGN", value: "enableAdBlock" },
      { name: "SponsorBlock", icon: "MONEY_HAND", value: "enableSponsorBlock" },
      { name: "Skip Sponsor Segments", icon: "MONEY_HEART", value: "enableSponsorBlockSponsor" },
      { name: "Skip Intro Segments", icon: "PLAY_CIRCLE", value: "enableSponsorBlockIntro" },
      { name: "Skip Outro Segments", value: "enableSponsorBlockOutro" },
      { name: "Skip Interaction Reminder Segments", value: "enableSponsorBlockInteraction" },
      { name: "Skip Self-Promotion Segments", value: "enableSponsorBlockSelfPromo" },
      { name: "Skip Off-Topic Music Segments", value: "enableSponsorBlockMusicOfftopic" },
      { name: "Shorts", icon: "YOUTUBE_SHORTS_FILL_24", value: "enableShorts" },
    ];

    const buttons = [];
    let index = 0;
    for (const setting of settings) {
      const currentVal = setting.value ? configRead(setting.value) : null;
      buttons.push(
        buttonItem(
          { title: setting.name, subtitle: setting.subtitle },
          {
            icon: setting.icon ? setting.icon : "CHEVRON_DOWN",
            secondaryIcon: currentVal === null ? "CHEVRON_RIGHT" : currentVal ? "CHECK_BOX" : "CHECK_BOX_OUTLINE_BLANK",
          },
          currentVal !== null
            ? [
                {
                  setClientSettingEndpoint: {
                    settingDatas: [{ clientSettingEnum: { item: setting.value }, boolValue: !configRead(setting.value) }],
                  },
                },
                { customAction: { action: "SETTINGS_UPDATE", parameters: [index] } },
              ]
            : [{ customAction: { action: "OPTIONS_SHOW", parameters: { options: setting.options, selectedIndex: 0, update: false } } }]
        )
      );
      index++;
    }

    showModal("NotubeTv Settings", buttons, parameters && parameters.length > 0 ? parameters[0] : 0, "tt-settings", update);
  };

  function resolveCommand(cmd, _) {
    for (const key in window._yttv) {
      if (window._yttv[key]?.instance?.resolveCommand) {
        return window._yttv[key].instance.resolveCommand(cmd, _);
      }
    }
  }

  function patchResolveCommand() {
    for (const key in window._yttv) {
      if (window._yttv[key]?.instance?.resolveCommand) {
        const ogResolve = window._yttv[key].instance.resolveCommand;
        window._yttv[key].instance.resolveCommand = function (cmd, _) {
          if (cmd.setClientSettingEndpoint) {
            for (const setting of cmd.setClientSettingEndpoint.settingDatas) {
              const valName = Object.keys(setting).find((key) => key.includes("Value"));
              const value = valName === "intValue" ? Number(setting[valName]) : setting[valName];
              if (valName === "arrayValue") {
                const arr = configRead(setting.clientSettingEnum.item);
                if (arr.includes(value)) arr.splice(arr.indexOf(value), 1);
                else arr.push(value);
                configWrite(setting.clientSettingEnum.item, arr);
              } else {
                configWrite(setting.clientSettingEnum.item, value);
              }
            }
          } else if (cmd.customAction) {
            customAction(cmd.customAction.action, cmd.customAction.parameters);
            return true;
          } else if (cmd?.showEngagementPanelEndpoint?.customAction) {
            customAction(cmd.showEngagementPanelEndpoint.customAction.action, cmd.showEngagementPanelEndpoint.customAction.parameters);
            return true;
          }
          return ogResolve.call(this, cmd, _);
        };
      }
    }
  }

  function customAction(action, parameters) {
    switch (action) {
      case "SETTINGS_UPDATE":
        modernUI(true, parameters);
        break;
      case "SKIP":
        const video = document.querySelector("video");
        if (video) {
          video.currentTime = parameters.time;
        }
        resolveCommand({ signalAction: { signal: "POPUP_BACK" } });
        break;
    }
  }

  // Mock ad-blocking via request interception (replace with actual NetworkBridge logic)
  function interceptRequests(callback) {
    // Placeholder: Implement actual request interception using NetworkBridge
    // For now, assume a mock function that filters ad data
    const origFetch = window.NetworkBridge?.fetch || window.fetch;
    window.NetworkBridge = window.NetworkBridge || {};
    window.NetworkBridge.fetch = async function (url, ...args) {
      const response = await origFetch(url, ...args);
      if (url.includes("/watch?") || url.includes("/get_video_info")) {
        const text = await response.text();
        let json;
        try {
          json = JSON.parse(text);
          if (configRead("enableAdBlock")) {
            json.adPlacements = [];
            json.playerAds = false;
            json.adSlots = [];
            if (json?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer?.contents) {
              const s = json.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents[0];
              s.shelfRenderer.content.horizontalListRenderer.items = s.shelfRenderer.content.horizontalListRenderer.items.filter((i) => !i?.adSlotRenderer);
            }
            if (!configRead("enableShorts") && json?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content) {
              json.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents =
                json.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content.sectionListRenderer.contents.filter(
                  (shelve) => shelve.shelfRenderer?.tvhtml5ShelfRendererType !== "TVHTML5_SHELF_RENDERER_TYPE_SHORTS"
                );
            }
          }
          callback(JSON.stringify(json));
        } catch (err) {
          console.warn("Request interception failed:", err);
        }
        return new Response(JSON.stringify(json), response);
      }
      return response;
    };
  }

  // Use native crypto for SHA-256
  async function sha256(ascii) {
    if (window.crypto?.subtle?.digest) {
      const msgBuffer = new TextEncoder().encode(ascii);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback to custom SHA-256 (minimized for brevity)
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    let hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, /* ... truncated for brevity ... */
    ];
    let words = [];
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      words[i >> 2] |= ascii.charCodeAt(i) << ((3 - (i % 4)) * 8);
    }
    words[words.length] = (ascii.length * 8) / Math.pow(2, 32) | 0;
    words[words.length] = ascii.length * 8;
    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, (j += 16));
      let h = hash.slice(0);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15] || 0, w2 = w[i - 2] || 0;
        const s0 = (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3));
        const s1 = (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10));
        w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        const temp1 = h[7] + (rightRotate(h[4], 6) ^ rightRotate(h[4], 11) ^ rightRotate(h[4], 25)) + ((h[4] & h[5]) ^ (~h[4] & h[6])) + k[i] + w[i];
        const temp2 = (rightRotate(h[0], 2) ^ rightRotate(h[0], 13) ^ rightRotate(h[0], 22)) + ((h[0] & h[1]) ^ (h[0] & h[2]) ^ (h[1] & h[2]));
        h = [(temp1 + temp2) | 0].concat(h);
        h[4] = (h[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + h[i]) | 0;
    }
    let result = "";
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j >= 0; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  const barTypes = {
    sponsor: { color: "#00d400", opacity: "0.7", name: "sponsored segment" },
    intro: { color: "#00ffff", opacity: "0.7", name: "intro" },
    outro: { color: "#0202ed", opacity: "0.7", name: "outro" },
    interaction: { color: "#cc00ff", opacity: "0.7", name: "interaction reminder" },
    selfpromo: { color: "#ffff00", opacity: "0.7", name: "self-promotion" },
    music_offtopic: { color: "#ff9900", opacity: "0.7", name: "non-music part" },
  };

  const sponsorblockAPI = "https://api.sponsor.ajay.app/api";

  class SponsorBlockHandler {
    constructor(videoID) {
      this.videoID = videoID;
      this.video = null;
      this.segmentsoverlay = null;
      this.observer = null;
      this.scheduleSkipHandler = () => this.scheduleSkip();
      this.durationChangeHandler = () => this.buildOverlay();
      this.active = true;
      this.segments = null;
      this.skippableCategories = [];
      this.manualSkippableCategories = [];
    }

    async init() {
      if (!configRead("enableSponsorBlock")) return;

      try {
        const videoHash = (await sha256(this.videoID)).substring(0, 4);
        const categories = ["sponsor", "intro", "outro", "interaction", "selfpromo", "music_offtopic"];
        const resp = await new Promise((resolve) => {
          window.onNetworkBridgeResponse = (jsonString) => resolve(jsonString);
          NetworkBridge.fetch(`${sponsorblockAPI}/skipSegments/${videoHash}?categories=${encodeURIComponent(JSON.stringify(categories))}`, this.videoID);
        });
        const result = JSON.parse(resp);
        if (!result?.segments?.length) return;

        this.segments = result.segments;
        this.manualSkippableCategories = configRead("sponsorBlockManualSkips");
        this.skippableCategories = this.getSkippableCategories();
        this.attachVideo();
        this.buildOverlay();
      } catch (err) {
        console.warn("SponsorBlock init failed:", err);
        showToast("SponsorBlock Error", "Failed to load segments");
      }
    }

    getSkippableCategories() {
      const skippableCategories = [];
      if (configRead("enableSponsorBlockSponsor")) skippableCategories.push("sponsor");
      if (configRead("enableSponsorBlockIntro")) skippableCategories.push("intro");
      if (configRead("enableSponsorBlockOutro")) skippableCategories.push("outro");
      if (configRead("enableSponsorBlockInteraction")) skippableCategories.push("interaction");
      if (configRead("enableSponsorBlockSelfPromo")) skippableCategories.push("selfpromo");
      if (configRead("enableSponsorBlockMusicOfftopic")) skippableCategories.push("music_offtopic");
      return skippableCategories;
    }

    attachVideo() {
      this.video = document.querySelector("video");
      if (!this.video) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              this.video = entries[0].target;
              this.video.addEventListener("play", this.scheduleSkipHandler);
              this.video.addEventListener("durationchange", this.durationChangeHandler);
              observer.disconnect();
            }
          },
          { root: null, threshold: 0.1 }
        );
        const video = document.querySelector("video");
        if (video) observer.observe(video);
        return;
      }
      this.video.addEventListener("play", this.scheduleSkipHandler);
      this.video.addEventListener("durationchange", this.durationChangeHandler);
    }

    buildOverlay() {
      if (this.segmentsoverlay || !this.video?.duration) return;

      const slider = document.querySelector('[idomkey="slider"]');
      if (!slider) {
        const observer = new MutationObserver(() => {
          const slider = document.querySelector('[idomkey="slider"]');
          if (slider) {
            this.slider = slider;
            this.addOverlay();
            observer.disconnect();
          }
        });
        observer.observe(document.querySelector(".ytLrWatchDefaultShadow") || document.body, { childList: true, subtree: true });
        return;
      }

      this.slider = slider;
      this.addOverlay();
    }

    addOverlay() {
      this.segmentsoverlay = document.createElement("div");
      this.segments.forEach((segment) => {
        const [start, end] = segment.segment;
        const barType = barTypes[segment.category] || { color: "blue", opacity: 0.7 };
        const transform = `translateX(${(start / this.video.duration) * 100.0}%) scaleX(${(end - start) / this.video.duration})`;
        const elm = document.createElement("div");
        elm.classList.add("ytLrProgressBarPlayed");
        elm.style.background = barType.color;
        elm.style.opacity = barType.opacity;
        elm.style["-webkit-transform"] = transform;
        this.segmentsoverlay.appendChild(elm);
      });

      this.observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.removedNodes && Array.from(m.removedNodes).includes(this.segmentsoverlay)) {
            this.slider.appendChild(this.segmentsoverlay);
          }
        }
      });
      this.observer.observe(this.slider, { childList: true });
      this.slider.appendChild(this.segmentsoverlay);
    }

    scheduleSkip() {
      if (!this.active || this.video.paused) return;

      const current = this.video.currentTime;
      const nextSegments = this.segments
        .filter((seg) => seg.segment[0] >= current - 0.2)
        .sort((a, b) => a.segment[0] - b.segment[0]);

      if (!nextSegments.length) return;

      const [segment] = nextSegments;
      const [start, end] = segment.segment;
      if (current >= end) return;

      setTimeout(() => {
        if (this.video.paused || !this.skippableCategories.includes(segment.category)) return;
        const skipName = barTypes[segment.category]?.name || segment.category;
        if (!this.manualSkippableCategories.includes(segment.category)) {
          showToast("SponsorBlock", `Skipping ${skipName}`);
          this.video.currentTime = end;
          this.scheduleSkip();
        }
      }, Math.max(0, (start - current) * 1000));
    }

    destroy() {
      this.active = false;
      this.segments = null;
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.segmentsoverlay) {
        this.segmentsoverlay.remove();
        this.segmentsoverlay = null;
      }
      if (this.video) {
        this.video.removeEventListener("play", this.scheduleSkipHandler);
        this.video.removeEventListener("durationchange", this.durationChangeHandler);
        this.video = null;
      }
    }
  }

  // Debounce hashchange
  function debounce(fn, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  window.sponsorblock = null;
  window.addEventListener(
    "hashchange",
    debounce(() => {
      if (!configRead("enableSponsorBlock")) {
        if (window.sponsorblock) window.sponsorblock.destroy();
        return;
      }
      const match = location.hash.match(/[?&]v=([^&]+)/);
      const videoID = match ? match[1] : null;
      if (!videoID) return;
      if (!window.sponsorblock || window.sponsorblock.videoID !== videoID) {
        if (window.sponsorblock) window.sponsorblock.destroy();
        window.sponsorblock = new SponsorBlockHandler(videoID);
        window.sponsorblock.init();
      }
    }, 100),
    false
  );

  function execute_once_dom_loaded() {
    const css = `
      .ytaf-ui-container {
        position: absolute; top: 10%; left: 10%; right: 10%; bottom: 10%;
        background: rgba(0, 0, 0, 0.8); color: white; border-radius: 20px; padding: 20px; font-size: 1.5rem; z-index: 1000;
      }
      .ytaf-ui-container :focus { outline: 4px red solid; }
      .ytaf-ui-container h1 { margin: 0; margin-bottom: 0.5em; text-align: center; }
      .ytaf-ui-container input[type='checkbox'], .ytaf-ui-container input[type='radio'] { width: 1.4rem; height: 1.4rem; }
      .ytaf-ui-container label { display: block; font-size: 1.4rem; }
      .ytaf-notification-container { position: absolute; right: 10px; bottom: 10px; font-size: 16pt; z-index: 1200; }
      .ytaf-notification-container .message {
        background: rgba(0, 0, 0, 0.7); color: white; padding: 1em; margin: 0.5em;
        transition: all 0.3s ease-in-out; opacity: 1; line-height: 1; border-right: 10px solid rgba(50, 255, 50, 0.3); display: inline-block; float: right;
      }
      .ytaf-notification-container .message-hidden { opacity: 0; margin: 0 0.5em; padding: 0 1em; line-height: 0; }
      .ytLrWatchDefaultShadow {
        background-image: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0, rgba(0, 0, 0, 0.8) 90%) !important;
        background-color: rgba(0, 0, 0, 0.3) !important; display: block !important; height: 100% !important; pointer-events: none !important;
        position: absolute !important; width: 100% !important;
      }
      .ytLrTileHeaderRendererShorts { background-image: none !important; }
    `;

    const existingStyle = document.querySelector("style[nonce]");
    if (existingStyle) {
      existingStyle.textContent += css;
    } else {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
    }

    const uiContainer = document.createElement("div");
    uiContainer.classList.add("ytaf-ui-container");
    uiContainer.style.display = "none";
    uiContainer.setAttribute("tabindex", 0);
    uiContainer.addEventListener(
      "keydown",
      (evt) => {
        if (evt.keyCode === 13 || evt.keyCode === 32) {
          const focusedElement = document.querySelector(":focus");
          if (focusedElement?.type === "checkbox") {
            focusedElement.checked = !focusedElement.checked;
            focusedElement.dispatchEvent(new Event("change"));
          }
          evt.preventDefault();
          evt.stopPropagation();
        }
      },
      true
    );
    document.body.appendChild(uiContainer);

    // Start request interception
    interceptRequests((jsonString) => {
      window.onNetworkBridgeResponse?.(jsonString);
    });
  }

  // Initialize with IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        execute_once_dom_loaded();
        patchResolveCommand();
        observer.disconnect();
      }
    },
    { root: null, threshold: 0.1 }
  );
  const video = document.querySelector("video");
  if (video) {
    execute_once_dom_loaded();
    patchResolveCommand();
  } else {
    observer.observe(document.body);
  }
})();
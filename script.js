/* =========================================================
   ONLINE TOOLS & CONVERTERS
   Main script for onlinetoolsandconverters.cc
   File: /script.js

   Includes:
   - Shared utility helpers
   - Clipboard and download functions
   - Responsive navigation
   - Homepage tool directory and search
   - Generic copy and download buttons
   - YouTube Metadata Generator connected to Cloudflare AI
   ========================================================= */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     Common helpers
     --------------------------------------------------------- */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));

  const normalizeText = (value) =>
    String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim();

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

  function formatNumber(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(value)) return "—";

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: clamp(
        maximumFractionDigits,
        0,
        10
      ),
    }).format(value);
  }

  function formatBytes(bytes, decimalPlaces = 2) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Invalid size";
    }

    if (bytes === 0) return "0 Bytes";

    const units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1000)),
      units.length - 1
    );

    const result = bytes / Math.pow(1000, exponent);

    return (
      formatNumber(result, decimalPlaces) +
      " " +
      units[exponent]
    );
  }

  function formatBinaryBytes(bytes, decimalPlaces = 2) {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return "Invalid size";
    }

    if (bytes === 0) return "0 Bytes";

    const units = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB"];

    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const result = bytes / Math.pow(1024, exponent);

    return (
      formatNumber(result, decimalPlaces) +
      " " +
      units[exponent]
    );
  }

  function debounce(callback, delay = 200) {
    let timerId = null;

    return function (...args) {
      window.clearTimeout(timerId);

      timerId = window.setTimeout(() => {
        callback.apply(this, args);
      }, delay);
    };
  }

  function setText(target, value) {
    const element =
      typeof target === "string" ? $(target) : target;

    if (!element) return;

    element.textContent = String(value ?? "");
  }

  function setStatus(target, message, type = "info") {
    const element =
      typeof target === "string" ? $(target) : target;

    if (!element) return;

    const classes = {
      info: "alert-info",
      success: "alert-ok",
      error: "alert-error",
    };

    element.classList.remove(
      "alert-info",
      "alert-ok",
      "alert-error"
    );

    element.classList.add(classes[type] || classes.info);
    element.textContent = String(message ?? "");
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
  }


  /* ---------------------------------------------------------
     Clipboard
     --------------------------------------------------------- */

  async function copyText(value) {
    const text = String(value ?? "");

    if (!text) {
      throw new Error("There is no content to copy.");
    }

    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // Try the compatibility fallback.
      }
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");

    Object.assign(textarea.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      opacity: "0",
    });

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    } finally {
      textarea.remove();
    }

    if (!copied) {
      throw new Error(
        "Copy was blocked. Select the output and copy it manually."
      );
    }

    return true;
  }


  /* ---------------------------------------------------------
     Downloads
     --------------------------------------------------------- */

  function downloadBlob(blob, filename = "download.txt") {
    if (!(blob instanceof Blob)) {
      throw new TypeError("A valid Blob is required.");
    }

    const safeFilename = String(filename || "download.txt")
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
      .slice(0, 180);

    const objectURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectURL;
    link.download = safeFilename;
    link.hidden = true;

    document.body.appendChild(link);

    try {
      link.click();
    } catch (error) {
      URL.revokeObjectURL(objectURL);
      link.remove();
      throw error;
    }

    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(objectURL);
    }, 2000);
  }

  function downloadText(
    text,
    filename = "download.txt",
    mimeType = "text/plain;charset=utf-8"
  ) {
    const blob = new Blob([String(text ?? "")], {
      type: mimeType,
    });

    downloadBlob(blob, filename);
  }


  /* ---------------------------------------------------------
     Current year
     --------------------------------------------------------- */

  function initializeYear() {
    const year = String(new Date().getFullYear());

    const selectors = [
      "[data-current-year]",
      "#current-year",
      "#year",
      "#ir-year",
      "#chYear",
    ];

    const processed = new Set();

    selectors.forEach((selector) => {
      $$(selector).forEach((element) => {
        if (processed.has(element)) return;

        processed.add(element);
        element.textContent = year;
      });
    });
  }


  /* ---------------------------------------------------------
     Responsive navigation

     Supports:
       .nav-toggle + .primary-nav
       .menu-toggle + .main-nav
     --------------------------------------------------------- */

  function initializeNavigation() {
    const pairs = [
      {
        buttonSelector: ".nav-toggle",
        navSelector: ".primary-nav",
      },
      {
        buttonSelector: ".menu-toggle",
        navSelector: ".main-nav",
      },
    ];

    const initialized = new WeakSet();
    const mobileQuery = window.matchMedia("(max-width: 820px)");

    pairs.forEach(({ buttonSelector, navSelector }) => {
      $$(buttonSelector).forEach((button) => {
        if (initialized.has(button)) return;

        const header = button.closest("header") || document;

        const nav =
          $(navSelector, header) ||
          $(navSelector, document);

        if (!nav) return;

        initialized.add(button);

        const isExpanded = () =>
          button.getAttribute("aria-expanded") === "true";

        function closeMenu(returnFocus = false) {
          nav.classList.remove("is-open");
          button.setAttribute("aria-expanded", "false");

          if (returnFocus) {
            button.focus();
          }
        }

        function openMenu() {
          nav.classList.add("is-open");
          button.setAttribute("aria-expanded", "true");
        }

        button.addEventListener("click", (event) => {
          event.preventDefault();

          if (isExpanded()) {
            closeMenu();
          } else {
            openMenu();
          }
        });

        nav.addEventListener("click", (event) => {
          const link = event.target.closest("a");

          if (link) {
            closeMenu();
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isExpanded()) {
            closeMenu(true);
          }
        });

        document.addEventListener("click", (event) => {
          if (!isExpanded()) return;

          if (
            nav.contains(event.target) ||
            button.contains(event.target)
          ) {
            return;
          }

          closeMenu();
        });

        function handleBreakpointChange(event) {
          if (!event.matches) {
            closeMenu();
          }
        }

        if (typeof mobileQuery.addEventListener === "function") {
          mobileQuery.addEventListener(
            "change",
            handleBreakpointChange
          );
        } else if (typeof mobileQuery.addListener === "function") {
          mobileQuery.addListener(handleBreakpointChange);
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Homepage directory

     Powers:
       #toolSearch
       #clearToolSearch
       [data-filter]
       [data-tool-card]
       #toolCount
       #toolSearchStatus
       #noToolsFound
       #resetToolFilters
       [data-hero-category]
     --------------------------------------------------------- */

  function initializeToolDirectory() {
    const grid = $("#toolGrid");
    const searchInput = $("#toolSearch");

    // Tool pages do not have this directory, so exit safely.
    if (!grid || !searchInput) return;

    const cards = $$("[data-tool-card]", grid);
    const filterButtons = $$(".otc-filter[data-filter]");
    const categoryCards = $$(".otc-category-card[data-filter]");
    const heroShortcuts = $$("[data-hero-category]");

    const clearButton = $("#clearToolSearch");
    const status = $("#toolSearchStatus");
    const totalCount = $("#toolCount");
    const noResults = $("#noToolsFound");
    const resetButton = $("#resetToolFilters");

    let activeCategory = "all";

    // Cache searchable text to keep repeated searches responsive.
    const searchableCards = cards.map((card) => ({
      card,
      category: card.dataset.category || "",
      text: normalizeText(
        [
          card.textContent,
          card.dataset.search || "",
          card.getAttribute("aria-label") || "",
        ].join(" ")
      ),
    }));

    function updateActiveButtons() {
      filterButtons.forEach((button) => {
        const active =
          (button.dataset.filter || "all") === activeCategory;

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      categoryCards.forEach((button) => {
        const active =
          button.dataset.filter === activeCategory &&
          activeCategory !== "all";

        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function updateCategoryCounts() {
      const counts = {
        all: searchableCards.length,
      };

      searchableCards.forEach(({ category }) => {
        counts[category] = (counts[category] || 0) + 1;
      });

      $$("[data-count]").forEach((element) => {
        const key = element.dataset.count || "all";
        element.textContent = String(counts[key] || 0);
      });

      if (totalCount) {
        totalCount.textContent = String(searchableCards.length);
      }
    }

    function updateDirectory() {
      const rawQuery = normalizeText(searchInput.value);

      const terms = rawQuery
        .split(/\s+/)
        .filter(Boolean);

      let visibleCount = 0;

      searchableCards.forEach(({ card, category, text }) => {
        const matchesCategory =
          activeCategory === "all" ||
          category === activeCategory;

        // Every search term must match somewhere in the card.
        const matchesSearch =
          terms.length === 0 ||
          terms.every((term) => text.includes(term));

        const visible = matchesCategory && matchesSearch;

        card.hidden = !visible;

        if (visible) visibleCount += 1;
      });

      if (noResults) {
        noResults.hidden = visibleCount > 0;
      }

      if (status) {
        if (rawQuery && activeCategory !== "all") {
          status.textContent =
            `Showing ${visibleCount} of ${cards.length} tools ` +
            "matching the search and category.";
        } else if (rawQuery) {
          status.textContent =
            `Showing ${visibleCount} of ${cards.length} tools matching your search.`;
        } else if (activeCategory !== "all") {
          const activeButton = filterButtons.find(
            (button) => button.dataset.filter === activeCategory
          );

          const categoryName = activeButton
            ? activeButton.textContent.trim().replace(/\s+\d+\s*$/, "")
            : "selected category";

          status.textContent =
            `Showing ${visibleCount} tools in ${categoryName}.`;
        } else {
          status.textContent =
            `Showing all ${cards.length} tools.`;
        }
      }

      updateActiveButtons();
    }

    function chooseCategory(category) {
      const exists =
        category === "all" ||
        filterButtons.some(
          (button) => button.dataset.filter === category
        );

      if (!exists) return;

      activeCategory = category;
      updateDirectory();
    }

    function resetDirectory({ focusSearch = false } = {}) {
      searchInput.value = "";
      activeCategory = "all";
      updateDirectory();

      if (focusSearch) {
        searchInput.focus();
      }
    }

    searchInput.addEventListener(
      "input",
      debounce(updateDirectory, 80)
    );

    if (clearButton) {
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        updateDirectory();
        searchInput.focus();
      });
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        chooseCategory(button.dataset.filter || "all");
      });
    });

    categoryCards.forEach((button) => {
      button.addEventListener("click", () => {
        chooseCategory(button.dataset.filter || "all");

        const directory = $("#tools");

        if (directory) {
          directory.scrollIntoView({
            behavior: window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches
              ? "auto"
              : "smooth",
            block: "start",
          });
        }
      });
    });

    heroShortcuts.forEach((shortcut) => {
      shortcut.addEventListener("click", () => {
        const category = shortcut.dataset.heroCategory;

        if (category) {
          chooseCategory(category);
        }
      });
    });

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        resetDirectory({ focusSearch: true });
      });
    }

    // Allow Escape to clear an active search.
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && searchInput.value) {
        searchInput.value = "";
        updateDirectory();
      }
    });

    updateCategoryCounts();
    updateDirectory();
  }


  /* =========================================================
     YOUTUBE METADATA GENERATOR
     Connects youtube-metadata-generator.html to Cloudflare AI.

     Expected HTML form:
       #ytmg-form
       #ytmg-topic
       #ytmg-content
       #ytmg-audience
       #ytmg-tone
       #ytmg-language
       #ytmg-purpose
       #ytmg-submit
       #ytmg-reset
       #ytmg-status

     Expected API response data:
       title_options
       description
       keywords
       tags
       call_to_action
       improvement_tips
     ========================================================= */

  function initializeYouTubeMetadataGenerator() {
    const form = $("#ytmg-form");

    // This function runs only on the YouTube generator page.
    if (!form) return;

    const API_URL =
      "https://metadata-ai-api.robin-roosevelt-pro.workers.dev";

    const topicInput = $("#ytmg-topic");
    const contentInput = $("#ytmg-content");
    const audienceInput = $("#ytmg-audience");
    const toneInput = $("#ytmg-tone");
    const languageInput = $("#ytmg-language");
    const purposeInput = $("#ytmg-purpose");

    const submitButton = $("#ytmg-submit");
    const resetButton = $("#ytmg-reset");
    const statusBox = $("#ytmg-status");
    const resultsBox = $("#ytmg-results");
    const copyAllButton = $("#ytmg-copy-all");

    const outputElements = {
      titles: $("#ytmg-titles"),
      description: $("#ytmg-description"),
      keywords: $("#ytmg-keywords"),
      tags: $("#ytmg-tags"),
      cta: $("#ytmg-cta"),
      tips: $("#ytmg-tips"),
    };

    const outputLabels = {
      titles: "Title ideas",
      description: "Video description",
      keywords: "Keyword ideas",
      tags: "Tags and hashtags",
      cta: "Call to action",
      tips: "Content improvement tips",
    };

    // Stop safely if the expected HTML has not been added.
    const requiredElements = [
      topicInput,
      contentInput,
      audienceInput,
      toneInput,
      languageInput,
      purposeInput,
      submitButton,
      resetButton,
      statusBox,
      resultsBox,
      copyAllButton,
      ...Object.values(outputElements),
    ];

    if (requiredElements.some((element) => !element)) {
      console.error(
        "YouTube Metadata Generator: Some expected HTML elements are missing."
      );
      return;
    }

    let latestResult = null;
    let activeController = null;

    /* ---------- Status messages ---------- */

    function updateGeneratorStatus(message, type = "info") {
      statusBox.textContent = String(message ?? "");
      statusBox.dataset.type = type;
      statusBox.setAttribute("role", "status");
      statusBox.setAttribute("aria-live", "polite");
    }

    /* ---------- Safely convert API values to text ---------- */

    function resultToText(value) {
      if (value === null || value === undefined) {
        return "";
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => resultToText(item))
          .filter(Boolean)
          .join("\n");
      }

      if (typeof value === "object") {
        if (typeof value.text === "string") {
          return value.text.trim();
        }

        return JSON.stringify(value, null, 2);
      }

      return String(value).trim();
    }

    /* ---------- Convert API fields into lists ---------- */

    function resultToList(value, splitCommas = false) {
      if (Array.isArray(value)) {
        return value
          .map((item) => resultToText(item))
          .filter(Boolean);
      }

      const text = resultToText(value);

      if (!text) return [];

      // Some APIs return a JSON array encoded as a string.
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => resultToText(item))
            .filter(Boolean);
        }
      } catch (error) {
        // Ordinary text is also an acceptable response.
      }

      let items = text
        .split(/\r?\n/)
        .map((item) =>
          item
            .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
            .trim()
        )
        .filter(Boolean);

      // Keywords and tags are sometimes returned on one comma-separated line.
      if (items.length === 1 && splitCommas) {
        items = items[0]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return items;
    }

    /* ---------- Safe result rendering ---------- */

    function showResultText(element, value, fallback) {
      element.replaceChildren();

      const paragraph = document.createElement("p");
      paragraph.className = "ytmg-result-text";
      paragraph.textContent = resultToText(value) || fallback;

      element.appendChild(paragraph);
    }

    function showResultList(
      element,
      value,
      fallback,
      splitCommas = false
    ) {
      element.replaceChildren();

      const items = resultToList(value, splitCommas);

      if (items.length === 0) {
        const paragraph = document.createElement("p");
        paragraph.className = "ytmg-result-text";
        paragraph.textContent = fallback;
        element.appendChild(paragraph);
        return;
      }

      // Use an ordered list for title ideas and unordered lists elsewhere.
      const list = document.createElement(
        element.id === "ytmg-titles" ? "ol" : "ul"
      );

      items.forEach((item) => {
        const listItem = document.createElement("li");

        // textContent prevents generated content from being interpreted as HTML.
        listItem.textContent = item;
        list.appendChild(listItem);
      });

      element.appendChild(list);
    }

    /* ---------- Validate the API response ---------- */

    function normalizeAPIResponse(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error(
          "The API returned an unexpected response."
        );
      }

      if (payload.success === false || payload.error) {
        throw new Error(
          resultToText(payload.error || payload.message) ||
          "The AI service could not generate metadata."
        );
      }

      const data =
        payload.data ||
        payload.result ||
        payload;

      if (!data || typeof data !== "object") {
        throw new Error(
          "The API did not return metadata. Please try again."
        );
      }

      const expectedFields = [
        "title_options",
        "description",
        "keywords",
        "tags",
        "call_to_action",
        "improvement_tips",
      ];

      const hasContent = expectedFields.some((key) => {
        return resultToText(data[key]).length > 0;
      });

      if (!hasContent) {
        throw new Error(
          "The AI returned an empty result. Try a more specific video topic."
        );
      }

      return data;
    }

    /* ---------- Display the generated results ---------- */

    function renderGeneratorResults(data) {
      showResultList(
        outputElements.titles,
        data.title_options,
        "No title suggestions were returned."
      );

      showResultText(
        outputElements.description,
        data.description,
        "No description was returned."
      );

      showResultList(
        outputElements.keywords,
        data.keywords,
        "No keyword suggestions were returned.",
        true
      );

      showResultList(
        outputElements.tags,
        data.tags,
        "No tags were returned.",
        true
      );

      showResultList(
        outputElements.cta,
        data.call_to_action,
        "No call to action was returned."
      );

      showResultList(
        outputElements.tips,
        data.improvement_tips,
        "No improvement tips were returned."
      );

      latestResult = data;
      resultsBox.hidden = false;
    }

    /* ---------- Prepare result text for copying ---------- */

    function getSectionText(sectionKey) {
      if (!latestResult) return "";

      const responseKeys = {
        titles: "title_options",
        description: "description",
        keywords: "keywords",
        tags: "tags",
        cta: "call_to_action",
        tips: "improvement_tips",
      };

      const responseKey = responseKeys[sectionKey];

      if (!responseKey) return "";

      return resultToText(latestResult[responseKey]);
    }

    function getAllResultsText() {
      if (!latestResult) return "";

      return Object.keys(outputLabels)
        .map((key) => {
          const value = getSectionText(key);

          return value
            ? outputLabels[key] + "\n" + value
            : "";
        })
        .filter(Boolean)
        .join("\n\n");
    }

    async function copyGeneratorResult(text) {
      if (!String(text ?? "").trim()) {
        updateGeneratorStatus(
          "There is no generated content to copy yet.",
          "error"
        );
        return;
      }

      try {
        await copyText(text);

        updateGeneratorStatus(
          "Copied to clipboard successfully.",
          "success"
        );
      } catch (error) {
        updateGeneratorStatus(
          error.message ||
            "Copy failed. Please select the result and copy it manually.",
          "error"
        );
      }
    }

    /* ---------- Generate metadata through the Cloudflare API ---------- */

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      // Cancel a previous request if a new one is started.
      if (activeController) {
        activeController.abort();
        activeController = null;
      }

      const topic = topicInput.value.trim();
      const content = contentInput.value.trim();
      const audience = audienceInput.value.trim();
      const tone = toneInput.value;
      const language = languageInput.value;
      const purpose = purposeInput.value;

      if (!topic) {
        updateGeneratorStatus(
          "Please enter a video topic before generating metadata.",
          "error"
        );

        topicInput.focus();
        return;
      }

      if (topic.length > 200) {
        updateGeneratorStatus(
          "Please keep the video topic to 200 characters or fewer.",
          "error"
        );

        topicInput.focus();
        return;
      }

      if (content.length > 12000) {
        updateGeneratorStatus(
          "Please shorten the video summary or transcript to 12,000 characters or fewer.",
          "error"
        );

        contentInput.focus();
        return;
      }

      /*
       * These field names match the existing Cloudflare API Worker:
       * platform, topic, content, audience, tone and language.
       */
      const requestBody = {
        platform: "YouTube",
        topic,
        content: [
          content,
          "Main video goal: " + purpose,
        ]
          .filter(Boolean)
          .join("\n\n"),
        audience: audience || "General YouTube audience",
        tone,
        language,
      };

      const controller = new AbortController();
      activeController = controller;

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 90000);

      submitButton.disabled = true;
      submitButton.textContent = "Generating...";

      resultsBox.hidden = true;

      updateGeneratorStatus(
        "Connecting to the AI service. Your metadata is being generated...",
        "info"
      );

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        let payload;

        try {
          payload = await response.json();
        } catch (error) {
          throw new Error(
            "The API did not return valid JSON. Check your Cloudflare Worker response."
          );
        }

        if (!response.ok) {
          const apiMessage = resultToText(
            payload.error || payload.message
          );

          throw new Error(
            apiMessage ||
              "The API request failed with HTTP " +
                response.status +
                "."
          );
        }

        const data = normalizeAPIResponse(payload);

        // Ignore responses from a request that is no longer active.
        if (activeController !== controller) return;

        renderGeneratorResults(data);

        updateGeneratorStatus(
          "Metadata generated successfully. Review the suggestions before publishing.",
          "success"
        );

        resultsBox.scrollIntoView({
          behavior: window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches
            ? "auto"
            : "smooth",
          block: "start",
        });
      } catch (error) {
        // Ignore an older request after it has been cancelled.
        if (activeController !== controller) return;

        if (error.name === "AbortError") {
          updateGeneratorStatus(
            "The request timed out or was cancelled. Please try again. If this persists, check the API Worker logs.",
            "error"
          );
        } else {
          const originalMessage =
            error.message ||
            "An unexpected error occurred.";

          updateGeneratorStatus(
            "Generation failed: " +
              originalMessage +
              " Check that the API Worker is deployed, the AI binding is configured, and its CORS settings allow this website.",
            "error"
          );

          console.error(
            "YouTube Metadata Generator error:",
            error
          );
        }
      } finally {
        window.clearTimeout(timeoutId);

        // Only the currently active request may update the button state.
        if (activeController === controller) {
          activeController = null;
          submitButton.disabled = false;
          submitButton.textContent =
            "Generate YouTube Metadata";
        }
      }
    });

    /* ---------- Individual copy buttons ---------- */

    $$("[data-copy]", resultsBox).forEach((button) => {
      button.addEventListener("click", async () => {
        const sectionKey = button.dataset.copy;
        const text = getSectionText(sectionKey);

        await copyGeneratorResult(text);
      });
    });

    /* ---------- Copy every generated section ---------- */

    copyAllButton.addEventListener("click", async () => {
      await copyGeneratorResult(getAllResultsText());
    });

    /* ---------- Clear and reset the generator ---------- */

    form.addEventListener("reset", () => {
      if (activeController) {
        activeController.abort();
        activeController = null;
      }

      latestResult = null;
      resultsBox.hidden = true;

      Object.values(outputElements).forEach((element) => {
        element.replaceChildren();
      });

      submitButton.disabled = false;
      submitButton.textContent =
        "Generate YouTube Metadata";

      updateGeneratorStatus(
        "Form cleared. Enter a new video topic to begin.",
        "info"
      );
    });

    // The reset button's default HTML reset behavior handles the form fields.
    resetButton.addEventListener("click", () => {
      // No manual field changes are needed here.
    });
  }


  /* ---------------------------------------------------------
     Optional generic copy buttons

     Example:
     <button data-copy-target="#generatedText"
             data-copy-status="#copyStatus">
       Copy
     </button>

     Target can be an input, textarea, or ordinary text element.
     --------------------------------------------------------- */

  function initializeCopyButtons() {
    $$("[data-copy-target]").forEach((button) => {
      if (button.dataset.otcCopyBound === "true") return;

      button.dataset.otcCopyBound = "true";

      button.addEventListener("click", async () => {
        const selector = button.dataset.copyTarget;
        let target = null;

        try {
          target = $(selector);
        } catch (error) {
          target = null;
        }

        const statusTarget = button.dataset.copyStatus
          ? $(button.dataset.copyStatus)
          : null;

        if (!target) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              "The copy target could not be found.",
              "error"
            );
          }

          return;
        }

        const text =
          "value" in target
            ? target.value
            : target.innerText || target.textContent || "";

        const oldLabel = button.textContent;

        try {
          await copyText(text);

          if (statusTarget) {
            setStatus(
              statusTarget,
              "Copied successfully.",
              "success"
            );
          } else {
            button.textContent = "Copied!";

            window.setTimeout(() => {
              button.textContent = oldLabel;
            }, 1400);
          }
        } catch (error) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              error.message || "Copy failed.",
              "error"
            );
          }
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Optional generic download buttons

     Example:
     <button data-download-target="#csvOutput"
             data-download-filename="data.csv"
             data-download-mime="text/csv;charset=utf-8">
       Download CSV
     </button>
     --------------------------------------------------------- */

  function initializeDownloadButtons() {
    $$("[data-download-target]").forEach((button) => {
      if (button.dataset.otcDownloadBound === "true") return;

      button.dataset.otcDownloadBound = "true";

      button.addEventListener("click", () => {
        let target = null;

        try {
          target = $(button.dataset.downloadTarget);
        } catch (error) {
          target = null;
        }

        if (!target) return;

        const text =
          "value" in target
            ? target.value
            : target.innerText || target.textContent || "";

        const filename =
          button.dataset.downloadFilename || "download.txt";

        const mimeType =
          button.dataset.downloadMime ||
          "text/plain;charset=utf-8";

        const statusTarget = button.dataset.downloadStatus
          ? $(button.dataset.downloadStatus)
          : null;

        try {
          downloadText(text, filename, mimeType);

          if (statusTarget) {
            setStatus(
              statusTarget,
              "Download started.",
              "success"
            );
          }
        } catch (error) {
          if (statusTarget) {
            setStatus(
              statusTarget,
              error.message || "Download failed.",
              "error"
            );
          }
        }
      });
    });
  }


  /* ---------------------------------------------------------
     Public helpers for tool-page scripts

     Example:
     OTC.copyText("Text to copy");
     OTC.downloadText("Hello", "example.txt");
     OTC.formatBytes(1500000);
     --------------------------------------------------------- */

  window.OTC = Object.freeze({
    $,
    $$,
    normalizeText,
    clamp,
    debounce,
    formatNumber,
    formatBytes,
    formatBinaryBytes,
    copyText,
    downloadBlob,
    downloadText,
    setText,
    setStatus,
  });


  /* ---------------------------------------------------------
     Initialize website behavior
     --------------------------------------------------------- */

  function initializeWebsite() {
    initializeYear();
    initializeNavigation();
    initializeToolDirectory();
    initializeCopyButtons();
    initializeDownloadButtons();
    initializeYouTubeMetadataGenerator();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeWebsite,
      { once: true }
    );
  } else {
    initializeWebsite();
  }
})();
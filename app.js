(function () {
  const songs = Array.isArray(window.FLYLIST_SONGS) ? window.FLYLIST_SONGS : [];
  const categories = ["보카로", "버츄얼 아티스트", "애니메이션", "J-POP"];
  const categoryLabels = ["전체", "즐겨찾기", ...categories];
  const state = {
    query: "",
    category: "전체",
    sort: "default",
    favorites: loadFavorites()
  };

  const els = {
    searchInput: document.querySelector("#searchInput"),
    clearSearch: document.querySelector("#clearSearch"),
    stats: document.querySelector("#stats"),
    categoryTabs: document.querySelector("#categoryTabs"),
    sortSelect: document.querySelector("#sortSelect"),
    resultSummary: document.querySelector("#resultSummary"),
    songList: document.querySelector("#songList"),
    emptyState: document.querySelector("#emptyState"),
    toast: document.querySelector("#toast")
  };

  const collator = new Intl.Collator(["ko", "ja", "en"], {
    numeric: true,
    sensitivity: "base"
  });

  init();

  function init() {
    renderStats();
    renderTabs();
    bindEvents();
    render();
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", () => {
      state.query = normalize(els.searchInput.value);
      render();
    });

    els.clearSearch.addEventListener("click", () => {
      els.searchInput.value = "";
      state.query = "";
      els.searchInput.focus();
      render();
    });

    els.sortSelect.addEventListener("change", () => {
      state.sort = els.sortSelect.value;
      render();
    });

    els.categoryTabs.addEventListener("click", event => {
      const tab = event.target.closest(".tab");
      if (!tab) return;
      state.category = tab.dataset.category;
      renderTabs();
      render();
    });

    els.songList.addEventListener("click", event => {
      const favoriteButton = event.target.closest(".favorite");
      if (favoriteButton) {
        toggleFavorite(favoriteButton.dataset.number);
        render();
        return;
      }

      const numberButton = event.target.closest(".song-number");
      if (numberButton) copyNumber(numberButton.dataset.number);
    });
  }

  function renderStats() {
    const counts = countByCategory(songs);
    els.stats.replaceChildren(
      makeStat("곡", songs.length),
      ...categories.map(category => makeStat(category, counts[category] || 0))
    );
  }

  function makeStat(label, value) {
    const item = document.createElement("div");
    item.className = "stat";
    item.innerHTML = `<b>${value}</b>${escapeHtml(label)}`;
    return item;
  }

  function renderTabs() {
    els.categoryTabs.replaceChildren(...categoryLabels.map(label => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.dataset.category = label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(state.category === label));
      button.textContent = label;
      return button;
    }));
  }

  function render() {
    const filtered = getFilteredSongs();
    els.resultSummary.textContent = `${filtered.length}곡`;
    els.emptyState.hidden = filtered.length > 0;
    els.songList.hidden = filtered.length === 0;
    els.songList.replaceChildren(...buildSections(filtered));
  }

  function getFilteredSongs() {
    const filtered = songs.filter(song => {
      const categoryMatched = state.category === "전체" || state.category === "즐겨찾기" || song.category === state.category;
      const favoriteMatched = state.category !== "즐겨찾기" || state.favorites.has(song.number);
      if (!categoryMatched) return false;
      if (!favoriteMatched) return false;
      if (!state.query) return true;
      return getSearchText(song).includes(state.query);
    });

    if (state.sort === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (state.sort === "number") return Number(a.number) - Number(b.number);
      if (state.sort === "artist") return collator.compare(a.artist, b.artist) || collator.compare(a.titleKo, b.titleKo);
      return collator.compare(a.titleKo, b.titleKo) || Number(a.number) - Number(b.number);
    });
  }

  function buildSections(items) {
    const sections = [];
    const sectionCategories = state.category === "전체" || state.category === "즐겨찾기" ? categories : [state.category];

    sectionCategories.forEach(category => {
      const categorySongs = items.filter(song => song.category === category);
      if (!categorySongs.length) return;

      const section = document.createElement("section");
      section.className = "song-section";
      section.dataset.accent = category;

      const title = document.createElement("h2");
      title.className = "section-title";
      title.innerHTML = `${escapeHtml(category)} <small>${categorySongs.length}</small>`;
      section.append(title);

      const grouped = groupSongs(categorySongs);
      grouped.forEach(group => {
        if (group.name) {
          const groupTitle = document.createElement("h3");
          groupTitle.className = "group-title";
          groupTitle.innerHTML = `${escapeHtml(group.name)} <small>${group.items.length}</small>`;
          section.append(groupTitle);
        }

        const cards = document.createElement("div");
        cards.className = "cards";
        cards.append(...group.items.map(makeSongCard));
        section.append(cards);
      });

      sections.push(section);
    });

    return sections;
  }

  function groupSongs(items) {
    const hasGroups = items.some(song => song.group);
    if (!hasGroups || state.query || state.sort !== "default") {
      return [{ name: "", items }];
    }

    const groups = [];
    const byName = new Map();
    items.forEach(song => {
      const name = song.group || "";
      if (!byName.has(name)) {
        byName.set(name, { name, items: [] });
        groups.push(byName.get(name));
      }
      byName.get(name).items.push(song);
    });
    return groups;
  }

  function makeSongCard(song) {
    const card = document.createElement("article");
    card.className = "song-card";
    card.dataset.accent = song.category;

    const number = document.createElement("button");
    number.type = "button";
    number.className = "song-number";
    number.dataset.number = song.number;
    number.setAttribute("aria-label", `${song.number} 복사`);
    number.textContent = song.number;

    const body = document.createElement("div");
    body.className = "song-body";
    body.innerHTML = `
      <div class="song-title">${escapeHtml(song.titleKo)}</div>
      <div class="song-original">${escapeHtml(song.titleOriginal)}</div>
      <div class="song-artist">${escapeHtml(song.artist)}</div>
      <div class="song-tag">${escapeHtml(song.tag)}</div>
    `;

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite";
    favorite.dataset.number = song.number;
    favorite.setAttribute("aria-label", `${song.titleKo} 즐겨찾기`);
    favorite.setAttribute("aria-pressed", String(state.favorites.has(song.number)));
    favorite.textContent = state.favorites.has(song.number) ? "★" : "☆";

    card.append(number, body, favorite);
    return card;
  }

  function countByCategory(items) {
    return items.reduce((acc, song) => {
      acc[song.category] = (acc[song.category] || 0) + 1;
      return acc;
    }, {});
  }

  function toggleFavorite(number) {
    if (state.favorites.has(number)) {
      state.favorites.delete(number);
      showToast("즐겨찾기 해제");
    } else {
      state.favorites.add(number);
      showToast("즐겨찾기 추가");
    }
    saveFavorites(state.favorites);
  }

  async function copyNumber(number) {
    try {
      await navigator.clipboard.writeText(number);
      showToast(`${number} 복사됨`);
    } catch {
      showToast(number);
    }
  }

  function loadFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem("flylist:favorites") || "[]"));
    } catch {
      return new Set();
    }
  }

  function saveFavorites(favorites) {
    try {
      localStorage.setItem("flylist:favorites", JSON.stringify([...favorites]));
    } catch {
      // Storage can be unavailable in some private browsing modes.
    }
  }

  function getSearchText(song) {
    return normalize([
      song.number,
      song.titleKo,
      song.titleOriginal,
      song.artist,
      song.tag,
      song.category,
      song.group
    ].join(" "));
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s\u3000·・.\-_/／]+/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 1300);
  }
})();

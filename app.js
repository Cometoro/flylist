(function () {
  const songs = Array.isArray(window.FLYLIST_SONGS) ? window.FLYLIST_SONGS : [];
  const categories = ["보카로", "버츄얼 아티스트", "애니메이션", "J-POP"];
  const categoryLabels = ["전체", "업데이트", "즐겨찾기", ...categories];
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

  const aliasMap = {
    "164": "이치로쿠욘",
    "40mP": "40미터P",
    "BUMP OF CHICKEN": "범프 오브 치킨",
    "DECO*27": "데코니나",
    "EasyPop": "이지팝",
    "Kanaria": "카나리아",
    "Orangestar": "오렌지스타",
    "TAK": "탁",
    "doriko": "도리코",
    "kemu": "케무",
    "wowaka": "와와카",
    "いよわ": "이요와",
    "すりぃ": "스리",
    "てにをは": "테니오하",
    "とあ": "토아",
    "まらしぃ": "마라시",
    "みきとP": "미키토P",
    "ナユタン星人": "나유탄 성인",
    "バルーン": "벌룬",
    "巡音ルカ": "메구리네 루카",
    "椎名もた": "시이나 모타",
    "蝶々P": "쵸쵸P",
    "鏡音リン": "카가미네 린",
    "鏡音レン": "카가미네 렌",
    "Kobo Kanaeru": "코보 카나에루",
    "星街すいせい": "호시마치 스이세이",
    "トゲナシトゲアリ": "토게나시 토게아리",
    "Ado": "아도",
    "KANA-BOON": "카나분",
    "LiSA": "리사",
    "Mrs. GREEN APPLE": "미세스 그린 애플",
    "MyGO!!!!!": "마이고",
    "RADWIMPS": "래드윔프스",
    "SPYAIR": "스파이에어",
    "TK from 凛として時雨": "TK from 린토시테시구레",
    "YOASOBI": "요아소비",
    "supercell": "슈퍼셀",
    "いきものがかり": "이키모노가카리",
    "なとり": "나토리",
    "アイナ・ジ・エンド": "아이나 디 엔드",
    "キタニタツヤ": "키타니 타츠야",
    "ヒグチアイ": "히구치 아이",
    "優里": "유우리",
    "和田光司": "와다 코지",
    "小野正利": "오노 마사토시",
    "高橋洋子": "타카하시 요코",
    "Official髭男dism": "오피셜히게단디즘",
    "King Gnu": "킹누",
    "米津玄師": "요네즈 켄시",
    "ヨルシカ": "요루시카",
    "Vaundy": "바운디",
    "back number": "백 넘버",
    "あいみょん": "아이묭",
    "Creepy Nuts": "크리피 넛츠",
    "Saucy Dog": "사우시 도그",
    "UNISON SQUARE GARDEN": "유니즌 스퀘어 가든",
    "松田聖子": "마츠다 세이코",
    "amazarashi": "아마자라시",
    "tuki.": "츠키",
    "SEKAI NO OWARI": "세카이노오와리",
    "涼宮ハルヒ / 平野綾": "스즈미야 하루히 / 히라노 아야",
    "チョーキューメイ": "초큐메이",
    "X-JAPAN": "엑스재팬",
    "Leina": "레이나",
    "椎名林檎": "시이나 링고",
    "Novelbright": "노벨브라이트",
    "星野源": "호시노 겐",
    "緑黄色社会": "녹황색사회",
    "DISH//": "디쉬",
    "yama": "야마",
    "ロクデナシ": "로쿠데나시",
    "尾崎豊": "오자키 유타카",
    "『ユイカ』": "유이카",
    "Tani Yuuki": "타니 유우키",
    "シド": "시드",
    "Hump Back": "험프 백",
    "藤井風": "후지이 카제",
    "imase": "이마세",
    "CUTIE STREET": "큐티 스트리트",
    "ずっと真夜中でいいのに。": "즛토마요"
  };

  const updateLabels = {
    new: "신규",
    number: "번호 변경",
    edit: "수정"
  };

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
    els.emptyState.textContent = state.category === "업데이트" ? "업데이트 목록이 없습니다." : "검색 결과가 없습니다.";
    els.emptyState.hidden = filtered.length > 0;
    els.songList.hidden = filtered.length === 0;
    els.songList.replaceChildren(...buildSections(filtered));
  }

  function getFilteredSongs() {
    const filtered = songs.filter(song => {
      const categoryMatched = state.category === "전체" || state.category === "업데이트" || state.category === "즐겨찾기" || song.category === state.category;
      const updateMatched = state.category !== "업데이트" || isUpdated(song);
      const favoriteMatched = state.category !== "즐겨찾기" || state.favorites.has(song.number);
      if (!categoryMatched) return false;
      if (!updateMatched) return false;
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
    const sectionCategories = state.category === "전체" || state.category === "업데이트" || state.category === "즐겨찾기" ? categories : [state.category];

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
    `;
    getVisibleChips(song).forEach(chip => {
      const chipEl = document.createElement("div");
      chipEl.className = `song-tag${chip.type === "update" ? " is-update" : ""}`;
      chipEl.textContent = chip.label;
      body.append(chipEl);
    });

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

  function isUpdated(song) {
    return Boolean(song.updateType || song.updatedAt || song.updateNote);
  }

  function getVisibleChips(song) {
    const chips = [];
    const alias = getAlias(song);
    if (alias && shouldShowAlias(song, alias)) {
      chips.push({ type: "alias", label: alias });
    }

    if (isUpdated(song)) {
      const label = updateLabels[song.updateType] || "업데이트";
      chips.push({ type: "update", label });
    }

    return chips;
  }

  function getAlias(song) {
    const candidates = getAliasCandidates(song);
    return candidates.find(Boolean) || "";
  }

  function getAliasCandidates(song) {
    const artistParts = String(song.artist || "")
      .split(/\s+(?:feat\.|from|×|\+|&)\s+|,\s*/i)
      .map(part => part.trim())
      .filter(Boolean);

    return [
      aliasMap[song.artist],
      aliasMap[song.tag],
      aliasMap[song.group],
      ...artistParts.map(part => aliasMap[part]),
      song.tag
    ].filter(Boolean);
  }

  function shouldShowAlias(song, alias) {
    const normalizedAlias = normalize(alias);
    return normalizedAlias &&
      normalizedAlias !== normalize(song.artist);
  }

  function getSearchText(song) {
    return normalize([
      song.number,
      song.titleKo,
      song.titleOriginal,
      song.artist,
      song.tag,
      ...getAliasCandidates(song),
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

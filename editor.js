(() => {
  "use strict";

  const categories = ["보카로", "버츄얼 아티스트", "애니메이션", "J-POP"];
  const requiredFields = ["number", "titleKo", "titleOriginal", "artist", "tag", "category"];
  const editableFields = [
    "number",
    "titleKo",
    "titleOriginal",
    "artist",
    "tag",
    "tagKo",
    "category",
    "group",
    "updateType",
    "updatedAt",
    "updateNote"
  ];
  const draftKey = "flylist:editor-draft-v1";

  const clone = value => JSON.parse(JSON.stringify(value));
  const sourceData = Array.isArray(window.FLYLIST_SONGS) ? clone(window.FLYLIST_SONGS) : [];

  let baselineSongs = sourceData.map(normalizeSong);
  let baselineSignature = signature(baselineSongs);
  let records = createRecords(baselineSongs);
  let deletedRecords = [];
  let selectedId = null;
  let formTags = [];
  let newRecordSequence = 0;
  let lastWrittenSignature = baselineSignature;
  let toastTimer = 0;

  const els = {
    totalCount: document.querySelector("#totalCount"),
    changeCount: document.querySelector("#changeCount"),
    resultCount: document.querySelector("#resultCount"),
    songRows: document.querySelector("#songRows"),
    songSearch: document.querySelector("#songSearch"),
    categoryFilter: document.querySelector("#categoryFilter"),
    changeFilter: document.querySelector("#changeFilter"),
    emptySelection: document.querySelector("#emptySelection"),
    songForm: document.querySelector("#songForm"),
    formTitle: document.querySelector("#formTitle"),
    recordState: document.querySelector("#recordState"),
    numberPreview: document.querySelector("#numberPreview"),
    validationMessage: document.querySelector("#validationMessage"),
    previewNumber: document.querySelector("#previewNumber"),
    previewTitle: document.querySelector("#previewTitle"),
    previewOriginal: document.querySelector("#previewOriginal"),
    previewArtist: document.querySelector("#previewArtist"),
    previewCategory: document.querySelector("#previewCategory"),
    extraTagInput: document.querySelector("#extraTagInput"),
    addExtraTag: document.querySelector("#addExtraTag"),
    extraTagList: document.querySelector("#extraTagList"),
    newSong: document.querySelector("#newSong"),
    importFile: document.querySelector("#importFile"),
    resetAll: document.querySelector("#resetAll"),
    downloadData: document.querySelector("#downloadData"),
    saveData: document.querySelector("#saveData"),
    revertSong: document.querySelector("#revertSong"),
    duplicateSong: document.querySelector("#duplicateSong"),
    deleteSong: document.querySelector("#deleteSong"),
    toast: document.querySelector("#toast")
  };

  init();

  function init() {
    const restored = restoreDraft();
    bindEvents();
    renderAll();

    if (restored) {
      const changed = records.find(record => getRecordState(record) !== "original");
      if (changed) selectRecord(changed.id);
      showToast("임시 편집본을 복구했습니다.");
    }
  }

  function bindEvents() {
    els.songSearch.addEventListener("input", renderSongRows);
    els.categoryFilter.addEventListener("change", renderSongRows);
    els.changeFilter.addEventListener("change", renderSongRows);

    els.songRows.addEventListener("click", event => {
      const row = event.target.closest("[data-record-id]");
      if (row) selectRecord(row.dataset.recordId);
    });

    els.songForm.addEventListener("input", () => {
      hideValidation();
      updatePreviewFromForm();
    });

    els.songForm.addEventListener("submit", event => {
      event.preventDefault();
      applyFormChanges();
    });

    els.addExtraTag.addEventListener("click", addFormTag);
    els.extraTagInput.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addFormTag();
    });
    els.extraTagList.addEventListener("click", event => {
      const remove = event.target.closest("[data-tag-index]");
      if (!remove) return;
      formTags.splice(Number(remove.dataset.tagIndex), 1);
      renderFormTags();
    });

    els.newSong.addEventListener("click", addNewSong);
    els.duplicateSong.addEventListener("click", duplicateSelectedSong);
    els.deleteSong.addEventListener("click", deleteSelectedSong);
    els.revertSong.addEventListener("click", revertSelectedSong);
    els.resetAll.addEventListener("click", resetAllSongs);
    els.downloadData.addEventListener("click", downloadDataFile);
    els.saveData.addEventListener("click", saveDataFile);
    els.importFile.addEventListener("change", importDataFile);

    window.addEventListener("beforeunload", event => {
      if (!hasPendingFormChanges() && signature(getCurrentSongs()) === lastWrittenSignature) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function createRecords(songs) {
    return songs.map((song, index) => ({
      id: `source-${index}`,
      originalData: clone(song),
      data: clone(song),
      isNew: false
    }));
  }

  function normalizeSong(raw = {}) {
    const song = {
      number: clean(raw.number),
      titleKo: clean(raw.titleKo),
      titleOriginal: clean(raw.titleOriginal),
      artist: clean(raw.artist),
      tag: clean(raw.tag),
      category: categories.includes(raw.category) ? raw.category : "J-POP",
      group: clean(raw.group)
    };

    const tagKo = clean(raw.tagKo);
    if (tagKo) song.tagKo = tagKo;

    const tags = normalizeTags(raw.tags);
    if (tags.length) song.tags = tags;

    const alsoCategories = normalizeCategories(raw.alsoCategories)
      .filter(category => category !== song.category);
    if (alsoCategories.length) song.alsoCategories = alsoCategories;

    const jpopGroup = clean(raw.jpopGroup);
    if (jpopGroup) song.jpopGroup = jpopGroup;

    ["updateType", "updatedAt", "updateNote"].forEach(key => {
      const value = clean(raw[key]);
      if (value) song[key] = value;
    });

    return song;
  }

  function normalizeTags(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    const seen = new Set();
    return values
      .map(clean)
      .filter(Boolean)
      .filter(tag => {
        const key = tag.toLocaleLowerCase("ko");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function normalizeCategories(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(values.map(clean).filter(category => categories.includes(category)))];
  }

  function clean(value) {
    return value === undefined || value === null ? "" : String(value).trim();
  }

  function signature(value) {
    return JSON.stringify(value);
  }

  function getCurrentSongs() {
    return records.map(record => normalizeSong(record.data));
  }

  function getRecordState(record) {
    if (record.isNew) return "new";
    return signature(record.data) === signature(record.originalData) ? "original" : "modified";
  }

  function getChangeCount() {
    const changedRecords = records.filter(record => getRecordState(record) !== "original").length;
    return changedRecords + deletedRecords.length;
  }

  function getFilteredRecords() {
    const query = els.songSearch.value.trim().toLocaleLowerCase("ko");
    const category = els.categoryFilter.value;
    const change = els.changeFilter.value;

    return records.filter(record => {
      const song = record.data;
      const haystack = [
        ...editableFields.map(key => song[key] || ""),
        ...(song.tags || []),
        ...(song.alsoCategories || []),
        song.jpopGroup || ""
      ].join(" ").toLocaleLowerCase("ko");
      const state = getRecordState(record);
      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = category === "전체"
        || song.category === category
        || (song.alsoCategories || []).includes(category);
      const matchesChange = change === "전체"
        || (change === "변경" && state === "modified")
        || (change === "신규" && state === "new");
      return matchesQuery && matchesCategory && matchesChange;
    });
  }

  function renderAll() {
    els.totalCount.textContent = records.length;
    els.changeCount.textContent = getChangeCount();
    renderSongRows();
    renderSelectedRecord();
  }

  function renderSongRows() {
    const filtered = getFilteredRecords();
    const fragment = document.createDocumentFragment();
    els.resultCount.textContent = filtered.length;

    filtered.forEach(record => {
      const song = record.data;
      const state = getRecordState(record);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `song-row${state === "original" ? "" : ` is-${state}`}`;
      row.dataset.recordId = record.id;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(record.id === selectedId));

      const number = document.createElement("span");
      number.className = "song-row-number";
      number.textContent = song.number || "-----";

      const copy = document.createElement("span");
      copy.className = "song-row-copy";
      const title = document.createElement("strong");
      title.textContent = song.titleKo || "제목 없음";
      const artist = document.createElement("span");
      artist.textContent = song.artist || "아티스트 없음";
      copy.append(title, artist);

      const marker = document.createElement("span");
      marker.className = "row-state";
      marker.setAttribute("aria-label", state === "new" ? "신규" : state === "modified" ? "변경됨" : "원본");

      row.append(number, copy, marker);
      fragment.append(row);
    });

    els.songRows.replaceChildren(fragment);
  }

  function selectRecord(id) {
    if (id !== selectedId && !flushPendingForm()) return;
    selectedId = id;
    renderSongRows();
    renderSelectedRecord();
  }

  function getSelectedRecord() {
    return records.find(record => record.id === selectedId) || null;
  }

  function renderSelectedRecord() {
    const record = getSelectedRecord();
    els.emptySelection.hidden = Boolean(record);
    els.songForm.hidden = !record;
    hideValidation();

    if (!record) return;

    editableFields.forEach(key => {
      const control = els.songForm.elements.namedItem(key);
      if (control) control.value = record.data[key] || "";
    });
    els.extraTagInput.value = "";
    formTags = normalizeTags(record.data.tags);
    renderFormTags();

    const state = getRecordState(record);
    els.recordState.textContent = state === "new" ? "NEW SONG" : state === "modified" ? "MODIFIED" : "SONG";
    els.formTitle.textContent = record.data.titleKo || "새 곡";
    els.numberPreview.textContent = `TJ ${record.data.number || "-----"}`;
    els.revertSong.textContent = record.isNew ? "새 곡 취소" : "이 곡 복원";
    updatePreviewFromForm();
  }

  function readFormData() {
    const values = {};
    editableFields.forEach(key => {
      const control = els.songForm.elements.namedItem(key);
      values[key] = clean(control ? control.value : "");
    });
    values.tags = [...formTags];
    values.alsoCategories = [...(getSelectedRecord()?.data.alsoCategories || [])];
    values.jpopGroup = getSelectedRecord()?.data.jpopGroup || "";
    return normalizeSong(values);
  }

  function addFormTag() {
    const tag = clean(els.extraTagInput.value);
    if (!tag) return;
    if (!formTags.some(item => item.toLocaleLowerCase("ko") === tag.toLocaleLowerCase("ko"))) {
      formTags.push(tag);
    }
    els.extraTagInput.value = "";
    renderFormTags();
    els.extraTagInput.focus();
  }

  function renderFormTags() {
    const fragment = document.createDocumentFragment();
    formTags.forEach((tag, index) => {
      const chip = document.createElement("span");
      chip.className = "editor-tag";
      chip.textContent = tag;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.tagIndex = index;
      remove.setAttribute("aria-label", `${tag} 태그 삭제`);
      remove.textContent = "×";
      chip.append(remove);
      fragment.append(chip);
    });
    els.extraTagList.replaceChildren(fragment);
  }

  function updatePreviewFromForm() {
    const form = els.songForm;
    const value = name => clean(form.elements.namedItem(name)?.value);
    const number = value("number");
    const title = value("titleKo");
    const original = value("titleOriginal");
    const artist = value("artist");
    const category = value("category");

    els.numberPreview.textContent = `TJ ${number || "-----"}`;
    els.previewNumber.textContent = number || "-----";
    els.previewTitle.textContent = title || "제목";
    els.previewOriginal.textContent = original || "원제";
    els.previewArtist.textContent = artist || "아티스트";
    els.previewCategory.textContent = category || "분류";
  }

  function validateSong(song, recordId) {
    const missing = requiredFields.find(key => !song[key]);
    if (missing) return `${fieldLabel(missing)} 항목을 입력하세요.`;
    if (!/^\d{4,6}$/.test(song.number)) return "TJ 번호는 4~6자리 숫자로 입력하세요.";
    if (records.some(record => record.id !== recordId && record.data.number === song.number)) {
      return `TJ ${song.number} 번호가 이미 존재합니다.`;
    }
    if (song.updateType && !song.updatedAt) return "업데이트 유형을 선택했다면 날짜도 입력하세요.";
    return "";
  }

  function fieldLabel(key) {
    return {
      number: "TJ 번호",
      titleKo: "한국어 제목",
      titleOriginal: "원제",
      artist: "아티스트",
      tag: "원문 태그",
      category: "분류"
    }[key] || key;
  }

  function applyFormChanges(silent = false) {
    const record = getSelectedRecord();
    if (!record) return true;
    const nextSong = readFormData();
    const error = validateSong(nextSong, record.id);
    if (error) {
      showValidation(error);
      return false;
    }

    record.data = nextSong;
    saveDraft();
    renderAll();
    if (!silent) showToast("곡 변경을 적용했습니다.");
    return true;
  }

  function flushPendingForm() {
    if (!hasPendingFormChanges()) return true;
    return applyFormChanges(true);
  }

  function hasPendingFormChanges() {
    const record = getSelectedRecord();
    if (!record || els.songForm.hidden) return false;
    return signature(readFormData()) !== signature(record.data);
  }

  function addNewSong() {
    if (!flushPendingForm()) return;
    const selectedCategory = els.categoryFilter.value;
    const record = {
      id: `new-${Date.now()}-${newRecordSequence++}`,
      originalData: null,
      data: normalizeSong({ category: categories.includes(selectedCategory) ? selectedCategory : "J-POP" }),
      isNew: true
    };

    records.push(record);
    clearFiltersForRecord(record);
    selectedId = record.id;
    saveDraft();
    renderAll();
    focusField("number");
  }

  function duplicateSelectedSong() {
    if (!flushPendingForm()) return;
    const source = getSelectedRecord();
    if (!source) return;
    const copy = normalizeSong({ ...source.data, number: "" });
    const record = {
      id: `new-${Date.now()}-${newRecordSequence++}`,
      originalData: null,
      data: copy,
      isNew: true
    };

    records.push(record);
    clearFiltersForRecord(record);
    selectedId = record.id;
    saveDraft();
    renderAll();
    focusField("number");
  }

  function clearFiltersForRecord(record) {
    els.songSearch.value = "";
    els.changeFilter.value = "전체";
    els.categoryFilter.value = record.data.category;
  }

  function deleteSelectedSong() {
    if (!flushPendingForm()) return;
    const record = getSelectedRecord();
    if (!record) return;
    const label = record.data.titleKo || "이 곡";
    if (!window.confirm(`\"${label}\"을(를) 삭제할까요?`)) return;

    const index = records.findIndex(item => item.id === record.id);
    records.splice(index, 1);
    if (!record.isNew) deletedRecords.push(record);
    selectedId = records[index]?.id || records[index - 1]?.id || null;
    saveDraft();
    renderAll();
    showToast("곡을 삭제했습니다.");
  }

  function revertSelectedSong() {
    const record = getSelectedRecord();
    if (!record) return;

    if (record.isNew) {
      const index = records.findIndex(item => item.id === record.id);
      records.splice(index, 1);
      selectedId = records[index]?.id || records[index - 1]?.id || null;
    } else {
      record.data = clone(record.originalData);
    }

    saveDraft();
    renderAll();
    showToast("곡 데이터를 복원했습니다.");
  }

  function resetAllSongs() {
    if ((getChangeCount() || hasPendingFormChanges())
      && !window.confirm("모든 편집 내용을 버리고 불러온 원본으로 되돌릴까요?")) return;
    records = createRecords(baselineSongs);
    deletedRecords = [];
    selectedId = null;
    lastWrittenSignature = baselineSignature;
    clearDraft();
    renderAll();
    showToast("원본 데이터를 복원했습니다.");
  }

  function validateAllRecords() {
    for (const record of records) {
      const error = validateSong(record.data, record.id);
      if (error) {
        selectedId = record.id;
        clearFiltersForRecord(record);
        renderAll();
        showValidation(error);
        return false;
      }
    }
    return true;
  }

  function serializeData() {
    const data = getCurrentSongs();
    return [
      "// Generated by Flylist Data Editor.",
      "// Edit with editor.html or keep this JSON-style structure intact.",
      `window.FLYLIST_SONGS = ${JSON.stringify(data, null, 2)};`,
      ""
    ].join("\n");
  }

  function downloadDataFile() {
    if (!flushPendingForm()) return;
    if (!validateAllRecords()) return;
    const content = serializeData();
    const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "data.js";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    lastWrittenSignature = signature(getCurrentSongs());
    showToast("data.js를 다운로드했습니다.");
  }

  async function saveDataFile() {
    if (!flushPendingForm()) return;
    if (!validateAllRecords()) return;
    if (!("showSaveFilePicker" in window)) {
      downloadDataFile();
      showToast("직접 저장을 지원하지 않아 파일을 다운로드했습니다.");
      return;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "data.js",
        types: [{
          description: "JavaScript data file",
          accept: { "text/javascript": [".js"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(serializeData());
      await writable.close();
      lastWrittenSignature = signature(getCurrentSongs());
      showToast("data.js를 저장했습니다.");
    } catch (error) {
      if (error?.name !== "AbortError") showToast(`파일 저장 실패: ${error.message}`);
    }
  }

  async function importDataFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if ((getChangeCount() || hasPendingFormChanges())
      && !window.confirm("현재 편집 내용을 버리고 선택한 파일을 불러올까요?")) return;

    try {
      const parsed = parseDataFile(await file.text());
      baselineSongs = parsed.map(normalizeSong);
      assertValidCollection(baselineSongs);
      baselineSignature = signature(baselineSongs);
      records = createRecords(baselineSongs);
      deletedRecords = [];
      selectedId = null;
      lastWrittenSignature = baselineSignature;
      clearDraft();
      renderAll();
      showToast(`${baselineSongs.length}곡을 불러왔습니다.`);
    } catch (error) {
      showToast(`파일 불러오기 실패: ${error.message}`);
    }
  }

  function parseDataFile(text) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) throw new Error("곡 데이터 배열을 찾을 수 없습니다.");
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) throw new Error("곡 데이터가 배열 형식이 아닙니다.");
    return parsed;
  }

  function assertValidCollection(songs) {
    const numbers = new Set();
    songs.forEach((song, index) => {
      const missing = requiredFields.find(key => !song[key]);
      if (missing) throw new Error(`${index + 1}번째 곡의 ${fieldLabel(missing)} 항목이 비어 있습니다.`);
      if (!/^\d{4,6}$/.test(song.number)) throw new Error(`${song.number || index + 1}의 TJ 번호 형식이 잘못되었습니다.`);
      if (numbers.has(song.number)) throw new Error(`TJ ${song.number} 번호가 중복됩니다.`);
      numbers.add(song.number);
    });
  }

  function saveDraft() {
    try {
      if (!getChangeCount()) {
        clearDraft();
        return;
      }
      localStorage.setItem(draftKey, JSON.stringify({
        baselineSignature,
        records,
        deletedRecords,
        savedAt: new Date().toISOString()
      }));
    } catch {
      // Some private browsing modes do not provide persistent storage.
    }
  }

  function restoreDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (!draft || draft.baselineSignature !== baselineSignature || !Array.isArray(draft.records)) return false;
      records = draft.records;
      deletedRecords = Array.isArray(draft.deletedRecords) ? draft.deletedRecords : [];
      return getChangeCount() > 0;
    } catch {
      clearDraft();
      return false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Ignore unavailable storage.
    }
  }

  function showValidation(message) {
    els.validationMessage.textContent = message;
    els.validationMessage.hidden = false;
    els.validationMessage.scrollIntoView({ block: "nearest" });
  }

  function hideValidation() {
    els.validationMessage.hidden = true;
    els.validationMessage.textContent = "";
  }

  function focusField(name) {
    requestAnimationFrame(() => els.songForm.elements.namedItem(name)?.focus());
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
  }
})();

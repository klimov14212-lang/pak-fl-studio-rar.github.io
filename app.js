(function() {
  // ---------- хранилище паков (IndexedDB для больших файлов + localStorage для метаданных) ----------
  const STORAGE_KEY = 'fl_studio_packs_metadata';
  const DB_NAME = 'FLPacksHubDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'packFiles';

  let db = null;

  // Инициализация IndexedDB
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('Ошибка IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Сохранение файла в IndexedDB
  function saveFileToDB(id, fileData) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const fileRecord = {
        id: id,
        data: fileData,
        timestamp: Date.now()
      };

      const request = store.put(fileRecord);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Получение файла из IndexedDB
  function getFileFromDB(id) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('База данных не инициализирована'));
        return;
      }

      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Пример начальных паков (создаем тестовые blob-файлы)
  async function createDefaultPacks() {
    const defaultPacksMeta = [
      {
        id: 'default_1',
        name: 'Trap God Drums',
        genre: 'Trap',
        description: 'Мощные 808, хай-хэты и клапы. Идеально для агрессивного трэпа.',
        fileName: 'trap_god_drums.zip',
        fileSize: 2450000,
        addedAt: new Date().toISOString()
      },
      {
        id: 'default_2',
        name: 'Lo-Fi Chill Melodies',
        genre: 'Lo-Fi',
        description: 'Тёплые аккорды, виниловый шум и мягкие пианино.',
        fileName: 'lofi_chill_melodies.rar',
        fileSize: 1800000,
        addedAt: new Date().toISOString()
      },
      {
        id: 'default_3',
        name: 'EDM Festival Drops',
        genre: 'EDM',
        description: 'Синты, билды и дропы для главной сцены.',
        fileName: 'edm_festival_drops.zip',
        fileSize: 3200000,
        addedAt: new Date().toISOString()
      }
    ];

    // Создаем тестовые blob-файлы для демонстрации
    for (const pack of defaultPacksMeta) {
      const content = `Это тестовый пак "${pack.name}" для FL Studio.\nФайл: ${pack.fileName}\nРазмер: ${pack.fileSize} байт\n\nСодержит демо-данные для скачивания.`;
      const blob = new Blob([content], { type: 'application/zip' });
      await saveFileToDB(pack.id, blob);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPacksMeta));
    return defaultPacksMeta;
  }

  // Загрузка метаданных паков
  async function loadPacksMetadata() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return await createDefaultPacks();
      }
    } else {
      return await createDefaultPacks();
    }
  }

  // Сохранение метаданных
  function savePacksMetadata(packsArray) {
    const metadataOnly = packsArray.map(({ id, name, genre, description, fileName, fileSize, addedAt }) => ({
      id, name, genre, description, fileName, fileSize, addedAt
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metadataOnly));
  }

  // Текущие паки в памяти
  let packs = [];

  // ---------- уведомления ----------
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.borderColor = type === 'error' ? '#ff4444' : '#ff9800';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // ---------- рендер карточек ----------
  const container = document.getElementById('packsContainer');

  function formatFileSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function renderPacks() {
    if (!container) return;
    if (packs.length === 0) {
      container.innerHTML = `<div class="empty-message">🎧 Здесь пока нет паков. Загрузи первый и поделись с сообществом!</div>`;
      return;
    }

    let html = '';
    packs.forEach(pack => {
      const safeName = escapeHtml(pack.name);
      const safeDesc = escapeHtml(pack.description || 'Без описания');
      const safeGenre = escapeHtml(pack.genre || '—');
      const safeFileName = escapeHtml(pack.fileName || 'файл');
      const fileSize = formatFileSize(pack.fileSize);

      html += `
        <div class="pack-card" data-id="${escapeHtml(pack.id)}">
          <div class="pack-title">
            <span>🎵</span> ${safeName}
          </div>
          <div class="pack-desc">${safeDesc}</div>
          <div class="pack-meta">
            <span class="genre-tag">${safeGenre}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="file-size">${fileSize}</span>
              <button class="download-btn" data-id="${escapeHtml(pack.id)}" data-filename="${safeFileName}">
                ⬇️ Скачать
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Вешаем обработчики на кнопки "Скачать"
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const packId = this.getAttribute('data-id');
        const fileName = this.getAttribute('data-filename') || 'pack.zip';
        
        try {
          const fileRecord = await getFileFromDB(packId);
          if (fileRecord && fileRecord.data) {
            // Создаем ссылку для скачивания реального файла
            const url = URL.createObjectURL(fileRecord.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification(`Скачивание "${fileName}" началось`);
          } else {
            showNotification('Файл не найден в базе данных', 'error');
          }
        } catch (error) {
          console.error('Ошибка скачивания:', error);
          showNotification('Ошибка при скачивании файла', 'error');
        }
      });
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------- добавление нового пака ----------
  const packNameInput = document.getElementById('packName');
  const packGenreSelect = document.getElementById('packGenre');
  const packDescInput = document.getElementById('packDesc');
  const fileInput = document.getElementById('packFileInput');
  const fileDropArea = document.getElementById('fileDropArea');
  const fileLabel = document.getElementById('fileLabel');
  const submitBtn = document.getElementById('submitPackBtn');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const progressFill = document.getElementById('progressFill');

  function updateFileLabel() {
    if (fileInput && fileLabel && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileLabel.textContent = `${file.name} (${formatFileSize(file.size)})`;
    } else if (fileLabel) {
      fileLabel.textContent = 'Перетащите файл или нажмите для выбора (ZIP, RAR, 7z)';
    }
  }

  if (fileInput) {
    fileInput.addEventListener('change', updateFileLabel);
  }

  // Drag & drop зона
  if (fileDropArea) {
    fileDropArea.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });

    fileDropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = '#ff9800';
    });

    fileDropArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = '#3a3d48';
    });

    fileDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = '#3a3d48';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updateFileLabel();
      }
    });
  }

  // Симуляция прогресса загрузки
  function simulateProgress() {
    return new Promise((resolve) => {
      if (uploadProgressBar) uploadProgressBar.style.display = 'block';
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          if (progressFill) progressFill.style.width = '100%';
          setTimeout(() => {
            if (uploadProgressBar) uploadProgressBar.style.display = 'none';
            if (progressFill) progressFill.style.width = '0%';
            resolve();
          }, 300);
        } else {
          if (progressFill) progressFill.style.width = progress + '%';
        }
      }, 200);
    });
  }

  // Сабмит формы
  async function handleSubmit() {
    const name = packNameInput?.value.trim();
    const genre = packGenreSelect?.value || 'Trap';
    const desc = packDescInput?.value.trim();
    const file = fileInput?.files[0];

    if (!name) {
      showNotification('Пожалуйста, введите название пака', 'error');
      return;
    }

    if (!file) {
      showNotification('Выберите файл пака для загрузки', 'error');
      return;
    }

    // Проверка размера файла (максимум 50MB для localStorage/IndexedDB)
    if (file.size > 50 * 1024 * 1024) {
      showNotification('Файл слишком большой. Максимальный размер: 50MB', 'error');
      return;
    }

    // Блокируем кнопку на время загрузки
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Загрузка...';
    }

    try {
      // Читаем файл как ArrayBuffer
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
      });

      // Симулируем прогресс загрузки
      await simulateProgress();

      // Создаем Blob из ArrayBuffer
      const blob = new Blob([fileData], { type: file.type || 'application/octet-stream' });

      // Генерируем уникальный ID
      const packId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

      // Сохраняем файл в IndexedDB
      await saveFileToDB(packId, blob);

      // Создаем новый пак в метаданных
      const newPack = {
        id: packId,
        name: name,
        genre: genre,
        description: desc || 'Без описания',
        fileName: file.name,
        fileSize: file.size,
        addedAt: new Date().toISOString()
      };

      packs = [newPack, ...packs];
      savePacksMetadata(packs);
      renderPacks();

      // Очистка полей
      if (packNameInput) packNameInput.value = '';
      if (packDescInput) packDescInput.value = '';
      if (packGenreSelect) packGenreSelect.value = 'Trap';
      if (fileInput) fileInput.value = '';
      updateFileLabel();

      showNotification(`Пак "${name}" успешно опубликован! Доступен для скачивания.`);
      
      // Прокрутка к верху списка паков
      container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      showNotification('Ошибка при загрузке пака. Попробуйте еще раз.', 'error');
    } finally {
      // Разблокируем кнопку
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> Опубликовать пак';
      }
    }
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }

  // Кнопка "Загрузить пак" в шапке прокручивает к форме
  const showUploadBtn = document.getElementById('showUploadBtn');
  const uploadSection = document.getElementById('uploadSection');
  if (showUploadBtn && uploadSection) {
    showUploadBtn.addEventListener('click', () => {
      uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Инициализация приложения
  async function init() {
    try {
      await initDB();
      packs = await loadPacksMetadata();
      renderPacks();
      console.log('FL Packs Hub успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      showNotification('Ошибка загрузки базы данных', 'error');
    }
  }

  init();
})();
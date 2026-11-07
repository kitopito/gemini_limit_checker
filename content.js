// 最新の取得データをキャッシュする変数
let latestUsageData = null;

// 使用量・リセット文字列を英語表記に正規化してオブジェクト化する関数
function formatItem(usageText, resetText) {
  let percent = 0;
  let text = '0% used';
  if (usageText) {
    const m = usageText.match(/(\d+)\s*%/);
    if (m) {
      percent = parseInt(m[1], 10);
      text = `${percent}% used`;
    } else {
      text = usageText.replace(/使用中/g, 'used').trim();
    }
  }

  let resetEn = '';
  if (resetText) {
    const raw = resetText.trim();
    if (/^resets?\b/i.test(raw)) {
      resetEn = raw.charAt(0).toUpperCase() + raw.slice(1);
    } else if (/(\d+)月(\d+)日/.test(raw)) {
      const dtMatch = raw.match(/(\d+)月(\d+)日(?:の|\s+)?(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
      if (dtMatch) {
        resetEn = `Resets ${dtMatch[1]}/${dtMatch[2]} at ${dtMatch[3]}`;
      } else {
        const dMatch = raw.match(/(\d+)月(\d+)日/);
        resetEn = dMatch ? `Resets ${dMatch[1]}/${dMatch[2]}` : raw;
      }
    } else if (/\d{1,2}:\d{2}/.test(raw)) {
      const timeMatch = raw.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
      resetEn = timeMatch ? `Resets at ${timeMatch[1]}` : raw;
    } else {
      const cleaned = raw.replace(/にリセット(?:されます)?/g, '').trim();
      resetEn = cleaned ? `Resets ${cleaned}` : raw;
    }
  }

  const display = resetEn ? `${text} (${resetEn})` : text;
  return { percent, text, reset: resetEn, display };
}

// 1つのブロック要素（current-usage または weekly-usage）からデータを抽出する関数
function parseUsageBlock(el) {
  if (!el) return null;

  let usageText = null;
  let resetText = null;

  const strongs = Array.from(el.querySelectorAll('strong'));
  const usageStrong = strongs.find((s) => /\d+%/.test(s.textContent));
  if (usageStrong) {
    usageText = usageStrong.textContent.trim();
  }

  const elements = Array.from(el.querySelectorAll('span, p, div'));
  const resetEl = elements.find(
    (s) => s.children.length === 0 && /(?:リセット|reset)/i.test(s.textContent)
  );
  if (resetEl) {
    resetText = resetEl.textContent.trim();
  }

  if (usageText) {
    return formatItem(usageText, resetText);
  }
  return null;
}

// ドキュメント全体から使用量データ（現在および週間）を抽出するパーサー関数
function parseUsageData(doc) {
  if (!doc) return null;

  // 1. 新UI: data-testid="current-usage" & data-testid="weekly-usage"
  const currentEl = doc.querySelector('[data-testid="current-usage"]');
  const weeklyEl = doc.querySelector('[data-testid="weekly-usage"]');

  let current = parseUsageBlock(currentEl);
  let weekly = parseUsageBlock(weeklyEl);

  // 2. 旧UIフォールバック: .gxu-item-header
  if (!current) {
    const oldUsage = doc.querySelector('.gxu-item-header > p');
    const oldReset = doc.querySelector('.gxu-currently .reset-time-luminous');
    if (oldUsage) {
      current = formatItem(oldUsage.textContent, oldReset ? oldReset.textContent : '');
    }
  }

  // 3. 汎用フォールバック (ページ全体からテキスト探索)
  if (!current) {
    const all = Array.from(doc.querySelectorAll('strong, p, span, div'));
    const fUsage = all.find(
      (el) => el.children.length === 0 && /\b\d+%\s*(?:使用中|used)?/i.test(el.textContent)
    );
    const fReset = all.find(
      (el) => el.children.length === 0 && /(?:リセット|reset)/i.test(el.textContent)
    );
    if (fUsage) {
      current = formatItem(fUsage.textContent, fReset ? fReset.textContent : '');
    }
  }

  if (current) {
    return { current, weekly };
  }
  return null;
}

// /usage ページから使用量データを取得する関数（iframeを使用して描画を待機）
async function fetchUsageLimit() {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = '/usage';

    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    iframe.onerror = () => {
      cleanup();
      resolve('Loading error');
    };

    iframe.onload = () => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const parsedData = parseUsageData(iframeDoc);

          if (parsedData) {
            clearInterval(interval);
            cleanup();
            resolve(parsedData);
          } else if (attempts > 30) {
            clearInterval(interval);
            cleanup();
            resolve('Data not found');
          }
        } catch (e) {
          clearInterval(interval);
          cleanup();
          console.error('iframe access error:', e);
          resolve('Error occurred');
        }
      }, 500);
    };

    document.body.appendChild(iframe);
  });
}

// 詳細展開部分のUI表示を更新する関数
function updateDetailsUI(data) {
  if (!data) return;

  // Current Limit
  const curVal = document.getElementById('detail-current-val');
  const curBar = document.getElementById('detail-current-bar');
  const curReset = document.getElementById('detail-current-reset');
  if (data.current) {
    if (curVal) curVal.textContent = data.current.text;
    if (curBar) {
      curBar.style.width = `${Math.min(100, Math.max(0, data.current.percent))}%`;
      curBar.classList.toggle('warn', data.current.percent >= 80);
    }
    if (curReset) curReset.textContent = data.current.reset || 'No reset time';
  }

  // Weekly Limit
  const weeklySection = document.getElementById('detail-weekly-section');
  const weeklyVal = document.getElementById('detail-weekly-val');
  const weeklyBar = document.getElementById('detail-weekly-bar');
  const weeklyReset = document.getElementById('detail-weekly-reset');
  if (data.weekly) {
    if (weeklySection) weeklySection.style.display = 'flex';
    if (weeklyVal) weeklyVal.textContent = data.weekly.text;
    if (weeklyBar) {
      weeklyBar.style.width = `${Math.min(100, Math.max(0, data.weekly.percent))}%`;
      weeklyBar.classList.toggle('warn', data.weekly.percent >= 80);
    }
    if (weeklyReset) weeklyReset.textContent = data.weekly.reset || 'No reset time';
  } else if (weeklySection) {
    weeklySection.style.display = 'none';
  }
}

// UIの表示を更新する関数
async function updateUsageDisplay() {
  const valueElement = document.querySelector('#gemini-usage-value');
  const refreshBtn = document.querySelector('#limit-refresh-action');
  if (refreshBtn) refreshBtn.classList.add('rotating');

  try {
    const data = await fetchUsageLimit();
    if (typeof data === 'string') {
      if (valueElement) valueElement.textContent = data;
    } else if (data && data.current) {
      latestUsageData = data;
      if (valueElement) {
        valueElement.textContent = data.current.display;
      }
      updateDetailsUI(data);
    }
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('rotating');
  }
}

// インジケーター要素を作成する関数（インライン展開式）
function createIndicator() {
  let indicator = document.getElementById('gemini-limit-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'gemini-limit-indicator';

    indicator.innerHTML = `
      <div class="gemini-limit-header" id="gemini-limit-header" title="Click to show details">
        <div class="gemini-limit-badge">
          <span class="limit-label">Limit:</span>
          <span class="limit-value" id="gemini-usage-value">Loading...</span>
        </div>
        <span class="gemini-limit-expand-icon">▼</span>
      </div>

      <div class="gemini-limit-details" id="gemini-limit-details">
        <div class="limit-detail-section" id="detail-current-section">
          <div class="limit-detail-row">
            <span class="limit-detail-label">Current limit</span>
            <span class="limit-detail-value" id="detail-current-val">-</span>
          </div>
          <div class="limit-progress-bg">
            <div class="limit-progress-fill" id="detail-current-bar" style="width: 0%;"></div>
          </div>
          <div class="limit-detail-reset" id="detail-current-reset">Resets -</div>
        </div>

        <div class="limit-detail-section" id="detail-weekly-section" style="display: none;">
          <div class="limit-detail-row">
            <span class="limit-detail-label">Weekly limit</span>
            <span class="limit-detail-value" id="detail-weekly-val">-</span>
          </div>
          <div class="limit-progress-bg">
            <div class="limit-progress-fill" id="detail-weekly-bar" style="width: 0%;"></div>
          </div>
          <div class="limit-detail-reset" id="detail-weekly-reset">Resets -</div>
        </div>

        <div class="limit-detail-footer">
          <button class="limit-refresh-btn" id="limit-refresh-action" title="Refresh usage">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Refresh
          </button>
          <a href="/usage" target="_blank" rel="noopener noreferrer" class="limit-usage-link">
            Open Usage Page
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </a>
        </div>
      </div>
    `;

    // ヘッダークリックで開閉トグル
    const header = indicator.querySelector('#gemini-limit-header');
    if (header) {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        const willExpand = !indicator.classList.contains('expanded');
        indicator.classList.toggle('expanded', willExpand);
        if (willExpand && latestUsageData) {
          updateDetailsUI(latestUsageData);
        }
      });
    }

    // 詳細枠内のクリックで閉じてしまうのを防止
    const details = indicator.querySelector('#gemini-limit-details');
    if (details) {
      details.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // 更新ボタンのクリック
    const refreshBtn = indicator.querySelector('#limit-refresh-action');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const valEl = document.querySelector('#gemini-usage-value');
        if (valEl) valEl.textContent = 'Updating...';
        updateUsageDisplay();
      });
    }

    // 画面外クリックで自動で閉じる
    document.addEventListener('click', (e) => {
      if (indicator.classList.contains('expanded') && !indicator.contains(e.target)) {
        indicator.classList.remove('expanded');
      }
    });
  }

  return indicator;
}

// 送信イベントリスナーのセットアップ（重複登録防止付き）
function setupListeners(container) {
  if (container.dataset.limitCheckerListening === 'true') return;
  container.dataset.limitCheckerListening = 'true';

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      setTimeout(updateUsageDisplay, 5000);
    }
  });

  container.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (
      button &&
      (button.getAttribute('aria-label') === 'メッセージを送信' ||
        button.getAttribute('aria-label') === '送信' ||
        button.getAttribute('aria-label') === 'Send message' ||
        button.getAttribute('aria-label') === 'Send' ||
        button.getAttribute('data-testid') === 'send-button' ||
        button.className.includes('send') ||
        button.textContent.includes('send'))
    ) {
      setTimeout(updateUsageDisplay, 5000);
    }
  });
}

// インジケーターを最適なコンテナに確実に配置・維持する関数
function placeIndicator() {
  const indicator = createIndicator();

  // 1. 本命の input-container を探す
  const inputContainer = document.querySelector('input-container');

  if (inputContainer) {
    inputContainer.style.position = 'relative';

    if (indicator.parentElement !== inputContainer) {
      indicator.style.position = '';
      indicator.style.top = '';
      indicator.style.bottom = '';
      indicator.style.right = '';
      indicator.style.zIndex = '';
      inputContainer.appendChild(indicator);
    }

    setupListeners(inputContainer);
    return true;
  }

  // 2. input-container がまだない場合のフォールバック: 画面内に必ず見えるよう fixed で body に追加
  if (!document.body.contains(indicator)) {
    indicator.style.position = 'fixed';
    indicator.style.bottom = '24px';
    indicator.style.right = '24px';
    indicator.style.zIndex = '99999';
    document.body.appendChild(indicator);
  }
  return false;
}

// 初期化とDOM監視
let hasInitialFetched = false;

function init() {
  const placed = placeIndicator();

  if (!hasInitialFetched) {
    hasInitialFetched = true;
    updateUsageDisplay();
  }

  // input-container が出現するまでポーリング（最大10秒）
  if (!placed) {
    let retries = 0;
    const retryInterval = setInterval(() => {
      retries++;
      if (placeIndicator() || retries > 20) {
        clearInterval(retryInterval);
      }
    }, 500);
  }

  // SPAの画面遷移や再描画にも自動追従
  let observerTimeout = null;
  const observer = new MutationObserver(() => {
    if (observerTimeout) return;
    observerTimeout = setTimeout(() => {
      observerTimeout = null;
      placeIndicator();
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 3分ごとの定期更新
  setInterval(updateUsageDisplay, 3 * 60 * 1000);
}

// 実行
init();

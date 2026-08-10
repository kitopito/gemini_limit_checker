// /usage ページから使用量データを取得する関数（iframeを使用してJavaScriptの描画を待機）
async function fetchUsageLimit() {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = '/usage';
    
    iframe.onload = () => {
      let attempts = 0;
      // iframe内でAngular（JavaScript）がコンテンツを描画するのを定期的にチェックして待つ
      const interval = setInterval(() => {
        attempts++;
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          const usageElement = iframeDoc.querySelector('.gxu-item-header > p');
          const resetTimeElement = iframeDoc.querySelector('.gxu-currently .reset-time-luminous');
          
          if (usageElement) {
            clearInterval(interval);
            let text = usageElement.textContent.trim();
            if (resetTimeElement) {
              text += ` (${resetTimeElement.textContent.trim()})`; // 例: "0% 使用中 (21:52にリセット)"
            }
            document.body.removeChild(iframe); // 取得できたらiframeを削除
            resolve(text);
          } else if (attempts > 20) {
            // 10秒(500ms * 20回)待っても要素が出なければ諦める
            clearInterval(interval);
            document.body.removeChild(iframe);
            resolve("データが見つかりません");
          }
        } catch (e) {
          clearInterval(interval);
          document.body.removeChild(iframe);
          console.error("iframeアクセスエラー:", e);
          resolve("エラーが発生しました");
        }
      }, 500); // 500ミリ秒ごとにチェック
    };
    
    document.body.appendChild(iframe);
  });
}

// UIの表示を更新する関数
async function updateUsageDisplay() {
  const valueElement = document.querySelector('#gemini-usage-value');
  if (valueElement) {
    // データ取得をバックグラウンドで行い、完了したら表示を更新する
    const limitText = await fetchUsageLimit();
    valueElement.textContent = limitText;
  }
}

async function injectLimitUI() {
  // 既にインジケーターが存在する場合は何もしない
  if (document.getElementById('gemini-limit-indicator')) return;

  const indicator = document.createElement('div');
  indicator.id = 'gemini-limit-indicator';
  
  // 初期表示のHTML
  indicator.innerHTML = `
    <div class="gemini-limit-badge">
      <span class="limit-label">Limit:</span>
      <span class="limit-value" id="gemini-usage-value">取得中...</span>
    </div>
  `;

  const inputContainer = document.querySelector('input-container');
  if (inputContainer) {
    inputContainer.appendChild(indicator);
    
    // 【動的更新1】Ctrl+Enterキーでの送信を検知して更新
    inputContainer.addEventListener('keydown', (e) => {
      // ユーザー設定に合わせて Ctrl + Enter（Macの場合は Cmd + Enter）を送信とみなす
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        // 送信後、Geminiのサーバー側で使用量が更新されるのを待つため数秒遅延させる
        setTimeout(updateUsageDisplay, 5000); 
      }
    });

    // 【動的更新2】送信ボタンのクリックを検知して更新
    inputContainer.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      // 送信ボタンらしい要素がクリックされた場合
      if (button && (button.getAttribute('aria-label') === 'メッセージを送信' || button.getAttribute('aria-label') === '送信' || button.textContent.includes('send'))) {
        setTimeout(updateUsageDisplay, 5000);
      }
    });

  } else {
    // フォールバック: input-containerが見つからなければbodyに追加
    document.body.appendChild(indicator);
  }

  // 初回のデータ取得
  await updateUsageDisplay();

  // 【動的更新3】念のため、3分ごとに定期的に自動更新する
  setInterval(updateUsageDisplay, 3 * 60 * 1000);
}

// ページ読み込み時に実行
injectLimitUI();

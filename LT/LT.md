---
marp: true
theme: default
paginate: true
size: 16:9
headingDivider: 2
footer: "3班"
html: true
style: |
  :root {
    --primary: #202040;
    --accent: #f59e0b;
    --ink: #303033;
    --muted: #64748b;
    --surface: #f0f0f0;
    font-family: "Noto Sans CJK JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  }

  section {
    padding: 56px 72px;
    color: var(--ink);
    background: var(--surface);
    font-size: 30px;
    line-height: 1.45;
  }

  section::after {
    color: var(--muted);
    font-size: 16px;
  }

  h1 {
    color: var(--primary);
    font-size: 1.8em;
  }

  h2 {
    margin-bottom: 0.7em;
    border-bottom: 4px solid var(--primary);
    padding-bottom: 0.18em;
    color: var(--ink);
    font-size: 1.45em;
  }

  strong {
    color: var(--primary);
  }

  code {
    border-radius: 6px;
    background: #e2e8f0;
  }

  blockquote {
    margin: 1em 0;
    border-left: 8px solid var(--accent);
    padding: 0.4em 0.8em;
    color: var(--ink);
    background: #fff;
  }

  .lead {
    text-align: center;
  }

  .lead h1 {
    font-size: 2.25em;
  }

  .lead p {
    color: var(--muted);
  }

  .big {
    margin: 0.5em 0;
    color: var(--primary);
    font-size: 2.2em;
    font-weight: 800;
    text-align: center;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }

  .card {
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    padding: 20px 24px;
    background: #fff;
  }

  .small {
    color: var(--muted);
    font-size: 0.7em;
  }

  .link {
    color: #6474f0;
    text-decoration: underline;
  }

  .flex-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  table {
    font-size: 0.8em;
  }

  footer {
    color: var(--muted);
    font-size: 14px;
  }
---

<!--
目安は10分
-->

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: "" -->

# キャンバス型Todoアプリ

<br>
<br>
<br>

2026年07月24日
3班　今井・杉山・鍋島・西谷

<!--
00m20s
00m20s

3班の発表をはじめます。よろしくお願いします。
まあみなさん「キャンバス型ってなんやねん」という感じだと思いますが、
-->

## キャンバス型とは？

> タスクをキャンバス上に自由に配置して管理できるTodoアプリです。

<center>
  <img src="./canvas.png" width="700">
</center>

<!--
00m40s
01m00s

こんな感じで、タスクをキャンバス上に自由に配置して管理できるTodoアプリです。
このタスクを掴んでいろいろ動かしてみたり、線でつなげてみたり、という感じのことができます。
-->

## 使用技術

- HTML/CSS （標準 + TailwindCSS）
- TypeScript （Vite等は使用せず）
- Web Storage API （localStorage）

<!--
00m40s
01m40s

使用した技術としては、いわゆる"Web"、HTML/CSSと、
ここは少し変わり種なのですがJavaScriptではなくTypeScriptで書いています。
また、Vite等のビルドツールやその他ライブラリ等も使用せず、純粋にTypeScriptのコンパイラのみを用いています。
それから、データの保存・復元にはWeb Storage APIのlocalStorageを使用しています。
-->

## 実装した機能

- タスクの追加・編集・削除・配置・移動

- 接続の追加・削除

- キャンバスの追加・編集・削除・切り替え

- 保存・復元

- 元に戻す・やり直し

- タスクの検索・フィルタリング (キーワード・ステータス・距離)

<!--
00m40s
02m20s

実装した機能としては、(スライドを読み上げる)
という感じになっています。
-->

## 各担当箇所

<div class="columns">
  <div class="card">

### 今井

- HTML/CSS・
DOM操作・イベント処理

  </div>
  <div class="card">

### 杉山

- 検索・フィルタリング機能

  </div>
</div>
<br>
<div class="columns">
  <div class="card">

### 鍋島

- 保存・復元機能

  </div>
  <div class="card">

### 西谷

- 元に戻す・やり直し機能

  </div>
</div>

<!--
00m30s
02m50s

(スライドを読み上げる)
-->

## デモ

- **キャンバス**：追加・タイトル編集・切り替え・削除
- **タスク**：追加・編集・ドラッグ移動・削除
- **接続**：タスク同士の接続・接続線の削除
- **検索・フィルター**：キーワード・ステータス・距離で絞り込み
- **Undo / Redo**：操作を元に戻す・やり直す
- **保存・復元**：保存後、再読み込みして状態を復元

<!--
03m00s
05m50s
-->

## モジュール構成　（画面と状態管理）

<div class="columns">
  <div class="card">

### UI

`events.ts` / `renderer.ts`

- ユーザー操作の受付
- タスクカードの描画
- SVG接続線の描画
- メニューやダイアログの表示

  </div>
  <div class="card">

### Application

`application.ts`

- アプリ全体の状態を管理
- タスク・接続などを操作
- 選択対象・操作モードを管理
- 他モジュールをつなぐ窓口

  </div>
</div>

<!--
00m30s
06m20s
-->

## モジュール構成　（データと補助機能）

<div class="columns">
  <div class="card">

### Domain

`task.ts` / `canvas.ts`  
`connection.ts` など

- タスク・接続・キャンバスを表現
- 位置やステータスなどを保持
- アプリで扱うデータの形を定義

  </div>
  <div class="card">

### 補助機能

`filter` / `history` /
`localStorage` など

- タスクの検索・絞り込み
- localStorageへの保存・復元
- Undo / Redoの履歴管理
- 保存データや入力値の検証

  </div>
</div>

<!--
00m30s
06m50s
-->

## 操作から画面更新までの流れ

<center>
<div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 80px;">
  <div class="card" style="text-align: center; width: 220px;">
    <strong>① 操作</strong><br>
    <span class="small">EventController</span>
  </div>
  <div style="font-size: 48px;">▼</div>
  <div class="card" style="text-align: center; width: 220px;">
    <strong>② 状態を変更</strong><br>
    <span class="small">Application</span>
  </div>
  <div style="font-size: 48px;">▼</div>
  <div class="card" style="text-align: center; width: 220px;">
    <strong>③ 再描画</strong><br>
    <span class="small">Renderer</span>
  </div>
</div>
</center>

<!--
00m20s
07m10s
-->

## 使用用途とターゲット

### 　複数のプロジェクトを同時に進行している個人クリエイター・開発者

- 授業課題や研究
- 個人開発
- 動画・記事・作品などを制作
- 小規模なイベントや企画を準備
- 情報を一覧より図で把握したい

<!--
01m00s
08m10s
-->

## 類似アプリについて

- Obsidian Canvas

<center>
  <img src="./obsidian.png" width="500">
</center>
<center>
  <span class="small">Obsidian Canvas ・</span>
  <a href="https://obsidian.md/ja/help/plugins/canvas" class="small link">https://obsidian.md/ja/help/plugins/canvas</a>
</center>

<!--
00m30s
08m40s
-->

## 他にも色々あるが...

- ClickUp

<center>
  <img src="./clickup.gif" width="500">
</center>
<center>
  <span class="small">ClickUp Whiteboard ・</span>
  <a href="https://clickup.com/ja/blog/35318/guide-to-whiteboards-in-clickup" class="small link">https://clickup.com/ja/blog/35318/guide-to-whiteboards-in-clickup</a>
</center>

> 大規模チーム向けで機能も多い

<!--
00m30s
09m10s
-->

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _footer: "" -->

<center>
  <h1>まとめ</h1>
  <br>
  <h3>タスクの関係の近さでフィルターできるシンプルなキャンバス型Todoアプリ</h3>
</center>
<br>
<center>
  <div class="flex-container">
    <p>QRコードからアクセスできます。→</p>
    <img src="./qr.png" width="200" alt="">
  </div>
  <br>
  <p class="small">または <a href="https://floating-gate.com/projects/todo2607">https://floating-gate.com/projects/todo2607</a> から</p>
</center>

<!--
00m50s
10m00s
-->

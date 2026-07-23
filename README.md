# Canvas型ToDoアプリ

## 起動方法

このアプリはES Modulesを使用するため、`file://` でHTMLを直接開かず、HTTPサーバー経由で起動する。

```bash
npm install
npm run build
npm run serve
```

起動後、ブラウザで `http://localhost:8000` を開く。開発中は別のターミナルで `npm run dev` を実行すると、TypeScriptとTailwind CSSの変更が自動的にビルドされる。

## ドキュメント

- `req.md`: 要求分析
- `spec.md`: 要件定義
- `DESIGN.md`: デザインシステム

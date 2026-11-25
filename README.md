# リーフファイラ
個人用PWAファイル管理。Sitesへの移行用ソース。
- [認証・利用・運用手順](docs/setup.md)
- [実装状況](docs/status.md)
## 構成
- src: 画面、クラウド操作
- worker: リーフエディタ方式のGoogle OAuth、暗号化保存、API中継
- tests: 自動テスト
## 開発
npm test で検証。SitesのWorkerと静的アセットを組み合わせて公開する。認証設定や秘密情報はリポジトリに保存しない。

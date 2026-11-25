# 認証設定
Sites版ではリーフエディタと同様、Google OAuthウェブアプリの認証コード方式を使用する。既存OAuthクライアントにSites公開URLの /auth/google/callback を承認済みリダイレクトURIとして追加し、サイト専用の暗号化保存領域に認証設定を入力する。既存エディタのトークンは共有しない。
Workerには LEAF_SITE_ORIGIN、LEAF_OWNER_EMAIL、LEAF_SECRET_KEY と専用R2バインディング BUCKET を設定する。
Microsoft Entra のアプリ登録で個人用 Microsoft アカウントを許可し、SPA のリダイレクトURIに公開URL（末尾 / を含む）を登録する。委任 Files.ReadWrite を設定し、アプリIDを入力する。
一時ファイルIDは利用者の設定に入力する（公開ソースに私有フォルダIDを含めない）。
公式資料:
- https://developers.google.com/workspace/drive/api/guides/manage-uploads
- https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
- https://learn.microsoft.com/en-us/graph/api/driveitem-delete
# 利用方法
設定で各IDを入力し、各接続ボタンを押す。ツリーから保存領域を選ぶ。ファイル選択後ツールバーからコピー等を実行する。2画面ボタンで左右・上下・単画面を切り替える。
# ChatGPT連携
指定された一時ファイルフォルダの実ファイル一覧・合計容量を確認し、100MB/1GB制限を適用。同名時は上書き・連番・キャンセルを確認。WorkのGoogle Drive upload_fileに生成ファイルの絶対パス、親フォルダID、ファイル名を指定。上書きでは仮名でアップロードし照合、旧ファイルをtrash_fileでごみ箱に移し、update_fileで正式名に変更する。旧ファイルの復元経路がない場合は上書き中止。


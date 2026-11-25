# 認証設定
公開URLのオリジンを Google Cloud Console の OAuth ウェブアプリの承認済み JavaScript 生成元に登録する。Drive API を有効化し、同意画面のテストユーザーに本人を登録する。取得したクライアントIDをアプリの設定に入力する。クライアントシークレットは不要。全ファイル操作のため drive と drive.appdata のスコープを使用する。
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

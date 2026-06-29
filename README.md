# 求職者CRM（独立Webアプリ版）セットアップ手順

このアプリは、Claudeのアカウントを持たない人でも利用できる、完全に独立したWebアプリです。
データの保存先には **Supabase**（無料で使えるデータベースサービス）、公開先には **Vercel**（無料で使えるホスティングサービス）を使います。

エンジニアでなくても、この手順書の通りに進めれば構築できます。所要時間はおおよそ20〜30分です。

---

## 全体の流れ

1. Supabaseでデータベースを作る
2. このアプリのコードをGitHubに置く
3. Vercelでデプロイ（公開）する
4. 完成したURLをチームに共有する

---

## ステップ1：Supabaseでデータベースを作る

1. https://supabase.com にアクセスし、「Start your project」からアカウントを作成します（メールアドレスでもGitHubアカウントでも可）
2. ログイン後、「New project」をクリックします
3. 以下を入力します
   - **Project name**：好きな名前（例：recruit-crm）
   - **Database Password**：好きなパスワードを設定し、必ずメモしておく
   - **Region**：日本に近いリージョン（Tokyo (Northeast Asia) など）を選ぶと表示が速くなります
4. 「Create new project」をクリックし、1〜2分待ちます（データベースが作成されます）
5. 左側メニューから **SQL Editor** を開きます
6. このフォルダ内の `supabase/schema.sql` ファイルの内容を全てコピーし、SQL Editorに貼り付けて、右下の「Run」をクリックします
   - 「Success. No rows returned」と表示されれば成功です
7. 左側メニューから **Project Settings → API** を開きます
8. 以下の2つの値をメモしておきます（後で使います）
   - **Project URL**（`https://xxxxx.supabase.co` のような形式）
   - **anon public** キー（長い英数字の文字列）

---

## ステップ2：このアプリのコードをGitHubに置く

1. https://github.com でアカウントを作成（未作成の場合）
2. 新しいリポジトリを作成します（「New repository」）。Public/Privateはどちらでも構いません
3. このフォルダ（recruit-crm-webapp）の中身をすべて、そのリポジトリにアップロードします
   - GitHubの画面上から「Add file → Upload files」でドラッグ＆ドロップでもアップロードできます
   - `.env` ファイルは含めないでください（後でVercel側に直接設定します）

---

## ステップ3：Vercelでデプロイする

1. https://vercel.com にアクセスし、「Sign Up」からアカウントを作成します（GitHubアカウントでのログインがおすすめです）
2. ログイン後、「Add New... → Project」をクリックします
3. 先ほど作成したGitHubリポジトリを選択し、「Import」をクリックします
4. 「Environment Variables（環境変数）」の項目を開き、以下の2つを追加します

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | ステップ1でメモした Project URL |
   | `VITE_SUPABASE_ANON_KEY` | ステップ1でメモした anon public キー |

5. 「Deploy」をクリックします。1〜2分待つとビルドが完了し、公開URL（`https://your-app.vercel.app` のような形式）が発行されます
6. そのURLにアクセスして、事業選択画面が表示されれば成功です

---

## 困ったときは

### 画面が真っ白、または「読み込み中…」のまま動かない

- ブラウザの開発者ツール（F12キー）の「Console」タブを確認し、エラーメッセージを確認してください
- 多くの場合、環境変数（`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）の設定ミスが原因です。Vercelの「Project Settings → Environment Variables」で値を見直し、保存後に「Redeploy」してください

### データが保存されない

- SupabaseのSQL Editorで `schema.sql` が正しく実行されているか確認してください
- Supabaseの「Table Editor」で `candidates` などのテーブルが作成されているか確認してください

### コードを修正したい場合

- GitHub上でファイルを編集して保存（コミット）すると、Vercelが自動的に再デプロイしてくれます

---

## 重要：セキュリティに関する注意

このアプリには**ログイン機能がありません**。公開されたURLを知っている人は、誰でも全データを閲覧・編集・削除できます。

- URLは社内の関係者にのみ共有してください
- 求職者の個人情報（氏名・連絡先・年齢・障がい種別など）を扱うことを踏まえ、URLの管理には十分ご注意ください
- 本格的な権限管理（ログイン、閲覧専用ユーザーなど）が必要になった場合は、Supabaseの認証機能（Auth）を追加する改修が可能です。その際はご相談ください

---

## データのバックアップ

Supabaseの「Table Editor」から各テーブルをCSV形式でエクスポートできます。定期的なバックアップをおすすめします。

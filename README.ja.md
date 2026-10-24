<div align="center">

# 🌐 Odin

[![CI](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml) [![Reached #1 on GitHub Trending](https://img.shields.io/badge/%231_GitHub_Trending-thank_you!-F0A63C?style=flat-square&logo=github)](https://x.com/bilawalsidhu/status/2093798887815348521)

**[English](README.md)** · **[Français](README.fr.md)** · **[Русский](README.ru.md)** · **[简体中文](README.zh-CN.md)** · **[日本語](README.ja.md)** · **[العربية](README.ar.md)**

> [!NOTE]
> **多言語ドキュメントについて：** 本日本語ドキュメントは日本語コミュニティの便宜のために提供されています。公式の技術的リファレンスは[英語版 README](README.md)です。翻訳の改善や校正に関する提案は Pull Request にて歓迎いたします。

> [!IMPORTANT]
> **Odin** は、[Halfpixel](https://halfpixel.ai) の [Bilawal Sidhu](https://github.com/bilawalsidhu) および [Sameh Khamis](https://github.com/samehkhamis) によって作成されたオープンソースプロジェクト [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) の独立した主権フォークです。
> **[Seclib](https://github.com/seclib)** によって MIT ライセンスのもとで保守・公開されています。詳細なクレジット、変更履歴、サードパーティ製データのライセンスについては [NOTICE.md](NOTICE.md) をご参照ください。

### ブラウザで動くリアルタイム地理空間インテリジェンス・コンソール — 公開シグナル、実テレメトリ、主権型アーキテクチャ。

フォトリアリスティックな 3D 地球。リアルタイムの航空機、船舶、軌道上の人工衛星、地震、交通流、公共カメラ。ローカル主権 AI またはクラウドエージェントによるハンズフリー音声操作とインテリジェンス要約。

_見落とされる場所はどこにもありません。_

![軌道 HUD、ライブ地球、FLIR 熱画像スキャン](docs/media/hero-open-source-reveal.gif)

<a href="https://www.youtube.com/@bilawalsidhu">
  <img src="docs/media/youtube-popular-videos.png" alt="YouTube の God's Eye View シリーズ" width="100%">
</a>

▶️ **バイラルヒットした God's Eye View シリーズ発** _(旧称 WorldView)_ — [YouTube 500 万回再生突破](https://youtube.com/playlist?list=PL6qSg2I-7_koPbDnSMo0QeeHX_RknA2uv&si=nBGYMoHWQw41v93Q) · [SNS 総計 2,500 万回以上](https://www.google.com/search?q=god%27s+eye+view) · 🏆 **GitHub Trending 週間総合 1 位獲得**

⚡ **API キーなしですぐに起動可能。** Docker Compose または Node.js によるローカル実行に対応。全 20 レイヤー中 18 レイヤーがキーなしで完全に動作します。 **[→ クイックスタート](#-クイックスタート)**

</div>

---

<div align="center">

**[クイックスタート](#-クイックスタート) · [系譜と変更点](#-系譜フォークと-seclib-による変更点) · [機能と制約](#-機能と実際の技術的制約) · [データソースと依存関係](#-データソースと外部依存関係) · [地球上のデータ](#-地球上のデータレイヤー) · [AI 機能](#-ai-機能ローカル-ethan-とクラウドモデル) · [プライバシーとセキュリティ](#-プライバシーセキュリティモデルネットワーク通信) · [ライセンス](NOTICE.md) · [貢献方法](CONTRIBUTING.md)**

</div>

---

## 🏛️ 系譜、フォークと Seclib による変更点

Odin は、Bilawal Sidhu および Sameh Khamis (Halfpixel) によって開発されたオープンソースプロジェクト **God's Eye View** の独立保守フォークです。

### なぜこのフォークが存在するのか

原著プロジェクトは、公開されている地理空間シグナル（ADS-B、AIS、SGP4 軌道要素、地震計、自治体カメラ、気象レーダー）を単一の 3D 地球儀上に統合できることを実証しました。

**Seclib** は、高機密性・主権管理・プライバシー保護が求められる環境へ適合させるため、この **Odin** フォークを立ち上げました：
- **ローカル AI 主権：** インテリジェンス機能を外部の閉鎖型クラウド LLM API から切り離し、**ETHAN** プラットフォームによる完全オンプレミス実行を実現。
- **コンテナ堅牢化と隔離：** ネットワーク監視をローカルループバック（Loopback）に厳格に制限し、プロキシの気密性を向上。
- **包括的な多言語対応：** 日本語を含む主要 6 言語のネイティブ翻訳、およびアラビア語の完全な右横書き（RTL）反転レイアウトを実装。
- **厳格な法務・ライセンス境界の分離：** MIT ライセンスのコード本体と、非商用（NC）等の制約がある第三者データセットを明確に分離。

### Seclib による主な変更点

すべての変更は元のシーンフォーマットとの後方互換性を維持しています：

1. **ブランドと管理主体：** **Odin** としてリブランディングし、Seclib 組織下で保守管理。[NOTICE.md](NOTICE.md) に上流の原著作権表示を保持。
2. **ETHAN プラットフォーム連携：**
   - 環境変数 `GEV_ETHAN_API_URL` および `GEV_ETHAN_API_KEY`/`GEV_ETHAN_TOKEN` によるローカル ETHAN モデルとの直接接続。
   - HUD の戦術的要約をローカルモデル（Ollama / vLLM / ETHAN）のみで完結させ、外部ネットワークへのデータ漏洩を防止。
3. **安全な Docker およびネットワーク構成：**
   - `compose.yaml` をデフォルトで `127.0.0.1:4173` に厳格バインドし、LAN への意図しないキー漏洩を防止。
   - `GEV_ALLOWED_HOSTS` による HTTP Host ヘッダーの検証で DNS リバインディング攻撃を遮断。
   - 安全性の未確認なリモートトンネルや未検証ゲートウェイの信頼設定をデフォルトで無効化。
4. **多言語国際化アーキテクチャ (i18n)：**
   - **英語** (`en`)、**フランス語** (`fr`)、**ロシア語** (`ru`)、**スペイン語** (`es`)、**簡体字中国語** (`zh-CN`)、**日本語** (`ja`)、**アラビア語** (`ar`) の完全な翻訳カタログ。
   - アラビア語向けにドキュメント方向や UI コントロールを反転する完全な RTL ミラーリング。
5. **法的ライセンスとデータ監査：**
   - 非商用制限付きデータセット（TeleGeography 海底ケーブル、Bhote Koshi 洪水データ）の明確な文書化。
   - [SECURITY.md](SECURITY.md) での責任ある脆弱性報告プロセスの確立。

---

## ⚠️ 機能と実際の技術的制約

Odin は公開データを統合して状況認識を提供します。直接観測、予測モデル、シミュレーションの違いを理解することが重要です：

```
┌───────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ シグナルの種類        │ 該当するレイヤー              │ データの性質と運用上の現実               │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ リアルタイム実測観測  │ 民間航空機、軍用 ADS-B、      │ トランスポンダからの実電波信号；         │
│                       │ AIS 船舶、USGS 地震           │ 15〜30 秒ごとに更新；測位点間を補間。    │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 数学的外挿モデル      │ 軌道上の人工衛星、            │ CelesTrak の TLE を用いた SGP4 軌道伝播；│
│                       │ 風向風速・気象 (GFS/ECMWF)    │ nowCOAST レーダー合成；GFS 数値気象予報。│
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 軌道再構成 /          │ ロケット打上げ (Falcon 9)、   │ RECONSTRUCTED ESTIMATE と表示：力学モ    │
│ 概算推定              │ 監視カメラの視野コーン        │ デルによる推算軌道であり実測レーダではない│
│                       │ (CCTV Viewshed)               │ カメラの向きはギズモで手動校正する推定値 │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 合成シミュレーション  │ 模擬交通流                    │ OpenStreetMap 道路網上を動くシミュレーシ │
│                       │                               │ ョン；速度は TomTom の渋滞状況で制御。   │
│                       │                               │ 点は実在する特定の車両ではありません。   │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ 信号完全性指標        │ GNSS (GPS) 健全性スコア       │ 航空機の ADS-B 精度データから集計；      │
│                       │                               │ スコア低下は電波障害の可能性であり妨害   │
│                       │                               │ (ジャミング) の確定証拠ではありません。 │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

> [!IMPORTANT]
> **運用上の免責事項：** Odin は探索的分析および可視化のためのクライアントです。データには遅延、欠損、モデル化誤差、誤りが含まれる可能性があります。
> 航空管制、船舶航行、災害緊急対応、軍事作戦、人命に関わる用途には**絶対に使用しないでください**。重要な意思決定には必ず公的な一次情報源を確認してください。

---

## ⚡ クイックスタート

アカウント登録も **API キーも一切不要で起動** できます。デフォルトでは Esri 衛星画像とキー不要の標高データが使用されます。

### 方法 1 — ネイティブ Node.js（開発者向け推奨）

前提条件：**Node.js 24 LTS (24.14.0 以上) または 26.x**。

```bash
# 1. リポジトリのクローン
git clone https://github.com/seclib/odin.git
cd odin

# 2. 依存関係のインストール
npm ci

# 3. 環境診断チェックの実行
npm run doctor

# 4. 開発サーバーの起動
npm run dev
```

ブラウザで **`http://localhost:4173`** を開きます。

### 方法 2 — Docker Compose（隔離・運用向け推奨）

Docker および Docker Compose が必要です。ホスト側に Node.js は不要です。

```bash
# 1. リポジトリのクローン
git clone https://github.com/seclib/odin.git
cd odin

# 2. ホストユーザー権限を維持して起動
env UID=$(id -u) GID=$(id -g) docker compose up
```

ブラウザで **`http://localhost:4173`** を開きます。
- 設定ファイルやキャッシュ（`.env`、`.gev-cache/`、`.gev-logs/`）はホスト側のフォルダに安全に保持されます。
- ポートは `127.0.0.1:4173` に厳密にバインドされ、同一 LAN 内の第三者からの不正アクセスを防ぎます。

### 方法 3 — Pinokio ランチャー

1. [Pinokio](https://desktop.pinokio.co/) をバージョン 8.2 以降にインストールまたは更新します。
2. `odin` を検索するかリポジトリ URL を指定してインストールします。
3. **Install** をクリック後、**Start** を押します。

---

## 🛠️ 設定およびトラブルシューティング

### 画面上からの設定 (Provider Settings)

画面右下の **POWER UP** バッジをクリックします（または `http://localhost:4173/?setup=1` に直接アクセス）。ここから任意の API キーを入力でき、ローカルの `.env` ファイルに安全に保存されます。

### 環境変数 (`.env`)

ヘッドレスサーバーや自動化環境では、雛形から設定ファイルを作成します：

```bash
cp .env.example .env
```

主な環境変数：
- `PORT=4173` — Web サーバーの待受ポート。
- `HOST=127.0.0.1` — 待受インターフェース（LAN 内共有時のみ `0.0.0.0` に設定）。
- `GEV_ALLOWED_HOSTS=localhost,127.0.0.1` — 許可する HTTP Host ヘッダー。
- `GEV_ETHAN_API_URL=http://localhost:8000` — ローカル ETHAN プラットフォームの URL。
- `GEV_ETHAN_API_KEY=` — ETHAN 認証トークン。
- `OPENAI_API_KEY=` — クラウド音声機能・要約用の OpenAI キー。
- `CESIUM_ION_TOKEN=` — Google 3D タイルおよび地形を利用するための無料 Cesium ion トークン。
- `GOOGLE_MAPS_API_KEY=` — Google Maps 3D タイルおよびストリートビューを直接利用するためのキー。
- `AISSTREAM_API_KEY=` — リアルタイム船舶追跡用の無料キー。

### トラブルシューティング

1. **Docker での権限エラー (`EACCES` on `.env` / `.gev-cache`)：**
   - 原因：過去に `root` ユーザー権限でコンテナが実行されたことによるファイルの所有者不一致。
   - 対策：必ず `env UID=$(id -u) GID=$(id -g) docker compose up` で起動してください。
2. **地球の描画が重い・フレームレートが低下する：**
   - 原因：ブラウザのハードウェアアクセラレーションが無効、または WebGL が CPU ソフトウェア描画（SwiftShader 等）にフォールバックしています。
   - 対策：ブラウザ設定で「ハードウェアアクセラレーション」を有効化し、`chrome://gpu` 等で確認してください。
3. **設定画面で「Loopback Only」と表示されて保存できない：**
   - 原因：外部 IP やリバースプロキシ経由でアクセスしています。
   - 対策：ホスト上の `.env` を直接編集するか、[SECURITY.md](SECURITY.md) に従って `GEV_KEY_SETUP_TRUSTED_PEERS` を設定してください。
4. **交通情報や ALPR カメラレイヤーが表示されない：**
   - 原因：OpenStreetMap の公開 Overpass サーバーによるレート制限。内蔵プロキシが自動キャッシュします。`npm run dev` で再起動してください。

---

## 🛰️ 地球上のデータレイヤー

20 のインテリジェンスレイヤーを統合。**18 レイヤーは API キーなしで完全動作します。**

| レイヤー名 | 提供される情報と機能 | データ提供元 | 認証レベル |
| :--- | :--- | :--- | :--- |
| 🗺️ **マップスタック** | Esri 衛星画像、Google 3D タイル、OpenStreetMap | Esri / Google / Cesium ion / OSM | 🟢 Esri + OSM<br>🟡 Ion Google 3D (無料登録)<br>🔴 Google 3D 直結 (従量課金) |
| ✈️ **ライブフライト** | 11,000 機以上の民間航空機と航跡履歴 | OpenSky Network & adsb.lol | 🟢 キー不要 (🟡 OpenSky アカウントで制限緩和) |
| 🎖️ **軍用航空機** | 軍用機、空中給油機、輸送機、エマージェンシースクオーク | adsb.lol (フィルタ済み ADS-B) | 🟢 キー不要 |
| 📡 **GNSS 健全性** | 衛星航法信号の地域別精度および障害アノマリー | adsb.lol & GPSJAM | 🟢 キー不要 |
| 🚢 **ライブ船舶** | 全世界の貨物船、タンカー、旅客船、タグボート追跡 | AISStream.io | 🟡 無料登録キー |
| 🛰️ **人工衛星** | 830 機以上の衛星の SGP4 リアルタイム軌道（Starlink 含む） | CelesTrak | 🟢 キー不要 |
| 🌍 **世界地震情報** | 過去 24 時間に発生した世界中の地震活動 | USGS (米地質調査所) | 🟢 キー不要 |
| 🔥 **火災検出** | MODIS および VIIRS による全世界の熱異常検出 | NASA FIRMS | 🟡 無料登録キー |
| 📹 **CCTV カメラ網** | 3D 都市空間に投影される 4,000 台以上の公共交通カメラ | TxDOT, Caltrans, TfL, Fintraffic など | 🟢 キー不要 |
| 🚗 **道路交通流** | 実道路網に沿って走行するシミュレーション車両 | OpenStreetMap + TomTom Flow | 🟢 模擬交通<br>🟡 TomTom リアルタイム実測渋滞速度 |
| 📷 **ストリートレベル** | パノラマ写真と視野コーン | Mapillary, Google, KartaView, Panoramax | 🟢 KartaView, Panoramax<br>🟡 Mapillary<br>🔴 Google |
| 📻 **世界のラジオ** | 750 局以上のラジオ局を聴取できるアナログ風チューナー | Radio Browser | 🟢 キー不要 |
| 🚌 **公共交通** | バス、トラム、鉄道、フェリーのリアルタイム位置追跡 | 各運行事業者の GTFS-RT | 🟢 キー不要 |
| 🚲 **シェアサイクル** | サイクルポートの位置とリアルタイム空き台数 | 各地の GBFS フィード | 🟢 キー不要 |
| 🧭 **ルート案内** | 車・自転車・徒歩のターンバイターン経路とドローン視点飛行 | OSRM / FOSSGIS | 🟢 キー不要 |
| 🚀 **宇宙開発ミッション**| 直近 30 日間のロケット打上げと軌道投入リプレイ | Launch Library 2 | 🟢 キー不要 (🟡 トークンで制限緩和) |
| 🎖️ **軍事施設マッピング**| 有志によってマッピングされたレーダー基地や軍用施設 | OpenStreetMap | 🟢 キー不要 |
| 🌬️ **風ベクトル** | 高度 10m の風向風速粒子アニメーション | NOAA GFS / ECMWF IFS | 🟢 キー不要 |
| 🌦️ **気象レーダー** | 雨雲レーダー、赤外線雲画像、落雷位置オーバーレイ | NOAA nowCOAST | 🟢 キー不要 |
| 🌀 **熱帯低気圧** | 台風やハリケーンの進路予想、勢力、予報円コーン | NOAA NHC / CPHC | 🟢 キー不要 |

_凡例：_ 🟢 **キー不要** · 🟡 **無料登録キー** · 🔴 **従量課金キー**

---

## 🤖 AI 機能：ローカル ETHAN とクラウドモデル

Odin は、空間状況の要約、エンティティに関する質問応答、完全な音声ハンズフリー操作に対応しています。

### 1. ETHAN によるローカル主権型インテリジェンス（Seclib 拡張）

機密性の高いインフラや完全閉域網向けに、Odin は **ETHAN** とネイティブ統合されています：
- HUD の戦術的要約はローカルの ETHAN サーバー (`GEV_ETHAN_API_URL=http://localhost:8000`) に問い合わせます。
- 画面内の座標、高度、有効レイヤー、周辺の軍用コンタクト情報を状況ブリーフィングに整形し、ローカルで推論。
- **データ外部送信ゼロ：** プロンプト、座標、カメラ画像が外部ネットワークへ送信されることは一切ありません。

### 2. クラウドリアルタイム音声操作 (OpenAI)

- **OpenAI Realtime API** (WebSocket) による極低遅延の自然言語音声対話。
- **厳格な安全予算リミット：** 1 セッションあたり **$5.00** の強制停止リミット、$2.00 での事前警告、リアルタイム費用モニターを搭載。
- 30 種類の空間操作ツールに対応：
  - _操縦：_ 「東京へ移動して」「港の周囲をゆっくり旋回して」
  - _注釈：_ 「テキサス州の境界線を囲んで」「パリからマルセイユまでの直線距離を測って」
  - _分析：_ 「ドーバー海峡にいるタンカーは何隻？」「3万フィート以上を飛ぶ軍用機を表示して」
  - _制御：_ 「FLIR 熱画像モードに切り替えて」「一番近い飛行機のコックピット視点に入って」

### 3. Model Context Protocol (MCP) サーバー

Odin は業界標準の MCP ツールサーバーとして機能します。Claude Desktop、Codex、ChatGPT などの AI 開発ツールから地球儀を自動操作・分析可能です。詳細は [docs/MCP_SETUP.md](docs/MCP_SETUP.md) をご覧ください。

---

## 🔒 プライバシー、セキュリティモデル、ネットワーク通信

Odin は多層防御の理念に基づいて設計されています：

### 1. 完全なローカルファースト実行
- Odin には **テレメトリ、追跡ピクセル、利用状況トラッカーは一切含まれていません**。
- Seclib や原作者に利用統計や診断データが送信されることはありません。
- ブラウザ内で完結して動作し、ローカルサーバーおよびユーザーが明示的に有効にしたデータプロバイダーとのみ通信します。

### 2. 秘密鍵のサーバー側完全隔離
秘密鍵（`OPENAI_API_KEY`、`AISSTREAM_API_KEY`、`OPENSKY_CLIENT_SECRET`、`GEV_ETHAN_API_KEY`）が **ブラウザに送信されることは決してありません**。
- フロントエンドはローカルプロキシ (`/api/vessels`, `/api/flights`, `/api/realtime/token`) とのみ通信します。
- WebSocket 用には有効期間が極めて短いワンタイムセッショントークンを都度発行。
- すべてのプロキシに SSRF フィルター、レスポンスサイズ制限、厳格なタイムアウトを実装。

### 3. ブラウザへ渡される公開キーとその制限
以下の 3 つのキーのみ、ブラウザの WebGL 描画のためにクライアント側に注入されます：
- `GOOGLE_MAPS_API_KEY` (Google 3D タイル & Maps JavaScript API)
- `CESIUM_ION_TOKEN` (Cesium ion 3D タイル & 地形)
- `MAPILLARY_CLIENT_TOKEN` (Mapillary パノラマビューア)

> [!WARNING]
> これらのキーはブラウザの開発者ツールで確認できるため、**必ずプロバイダー側の管理画面で制限を設定してください**：
> - **Google Cloud Console：** HTTP リファラー制限 (`http://localhost:4173/*` または運用ドメイン) および API 制限 (**Map Tiles API** と **Maps JavaScript API** のみ)。
> - **Cesium ion：** 許可オリジン URL の制限と `assets:read` 権限への限定。

### 4. 厳格な倫理指針
Odin は物理インフラ、機器、航空機・船舶、自然現象、公共センサー網を可視化するために作られています。
- **個人追跡の完全拒絶：** 人の顔認識、ナンバープレートからの個人特定、個人を追跡する機能は一切含まれておらず、そのような Pull Request も受け入れられません。

---

## 🗂️ データソースと外部依存関係

Odin は**公開オープンデータフィード**と**ローカルレンダリング**を統合します。MIT ライセンスはアプリケーションコードのみをカバーし、外部データやビジュアルアセットには適用されません。各プロバイダーは独自のライセンスと規約を保持します。

### ライブソース（実行時に取得）

| ソース | 用途 | ライセンス / 規約 |
| --- | --- | --- |
| NOAA GFS（風） | グローバル風モデル | 公共分野（NOAA の AWS データ） |
| ECMWF IFS（風） | 代替風モデル | CC BY 4.0 + ECMWF 利用規約 |
| NOAA nowCOAST | レーダー、雲の赤外線、落雷 | 公共分野 |
| OpenSky Network | ADS-B 航空機位置 | フリーティア ; 規約適用 |
| adsb.lol | フィルタリング済み ADS-B（軍、警察飛行） | フリー ; 規約適用 |
| AISStream.io | 船舶追跡 | フリーティア ; 規約適用 |
| CelesTrak | 軌道要素（TLE） | NASA 公開データ |
| USGS Seismology | グローバル地震データ | 公共分野 |
| NASA FIRMS | 活火山検知 | 公共分野（引用を要求） |
| OpenStreetMap | 道路網、自転車シェア、交通 | ODbL 1.0 |
| TomTom Flow | 交通流速度 | 利用規約適用（`docs/OSRM-FOSSGIS.md` 参照） |
| Mapillary / KartaView / Panoramax | ストリートレベル映像 | 混合ライセンス ; DATA_SOURCES.md 参照 |
| Radio Browser | 地理位置情報付きラジオ局 | フリー ; 規約適用 |
| GTFS-Realtime フィード | リアルタイム公共交通車両位置 | オペレーター規約 |
| GBFS フィード | 自転車シェア可否 | オペレーター規約（DATA_SOURCES.md 参照） |
| OSRM / FOSSGIS | 経路とターン別ナビゲーション | フリー ; ODbL |
| Launch Library 2 | ロケット打ち上げスケジュール | フリーティア ; 規約適用 |
| TeleGeography 海底ケーブルマップ（同梱） | ケーブルマップ可視化 | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) — 非営利 + 継承 |

### 同梱データ（リポジトリに格納）

- **`src/data/local_data/`** — 同梱データセット（TeleGeography ケーブルマップ、OpenStreetMap 抽出、イベント映像など）
- **`public/models/`** — 個別のライセンスを持つ 3D モデル（[`public/models/README.md`](public/models/README.md) 参照）

### 外部依存関係

- **npm パッケージ** — [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) および `package-lock.json` に記録
- **Cesium ion** — 3D タイル用オプションアクセストークン ; フリー tier 可用
- **Google Maps Platform** — 3D タイルとストリートビュー用オプション API キー
- **クラウド AI プロバイダー** — OpenAI（任意）クラウドボイスおよびシーンのサマリー用 ; ソブリン代替としてローカル ETHAN

> [!CAUTION]
> **ライセンス境界：** MIT ライセンスはソースコードのみをカバーします。同梱データ（TeleGeography CC BY-NC-SA 3.0、Bhote Koshi イベント映像 CC BY-NC 4.0）は非商用です。使用に合わないデータセットは削除するか、必要な許可を取得してください。詳細は [NOTICE.md](NOTICE.md) を参照。

## 📜 ライセンスと知的財産権の境界

Odin はコードのライセンスとデータの権利関係を厳格に区別しています：

- **ソースコード：** **[MIT License](LICENSE)** に基づいて公開。Copyright © 2026 Bilawal Sidhu & Sameh Khamis (Halfpixel)、Seclib によるフォーク部分 Copyright © 2026 Seclib。
- **第三者データと非商用制限付き資産：**
  - **TeleGeography 海底ケーブルマップ：** [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) (非商用、継承)。
  - **Bhote Koshi 洪水データセット：** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (非商用)。
  - **3D モデル資産：** 個別ライセンスは [`public/models/README.md`](public/models/README.md) に記載。
  - **プロモーション素材：** 画像や動画の権利は原著作権者に帰属します；詳細は [`docs/media/README.md`](docs/media/README.md)。
  - **ライブデータフィード：** 各データ提供事業者の利用規約に従います。

法的通知の全文については [NOTICE.md](NOTICE.md) をご参照ください。

---

## 🤝 貢献、セキュリティ脆弱性の報告、アップデート

### コードへの貢献

安定性向上、パフォーマンス改善、新規データアダプター、多言語対応への貢献を歓迎します：
1. ユニットテストの合格確認：`npm test`。
2. 多言語翻訳整合性の確認：`npm run i18n`。
3. アーキテクチャ境界の確認：`npm run check:boundaries`。
4. [CONTRIBUTING.md](CONTRIBUTING.md) のコーディング規約を確認。

### 脆弱性の報告窓口

セキュリティ上の問題を発見された場合は、**非公開で** ご報告をお願いいたします：
- GitHub Security Advisory: `https://github.com/seclib/odin/security/advisories/new`
- またはセキュリティチーム宛メール：**security@seclib.org**
- 悪用可能な脆弱性を公開 Issue に投稿しないでください。48 時間以内に確認対応を行います。

### アップデート手順

ローカルの Odin を最新版に更新する方法：

```bash
# Git / Node.js 環境：
git pull origin main
npm ci
npm test

# Docker Compose 環境：
git pull origin main
docker compose down -v
docker compose up --build
```

---

<div align="center">

**Odin — 主権型 3D 地球空間インテリジェンス** · [Seclib](https://github.com/seclib) により保守  
_Bilawal Sidhu および Sameh Khamis による God's Eye View のフォーク_

</div>


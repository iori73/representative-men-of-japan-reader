# Podcast エピソードカバー デザインガイドライン

「Bilingual Books バイリンガルで本を聴く」番組配下の全ての本(茶の本・代表的日本人・以降の新刊)
で使う、エピソードカバー画像の正の仕様。**河野はFigmaを直接編集せず、Claudeがこのドキュメントに
従って`use_figma`で自動生成する。**

## 正のFigmaファイル

- File key: `t1TmZXTMJG8QpnIyEwnXBu` (Thumbnail-Icon-WIP)
- Page: `spotify podcast` (node `619:1467`)
- **canonical master frame**: `676:1554`(セクション「0930 2008」内、フレーム名"3")
  - 常にこのフレームを`clone()`の起点にする。他の古い試作フレーム(`619:1469`, `653:42`,
    `657:195` 等)は履歴として残置されているだけで、正ではない
  - このマスターは **1280×1280に固定**しておく(後述の「書き出し手順」を参照。
    絶対に`rescale()`で恒久的に拡大しない)

## 構造(ノード階層)

マスターフレーム(1280×1280、名前は書籍によって異なってよい)の直下:

```
frame "cover" (1280x1280)
├── frame "title" (x=80, y=80, w=1078, VERTICAL auto-layout, itemSpacing=40, 左寄せ)
│   ├── text "#N"                          (話番号)
│   └── frame "title-block" (VERTICAL, itemSpacing=0, 左寄せ)
│       ├── text (その回のタイトル JP)
│       └── text (その回のタイトル EN)
└── frame "Frame 4" (x=80, y=734, **w=1120 固定**, VERTICAL auto-layout, 右寄せ)
    ├── frame "title-block" (**w=1120 固定**, VERTICAL, 右寄せ)
    │   ├── text (書籍タイトル JP)          textAlignHorizontal="RIGHT"
    │   └── text (書籍タイトル EN)          textAlignHorizontal="RIGHT"
    └── frame "Frame 15" (**w=1120 固定**, VERTICAL, 右寄せ)
        ├── text (著者名 JP)                textAlignHorizontal="RIGHT"
        └── text (著者名 EN)                textAlignHorizontal="RIGHT"
```

`cover`フレームの背景色(fills[0])が、その書籍のブランドカラーを持つ唯一のノード。

### 重要な既知の不具合と修正済みの対策

初回実装では「Frame 4」とその子を**HUG(自動幅)+右寄せコンテナ**にしていたところ、
書名が長い(例: "Representative Men of Japan")と、フレームが**左方向に**hugして
cover(1280幅)の外にはみ出し、文字の先頭側が見切れるバグが発生した。

**対策(必ずこの通りにする)**: `Frame 4`・その子`title-block`・`Frame 15`は
**`counterAxisSizingMode = "FIXED"`、幅=1120(=1280-80×2)に固定**し、
中の各テキストノードは`textAutoResize = "HEIGHT"`(幅固定・折り返し可)+
`textAlignHorizontal = "RIGHT"`で右寄せを実現する。auto-layoutのHUGに頼らない。
長い書名は自動的に2行に折り返される(想定内、崩れない)。

## タイポグラフィ

全テキスト: **Work Sans, Regular** (`{family: "Work Sans", style: "Regular"}`)

| 要素 | fontSize | 色 | opacity |
|---|---|---|---|
| 話番号 `#N` | 104 | 白 (1,1,1) | 0.92 |
| その回のタイトル JP | 104 | 白 | 0.92 |
| その回のタイトル EN | 104 | 白 | 1.0 |
| 書籍タイトル JP | 104 | 白 | 1.0 |
| 書籍タイトル EN | 104 | 白 | 1.0 |
| 著者名 JP | 80 | 白 | 0.8 |
| 著者名 EN | 80 | 白 | 0.8 |

## カラー(書籍ごとのブランドカラー)

`cover`フレームの`fills`を **`{type:"SOLID", color: <書籍固有の色>, opacity: 0.5}`** にする。
0.5固定の半透明により、どの色でも同系統の淡いトーンに統一される。

| 書籍 | ベースカラー (0-1 RGB) | 備考 |
|---|---|---|
| 茶の本 (The Book of Tea) | `{r:0.455, g:0.498, b:0.294}` | 抹茶グリーン |
| 代表的日本人 (Representative Men of Japan) | `{r:0.145, g:0.263, b:0.451}` | 紺 |
| 次の新刊 | **未使用の新しい色相を選ぶ** | 書籍ごとに見分けがつくよう、既存と被らない色相を選定する |

## 書き出し手順(マスターは1280のまま、絶対に恒久変更しない)

Spotify/Apple Podcastsは3000×3000を推奨するが、マスターフレームを直接`rescale()`すると
デザインファイルが壊れる(実際に一度やってしまい、後で1280に戻した)。**必ず一時複製方式を使う**:

1. `master.clone()` で複製を作り、ページ直下に`appendChild`
2. 複製のみ `dup.rescale(3000 / dup.width)` で3000×3000化
3. `get_screenshot({ nodeId: dup.id, maxDimension: 3000, contentsOnly: true })` で書き出し
4. `curl`でPNGを保存
5. **複製を`.remove()`で必ず削除**する(マスターは1280のまま維持)

## 新しい本のエピソードカバーを量産する手順(Claude向け)

1. このドキュメントの「カラー」表に新しい書籍の色を追記する(他と被らない色相を選ぶ)
2. `use_figma`で以下を1回のスクリプトで実行:
   - `figma.getNodeByIdAsync("676:1554")` でcanonical masterを取得
   - 新しいSectionを`figma.createSection()`で作成(命名: `"<書籍名> — Episode Covers"`)、
     ページ内の空いている場所に配置(既存セクションと重ならない y座標を計算する)
   - 各話について: `template.clone()` → 話番号・話タイトルJP/EN・書籍タイトルJP/EN・
     著者名JP/EN を書き換え → `cover.fills`を書籍の色に変更
   - フレーム間隔は**pitch = 1320px**(1280幅+40ギャップ)を厳守
3. 全話をスクリーンショットで目視確認(文字切れ・重なりがないか)
4. 「書き出し手順」に従って3000×3000で書き出し、各プロジェクトの`artwork/episode-cover-NN.png`に保存
5. gitで各リポジトリにコミット

## 現在の実装状況

- 茶の本: `book-of-tea-reader/artwork/episode-cover-01.png` 〜 `07.png` (Figma node: セクション`676:1571`)
- 代表的日本人: `representative-men-of-japan-reader/artwork/episode-cover-01.png` 〜 `06.png`
  (Figma node: セクション`679:195`「Representative Men of Japan — Episode Covers v2」)
- 古い試作(`619:1469`単体, `653:42`系, `660:2429`セクション, `662:195`セクション,
  `672:195`セクション)はFigma上に履歴として残っているが、**正ではない**。混同しないこと

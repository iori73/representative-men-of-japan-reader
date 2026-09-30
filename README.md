# representative-men-of-japan-reader

内村鑑三(Kanzo Uchimura)「代表的日本人」(Representative Men of Japan, 1908) を、
日本語→英語の対訳チャンクで交互に読めるバイリンガル読書サイト。
姉妹プロジェクト [book-of-tea-reader](https://github.com/iori73/book-of-tea-reader) と同一の
静的HTML/CSS + 軽量Nodeビルドスクリプト構成。

## 出典・著作権

- **英語原文**: Kanzo Uchimura, *Representative Men of Japan* (1908, The Keiseisha, Tokyo)。
  内村鑑三自身が英語で執筆した原著(1894年の "Japan and the Japanese" を改訂・改題)。
  著者は1930年没につき著作権保護期間満了、パブリックドメイン。
  実物スキャン・OCRテキストは Internet Archive (`representativeme00uchirich`) に基づく
- **日本語訳**: **既存の日本語訳は使用していない。** 現在流通している「代表的日本人」の邦訳
  (岩波文庫版・鈴木範久訳など)は著作権保護期間内と考えられるため使用を避け、
  英語原文からClaudeが新規に翻訳したものを収録している。青空文庫にも本書の邦訳は無い
  (2026年9月時点で確認済み)
- 上記の理由により、対訳データの再配布・公開に問題はないと判断している

## 構成

```
data/chunks/*.chunks.json   対訳チャンクデータ (章ごと、{jp, en, para_break} の配列)
data/chunks/chapters.json   章マニフェスト (自動生成)
src/build.mjs               ビルドスクリプト。book-of-tea-readerと同一構造
src/styles/                 デザイントークン・基本スタイル(book-of-tea-readerと共通)
src/js/read-aloud.js        Web Speech APIによる読み上げ
src/js/reading-progress.js  読書位置の記憶(localStorage)
public/images/icons/        章アイコン (フラットSVG、6点: 序文+5評伝)
scripts/make_manifest.py    chapters.json生成スクリプト
```

## ビルド・ローカル確認

```bash
npm run build   # dist/ に生成
npm run serve   # ビルド + ローカルサーバ起動 (http://localhost:8090)
```

## 翻訳について

英語原文はInternet ArchiveのOCRテキストを使用しており、スキャン由来のノイズ
(単語の分断・誤認識文字・原文中の日本語引用箇所がOCRで判読不能な文字列になっている箇所)が
含まれていた。翻訳時にこれらをクリーニングし、判読不能な断片は翻訳を捏造せず省略している。
日本語訳は逐語訳ではなく、内村の文語調・情熱的な文体を保ちながら現代日本語として自然に読める訳文を目指した。

## 公開について

GitHub Pages で公開予定。実際にリポジトリをpublic化してGitHub Pagesを有効化する操作は、
河野の最終判断を待ってから行う(ai-ops CLAUDE.md §3: 公開コンテンツの最終Publishは人間判断)。

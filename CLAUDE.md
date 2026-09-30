# representative-men-of-japan-reader — 「代表的日本人」バイリンガル読書サイト

## プロジェクト概要

- **目的**: 公開 (GitHub Pages)
- **スタック**: 静的HTML/CSS + 軽量Nodeビルドスクリプト(Reactなし)。book-of-tea-readerと同一のパイプラインを流用
- **ローカルパス**: `~/Documents/representative-men-of-japan-reader/`

内村鑑三『Representative Men of Japan』(1908年、内村自身が英語で執筆・パブリックドメイン)を、
日本語→英語の対訳チャンクで読めるサイト。序文+5評伝(西郷隆盛・上杉鷹山・二宮尊徳・中江藤樹・日蓮)。

**日本語訳について**: 既存の日本語訳(岩波文庫の鈴木範久訳など)は著作権が生きている可能性が高いため使用せず、
英語原文からClaudeが新規に翻訳した。詳細は README.md「出典・ライセンス」参照。

## ai-ops 連携

このプロジェクトは **ai-ops** (`~/Documents/ai-ops/`) の個人プロジェクトです。
Claude が積極的に介入してよい(コード変更・機能追加・バグ修正)。

姉妹プロジェクト: `~/Documents/book-of-tea-reader/` (同一パイプライン、岡倉覚三『茶の本』)

## 方針

- シンプルに保つ。book-of-tea-readerのbuild.mjs/CSS/JSをそのまま流用し、内容(タイトル・アイコン・著者情報)だけ差し替えている
- 公開前(GitHub Pages公開)は河野の最終判断を仰ぐ(ai-ops CLAUDE.md §3)

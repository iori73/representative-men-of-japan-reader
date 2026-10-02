#!/usr/bin/env python3
"""Build per-episode show notes markdown from chapters.json. Unlike the Book of
Tea project, Uchimura's essays have no official per-chapter synopsis to draw
from, so both the JP and EN descriptions here are original summaries written
for this podcast — not presented as Uchimura's own words.
"""
import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAPTERS = json.load(open(os.path.join(REPO, "data", "chunks", "chapters.json"), encoding="utf-8"))
OUT_DIR = os.path.join(REPO, "shownotes")
os.makedirs(OUT_DIR, exist_ok=True)

DESCRIPTIONS = {
    "00_prefatory_note": {
        "jp": "1908年版の序文。内村が「日本及び日本人」(1894年)を改訂した経緯と、"
              "日本人の美点を外の世界に伝えたいという執筆の動機を語る短い前書き。",
        "en": "Uchimura's 1908 preface: why he revised his 1894 book, and his hope "
              "to show the West a side of Japan beyond loyalty and patriotism.",
    },
    "01_saigo_takamori": {
        "jp": "西郷隆盛の生涯を通じて「新日本の建設者」を描く。明治維新の立役者でありながら、"
              "最後は反乱者として死んだ西郷の矛盾と道徳性を内村が論じる。",
        "en": "The life of Saigo Takamori — revolutionary founder of modern Japan, "
              "who ended his life as a rebel against the government he helped create.",
    },
    "02_uesugi_yozan": {
        "jp": "困窮した米沢藩を立て直した名君・上杉鷹山の改革を描く。倹約と率先垂範による、"
              "封建領主としての統治のあり方。",
        "en": "Uesugi Yozan, the feudal lord who rescued his bankrupt domain through "
              "austerity, personal example, and relentless practical reform.",
    },
    "03_ninomiya_sontoku": {
        "jp": "貧しい農家に生まれ、独学と勤勉により数百の村を再建した二宮尊徳の生涯。"
              "「報徳」の思想と、農民出身の聖人としての評価。",
        "en": "Ninomiya Sontoku, born a poor farmer, who rebuilt hundreds of "
              "villages through self-taught discipline and his philosophy of repaying virtue.",
    },
    "04_nakae_toju": {
        "jp": "近江聖人と呼ばれた村の教師・中江藤樹。陽明学を実践し、無名のまま郷里で"
              "生きた彼の思想と人格の影響力を内村が論じる。",
        "en": "Nakae Toju, the humble village teacher known as the Sage of Omi, "
              "and how a quiet life of principle outlasts fame.",
    },
    "05_nichiren": {
        "jp": "鎌倉時代の仏僧・日蓮の激しい生涯。既存の仏教を批判し迫害を受けながらも、"
              "日本独自の仏教宗派を打ち立てた情熱と頑なさを内村が複雑な視線で描く。",
        "en": "The fiery life of the medieval Buddhist priest Nichiren — persecuted, "
              "uncompromising, and the founder of Japan's only homegrown Buddhist sect.",
    },
}


def main():
    for c in CHAPTERS:
        slug = c["slug"]
        desc = DESCRIPTIONS[slug]
        title_jp_short = c["jp_title"].split("　", 1)[-1] if "　" in c["jp_title"] else c["jp_title"]
        body = f"""# 第{c['num']}回　{title_jp_short} / {c['en_title']}

**{c['jp_title']} / {c['en_title']}** (Representative Men of Japan, 内村鑑三)

{desc['en']}

## この回について

{desc['jp']}

## 出典・ライセンス

英語原文: Kanzo Uchimura, *Representative Men of Japan* (1908, public domain)。
日本語訳: 既存訳は使用せず、英語原文からiori/Claudeが新規に翻訳。
音声: Google Cloud Text-to-Speech(公開・再配布が利用規約で許可されたサービス)。制作: iori。

読書サイト(対訳・読み上げ付き): https://iori73.github.io/representative-men-of-japan-reader/chapters/{slug}.html
"""
        out_path = os.path.join(OUT_DIR, f"{slug}.md")
        open(out_path, "w", encoding="utf-8").write(body)
        print("wrote", out_path)


if __name__ == "__main__":
    main()

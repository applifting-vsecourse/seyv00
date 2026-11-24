# 0002 — Lajky jako řádky v tabulce `quack_like`, počet se počítá při čtení

- **Status:** Přijato
- **Datum:** 2026-11-24
- **Souvisí s:** [cases.md](../../cases.md); [ADR 0001](0001-placeholder-misto-smazani.md) (placeholder smazaného quacku)

## Kontext

Product owner chce u každého quacku tlačítko „Like“ a počet lajků. Každý může quack lajknout jen jednou a lajk vzít zpět. Z případů v [cases.md](../../cases.md) plynou tyto požadavky na uložení dat:

- **Jen jednou, i souběžně.** Druhý lajk od stejného člověka počet nezvýší (R2, A3), ani když dva požadavky přijdou ve stejný okamžik (A9). Dva různí lidé ve stejný okamžik dají počet 2 (A8).
- **Kdo lajkl, se musí vědět, ale neukazuje se.** Každý quack nese `likeCount` a `likedByMe` pro toho, kdo se dívá (R7, A5). Seznam lidí, kteří lajkli, API nevrací.
- **Opakování není chyba.** `PUT` i `DELETE /api/quacks/:id/like` jsou idempotentní a vracejí stav po požadavku (A3, A4).
- **Lajky mizí s tím, k čemu patří.** Se smazaným quackem, odpovědí i účtem (A12, A13). Placeholder smazaného quacku podle ADR 0001 nesmí nést nic z původního obsahu, takže ani lajky. Lajknout ho nejde (R11, A11).
- **Počet je všude, kde je quack:** feed, ukázka odpovědí ve feedu, „Mine“, vyhledávání (raw SQL s `unaccent` vrací jen `id`, quacky se pak načítají přes Prisma) a stránka vlákna (A15). Lajky nemění pořadí (A14).

Repository už dnes počítá odpovědi přes Prisma `_count` ve společném `include` a jednou volbu uživatele na quack ukládá v `PollVote` s `@@id([quackId, userId])`.

## Rozhodnutí

1. **Každý lajk je řádek** v nové tabulce `quack_like` (model `QuackLike`): `quackId`, `userId`, `createdAt`.
   - Primární klíč je `@@id([quackId, userId])`. Jeden lajk na člověka a quack hlídá databáze, ne jen aplikace, stejně jako u `PollVote`.
   - Index `@@index([userId])` slouží mazání účtu.
   - Obě vazby mají `onDelete: Cascade`. Hard delete quacku, odpovědi nebo účtu smaže i jeho lajky bez dalšího kódu.
2. **Počet se nikde neukládá, počítá se při čtení.**
   - `likeCount` se načítá přes `_count: { select: { likes: true } }` ve stejném `include` jako `replyCount`.
   - `likedByMe` je tatáž relace filtrovaná na aktuálního uživatele (`where: { userId }`, `take: 1`).
   - Primární klíč začíná `quackId`, takže obojí je hledání v indexu.
3. **Zápis je idempotentní.**
   - Lajk je `INSERT … ON CONFLICT DO NOTHING`, odebrání `deleteMany` podle `quackId` a `userId`.
   - Odpověď obsahuje počet načtený ve stejné transakci po zápisu.
4. **Lajknout jde jen živý quack.**
   - Transakce lajku nejdřív zamkne řádek quacku (`SELECT … FOR SHARE`) a zkontroluje, že existuje a nemá `deletedAt`, jinak vrátí 404.
   - Mazání quacku ho už zamyká `FOR UPDATE`, takže lajk, který souběžně přijde během převodu na placeholder, počká a pak dostane 404, místo aby se uložil k placeholderu.
5. **Placeholder lajky ztrácí.**
   - Převod quacku s odpověďmi na placeholder (ADR 0001) ve stejné transakci smaže i jeho lajky, vedle smazání ankety.
   - Mapování do doménového typu navíc pro placeholder vždy hlásí `likeCount: 0, likedByMe: false`.

## Zvažované varianty

| Varianta                                                            | Proč zamítnuta                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tabulka `quack_like`, počet při čtení** (zvoleno)                 | —                                                                                                                                                                                                                                                                                                          |
| Jen počítadlo `Quack.likeCount`                                     | Neví, kdo lajkl. Nejde zabránit druhému lajku od stejného člověka ani odpovědět na `likedByMe` (porušuje R2, R3, R7, A3, A9). Informaci „kdo lajkl“ by pak už nešlo dodatečně získat.                                                                                                                      |
| Tabulka a k tomu počítadlo `Quack.likeCount`, které udržuje trigger | Dva zdroje pravdy pro jedno číslo. Rychlejší čtení ani řazení podle lajků teď nepotřebujeme (řazení je mimo scope). Trigger a úprava `quack_placeholder_check` (`like_count = 0`) by byly další ruční SQL mimo Prisma, které je nutné hlídat při každé změně tabulky. Dá se doplnit později, viz Důsledky. |
| Tabulka a počítadlo, které udržuje aplikace                         | Kaskádové mazání (účet, A13) obchází aplikační kód, takže počítadlo by potichu zastaralo. Souběžné lajky by musely počítadlo měnit atomicky a jen tehdy, když se řádek opravdu vložil nebo smazal.                                                                                                         |
| Pole `likedBy String[]` přímo na `quack`                            | Pole nemá cizí klíč, takže smazání účtu ho nevyčistí. Dva souběžné lajky by si navzájem přepsaly změnu. Počet by znamenal načíst celé pole.                                                                                                                                                                |
| Náhodné `id` jako primární klíč a `@@unique([quackId, userId])`     | Funguje stejně, ale `id` nic nepřidává. Konvence projektu (`PollVote`) je složený primární klíč.                                                                                                                                                                                                           |

## Důsledky

**Pro zbytek aplikace:**

- **Každé čtení quacků potřebuje uživatele, který se dívá**, kvůli `likedByMe`. Metody repository pro feed, „Mine“, vyhledávání, vlákno i ukázku odpovědí dostanou jeho `id`. To se týká i budoucích dotazů (profily, notifikace, exporty): quack bez `likeCount` a `likedByMe` je neúplný.
- **Kdo lajkl, je osobní údaj, který je v databázi, ale ne v API.** Response DTO nesmí vracet relaci `likes`, jen `likeCount` a `likedByMe`. Kdo bude chtít seznam lidí ukázat, musí to rozhodnout znovu (v cases.md je to mimo scope).
- **Placeholder (ADR 0001) má nově ještě jednu věc, kterou je nutné při převodu smazat.** Kdo bude ke quacku přidávat další data patřící uživatelům, musí stejně upravit transakci převodu na placeholder.
- **Výkon:** každé načtení feedu spočítá lajky každého quacku (`COUNT` přes index primárního klíče). Pro dnešní velikost aplikace to stačí. Až by feed byl velký nebo by se řadilo podle lajků, je tu cesta níže.

**Vratnost:**

- **Doplnit počítadlo je snadné.** Stačí migrace, která přidá `Quack.likeCount`, naplní ho z `quack_like` a přidá trigger. Data o lajcích zůstávají úplná, takže nic se neztratí.
- **Jiné reakce než lajk** (mimo scope) by znamenaly přidat sloupec `type` a změnit primární klíč na `(quackId, userId, type)`. Stávající řádky by se staly reakcí „like“, migrace dat je přímá.
- **Zrušit tabulku je jednosměrné.** Kdo lajkl co, by se ztratilo. Proto je potřeba toto ADR zkontrolovat před každou změnou modelu lajků.

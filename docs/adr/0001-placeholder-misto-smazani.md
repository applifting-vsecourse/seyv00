# 0001 — Smazaný quack s odpověďmi se stává prázdným placeholderem

- **Status:** Přijato
- **Datum:** 2026-11-10
- **Souvisí s:** [story-replies.md](../../story-replies.md), rozhodnutí 2, 3, 6 a 7; migrace `20261110120000_quack_replies`

## Kontext

Se zavedením odpovědí ([story-replies.md](../../story-replies.md)) je odpověď `Quack` s `parentId` odkazujícím na nadřazený quack. Story přitom stanovuje dva požadavky, které jdou proti sobě:

- Odpovědi patří těm, kdo je napsali. Když autor smaže quack, na který už někdo odpověděl, odpovědi zůstanou a vlákno drží pohromadě.
- Když kdokoli smaže svůj quack, jeho obsah z aplikace opravdu zmizí. Nestačí ho skrýt v UI.

Dosud platilo, že každý řádek `quack` má text a autora. Na tom stojí feed, „Mine“, vyhledávání (raw SQL s `unaccent`), mazání a moderace, ankety i mazání účtu. Jakékoli řešení, které nechá v databázi záznam bez obsahu, tento předpoklad porušuje pro celou aplikaci, ne jen pro odpovědi.

## Rozhodnutí

Mazání quacku rozhoduje server (ne UI) takto:

1. **Quack bez odpovědí a každá odpověď** se smažou natvrdo, stejně jako dosud, včetně odpovědí a hlasů ankety.
2. **Top-level quack s odpověďmi** se změní na placeholder. Řádek zůstane se stejným `id`, `createdAt` a místem ve feedu, ale `text`, `mood` a `userId` se nastaví na `NULL`, smažou se možnosti a hlasy ankety a nastaví se `deletedAt`. Autor se neuchovává ani skrytě.
3. **Databáze to hlídá**, nespoléhá se jen na aplikační kód:
   - `parentId` má `ON DELETE NO ACTION`, takže databáze odmítne natvrdo smazat quack, který má odpovědi. Když mazání závodí s novou odpovědí, server zachytí chybu a vytvoří placeholder. Odpověď se tak nikdy neztratí.
   - CHECK `quack_placeholder_check` zajišťuje, že placeholder je „všechno, nebo nic“: buď je `deletedAt` `NULL` a `text` i `userId` jsou vyplněné, nebo je `deletedAt` vyplněné a `text`, `userId`, `mood` i `parentId` jsou `NULL`. Placeholder tedy může být jen top-level quack.
4. **Placeholder bez odpovědí nesmí existovat.** Smazání poslední odpovědi smaže ve stejné transakci i placeholder. Dotazy navíc prázdné placeholdery skrývají i pro případ, že odpovědi zmizely jinou cestou (např. smazáním účtu).

## Zvažované varianty

| Varianta                                                                      | Proč zamítnuta                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Placeholder s obsahem vymazaným a autorem `NULL`** (zvoleno)                | —                                                                                                                                                                                                  |
| Placeholder, který si autora ponechá a UI ho skryje                           | Databáze by pořád tvrdila „tahle osoba sem něco napsala“ a od úniku by to dělilo jedno pole v API. Story chce, aby obsah opravdu zmizel.                                                           |
| Soft delete: celý řádek zůstane, jen se nastaví `deletedAt` a obsah se skryje | Stejný problém v ještě větší míře: text i autor zůstanou v databázi, ve zálohách i ve vyhledávání (raw SQL by musel všude pamatovat na filtr). Požadavek „obsah opravdu zmizí“ nesplňuje.          |
| Hard delete s `ON DELETE SET NULL` na `parentId`                              | Odpovědi ztratí kontext a z vlákna se stanou volně plovoucí quacky. To je přesně dnešní problém s „@name…“. Vazbu už nejde obnovit. Případná chyba by vlákna rozbíjela potichu.                    |
| Hard delete s `ON DELETE CASCADE` na `parentId`                               | Smaže odpovědi jiných lidí, což je v rozporu s požadavkem, že odpovědi patří jejich autorům.                                                                                                       |
| Hard delete s visícím `parentId` bez cizího klíče                             | Databáze přestane hlídat integritu a vlákno nejde načíst, protože jeho kořen neexistuje.                                                                                                           |
| `RESTRICT` místo `NO ACTION`                                                  | `RESTRICT` se kontroluje uprostřed kaskády. Smazání účtu, jehož quack má jen odpovědi téhož člověka, by selhalo, i když by nakonec zmizelo všechno. `NO ACTION` se kontroluje až na konci příkazu. |
| Uzamknout vlákno po smazání kořene                                            | Autor by mohl ukončit diskusi, která se mu nelíbí, tím, že smaže první quack. (Souvisí s placeholderem, ale je to samostatné rozhodnutí 8 ve story.)                                               |

## Důsledky

**Pro zbytek aplikace (to podstatné):**

- **`Quack.text` a `Quack.userId` jsou nullable.** Neplatí už, že každý quack má text a autora. Každý kód, který čte quacky (doménový typ, response DTO, zod schémata na frontendu, seed, landing page, budoucí profily, notifikace, editace, exporty), musí s placeholderem počítat. Placeholder se pozná podle příznaku `isDeleted` (v DB `deletedAt`), ne podle `text === null`.
- **Každý dotaz na quacky musí placeholdery řešit vědomě**: buď je zobrazit jako „This message was deleted“ (feed, stránka vlákna), nebo vyřadit (vyhledávání, „Mine“, cokoli, co hledá podle autora nebo textu). Platí to i pro raw SQL, které Prisma typy nehlídají.
- **Placeholder nemá autora, takže na něj nejde použít kontrola „smí to smazat autor“.** Placeholder se nemaže přes API, zmizí jen se svou poslední odpovědí. Admin moderace s ním musí počítat.
- **Mazání účtu** dál kaskádově smaže živé quacky uživatele. Pokud některý z nich má odpovědi jiných lidí, databáze smazání odmítne. Mazání účtu proto musí nejdřív takové quacky převést na placeholdery (stejnou cestou jako běžné mazání), jinak selže.
- **Ankety:** placeholder nikdy nemá anketu. Kód anket (`PollOption`, `PollVote`) se nemůže spolehnout, že quack s anketou má autora déle, než quack žije.
- **CHECK constraint je mimo Prisma.** Je jen v ručně psané migraci. Kdo bude měnit sloupce `quack` (např. přidá další obsahové pole), musí ho upravit ručně, jinak nový sloupec v placeholderu zůstane a obsah „nezmizí“.

**Vratnost:**

- Rozhodnutí je jednosměrné pro data. Vymazaný text a autor placeholderu se nedají obnovit, takže případný přechod na soft delete nebo „obnovení smazaného“ pomůže jen pro budoucí mazání.
- Přechod na jiný model mazání znamená změnit nullability a constraint na hlavní tabulce aplikace a projít všechny dotazy výše. Proto je potřeba tohle ADR zkontrolovat před každou změnou modelu `Quack` nebo mazání.

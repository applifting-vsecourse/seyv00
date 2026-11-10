# Architecture Decision Records

Rozcestník rozhodnutí, která se těžko vracejí a dotýkají se víc než jedné featury. Před změnou datového modelu nebo struktury aplikace si projděte relevantní ADR.

| #    | Název                                                                                          | Status  | Shrnutí                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 0001 | [Smazaný quack s odpověďmi se stává prázdným placeholderem](0001-placeholder-misto-smazani.md) | Přijato | Quack s odpověďmi se nemaže, ale vymaže se mu text, mood, anketa i autor. Kvůli tomu jsou `text` a `userId` v celé aplikaci nullable. |

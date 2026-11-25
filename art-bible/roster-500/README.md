# CRT Crusaders: 500-Sister Roster Plan

Aaron's new roster (2026-11-23): per Order, 1 Limited UR, 2 Limited SSR tied to her, 2 UR, and one SSR, SR and R of every one of the 15 classes. 50 per Order, 500 in all.

Use with order-bible.md, class-bible.md, sprite-plan.md and ASSETS_GUIDE.md. The cards are in one file per Order (see below). 

## How to use

1. In ChatGPT, paste CHATGPT_PROJECT_INSTRUCTIONS.txt as the project instructions and connect GitHub. Everything else is read live from the game repo's `art-bible/` folder. Each Sister's card is its own file: `art-bible/roster-500/cards/<Order code>/<id>.md`, for example `art-bible/roster-500/cards/IV/IV-LUR.md`.
2. Order first: her Order's crucifix icon and insignia are made and approved before any of its Sisters (ASSETS_GUIDE 3b); the insignia goes on both pauldrons of every Sister. Then, per Sister, send the four finished prompts at the bottom of her card, one step at a time: PROP PROMPT (weapon prop sheet), BUST PROMPT, SPRITE PROMPT, SPLASH PROMPT. Each is sent verbatim; paste the approved identity lock where it says. Each prompt's header says what to attach, and each CHECK line says what that shot must show, what may crop and what is out of shot. Everything above the ART PROMPTS line is reference only. If ChatGPT keeps cramming the weapon into a bust, make the bust in a fresh chat or open with "Ignore all earlier images in this chat." Each card names one tiered weapon (R Epic, SR Legendary, SSR Mythic, UR Divine Arsenal), her angel tier (ANGEL line) and a FANATIC mark.
3. Deliver each approved piece as an art pull request (ASSETS_GUIDE section 5). Aaron reviews and merges. The boxes below are Aaron's own tracker; ChatGPT doesn't edit this file.
4. Each Sister's heading gives her name, her rank epithet and her rank. The epithet should show in the art (a Captain of the Lantern Wall carries its lantern).
5. R and SR cards are short: the Order and class bibles cover the rest. SSR and UR cards carry the full Identity Card and splash scene.

**IDs:** `<Order>-<rarity>-<class>`, for example `IV-SSR-CEN` is the Iron Vigil SSR Censer. Top slots are `<Order>-LUR`, `-LSSR1`, `-LSSR2`, `-UR1`, `-UR2`. Order codes: IV Iron Vigil, AM Ashen Mercy, VT Veiled Tribunal, SW Sepulcher Watch, CC Choir of the Pyre, TC Verdant Martyrdom, DL Drowned Litany, GC Confessors of Glass, RP Crimson Inquisition, HB Hallowed Belfry. Class codes: HIE Hierophant, SEN Sentinel, MAR Martyr, CON Confessor, HOS Hospitaller, ABB Abbess, ORA Oracle, CAN Cantor, ADJ Adjudicator, WAR War-Sister, EXE Executioner, VEI Veilblade, CEN Censer, ARB Arbalist, EXO Exorcist.

**Kept from the current game:** 89 Sisters whose Order, class and rarity match a slot keep their name, age, relic, hook and look notes (faces, hair and ages are new, except the three locked references). Everyone else is new, named from the Latin name library plus more real Roman names; every first name is unique.

**Not kept:** Junia Hypsaea (her Drowned Litany SSR Executioner slot goes to Gurges).

**Locked references:** Cruentia (TC-UR1), Gurges Submersa (DL-SSR-EXE), Obscura Ponderosa (VT-SSR-VEI).


## Iron Vigil (IV) — cards in [cards/IV/](cards/IV/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| IV-LUR | Insomnia, Vigilia Ascendant, Patron Goddess of the Iron Vigil | Limited UR Patron Deity Arbalist | ☐ | ☐ | ☐ |
| IV-LSSR1 | Excubia Catenata, Daughter of the Unsleeping Flame | Limited SSR Demigoddess Adjudicator | ☐ | ☐ | ☐ |
| IV-LSSR2 | Custodia Ferrea, Half-Born of the Wall Eternal | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| IV-UR1 | Propugna, the Amber Watcher, Goddess of Walls | UR Deity Censer | ☐ | ☐ | ☐ |
| IV-UR2 | Murifera, the Iron Dawn, Goddess of the Last Stand | UR Deity Sentinel | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ IV-SSR-HIE Pugna Excubitrix, Chosen of the Amber Eye | ☐ IV-SR-HIE Rotrud Turrita, Who Held the Black Gate | ☐ IV-R-HIE Fredegund Turrita, Captain of the Lantern Wall |
| Sentinel | ☐ IV-SSR-SEN Obsidia Vigilax, Blood of the Vigil Star | ☐ IV-SR-SEN Irmgard Clavata, Who Held the Long Night | ☐ IV-R-SEN Gerberga Clavata, Marshal of the Black Gate |
| Martyr | ☐ IV-SSR-MAR Rubigo Clavata, Child of the Iron Dawn | ☐ IV-SR-MAR Mathilda Excubitrix, Who Held the Siege of Hollowmoor | ☐ IV-R-MAR Ermengard Excubitrix, Warden of the North Rampart |
| Confessor | ☐ IV-SSR-CON Pervigilia Obsessa, Spark of the Watch-Fire | ☐ IV-SR-CON Engelberga Insomnis, Who Walked Out of the Siege of Hollowmoor | ☐ IV-R-CON Theodelinda Insomnis, Castellan of the Ninth Watch |
| Hospitaller | ☐ IV-SSR-HOS Moenia Propugnatrix, Daughter of the Burning Beacon | ☐ IV-SR-HOS Adelheid Vallata, Who Walked Out of the Breach at Dawn | ☐ IV-R-HOS Clotilde Vallata, Banneret of the Iron Stair |
| Abbess | ☐ IV-SSR-ABB Lucerna Pervigil, Half-Born of the First Lantern | ☐ IV-SR-ABB Galswintha Catenata, Who Walked Out of the Grey Horde | ☐ IV-R-ABB Gerhild Catenata, Knight-Commander of the Last Beacon |
| Oracle | ☐ IV-SSR-ORA Fortitudo Ferricrepa, Chosen of the Unsleeping Flame | ☐ IV-SR-ORA Kunigunde Propugnatrix, Who Foretold the Grey Horde | ☐ IV-R-ORA Hiltrude Propugnatrix, Prefect of the Sleepless Company |
| Cantor | ☐ IV-SSR-CAN Ferrata Insomnis, Blood of the Wall Eternal | ☐ IV-SR-CAN Ragnhild Murata, Who Foretold the Iron Stair | ☐ IV-R-CAN Adalind Murata, Standard-Bearer of the Portcullis Guard |
| Adjudicator | ☐ IV-SSR-ADJ Catena Murata, Child of the Amber Eye | ☐ IV-SR-ADJ Bertrada Ferrea, Who Foretold the Wall of Nine Days | ☐ IV-R-ADJ Brunhild Ferrea, Marshal of the Lantern Wall |
| War-Sister | ☐ IV-SSR-WAR Sentinella Ferrea, Spark of the Vigil Star | ☐ IV-SR-WAR Brunichild Vigilax, Slayer of the Siege-Wyrm | ☐ IV-R-WAR Ingund Vigilax, Warden of the Black Gate |
| Executioner | ☐ IV-SSR-EXE Statio Turrita, Daughter of the Iron Dawn | ☐ IV-SR-EXE Oda Lanternaria, Slayer of the Gate-Eater | ☐ IV-R-EXE Gisela Lanternaria, Castellan of the North Rampart |
| Veilblade | ☐ IV-SSR-VEI Clavaria Catenata, Half-Born of the Watch-Fire | ☐ IV-SR-VEI Hedwig Ferricrepa, Slayer of the Night Behemoth | ☐ IV-R-VEI Waldrada Ferricrepa, Banneret of the Ninth Watch |
| Censer | ☐ IV-SSR-CEN Turris Lanternaria, Chosen of the Burning Beacon | ☐ IV-SR-CEN Gundrada Rubiginosa, Who Ended the Wall of Nine Days | ☐ IV-R-CEN Amalaswintha Rubiginosa, Knight-Commander of the Iron Stair |
| Arbalist | ☐ IV-SSR-ARB Clausura Rubiginosa, Blood of the First Lantern | ☐ IV-SR-ARB Liutgard Pervigil, Who Ended the Gate of Teeth | ☐ IV-R-ARB Hildegund Pervigil, Prefect of the Last Beacon |
| Exorcist | ☐ IV-SSR-EXO Vallia Obsessa, Child of the Unsleeping Flame | ☐ IV-SR-EXO Swanhild Obsessa, Who Ended the Black Gate | ☐ IV-R-EXO Radegund Obsessa, Standard-Bearer of the Sleepless Company |

## Ashen Mercy (AM) — cards in [cards/AM/](cards/AM/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| AM-LUR | Misericordia, Cinerea Ascendant, Patron Goddess of the Ashen Mercy | Limited UR Patron Deity Executioner | ☐ | ☐ | ☐ |
| AM-LSSR1 | Pietas Favillaris, Daughter of the Last Ember | Limited SSR Demigoddess Hospitaller | ☐ | ☐ | ☐ |
| AM-LSSR2 | Caritas Rogalis, Half-Born of the Grey Dawn | Limited SSR Demigoddess Veilblade | ☐ | ☐ | ☐ |
| AM-UR1 | Exustrix, the Pale Flame, Goddess of Mercy and Ash | UR Deity Oracle | ☐ | ☐ | ☐ |
| AM-UR2 | Fumaria, the Ember Mother, Goddess of the Burned | UR Deity Exorcist | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ AM-SSR-HIE Ignita Cinefacta, Chosen of the Pale Flame | ☐ AM-SR-HIE Oblata Ustoria, Who Held the Burning of Caelmoor | ☐ AM-R-HIE Abnegata Ustoria, Captain of the Ash Hospice |
| Sentinel | ☐ AM-SSR-SEN Macerata Incinerata, Blood of the Sheltered Candle | ☐ AM-SR-SEN Lurida Torrefacta, Who Held the Plague Fire | ☐ AM-R-SEN Pallida Torrefacta, Marshal of the Burned Ward |
| Martyr | ☐ AM-SSR-MAR Quietia Torrefacta, Child of the Hearth Unburned | ☐ AM-SR-MAR Sordida Cinefacta, Who Held the Cinder Siege | ☐ AM-R-MAR Lugubria Cinefacta, Warden of the Ember Company |
| Confessor | ☐ AM-SSR-CON Cinis Ambusta, Spark of the Merciful Ash | ☐ AM-SR-CON Querela Crematrix, Who Walked Out of the Cinder Siege | ☐ AM-R-CON Penitentia Crematrix, Castellan of the Pyre Field |
| Hospitaller | ☐ AM-SSR-HOS Contumelia Cineraria, Daughter of the Choking Smoke | ☐ AM-SR-HOS Remissa Adusta, Who Walked Out of the Ash Winter | ☐ AM-R-HOS Desolata Adusta, Banneret of the Smoke Road |
| Abbess | ☐ AM-SSR-ABB Miseria Fumida, Half-Born of the Cinder Mother | ☐ AM-SR-ABB Ustrina Favillaris, Who Walked Out of the Smoke Road | ☐ AM-R-ABB Favilla Carbonaria, Knight-Commander of the Cinder Gate |
| Oracle | ☐ AM-SSR-ORA Tabida Carbonaria, Chosen of the Last Ember | ☐ AM-SR-ORA Squalida Cineraria, Who Foretold the Smoke Road | ☐ AM-R-ORA Maesta Cineraria, Prefect of the Last Candle |
| Cantor | ☐ AM-SSR-CAN Sedata Crematrix, Blood of the Grey Dawn | ☐ AM-SR-CAN Combusta Fuliginosa, Who Foretold the Pyre Field | ☐ AM-R-CAN Lacrima Fuliginosa, Standard-Bearer of the Grey Lazaretto |
| Adjudicator | ☐ AM-SSR-ADJ Compassia Fuliginosa, Child of the Pale Flame | ☐ AM-SR-ADJ Torrida Rogalis, Who Foretold the Red Fever | ☐ AM-R-ADJ Contrita Rogalis, Marshal of the Ash Hospice |
| War-Sister | ☐ AM-SSR-WAR Mortifera Rogalis, Spark of the Sheltered Candle | ☐ AM-SR-WAR Clementia Incinerata, Slayer of the Ash Wyrm | ☐ AM-R-WAR Carbona Incinerata, Warden of the Burned Ward |
| Executioner | ☐ AM-SSR-EXE Fumosa Ustoria, Daughter of the Hearth Unburned | ☐ AM-SR-EXE Expiata Cremata, Slayer of the Cinder Horror | ☐ AM-R-EXE Tristitia Cremata, Castellan of the Ember Company |
| Veilblade | ☐ AM-SSR-VEI Afflicta Favillaris, Half-Born of the Merciful Ash | ☐ AM-SR-VEI Funesta Carbonaria, Slayer of the Plague Colossus | ☐ AM-R-VEI Suspiria Carbonaria, Banneret of the Pyre Field |
| Censer | ☐ AM-SSR-CEN Sacrificia Cremata, Chosen of the Choking Smoke | ☐ AM-SR-CEN Lamentia Ustulata, Who Ended the Red Fever | ☐ AM-R-CEN Dolora Ustulata, Knight-Commander of the Smoke Road |
| Arbalist | ☐ AM-SSR-ARB Lenita Ustulata, Blood of the Cinder Mother | ☐ AM-SR-ARB Exusta Fumida, Who Ended the Night of Embers | ☐ AM-R-ARB Misera Fumida, Prefect of the Cinder Gate |
| Exorcist | ☐ AM-SSR-EXO Flebilia Adusta, Child of the Last Ember | ☐ AM-SR-EXO Absoluta Ambusta, Who Ended the Burning of Caelmoor | ☐ AM-R-EXO Humilia Ambusta, Standard-Bearer of the Last Candle |

## Veiled Tribunal (VT) — cards in [cards/VT/](cards/VT/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| VT-LUR | Velamina, Iudicia Ascendant, Patron Goddess of the Veiled Tribunal | Limited UR Patron Deity Sentinel | ☐ | ☐ | ☐ |
| VT-LSSR1 | Veritas Ponderosa, Daughter of the Final Verdict | Limited SSR Demigoddess War-Sister | ☐ | ☐ | ☐ |
| VT-LSSR2 | Libra Ponderatrix, Half-Born of the Night Writ | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| VT-UR1 | Taciturna, the Veiled Eye, Goddess of Judgement | UR Deity Hierophant | ☐ | ☐ | ☐ |
| VT-UR2 | Silentium, the Black Scale, Goddess of the Final Verdict | UR Deity Adjudicator | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ VT-SSR-HIE Iustitia Libratrix, Chosen of the Black Scale | ☐ VT-SR-HIE Domnika Arbitra, Who Held the Trial of the Hundred | ☐ VT-R-HIE Euphrosyne Arbitra, Captain of the Veiled Bench |
| Sentinel | ☐ VT-SSR-SEN Indicia Silens, Blood of the Blind Law | ☐ VT-SR-SEN Kyranna Tacens, Who Held the Heretic Synod | ☐ VT-R-SEN Theodosia Tacens, Marshal of the Black Court |
| Martyr | ☐ VT-SSR-MAR Probatio Tacens, Child of the Silent Judge | ☐ VT-SR-MAR Synkletike Libratrix, Who Held the Black Verdict | ☐ VT-R-MAR Sophia Libratrix, Warden of the Silent Chamber |
| Confessor | ☐ VT-SSR-CON Umbra Sententia, Spark of the Veiled Eye | ☐ VT-SR-CON Kallinike Velata, Who Walked Out of the Black Verdict | ☐ VT-R-CON Irene Velata, Castellan of the Writ Guard |
| Hospitaller | ☐ VT-SSR-HOS Verdicta Abscondita, Daughter of the Last Sentence | ☐ VT-SR-HOS Chrysanthe Damnatrix, Who Walked Out of the Court of Rats | ☐ VT-R-HOS Martina Damnatrix, Banneret of the Seal Archive |
| Abbess | ☐ VT-SSR-ABB Damnatio Obvelata, Half-Born of the Unbroken Seal | ☐ VT-SR-ABB Verina Ponderosa, Who Walked Out of the Silent Purge | ☐ VT-R-ABB Kassia Ponderosa, Knight-Commander of the Execution Yard |
| Oracle | ☐ VT-SSR-ORA Testis Mutata, Chosen of the Final Verdict | ☐ VT-SR-ORA Theoktiste Abscondita, Who Foretold the Silent Purge | ☐ VT-R-ORA Helena Abscondita, Prefect of the Ninth Tribunal |
| Cantor | ☐ VT-SSR-CAN Tacita Velata, Blood of the Night Writ | ☐ VT-SR-CAN Melania Iudicatrix, Who Foretold the False Pope | ☐ VT-R-CAN Zoe Iudicatrix, Standard-Bearer of the Hall of Scales |
| Adjudicator | ☐ VT-SSR-ADJ Silentia Iudicatrix, Child of the Black Scale | ☐ VT-SR-ADJ Olympias Ponderatrix, Who Foretold the Night Assizes | ☐ VT-R-ADJ Eudokia Ponderatrix, Marshal of the Veiled Bench |
| War-Sister | ☐ VT-SSR-WAR Severitas Ponderatrix, Spark of the Blind Law | ☐ VT-SR-WAR Prokopia Silens, Slayer of the Liar-Beast | ☐ VT-R-WAR Ariadne Silens, Warden of the Black Court |
| Executioner | ☐ VT-SSR-EXE Velamen Arbitra, Daughter of the Silent Judge | ☐ VT-SR-EXE Photeine Censoria, Slayer of the Thousand-Tongued | ☐ VT-R-EXE Pulcheria Censoria, Castellan of the Silent Chamber |
| Veilblade | ☐ VT-SSR-VEI Obscura Ponderosa, Half-Born of the Veiled Eye | ☐ VT-SR-VEI Eudoxia Mutata, Slayer of the Perjurer Wyrm | ☐ VT-R-VEI Athenais Mutata, Banneret of the Writ Guard |
| Censer | ☐ VT-SSR-CEN Arcana Censoria, Chosen of the Last Sentence | ☐ VT-SR-CEN Macrina Condemnatrix, Who Ended the Night Assizes | ☐ VT-R-CEN Anna Condemnatrix, Knight-Commander of the Seal Archive |
| Arbalist | ☐ VT-SSR-ARB Censura Condemnatrix, Blood of the Unbroken Seal | ☐ VT-SR-ARB Xene Obvelata, Who Ended the Burning of the Codex | ☐ VT-R-ARB Theodora Obvelata, Prefect of the Execution Yard |
| Exorcist | ☐ VT-SSR-EXO Secreta Damnatrix, Child of the Final Verdict | ☐ VT-SR-EXO Evanthia Sententia, Who Ended the Trial of the Hundred | ☐ VT-R-EXO Theophano Sententia, Standard-Bearer of the Ninth Tribunal |

## Sepulcher Watch (SW) — cards in [cards/SW/](cards/SW/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| SW-LUR | Vanth, Sepulchra Ascendant, Patron Goddess of the Sepulcher Watch | Limited UR Patron Deity Hospitaller | ☐ | ☐ | ☐ |
| SW-LSSR1 | Requies Sepulcralis, Daughter of the Last Key | Limited SSR Demigoddess Executioner | ☐ | ☐ | ☐ |
| SW-LSSR2 | Funera Sepulta, Half-Born of the Deathless Watch | Limited SSR Demigoddess Arbalist | ☐ | ☐ | ☐ |
| SW-UR1 | Culsu, the Keeper of Keys, Goddess of Tombs | UR Deity Sentinel | ☐ | ☐ | ☐ |
| SW-UR2 | Nortia, the Bone-White Light, Goddess of the Restless Dead | UR Deity Abbess | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ SW-SSR-HIE Tenebra Tumulata, Chosen of the Sealed Tomb | ☐ SW-SR-HIE Peithesa Silicernia, Who Held the Crypt Rising | ☐ SW-R-HIE Ravnthu Silicernia, Captain of the Ossuary |
| Sentinel | ☐ SW-SSR-SEN Mortificia Feralis, Blood of the Skull Crown | ☐ SW-SR-SEN Satlnei Inhumata, Who Held the Night of Open Graves | ☐ SW-R-SEN Larcia Inhumata, Marshal of the Bone Gate |
| Martyr | ☐ SW-SSR-MAR Parentalia Inhumata, Child of the Ossuary Light | ☐ SW-SR-MAR Fulnia Tumulata, Who Held the Ossuary Siege | ☐ SW-R-MAR Sethra Tumulata, Warden of the Catacomb Watch |
| Confessor | ☐ SW-SSR-CON Feralia Mortualis, Spark of the Bone Saint | ☐ SW-SR-CON Cusinia Bustuaria, Who Walked Out of the Ossuary Siege | ☐ SW-R-CON Fastia Bustuaria, Castellan of the Crypt Keys |
| Hospitaller | ☐ SW-SSR-HOS Nenia Exanimata, Daughter of the Final Door | ☐ SW-SR-HOS Atainia Cryptaria, Who Walked Out of the Bone Plague | ☐ SW-R-HOS Tita Cryptaria, Banneret of the Deep Stair |
| Abbess | ☐ SW-SSR-ABB Mortalia Libitina, Half-Born of the Quiet Grave | ☐ SW-SR-ABB Velthura Sepulcralis, Who Walked Out of the Deep Stair | ☐ SW-R-ABB Larthia Sepulcralis, Knight-Commander of the Tomb Company |
| Oracle | ☐ SW-SSR-ORA Larva Tumularia, Chosen of the Last Key | ☐ SW-SR-ORA Hermnia Exanimata, Who Foretold the Deep Stair | ☐ SW-R-ORA Thanchvil Exanimata, Prefect of the Skull Wall |
| Cantor | ☐ SW-SSR-CAN Manes Bustuaria, Blood of the Deathless Watch | ☐ SW-SR-CAN Puia Ossifraga, Who Foretold the Hungry Dead | ☐ SW-R-CAN Velia Ossifraga, Standard-Bearer of the Silent Vault |
| Adjudicator | ☐ SW-SSR-ADJ Ossa Ossifraga, Child of the Sealed Tomb | ☐ SW-SR-ADJ Ceisinia Sepulta, Who Foretold the Sealed Door | ☐ SW-R-ADJ Ramtha Sepulta, Marshal of the Ossuary |
| War-Sister | ☐ SW-SSR-WAR Pollinctrix Sepulta, Spark of the Skull Crown | ☐ SW-SR-WAR Tanaquil Feralis, Slayer of the Lich-Queen | ☐ SW-R-WAR Tarchna Feralis, Warden of the Bone Gate |
| Executioner | ☐ SW-SSR-EXE Exsequia Silicernia, Daughter of the Ossuary Light | ☐ SW-SR-EXE Lautnita Funebris, Slayer of the Bone Colossus | ☐ SW-R-EXE Seianti Funebris, Castellan of the Catacomb Watch |
| Veilblade | ☐ SW-SSR-VEI Ossilegia Sepulcralis, Half-Born of the Bone Saint | ☐ SW-SR-VEI Velusa Tumularia, Slayer of the Crypt Wyrm | ☐ SW-R-VEI Velcha Tumularia, Banneret of the Crypt Keys |
| Censer | ☐ SW-SSR-CEN Lemuria Funebris, Chosen of the Final Door | ☐ SW-SR-CEN Thesana Ossuaria, Who Ended the Sealed Door | ☐ SW-R-CEN Hastia Ossuaria, Knight-Commander of the Deep Stair |
| Arbalist | ☐ SW-SSR-ARB Inferia Ossuaria, Blood of the Quiet Grave | ☐ SW-SR-ARB Tetia Libitina, Who Ended the Grave Choir | ☐ SW-R-ARB Thana Libitina, Prefect of the Tomb Company |
| Exorcist | ☐ SW-SSR-EXO Sepultura Cryptaria, Child of the Last Key | ☐ SW-SR-EXO Spuria Mortualis, Who Ended the Crypt Rising | ☐ SW-R-EXO Arnthia Mortualis, Standard-Bearer of the Skull Wall |

## Choir of the Pyre (CC) — cards in [cards/CC/](cards/CC/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| CC-LUR | Hosanna, Cantica Ascendant, Patron Goddess of the Choir of the Pyre | Limited UR Patron Deity Adjudicator | ☐ | ☐ | ☐ |
| CC-LSSR1 | Psalmodia Pyralis, Daughter of the Unending Hymn | Limited SSR Demigoddess Executioner | ☐ | ☐ | ☐ |
| CC-LSSR2 | Hymnia Flammigera, Half-Born of the Eternal Note | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| CC-UR1 | Ignifera, the Undying Hymn, Goddess of Song | UR Deity War-Sister | ☐ | ☐ | ☐ |
| CC-UR2 | Cantatrix, the Hundred Candles, Goddess of Pyre-Light | UR Deity Cantor | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ CC-SSR-HIE Vespera Ardens, Chosen of the Golden Choir | ☐ CC-SR-HIE Adah Rogusia, Who Held the Silent Night | ☐ CC-R-HIE Abigail Rogusia, Captain of the Candle Loft |
| Sentinel | ☐ CC-SSR-SEN Doxologia Cremaria, Blood of the Choir Above | ☐ CC-SR-SEN Keziah Clamatrix, Who Held the Candle Siege | ☐ CC-R-SEN Jochebed Clamatrix, Marshal of the First Choir |
| Martyr | ☐ CC-SSR-MAR Antiphona Clamatrix, Child of the Vesper Star | ☐ CC-SR-MAR Naamah Ardens, Who Held the Heretic Chorus | ☐ CC-R-MAR Merab Ardens, Warden of the Wax Procession |
| Confessor | ☐ CC-SSR-CON Clamoria Cantrix, Spark of the First Candle | ☐ CC-SR-CON Milcah Psallens, Who Walked Out of the Heretic Chorus | ☐ CC-R-CON Tamar Psallens, Castellan of the Hymn Guard |
| Hospitaller | ☐ CC-SSR-HOS Matutina Exardens, Daughter of the Searing Flame | ☐ CC-SR-HOS Zillah Incendia, Who Walked Out of the Black Mass | ☐ CC-R-HOS Michal Incendia, Banneret of the Thousand Candles |
| Abbess | ☐ CC-SSR-ABB Laudes Fervida, Half-Born of the Burning Wax | ☐ CC-SR-ABB Noadiah Pyralis, Who Walked Out of the Long Hymn | ☐ CC-R-ABB Jael Pyralis, Knight-Commander of the Bell Nave |
| Oracle | ☐ CC-SSR-ORA Responsoria Ululans, Chosen of the Unending Hymn | ☐ CC-SR-ORA Jemimah Exardens, Who Foretold the Long Hymn | ☐ CC-R-ORA Huldah Exardens, Prefect of the Vesper Company |
| Cantor | ☐ CC-SSR-CAN Pyra Psallens, Blood of the Eternal Note | ☐ CC-SR-CAN Hagar Hymnifera, Who Foretold the Wax Flood | ☐ CC-R-CAN Hannah Hymnifera, Standard-Bearer of the Red Seal |
| Adjudicator | ☐ CC-SSR-ADJ Melodia Hymnifera, Child of the Golden Choir | ☐ CC-SR-ADJ Achsah Flammigera, Who Foretold the Unholy Choir | ☐ CC-R-ADJ Miriam Flammigera, Marshal of the Candle Loft |
| War-Sister | ☐ CC-SSR-WAR Incantia Flammigera, Spark of the Choir Above | ☐ CC-SR-WAR Bilhah Cremaria, Slayer of the Silence-Beast | ☐ CC-R-WAR Puah Cremaria, Warden of the First Choir |
| Executioner | ☐ CC-SSR-EXE Canora Rogusia, Daughter of the Vesper Star | ☐ CC-SR-EXE Tirzah Canticaria, Slayer of the Wax Horror | ☐ CC-R-EXE Rizpah Canticaria, Castellan of the Wax Procession |
| Veilblade | ☐ CC-SSR-VEI Threnodia Pyralis, Half-Born of the First Candle | ☐ CC-SR-VEI Atarah Ululans, Slayer of the Hymn-Eater | ☐ CC-R-VEI Shiphrah Ululans, Banneret of the Hymn Guard |
| Censer | ☐ CC-SSR-CEN Rogalia Canticaria, Chosen of the Searing Flame | ☐ CC-SR-CEN Keturah Ignicantrix, Who Ended the Unholy Choir | ☐ CC-R-CEN Judith Ignicantrix, Knight-Commander of the Thousand Candles |
| Arbalist | ☐ CC-SSR-ARB Flamma Ignicantrix, Blood of the Burning Wax | ☐ CC-SR-ARB Basemath Fervida, Who Ended the Darkened Nave | ☐ CC-R-ARB Deborah Fervida, Prefect of the Bell Nave |
| Exorcist | ☐ CC-SSR-EXO Choralis Incendia, Child of the Unending Hymn | ☐ CC-SR-EXO Hoglah Cantrix, Who Ended the Silent Night | ☐ CC-R-EXO Zipporah Cantrix, Standard-Bearer of the Vesper Company |

## The Verdant Martyrdom (TC) — cards in [cards/TC/](cards/TC/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| TC-LUR | Sanguirosa, Spina Ascendant, Patron Goddess of the Verdant Martyrdom | Limited UR Patron Deity Martyr | ☐ | ☐ | ☐ |
| TC-LSSR1 | Cruor Vulnerata, Daughter of the Living Briar | Limited SSR Demigoddess Arbalist | ☐ | ☐ | ☐ |
| TC-LSSR2 | Vepris Sentosa, Half-Born of the Bloom Eternal | Limited SSR Demigoddess War-Sister | ☐ | ☐ | ☐ |
| TC-UR1 | Cruentia, the Bleeding Rose, Goddess of Penance | UR Deity Sentinel | ☐ | ☐ | ☐ |
| TC-UR2 | Passiflora, the Living Briar, Goddess of Scars | UR Deity Abbess | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ TC-SSR-HIE Cilicia Radicata, Chosen of the Thorn Crown | ☐ TC-SR-HIE Domitilla Lacerata, Who Held the Briar War | ☐ TC-R-HIE Thecla Lacerata, Captain of the Briar Chapel |
| Sentinel | ☐ TC-SSR-SEN Radix Sentosa, Blood of the First Thorn | ☐ TC-SR-SEN Seraphia Spinifera, Who Held the Rose Massacre | ☐ TC-R-SEN Basilissa Spinifera, Marshal of the Rose Wall |
| Martyr | ☐ TC-SSR-MAR Agonia Spinifera, Child of the Wild Covenant | ☐ TC-SR-MAR Potamiaena Radicata, Who Held the Thorn Road | ☐ TC-R-MAR Marcellina Radicata, Warden of the Thorn Road |
| Confessor | ☐ TC-SSR-CON Rubus Spinosa, Spark of the Red Rose | ☐ TC-SR-CON Eugenia Cruenta, Who Walked Out of the Thorn Road | ☐ TC-R-CON Blandina Cruenta, Castellan of the Penitent Company |
| Hospitaller | ☐ TC-SSR-HOS Mortificata Sanguinolenta, Daughter of the Scarred Saint | ☐ TC-SR-HOS Restituta Tribulosa, Who Walked Out of the Rotwood Heresy | ☐ TC-R-HOS Crispina Tribulosa, Banneret of the Root Cloister |
| Abbess | ☐ TC-SSR-ABB Stigma Cruciata, Half-Born of the Bleeding Root | ☐ TC-SR-ABB Barbara Vulnerata, Who Walked Out of the Garden of Graves | ☐ TC-R-ABB Agnes Vulnerata, Knight-Commander of the Bramble Gate |
| Oracle | ☐ TC-SSR-ORA Hirsuta Flagellata, Chosen of the Living Briar | ☐ TC-SR-ORA Sabina Sanguinolenta, Who Foretold the Garden of Graves | ☐ TC-R-ORA Symphorosa Sanguinolenta, Prefect of the Red Garden |
| Cantor | ☐ TC-SSR-CAN Vulnera Cruenta, Blood of the Bloom Eternal | ☐ TC-SR-CAN Benedicta Sanguinea, Who Foretold the Bramble Siege | ☐ TC-R-CAN Lucia Sanguinea, Standard-Bearer of the Scar Guard |
| Adjudicator | ☐ TC-SSR-ADJ Passio Sanguinea, Child of the Thorn Crown | ☐ TC-SR-ADJ Juliana Vepreta, Who Foretold the Burning Hedge | ☐ TC-R-ADJ Felicitas Vepreta, Marshal of the Briar Chapel |
| War-Sister | ☐ TC-SSR-WAR Lacerna Vepreta, Spark of the First Thorn | ☐ TC-SR-WAR Apollonia Sentosa, Slayer of the Rot-Treant | ☐ TC-R-WAR Margarita Sentosa, Warden of the Rose Wall |
| Executioner | ☐ TC-SSR-EXE Tribula Lacerata, Daughter of the Wild Covenant | ☐ TC-SR-EXE Faustina Stigmata, Slayer of the Bramble Wyrm | ☐ TC-R-EXE Eulalia Stigmata, Castellan of the Thorn Road |
| Veilblade | ☐ TC-SSR-VEI Sanguina Vulnerata, Half-Born of the Red Rose | ☐ TC-SR-VEI Dorothea Flagellata, Slayer of the Thorn Behemoth | ☐ TC-R-VEI Christina Flagellata, Banneret of the Penitent Company |
| Censer | ☐ TC-SSR-CEN Sentis Stigmata, Chosen of the Scarred Saint | ☐ TC-SR-CEN Columba Rubeta, Who Ended the Burning Hedge | ☐ TC-R-CEN Cecilia Rubeta, Knight-Commander of the Root Cloister |
| Arbalist | ☐ TC-SSR-ARB Martyria Rubeta, Blood of the Bleeding Root | ☐ TC-SR-ARB Regina Cruciata, Who Ended the Night of Red Petals | ☐ TC-R-ARB Agatha Cruciata, Prefect of the Bramble Gate |
| Exorcist | ☐ TC-SSR-EXO Flagella Tribulosa, Child of the Living Briar | ☐ TC-SR-EXO Susanna Spinosa, Who Ended the Briar War | ☐ TC-R-EXO Justina Spinosa, Standard-Bearer of the Red Garden |

## Drowned Litany (DL) — cards in [cards/DL/](cards/DL/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| DL-LUR | Tehom, Thalassa Ascendant, Patron Goddess of the Drowned Litany | Limited UR Patron Deity Oracle | ☐ | ☐ | ☐ |
| DL-LSSR1 | Unda Profunda, Daughter of the Deep Font | Limited SSR Demigoddess Martyr | ☐ | ☐ | ☐ |
| DL-LSSR2 | Salina Gurgitosa, Half-Born of the Rising Water | Limited SSR Demigoddess Cantor | ☐ | ☐ | ☐ |
| DL-UR1 | Abyssa, the Rising Tide, Goddess of the Drowned | UR Deity Martyr | ☐ | ☐ | ☐ |
| DL-UR2 | Diluvia, the Deep Font, Goddess of the Abyss | UR Deity Censer | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ DL-SSR-HIE Baptista Undosa, Chosen of the Black Tide | ☐ DL-SR-HIE Callwen Submersa, Who Held the Great Flood | ☐ DL-R-HIE Crewenna Submersa, Captain of the Flooded Abbey |
| Sentinel | ☐ DL-SSR-SEN Algea Immersa, Blood of the Abyss Hymn | ☐ DL-SR-SEN Ilud Mersa, Who Held the Drowned Synod | ☐ DL-R-SEN Dwynwen Mersa, Marshal of the Drowned Bells |
| Martyr | ☐ DL-SSR-MAR Pelagia Mersa, Child of the Sunken Choir | ☐ DL-SR-MAR Meleri Undosa, Who Held the Black Tide | ☐ DL-R-MAR Tegla Undosa, Warden of the Tide Company |
| Confessor | ☐ DL-SSR-CON Aestua Inundata, Spark of the Drowned Bell | ☐ DL-SR-CON Tangwystl Aequorea, Who Walked Out of the Black Tide | ☐ DL-R-CON Keyne Aequorea, Castellan of the Sea-Cave Chapel |
| Hospitaller | ☐ DL-SSR-HOS Lustratio Abyssalis, Daughter of the Salt Dawn | ☐ DL-SR-HOS Gwawr Demersa, Who Walked Out of the Wreck of the Saint | ☐ DL-R-HOS Madryn Demersa, Banneret of the Salt Wall |
| Abbess | ☐ DL-SSR-ABB Charybdia Naufraga, Half-Born of the Pearl Saint | ☐ DL-SR-ABB Tudwen Profunda, Who Walked Out of the Sea-Cave Siege | ☐ DL-R-ABB Morwenna Profunda, Knight-Commander of the Deep Font |
| Oracle | ☐ DL-SSR-ORA Marina Algosa, Chosen of the Deep Font | ☐ DL-SR-ORA Tydfil Abyssalis, Who Foretold the Sea-Cave Siege | ☐ DL-R-ORA Melangell Abyssalis, Prefect of the Wreck Guard |
| Cantor | ☐ DL-SSR-CAN Procella Aequorea, Blood of the Rising Water | ☐ DL-SR-CAN Cynheiddon Salsugina, Who Foretold the Leviathan Heresy | ☐ DL-R-CAN Endelienta Salsugina, Standard-Bearer of the Pearl Choir |
| Adjudicator | ☐ DL-SSR-ADJ Naufragia Salsugina, Child of the Black Tide | ☐ DL-SR-ADJ Nonna Gurgitosa, Who Foretold the Salt Night | ☐ DL-R-ADJ Ninnoc Gurgitosa, Marshal of the Flooded Abbey |
| War-Sister | ☐ DL-SSR-WAR Vorago Gurgitosa, Spark of the Abyss Hymn | ☐ DL-SR-WAR Elwen Immersa, Slayer of the Leviathan | ☐ DL-R-WAR Gwladys Immersa, Warden of the Drowned Bells |
| Executioner | ☐ DL-SSR-EXE Gurges Submersa, Daughter of the Sunken Choir | ☐ DL-SR-EXE Arianwen Salsa, Slayer of the Deep Mother | ☐ DL-R-EXE Breaca Salsa, Castellan of the Tide Company |
| Veilblade | ☐ DL-SSR-VEI Refluxa Profunda, Half-Born of the Drowned Bell | ☐ DL-SR-VEI Gwenllian Algosa, Slayer of the Drowned Colossus | ☐ DL-R-VEI Eluned Algosa, Banneret of the Sea-Cave Chapel |
| Censer | ☐ DL-SSR-CEN Fluxia Salsa, Chosen of the Salt Dawn | ☐ DL-SR-CEN Tybie Fluctuosa, Who Ended the Salt Night | ☐ DL-R-CEN Wenna Fluctuosa, Knight-Commander of the Salt Wall |
| Arbalist | ☐ DL-SSR-ARB Tempestas Fluctuosa, Blood of the Pearl Saint | ☐ DL-SR-ARB Clydai Naufraga, Who Ended the Sunken Bell | ☐ DL-R-ARB Ia Naufraga, Prefect of the Deep Font |
| Exorcist | ☐ DL-SSR-EXO Mersia Demersa, Child of the Deep Font | ☐ DL-SR-EXO Ceinwen Inundata, Who Ended the Great Flood | ☐ DL-R-EXO Senara Inundata, Standard-Bearer of the Wreck Guard |

## Confessors of Glass (GC) — cards in [cards/GC/](cards/GC/)

Every Confessors of Glass Sister is a faceless construct of glass and mirror (see order-bible.md).

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| GC-LUR | Speculatrix, Specula Ascendant, Patron Goddess of the Confessors of Glass | Limited UR Patron Deity Adjudicator | ☐ | ☐ | ☐ |
| GC-LSSR1 | Facetta Specularis, Daughter of the Black Mirror | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| GC-LSSR2 | Crystalla Polita, Half-Born of the Ice Star | Limited SSR Demigoddess Veilblade | ☐ | ☐ | ☐ |
| GC-UR1 | Vitrix, the Black Mirror, Goddess of Confession | UR Deity Oracle | ☐ | ☐ | ☐ |
| GC-UR2 | Refracta, the Shattered Light, Goddess of Sins Remembered | UR Deity Confessor | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ GC-SSR-HIE Candida Fracta, Chosen of the Cold Light | ☐ GC-SR-HIE Octogesima Speculata, Who Held the Shattering | ☐ GC-R-HIE Decima Speculata, Captain of the Mirror Crypt |
| Sentinel | ☐ GC-SSR-SEN Echo Fissa, Blood of the Silver Pane | ☐ GC-SR-SEN Ultima Vitrifacta, Who Held the Mirror Heresy | ☐ GC-R-SEN Quindecima Vitrifacta, Marshal of the Black Pane |
| Martyr | ☐ GC-SSR-MAR Silicia Vitrifacta, Child of the Glass Saint | ☐ GC-SR-MAR Centesima Fracta, Who Held the Frozen Synod | ☐ GC-R-MAR Duodecima Fracta, Warden of the Rose Window |
| Confessor | ☐ GC-SSR-CON Fenestra Plumbata, Spark of the Shattered Window | ☐ GC-SR-CON Quinquagesima Perlucens, Who Walked Out of the Frozen Synod | ☐ GC-R-CON Sexta Perlucens, Castellan of the Frozen Cloister |
| Hospitaller | ☐ GC-SSR-HOS Argentea Rimosa, Daughter of the Clear Eye | ☐ GC-SR-HOS Nonagesima Rimosa, Who Walked Out of the Night of Black Glass | ☐ GC-R-HOS Undecima Rimosa, Banneret of the Shard Guard |
| Abbess | ☐ GC-SSR-ABB Lumina Crystallina, Half-Born of the Last Confession | ☐ GC-SR-ABB Duodevicesima Specularis, Who Walked Out of the False Reflection | ☐ GC-R-ABB Prima Specularis, Knight-Commander of the Confessional |
| Oracle | ☐ GC-SSR-ORA Imago Pellucida, Chosen of the Black Mirror | ☐ GC-SR-ORA Millesima Argentata, Who Foretold the False Reflection | ☐ GC-R-ORA Tredecima Argentata, Prefect of the Ice Chapel |
| Cantor | ☐ GC-SSR-CAN Clarita Perlucens, Blood of the Ice Star | ☐ GC-SR-CAN Tricesima Diffracta, Who Foretold the Ice Siege | ☐ GC-R-CAN Quarta Diffracta, Standard-Bearer of the Silver Choir |
| Adjudicator | ☐ GC-SSR-ADJ Reflexa Diffracta, Child of the Cold Light | ☐ GC-SR-ADJ Undevicesima Polita, Who Foretold the Broken Window | ☐ GC-R-ADJ Secunda Polita, Marshal of the Mirror Crypt |
| War-Sister | ☐ GC-SSR-WAR Scintilla Polita, Spark of the Silver Pane | ☐ GC-SR-WAR Postrema Fissa, Slayer of the Mirror-Beast | ☐ GC-R-WAR Septendecima Fissa, Warden of the Black Pane |
| Executioner | ☐ GC-SSR-EXE Prisma Speculata, Daughter of the Glass Saint | ☐ GC-SR-EXE Sexagesima Vitrea, Slayer of the Shard Wyrm | ☐ GC-R-EXE Septima Vitrea, Castellan of the Rose Window |
| Veilblade | ☐ GC-SSR-VEI Radiatrix Specularis, Half-Born of the Shattered Window | ☐ GC-SR-VEI Nulla Pellucida, Slayer of the Glass Horror | ☐ GC-R-VEI Sedecima Pellucida, Banneret of the Frozen Cloister |
| Censer | ☐ GC-SSR-CEN Translucia Vitrea, Chosen of the Clear Eye | ☐ GC-SR-CEN Quadragesima Lucida, Who Ended the Broken Window | ☐ GC-R-CEN Quinta Lucida, Knight-Commander of the Shard Guard |
| Arbalist | ☐ GC-SSR-ARB Fractura Lucida, Blood of the Last Confession | ☐ GC-SR-ARB Vicesima Crystallina, Who Ended the Confession of Ten Thousand | ☐ GC-R-ARB Tertia Crystallina, Prefect of the Confessional |
| Exorcist | ☐ GC-SSR-EXO Splendora Rimosa, Child of the Black Mirror | ☐ GC-SR-EXO Septuagesima Plumbata, Who Ended the Shattering | ☐ GC-R-EXO Nona Plumbata, Standard-Bearer of the Ice Chapel |

## Crimson Inquisition (RP) — cards in [cards/RP/](cards/RP/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| RP-LUR | Quaesitrix, Inquisitrix Ascendant, Patron Goddess of the Crimson Inquisition | Limited UR Patron Deity Martyr | ☐ | ☐ | ☐ |
| RP-LSSR1 | Quaestio Sigillata, Daughter of the Red Question | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| RP-LSSR2 | Confessio Accusatrix, Half-Born of the Inquisitor Star | Limited SSR Demigoddess Arbalist | ☐ | ☐ | ☐ |
| RP-UR1 | Confessora, the Red Question, Goddess of Inquisitors | UR Deity Executioner | ☐ | ☐ | ☐ |
| RP-UR2 | Cauterix, the Golden Brand, Goddess of Confession by Fire | UR Deity Hospitaller | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ RP-SSR-HIE Damnosa Stigmatrix, Chosen of the Golden Brand | ☐ RP-SR-HIE Munia Delatrix, Who Held the Red Purge | ☐ RP-R-HIE Mencia Delatrix, Captain of the Red Question |
| Sentinel | ☐ RP-SSR-SEN Carnifica Rogatrix, Blood of the Dawn Pyre | ☐ RP-SR-SEN Andregoto Confessoria, Who Held the Trial of Bones | ☐ RP-R-SEN Constanza Confessoria, Marshal of the Pyre Court |
| Martyr | ☐ RP-SSR-MAR Ferula Confessoria, Child of the Endless Purge | ☐ RP-SR-MAR Velasquita Stigmatrix, Who Held the Burning of Harrowmere | ☐ RP-R-MAR Aldonza Stigmatrix, Warden of the Branding Company |
| Confessor | ☐ RP-SSR-CON Supplicia Cauteria, Spark of the Burning Writ | ☐ RP-SR-CON Brianda Torquens, Who Walked Out of the Burning of Harrowmere | ☐ RP-R-CON Elvira Torquens, Castellan of the Question Room |
| Hospitaller | ☐ RP-SSR-HOS Rogatio Sententiaria, Daughter of the Bleeding Confession | ☐ RP-SR-HOS Gontrodo Quaestrix, Who Walked Out of the Witch Crusade | ☐ RP-R-HOS Toda Quaestrix, Banneret of the Gallows Steps |
| Abbess | ☐ RP-SSR-ABB Accusatio Edictora, Half-Born of the Red Rack | ☐ RP-SR-ABB Catalina Sigillata, Who Walked Out of the Night of a Thousand Pyres | ☐ RP-R-ABB Urraca Sigillata, Knight-Commander of the Writ Guard |
| Oracle | ☐ RP-SSR-ORA Marca Ustrix, Chosen of the Red Question | ☐ RP-SR-ORA Onneca Sententiaria, Who Foretold the Night of a Thousand Pyres | ☐ RP-R-ORA Beatriz Sententiaria, Prefect of the Iron Maiden Gate |
| Cantor | ☐ RP-SSR-CAN Ignominia Torquens, Blood of the Inquisitor Star | ☐ RP-SR-CAN Estefania Marcatrix, Who Foretold the Question Room Massacre | ☐ RP-R-CAN Leonor Marcatrix, Standard-Bearer of the Long Purge |
| Adjudicator | ☐ RP-SSR-ADJ Tortura Marcatrix, Child of the Golden Brand | ☐ RP-SR-ADJ Violante Accusatrix, Who Foretold the Siege of the Black Abbey | ☐ RP-R-ADJ Jimena Accusatrix, Marshal of the Red Question |
| War-Sister | ☐ RP-SSR-WAR Sigillia Accusatrix, Spark of the Dawn Pyre | ☐ RP-SR-WAR Froiloba Rogatrix, Slayer of the Heretic-Wyrm | ☐ RP-R-WAR Isabel Rogatrix, Warden of the Pyre Court |
| Executioner | ☐ RP-SSR-EXE Inquisitio Delatrix, Daughter of the Endless Purge | ☐ RP-SR-EXE Oria Inustrix, Slayer of the Witch-Colossus | ☐ RP-R-EXE Teresa Inustrix, Castellan of the Branding Company |
| Veilblade | ☐ RP-SSR-VEI Purgatia Sigillata, Half-Born of the Burning Writ | ☐ RP-SR-VEI Ermesinda Ustrix, Slayer of the Unconfessed Giant | ☐ RP-R-VEI Juana Ustrix, Banneret of the Question Room |
| Censer | ☐ RP-SSR-CEN Poena Inustrix, Chosen of the Bleeding Confession | ☐ RP-SR-CEN Guiomar Purgatrix, Who Ended the Siege of the Black Abbey | ☐ RP-R-CEN Sancha Purgatrix, Knight-Commander of the Gallows Steps |
| Arbalist | ☐ RP-SSR-ARB Stigmatia Purgatrix, Blood of the Red Rack | ☐ RP-SR-ARB Blanca Edictora, Who Ended the Long Winter Inquest | ☐ RP-R-ARB Ines Edictora, Prefect of the Writ Guard |
| Exorcist | ☐ RP-SSR-EXO Delatio Quaestrix, Child of the Red Question | ☐ RP-SR-EXO Godina Cauteria, Who Ended the Red Purge | ☐ RP-R-EXO Berenguela Cauteria, Standard-Bearer of the Iron Maiden Gate |

## Hallowed Belfry (HB) — cards in [cards/HB/](cards/HB/)

| Slot | Sister | Class | Bust | Sprite | Splash |
| --- | --- | --- | --- | --- | --- |
| HB-LUR | Campanaria, Campana Ascendant, Patron Goddess of the Hallowed Belfry | Limited UR Patron Deity Hierophant | ☐ | ☐ | ☐ |
| HB-LSSR1 | Campanula Clangora, Daughter of the Great Bell | Limited SSR Demigoddess Exorcist | ☐ | ☐ | ☐ |
| HB-LSSR2 | Tintinnabula Aeramenta, Half-Born of the Bronze Voice | Limited SSR Demigoddess Censer | ☐ | ☐ | ☐ |
| HB-UR1 | Tonitrix, the Hollow Toll, Goddess of the Bell | UR Deity War-Sister | ☐ | ☐ | ☐ |
| HB-UR2 | Zvonara, the Silent Peal, Goddess of Death's Call | UR Deity Veilblade | ☐ | ☐ | ☐ |

| Class | SSR Demigoddess | SR Legend | R Commander |
| --- | --- | --- | --- |
| Hierophant | ☐ HB-SSR-HIE Signa Plangens, Chosen of the Silent Ring | ☐ HB-SR-HIE Gorislava Tonitrua, Who Held the Silent Toll | ☐ HB-R-HIE Bogumila Funalis, Captain of the Cracked Tower |
| Sentinel | ☐ HB-SSR-SEN Classica Aeramenta, Blood of the Cracked Saint | ☐ HB-SR-SEN Krasava Plangens, Who Held the Belfry Siege | ☐ HB-R-SEN Danica Signifera, Marshal of the Belfry |
| Martyr | ☐ HB-SSR-MAR Angelus Vocifera, Child of the Last Peal | ☐ HB-SR-MAR Zorislava Signifera, Who Held the Storm Night | ☐ HB-R-MAR Zbyslava Tonitrua, Warden of the Storm Bell |
| Confessor | ☐ HB-SSR-CON Aenea Tintinna, Spark of the Hollow Toll | ☐ HB-SR-CON Sudislava Tinnula, Who Walked Out of the Storm Night | ☐ HB-R-CON Dobrava Aeramenta, Castellan of the Foundry Pit |
| Hospitaller | ☐ HB-SSR-HOS Vocatio Resonans, Daughter of the Midnight Toll | ☐ HB-SR-HOS Dubravka Tintinna, Who Walked Out of the Cracked Bell | ☐ HB-R-HOS Jaroslava Pulsatrix, Banneret of the Rope Guard |
| Abbess | ☐ HB-SSR-ABB Resonantia Aerea, Half-Born of the Storm Bell | ☐ HB-SR-ABB Vojislava Resonans, Who Walked Out of the Foundry Fire | ☐ HB-R-ABB Dragomira Sonora, Knight-Commander of the Midnight Roof |
| Oracle | ☐ HB-SSR-ORA Aerisona Clangora, Chosen of the Great Bell | ☐ HB-SR-ORA Velislava Sonora, Who Foretold the Foundry Fire | ☐ HB-R-ORA Ljuba Tintinna, Prefect of the Toll Company |
| Cantor | ☐ HB-SSR-CAN Tinnita Pulsatrix, Blood of the Bronze Voice | ☐ HB-SR-CAN Desislava Aeramenta, Who Foretold the Deaf Heresy | ☐ HB-R-CAN Zlata Vocifera, Standard-Bearer of the Great Bell |
| Adjudicator | ☐ HB-SSR-ADJ Pulsa Tinnula, Child of the Silent Ring | ☐ HB-SR-ADJ Stanislava Vocifera, Who Foretold the Midnight Toll | ☐ HB-R-ADJ Vlasta Plangens, Marshal of the Cracked Tower |
| War-Sister | ☐ HB-SSR-WAR Knella Tinnula, Spark of the Cracked Saint | ☐ HB-SR-WAR Zvonimira Vocifera, Slayer of the Silence Wyrm | ☐ HB-R-WAR Mlada Plangens, Warden of the Belfry |
| Executioner | ☐ HB-SSR-EXE Tympana Signifera, Daughter of the Last Peal | ☐ HB-SR-EXE Predslava Funalis, Slayer of the Bell-Eater | ☐ HB-R-EXE Miroslava Aerea, Castellan of the Storm Bell |
| Veilblade | ☐ HB-SSR-VEI Plangora Aerea, Half-Born of the Hollow Toll | ☐ HB-SR-VEI Snezhana Resonans, Slayer of the Storm Behemoth | ☐ HB-R-VEI Milada Sonora, Banneret of the Foundry Pit |
| Censer | ☐ HB-SSR-CEN Nola Tonitrua, Chosen of the Midnight Toll | ☐ HB-SR-CEN Rostislava Aerea, Who Ended the Midnight Toll | ☐ HB-R-CEN Bozhena Clangora, Knight-Commander of the Rope Guard |
| Arbalist | ☐ HB-SSR-ARB Vox Funalis, Blood of the Storm Bell | ☐ HB-SR-ARB Bronislava Clangora, Who Ended the Hundred Rings | ☐ HB-R-ARB Ludmila Resonans, Prefect of the Midnight Roof |
| Exorcist | ☐ HB-SSR-EXO Echoa Sonora, Child of the Great Bell | ☐ HB-SR-EXO Zvenislava Pulsatrix, Who Ended the Silent Toll | ☐ HB-R-EXO Radomira Tinnula, Standard-Bearer of the Toll Company |

## Rank ladder: Commander, Legend, Demigoddess, Deity

Each tier is a big visual leap. R and SR are mortal heroes; SSR and UR are clearly divine. Her class sets her armour weight; her rank sets its grandeur. Fanservice and zeal marks scale with rank.

| Tier | What she is | Armour and kit | Head | Cape or mantle | Divine tell | Neckline finish | Zeal marks | Effects on the sprite | Pose | Splash scale |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R Commander | a hardened war leader | full fitted, battle-scarred plate | her Order head, crested | long war-cape | none, mortal | trimmed in Order metal | worn with pride | none, one weapon glint at most | commanding, calling the charge | leads a company through carnage |
| SR Legend | a hero whose deeds are sung | legendary, rune-etched armour; a named weapon; monster trophies | legend's crown or crest | heroic double cape or beast-pelt cape | a faint aura, rune glow, no halo | gilt around a legendary emblem | etched like legend | one rune glow | heroic, foot on a fallen foe | stands over a slain horror |
| SSR Demigoddess | half-divine | god-forged burning armour cracked with fire-light | partial halo or crown of flame | cape that turns to flame, half-formed wings | glowing eyes or scripture-veins, scorching wind | bold glowing divine trim | glowing on her skin | one divine cluster | weightless, a heel off the ground | descends; mortals tiny below her |
| UR Deity | a goddess of her Order | armour of an impossible divine substance | colossal full halo or crown of her Order's element | wings or a wing-mantle of her Order's miracle | blazing eyes, she floats, sigils orbit her | framed in living fire | blazing like scripture of fire | 2-3 divine clusters | a god's judgement | towers over a cathedral, sky torn open |
| Limited UR Patron Deity | the highest god of her Order | everything a Deity has, bigger | the largest halo plus a second halo in Order colour | the vastest wings or mantle | an aura no other Sister in her Order has | living fire | blazing | 3 divine clusters | the Order prostrate | her Order worships at her feet |

Head by tier for each Order:

| Order | R Commander | SR Legend | SSR Demigoddess | UR Deity |
| --- | --- | --- | --- | --- |
| Iron Vigil | a crested iron helm with a lit watch-lantern | a legendary iron helm crowned with watch-lanterns and a sigil crest | a half-divine iron crown-helm with a partial halo of lantern-light | a colossal crown of eternal amber watch-fires, a full halo of burning lanterns |
| Ashen Mercy | a tall wimple with sheltered candle cups | a legend's wimple-crown with an ember-lit candle cup | a burning wimple-crown with a partial halo of embers | a full halo of embers that never cools, ash-wings rising behind her head |
| Veiled Tribunal | an angular veil and high collar hung with judicial seals | a legend's veil crowned with angular seals and a scale crest | a veil glowing with judging violet eyes, a partial halo of writs | a veil of night sky studded with judging eyes, a crown of floating seals |
| Sepulcher Watch | a hood with a finger-bone diadem | a legend's ossuary diadem hung with funerary keys | a bone crown with a partial halo of bone-white light | a towering ossuary crown with a full halo of bone-white light |
| Choir of the Pyre | a crown of dripping candles | a tall legend's crown of candles and hymn ribbons | a crown of candles burning with hymn-light, a partial halo | a cathedral crown of a hundred candles that never gutter, a full halo of hymn-light |
| Verdant Martyrdom | a crown of living briar | a legend's crown of briar in red bloom | a crown of briar and roses with a partial thorn halo | a towering crown of living briar and roses, a full thorn halo |
| Drowned Litany | a verdigris visor helm with pearls | a legend's visor helm crowned with pearls and coral | a crown of coral and pearls with water rising into a partial halo | a drowned-bell crown streaming water that rises upward into a full halo |
| Confessors of Glass | a frosted faceplate under a coif with a black-glass pane | a stained-glass faceplate and a legend's mirror circlet | a mirror crown with a partial halo of floating shards | a crown of floating mirror panes that show the viewer's sins, a full halo of shards |
| Crimson Inquisition | a wide-brimmed inquisitor's hat with a gilt seal | a legend's inquisitor hat hung with writs and a branding-iron crest | a crown of branding irons with a partial halo of red-hot brands | a crown of gold branding irons, a full halo of red-hot brands |
| Hallowed Belfry | a bell coif hung with bronze bells | a legend's bell coif with a cracked-bell crest | a bell crown ringing with visible sound, a partial halo | a great cracked-bell crown whose silence rings, a full halo of sound rings |

## Weapon ladder per class

How each class's gear grows with rarity. Trim, halo and effect budgets follow the rank table in order-bible.md; the Order sets materials and colours.

| Class | R | SR | SSR | UR |
| --- | --- | --- | --- | --- |
| Hierophant (Tower) | a plain wooden reliquary shield with a small iron-bound shrine, a short iron mace | an engraved reliquary shield whose shrine doors open on a tiny figure, a flanged mace | a cathedral-front reliquary shield with a lit shrine core, a ceremonial mace | a living chapel-shield whose shrine holds a miracle |
| Sentinel (Wedge) | a plain tall kite shield and a longsword | a coffin-lid shield with iron bands and a longsword with an engraved fuller | a tall tomb-door shield with a carved effigy and an oath-bound sword | a sarcophagus-lid shield that holds a sleeping saint's light |
| Martyr (Open cross) | a plain broadsword and a round buckler, simple bandages | an engraved broadsword, a buckler with an Order boss, wrapped vow chains | a heavy martyr's blade with a glowing wound-mark, an ornate buckler | a blade that bleeds light, a buckler crowned with a broken halo |
| Confessor (Pillar) | a plain leather beak mask, a vial satchel and a small mace | a tooled beak mask, labelled vials and a flanged mace | a silver-capped beak mask, a glowing cure vial and a censer-mace | a beak mask whose breath cures plague |
| Hospitaller (Staff) | a plain lance-staff and a pewter cup | an engraved lance-staff with a ribbon and a silver chalice | a banner lance-staff and a sealed silver chalice with a lit core | a chalice that never runs dry, overflowing with light |
| Abbess (Crook) | a plain wooden crozier wound with one thorn vine | an iron crozier with an engraved spiral hook and thorns | a crozier whose hook holds a lit relic, thorns in bloom | a crozier of living thorn that flowers when she heals |
| Oracle (Hourglass) | a plain ash bowl or omen stones, no weapon | an engraved omen reliquary on a short staff | a floating omen reliquary with a bright core | an omen that writes itself in the air around her |
| Cantor (Bell) | a plain hymnal and a small hand-bell | a bound hymnal with clasps and a singing bell | a great illuminated hymnal and a tuning staff whose note shines | a hymn that hangs in the air as written light |
| Adjudicator (Square) | a plain ledger and a small hanging scale | a tooled ledger, engraved scales and a seal stamp | an iron-bound codex of judgements and scales with a glowing pan | scales that weigh souls in light |
| War-Sister (X) | a plain iron flail (or a plain rapier for a Duelist) | a spiked flail with an engraved haft (or a rapier with a basket hilt and dueling gauntlet) | a relic flail with a caged head (or a saint-forged rapier and a silver gauntlet) | a flail or blade wreathed in her Order's miracle |
| Executioner (Brim) | a plain executioner's axe or heavy sword | an engraved axe with a writ tied to the haft | a great execution axe hung with a broken bell or seal | an axe whose edge shows the sins of who it strikes |
| Veilblade (Needle) | two plain daggers | two engraved daggers, one hidden in her habit | twin ritual daggers, one hidden in a prayer book | twin daggers that leave hanging cuts of light |
| Censer (Pendulum) | a plain iron censer on a chain | an engraved bronze censer on a long chain | a caged lantern-censer with a lit core and a signature smoke | a censer whose smoke takes holy shapes |
| Arbalist (Bolt-line) | a plain wooden crossbow and a quiver | an engraved crossbow with a steel prod and a tooled quiver | a saint-bound heavy crossbow with a glowing bolt | a crossbow whose bolts are consecrated light |
| Exorcist (Lantern) | a plain iron lantern on a pole | an engraved lantern pole hung with stole strips | a covered witchfire brazier on a staff with a lit core | a lantern holding a captured holy fire |

## Variety check

- Hairstyles: 0 repeats within any Order (shape + detail + colour; no hair shape used more than 4 times in an Order).
- Skin tones across the roster: olive 126, brown 125, fair 124, deep 123.
- Face shapes across the roster: angular with high cheekbones 85, oval 83, square jaw 83, long and narrow 83, round 82, heart-shaped 81.
- First names: 500 unique of 500. Full names unique: True.
- Personal details: no repeats inside an Order.
- Ages: every Sister is a young adult, 21 to 29 (21-29); no age lines, grey streaks or weathered faces. Silver and platinum hair are styled youthful. The three locked references keep their approved look.
- Fanservice: every Sister shows cleavage or underboob (Neckline line, set per role so it fits her armour) and is video-game hot; non-explicit gacha fanservice, no nudity.
- Tone: every card has a zeal mark (scripture tattoos, purity seals, heretic chains, brands and so on) and every splash leans into dark, gritty occult inquisition and crusade.
- Rank: R Commander, SR Legend, SSR Demigoddess, UR Deity, Limited UR Patron Deity. Each Sister's armour, head, cape, divine tell, neckline finish, zeal marks, effects, pose and splash scale come from her tier (see the rank ladder).
- Attitude: every card asks for the baddest baddie: young, beautiful, fierce and battle-hardened. Every Sister has a personal detail plus a battle mark (a scar or war paint), and every expression is confident or dangerous.
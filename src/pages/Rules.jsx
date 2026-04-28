import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './Rules.css';

const STATIC_HR = `
**1.** Na početku igre svaki igrač (2–8) ima 4 figurice smještene u HOME kvadrat iste boje. Cilj je smjestiti sve figurice u kućicu iste boje (polja 1–4) kretanjem po mapi u smjeru kazaljke na satu.

**2.** Bacanjem kocke određuje se tko prvi počinje. Ako više igrača baci isti najveći broj, ti igrači bacaju opet. Sljedeći igrač je u smjeru kazaljke na satu.

**3.** Ako igrač ima sve figurice u HOME-u ili uzastopno u kućicama (4 pa niže), ima **3 bacanja** da dobije 6.

**4.** Figurica izlazi na ploču kad se dobije **6**. Svaka boja ima **dva izlaza**: jedan na unutarnjem prstenu (kraća ruta), drugi na vanjskom prstenu (dulja ruta).

**5.** Svako polje broji se kao jedan. Cijeli broj s kocke mora se iskoristiti za jednu figuricu, kretanjem do polja neposredno prije vlastite boje ulaza u kućice.

**6.** Bacanje **6** daje pravo na još jedno bacanje.

**7.** Na istom polju smije biti samo jedna figurica.

**8.** Ako figurica stane na polje gdje je figurica druge boje, ta figurica odlazi u HOME.

**9.** Posebna polja: MOST, KOCKA, REWIND, BOMBA, STOP, ZAMJENA.

- **MOST** – igrač bira hoće li ostati ili prijeći most (skok na paralelni prsten).
- **KOCKA** – igrač odmah baca dvije kocke i pomiče tu figuricu za njihov zbroj.
- **REWIND** – figurica se sljedeći potez kreće unazad.
- **BOMBA** – figurica se vraća u HOME.
- **STOP** – figurica se može kretati samo za 1 (kad se dobije 1).
- **ZAMJENA** – igrač baca kocku i zamjenjuje figuricu s figuricom boje koja je određena brojenjem od lijevog igrača u smjeru kazaljke.

**10.** Pobjeđuje igrač koji prvi posloži figurice u kućice 1–4.
`;

const DYNAMIC_HR = `
*Sve osnove statičkog moda vrijede, uz sljedeće izmjene:*

**8.** Kad figurica stane na polje gdje je protivnička figurica, **oba igrača bacaju kocku** – tko baci veći broj, ostaje. Ako su jednaki, bacaju opet.

**9.a)** Na početku igre svaki igrač dobiva jednak broj svake vrste posebnih polja. Broj po igraču = ⌊8 ÷ broj_igrača⌋.

**9.b)** Nakon poteza, igrač **može postaviti posebno polje** (koje ima u ruci) na polje gdje je stala figurica — ako to polje već nije posebno, nije izlazak igrača te boje i (za MOST) postoji paralelni kvadratić bez mosta.

**9.c)** Posebno polje se **odmah aktivira** za figuricu koja je na njemu. Za BOMBU: figurica se pomiče u sljedećem potezu ili odlazi kući.

**9.d)** Igrač koji dobije **6** može odabrati figuricu na posebnom polju da to posebno polje uzme u ruku. Zatim baca kocku ponovo.

**9.e)** Posebno polje ostaje do kraja igre ili dok ga netko ne pokupi.

**9.4 BOMBA** – figurica koja stane na bombu vraća se kući, a igrač koji je postavio bombu **uzima je natrag** u ruku.

**9.6 ZAMJENA** – igrač bira figuricu boje igrača koji je postavio to posebno polje.
`;

const STATIC_EN = `
**1.** Each player (2–8) starts with 4 pieces in their HOME area. Goal: move all pieces into your numbered finish slots (1–4) clockwise around the board.

**2.** Roll to determine who goes first; ties re-roll. Next player is clockwise.

**3.** If all pieces are stuck (in HOME or consecutively placed in finish slots from 4 downward), the player gets **3 rolls** to get a 6.

**4.** A piece exits HOME on a **6**. Each color has **two exits**: one on the inner ring (shorter route), one on the outer ring (longer route).

**5.** Every square counts as one step. The full dice value must be spent by one piece, moving clockwise, stopping before the color's own finish entry.

**6.** Rolling a **6** grants one bonus roll.

**7.** Only one piece per square is allowed.

**8.** Landing on an opponent's piece sends it back to HOME.

**9.** Special squares: BRIDGE, DICE, REWIND, BOMB, STOP, SWAP.

- **BRIDGE** – choose to stay or teleport to the parallel ring.
- **DICE** – immediately roll two dice and move that piece by their sum.
- **REWIND** – piece moves backward on its next turn.
- **BOMB** – piece returns to HOME.
- **STOP** – piece can only move when the die shows 1.
- **SWAP** – roll to determine which opponent's piece swaps positions with yours (count clockwise from left neighbor).

**10.** First player to fill finish slots 1–4 wins.
`;

const DYNAMIC_EN = `
*All static rules apply, with these changes:*

**8.** When a piece lands on an opponent's square, **both players roll** — higher number stays. Ties re-roll.

**9.a)** At game start each player receives an equal number of each special type: ⌊8 ÷ player_count⌋ per type.

**9.b)** After a move, the active player **may place a special square** from their hand onto the square just landed — if that square is not already special, not the player's own exit cell, and (for BRIDGE) a parallel ring cell exists.

**9.c)** Placed special squares **activate immediately** for the piece on that square. For BOMB: the piece must move next turn or returns home.

**9.d)** A player who rolls **6** may pick up a special square from any piece's current square (taking it into hand). They then roll again.

**9.e)** Special squares remain until the end of the game or until collected.

**9.4 BOMB** – the piece goes home; the player who placed the bomb **reclaims it** into their hand.

**9.6 SWAP** – the landing player swaps with a piece belonging to the player who placed this SWAP.
`;

export default function Rules() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState('static');

  const content = tab === 'static'
    ? (lang === 'hr' ? STATIC_HR : STATIC_EN)
    : (lang === 'hr' ? DYNAMIC_HR : DYNAMIC_EN);

  return (
    <div className="rules-page page">
      <div className="rules-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('navBack')}</button>
        <h2 className="rules-title">{t('rulesTitle')}</h2>
      </div>

      <div className="rules-tabs">
        <button
          className={`rules-tab ${tab === 'static' ? 'rules-tab--active' : ''}`}
          onClick={() => setTab('static')}
        >
          {t('rulesStatic')}
        </button>
        <button
          className={`rules-tab ${tab === 'dynamic' ? 'rules-tab--active' : ''}`}
          onClick={() => setTab('dynamic')}
        >
          {t('rulesDynamic')}
        </button>
      </div>

      <div className="rules-scroll">
        {content.trim().split('\n\n').map((para, i) => (
          <p key={i} className="rules-para" dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
        ))}
      </div>
    </div>
  );
}
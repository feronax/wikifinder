import { describe, it, expect } from 'vitest'
import { normalize, wordsMatch, splitOnApostrophe, cleanTokenValue } from '@/lib/matching'

describe('normalize', () => {
  it('lowercases ASCII', () => {
    expect(normalize('CHAT')).toBe('chat')
  })
  it('strips NFD accents (é → e)', () => {
    expect(normalize('élève')).toBe('eleve')
  })
  it('strips NFD accents (à, ô, ç)', () => {
    expect(normalize('à la mode')).toBe('a la mode')
    expect(normalize('hôtel')).toBe('hotel')
    expect(normalize('français')).toBe('francais')
  })
  it('handles empty string', () => {
    expect(normalize('')).toBe('')
  })
})

describe('wordsMatch', () => {
  it('matches identical words', () => {
    expect(wordsMatch('chat', 'chat')).toBe(true)
  })
  it('matches case-insensitively via normalize', () => {
    expect(wordsMatch('Chat', 'chat')).toBe(true)
  })
  it('matches FR plural -s (chat ↔ chats)', () => {
    expect(wordsMatch('chat', 'chats')).toBe(true)
    expect(wordsMatch('chats', 'chat')).toBe(true)
  })
  it('matches FR plural -x (bijou ↔ bijoux)', () => {
    expect(wordsMatch('bijou', 'bijoux')).toBe(true)
    expect(wordsMatch('bijoux', 'bijou')).toBe(true)
  })
  it('matches EN plural -es (fox ↔ foxes)', () => {
    expect(wordsMatch('fox', 'foxes')).toBe(true)
    expect(wordsMatch('foxes', 'fox')).toBe(true)
  })
  it('matches FR plural aux→al (cheval ↔ chevaux)', () => {
    expect(wordsMatch('cheval', 'chevaux')).toBe(true)
    expect(wordsMatch('chevaux', 'cheval')).toBe(true)
  })
  it('rejects unrelated words', () => {
    expect(wordsMatch('chat', 'chien')).toBe(false)
  })
  it('matches accented and non-accented (élève ↔ eleve)', () => {
    expect(wordsMatch('élève', 'eleve')).toBe(true)
  })
  it('matches EN irregular plural f→ves (knife ↔ knives)', () => {
    expect(wordsMatch('knife', 'knives')).toBe(true)
    expect(wordsMatch('knives', 'knife')).toBe(true)
  })
  it('matches EN irregular plural f→ves (leaf ↔ leaves)', () => {
    expect(wordsMatch('leaf', 'leaves')).toBe(true)
    expect(wordsMatch('leaves', 'leaf')).toBe(true)
  })
  it('matches EN irregular plural man→men (man ↔ men)', () => {
    expect(wordsMatch('man', 'men')).toBe(true)
    expect(wordsMatch('men', 'man')).toBe(true)
  })
  it('matches EN irregular plural man→men (woman ↔ women)', () => {
    expect(wordsMatch('woman', 'women')).toBe(true)
    expect(wordsMatch('women', 'woman')).toBe(true)
  })
  it('matches EN irregular plural child ↔ children', () => {
    expect(wordsMatch('child', 'children')).toBe(true)
    expect(wordsMatch('children', 'child')).toBe(true)
  })
  it('matches EN irregular plural tooth ↔ teeth', () => {
    expect(wordsMatch('tooth', 'teeth')).toBe(true)
    expect(wordsMatch('teeth', 'tooth')).toBe(true)
  })
  it('matches EN irregular plural foot ↔ feet', () => {
    expect(wordsMatch('foot', 'feet')).toBe(true)
    expect(wordsMatch('feet', 'foot')).toBe(true)
  })
  it('matches EN irregular plural mouse ↔ mice', () => {
    expect(wordsMatch('mouse', 'mice')).toBe(true)
    expect(wordsMatch('mice', 'mouse')).toBe(true)
  })
  it('matches EN irregular plural goose ↔ geese', () => {
    expect(wordsMatch('goose', 'geese')).toBe(true)
    expect(wordsMatch('geese', 'goose')).toBe(true)
  })
  it('matches EN verb +ing simple (walk ↔ walking)', () => {
    expect(wordsMatch('walk', 'walking')).toBe(true)
    expect(wordsMatch('walking', 'walk')).toBe(true)
  })
  it('matches EN verb +ed simple (walk ↔ walked)', () => {
    expect(wordsMatch('walk', 'walked')).toBe(true)
    expect(wordsMatch('walked', 'walk')).toBe(true)
  })
  it('matches EN verb e-drop +ing (love ↔ loving)', () => {
    expect(wordsMatch('love', 'loving')).toBe(true)
    expect(wordsMatch('loving', 'love')).toBe(true)
  })
  it('matches EN verb e-drop +d (love ↔ loved)', () => {
    expect(wordsMatch('love', 'loved')).toBe(true)
    expect(wordsMatch('loved', 'love')).toBe(true)
  })
  it('matches EN verb stem-doubling run ↔ running', () => {
    expect(wordsMatch('run', 'running')).toBe(true)
    expect(wordsMatch('running', 'run')).toBe(true)
  })
  it('matches EN verb stem-doubling get ↔ getting', () => {
    expect(wordsMatch('get', 'getting')).toBe(true)
    expect(wordsMatch('getting', 'get')).toBe(true)
  })
  it('matches EN verb stem-doubling hit ↔ hitting', () => {
    expect(wordsMatch('hit', 'hitting')).toBe(true)
    expect(wordsMatch('hitting', 'hit')).toBe(true)
  })
  it('matches EN verb stem-doubling sit ↔ sitting', () => {
    expect(wordsMatch('sit', 'sitting')).toBe(true)
    expect(wordsMatch('sitting', 'sit')).toBe(true)
  })
  it('matches EN verb stem-doubling swim ↔ swimming', () => {
    expect(wordsMatch('swim', 'swimming')).toBe(true)
    expect(wordsMatch('swimming', 'swim')).toBe(true)
  })
  it('matches EN verb stem-doubling begin ↔ beginning', () => {
    expect(wordsMatch('begin', 'beginning')).toBe(true)
    expect(wordsMatch('beginning', 'begin')).toBe(true)
  })
  it('matches EN verb stem-doubling put ↔ putting', () => {
    expect(wordsMatch('put', 'putting')).toBe(true)
    expect(wordsMatch('putting', 'put')).toBe(true)
  })
  it('matches EN verb stem-doubling cut ↔ cutting', () => {
    expect(wordsMatch('cut', 'cutting')).toBe(true)
    expect(wordsMatch('cutting', 'cut')).toBe(true)
  })
  it('matches EN verb stem-doubling set ↔ setting', () => {
    expect(wordsMatch('set', 'setting')).toBe(true)
    expect(wordsMatch('setting', 'set')).toBe(true)
  })
  it('matches FR -er verb infinitive↔participe (manger ↔ mangé)', () => {
    expect(wordsMatch('manger', 'mangé')).toBe(true)
    expect(wordsMatch('mangé', 'manger')).toBe(true)
  })
  it('matches FR -er verb infinitive↔participe (parler ↔ parlé)', () => {
    expect(wordsMatch('parler', 'parlé')).toBe(true)
    expect(wordsMatch('parlé', 'parler')).toBe(true)
  })
  it('FR eau↔eaux already covered by +x rule (no new rule needed)', () => {
    expect(wordsMatch('eau', 'eaux')).toBe(true)
  })

  // ===== Phase 21-01: FR irregular plurals =====
  it('matches FR -al/-aux cheval ↔ chevaux', () => {
    expect(wordsMatch('cheval', 'chevaux')).toBe(true)
    expect(wordsMatch('chevaux', 'cheval')).toBe(true)
  })
  it('matches FR -al/-aux journal ↔ journaux', () => {
    expect(wordsMatch('journal', 'journaux')).toBe(true)
    expect(wordsMatch('journaux', 'journal')).toBe(true)
  })
  it('matches FR -al/-aux travail ↔ travaux', () => {
    expect(wordsMatch('travail', 'travaux')).toBe(true)
    expect(wordsMatch('travaux', 'travail')).toBe(true)
  })
  it('matches FR -al/-aux animal ↔ animaux', () => {
    expect(wordsMatch('animal', 'animaux')).toBe(true)
    expect(wordsMatch('animaux', 'animal')).toBe(true)
  })
  it('matches FR -al exception bal ↔ bals (regular -s)', () => {
    expect(wordsMatch('bal', 'bals')).toBe(true)
    expect(wordsMatch('bals', 'bal')).toBe(true)
  })
  it('matches FR -al exception carnaval ↔ carnavals (regular -s)', () => {
    expect(wordsMatch('carnaval', 'carnavals')).toBe(true)
    expect(wordsMatch('carnavals', 'carnaval')).toBe(true)
  })
  it('matches FR -al exception festival ↔ festivals (regular -s)', () => {
    expect(wordsMatch('festival', 'festivals')).toBe(true)
    expect(wordsMatch('festivals', 'festival')).toBe(true)
  })
  it('matches FR -al exception récital ↔ récitals (regular -s)', () => {
    expect(wordsMatch('récital', 'récitals')).toBe(true)
    expect(wordsMatch('récitals', 'récital')).toBe(true)
  })
  it('matches FR -al exception régal ↔ régals (regular -s)', () => {
    expect(wordsMatch('régal', 'régals')).toBe(true)
    expect(wordsMatch('régals', 'régal')).toBe(true)
  })
  it('matches FR -ou exception genou ↔ genoux', () => {
    expect(wordsMatch('genou', 'genoux')).toBe(true)
    expect(wordsMatch('genoux', 'genou')).toBe(true)
  })
  it('matches FR -ou exception caillou ↔ cailloux', () => {
    expect(wordsMatch('caillou', 'cailloux')).toBe(true)
    expect(wordsMatch('cailloux', 'caillou')).toBe(true)
  })
  it('matches FR -ou exception hibou ↔ hiboux', () => {
    expect(wordsMatch('hibou', 'hiboux')).toBe(true)
    expect(wordsMatch('hiboux', 'hibou')).toBe(true)
  })
  it('matches FR -ou exception bijou ↔ bijoux', () => {
    expect(wordsMatch('bijou', 'bijoux')).toBe(true)
    expect(wordsMatch('bijoux', 'bijou')).toBe(true)
  })
  it('matches FR -ou exception chou ↔ choux', () => {
    expect(wordsMatch('chou', 'choux')).toBe(true)
    expect(wordsMatch('choux', 'chou')).toBe(true)
  })
  it('matches FR -ou exception joujou ↔ joujoux', () => {
    expect(wordsMatch('joujou', 'joujoux')).toBe(true)
    expect(wordsMatch('joujoux', 'joujou')).toBe(true)
  })
  it('matches FR -ou exception pou ↔ poux', () => {
    expect(wordsMatch('pou', 'poux')).toBe(true)
    expect(wordsMatch('poux', 'pou')).toBe(true)
  })
  it('matches FR vowel-change œil ↔ yeux', () => {
    expect(wordsMatch('œil', 'yeux')).toBe(true)
    expect(wordsMatch('yeux', 'œil')).toBe(true)
  })
  it('matches FR vowel-change normalized oeil ↔ yeux', () => {
    expect(wordsMatch('oeil', 'yeux')).toBe(true)
    expect(wordsMatch('yeux', 'oeil')).toBe(true)
  })
  it('matches FR vowel-change ciel ↔ cieux', () => {
    expect(wordsMatch('ciel', 'cieux')).toBe(true)
    expect(wordsMatch('cieux', 'ciel')).toBe(true)
  })
  it('rejects FR over-generation bal → baux (NOT a real plural)', () => {
    expect(wordsMatch('bal', 'baux')).toBe(false)
  })
  it('rejects FR over-generation carnaval → carnavaux', () => {
    expect(wordsMatch('carnaval', 'carnavaux')).toBe(false)
  })
  it('rejects FR over-generation festival → festivaux', () => {
    expect(wordsMatch('festival', 'festivaux')).toBe(false)
  })
  it('matches FR regular -s plural chemin ↔ chemins', () => {
    expect(wordsMatch('chemin', 'chemins')).toBe(true)
    expect(wordsMatch('chemins', 'chemin')).toBe(true)
  })
  it('rejects FR spurious chemin → chemaux', () => {
    expect(wordsMatch('chemin', 'chemaux')).toBe(false)
  })
})

describe('cleanTokenValue', () => {
  // Pre-existing bug surfaced during Phase 21-01: the original regex
  // [^a-zA-ZÀ-ÿ0-9'-] excluded U+0153 (œ) and U+0152 (Œ), so any FR
  // token containing the o-e ligature got mangled (e.g. 'œil' → 'il',
  // 'cœur' → 'cur'). Phase 21-01 documented this in client-hash.test.ts
  // line 125-130; this test locks the fix.
  it("preserves œ (U+0153) in lowercase tokens", () => {
    expect(cleanTokenValue('œil')).toBe('œil')
    expect(cleanTokenValue('cœur')).toBe('cœur')
    expect(cleanTokenValue('sœur')).toBe('sœur')
    expect(cleanTokenValue('bœuf')).toBe('bœuf')
  })
  it("preserves Œ (U+0152) in capitalized tokens", () => {
    expect(cleanTokenValue('Œil')).toBe('Œil')
    expect(cleanTokenValue('Œuvre')).toBe('Œuvre')
  })
  it("still strips punctuation and other non-letter characters", () => {
    expect(cleanTokenValue("cœur,")).toBe('cœur')
    expect(cleanTokenValue("œil.")).toBe('œil')
    expect(cleanTokenValue("(cœur)")).toBe('cœur')
  })
  it("leaves ASCII letters / digits / apostrophe / hyphen alone", () => {
    expect(cleanTokenValue("d'un")).toBe("d'un")
    expect(cleanTokenValue('peut-être')).toBe('peut-être')
    expect(cleanTokenValue('test123')).toBe('test123')
  })
})

// ===== Phase 21-02: FR verb inflection beyond -er =====
describe('wordsMatch — Phase 21-02 FR verb inflection', () => {
  // -- FR -ir verbs (regular -ir/-i past participle) --
  it('matches FR -ir verb finir ↔ fini', () => {
    expect(wordsMatch('finir', 'fini')).toBe(true)
    expect(wordsMatch('fini', 'finir')).toBe(true)
  })
  it('matches FR -ir verb choisir ↔ choisi', () => {
    expect(wordsMatch('choisir', 'choisi')).toBe(true)
    expect(wordsMatch('choisi', 'choisir')).toBe(true)
  })
  it('matches FR -ir verb partir ↔ parti', () => {
    expect(wordsMatch('partir', 'parti')).toBe(true)
    expect(wordsMatch('parti', 'partir')).toBe(true)
  })
  it('matches FR -ir verb dormir ↔ dormi', () => {
    expect(wordsMatch('dormir', 'dormi')).toBe(true)
    expect(wordsMatch('dormi', 'dormir')).toBe(true)
  })
  it('matches FR -ir verb sortir ↔ sorti', () => {
    expect(wordsMatch('sortir', 'sorti')).toBe(true)
    expect(wordsMatch('sorti', 'sortir')).toBe(true)
  })

  // -- FR -re verbs (regular -re/-u past participle) --
  it('matches FR -re verb vendre ↔ vendu', () => {
    expect(wordsMatch('vendre', 'vendu')).toBe(true)
    expect(wordsMatch('vendu', 'vendre')).toBe(true)
  })
  it('matches FR -re verb attendre ↔ attendu', () => {
    expect(wordsMatch('attendre', 'attendu')).toBe(true)
    expect(wordsMatch('attendu', 'attendre')).toBe(true)
  })
  it('matches FR -re verb répondre ↔ répondu', () => {
    expect(wordsMatch('répondre', 'répondu')).toBe(true)
    expect(wordsMatch('répondu', 'répondre')).toBe(true)
  })
  it('matches FR -re verb entendre ↔ entendu', () => {
    expect(wordsMatch('entendre', 'entendu')).toBe(true)
    expect(wordsMatch('entendu', 'entendre')).toBe(true)
  })
  it('matches FR -re verb descendre ↔ descendu', () => {
    expect(wordsMatch('descendre', 'descendu')).toBe(true)
    expect(wordsMatch('descendu', 'descendre')).toBe(true)
  })
  it('matches FR -re verb perdre ↔ perdu', () => {
    expect(wordsMatch('perdre', 'perdu')).toBe(true)
    expect(wordsMatch('perdu', 'perdre')).toBe(true)
  })
  it('matches FR -re verb rendre ↔ rendu', () => {
    expect(wordsMatch('rendre', 'rendu')).toBe(true)
    expect(wordsMatch('rendu', 'rendre')).toBe(true)
  })

  // -- FR named-irregular equivalence classes --
  it('matches FR named-irregular être class (être/été/étant/est/était)', () => {
    const forms = ['être', 'été', 'étant', 'est', 'était']
    for (let i = 0; i < forms.length; i++) {
      for (let j = 0; j < forms.length; j++) {
        if (i === j) continue
        expect(wordsMatch(forms[i], forms[j])).toBe(true)
      }
    }
  })
  it('matches FR named-irregular avoir class (avoir/eu/ayant/a/avait)', () => {
    const forms = ['avoir', 'eu', 'ayant', 'a', 'avait']
    for (let i = 0; i < forms.length; i++) {
      for (let j = 0; j < forms.length; j++) {
        if (i === j) continue
        expect(wordsMatch(forms[i], forms[j])).toBe(true)
      }
    }
  })
  it('matches FR named-irregular aller class', () => {
    const forms = ['aller', 'allé', 'allant', 'va', 'allait']
    for (let i = 0; i < forms.length; i++) {
      for (let j = 0; j < forms.length; j++) {
        if (i === j) continue
        expect(wordsMatch(forms[i], forms[j])).toBe(true)
      }
    }
  })
  it('matches FR named-irregular faire class', () => {
    expect(wordsMatch('faire', 'fait')).toBe(true)
    expect(wordsMatch('faire', 'faisait')).toBe(true)
    expect(wordsMatch('faisant', 'fait')).toBe(true)
  })
  it('matches FR named-irregular dire class', () => {
    expect(wordsMatch('dire', 'dit')).toBe(true)
    expect(wordsMatch('dire', 'disait')).toBe(true)
    expect(wordsMatch('disant', 'dit')).toBe(true)
  })
  it('matches FR named-irregular voir class', () => {
    expect(wordsMatch('voir', 'vu')).toBe(true)
    expect(wordsMatch('voir', 'voit')).toBe(true)
    expect(wordsMatch('voyant', 'voyait')).toBe(true)
  })
  it('matches FR named-irregular savoir class', () => {
    expect(wordsMatch('savoir', 'su')).toBe(true)
    expect(wordsMatch('savoir', 'sait')).toBe(true)
  })
  it('matches FR named-irregular pouvoir class', () => {
    expect(wordsMatch('pouvoir', 'peut')).toBe(true)
    expect(wordsMatch('pouvoir', 'pu')).toBe(true)
  })
  it('matches FR named-irregular vouloir class', () => {
    expect(wordsMatch('vouloir', 'voulu')).toBe(true)
    expect(wordsMatch('vouloir', 'veut')).toBe(true)
  })
  it('matches FR named-irregular devoir class', () => {
    expect(wordsMatch('devoir', 'dû')).toBe(true)
    expect(wordsMatch('devoir', 'doit')).toBe(true)
  })
  it('matches FR named-irregular venir class', () => {
    expect(wordsMatch('venir', 'venu')).toBe(true)
    expect(wordsMatch('venir', 'vient')).toBe(true)
  })
  it('matches FR named-irregular tenir class', () => {
    expect(wordsMatch('tenir', 'tenu')).toBe(true)
    expect(wordsMatch('tenir', 'tient')).toBe(true)
  })
  it('matches FR named-irregular prendre class', () => {
    expect(wordsMatch('prendre', 'pris')).toBe(true)
    expect(wordsMatch('prendre', 'prend')).toBe(true)
    expect(wordsMatch('pris', 'prenant')).toBe(true)
  })
  it('matches FR named-irregular mettre class', () => {
    expect(wordsMatch('mettre', 'mis')).toBe(true)
    expect(wordsMatch('mettre', 'met')).toBe(true)
  })
  it('matches FR named-irregular vivre class', () => {
    expect(wordsMatch('vivre', 'vécu')).toBe(true)
    expect(wordsMatch('vivre', 'vit')).toBe(true)
  })
  it('matches FR named-irregular naître class', () => {
    expect(wordsMatch('naître', 'né')).toBe(true)
    expect(wordsMatch('naître', 'naît')).toBe(true)
  })
  it('matches FR named-irregular mourir class', () => {
    expect(wordsMatch('mourir', 'mort')).toBe(true)
    expect(wordsMatch('mourir', 'meurt')).toBe(true)
  })
  it('matches FR named-irregular boire class', () => {
    expect(wordsMatch('boire', 'bu')).toBe(true)
    expect(wordsMatch('boire', 'boit')).toBe(true)
  })
  it('matches FR named-irregular croire class', () => {
    expect(wordsMatch('croire', 'cru')).toBe(true)
    expect(wordsMatch('croire', 'croit')).toBe(true)
  })
  it('matches FR named-irregular lire class', () => {
    expect(wordsMatch('lire', 'lu')).toBe(true)
    expect(wordsMatch('lire', 'lit')).toBe(true)
  })
  it('matches FR named-irregular écrire class', () => {
    expect(wordsMatch('écrire', 'écrit')).toBe(true)
    expect(wordsMatch('écrire', 'écrivait')).toBe(true)
  })

  // -- Negative cases (prevent -re/-u over-generation on irregular -re verbs) --
  it('does NOT match prendre/prendu (irregular table override prevents -re/-u)', () => {
    expect(wordsMatch('prendre', 'prendu')).toBe(false)
  })
  it('does NOT match mettre/mettu', () => {
    expect(wordsMatch('mettre', 'mettu')).toBe(false)
  })
  it('does NOT match vivre/vivu', () => {
    expect(wordsMatch('vivre', 'vivu')).toBe(false)
  })

  // -- Backward-compat: Phase 20-01 -er rule regression guards --
  it('still matches manger ↔ mangé (Phase 20-01 -er rule)', () => {
    expect(wordsMatch('manger', 'mangé')).toBe(true)
    expect(wordsMatch('mangé', 'manger')).toBe(true)
  })
  it('still matches parler ↔ parlé (Phase 20-01 -er rule)', () => {
    expect(wordsMatch('parler', 'parlé')).toBe(true)
    expect(wordsMatch('parlé', 'parler')).toBe(true)
  })
})

describe('splitOnApostrophe', () => {
  it("splits on ASCII apostrophe (c'est → c, est)", () => {
    expect(splitOnApostrophe("c'est")).toEqual(['c', 'est'])
  })
  it('splits on Unicode curly apostrophe U+2019 (c\u2019est → c, est)', () => {
    expect(splitOnApostrophe('c\u2019est')).toEqual(['c', 'est'])
  })
  it('splits on Unicode left curly apostrophe U+2018 (c\u2018est → c, est)', () => {
    expect(splitOnApostrophe('c\u2018est')).toEqual(['c', 'est'])
  })
  it("splits d'un → d, un", () => {
    expect(splitOnApostrophe("d'un")).toEqual(['d', 'un'])
  })
  it('returns single element when no apostrophe', () => {
    expect(splitOnApostrophe('chat')).toEqual(['chat'])
  })
})

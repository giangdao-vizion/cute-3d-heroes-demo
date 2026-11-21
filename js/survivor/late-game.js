/** Late-game: evolves, mutations, objectives, victory, stars, sidearm. */

export const WIN_TIME = 600; // 10:00 chuẩn
export const OBJECTIVE_INTERVAL = 90;
export const FINAL_BOSS_WAVE = 10;

export const STAR_KEY = 'cute3d.survivor.stars';
export const META_KEY = 'cute3d.survivor.meta';
export const MODE_KEY = 'cute3d.survivor.mode'; // 'standard' | 'endless'

/** Tiến hóa — mở khi đủ skill max + synergy đã kích. */
export const EVOLUTIONS = [
  {
    id:'evoStorm',
    icon:'⚡',
    name:'Bão sét',
    kind:'evolve',
    max:1,
    stats:['CHAIN×2', '+RANGE'],
    requiresMax:['chain', 'multi'],
    synergy:'stormVolley',
    apply:g => {
      g.evolves.evoStorm = true;
      g.power.range *= 1.12;
      g.updateRangeRing?.();
    },
  },
  {
    id:'evoNova',
    icon:'❄💥',
    name:'Nova băng',
    kind:'evolve',
    max:1,
    stats:['BLAST+', 'FREEZE AOE'],
    requiresMax:['freeze', 'blast'],
    synergy:'frostBurst',
    apply:g => { g.evolves.evoNova = true; },
  },
  {
    id:'evoShrapnel',
    icon:'💥➤',
    name:'Mảnh hủy',
    kind:'evolve',
    max:1,
    stats:['SHRAPNEL×2', '+PIERCE'],
    requiresMax:['pierce', 'blast'],
    synergy:'shrapnel',
    apply:g => {
      g.evolves.evoShrapnel = true;
      g.power.pierce += 1;
    },
  },
  {
    id:'evoFrostburn',
    icon:'🔥❄',
    name:'Địa ngục băng lửa',
    kind:'evolve',
    max:1,
    stats:['AURA+', 'SLOW++'],
    requiresMax:['freeze', 'burnAura'],
    synergy:'frostburn',
    apply:g => {
      g.evolves.evoFrostburn = true;
      g.power.burnAura += 1;
      g.updateBurnAura?.();
    },
  },
  {
    id:'evoRing',
    icon:'🌀🔥',
    name:'Vành lửa',
    kind:'evolve',
    max:1,
    stats:['ORBIT BURN', '+ORBIT'],
    requiresMax:['orbit', 'burnAura'],
    synergy:null,
    apply:g => {
      g.evolves.evoRing = true;
      g.power.orbit += 1;
      g.updateOrbit?.();
      g.updateBurnAura?.();
    },
  },
  {
    id:'evoSidearm',
    icon:'🗡🌪',
    name:'Bão dao',
    kind:'evolve',
    max:1,
    stats:['SIDEARM×3', '+SPD'],
    requiresMax:['sidearm'],
    synergy:null,
    needsSidearmMax:true,
    apply:g => {
      g.evolves.evoSidearm = true;
      g.power.sidearmInterval *= 0.72;
    },
  },
];

/** Biến dị muộn — buff mạnh + đánh đổi; thay overflow thuần. */
export const MUTATIONS = [
  {
    id:'mutBoom',
    icon:'💣',
    name:'Đạn nổ',
    kind:'mutation',
    max:1,
    stats:['+BLAST', '-30% MAGNET'],
    apply:g => {
      g.power.blast += 2;
      g.power.magnet *= 0.7;
      g.updateMagnetRing?.();
      g.mutations.mutBoom = true;
    },
  },
  {
    id:'mutVamp',
    icon:'🧛',
    name:'Ma máu',
    kind:'mutation',
    max:1,
    stats:['VAMP×2', '-20% MAX HP'],
    apply:g => {
      g.power.vamp += 3;
      g.hero.baseMaxHp = Math.max(90, Math.round(g.hero.baseMaxHp * 0.8));
      g.recalcAttributes();
      g.hero.hp = Math.min(g.hero.hp, g.hero.maxHp);
      g.mutations.mutVamp = true;
    },
  },
  {
    id:'mutHunter',
    icon:'🎯',
    name:'Thợ săn boss',
    kind:'mutation',
    max:1,
    stats:['+40% BOSS', '+18% DMG TAKEN'],
    apply:g => {
      g.power.elite += 3;
      g.power.takenDamageMult *= 1.18;
      g.syncSupportPassives();
      g.mutations.mutHunter = true;
    },
  },
  {
    id:'mutGlass',
    icon:'🪟',
    name:'Kính vỡ',
    kind:'mutation',
    max:1,
    stats:['+55% ATK', '-35% MAX HP'],
    apply:g => {
      g.power.damageBonus *= 1.55;
      g.hero.baseMaxHp = Math.max(80, Math.round(g.hero.baseMaxHp * 0.65));
      g.recalcAttributes();
      g.hero.hp = Math.min(g.hero.hp, g.hero.maxHp);
      g.mutations.mutGlass = true;
    },
  },
  {
    id:'mutTempo',
    icon:'⏱',
    name:'Nhịp điên',
    kind:'mutation',
    max:1,
    stats:['+35% ATK SPD', '-15% RANGE'],
    apply:g => {
      g.power.interval /= 1.35;
      g.power.range *= 0.85;
      g.updateRangeRing?.();
      g.mutations.mutTempo = true;
    },
  },
  {
    id:'mutMagnet',
    icon:'🌌',
    name:'Hút vũ trụ',
    kind:'mutation',
    max:1,
    stats:['MAGNET×2', '-12% SPEED'],
    apply:g => {
      g.power.magnet *= 2;
      g.hero.baseSpeed *= 0.88;
      g.recalcAttributes();
      g.updateMagnetRing?.();
      g.mutations.mutMagnet = true;
    },
  },
  {
    id:'mutFortress',
    icon:'🛡',
    name:'Pháo đài',
    kind:'mutation',
    max:1,
    stats:['ARMOR+', '-20% SPEED'],
    apply:g => {
      g.attrs.def = Math.min(10, (g.attrs.def || 0) + 3);
      g.hero.baseSpeed *= 0.8;
      g.recalcAttributes();
      g.mutations.mutFortress = true;
    },
  },
  {
    id:'mutOverflow',
    icon:'⚔',
    name:'Sức mạnh dư',
    kind:'mutation',
    max:999,
    stats:['+12% ATK'],
    apply:g => {
      g.power.damageBonus *= 1.12;
      g.recalcAttributes();
    },
  },
];

/** Vũ khí phụ — mở từ Lv 20 hoặc phút 4. */
export const SIDEARM_UNLOCK = {
  id:'sidearm',
  icon:'🗡',
  name:'Dao quỹ đạo',
  kind:'sidearm',
  max:5,
  stats:['SIDEARM', '+DMG'],
  apply:g => {
    g.power.sidearm = (g.power.sidearm || 0) + 1;
    if (g.power.sidearm === 1) {
      g.power.sidearmInterval = 1.15;
      g.toast('🗡 Mở vũ khí phụ: Dao quỹ đạo');
    } else {
      g.power.sidearmInterval *= 0.92;
    }
  },
};

export const OBJECTIVE_DEFS = [
  {
    id:'killPack',
    icon:'☠',
    name:'Dọn đàn',
    desc:'Hạ 18 quái trong 40 giây',
    duration:40,
    target:18,
    metric:'kills',
    reward:'heal',
  },
  {
    id:'eliteHunt',
    icon:'👑',
    name:'Săn tinh anh',
    desc:'Hạ 3 quái tinh anh trong 50 giây',
    duration:50,
    target:3,
    metric:'elites',
    reward:'evolveToken',
  },
  {
    id:'gemRush',
    icon:'◆',
    name:'Săn ngọc',
    desc:'Nhặt 25 giá trị ngọc trong 35 giây',
    duration:35,
    target:25,
    metric:'gemValue',
    reward:'xp',
  },
  {
    id:'surviveHeat',
    icon:'🔥',
    name:'Đứng lửa',
    desc:'Sống sót 28 giây (không chết)',
    duration:28,
    target:28,
    metric:'survive',
    reward:'mutation',
  },
  {
    id:'bossChip',
    icon:'🦖',
    name:'Khắc boss',
    desc:'Gây sát thương cho boss (hoặc hạ 12 quái nếu chưa có boss)',
    duration:45,
    target:1,
    metric:'bossHit',
    reward:'attr',
  },
];

export function getSavedMode() {
  const q = new URLSearchParams(location.search).get('mode');
  if (q === 'endless' || q === 'standard') return q;
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'endless' ? 'endless' : 'standard';
}

export function setSavedMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'endless' ? 'endless' : 'standard');
}

export function loadStars() {
  return Math.max(0, Number(localStorage.getItem(STAR_KEY) || 0));
}

export function saveStars(n) {
  localStorage.setItem(STAR_KEY, String(Math.max(0, Math.floor(n))));
}

export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

/** Sao theo thành tích một ván. */
export function computeRunStars({ victory, seconds, kills, bossKills, evolveCount, level, mode }) {
  let stars = 0;
  stars += Math.min(3, Math.floor(seconds / 120)); // tối đa 3 từ thời gian
  stars += Math.min(2, Math.floor(bossKills / 2));
  stars += Math.min(2, evolveCount);
  stars += level >= 40 ? 1 : 0;
  stars += kills >= 200 ? 1 : 0;
  if (victory) stars += 3;
  if (mode === 'endless' && seconds >= 600) stars += 1;
  return Math.max(1, stars);
}

export function availableEvolutions(game) {
  return EVOLUTIONS.filter(evo => {
    if ((game.upgradeLevels[evo.id] || 0) >= evo.max) return false;
    if (game.evolves?.[evo.id]) return false;
    if (evo.needsSidearmMax) {
      return (game.power.sidearm || 0) >= SIDEARM_UNLOCK.max;
    }
    if (evo.synergy && !game.synergies[evo.synergy]) return false;
    return evo.requiresMax.every(id => {
      if (id === 'sidearm') return (game.power.sidearm || 0) >= SIDEARM_UNLOCK.max;
      const special = game.constructor?.SPECIAL_MAX?.[id];
      // fallback: compare against known max from upgradeLevels + card max 3–5
      const level = game.upgradeLevels[id] || 0;
      const maxById = {
        chain:4, multi:3, freeze:4, blast:4, pierce:3, burnAura:5, orbit:5, sidearm:5,
      };
      return level >= (maxById[id] || 5);
    });
  });
}

export function availableMutations(game) {
  return MUTATIONS.filter(m => {
    if (m.id === 'mutOverflow') return true;
    return (game.upgradeLevels[m.id] || 0) < m.max;
  });
}

export function pickObjective(game) {
  const pool = OBJECTIVE_DEFS.filter(o => {
    if (o.metric === 'bossHit' && !game.enemies.some(e => e.isBoss && !e.dead)) {
      // vẫn cho phép — sẽ fallback kill count trong tracker
    }
    return true;
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

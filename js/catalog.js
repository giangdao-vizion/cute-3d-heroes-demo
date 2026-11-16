// Danh mục model. Tất cả CC0 (miễn phí, dùng thương mại được).
// role: hero | monster | boss | pet. height: chiều cao chuẩn hoá trong game (đơn vị m).
const KK = 'KayKit (Kay Lousberg)';
const QT = 'Quaternius';

export const CATALOG = [
  // ---- Anh hùng (KayKit Adventurers) ----
  { id: 'Knight', name: 'Hiệp sĩ', file: 'models/kaykit/Knight.glb', role: 'hero', height: 1.8, source: KK, pack: 'Adventurers',
    keep: ['1H_Sword', 'Round_Shield'], stats: { hp: 260, dmg: 22, range: 1.6, rate: 0.9, speed: 4.2 },
    anims: { idle: 'Idle', run: 'Running_A', attack: '1H_Melee_Attack_Chop', skill: '2H_Melee_Attack_Spin', hit: 'Hit_A', death: 'Death_A', win: 'Cheer' } },
  { id: 'Barbarian', name: 'Chiến binh rìu', file: 'models/kaykit/Barbarian.glb', role: 'hero', height: 1.8, source: KK, pack: 'Adventurers',
    keep: ['2H_Axe', 'Barbarian_Hat'], stats: { hp: 230, dmg: 34, range: 1.7, rate: 1.2, speed: 4.0 },
    anims: { idle: '2H_Melee_Idle', run: 'Running_A', attack: '2H_Melee_Attack_Chop', skill: '2H_Melee_Attack_Spinning', hit: 'Hit_A', death: 'Death_A', win: 'Cheer' } },
  { id: 'Mage', name: 'Pháp sư', file: 'models/kaykit/Mage.glb', role: 'hero', height: 1.8, source: KK, pack: 'Adventurers',
    keep: ['2H_Staff', 'Mage_Hat'], ranged: true, stats: { hp: 170, dmg: 20, range: 7, rate: 0.8, speed: 4.0 },
    anims: { idle: 'Idle', run: 'Running_A', attack: 'Spellcast_Shoot', skill: 'Spellcast_Long', hit: 'Hit_A', death: 'Death_A', win: 'Cheer' } },
  { id: 'Rogue', name: 'Sát thủ', file: 'models/kaykit/Rogue.glb', role: 'hero', height: 1.8, source: KK, pack: 'Adventurers',
    keep: ['Knife', 'Knife_Offhand'], stats: { hp: 190, dmg: 15, range: 1.5, rate: 0.45, speed: 5.0 },
    anims: { idle: 'Idle', run: 'Running_B', attack: 'Dualwield_Melee_Attack_Stab', skill: 'Dualwield_Melee_Attack_Slice', hit: 'Hit_A', death: 'Death_A', win: 'Cheer' } },
  { id: 'Rogue_Hooded', name: 'Sát thủ trùm đầu', file: 'models/kaykit/Rogue_Hooded.glb', role: 'hero', height: 1.8, source: KK, pack: 'Adventurers',
    keep: ['1H_Crossbow'], ranged: true, stats: { hp: 180, dmg: 18, range: 6.5, rate: 0.6, speed: 4.8 },
    anims: { idle: 'Idle', run: 'Running_B', attack: '1H_Ranged_Shoot', skill: 'Throw', hit: 'Hit_A', death: 'Death_A', win: 'Cheer' } },

  // ---- Quái (KayKit Skeletons) ----
  { id: 'Skeleton_Minion', name: 'Lính xương nhỏ', file: 'models/kaykit/Skeleton_Minion.glb', role: 'monster', height: 1.4, source: KK, pack: 'Skeletons',
    stats: { hp: 60, dmg: 7, speed: 2.4 },
    anims: { idle: 'Idle', run: 'Walking_D_Skeletons', attack: 'Unarmed_Melee_Attack_Punch_A', hit: 'Hit_A', death: 'Death_C_Skeletons' } },
  { id: 'Skeleton_Warrior', name: 'Xương chiến binh', file: 'models/kaykit/Skeleton_Warrior.glb', role: 'monster', height: 1.6, source: KK, pack: 'Skeletons',
    stats: { hp: 90, dmg: 10, speed: 2.2 },
    anims: { idle: 'Idle_Combat', run: 'Running_C', attack: 'Unarmed_Melee_Attack_Kick', hit: 'Hit_B', death: 'Death_C_Skeletons' } },
  { id: 'Skeleton_Mage', name: 'Xương pháp sư', file: 'models/kaykit/Skeleton_Mage.glb', role: 'monster', height: 1.6, source: KK, pack: 'Skeletons',
    stats: { hp: 70, dmg: 9, speed: 2.2 },
    anims: { idle: 'Idle_B', run: 'Walking_B', attack: 'Spellcast_Shoot', hit: 'Hit_A', death: 'Death_C_Skeletons' } },
  { id: 'Skeleton_Rogue', name: 'Xương sát thủ', file: 'models/kaykit/Skeleton_Rogue.glb', role: 'monster', height: 1.7, source: KK, pack: 'Skeletons',
    stats: { hp: 70, dmg: 9, speed: 2.8 },
    anims: { idle: 'Idle', run: 'Running_A', attack: 'Unarmed_Melee_Attack_Punch_B', hit: 'Hit_A', death: 'Death_C_Skeletons' } },

  // ---- Quái dễ thương (Quaternius) ----
  { id: 'Enemy', name: 'Quái mầm xanh', file: 'models/quaternius/Enemy.glb', role: 'monster', height: 1.0, source: QT, pack: 'Platformer Game Kit',
    stats: { hp: 45, dmg: 6, speed: 2.6 }, anims: { idle: 'Idle', run: 'Walk', attack: 'Bite_Front', hit: 'HitRecieve', death: 'Death', win: 'Dance' } },
  { id: 'Skull', name: 'Đầu lâu bay', file: 'models/quaternius/Skull.glb', role: 'monster', height: 0.9, source: QT, pack: 'Platformer Game Kit',
    stats: { hp: 40, dmg: 6, speed: 3.0 }, anims: { idle: 'Idle', run: 'Walk', attack: 'Bite_Front', hit: 'HitRecieve', death: 'Death', win: 'Dance' } },
  { id: 'Bee', name: 'Ong nhỏ', file: 'models/quaternius/Bee.glb', role: 'monster', height: 0.8, source: QT, pack: 'Platformer Game Kit',
    stats: { hp: 30, dmg: 5, speed: 3.4 }, anims: { idle: 'Flying', run: 'Flying', attack: 'Bite_Front', hit: 'HitRecieve', death: 'Death' } },
  { id: 'Frog', name: 'Ếch', file: 'models/quaternius/Frog.glb', role: 'monster', height: 0.8, source: QT, pack: 'Easy Enemy',
    stats: { hp: 40, dmg: 6, speed: 2.6 }, anims: { idle: 'Frog_Idle', run: 'Frog_Jump', attack: 'Frog_Attack', death: 'Frog_Death' } },
  { id: 'Rat', name: 'Chuột', file: 'models/quaternius/Rat.glb', role: 'monster', height: 0.7, source: QT, pack: 'Easy Enemy',
    stats: { hp: 35, dmg: 5, speed: 3.2 }, anims: { idle: 'Rat_Idle', run: 'Rat_Run', attack: 'Rat_Attack', death: 'Rat_Death' } },
  { id: 'Spider', name: 'Nhện', file: 'models/quaternius/Spider.glb', role: 'monster', height: 0.8, source: QT, pack: 'Easy Enemy',
    stats: { hp: 50, dmg: 7, speed: 2.8 }, anims: { idle: 'Spider_Idle', run: 'Spider_Walk', attack: 'Spider_Attack', death: 'Spider_Death' } },
  { id: 'Wasp', name: 'Ong vò vẽ', file: 'models/quaternius/Wasp.glb', role: 'monster', height: 0.9, source: QT, pack: 'Easy Enemy',
    stats: { hp: 35, dmg: 7, speed: 3.4 }, anims: { idle: 'Wasp_Flying', run: 'Wasp_Flying', attack: 'Wasp_Attack', death: 'Wasp_Death' } },
  { id: 'Snake_angry', name: 'Rắn', file: 'models/quaternius/Snake_angry.glb', role: 'monster', height: 0.7, source: QT, pack: 'Easy Enemy',
    stats: { hp: 40, dmg: 6, speed: 2.4 }, anims: { idle: 'Snake_Idle', run: 'Snake_Walk', attack: 'Snake_Attack' } },
  { id: 'Velociraptor', name: 'Khủng long nhỏ', file: 'models/quaternius/Velociraptor.glb', role: 'monster', height: 1.2, source: QT, pack: 'Animated Dinosaurs',
    stats: { hp: 70, dmg: 9, speed: 3.6 }, anims: { idle: 'Velociraptor_Idle', run: 'Velociraptor_Run', attack: 'Velociraptor_Attack', death: 'Velociraptor_Death' } },

  // ---- Boss ----
  { id: 'Trex', name: 'Boss T-Rex', file: 'models/quaternius/Trex.glb', role: 'boss', height: 3.2, source: QT, pack: 'Animated Dinosaurs',
    stats: { hp: 900, dmg: 25, speed: 2.4 }, anims: { idle: 'TRex_Idle', run: 'TRex_Walk', attack: 'TRex_Attack', death: 'TRex_Death' } },
  { id: 'Triceratops', name: 'Boss Khủng long sừng', file: 'models/quaternius/Triceratops.glb', role: 'boss', height: 2.4, source: QT, pack: 'Animated Dinosaurs',
    stats: { hp: 800, dmg: 22, speed: 2.6 }, anims: { idle: 'Triceratops_Idle', run: 'Triceratops_Walk', attack: 'Triceratops_Attack', death: 'Triceratops_Death' } },

  // ---- Thú cưng đi theo ----
  { id: 'ShibaInu', name: 'Chó Shiba', file: 'models/quaternius/ShibaInu.glb', role: 'pet', height: 0.9, source: QT, pack: 'Ultimate Animated Animals',
    anims: { idle: 'Idle', run: 'Gallop', attack: 'Attack', death: 'Death' } },
  { id: 'Fox', name: 'Cáo', file: 'models/quaternius/Fox.glb', role: 'pet', height: 0.9, source: QT, pack: 'Ultimate Animated Animals',
    anims: { idle: 'Idle', run: 'Gallop', attack: 'Attack', death: 'Death' } },
  { id: 'Husky', name: 'Chó Husky', file: 'models/quaternius/Husky.glb', role: 'pet', height: 1.0, source: QT, pack: 'Ultimate Animated Animals',
    anims: { idle: 'Idle', run: 'Gallop', attack: 'Attack', death: 'Death' } },
  { id: 'Character', name: 'Bé tròn (nhân vật platformer)', file: 'models/quaternius/Character.glb', role: 'pet', height: 1.1, source: QT, pack: 'Platformer Game Kit',
    anims: { idle: 'Idle', run: 'Run', attack: 'Punch', death: 'Death', win: 'Wave' } },
];

export const ROLE_LABEL = { hero: 'Anh hùng', monster: 'Quái', boss: 'Boss', pet: 'Thú cưng' };
export const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));

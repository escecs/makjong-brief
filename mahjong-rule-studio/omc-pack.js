/* OMC yaku-pack exporter for Mahjong Rule Studio.
 *
 * Converts a rule set's non-builtin rules into a pure-JSON pack consumed by
 * OpenMahjongC's `omc-yaku-pack` compiler. No DOM, no fetch; app.js wires the
 * button and download.
 */
(function (root) {
  'use strict';

  const FORMAT = 'omc-yaku-pack';
  const FORMAT_VERSION = 1;
  /**
   * 游戏侧 compiler 认的公式（packages/core/src/scoring/custom-yaku-pack.ts 的 FUNCTIONS）。
   * 工作室的公式积木比这多，多出来的那些导出时会被拦下——番种包模式也据此隐藏积木。
   */
  const SUPPORTED_FUNCTIONS = ['same', 'unique', 'min', 'max', 'arithmeticStep', 'count', 'abs', 'absdiff', 'add', 'sub', 'mul', 'values', 'occurs', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'if'];
  /** 游戏侧认的和牌等待形式（core 的 WaitShape）；工作室的「特殊」导出时会映射成 none。 */
  const WAIT_VALUES = ['tanki', 'shanpon', 'kanchan', 'penchan', 'ryanmen', 'none'];

  const RIICHI_SIGNALS = [
    'tsumo', 'riichi', 'doubleRiichi', 'ippatsu', 'rinshan', 'chankan',
    'haitei', 'houtei', 'dealer', 'tenhou', 'chiihou',
    'roundWind', 'seatWind', 'doraCount', 'uraCount', 'akaCount', 'waitCount',
  ];
  const GUOBIAO_SIGNALS = [
    'tsumo', 'menqian', 'qianggang', 'gangshang', 'haidi', 'juezhang',
    'flowerCount', 'roundWind', 'seatWind', 'wait',
  ];
  const RIICHI_SHAPES = ['standard', 'chiitoi', 'kokushi'];
  const GUOBIAO_SHAPES = [
    'yiban', 'zuhelong', 'qidui', 'lianqidui', 'quanbukao', 'qixingbukao', 'shisanyao',
  ];
  const CHECK_KEYS = [
    'closed', 'signal', 'shape', 'wait', 'tilesIn', 'contains', 'pairIn',
    'groupTouches', 'suitCount', 'meldCount', 'sequencePairs', 'tileCount',
  ];
  const SOURCES = [
    'groups', 'tiles', 'pair', 'groupPairs', 'groupTriples', 'groupQuads',
    'groupPartitions', 'tileKinds',
  ];
  const KINDS = ['all', 'any', 'not', 'quantifier', 'compare', 'check'];

  const RIICHI_ID_MAP = {
    riichi: 'riichi.lizhi',
    doubleRiichi: 'riichi.doubleLizhi',
    ippatsu: 'riichi.yifa',
    tsumo: 'riichi.menzenTsumo',
    pinfu: 'riichi.pinfu',
    tanyao: 'riichi.tanyao',
    iipeikou: 'riichi.iipeikou',
    sanshoku: 'riichi.sanshokuDoujun',
    ittsu: 'riichi.ittsuu',
    chanta: 'riichi.chanta',
    chiitoi: 'riichi.chiitoitsu',
    toitoi: 'riichi.toitoi',
    sanankou: 'riichi.sanankou',
    sankantsu: 'riichi.sankantsu',
    sanshokuDoukou: 'riichi.sanshokuDoukou',
    honroutou: 'riichi.honroutou',
    shousangen: 'riichi.shousangen',
    honitsu: 'riichi.honitsu',
    junchan: 'riichi.junchan',
    ryanpeikou: 'riichi.ryanpeikou',
    chinitsu: 'riichi.chinitsu',
    haku: 'riichi.yakuhai.haku',
    hatsu: 'riichi.yakuhai.hatsu',
    chun: 'riichi.yakuhai.chun',
    seat: 'riichi.yakuhai.seat',
    round: 'riichi.yakuhai.round',
    rinshan: 'riichi.lingshang',
    chankan: 'riichi.qianggang',
    haitei: 'riichi.haidi',
    houtei: 'riichi.hedi',
    kokushi: 'riichi.kokushi',
    suuankou: 'riichi.suuankou',
    daisangen: 'riichi.daisangen',
    shousuushi: 'riichi.shousushi',
    daisuushi: 'riichi.daisushi',
    tsuuiisou: 'riichi.tsuuiisou',
    chinroutou: 'riichi.chinroutou',
    ryuuiisou: 'riichi.ryuuiisou',
    chuuren: 'riichi.chuuren',
    suukantsu: 'riichi.suukantsu',
    tenhou: 'riichi.tianhu',
    chiihou: 'riichi.dihu',
    openRiichi: 'riichi.openRiichi',
    openDoubleRiichi: 'riichi.openDoubleRiichi',
    renhouMangan: 'riichi.renhouMangan',
    renhouYakuman: 'riichi.renhouYakuman',
    openRiichiYakuman: 'riichi.openRiichiYakuman',
    openDoubleRiichiYakuman: 'riichi.openDoubleRiichiYakuman',
    kokushi13: 'riichi.kokushi13',
    suuankouTanki: 'riichi.suuankouTanki',
    chuurenPure: 'riichi.chuurenPure',
    dora: 'riichi.dora',
    akadora: 'riichi.akadora',
    uradora: 'riichi.uradora',
  };

  const GUOBIAO_ID_MAP = {};
  const reverseMap = (map) => Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key]));
  const RIICHI_REVERSE = reverseMap(RIICHI_ID_MAP);
  const GUOBIAO_REVERSE = reverseMap(GUOBIAO_ID_MAP);

  const BASE_PROFILES = {
    riichi: {
      rulesetId: 'riichi-mahjong',
      family: 'riichi',
      signalProfile: 'omc-riichi-v1',
      signals: RIICHI_SIGNALS,
      shapes: RIICHI_SHAPES,
      map: RIICHI_ID_MAP,
      valueKind: 'han',
      shapeMap: {},
    },
    mcr: {
      rulesetId: 'guobiao-mahjong',
      family: 'guobiao',
      signalProfile: 'omc-guobiao-v1',
      signals: GUOBIAO_SIGNALS,
      shapes: GUOBIAO_SHAPES,
      map: GUOBIAO_ID_MAP,
      valueKind: 'points',
      shapeMap: {
        standard: 'yiban',
        chiitoi: 'qidui',
        kokushi: 'shisanyao',
        lesserKnitted: 'quanbukao',
      },
    },
  };

  function profileFor(ruleSetId) {
    return BASE_PROFILES[ruleSetId] || null;
  }

  function slugify(id) {
    return String(id || 'yaku')
      .replace(/^custom_/, '')
      .replace(/^copy_[a-z0-9]+_/i, '')
      .replace(/[^A-Za-z0-9_.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'yaku';
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mapShape(profile, ast) {
    if (!ast || typeof ast !== 'object') return ast;
    const out = clone(ast);
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'check' && node.key === 'shape') {
        const mapped = profile.shapeMap[node.value];
        if (mapped) node.value = mapped;
      }
      // 等待形式「特殊」没有对应值：这里不映射，由导出前的检查报错，
      // 避免悄悄生成一条永不成立的条件（见 lintDetailed 的 wait 校验）。
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(out);
    return out;
  }

  function mapSuppress(profile, id) {
    if (typeof id !== 'string') return { id: String(id), mapped: false };
    if (profile.map[id]) return { id: profile.map[id], mapped: true };
    if (id.startsWith('riichi.') || id.startsWith('custom.')) return { id, mapped: true };
    return { id, mapped: false };
  }

  function studioSuppress(baseId, id) {
    const reverse = baseId === 'guobiao-mahjong' ? GUOBIAO_REVERSE : RIICHI_REVERSE;
    return reverse[id] || id;
  }

  function buildPack(options) {
    const {
      ruleSet,
      rules,
      categories,
      packId,
      name,
      author,
      version,
    } = options || {};
    const profile = profileFor(ruleSet && ruleSet.id);
    if (!profile) throw new Error('仅支持立直（riichi）与国标（mcr）规则体系');
    if (!Array.isArray(rules) || rules.length === 0) throw new Error('没有可导出的自制番型');

    const safePackId = String(packId || 'pack')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'pack';

    const used = new Set();
    const exportedIds = new Map();
    const yaku = rules.map((r, index) => {
      const baseSlug = slugify(r.id) || `yaku_${index}`;
      let slug = baseSlug;
      let n = 2;
      while (used.has(slug)) slug = `${baseSlug}_${n++}`;
      used.add(slug);
      exportedIds.set(r.id, `custom.${safePackId}.${slug}`);

      const isYakuman = profile.valueKind === 'han'
        && (r.category === 'yakuman'
          || (r.category !== 'additive' && Number(r.yakuman || 0) > 0));
      const item = {
        id: `custom.${safePackId}.${slug}`,
        name: String(r.name || '新番种').slice(0, 40),
        description: String(r.description || '').slice(0, 200),
        category: isYakuman ? 'yakuman' : 'additive',
        suppresses: [],
        configurable: true,
        ast: mapShape(profile, r.ast || { kind: 'all', children: [] }),
      };

      if (profile.valueKind === 'han') {
        item.closedHan = Math.max(0, Math.min(99, Math.round(Number(r.closedHan || 0))));
        item.openHan = r.openHan === null || r.openHan === undefined
          ? null
          : Math.max(0, Math.min(99, Math.round(Number(r.openHan))));
        item.yakumanLevel = isYakuman
          ? Math.max(0, Math.min(2, Math.round(Number(r.yakuman || 1))))
          : 0;
      } else {
        item.points = Math.max(1, Math.min(999, Math.round(Number(r.points ?? r.closedHan ?? 0))));
      }

      return item;
    });

    const dropped = [];
    yaku.forEach((item, index) => {
      for (const raw of Array.isArray(rules[index].suppresses) ? rules[index].suppresses : []) {
        if (exportedIds.has(raw)) { item.suppresses.push(exportedIds.get(raw)); continue; }
        const mapped = mapSuppress(profile, raw);
        if (mapped.mapped) { item.suppresses.push(mapped.id); continue; }
        // 同一个工作室里的自制番种没有随本次导出（没载入 / 没启用）：包里没有它就不该引用它，
        // 否则游戏侧会以「unknown or self-suppressed yaku」整包拒绝。
        if (/^custom/.test(String(raw))) { dropped.push(raw); continue; }
        throw new Error(`覆盖目标不可导出：${raw}`);
      }
    });
    if (dropped.length && root.console && root.console.warn) {
      root.console.warn('[OMC pack] 已跳过未随包导出的覆盖目标：' + [...new Set(dropped)].join('、'));
    }

    const cats = (Array.isArray(categories) ? categories : [])
      .filter((c) => c && c.kind === 'tiles' && Array.isArray(c.tiles) && c.tiles.length > 0)
      .map((c) => ({
        key: String(c.key || ''),
        label: String(c.label || c.key || ''),
        tiles: c.tiles.slice(0, 40),
      }))
      .filter((c) => /^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(c.key));

    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      base: { rulesetId: profile.rulesetId, family: profile.family },
      meta: {
        packId: safePackId,
        name: String(name || `${ruleSet.name || '自制'}番种包`).slice(0, 40),
        author: String(author || '').slice(0, 40),
        version: String(version || '1.0.0').slice(0, 20),
        description: '',
      },
      signalProfile: profile.signalProfile,
      yaku,
      categories: cats,
    };
  }

  // ── 语义检查 ──────────────────────────────────────────────────────────
  // 结构校验只看字段和白名单；下面这类错误它看不出来，而游戏里也不会报错，
  // 只会让番种永远判不中：
  //   1. 属性用错对象（面子没有 honor / 单张牌没有 center …）；
  //   2. 比较两侧类型不一致（面子类型 = 数字）；
  //   3. 数值公式收到非数字参数（mul(2, 顺子)）。
  const NUMERIC_FORMULAS = new Set([
    'add', 'sub', 'mul', 'div', 'mod', 'pow', 'min', 'max',
    'abs', 'absdiff', 'floor', 'ceil', 'round', 'arithmeticStep',
  ]);
  const GROUP_ATTRS = ['type', 'family', 'suit', 'rank', 'center', 'open', 'concealed', 'concealedPung', 'tileCount', 'tiles'];
  const TILE_ATTRS = ['rank', 'suit', 'honor', 'terminal'];
  const KIND_LABELS = { group: '面子', tile: '牌', groupTuple: '面子组合', groupPair: '面子组', partition: '面子分组', tileCollection: '牌', tileList: '牌种' };
  const DOMAIN_LABELS = { number: '数字', bool: '是否', tile: '牌', string: '文本', meldType: '面子类型（顺/刻/杠）', meldFamily: '面子种类（顺/刻类）', suit: '花色' };

  function attrsOf(kind) {
    if (kind === 'group') return GROUP_ATTRS;
    if (kind === 'tile') return TILE_ATTRS;
    return null;
  }
  function elementKind(kind, indexCount) {
    if (kind === 'group') return indexCount === 0 ? 'group' : 'tile';
    if (kind === 'groupTuple') return indexCount === 0 ? 'groupTuple' : indexCount === 1 ? 'group' : 'tile';
    if (kind === 'partition') return indexCount === 0 ? 'partition' : indexCount === 1 ? 'groupPair' : indexCount === 2 ? 'group' : 'tile';
    if (kind === 'tileCollection') return indexCount === 0 ? 'tileCollection' : 'tile';
    if (kind === 'tileList') return indexCount === 0 ? 'tileList' : 'tile';
    return 'tile';
  }
  function kindOfSource(source) {
    if (source === 'groups') return 'group';
    if (source === 'groupPairs' || source === 'groupTriples' || source === 'groupQuads') return 'groupTuple';
    if (source === 'groupPartitions') return 'partition';
    if (source === 'tiles' || source === 'tileKinds' || source === 'hand.concealed') return 'tile';
    return null;
  }

  function lintSemantics(pack) {
    const errors = [];
    const warnings = [];
    const language = root.MJLanguage;
    if (!language || typeof language.parseExpression !== 'function' || !pack || !Array.isArray(pack.yaku)) {
      return { errors, warnings };
    }
    const parse = (src) => {
      try { return language.parseExpression(String(src == null ? '' : src)); } catch { return null; }
    };
    const domainOf = (node) => {
      if (!node) return null;
      if (node.type === 'literal') {
        if (typeof node.value === 'number') return 'number';
        if (typeof node.value === 'boolean') return 'bool';
        if (typeof node.value === 'string') return /^[1-9][mpsz]$/.test(node.value) ? 'tile' : 'string';
        return null;
      }
      if (node.type === 'call') {
        if (NUMERIC_FORMULAS.has(node.name)) return 'number';
        if (node.name === 'category' || node.name === 'containsCategory' || node.name === 'same') return 'bool';
        return null;
      }
      const parts = node.parts || [];
      const attr = parts[parts.length - 1];
      if (attr === 'type') return 'meldType';
      if (attr === 'family') return 'meldFamily';
      if (attr === 'suit') return 'suit';
      if (attr === 'rank' || attr === 'center' || attr === 'tileCount') return 'number';
      if (['open', 'concealed', 'concealedPung', 'honor', 'terminal', 'closed'].includes(attr)) return 'bool';
      if (parts.length === 1 && (parts[0] === 'pair' || parts[0] === 'winning')) return 'tile';
      return null;
    };
    const pathProblem = (node, scope) => {
      const parts = node.parts || [];
      const head = parts[0];
      if (head === 'signals' || head === 'hand') return null;
      let kind = null;
      if (head === 'pair') kind = 'tile';
      else if (head === 'tiles') kind = 'tileCollection';
      else if (head === 'tileKinds') kind = 'tileList';
      else if (Object.prototype.hasOwnProperty.call(scope, head)) kind = scope[head];
      else return null;
      let index = 1;
      let count = 0;
      while (index < parts.length && /^\d+$/.test(parts[index])) { count++; index++; }
      const attr = parts.slice(index).join('.');
      if (!attr) return null;
      const base = attr.split('.')[0];
      const elem = elementKind(kind, count);
      const allowed = attrsOf(elem);
      if (!allowed || allowed.includes(base)) return null;
      return { elem, attr: base };
    };
    const visitExpr = (src, scope, at, name) => {
      const node = parse(src);
      if (!node) return;
      const visit = (item) => {
        if (!item) return;
        if (item.type === 'path') {
          const problem = pathProblem(item, scope);
          if (problem) {
            errors.push(`${at}「${name}」：属性「${problem.attr}」不能用于${KIND_LABELS[problem.elem] || problem.elem}（${(item.parts || []).join('.')}）`);
          }
          return;
        }
        if (item.type === 'call') {
          if (NUMERIC_FORMULAS.has(item.name)) {
            for (const arg of item.args || []) {
              const domain = domainOf(arg);
              if (domain && domain !== 'number') {
                errors.push(`${at}「${name}」：${item.name}(…) 的参数是${DOMAIN_LABELS[domain] || domain}，应为数字`);
              }
            }
          }
          (item.args || []).forEach(visit);
        }
      };
      visit(node);
    };
    const visitNode = (node, scope, at, name) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'quantifier') {
        const inner = Object.assign({}, scope);
        const kind = kindOfSource(node.source);
        if (kind && node.variable) inner[node.variable] = kind;
        (node.children || []).forEach((child) => visitNode(child, inner, at, name));
        return;
      }
      if (node.kind === 'compare') {
        visitExpr(node.left, scope, at, name);
        visitExpr(node.right, scope, at, name);
        const left = domainOf(parse(node.left));
        const right = domainOf(parse(node.right));
        if (left && right && left !== 'string' && right !== 'string' && left !== right) {
          const message = `${at}「${name}」：比较两侧类型不一致（${DOMAIN_LABELS[left] || left} vs ${DOMAIN_LABELS[right] || right}）`;
          if (left === 'number' || right === 'number' || left === 'bool' || right === 'bool' || left === 'tile' || right === 'tile') errors.push(message);
          else warnings.push(message);
        }
        return;
      }
      (node.children || []).forEach((child) => visitNode(child, scope, at, name));
    };

    const profile = pack.base && pack.base.rulesetId === 'guobiao-mahjong' ? BASE_PROFILES.mcr : BASE_PROFILES.riichi;
    const knownRiichiIds = new Set(profile === BASE_PROFILES.riichi ? Object.values(RIICHI_ID_MAP) : []);
    pack.yaku.forEach((yaku, index) => {
      if (!yaku || typeof yaku !== 'object') return;
      const at = `yaku[${index}]`;
      const name = yaku.name || '未命名';
      visitNode(yaku.ast, {}, at, name);
      for (const target of Array.isArray(yaku.suppresses) ? yaku.suppresses : []) {
        if (knownRiichiIds.size && String(target).startsWith('riichi.') && !knownRiichiIds.has(target)) {
          errors.push(`${at}「${name}」：覆盖目标 ${target} 不在立直番种表内`);
        }
      }
    });
    return { errors, warnings };
  }

  function lintDetailed(pack) {
    const errors = [];
    const warnings = [];
    const err = (m) => errors.push(m);
    const warn = (m) => warnings.push(m);

    if (!pack || typeof pack !== 'object') {
      return { errors: ['包不是对象'], warnings };
    }
    if (pack.format !== FORMAT) err('format 必须是 omc-yaku-pack');
    if (pack.formatVersion !== FORMAT_VERSION) err('formatVersion 必须是 1');

    const baseId = pack.base && pack.base.rulesetId;
    const profile = baseId === 'riichi-mahjong'
      ? BASE_PROFILES.riichi
      : baseId === 'guobiao-mahjong'
        ? BASE_PROFILES.mcr
        : null;
    if (!profile) {
      err(`不支持的 base.rulesetId：${String(baseId)}`);
      return { errors, warnings };
    }
    if (pack.base.family !== profile.family) err(`base.family 必须是 ${profile.family}`);
    if (pack.signalProfile !== profile.signalProfile) {
      err(`signalProfile 必须是 ${profile.signalProfile}`);
    }
    if (!pack.meta || !/^[a-z0-9_]{1,32}$/.test(pack.meta.packId || '')) {
      err('meta.packId 必须是 1..32 位小写字母/数字/下划线');
    }
    if (!Array.isArray(pack.yaku) || pack.yaku.length < 1 || pack.yaku.length > 20) {
      err('yaku 必须是 1..20 条');
      return { errors, warnings };
    }

    const ids = new Set();
    const packId = pack.meta && pack.meta.packId;
    pack.yaku.forEach((y, i) => {
      const at = `yaku[${i}]`;
      if (!y || typeof y !== 'object') return err(`${at} 不是对象`);
      if (typeof y.id !== 'string' || !/^custom\.[a-z0-9_]+\.[A-Za-z0-9_.-]+$/.test(y.id)) {
        err(`${at}.id 必须是 custom.<packId>.<slug>`);
      } else {
        if (packId && !y.id.startsWith(`custom.${packId}.`)) {
          err(`${at}.id 必须以 custom.${packId}. 开头`);
        }
        if (ids.has(y.id)) err(`${at}.id 重复`);
        ids.add(y.id);
      }
      if (typeof y.name !== 'string' || !y.name.trim()) err(`${at}.name 不能为空`);
      if (y.category !== 'additive' && y.category !== 'yakuman') {
        err(`${at}.category 必须是 additive/yakuman`);
      }
      if (profile.valueKind === 'han') {
        if (!Number.isInteger(y.closedHan) || y.closedHan < 0 || y.closedHan > 99) {
          err(`${at}.closedHan 必须是 0..99 整数`);
        }
        if (y.openHan !== null && (!Number.isInteger(y.openHan) || y.openHan < 0 || y.openHan > 99)) {
          err(`${at}.openHan 必须是 0..99 整数或 null`);
        }
        if (y.category === 'yakuman') {
          if (!(y.yakumanLevel >= 1)) err(`${at}.yakumanLevel 至少 1`);
        } else if (y.yakumanLevel !== 0) {
          err(`${at}.yakumanLevel 在普通番时必须为 0`);
        }
        if (y.points !== undefined) err(`${at}.points 只用于国标`);
      } else {
        if (!Number.isInteger(y.points) || y.points < 1 || y.points > 999) {
          err(`${at}.points 必须是 1..999 整数`);
        }
        if (y.closedHan !== undefined || y.openHan !== undefined || y.yakumanLevel !== undefined) {
          err(`${at} 国标不能用 closedHan/openHan/yakumanLevel`);
        }
        if (y.category !== 'additive') err(`${at}.category 国标必须是 additive`);
      }
      if (!y.ast || typeof y.ast !== 'object') {
        err(`${at}.ast 缺失`);
        return;
      }
      let nodes = 0;
      const walk = (node, depth) => {
        if (!node || typeof node !== 'object') return err(`${at}.ast 含非法节点`);
        nodes += 1;
        if (nodes > 500) return err(`${at}.ast 超过 500 节点`);
        if (depth > 32) return err(`${at}.ast 超过 32 层`);
        if (!KINDS.includes(node.kind)) err(`${at}.ast 未知 kind：${String(node.kind)}`);
        if (node.kind === 'check') {
          if (!CHECK_KEYS.includes(node.key)) err(`${at}.ast 不支持 check：${String(node.key)}`);
          if (profile.valueKind === 'han' && !['closed','signal','shape','wait'].includes(node.key)) err(`${at}：游戏暂不支持此条件积木：${String(node.key)}`);
          if (node.key === 'shape' && profile.valueKind === 'han' && !['standard', 'chiitoi', 'kokushi'].includes(node.value)) {
            err(`${at}：游戏侧结构分解族只有 四面子一雀头 / 七对子 / 十三幺，「${String(node.value)}」不存在`);
          }
          if (node.key === 'wait') {
            if (node.value === 'special') err(`${at}：游戏没有「特殊」听牌形（国士/九莲会被算成单骑或两面），请改用结构检查`);
            else if (!WAIT_VALUES.includes(node.value)) err(`${at}.ast 未知等待形式：${String(node.value)}`);
          }
          if (node.key === 'signal' && !profile.signals.includes(node.name)) {
            err(`${at}.ast 未知信号：${String(node.name)}`);
          }
          if (node.key === 'shape' && !profile.shapes.includes(node.value)) {
            err(`${at}.ast 未知形状：${String(node.value)}`);
          }
        }
        if (profile.valueKind === 'han' && node.kind === 'compare') {
          for (const expression of [node.left,node.right]) {
            for (const match of String(expression || '').matchAll(/([A-Za-z_][A-Za-z_0-9]*)\s*\(/g)) if (!SUPPORTED_FUNCTIONS.includes(match[1])) err(`${at}：游戏暂不支持公式 ${match[1]}`);
            for (const match of String(expression || '').matchAll(/\bsignals\.([A-Za-z_][A-Za-z_0-9]*)/g)) if (!profile.signals.includes(match[1])) err(`${at}：游戏暂不支持此信号量`);
          }
        }
        if (['all','any','not','quantifier'].includes(node.kind) && (!Array.isArray(node.children) || !node.children.length)) err(`${at}：条件组不能为空`);
        if (node.kind === 'quantifier') {
          const src = String(node.source || '');
          const baseSrc = src.split('.')[0];
          if (profile.valueKind === 'han' && !['groups','tiles','tileKinds','groupPairs','groupTriples','groupQuads','groupPartitions'].includes(src)) err(`${at}：游戏暂不支持此集合：${src}`);
          if (!SOURCES.includes(src) && !/^[A-Za-z_][A-Za-z_0-9]*$/.test(baseSrc)) {
            err(`${at}.ast 未知集合：${src}`);
          }
        }
        if (Array.isArray(node.children)) node.children.forEach((c) => walk(c, depth + 1));
      };
      walk(y.ast, 0);

      if (!Array.isArray(y.examples) || y.examples.length === 0) {
        warn(`${at} 没有 examples，OMC 无法做对照验收`);
      } else {
        if (!y.examples.some((e) => e && e.expect === true)) warn(`${at} 没有正向示例`);
        if (!y.examples.some((e) => e && e.expect === false)) warn(`${at} 没有反向示例`);
      }
    });

    if (JSON.stringify(pack).length > 65536) err('包超过 64 KB');
    const semantic = lintSemantics(pack);
    errors.push(...semantic.errors);
    warnings.push(...semantic.warnings);
    return { errors, warnings };
  }

  function lint(pack) {
    return lintDetailed(pack).errors;
  }

  root.MJOmcPack = {
    FORMAT,
    FORMAT_VERSION,
    SUPPORTED_FUNCTIONS,
    buildPack,
    lint,
    lintDetailed,
    lintSemantics,
    profileFor,
    studioSuppress,
    riichiIdMap: RIICHI_ID_MAP,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MJOmcPack;
})(typeof window === 'undefined' ? globalThis : window);

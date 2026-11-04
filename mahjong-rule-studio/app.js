/* Vanilla JS Scratch-like block editor UI. Loads with file:// or any static host. */
(function () {
  'use strict';
  const E = window.MJEngine, R = window.MJRules, L = window.MJLanguage;
  const $ = id => document.getElementById(id);
  const copy = v => JSON.parse(JSON.stringify(v));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const optionList = (xs, v) => xs.map(([val, label]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const STORAGE = 'mahjong-rule-studio-v1';
  const SCHEMA_VERSION = 6;
  const URL_PARAMS = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const BRIEF_BASE = URL_PARAMS.get('brief') === 'full' ? null : URL_PARAMS.get('brief') === 'mcr' ? 'mcr' : 'riichi';
  const BRIEF = BRIEF_BASE !== null;
  /**
   * 番种包模式（立直简版）：只展示游戏侧真正支持的语法。
   * 游戏侧编译器的公式白名单只有这 11 个（见 omc-pack.js 的导出自名单），
   * 其余公式 / 「和牌前的牌」量词 / 手牌对象 / 暗刻 都写得出但导不出去，所以直接不给。
   */
  const isPackMode = () => BRIEF && BRIEF_BASE === 'riichi';
  const PACK_FORMULAS = new Set(
    (typeof window !== 'undefined' && window.MJOmcPack && window.MJOmcPack.SUPPORTED_FUNCTIONS)
    || ['same', 'unique', 'min', 'max', 'arithmeticStep', 'count', 'abs', 'absdiff', 'add', 'sub', 'mul'],
  );
  const briefCustom = r => r.builtin === false || String(r.id || '').startsWith('custom_');
  const defaultsFor = rs => Object.fromEntries((rs.signalSpecs || []).map(s => [s.name, s.default]));
  const base = () => { const ruleSets = copy(R.defaultRuleSets); return { schemaVersion: SCHEMA_VERSION, structureLanguageVersion: 1, activeRuleSetId: 'riichi', ruleSets, rules: copy(R.rules).map(r => ({ ...r, enabled: r.category === '原创示例' ? false : r.enabled, ruleSetId: r.ruleSetId || r.ruleset || 'riichi' })), categories: copy(R.categoryDefs), signalValues: Object.fromEntries(ruleSets.map(rs => [rs.id, defaultsFor(rs)])), hand: { concealed: '123m123p123s456s5p', winning: '5p', melds: [] } }; };
  function upgrade(saved) {
    if (!saved || !Array.isArray(saved.rules) || !saved.hand) return base();
    if (!Array.isArray(saved.categories)) saved.categories = copy(R.categoryDefs);
    saved.categories = saved.categories.filter(c => c && c.key).map(c => ({ ...c, label: c.label || c.key, kind: c.kind || 'computed' }));
    const migrateCategory = node => { if (!node || typeof node !== 'object') return; if (node.kind === 'check' && ['tilesIn', 'contains', 'pairIn', 'groupTouches'].includes(node.key)) { if (node.value === 'dragon') node.value = 'dragons'; if (node.value === 'wind') node.value = 'winds'; } if (Array.isArray(node.children)) node.children.forEach(migrateCategory); };
    saved.rules.forEach(r => migrateCategory(r.ast));
    saved.activeRuleSetId = saved.activeRuleSetId || saved.ruleSet || 'riichi';
    if (!Array.isArray(saved.ruleSets) || !saved.ruleSets.length) saved.ruleSets = copy(R.defaultRuleSets).map(rs => ({ ...rs, signalSpecs: copy(saved.specs || rs.signalSpecs) }));
    saved.ruleSets = saved.ruleSets.map(rs => ({ ...rs, scoreUnit: rs.scoreUnit || rs.unit || R.ruleSets[rs.id]?.unit || '番', minimumWinScore: Number(rs.minimumWinScore || 0), winningHandTiles: Number(rs.winningHandTiles || 14), settlement: { ...copy(R.settlementDefaults[rs.id] || R.settlementDefaults.riichi), ...(rs.settlement || {}) }, tileSystem: { id: 'custom', label: '自定义牌张集合', tileKinds: copy(R.standardTileKinds), copiesPerKind: 4, ...rs.tileSystem, tileKinds: Array.isArray(rs.tileSystem?.tileKinds) ? rs.tileSystem.tileKinds : copy(R.standardTileKinds) }, winStructures: (Array.isArray(rs.winStructures) ? rs.winStructures : copy(R.structureCatalog)).map(s => ({ ...s, definition: s.definition || copy(R.defaultRuleSets.find(x => x.id === rs.id)?.winStructures.find(x => x.id === s.id)?.definition || R.structureCatalog.find(x => x.id === s.id)?.definition || { type: 'adapter', adapter: s.id }) })), signalSpecs: Array.isArray(rs.signalSpecs) ? rs.signalSpecs : copy(saved.specs || R.signals), scoringPolicy: { aggregation: 'sum', chooseBestDecomposition: true, allowBonusWithoutPattern: false, ...rs.scoringPolicy } }));
    saved.ruleSets.forEach(rs => { rs.winStructures = (rs.winStructures || []).filter(s => s.id !== 'greaterKnitted'); if (rs.id === 'mcr') { let kokushi = rs.winStructures.find(s => s.id === 'kokushi'); if (!kokushi) { kokushi = copy(R.structureCatalog.find(s => s.id === 'kokushi')); if (kokushi) rs.winStructures.push(kokushi); } if (kokushi) kokushi.enabled = true; if (/80番种/.test(rs.name)) rs.name = '国标麻将 · 81番种'; } });
    // 内置体系后来新增的信号量（例如「听牌面数」）要补进旧存档，否则积木下拉里永远看不到。
    // 代价：手动删掉的内置信号会在下次载入时回来。
    for (const rs of saved.ruleSets) {
      const builtin = R.defaultRuleSets.find(x => x.id === rs.id)?.signalSpecs;
      if (!Array.isArray(builtin) || !Array.isArray(rs.signalSpecs)) continue;
      const known = new Set(rs.signalSpecs.map(s => s && s.name));
      for (const spec of builtin) if (!known.has(spec.name)) rs.signalSpecs.push(copy(spec));
    }
    for (const id of ['mcr_greater_honors_knitted', 'mcr_lesser_honors_knitted']) { const fresh = R.rules.find(r => r.id === id), stored = saved.rules.find(r => r.id === id); if (fresh) { if (stored) stored.ast = copy(fresh.ast); else saved.rules.push(copy(fresh)); } }
    // 内置体系后来新增的（例如港式台湾麻将）要补进旧存档，否则规则体系下拉里看不到。
    for (const rs of R.defaultRuleSets) {
      if (!saved.ruleSets.some(x => x.id === rs.id)) saved.ruleSets.push(copy(rs));
    }
    if (!saved.signalValues) saved.signalValues = Object.fromEntries(saved.ruleSets.map(rs => [rs.id, { ...defaultsFor(rs), ...(saved.values || {}) }]));
    for (const rs of saved.ruleSets) saved.signalValues[rs.id] = { ...defaultsFor(rs), ...(saved.signalValues[rs.id] || {}) };
    saved.rules = saved.rules.map(r => ({ ...r, ruleSetId: r.ruleSetId || r.ruleset || saved.activeRuleSetId }));
    if (Number(saved.structureLanguageVersion || 0) < 1) { const fresh = R.rules.find(r => r.id === 'mcr_nine_gates'), stored = saved.rules.find(r => r.id === 'mcr_nine_gates' && r.builtin !== false); if (fresh && stored) stored.ast = copy(fresh.ast); saved.structureLanguageVersion = 1; }
    if (saved.schemaVersion === SCHEMA_VERSION) return saved;
    if (Number(saved.schemaVersion) >= 5) { saved.schemaVersion = SCHEMA_VERSION; return saved; }
    const enabled = new Map(saved.rules.map(r => [r.id, r.enabled]));
    const custom = saved.rules.filter(r => r.builtin === false || String(r.id || '').startsWith('custom_'));
    saved.rules = copy(R.rules).map(r => ({ ...r, ruleSetId: r.ruleset || 'riichi', ...(enabled.has(r.id) ? { enabled: enabled.get(r.id) } : {}) })).concat(custom);
    saved.schemaVersion = SCHEMA_VERSION;
    return saved;
  }
  function load() { try { return upgrade(JSON.parse(localStorage.getItem(STORAGE))); } catch { return base(); } }
  let state = load();
  L.setCategories(state.categories);
  let selectedId = state.rules.find(r => (r.ruleSetId || r.ruleset || 'riichi') === state.activeRuleSetId)?.id;
  if (BRIEF) {
    state.activeRuleSetId = BRIEF_BASE;
    const custom = state.rules.filter(r => (r.ruleSetId || r.ruleset || 'riichi') === BRIEF_BASE && briefCustom(r));
    selectedId = custom[0]?.id || null;
  }
  let selectedStructureId = null;
  let selectedPath = 'root'; let tileTarget = 'concealed';
  let toastTimer;
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (e) { notify('无法保存到本地存储，请先导出存档。'); } }
  function categoryPairs() { return (state.categories || []).map(c => [c.key, c.label]); }
  function activeRuleSet() { return state.ruleSets.find(rs => rs.id === state.activeRuleSetId) || state.ruleSets[0]; }
  function activeSpecs() { const specs = activeRuleSet()?.signalSpecs || []; return BRIEF && state.activeRuleSetId === 'riichi' ? specs.filter(s => MJOmcPack.profileFor('riichi').signals.includes(s.name)) : specs; }
  function activeValues() { const id = activeRuleSet().id; return state.signalValues[id] || (state.signalValues[id] = defaultsFor(activeRuleSet())); }
  function owner(r) { return r.ruleSetId || r.ruleset || 'riichi'; }
  function renderRuleSetChoices() {
    const sets = BRIEF ? state.ruleSets.filter(rs => rs.id === 'riichi' || rs.id === 'mcr') : state.ruleSets;
    const pairs = sets.map(rs => [rs.id, rs.name]);
    $('rulesetSelect').innerHTML = optionList(pairs, state.activeRuleSetId);
    $('ruleRuleset').innerHTML = optionList(pairs, owner(rule() || {}));
    $('ruleRuleset').disabled = BRIEF;
  }
  function notify(msg) { $('toast').textContent = msg; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600); }
  function rule() {
    const hit = state.rules.find(r => r.id === selectedId);
    if (hit) return hit;
    if (BRIEF) return state.rules.find(r => owner(r) === state.activeRuleSetId && briefCustom(r)) || null;
    return state.rules[0];
  }
  function isEnabled(r) { return r.enabled !== false; }
  function unit(r) { return state.ruleSets.find(rs => rs.id === owner(r))?.scoreUnit || '番'; }
  function hanLabel(r) { return r.yakuman ? `${r.yakuman}役满` : r.openHan === null ? `${r.closedHan}${unit(r)}` : r.closedHan === r.openHan ? `${r.closedHan}${unit(r)}` : `${r.closedHan}/${r.openHan}${unit(r)}`; }
  function displayRules() {
    const find = $('ruleSearch').value.trim().toLowerCase();
    const visible = state.rules.filter(r => owner(r) === state.activeRuleSetId && (!BRIEF || briefCustom(r)));
    const groups = R.groupRules(visible, state.activeRuleSetId);

    let count = 0;
    $('ruleList').innerHTML = groups.map(group => {
      const matches = visible.filter(r => (r.category ?? '') === group && (!find || r.name.toLowerCase().includes(find) || r.id.toLowerCase().includes(find)));
      if (!matches.length) return '';
      count += matches.length;
      return `<div class="rule-group-name"><span>${esc(group)}</span><span>${matches.length}</span></div>${matches.map(r => `<div class="rule-item ${r.id === selectedId ? 'selected' : ''} ${!isEnabled(r) ? 'disabled' : ''}" data-rule="${esc(r.id)}"><input type="checkbox" class="rule-check" data-toggle="${esc(r.id)}" ${isEnabled(r) ? 'checked' : ''} title="参与番值结算"/><div class="rule-text"><span class="rule-title">${esc(r.name)}</span></div><span class="rule-han">${esc(hanLabel(r))}</span></div>`).join('')}`;
    }).join('');
    $('ruleCount').textContent = `${visible.filter(isEnabled).length} / ${visible.length}`;
  }
  function displayRuleMeta() {
    const r = rule(); if (!r) return;
    renderRuleSetChoices(); $('ruleName').value = r.name; $('ruleCategory').value = r.category; $('ruleRuleset').value = owner(r); $('closedHan').value = r.closedHan;
    $('openHan').value = r.openHan === null ? '' : r.openHan; $('yakuman').value = r.yakuman || 0; renderSuppressChoices(r); $('ruleDescription').value = r.description || '';
  }
  function renderSuppressChoices(r) {
    const targets = state.rules.filter(x => owner(x) === owner(r) && x.id !== r.id && (briefCustom(x) || (owner(r) === 'riichi' && MJOmcPack.riichiIdMap[x.id])));
    if (owner(r) === 'riichi') for (const [id, name] of [['openRiichi', '开立直'], ['openDoubleRiichi', '开两立直'], ['renhouMangan', '人和（满贯）'], ['renhouYakuman', '人和（役满）'], ['openRiichiYakuman', '开立直（役满）'], ['openDoubleRiichiYakuman', '开两立直（役满）'], ['kokushi13', '国士无双十三面'], ['suuankouTanki', '四暗刻单骑'], ['chuurenPure', '纯正九莲宝灯'], ['dora', '宝牌'], ['akadora', '赤宝牌'], ['uradora', '里宝牌']]) if (!targets.some(x => x.id === id)) targets.push({ id, name });
    $('suppresses').innerHTML = targets.map(x => `<label class="suppress-choice"><input type="checkbox" data-suppress="${esc(x.id)}" ${(r.suppresses || []).includes(x.id) ? 'checked' : ''}/> ${esc(x.name)}</label>`).join('');
  }
  function palette() {
    const blocks = Object.entries(R.blockDefs).filter(([, def]) => !def.hidden);
    const group = [['all', '且'], ['any', '或'], ['not', '非']];
    const categories = ['比较判断', '基础事实'];
    const logicBlocks = blocks.filter(([, def]) => def.category === '逻辑容器');
    const logicButtons = group.map(([kind, text]) => `<button draggable="true" class="palette-btn logic" data-new="${kind}">＋ ${text}</button>`).join('')
      + logicBlocks.map(([key, def]) => `<button draggable="true" data-new="${key}" class="palette-btn lang" title="拖动到逻辑容器">＋ ${esc(def.label)}</button>`).join('');
    const rest = categories.map(cat => `<div class="palette-cat ${cat === '比较判断' ? 'cat-compare' : cat === '基础事实' ? 'cat-fact' : ''}">${cat}</div>${blocks.filter(([, def]) => def.category === cat).map(([key, def]) => `<button draggable="true" data-new="${key}" class="palette-btn ${cat === '比较判断' ? 'compare' : ''}" title="拖动到逻辑容器">＋ ${esc(def.label)}</button>`).join('')}`).join('');
    $('palette').innerHTML = `<div class="palette-cat cat-logic">逻辑容器</div>${logicButtons}${rest}`;
  }
  function getNode(path) { let n = rule().ast; if (path === 'root' || !path) return n; for (const part of path.split('.')) { n = n?.children?.[Number(part)]; if (!n) return null; } return n; }
  function parentPath(path) { if (path === 'root') return null; const p = path.split('.'); p.pop(); return p.length ? p.join('.') : 'root'; }
  function addBlock(key, path = selectedPath) {
    const def = R.blockDefs[key];
    const fresh = ['all', 'any', 'not'].includes(key) ? { kind: key, children: [] } : def?.kind ? { kind: def.kind, ...copy(def.defaults) } : { kind: 'check', key, ...copy(def.defaults) };
    if (fresh.kind === 'quantifier') fresh.variable = uniqueVariable(baseVariable(fresh.source), rule().ast);
    let node = getNode(path);
    while (node && !['all', 'any', 'not', 'quantifier'].includes(node.kind)) { path = parentPath(path); node = getNode(path); }
    if (!node) { path = 'root'; node = getNode('root'); }
    if (fresh.kind === 'compare') {
      const found = firstSubject(scopeOf(path), ['group', 'groupTuple', 'partition', 'tile']);
      if (found) {
        if (found.kind === 'tile') { fresh.left = found.name + '.rank'; fresh.right = '1'; }
        else if (found.kind === 'group') fresh.left = found.name + '.type';
        else if (found.kind === 'groupTuple') fresh.left = found.name + '.0.type';
        else fresh.left = found.name + '.0.0.type';
      }
    }
    if (node.kind === 'not') { node.children = [fresh]; } else node.children.push(fresh);
    selectedPath = path; save(); displayTree(); displayRules();
  }
  function removeBlock(path) { if (path === 'root') { notify('根容器不能删除'); return; } const p = parentPath(path), idx = Number(path.split('.').at(-1)); getNode(p)?.children?.splice(idx, 1); selectedPath = p; save(); displayTree(); }
  const FIELD_TITLES = { op: '比较方式', filter: '筛选范围', name: '名称', value: '取值', source: '遍历集合', differentSuits: '花色要求', typeMode: '刻杠归类', mode: '匹配方式' };
  function renderField(path, field, value, opts, displayLabel = '') {
    return `<label class="inline-field" title="${esc(displayLabel || FIELD_TITLES[field] || field)}">${displayLabel ? `<span style="font-size:10px;color:#a6bfce;margin-right:3px">${esc(displayLabel)}</span>` : ''}<select data-path="${esc(path)}" data-field="${field}">${optionList(opts, value)}</select></label>`;
  }
  function renderNum(path, field, value, label = '') { return `${label ? `<span class="mini-label">${esc(label)}</span>` : ''}<input type="number" data-path="${esc(path)}" data-field="${field}" value="${esc(value)}" step="1"/>`; }
  function renderText(path, field, value, label = '') { return `${label ? `<span class="mini-label">${esc(label)}</span>` : ''}<input data-path="${esc(path)}" data-field="${field}" value="${esc(value)}"/>`; }
  const tf = [['true', '是'], ['false', '否']];
  const countOps = [['eq', '恰好'], ['gte', '至少'], ['lte', '至多'], ['gt', '多于'], ['lt', '少于'], ['ne', '不等于']];
  const winForms = [['true', '成立'], ['false', '不成立']];
  const typeChoice = [['family', '刻子与杠子视为同类'], ['exact', '刻子与杠子不视为同类']];
  function conditionFields(n, path) {
    const v = n.value, op = n.op || 'eq', ops = () => renderField(path, 'op', op, R.operators), bool = () => renderField(path, 'value', String(v), tf);
    switch (n.key) {
      case 'signal': {
        const spec = activeSpecs().find(s => s.name === n.name);
        const names = activeSpecs().map(s => [s.name, s.label]);
        const opts = spec?.type === 'boolean' ? renderField(path, 'value', String(v), tf) : spec?.type === 'select' ? renderField(path, 'value', v, (spec.options || '').split(',').map(x => [x.trim(), x.trim()])) : renderNum(path, 'value', v);
        return `${renderField(path, 'name', n.name, names)} ${ops()} ${opts}`;
      }
      case 'closed': case 'crossSuitSeq': case 'crossSuitTrip': case 'straight': case 'dragonPair': case 'windPair': return bool();
      case 'shape': {
        // 游戏侧结构分解族只有 standard / chiitoi / kokushi（九莲记作 jiulian，同样命中不了）；
        // 全不靠、组合龙是国标结构，立直玩法里不存在，番种包模式下不提供。
        const shapeOptions = (activeRuleSet().winStructures || [])
          .filter(s => !isPackMode() || ['standard', 'chiitoi', 'kokushi'].includes(s.id))
          .map(s => [s.id, s.label]);
        return renderField(path, 'value', v, shapeOptions);
      }
      case 'wait': {
        // 「特殊」是国士 / 全不靠 / 组合龙这类没有五标准听牌形的结构；游戏侧没有这一档
        // （国士会被算成单骑或两面），番种包模式下不提供。
        const waitOptions = R.blockDefs[n.key].options.filter(([value]) => !isPackMode() || value !== 'special');
        return renderField(path, 'value', v, waitOptions);
      }
      case 'tilesIn': case 'contains': case 'pairIn': case 'groupTouches': return renderField(path, 'value', v, categoryPairs());
      case 'suitCount': case 'sequencePairs': return `${ops()} ${renderNum(path, 'value', v)}`;
      case 'meldCount': return `${renderField(path, 'filter', n.filter, R.meldFilters)} ${ops()} ${renderNum(path, 'value', v)}`;
      case 'meldHas': return `${renderField(path, 'name', n.name, [['5z', '白'], ['6z', '發'], ['7z', '中'], ['seatWind', '自风'], ['roundWind', '场风'], ...E.allKinds.map(t => [t, tileName(t)])])} ${bool()}`;
      case 'relation4': return `${renderField(path, 'value', v, R.relationModes)} ${renderField(path, 'typeMode', n.typeMode || 'family', typeChoice)} ${renderField(path, 'differentSuits', String(Boolean(n.differentSuits)), [['false', '允许两组同花色'], ['true', '要求两组花色不同']])}`;
      case 'tileCount': return `${renderField(path, 'name', n.name, E.allKinds.map(t => [t, tileName(t)]))} ${ops()} ${renderNum(path, 'value', v)}`;
      case 'groupAttributeCount': return `${renderField(path, 'filter', n.filter, [['any', '任何类型'], ['sequence', '顺子'], ['tripletLike', '刻类'], ['triplet', '刻子'], ['quad', '杠子']])} ${renderField(path, 'suit', n.suit, [['any', '任意花色'], ['m', '万'], ['p', '筒'], ['s', '索'], ['z', '字']])} ${renderNum(path, 'rank', n.rank, '序数(0为任意)')} ${ops()} ${renderNum(path, 'value', v)}`;
      default: return `<span>未知积木 ${esc(n.key)}</span>`;
    }
  }
  // ---- 中文表达式积木：把 g.type / "sequence" 之类的表达式显示为中文控件 ----
  const TILE_NAMES = { '1z': '東', '2z': '南', '3z': '西', '4z': '北', '5z': '白', '6z': '發', '7z': '中' };
  const SUIT_NAMES = { m: '萬', p: '筒', s: '索' };
  const tileName = t => TILE_NAMES[t] || (t ? String(t[0] || '') + (SUIT_NAMES[t[1]] || t[1] || '') : '');
  const litKey = value => JSON.stringify(value === undefined ? null : value);
  const SHAPE_LABELS = { standard: '四面子一雀头', chiitoi: '七对子', kokushi: '十三幺', lesserKnitted: '全不靠', knitted: '组合龙' };
  const WAIT_LABELS = { ryanmen: '两面', tanki: '单骑', kanchan: '嵌张', penchan: '边张', shanpon: '双碰', special: '特殊' };
  const shapeLabel = value => activeRuleSet()?.winStructures?.find(s => s.id === value)?.label || SHAPE_LABELS[value] || value;
  const waitLabel = value => WAIT_LABELS[value] || value;
  const exprSpec = () => R.expressionSpec || { subjects: {}, groupAttrs: [['', '']], tileAttrs: [['', '']], literals: {}, functions: [] };
  function parseExpr(src) { try { return L.parseExpression(src); } catch { return null; } }
  function fnSpec(name) { return exprSpec().functions.find(item => item.name === name) || { name, label: name, min: 0, max: 8, args: {} }; }
  function exprAt(ast, argPath) {
    let node = ast;
    if (!argPath) return node;
    for (const part of String(argPath).split('.')) {
      if (part === '') continue;
      node = node && node.args ? node.args[Number(part)] : null;
      if (!node) return null;
    }
    return node;
  }
  function sourceKind(source) {
    const src = String(source || '');
    if (src === 'groups') return 'group';
    if (src === 'groupPairs' || src === 'groupTriples' || src === 'groupQuads') return 'groupTuple';
    if (src === 'groupPartitions') return 'partition';
    if (src === 'tileKinds') return 'tile';
    if (src === 'tiles' || src === 'concealed' || src === 'hand.concealed' || /\.tiles$/.test(src)) return 'tile';
    return 'group';
  }
  function sourcePhrase(source) {
    const src = String(source || 'groups');
    if (src === 'groupPartitions') return { one: '一种', each: '每种', measure: '种' };
    if (src === 'tiles' || src === 'concealed' || src === 'hand.concealed' || /\.tiles$/.test(src)) return { one: '一张', each: '每张', measure: '张' };
    return { one: '一个', each: '每个', measure: '个' };
  }
  function scopeOf(treePath) {
    const scope = Object.create(null);
    const chain = [];
    let path = treePath;
    while (path && path !== 'root') { chain.push(path); path = parentPath(path); }
    for (const item of chain.reverse()) {
      const node = getNode(item);
      if (node && node.kind === 'quantifier') {
        const name = node.variable || 'item';
        const source = node.source || 'groups';
        scope[name] = { kind: sourceKind(source), source };
      }
    }
    return scope;
  }
  function usedVariables(ast) {
    const used = new Set();
    const walk = node => {
      if (!node) return;
      if (node.kind === 'quantifier' && node.variable) used.add(node.variable);
      (node.children || []).forEach(walk);
    };
    walk(ast); return used;
  }
  function baseVariable(source) {
    const kind = sourceKind(source);
    return kind === 'partition' ? 'p' : kind === 'tile' ? 't' : kind === 'tileList' ? 'k' : 'g';
  }
  function uniqueVariable(base, ast) {
    const used = usedVariables(ast);
    let index = 1;
    while (used.has(base + index)) index++;
    return base + index;
  }
  function subjectFor(name, scope) {
    if (scope[name]) return { kind: scope[name].kind, source: scope[name].source };
    const fixed = { pair: { kind: 'pair', source: 'pair' }, tiles: { kind: 'tileCollection', source: 'tiles' }, tileKinds: { kind: 'tileList', source: 'tileKinds' }, signals: { kind: 'signals', source: 'signals' }, hand: { kind: 'hand', source: 'hand' }, winning: { kind: 'tile', source: 'winning' } };
    if (fixed[name]) return fixed[name];
    if (name === 'g') return { kind: 'group', source: 'groups' };
    if (name === 'p') return { kind: 'partition', source: 'groupPartitions' };
    if (name === 't') return { kind: 'tile', source: 'tiles' };
    return { kind: 'unknown', source: '' };
  }
  function subjectOptions(scope, current, options) {
    // 「牌」是整手牌集合，只能当公式参数（数量/属性列表/按条件筛选/同牌张数统计/出现次数），
    // 放进比较式两侧没有意义，所以默认只给「和牌前暗手牌 / 牌种 / 雀头…」等单值对象。
    const allowCollections = !options || options.collections !== false;
    const list = [], seen = new Set();
    const add = (value, label) => { if (!value || seen.has(value)) return; seen.add(value); list.push([value, label]); };
    for (const name of Object.keys(scope)) add(name, name);
    add('pair', '雀头');
    if (allowCollections) add('tiles', '牌');
    add('tileKinds', '牌种'); add('signals', '信号量');
    if (!isPackMode()) add('hand', '手牌');
    add('winning', '和牌张');
    if (!seen.has(current)) add(current, current === 'tiles' && !allowCollections ? '牌 · 仅公式参数' : current + ' · 未绑定');
    return list;
  }
  function splitParts(parts) {
    const subject = parts[0] || '';
    const rest = parts.slice(1);
    const indices = [];
    while (indices.length < rest.length && /^\d+$/.test(rest[indices.length])) indices.push(rest[indices.length]);
    return { subject, indices, attr: rest.slice(indices.length).join('.') };
  }
  function positionLevels(info) {
    const kind = info.kind;
    if (kind === 'group') return [[['', '整个面子'], ['0', '第1张牌'], ['1', '第2张牌'], ['2', '第3张牌'], ['3', '第4张牌']]];
    if (kind === 'groupTuple') {
      const count = info.source === 'groupPairs' ? 2 : info.source === 'groupTriples' ? 3 : info.source === 'groupQuads' ? 4 : 4;
      const options = [['', '整个组合']];
      for (let index = 0; index < count; index++)options.push([String(index), '第' + (index + 1) + '个面子']);
      return [options];
    }
    if (kind === 'partition') return [[['', '整个分组'], ['0', '第1组'], ['1', '第2组']], [['', '整组'], ['0', '第1个面子'], ['1', '第2个面子']]];
    if (kind === 'tileList') {
      // 牌种是去重后的牌：14 张手牌最多 14 种（国士/全不靠这类），不能只给到第 7 种。
      const options = [['', '全部牌种']];
      for (let index = 0; index < 14; index++)options.push([String(index), '第' + (index + 1) + '种']);
      return [options];
    }
    return [];
  }
  function elementType(info, count) {
    const kind = info.kind;
    if (kind === 'group') return count === 0 ? 'group' : 'tile';
    if (kind === 'groupTuple') return count === 0 ? 'groupTuple' : count === 1 ? 'group' : 'tile';
    if (kind === 'partition') return count === 0 ? 'partition' : count === 1 ? 'groupPair' : count === 2 ? 'group' : 'tile';
    if (kind === 'tileList') return count === 0 ? 'tileList' : 'tile';
    if (kind === 'tileCollection') return count === 0 ? 'tileCollection' : 'tile';
    return kind;
  }
  function attrsForElement(type) {
    const S = exprSpec();
    // 「暗刻」只有工作室有；游戏侧的 Group 没有 concealedPung，番种包里取不到值。
    if (type === 'group') return isPackMode() ? S.groupAttrs.filter(([value]) => value !== 'concealedPung') : S.groupAttrs;
    if (type === 'tile' || type === 'pair') return S.tileAttrs;
    if (type === 'signals') return activeSpecs().map(item => [item.name, item.label]);
    if (type === 'hand') return [['', '手牌'], ['closed', '门清状态']];
    if (type === 'groupTuple') return [['', '整个面子组合']];
    if (type === 'groupPair') return [['', '整组']];
    if (type === 'partition') return [['', '整个划分']];
    if (type === 'tileList') return [['', '全部牌种']];
    if (type === 'tileCollection') return [['', '牌']];
    return [['', '对象']];
  }
  function attrLabel(attr) {
    for (const list of [exprSpec().groupAttrs, exprSpec().tileAttrs]) for (const [value, label] of list) if (String(value) === String(attr)) return label;
    return attr === 'closed' ? '门清状态' : attr;
  }
  function signalDomain(name) {
    const found = activeSpecs().find(item => item.name === name);
    if (!found) return null;
    if (found.type === 'boolean') return 'bool';
    if (found.type === 'number') return 'number';
    return { enum: (found.options || '').split(',').map(item => item.trim()).filter(Boolean) };
  }
  function domainOf(ast) {
    if (!ast || ast.type === 'literal') return null;
    if (ast.type === 'path') {
      const parts = ast.parts || [];
      if (parts[0] === 'signals') return signalDomain(parts[1]);
      const attr = parts[parts.length - 1];
      if (attr === 'type') return 'meldType';
      if (attr === 'family') return 'meldFamily';
      if (attr === 'suit') return 'suit';
      if (['open', 'concealed', 'concealedPung', 'honor', 'terminal', 'closed'].includes(attr)) return 'bool';
      if (['rank', 'center', 'tileCount'].includes(attr)) return 'number';
      return null;
    }
    if (ast.type === 'call') {
      if (['category', 'containsCategory', 'same', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(ast.name)) return 'bool';
      if (['unique', 'min', 'max', 'add', 'sub', 'mul', 'abs', 'absdiff', 'mod', 'count', 'frequencyCount', 'arithmeticStep', 'occurs', 'if'].includes(ast.name)) return 'number';
    }
    return null;
  }
  /**
   * 纯数值公式：这些函数的参数没有逐个声明域，但参数就是数字。
   * 不在这里兜底的话，`argDomain` 会返回 null，拖「常量」就会退化成布尔值，
   * 例如 mul(2, 是) —— 见 defaultLiteral(null)。
   * 注意：比较/同值类（eq/ne/gt/same/unique）不在里面，它们的参数类型跟着另一个参数走。
   */
  const NUMERIC_ARG_FORMULAS = new Set(['min', 'max', 'add', 'sub', 'mul', 'abs', 'absdiff', 'mod', 'arithmeticStep', 'div', 'pow', 'floor', 'ceil', 'round', 'gt', 'gte', 'lt', 'lte']);
  /** 参数与「另一个参数」同类型：等于/不等于/全部相同/不同值数量（花色比花色、布尔比布尔）。 */
  const SIBLING_DOMAIN_FORMULAS = new Set(['eq', 'ne', 'same', 'unique']);
  /** 属性取值本身的类型：「序数」→ 数字、「花色」→ 花色、「类型」→ 顺/刻/杠… */
  function propValueDomain(prop) {
    if (prop === 'suit') return 'suit';
    if (prop === 'rank' || prop === 'center' || prop === 'tileCount') return 'number';
    if (prop === 'type') return 'meldType';
    if (prop === 'family') return 'meldFamily';
    if (prop === 'honor' || prop === 'terminal' || prop === 'open' || prop === 'concealed') return 'bool';
    return null;
  }
  function literalPropOf(node) {
    return node && node.type === 'literal' ? node.value : null;
  }
  function argDomain(call, index) {
    const f = fnSpec(call.name);
    if (f.args && f.args[index]) return f.args[index];
    // 出现次数(值, 集合)：值的类型跟着集合走——属性列表(牌,序数) → 数字，牌/牌种 → 牌名。
    if (call.name === 'occurs' && index === 0) {
      const list = call.args[1];
      if (list && list.type === 'call' && list.name === 'values') return propValueDomain(literalPropOf(list.args[1]));
      if (list && list.type === 'path' && ['tiles', 'tileKinds'].includes(list.parts?.[0])) return 'tile';
      return null;
    }
    if (call.name === 'category' && index === 0) return 'tile';
    if (call.name === 'select' && index === 3) return propValueDomain(literalPropOf(call.args[1]));
    // 等于(花色, ?) → 拖进来的常量应该是花色，而不是数字。
    if (SIBLING_DOMAIN_FORMULAS.has(call.name)) {
      for (const arg of call.args) {
        const domain = domainOf(arg);
        if (domain) return domain;
      }
      return null;
    }
    if (NUMERIC_ARG_FORMULAS.has(call.name)) return 'number';
    return null;
  }
  function literalPairs(domain) {
    if (!domain) return null;
    if (domain.enum) return domain.enum.map(value => [litKey(value), tileName(value)]);
    const S = exprSpec();
    const table = { meldType: S.literals.meldType, meldFamily: S.literals.meldFamily, suit: S.literals.suit, tileCategory: categoryPairs(), prop: S.literals.prop, operator: R.operators, tile: S.literals.tile };
    const pairs = table[domain];
    return pairs ? pairs.map(([value, label]) => [litKey(value), label]) : null;
  }
  function literalFallbackLabel(value) {
    const category = (state.categories || []).find(c => c.key === value); if (category) return category.label;
    for (const group of Object.values(exprSpec().literals)) for (const [candidate, label] of group) if (Object.is(candidate, value)) return label;
    return String(value);
  }
  function defaultLiteral(domain) {
    if (domain === 'bool') return { type: 'literal', value: true };
    if (domain === 'number') return { type: 'literal', value: 0 };
    if (domain && domain.enum) return { type: 'literal', value: domain.enum[0] ?? '' };
    if (domain === 'operator') return { type: 'literal', value: 'eq' };
    if (domain === 'tile') return { type: 'literal', value: '1z' };
    if (domain === 'tileCategory') { const pairs = categoryPairs(); return { type: 'literal', value: pairs[0]?.[0] ?? 'simples' }; }
    if (domain && exprSpec().literals[domain]) return { type: 'literal', value: exprSpec().literals[domain][0][0] };
    return { type: 'literal', value: true };
  }
  function exprEditor(nodePath, side, argPath, src, scope, domain, options) {
    const ast = parseExpr(src);
    const data = 'data-node-path="' + esc(nodePath) + '" data-expr-side="' + esc(side) + '" data-arg-path="' + esc(argPath) + '"';
    if (!ast) return '<span class="expr-raw-wrap"><input class="expr-raw" ' + data + ' data-expr-part="raw" value="' + esc(src) + '" title="旧表达式，无法拆成积木"/></span>';
    if (ast.type === 'path') return pathEditor(data, ast, scope, options);
    if (ast.type === 'call') return callEditor(nodePath, side, argPath, ast, scope);
    return literalEditor(data, ast, domain);
  }
  function pathEditor(data, ast, scope, options) {
    const name = ast.parts[0] || '';
    const info = subjectFor(name, scope);
    const split = splitParts(ast.parts);
    const levels = positionLevels(info);
    let positions = '';
    const chosen = [];
    levels.forEach((options, level) => {
      if (level > 0 && !chosen[level - 1]) return;
      const value = split.indices[level] ?? '';
      chosen[level] = value;
      positions += '<select ' + data + ' data-expr-part="index' + level + '" title="选择位置">' + optionList(options, value) + '</select>';
    });
    const count = chosen.filter(value => value !== undefined && value !== '').length;
    const base = attrsForElement(elementType(info, count));
    const attrs = base.some(([value]) => String(value) === String(split.attr)) ? base : base.concat([[split.attr, attrLabel(split.attr) || '当前属性']]);
    const showAttr = !(attrs.length === 1 && attrs[0][0] === '' && !split.attr);
    return '<span class="expr-block expr-path"><select ' + data + ' data-expr-part="subject" title="选择对象">' + optionList(subjectOptions(scope, name, options), name) + '</select>' + positions + (showAttr ? '<select ' + data + ' data-expr-part="attr" title="选择属性">' + optionList(attrs, split.attr) + '</select>' : '') + '</span>';
  }
  function literalEditor(data, ast, domain) {
    const value = ast.value;
    // 数值槽里已有非数字字面量（例如历史上拖「常量」留下的 true）时，仍按原类型渲染，
    // 避免出现 value="true" 的数字输入框；改回数字请重新拖一次「常量」。
    if (typeof value === 'number' || (domain === 'number' && value !== null && typeof value !== 'boolean' && typeof value !== 'string')) return '<input type="number" ' + data + ' data-expr-part="num" value="' + esc(value) + '" step="1"/>';
    if (domain === 'bool' || typeof value === 'boolean') return '<select ' + data + ' data-expr-part="literal">' + optionList([['true', '是'], ['false', '否']], String(value)) + '</select>';
    const tileValue = typeof value === 'string' && /^[1-9][mpsz]$/.test(value);
    const pairs = literalPairs(tileValue ? 'tile' : domain);
    if (pairs) {
      const key = litKey(value);
      const options = pairs.some(([candidate]) => candidate === key) ? pairs : pairs.concat([[key, literalFallbackLabel(value)]]);
      return '<select ' + data + ' data-expr-part="literal">' + optionList(options, key) + '</select>';
    }
    return '<input type="text" ' + data + ' data-expr-part="literal" class="expr-text" value="' + esc(value) + '"/>';
  }
  function callEditor(nodePath, side, argPath, ast, scope) {
    const f = fnSpec(ast.name);
    const layout = f.layout || [{ text: '未知公式' }, { join: '、' }];
    // 只有这些参数槽吃「整手牌/牌种」这种集合；数值公式的参数里列出来只会误导。
    const takesCollection = (name, index) =>
      name === 'count' || name === 'values' || name === 'select' || name === 'frequencyCount'
        ? index === 0
        : name === 'occurs' ? index === 1 : false;
    const argBlock = index => {
      const child = argPath ? argPath + '.' + index : String(index);
      const editor = exprEditor(nodePath, side, child, L.expressionString(ast.args[index]), scope, argDomain(ast, index), { collections: takesCollection(ast.name, index) });
      return '<span class="expr-arg" data-expr-drop data-node-path="' + esc(nodePath) + '" data-expr-side="' + esc(side) + '" data-arg-path="' + esc(child) + '">' + editor + '</span>';
    };
    let body = '';
    for (const part of layout) {
      if (part.join !== undefined) body += ast.args.map((arg, index) => argBlock(index)).join('<span class="expr-comma">' + esc(part.join) + '</span>');
      else if (part.arg !== undefined) body += ast.args[part.arg] ? argBlock(part.arg) : '<span class="expr-missing">缺少参数</span>';
      else body += '<span class="expr-word">' + esc(part.text) + '</span>';
    }
    let tools = '';
    if (ast.args.length < f.max) tools += '<button type="button" class="expr-mini" data-node-path="' + esc(nodePath) + '" data-expr-side="' + esc(side) + '" data-expr-add="' + esc(argPath) + '" title="增加参数">＋</button>';
    if (ast.args.length > f.min) tools += '<button type="button" class="expr-mini" data-node-path="' + esc(nodePath) + '" data-expr-side="' + esc(side) + '" data-expr-remove="' + esc(argPath) + '" title="删除最后一个参数">−</button>';
    return '<span class="expr-block expr-call expr-formula">' + body + tools + '</span>';
  }
  function exprSlot(path, side, src, sibling) {
    const scope = scopeOf(path);
    const domain = domainOf(parseExpr(sibling));
    return '<span class="expr-slot" data-expr-drop data-node-path="' + esc(path) + '" data-expr-side="' + esc(side) + '" data-arg-path="">' + exprEditor(path, side, '', src, scope, domain, { collections: false }) + '</span>';
  }
  function rewritePath(target, info, indices, attr, name) {
    const levels = positionLevels(info).length;
    const clipped = indices.slice(0, levels).filter(value => value !== undefined && value !== '');
    const allowed = attrsForElement(elementType(info, clipped.length)).map(([value]) => String(value));
    const safeAttr = attr && allowed.includes(String(attr)) ? attr : '';
    const parts = [name].concat(clipped);
    if (safeAttr) parts.push(safeAttr);
    for (const key of Object.keys(target)) delete target[key];
    target.type = 'path'; target.parts = parts;
  }
  function pairPath(scope, attr, index) {
    const found = firstSubject(scope, ['groupTuple', 'partition', 'group']);
    if (found) {
      if (found.kind === 'partition') return { type: 'path', parts: [found.name, '0', String(index), attr] };
      return { type: 'path', parts: [found.name, String(index), attr] };
    }
    return { type: 'path', parts: ['tileKinds', String(index), attr] };
  }
  function tilePath(scope) {
    const found = firstSubject(scope, ['tile']);
    return found ? { type: 'path', parts: [found.name] } : { type: 'path', parts: ['pair'] };
  }
  function groupPath(scope) {
    const found = firstSubject(scope, ['group', 'groupTuple', 'partition']);
    if (!found) return { type: 'path', parts: ['g'] };
    if (found.kind === 'groupTuple') return { type: 'path', parts: [found.name, '0'] };
    if (found.kind === 'partition') return { type: 'path', parts: [found.name, '0', '0'] };
    return { type: 'path', parts: [found.name] };
  }
  function defaultFormulaArgs(name, scope) {
    const p = (attr, index) => pairPath(scope, attr, index);
    if (name === 'category') return [tilePath(scope), { type: 'literal', value: 'winds' }];
    if (name === 'containsCategory') return [groupPath(scope), { type: 'literal', value: 'yaochu' }];
    if (name === 'same' || name === 'unique') return [p('suit', 0), p('suit', 1)];
    if (['min', 'max', 'add', 'sub', 'mul', 'absdiff', 'mod', 'arithmeticStep'].includes(name)) return [p('rank', 0), p('rank', 1)];
    if (name === 'abs') return [p('rank', 0)];
    if (name === 'count') return [{ type: 'path', parts: ['tileKinds'] }];
    if (name === 'values') return [{ type: 'path', parts: ['tileKinds'] }, { type: 'literal', value: 'suit' }];
    if (name === 'select') return [{ type: 'path', parts: ['tiles'] }, { type: 'literal', value: 'suit' }, { type: 'literal', value: 'ne' }, { type: 'literal', value: 'z' }];
    if (name === 'frequencyCount') return [{ type: 'path', parts: ['tiles'] }, { type: 'literal', value: 4 }];
    if (name === 'occurs') return [tilePath(scope), { type: 'path', parts: ['tiles'] }];
    return [{ type: 'path', parts: ['g', 'type'] }];
  }
  function defaultArgFor(fnName, index, scope) {
    const domain = fnSpec(fnName).args?.[index];
    if (domain) return defaultLiteral(domain);
    const defaults = defaultFormulaArgs(fnName, scope);
    if (defaults[index]) return defaults[index];
    const attr = (fnName === 'same' || fnName === 'unique') ? 'suit' : 'rank';
    return pairPath(scope, attr, Math.min(index, 3));
  }
  const RESERVED_BINDINGS = new Set(['pair', 'tiles', 'tileKinds', 'signals', 'hand', 'winning', 'groups', 'groupPairs', 'groupTriples', 'groupQuads', 'groupPartitions', 'true', 'false', 'null', '__proto__', 'constructor']);
  function rewriteBinding(node, oldName, newName) {
    const walk = (item, isRoot) => {
      if (!item) return;
      if (item.kind === 'compare') {
        item.left = L.renameVariable(item.left, oldName, newName);
        item.right = L.renameVariable(item.right, oldName, newName);
      }
      if (item.kind === 'quantifier' && !isRoot) item.source = L.renameVariable(item.source, oldName, newName);
      (item.children || []).forEach(child => walk(child, false));
    };
    walk(node, true);
  }
  function ensureRootContainer(ruleObj) {
    const ast = ruleObj && ruleObj.ast;
    if (!ast || ['all', 'any', 'not'].includes(ast.kind)) return false;
    ruleObj.ast = { kind: 'all', children: [ast] };
    return true;
  }
  function normalizeBindings(ruleObj) {
    let changed = false;
    const used = new Set();
    const walk = node => {
      if (!node) return;
      if (node.kind === 'quantifier') {
        const original = node.variable || 'item';
        if (!used.has(original)) used.add(original);
        else {
          const match = /^([A-Za-z_\u4e00-\u9fa5][A-Za-z_0-9\u4e00-\u9fa5]*?)(\d*)$/.exec(original);
          const base = match ? match[1] : 'x';
          let index = 1, name;
          do { name = base + index++; } while (used.has(name));
          rewriteBinding(node, original, name);
          node.variable = name; used.add(name); changed = true;
        }
      }
      (node.children || []).forEach(walk);
    };
    walk(ruleObj.ast);
    return changed;
  }
  function renameBinding(node, raw) {
    const name = String(raw ?? '').trim();
    const oldName = node.variable || 'item';
    if (name === oldName) { displayTree(); return; }
    if (!/^[A-Za-z_\u4e00-\u9fa5][A-Za-z_0-9\u4e00-\u9fa5]*$/.test(name) || RESERVED_BINDINGS.has(name)) {
      notify('绑定名需以字母、下划线或汉字开头，且不能使用保留字'); displayTree(); return;
    }
    let conflict = false;
    const walk = item => {
      if (!item) return;
      if (item !== node && item.kind === 'quantifier' && (item.variable || 'item') === name) conflict = true;
      (item.children || []).forEach(walk);
    };
    walk(rule().ast);
    if (conflict) { notify('绑定名 ' + name + ' 已被使用'); displayTree(); return; }
    rewriteBinding(node, oldName, name);
    node.variable = name;
    save(); displayTree();
  }
  function applyExprChange(el) {
    const nodePath = el.dataset.nodePath, side = el.dataset.exprSide, argPath = el.dataset.argPath || '', part = el.dataset.exprPart;
    const node = getNode(nodePath);
    if (!node || node.kind !== 'compare') return;
    if (part === 'raw') { node[side] = el.value; save(); displayTree(); return; }
    const ast = parseExpr(node[side]);
    const target = exprAt(ast, argPath);
    if (!ast || !target) return;
    if (part === 'literal' || part === 'num') {
      let value;
      if (el.type === 'number' || part === 'num') { const raw = Number(el.value); value = Number.isFinite(raw) ? Math.trunc(raw) : 0; }
      else { try { value = JSON.parse(el.value); } catch { value = el.value; } }
      for (const key of Object.keys(target)) delete target[key];
      target.type = 'literal'; target.value = value;
    } else if (part === 'subject') {
      const scope = scopeOf(nodePath);
      const name = el.value;
      const split = splitParts(target.parts || []);
      rewritePath(target, subjectFor(name, scope), split.indices, split.attr, name);
    } else if (part.startsWith('index')) {
      const level = Number(part.slice(5));
      const scope = scopeOf(nodePath);
      const name = (target.parts || [])[0];
      const split = splitParts(target.parts || []);
      const next = split.indices.slice(0, level);
      next[level] = el.value;
      while (next.length && !next[next.length - 1]) next.pop();
      rewritePath(target, subjectFor(name, scope), next, split.attr, name);
    } else if (part === 'attr') {
      const scope = scopeOf(nodePath);
      const name = (target.parts || [])[0];
      const split = splitParts(target.parts || []);
      rewritePath(target, subjectFor(name, scope), split.indices, el.value, name);
    }
    node[side] = L.expressionString(ast);
    save(); displayTree();
  }
  function slotDomain(node, side, argPath) {
    const ast = parseExpr(node[side]);
    if (!argPath) return domainOf(parseExpr(side === 'left' ? node.right : node.left));
    const parts = String(argPath).split('.');
    const last = Number(parts.pop());
    const parent = exprAt(ast, parts.join('.'));
    return parent && parent.type === 'call' ? argDomain(parent, last) : null;
  }
  function firstSubject(scope, kinds) {
    let found = null;
    for (const [name, info] of Object.entries(scope)) if (kinds.includes(info.kind)) found = { name, kind: info.kind, source: info.source };
    return found;
  }
  function defaultExprFor(kind, scope, domain) {
    if (kind === 'group') {
      const found = firstSubject(scope, ['group', 'groupTuple', 'partition']);
      if (!found) return { type: 'path', parts: ['g', 'type'] };
      if (found.kind === 'group') return { type: 'path', parts: [found.name, 'type'] };
      if (found.kind === 'groupTuple') return { type: 'path', parts: [found.name, '0', 'type'] };
      return { type: 'path', parts: [found.name, '0', '0', 'type'] };
    }
    if (kind === 'pair') return { type: 'path', parts: ['pair', 'suit'] };
    if (kind === 'tile') {
      const found = firstSubject(scope, ['tile']);
      return found ? { type: 'path', parts: [found.name, 'rank'] } : { type: 'path', parts: ['winning', 'rank'] };
    }
    if (kind === 'tileValue') return { type: 'literal', value: '1z' };
    if (kind === 'signal') {
      const first = activeSpecs()[0];
      return { type: 'path', parts: ['signals', first ? first.name : 'tsumo'] };
    }
    if (kind === 'literal') return defaultLiteral(domain);
    if (kind.indexOf('formula:') === 0) return { type: 'call', name: kind.slice(8), args: defaultFormulaArgs(kind.slice(8), scope) };
    if (kind === 'fn') return { type: 'call', name: 'same', args: defaultFormulaArgs('same', scope) };
    return { type: 'literal', value: true };
  }
  function applyExprDrop(kind, nodePath, side, argPath) {
    const node = getNode(nodePath);
    if (!node || node.kind !== 'compare') return;
    const next = defaultExprFor(kind, scopeOf(nodePath), slotDomain(node, side, argPath));
    if (!argPath) { node[side] = L.expressionString(next); save(); displayTree(); return; }
    const ast = parseExpr(node[side]);
    const target = exprAt(ast, argPath);
    if (!ast || !target) return;
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, next);
    node[side] = L.expressionString(ast);
    save(); displayTree();
  }
  function applyArgButton(button, isAdd) {
    const node = getNode(button.dataset.nodePath);
    if (!node || node.kind !== 'compare') return;
    const side = button.dataset.exprSide, argPath = isAdd ? button.dataset.exprAdd : button.dataset.exprRemove;
    const ast = parseExpr(node[side]);
    const call = exprAt(ast, argPath || '');
    if (!ast || !call || call.type !== 'call') return;
    const f = fnSpec(call.name);
    if (isAdd) { if (call.args.length < f.max) call.args.push(defaultArgFor(call.name, call.args.length, scopeOf(button.dataset.nodePath))); }
    else if (call.args.length > f.min) call.args.pop();
    node[side] = L.expressionString(ast);
    save(); displayTree();
  }
  const QUANTIFIER_SOURCES = { groups: '面子', groupPairs: '面子的二元组合', groupTriples: '面子的三元组合', groupQuads: '面子的四元组合', groupPartitions: '四面子的两两划分', tiles: '牌', 'hand.concealed': '和牌前的牌' };
  function sourceSelect(path, current) {
    // 「和牌前的牌」是工作室独有集合，游戏侧不认，所以番种包模式下不提供。
    const options = Object.entries(QUANTIFIER_SOURCES).filter(([value]) => !isPackMode() || value !== 'hand.concealed');
    if (!options.some(([value]) => value === current)) {
      const label = current === 'tileKinds' ? '牌种' : /\.tiles$/.test(current) ? '牌' : '元素';
      options.push([current, label]);
    }
    return renderField(path, 'source', current, options);
  }
  function bindingField(path, variable) {
    return '<input class="binding-input" data-path="' + esc(path) + '" data-field="variable" value="' + esc(variable || 'item') + '" maxlength="24" spellcheck="false" title="变量名，可在下方条件中引用"/>';
  }
  function renderExprPalette() {
    const host = $('exprPalette'); if (!host) return;
    const atoms = [['group', '面子属性'], ['pair', '雀头属性'], ['tile', '牌属性'], ['tileValue', '单张牌'], ['signal', '信号量'], ['literal', '常量']];
    const formulas = exprSpec().functions.filter(f => !isPackMode() || PACK_FORMULAS.has(f.name));
    host.innerHTML = '<div class="palette-cat cat-attr">属性积木</div>' +
      atoms.map(([key, label]) => '<button draggable="true" class="palette-btn expr" data-new-expr="' + key + '" title="拖到比较式或公式参数中">' + esc(label) + '</button>').join('') +
      '<div class="palette-cat cat-formula">公式积木</div>' +
      formulas.map(f => '<button draggable="true" class="palette-btn formula" data-new-expr="formula:' + esc(f.name) + '" title="拖到比较式或公式参数中">' + esc(f.label) + '</button>').join('') +
      '<div class="palette-hint">把积木拖到比较式两侧，或公式的参数上。</div>';
  }
  function drawNode(n, path, depth = 0) {
    if (!n) return '';
    if (n.kind === 'compare') {
      return `<div class="condition relation formula-condition compare-cond" data-node-path="${esc(path)}"><span class="cond-label">比较式</span>${exprSlot(path, 'left', n.left, n.right)} ${renderField(path, 'op', n.op || 'eq', R.operators)} ${exprSlot(path, 'right', n.right, n.left)}<span class="cond-actions"><button data-remove="${esc(path)}" title="删除积木">×</button></span></div>`;
    }
    if (n.kind === 'check') {
      const def = R.blockDefs[n.key], style = def?.category === '状态' ? 'state' : def?.category === '关系' ? 'relation' : '';
      return `<div class="condition ${style}" data-node-path="${esc(path)}"><span class="cond-label">${esc(def?.label || n.key)}</span>${conditionFields(n, path)}<span class="cond-actions"><button data-remove="${esc(path)}" title="删除积木">×</button></span></div>`;
    }
    if (n.kind === 'quantifier') {
      const mode = n.mode || 'some';
      const s = sourcePhrase(n.source || 'groups');
      const source = sourceSelect(path, n.source || 'groups');
      const variable = bindingField(path, n.variable);
      const count = mode === 'count' ? `${renderField(path, 'op', n.op || 'gte', countOps)} ${renderNum(path, 'value', n.value ?? 1)}` : '';
      const head = mode === 'some' ? `存在${s.one} ${source} ${variable}，使其满足：`
        : mode === 'every' ? `对${s.each} ${source} ${variable}，都满足：`
          : mode === 'none' ? `不存在${s.one} ${source} ${variable} 满足：`
            : `满足下列条件的 ${source} ${variable} 共有 ${count} ${s.measure}：`;
      return `<div class="logic-node quantifier-node ${selectedPath === path ? 'selected' : ''}" data-logic-path="${esc(path)}"><div class="logic-top">${head}<span class="spacer"></span><button data-add-child="${esc(path)}">＋</button><button data-remove="${esc(path)}">×</button></div><div class="logic-children" data-drop-path="${esc(path)}">${(n.children || []).map((c, i) => drawNode(c, path === 'root' ? String(i) : `${path}.${i}`, depth + 1)).join('') || '<div class="empty-drop">把比较或逻辑积木放到量词内部</div>'}</div></div>`;
    }

    const logicHints = { all: 'AND 同时成立', any: 'OR 至少一条成立', not: 'NOT 条件取反' };
    return `<div class="logic-node ${selectedPath === path ? 'selected' : ''}" data-logic-path="${esc(path)}">
    <div class="logic-top"><span>⊞</span><select data-kind-path="${esc(path)}"><option value="all" ${n.kind === 'all' ? 'selected' : ''}>且</option><option value="any" ${n.kind === 'any' ? 'selected' : ''}>或</option><option value="not" ${n.kind === 'not' ? 'selected' : ''}>非</option></select><span class="logic-hint">${logicHints[n.kind] || ''}</span><span class="spacer"></span><button title="添加一个条件" data-add-child="${esc(path)}">＋</button>${path === 'root' ? '' : `<button title="删除容器" data-remove="${esc(path)}">×</button>`}</div>
    <div class="logic-children" data-drop-path="${esc(path)}">${(n.children || []).map((c, i) => drawNode(c, path === 'root' ? String(i) : `${path}.${i}`, depth + 1)).join('') || '<div class="empty-drop">拖入积木或选中此容器后点击上方积木</div>'}</div></div>`;
  }
  function displayTree() { const r = rule(); if (!r) return; $('blockTree').innerHTML = drawNode(r.ast, 'root'); }
  function openRule(id) {
    const target = state.rules.find(r => r.id === id);
    if (!target) return;
    selectedId = id; selectedPath = 'root';
    let changed = ensureRootContainer(target);
    if (normalizeBindings(target)) changed = true;
    if (changed) save();
    displayRules(); displayRuleMeta(); displayTree();
  }
  function makeNewRule() { const id = 'custom_' + Date.now().toString(36); const r = { id, name: '新番型', category: '自定义', ruleSetId: state.activeRuleSetId, closedHan: 1, openHan: 1, yakuman: 0, enabled: false, ast: { kind: 'all', children: [] }, suppresses: [], description: '请在这里填写番种描述！', builtin: false }; state.rules.push(r); save(); openRule(id); notify('已创建新番型（默认未启用）'); }
  function duplicateRule() { const r = copy(rule()); r.id = 'custom_' + Date.now().toString(36); r.name += '（副本）'; r.category = '自定义'; r.enabled = false; r.builtin = false; state.rules.push(r); save(); openRule(r.id); notify('已复制；可以编辑后启用'); }
  function deleteRule() { const r = rule(); if (!r) return; if (!confirm(`删除番型「${r.name}」？预设番型也可删除，但能通过恢复预设重新获取。`)) return; state.rules = state.rules.filter(x => x.id !== r.id); selectedId = state.rules.find(x => owner(x) === state.activeRuleSetId && (!BRIEF || briefCustom(x)))?.id || null; save(); if (selectedId) openRule(selectedId); else { displayRules(); $('blockTree').innerHTML = '<div class="empty-drop">这个体系还没有番型。点击左侧「新番型」从头建立。</div>'; } notify('已删除'); }
  function renderTiles() {
    const names = { m: '萬', p: '筒', s: '索', z: '字' };
    const zh = { '1z': '東', '2z': '南', '3z': '西', '4z': '北', '5z': '白', '6z': '發', '7z': '中' };
    const allowed = new Set(activeRuleSet().tileSystem?.tileKinds || E.allKinds); $('tilePalette').innerHTML = E.allKinds.filter(t => allowed.has(t)).map(t => `<button class="tile ${t[1]}" data-tile="${t}" title="${t}（${t[1] === 'z' ? zh[t] : t[0] + names[t[1]]}）">${t[1] === 'z' ? zh[t] : t[0] + names[t[1]]}</button>`).join('');
  }
  function countExpected() {
    let n; try { n = E.parseTiles(state.hand.concealed).length; } catch { n = '?'; }
    $('concealedNeed').textContent = `${n} / ${Number(activeRuleSet().winningHandTiles || 14) - 1 - 3 * state.hand.melds.length}`;
  }
  function renderHand() {
    $('concealed').value = state.hand.concealed; $('winning').value = state.hand.winning;
    renderMelds(); countExpected();
  }
  function appendTile(t) {
    if (tileTarget === 'winning') { $('winning').value = t; state.hand.winning = t; }
    else {
      let tiles; try { tiles = E.parseTiles(state.hand.concealed); } catch { tiles = []; }
      tiles.push(t); state.hand.concealed = E.formatTiles(tiles); $('concealed').value = state.hand.concealed;
    } countExpected(); save();
  }
  function renderMelds() {
    const opts = [['chi', '吃 / 顺子'], ['pon', '碰 / 刻子'], ['kanOpen', '明杠'], ['kanClosed', '暗杠'], ['kanAdded', '加杠']];
    $('meldList').innerHTML = state.hand.melds.map((m, i) => `<div class="meld-row"><select data-meld="${i}" data-part="source">${optionList(opts, m.source)}</select><input data-meld="${i}" data-part="pattern" value="${esc(m.pattern)}" placeholder="123m或777z"/><button data-remove-meld="${i}" class="remove" title="移除副露">×</button></div>`).join('') || '<p style="color:var(--muted2);font-size:11px;margin:0 0 4px">暂无副露，按门清手牌处理。</p>';
  }
  function signalValue(s) { return activeValues()[s.name] ?? s.default; }
  function renderSignals() {
    const bools = activeSpecs().filter(s => s.type === 'boolean'); const other = activeSpecs().filter(s => s.type !== 'boolean');
    $('signalControls').innerHTML = bools.map(s => `<label class="signal-bool"><input type="checkbox" data-signal="${esc(s.name)}" ${signalValue(s) ? 'checked' : ''}/> ${esc(s.label)}</label>`).join('') +
      other.map(s => `<label class="signal-input">${esc(s.label)}${s.type === 'number' ? `<input type="number" min="0" value="${esc(signalValue(s))}" data-signal="${esc(s.name)}"/>` : `<select data-signal="${esc(s.name)}">${optionList((s.options || '').split(',').map(v => [v.trim(), v.trim()]), signalValue(s))}</select>`}</label>`).join('');
  }
  function renderSignalInventory() {
    $('signalInventory').innerHTML = activeSpecs().map(s => `<span class="signal-chip">${esc(s.label)} <span style="color:var(--muted2)">(${esc(s.name)})</span><button type="button" data-delete-signal="${esc(s.name)}" title="从当前体系删除信号">×</button></span>`).join('') || '<span class="cat-note">当前体系还没有信号量。</span>';
  }
  function uniqueRuleSetId(prefix = 'ruleset') { let id = `${prefix}_${Date.now().toString(36)}`, n = 2; while (state.ruleSets.some(rs => rs.id === id)) id = `${prefix}_${Date.now().toString(36)}_${n++}`; return id; }
  function switchRuleSet(id) {
    if (!state.ruleSets.some(rs => rs.id === id)) return;
    if (BRIEF && id !== 'riichi' && id !== 'mcr') return;
    state.activeRuleSetId = id;
    const pool = state.rules.filter(r => owner(r) === id && (!BRIEF || briefCustom(r)));
    selectedId = pool[0]?.id || null; save(); renderRuleSetChoices(); displayRules(); renderSignals(); renderTiles(); countExpected(); palette();
    if (selectedId) openRule(selectedId); else { $('blockTree').innerHTML = '<div class="empty-drop">这个体系还没有番型。点击左侧「新番型」从头建立。</div>'; }
  }
  function renderSettlementEditor(rs) {
    const s = rs.settlement || {};
    const fields = [['base', '基础分 / 点数'], ['ron', '放铳：点炮者支付'], ['ronOther', '放铳：其他家支付'], ['tsumoDealerWin', '自摸：庄家赢时每家'], ['tsumoNonDealerDealer', '自摸：闲家赢时庄家'], ['tsumoNonDealerOther', '自摸：闲家赢时闲家']];
    const tokens = [['han', '番数'], ['fu', '符数'], ['bonus', '奖励番'], ['yakuman', '役满倍数'], ['base', '基础分'], ['dealer', '庄家'], ['tsumo', '自摸'], ['players', '人数'], ['add(', '+'], ['sub(', '−'], ['mul(', '×'], ['div(', '÷'], ['min(', '最小'], ['max(', '最大'], ['if(', '如果'], ['ceil(', '上取整'], ['floor(', '下取整'], ['round(', '四舍五入'], ['pow(', '幂'], ['gt(', '>'], ['gte(', '≥'], ['lt(', '<'], ['lte(', '≤'], ['eq(', '='], [')', '）'], ['0', '0'], ['8', '8'], ['100', '100']];
    $('settlementTokens').innerHTML = tokens.map(([token, label]) => `<button type="button" draggable="true" class="settle-token" data-settle-token="${esc(token)}">${esc(label)}</button>`).join('');
    $('settlementGrid').innerHTML = fields.map(([key, label]) => `<label class="field settle-field"><span>${label}</span><input class="settle-input" data-settle="${key}" value="${esc(s[key] || '')}" spellcheck="false"/></label>`).join('');
  }
  function insertSettlementToken(token, target) {
    let input = target && target.classList?.contains('settle-input') ? target : document.activeElement;
    if (!input || !input.classList?.contains('settle-input')) input = document.querySelector('#settlementGrid .settle-input');
    if (!input) { notify('请先点进一个结算公式输入框'); return; }
    const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
    input.value = input.value.slice(0, start) + token + input.value.slice(end);
    input.focus(); input.selectionStart = input.selectionEnd = start + token.length;
  }
  function renderRuleSetForm() {
    const rs = activeRuleSet(), policy = rs.scoringPolicy || {};
    $('ruleSetName').value = rs.name; $('ruleSetUnit').value = rs.scoreUnit || '番'; $('ruleSetMinimum').value = Number(rs.minimumWinScore || 0); $('ruleSetHandTiles').value = Number(rs.winningHandTiles || 14); $('ruleSetCopies').value = Number(rs.tileSystem?.copiesPerKind || 4); $('ruleSetTileKinds').value = E.formatTiles(rs.tileSystem?.tileKinds || R.standardTileKinds);
    $('ruleSetStructures').innerHTML = (rs.winStructures || []).map(s => `<label class="check-field"><input type="checkbox" data-structure="${esc(s.id)}" ${s.enabled ? 'checked' : ''}/> ${esc(s.label)}</label>`).join('');
    $('ruleSetAggregation').value = policy.aggregation || 'sum'; $('ruleSetBest').checked = policy.chooseBestDecomposition !== false; $('ruleSetBonus').checked = Boolean(policy.allowBonusWithoutPattern);
    renderSettlementEditor(rs);
    $('deleteRuleSetBtn').disabled = state.ruleSets.length <= 1;
  }
  function installTileSystemEditor() { const old = $('ruleSetTiles')?.closest('.field'); if (!old) return; old.outerHTML = '<div class="tile-system-editor"><div class="form-grid"><label class="field"><span>和牌总张数（包含和牌张）</span><input id="ruleSetHandTiles" type="number" min="2" value="14" /></label><label class="field"><span>每种牌最多张数</span><input id="ruleSetCopies" type="number" min="1" value="4" /></label></div><label class="field"><span>允许使用的牌种 <small>沿用 m万 / p筒 / s索 / z字记法</small></span><input id="ruleSetTileKinds" placeholder="123456789m123456789p123456789s1234567z" /></label></div>'; }
  function currentStructure() { const list = activeRuleSet().winStructures || []; return list.find(s => s.id === selectedStructureId) || list[0]; }
  function uniqueStructureId() { let id = `structure_${Date.now().toString(36)}`, n = 2; while (activeRuleSet().winStructures.some(s => s.id === id)) id = `structure_${Date.now().toString(36)}_${n++}`; return id; }
  function renderStructureList() {
    const list = activeRuleSet().winStructures || [];
    if (!selectedStructureId || !list.some(s => s.id === selectedStructureId)) selectedStructureId = list[0]?.id || null;
    $('structureList').innerHTML = list.map(s => `<button type="button" class="structure-item ${s.id === selectedStructureId ? 'selected' : ''}" data-structure-id="${esc(s.id)}"><span>${esc(s.label)}</span><small>${esc(s.definition?.type || 'adapter')}</small></button>`).join('') || '<div class="empty-drop">还没有和牌结构，请点击“新建”。</div>';
  }
  function numberBlock(label, id, value, note = '') { return `<label class="structure-block"><span class="structure-block-name">${esc(label)}</span><input id="${id}" type="number" min="0" value="${esc(value)}"/>${note ? `<small>${esc(note)}</small>` : ''}</label>`; }
  function renderStructureBlocks() {
    const s = currentStructure(); if (!s) { $('structureForm').hidden = true; return; } $('structureForm').hidden = false;
    const d = s.definition || { type: 'adapter', adapter: s.id }; $('structureName').value = s.label; $('structureId').value = s.id; $('structureType').value = d.type || 'adapter';
    if (d.type === 'standard') $('structureBlocks').innerHTML = `<div class="structure-block-row">${numberBlock('输入的逻辑牌张', 'structureTotal', d.totalTiles ?? 14, '应等于 面子数×3＋对子数×2')}${numberBlock('面子部件数量', 'structureGroupCount', d.groupCount ?? 4)}${numberBlock('对子部件数量', 'structurePairCount', d.pairCount ?? 1)}</div><div class="structure-block"><span class="structure-block-name">允许生成的面子部件</span><div class="structure-checks"><label><input type="checkbox" id="structureSequence" ${(d.allowedMelds || []).includes('sequence') ? 'checked' : ''}/> 顺子</label><label><input type="checkbox" id="structureTriplet" ${(d.allowedMelds || []).includes('triplet') ? 'checked' : ''}/> 刻子</label><label><input type="checkbox" id="structureQuad" ${(d.allowedMelds || []).includes('quad') ? 'checked' : ''}/> 杠子</label><label><input type="checkbox" id="structureRepeatedPairs" ${d.allowRepeatedPairs ? 'checked' : ''}/> 四张同牌可生成两个对子</label></div></div><div class="consume-block">✓ 每张牌恰好被一个面子或对子消费，不允许剩余</div>`;
    else if (d.type === 'multiplicity') $('structureBlocks').innerHTML = `<div class="structure-block-row">${numberBlock('输入牌张', 'structureTotal', d.totalTiles ?? 14)}${numberBlock('最多副露数', 'structureMaxMelds', d.maxDeclaredMelds ?? 0)}</div><label class="structure-block"><span class="structure-block-name">每一种牌允许出现的张数</span><input id="structureAllowedCounts" value="${esc((d.allowedCounts || [0, 2, 4]).join(','))}" placeholder="0,2,4"/><small>逐种检查；国标七对子允许 4，立直七对子不允许 4。</small></label><div class="structure-arrow">每种牌的张数 ÷ 单位大小 → 生成单位</div><div class="structure-block-row">${numberBlock('每个单位消耗牌张', 'structureUnitSize', d.unitSize ?? 2)}${numberBlock('必须生成的单位数量', 'structureUnitCount', d.unitCount ?? 7)}</div><div class="consume-block">✓ 所有牌都被单位消费，不允许剩余</div>`;
    else if (d.type === 'requiredKinds') $('structureBlocks').innerHTML = `<div class="structure-block-row">${numberBlock('输入牌张', 'structureTotal', d.totalTiles ?? 14)}${numberBlock('最多副露数', 'structureMaxMelds', d.maxDeclaredMelds ?? 0)}</div><label class="structure-block"><span class="structure-block-name">必须出现的牌种</span><input id="structureKinds" value="${esc(E.formatTiles(d.kinds || []))}" placeholder="19m19p19s1234567z"/></label><div class="structure-block-row">${numberBlock('每种至少出现', 'structureMinimumEach', d.minimumEach ?? 1)}${numberBlock('超过最低数量的牌张', 'structureDuplicateUnits', d.duplicateUnits ?? 1, '十三幺为 1 张重复牌')}</div><label class="check-field"><input id="structureOnlyListed" type="checkbox" ${d.onlyListedKinds ? 'checked' : ''}/> 不允许出现列表外的牌</label><div class="consume-block">✓ 必须牌种与重复牌共同消费全部牌张</div>`;
    else $('structureBlocks').innerHTML = `<label class="structure-block"><span class="structure-block-name">特殊拆分器</span><select id="structureAdapter">${optionList([['lesserKnitted', '全不靠'], ['knitted', '组合龙']], d.adapter || s.id)}</select><small>这些旧结构暂由专用拆分器生成；可以复制后改名，但内部算法不可用通用数量积木表达。</small></label>`;
  }
  function openStructureEditor() { const list = activeRuleSet().winStructures || []; selectedStructureId = list[0]?.id || null; renderStructureList(); renderStructureBlocks(); $('ruleSetDialog').close(); $('structureDialog').showModal(); }
  function closeStructureEditor() { $('structureDialog').close(); renderRuleSetForm(); $('ruleSetDialog').showModal(); }
  function newStructure() { const s = R.blankStructure(uniqueStructureId()), total = Number(activeRuleSet().winningHandTiles || 14); s.definition.totalTiles = total; if (s.definition.type === 'standard' && total < 14) { s.definition.groupCount = Math.max(1, Math.floor((total - 2) / 3)); s.definition.pairCount = 1; } activeRuleSet().winStructures.push(s); selectedStructureId = s.id; save(); renderStructureList(); renderStructureBlocks(); notify('已新建面子＋对子结构，可直接修改数量'); }
  function copyStructure() { const source = currentStructure(); if (!source) return; const s = { ...copy(source), id: uniqueStructureId(), label: `${source.label}（副本）` }; activeRuleSet().winStructures.push(s); selectedStructureId = s.id; save(); renderStructureList(); renderStructureBlocks(); notify('结构已复制，可修改其原子约束'); }
  function deleteStructure() { const s = currentStructure(); if (!s) return; if (!confirm(`删除和牌结构「${s.label}」？引用这个结构 ID 的番型将不再匹配。`)) return; activeRuleSet().winStructures = activeRuleSet().winStructures.filter(x => x.id !== s.id); selectedStructureId = activeRuleSet().winStructures[0]?.id || null; save(); renderStructureList(); renderStructureBlocks(); notify('和牌结构已删除'); }
  function saveStructure() {
    const s = currentStructure(); if (!s) return; const type = $('structureType').value, num = id => Math.max(0, Number($(id)?.value) || 0); s.label = $('structureName').value.trim() || '未命名结构';
    if (type === 'standard') s.definition = { type, totalTiles: num('structureTotal'), groupCount: num('structureGroupCount'), pairCount: num('structurePairCount'), allowedMelds: [['structureSequence', 'sequence'], ['structureTriplet', 'triplet'], ['structureQuad', 'quad']].filter(([id]) => $(id)?.checked).map(x => x[1]), allowRepeatedPairs: Boolean($('structureRepeatedPairs')?.checked), consumeAll: true };
    else if (type === 'multiplicity') { const allowed = String($('structureAllowedCounts')?.value || '').split(/[,，\s]+/).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 4); s.definition = { type, totalTiles: num('structureTotal'), maxDeclaredMelds: num('structureMaxMelds'), allowedCounts: [...new Set(allowed)].sort((a, b) => a - b), unitSize: Math.max(1, num('structureUnitSize')), unitCount: num('structureUnitCount'), consumeAll: true }; }
    else if (type === 'requiredKinds') { let kinds; try { kinds = [...new Set(E.parseTiles($('structureKinds').value))]; } catch { notify('必须牌种格式错误'); return; } s.definition = { type, totalTiles: num('structureTotal'), maxDeclaredMelds: num('structureMaxMelds'), kinds, minimumEach: num('structureMinimumEach'), duplicateUnits: num('structureDuplicateUnits'), onlyListedKinds: $('structureOnlyListed').checked, consumeAll: true }; }
    else s.definition = { type: 'adapter', adapter: $('structureAdapter')?.value || s.id };
    save(); renderStructureList(); renderStructureBlocks(); renderRuleSetForm(); palette(); if (selectedId) displayTree(); notify('和牌结构已保存，并立即参与拆解');
  }
  function createRuleSet() { const rs = R.blankRuleSet(uniqueRuleSetId()); state.ruleSets.push(rs); state.signalValues[rs.id] = {}; switchRuleSet(rs.id); renderRuleSetForm(); notify('已建立空白规则体系，可以从零添加信号与番型'); }
  function copyRuleSet() {
    const source = activeRuleSet(), id = uniqueRuleSetId(source.id), rs = { ...copy(source), id, name: `${source.name}（副本）`, builtin: false }; state.ruleSets.push(rs); state.signalValues[id] = copy(activeValues());
    const stamp = Date.now().toString(36); state.rules.filter(r => owner(r) === source.id).forEach((r, i) => state.rules.push({ ...copy(r), id: `copy_${stamp}_${i}`, ruleSetId: id, ruleset: undefined, builtin: false }));
    switchRuleSet(id); renderRuleSetForm(); notify('已复制体系、番型、信号与计分设置');
  }
  function deleteRuleSet() {
    const rs = activeRuleSet(); if (state.ruleSets.length <= 1) { notify('至少要保留一个规则体系'); return; } if (!confirm(`删除规则体系「${rs.name}」及其全部番型和信号？`)) return;
    state.ruleSets = state.ruleSets.filter(x => x.id !== rs.id); state.rules = state.rules.filter(r => owner(r) !== rs.id); delete state.signalValues[rs.id]; switchRuleSet(state.ruleSets[0].id); $('ruleSetDialog').close(); notify('规则体系已删除');
  }
  function renderCategoryInventory() {
    const host = $('categoryInventory'); if (!host) return;
    host.innerHTML = (state.categories || []).map(c => {
      const tiles = c.kind === 'tiles'
        ? `<label class="field cat-tiles"><span>包含的牌</span><input data-cat-tiles="${esc(c.key)}" value="${esc(E.formatTiles(Array.isArray(c.tiles) ? c.tiles : []))}" placeholder="2s3s4s6s8s6z"/></label>`
        : '<span class="cat-note">内置判定，只能修改显示名称。</span>';
      return `<div class="category-row"><div class="cat-head"><label class="field"><span>显示名称</span><input data-cat-label="${esc(c.key)}" value="${esc(c.label)}"/></label><span class="cat-key">${esc(c.key)}</span><button type="button" class="icon-btn" data-delete-category="${esc(c.key)}" title="删除类别">×</button></div>${tiles}</div>`;
    }).join('') || '<p class="cat-note">还没有类别。</p>';
  }
  function calculate() {
    try {
      const rs = activeRuleSet(), activeRules = state.rules.filter(r => owner(r) === rs.id);
      const result = E.analyze(state.hand, activeRules, activeValues(), rs), scoreUnit = rs.scoreUnit || '番';
      if (!result.complete) { $('result').innerHTML = `<div class="result-warning">${esc(result.error)}</div><div class="result-meta">请检查和牌结构、副露数量和面子牌张。</div>`; return; }
      if (!result.valid) { $('result').innerHTML = `<div class="result-top"><div><h3>牌型合法，但没有役</h3><div class="result-sub">不计宝牌，不可和牌</div></div><strong style="color:var(--muted)">0 番</strong></div><div class="result-meta">已检查 ${result.variants} 种拆解 / 和牌归属方案。你可以启用原创役或设置立直、自摸等信号量。</div>`; return; }
      let total = result.yakuman ? `${result.yakuman} 倍役满` : `${result.han + result.bonus} ${scoreUnit}`;
      const fuText = rs.id !== 'mcr' && result.fu ? ` · ${result.fu}符` : '';
      let details = result.hits.map(r => `<div class="result-yaku"><span>${esc(r.name)}</span><span>${r.yakuman ? `${r.yakuman}役满` : `${r.awarded ?? (result.data.closed ? r.closedHan : r.openHan)}${scoreUnit}`}</span></div>`).join('');
      if (result.bonus && !result.yakuman) details += `<div class="result-yaku"><span>宝牌 / 赤宝牌 / 里宝牌</span><span>＋${result.bonus}${scoreUnit}</span></div>`;
      const minimum = result.meetsMinimum === false ? `<div class="result-warning">未达到「${esc(rs.name)}」的最低和牌分 ${rs.minimumWinScore} ${esc(scoreUnit)}</div>` : '';
      let settlement = '';
      if (result.settlement) { const st = result.settlement, unit = rs.id === 'mcr' ? '分' : '点'; settlement = `<div class="result-settlement"><div class="settle-title">分数结算 · ${st.tsumo ? '自摸' : '放铳'}</div><div class="settle-row win"><span>和牌者</span><b>+${Math.round(st.winner)} ${unit}</b></div>${st.payments.map(p => `<div class="settle-row"><span>${esc(p.role)}${p.count > 1 ? ` ×${p.count}` : ''}</span><b>-${Math.round(p.amount)} ${unit}</b></div>`).join('')}<div class="settle-note">基础分 ${Math.round(st.base)} ${unit}${st.tsumo ? ' · 自摸' : ' · 放铳'}</div></div>`; }
      $('result').innerHTML = `<div class="result-top"><div><div class="result-score">${esc(total)}</div><div class="result-sub">${esc(rs.name)} · 基础 ${result.han} ＋ 奖励 ${result.bonus}${fuText}</div></div><span class="pill">${result.data.closed ? '门清' : '副露'}</span></div>${minimum}${details}${settlement}<div class="result-meta">${shapeLabel(result.variant.shape)} · ${waitLabel(result.variant.wait)} · 共检查 ${result.variants} 种候选解释<br/>番种按当前体系计算${result.settlement ? '；结算支付按「分数结算」公式计算。' : '；本体系不结算点数。'}</div>`;
    } catch (err) { $('result').innerHTML = `<div class="result-warning">${esc(err.message || String(err))}</div>`; }
  }
  function bindEvents() {
    $('ruleSearch').addEventListener('input', displayRules);
    renderRuleSetChoices();
    $('rulesetSelect').addEventListener('change', e => switchRuleSet(e.target.value));
    $('manageRuleSetsBtn').onclick = () => { renderRuleSetForm(); $('ruleSetDialog').showModal(); };
    $('closeRuleSetDialog').onclick = () => $('ruleSetDialog').close(); $('newRuleSetBtn').onclick = createRuleSet; $('copyRuleSetBtn').onclick = copyRuleSet; $('deleteRuleSetBtn').onclick = deleteRuleSet;
    $('editStructuresBtn').onclick = openStructureEditor; $('closeStructureDialog').onclick = closeStructureEditor; $('newStructureBtn').onclick = newStructure; $('copyStructureBtn').onclick = copyStructure; $('deleteStructureBtn').onclick = deleteStructure;
    $('structureList').onclick = e => { const id = e.target.closest('[data-structure-id]')?.dataset.structureId; if (!id) return; selectedStructureId = id; renderStructureList(); renderStructureBlocks(); };
    $('structureType').onchange = e => { const s = currentStructure(); if (!s) return; const type = e.target.value; s.definition = type === 'standard' ? { type, totalTiles: 14, groupCount: 4, pairCount: 1, allowedMelds: ['sequence', 'triplet', 'quad'], allowRepeatedPairs: false, consumeAll: true } : type === 'multiplicity' ? { type, totalTiles: 14, maxDeclaredMelds: 0, allowedCounts: [0, 2, 4], unitSize: 2, unitCount: 7, consumeAll: true } : type === 'requiredKinds' ? { type, totalTiles: 14, maxDeclaredMelds: 0, kinds: [], minimumEach: 1, duplicateUnits: 0, onlyListedKinds: true, consumeAll: true } : { type: 'adapter', adapter: 'knitted' }; renderStructureBlocks(); };
    $('structureForm').onsubmit = e => { e.preventDefault(); saveStructure(); };
    $('ruleSetForm').addEventListener('submit', e => { e.preventDefault(); const rs = activeRuleSet(); let tileKinds; try { tileKinds = [...new Set(E.parseTiles($('ruleSetTileKinds').value))]; if (!tileKinds.length) throw Error(); } catch { notify('牌张体系至少需要一种有效牌，例如 123m123p123s1z'); return; } rs.name = $('ruleSetName').value.trim() || '未命名体系'; rs.scoreUnit = $('ruleSetUnit').value.trim() || '分'; rs.minimumWinScore = Math.max(0, Number($('ruleSetMinimum').value) || 0); rs.winningHandTiles = Math.max(2, Number($('ruleSetHandTiles').value) || 14); rs.tileSystem = { id: 'custom', label: '自定义牌张集合', tileKinds, copiesPerKind: Math.max(1, Number($('ruleSetCopies').value) || 4) }; rs.winStructures = (rs.winStructures || []).map(s => ({ ...s, enabled: Boolean(document.querySelector(`[data-structure="${s.id}"]`)?.checked) })); rs.scoringPolicy = { aggregation: $('ruleSetAggregation').value, chooseBestDecomposition: $('ruleSetBest').checked, allowBonusWithoutPattern: $('ruleSetBonus').checked }; const settlement = {}; for (const key of ['base', 'ron', 'ronOther', 'tsumoDealerWin', 'tsumoNonDealerDealer', 'tsumoNonDealerOther']) { const value = document.querySelector(`#settlementGrid [data-settle="${key}"]`)?.value.trim() || ''; if (!value || !parseExpr(value)) { notify(`结算公式「${key}」无效`); return; } settlement[key] = value; } rs.settlement = settlement; save(); renderRuleSetChoices(); displayRules(); renderTiles(); countExpected(); $('ruleSetDialog').close(); notify('规则体系与牌张体系已保存'); });
    $('settlementTokens').addEventListener('dragstart', e => { const token = e.target.closest('[data-settle-token]')?.dataset.settleToken; if (token === undefined) return; e.dataTransfer.setData('text/plain', 'settle:' + token); e.dataTransfer.effectAllowed = 'copy'; });
    $('settlementTokens').addEventListener('click', e => { const token = e.target.closest('[data-settle-token]')?.dataset.settleToken; if (token !== undefined) insertSettlementToken(token); });
    $('settlementGrid').addEventListener('dragover', e => { if (e.target.classList.contains('settle-input')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    $('settlementGrid').addEventListener('drop', e => { const token = e.dataTransfer.getData('text/plain'); if (token.indexOf('settle:') !== 0) return; e.preventDefault(); insertSettlementToken(token.slice(7), e.target); });
    $('ruleList').addEventListener('click', e => { if (e.target.matches('input[data-toggle]')) return; const id = e.target.closest('[data-rule]')?.dataset.rule; if (id) openRule(id); });
    $('ruleList').addEventListener('change', e => { if (!e.target.matches('[data-toggle]')) return; const r = state.rules.find(x => x.id === e.target.dataset.toggle); if (r) { r.enabled = e.target.checked; save(); displayRules(); } });
    $('newRuleBtn').onclick = makeNewRule;
    $('duplicateBtn').onclick = duplicateRule;
    $('deleteBtn').onclick = deleteRule;
    $('addAndBtn').onclick = () => addBlock('all');
    for (const [id, field, convert] of [['ruleName', 'name', v => v || '未命名'], ['ruleCategory', 'category', v => v], ['ruleRuleset', 'ruleSetId', v => v], ['closedHan', 'closedHan', Number], ['openHan', 'openHan', v => v === '' ? null : Number(v)], ['yakuman', 'yakuman', Number], ['ruleDescription', 'description', v => v]]) {
      $(id).addEventListener('change', e => { rule()[field] = convert(e.target.value); save(); if (field === 'ruleSetId') { switchRuleSet(e.target.value); return; } displayRules(); });
    }
    $('suppresses').addEventListener('change', e => { const id = e.target.dataset.suppress; if (!id || !rule()) return; const current = new Set(rule().suppresses || []); e.target.checked ? current.add(id) : current.delete(id); rule().suppresses = [...current]; save(); });
    $('palette').addEventListener('click', e => { const key = e.target.closest('[data-new]')?.dataset.new; if (key) addBlock(key); });
    $('palette').addEventListener('dragstart', e => { const key = e.target.dataset.new; if (key) { e.dataTransfer.setData('text/plain', key); e.dataTransfer.effectAllowed = 'copy'; } });
    $('blockTree').addEventListener('dragover', e => { const exprZone = e.target.closest('[data-expr-drop]'); if (exprZone) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; exprZone.classList.add('expr-drop-active'); return; } const zone = e.target.closest('[data-drop-path]'); if (zone) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; zone.closest('.logic-node')?.classList.add('drop-active'); } });
    $('blockTree').addEventListener('dragleave', e => { const exprZone = e.target.closest('[data-expr-drop]'); if (exprZone) { exprZone.classList.remove('expr-drop-active'); return; } const zone = e.target.closest('[data-drop-path]'); if (zone) zone.closest('.logic-node')?.classList.remove('drop-active'); });
    $('blockTree').addEventListener('drop', e => { const key = e.dataTransfer.getData('text/plain'); const exprZone = e.target.closest('[data-expr-drop]'); if (exprZone) { e.preventDefault(); document.querySelectorAll('.drop-active,.expr-drop-active').forEach(x => x.classList.remove('drop-active', 'expr-drop-active')); if (key.indexOf('expr:') === 0) applyExprDrop(key.slice(5), exprZone.dataset.nodePath, exprZone.dataset.exprSide, exprZone.dataset.argPath || ''); return; } const zone = e.target.closest('[data-drop-path]'); if (!zone) return; e.preventDefault(); document.querySelectorAll('.drop-active').forEach(x => x.classList.remove('drop-active')); if ([...Object.keys(R.blockDefs), 'all', 'any', 'not'].includes(key)) addBlock(key, zone.dataset.dropPath); });
    $('blockTree').addEventListener('click', e => {
      const remove = e.target.closest('[data-remove]'); if (remove) { removeBlock(remove.dataset.remove); return; }
      const add = e.target.closest('[data-add-child]'); if (add) { selectedPath = add.dataset.addChild; displayTree(); notify('已选择插入位置，请点击上方积木'); return; }
      if (e.target.closest('select,input,.condition')) return;
      const logic = e.target.closest('[data-logic-path]'); if (logic) { selectedPath = logic.dataset.logicPath; displayTree(); }
    });
    $('blockTree').addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.kindPath) { const node = getNode(el.dataset.kindPath); if (!node) return; node.kind = el.value; if (node.kind === 'not' && node.children.length > 1) node.children = node.children.slice(0, 1); save(); displayTree(); return; }
      if (!el.dataset.path || !el.dataset.field) return;
      const n = getNode(el.dataset.path); if (!n) return;
      if (n.kind === 'quantifier' && el.dataset.field === 'variable') { renameBinding(n, el.value); return; }
      let value = el.value;
      if (['value', 'differentSuits'].includes(el.dataset.field) && ['true', 'false'].includes(value)) value = value === 'true';
      if (el.type === 'number') value = Number(value);
      n[el.dataset.field] = value;
      if (n.key === 'signal' && el.dataset.field === 'name') n.value = activeSpecs().find(s => s.name === value)?.default ?? false;
      save(); displayTree();
    });
    const exprPaletteHost = $('exprPalette'); if (exprPaletteHost) exprPaletteHost.addEventListener('click', e => { const key = e.target.closest('[data-new-expr]')?.dataset.newExpr; if (key) notify('把表达式积木拖到比较式左/右两侧，或公式参数上'); });
    if (exprPaletteHost) exprPaletteHost.addEventListener('dragstart', e => { const key = e.target.closest('[data-new-expr]')?.dataset.newExpr; if (key) { e.dataTransfer.setData('text/plain', 'expr:' + key); e.dataTransfer.effectAllowed = 'copy'; } });
    $('blockTree').addEventListener('change', e => { const el = e.target; if (el.dataset.exprPart) applyExprChange(el); });
    $('blockTree').addEventListener('click', e => {
      const addExpr = e.target.closest('[data-expr-add]'); if (addExpr) { applyArgButton(addExpr, true); return; }
      const removeExpr = e.target.closest('[data-expr-remove]'); if (removeExpr) { applyArgButton(removeExpr, false); return; }
    });
    $('tilePalette').onclick = e => { const t = e.target.closest('[data-tile]')?.dataset.tile; if (t) appendTile(t); };
    document.querySelectorAll('[data-tile-target]').forEach(b => b.onclick = () => { tileTarget = b.dataset.tileTarget; document.querySelectorAll('[data-tile-target]').forEach(x => x.classList.toggle('active', x === b)); });
    for (const field of ['concealed', 'winning']) $(field).addEventListener('input', e => { state.hand[field] = e.target.value; countExpected(); save(); });
    $('undoTileBtn').onclick = () => { try { const ts = E.parseTiles(state.hand.concealed); ts.pop(); state.hand.concealed = E.formatTiles(ts); $('concealed').value = state.hand.concealed; countExpected(); save(); } catch { notify('牌输入格式错误，无法自动删除'); } };
    $('clearHandBtn').onclick = () => { state.hand.concealed = ''; $('concealed').value = ''; countExpected(); save(); };
    $('addMeldBtn').onclick = () => { const max = Math.max(0, ...(activeRuleSet().winStructures || []).map(s => Number(s.definition?.groupCount) || 0), Math.floor((Number(activeRuleSet().winningHandTiles || 14) - 2) / 3)); if (state.hand.melds.length >= max) { notify(`当前体系最多允许 ${max} 组副露`); return; } state.hand.melds.push({ source: 'chi', pattern: '123m' }); renderMelds(); countExpected(); save(); };
    $('meldList').addEventListener('click', e => { const i = e.target.dataset.removeMeld; if (i === undefined) return; state.hand.melds.splice(Number(i), 1); renderMelds(); countExpected(); save(); });
    $('meldList').addEventListener('change', e => { const el = e.target; if (el.dataset.meld === undefined) return; state.hand.melds[Number(el.dataset.meld)][el.dataset.part] = el.value; save(); });
    $('signalControls').addEventListener('change', e => { const name = e.target.dataset.signal; if (!name) return; const spec = activeSpecs().find(s => s.name === name); activeValues()[name] = spec.type === 'boolean' ? e.target.checked : spec.type === 'number' ? Number(e.target.value) : e.target.value; save(); });
    $('calculateBtn').onclick = calculate;
    $('exampleBtn').onclick = () => { state.hand = { concealed: '123m123p123s456s5p', winning: '5p', melds: [] }; Object.assign(activeValues(), { riichi: false, doubleRiichi: false, tsumo: false, doraCount: 0, akaCount: 0, uraCount: 0 }); renderHand(); renderSignals(); save(); calculate(); notify('已载入三色同顺示例'); };
    const openSignals = () => { renderSignalInventory(); $('signalDialog').showModal(); };
    $('newSignalBtn').onclick = openSignals; $('signalsManageBtn').onclick = openSignals; $('closeSignalDialog').onclick = () => $('signalDialog').close();
    $('signalForm').addEventListener('submit', e => {
      e.preventDefault(); const fd = new FormData(e.target), name = String(fd.get('name')).trim(), label = String(fd.get('label')).trim(), type = String(fd.get('type')), options = String(fd.get('options')).trim();
      if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name) || !label) { notify('信号名称无效'); return; }
      if (activeSpecs().some(s => s.name === name)) { notify('该信号内部名称已存在'); return; }
      if (type === 'select' && !options.split(',').map(x => x.trim()).filter(Boolean).length) { notify('枚举类型需要至少一个选项'); return; }
      const def = type === 'boolean' ? false : type === 'number' ? 0 : options.split(',')[0].trim();
      activeSpecs().push({ name, label, type, options, default: def }); activeValues()[name] = def; save(); renderSignals(); renderSignalInventory(); e.target.reset(); notify('信号量已添加到当前体系，可用于积木');
    });
    $('signalInventory').onclick = e => { const name = e.target.dataset.deleteSignal; if (!name) return; if (!confirm(`从当前体系删除信号量 ${name}？引用它的积木将不再匹配。`)) return; const rs = activeRuleSet(); rs.signalSpecs = rs.signalSpecs.filter(x => x.name !== name); delete activeValues()[name]; save(); renderSignals(); renderSignalInventory(); notify('信号量已从当前体系删除'); };
    const categoryChanged = () => { L.setCategories(state.categories); save(); displayTree(); };
    $('categoryInventory').addEventListener('change', e => {
      const labelKey = e.target.dataset.catLabel;
      if (labelKey) { const c = state.categories.find(x => x.key === labelKey); if (!c) return; const v = e.target.value.trim(); if (!v) { e.target.value = c.label; notify('显示名称不能为空'); return; } c.label = v; categoryChanged(); notify('类别名称已更新'); return; }
      const tileKey = e.target.dataset.catTiles;
      if (tileKey) { const c = state.categories.find(x => x.key === tileKey); if (!c) return; try { const tiles = E.parseTiles(e.target.value.replace(/[,\s]+/g, '')); if (!tiles.length) throw new Error(); c.tiles = [...new Set(tiles)]; categoryChanged(); e.target.value = E.formatTiles(c.tiles); notify('类别牌张已更新'); } catch { e.target.value = E.formatTiles(Array.isArray(c.tiles) ? c.tiles : []); notify('牌张格式错误'); } }
    });
    $('categoryInventory').addEventListener('click', e => {
      const key = e.target.dataset.deleteCategory; if (!key) return; const c = state.categories.find(x => x.key === key); if (!c) return;
      if (!confirm(`删除类别 ${c.label}（${key}）？引用它的积木将不再匹配。`)) return;
      state.categories = state.categories.filter(x => x.key !== key); categoryChanged(); renderCategoryInventory(); notify('类别已删除');
    });
    $('categoryForm').addEventListener('submit', e => {
      e.preventDefault(); const fd = new FormData(e.target), key = String(fd.get('key')).trim(), label = String(fd.get('label')).trim(), raw = String(fd.get('tiles')).trim();
      if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(key) || key === 'all' || !label) { notify('类别名称无效'); return; }
      if (state.categories.some(c => c.key === key)) { notify('该类别内部名称已存在'); return; }
      try { const tiles = E.parseTiles(raw.replace(/[,\s]+/g, '')); if (!tiles.length) throw new Error(); state.categories.push({ key, label, kind: 'tiles', tiles: [...new Set(tiles)] }); categoryChanged(); renderCategoryInventory(); e.target.reset(); notify('类别已添加'); }
      catch { notify('请填写至少一张有效牌，例如 2s3s4s6s8s6z'); }
    });
    const openCategories = () => { renderCategoryInventory(); $('categoryDialog').showModal(); };
    $('categoryBtn').onclick = openCategories; $('closeCategoryDialog').onclick = () => $('categoryDialog').close();
    $('exportBtn').onclick = () => { const json = JSON.stringify({ ...state, version: 6, languageVersion: 3, exportedAt: new Date().toISOString() }, null, 2); const blob = new Blob([json], { type: 'application/json' }), u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'mahjong-rules.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); notify('存档已导出'); };
    $('omcExportBtn').onclick = () => {
      if (!window.MJOmcPack) return notify('番种包导出模块未加载');
      const rs = activeRuleSet();
      if (!['riichi', 'mcr'].includes(rs.id)) return notify('仅支持立直 / 国标规则体系');
      const custom = state.rules.filter(r => owner(r) === rs.id && (r.builtin === false || String(r.id || '').startsWith('custom_')) && r.enabled !== false);
      if (!custom.length) return notify('当前体系没有已启用的自制番型；请先新建并启用');
      const packId = (rs.id === 'riichi' ? 'riichi_custom' : 'guobiao_custom') + '_' + Date.now().toString(36);
      const author = prompt('作者署名（可留空）', '') || '';
      let pack;
      try {
        pack = MJOmcPack.buildPack({ ruleSet: rs, rules: custom, categories: state.categories, packId, name: `${rs.name} 自制番种`, author, version: '1.0.0' });
      } catch (err) { return notify(`导出失败：${err.message}`); }
      const { errors, warnings } = MJOmcPack.lintDetailed(pack);
      if (warnings.length) console.warn('[OMC pack] warnings', warnings);
      if (errors.length) { console.error('[OMC pack] errors', errors); return notify(`番种包有问题：${errors[0]}（共 ${errors.length} 条，见控制台）`); }
      const json = JSON.stringify(pack, null, 2);
      const blob = new Blob([json], { type: 'application/json' }), u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'omc-yaku-pack.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
      notify(warnings.length ? `已导出 ${custom.length} 条番型（${warnings.length} 条警告，见控制台）` : `已导出 ${custom.length} 条番型`);
    };
    // 载入示例：内容来自 samples.js（../omc-yaku-pack-v1.json 的内联副本）。
    // 每条番型按名字配一副能判中的手牌；包里新增的番型没有手牌时只加番型、不动测试器。
    const SAMPLE_HANDS = {
      '东北新干线': { concealed: '12345678m111z44z', winning: '9m', melds: [], signals: { roundWind: '2z', seatWind: '2z' } },
      '九数贯通': { concealed: '111m234m555p678s9s', winning: '9s', melds: [] },
      '协同和': { concealed: '111p234p333s456s7m', winning: '7m', melds: [] },
      '镜同和': { concealed: '123m456m123p456p5s', winning: '5s', melds: [] },
      '对称和': { concealed: '123p567p234s456s4m', winning: '4m', melds: [] },
    };
    function exampleYaku() {
      const pack = window.MJ_SAMPLE_PACK;
      if (!pack || !Array.isArray(pack.yaku)) return [];
      const packId = pack.meta && pack.meta.packId ? String(pack.meta.packId) : '';
      const prefix = packId ? 'custom.' + packId + '.' : 'custom.';
      // 包里的 id（custom.<packId>.<slug>）→ 工作室规则 id（custom_<slug>）；覆盖目标同样映射，
      // 立直原有番种（riichi.xxx）原样保留。
      const toStudioId = raw => { const value = String(raw || ''); return value.startsWith(prefix) ? 'custom_' + value.slice(prefix.length) : value; };
      return pack.yaku.map(item => {
        const yakuman = Number(item.yakumanLevel || 0);
        return {
          id: toStudioId(item.id),
          name: String(item.name || '未命名'),
          description: String(item.description || ''),
          closedHan: Number(item.closedHan ?? item.points ?? 0),
          openHan: item.openHan === undefined ? null : item.openHan,
          yakuman,
          ast: copy(item.ast || { kind: 'all', children: [] }),
          suppresses: (Array.isArray(item.suppresses) ? item.suppresses : []).map(toStudioId),
          hand: SAMPLE_HANDS[item.name] || null,
        };
      });
    }
    const sampleHanText = s => s.yakuman ? `${s.yakuman} 役满` : (s.openHan === null || s.openHan === undefined || s.openHan === s.closedHan ? `${s.closedHan}番` : `${s.closedHan}/${s.openHan}番`);
    $('briefSampleBtn').onclick = () => {
      if (!BRIEF) return;
      if (state.activeRuleSetId !== 'riichi') return notify('示例是立直番种；先把规则模式切到立直');
      const samples = exampleYaku();
      if (!samples.length) return notify('未找到示例番种包（samples.js）');
      $('sampleList').innerHTML = samples.map(s => `<button type="button" class="sample-item" data-sample="${esc(s.id)}"><span class="sample-text"><span class="sample-name">${esc(s.name)}</span><span class="sample-desc">${esc(s.description)}</span></span><span class="rule-han">${esc(sampleHanText(s))}</span></button>`).join('');
      $('sampleDialog').showModal();
    };
    $('closeSampleDialog').onclick = () => $('sampleDialog').close();
    $('sampleList').onclick = e => {
      const id = e.target.closest('[data-sample]')?.dataset.sample; if (!id) return;
      const sample = exampleYaku().find(s => s.id === id); if (!sample) return;
      const fields = { name: sample.name, category: '自定义', ruleSetId: 'riichi', closedHan: sample.closedHan, openHan: sample.openHan, yakuman: sample.yakuman, enabled: true, ast: sample.ast, suppresses: [...sample.suppresses], description: sample.description, builtin: false };
      const existing = state.rules.find(r => r.id === sample.id);
      if (existing) Object.assign(existing, fields); else state.rules.push({ id: sample.id, ...fields });
      selectedId = sample.id;
      if (sample.hand) state.hand = { concealed: sample.hand.concealed, winning: sample.hand.winning, melds: copy(sample.hand.melds || []) };
      Object.assign(activeValues(), { riichi: false, doubleRiichi: false, tsumo: false, doraCount: 0, akaCount: 0, uraCount: 0, roundWind: '1z', seatWind: '1z' }, (sample.hand && sample.hand.signals) || {});
      $('sampleDialog').close();
      save(); openRule(sample.id); renderHand(); renderSignals(); countExpected(); calculate();
      notify(existing ? `已重新载入示例「${sample.name}」` : `已载入示例「${sample.name}」`);
    };
    $('briefImportBtn').onclick = () => $('briefImportFile').click();
    $('briefImportFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const pack = JSON.parse(await f.text());
        if (!pack || !Array.isArray(pack.yaku)) throw new Error('不是番种包');
        const base = pack.base?.rulesetId === 'guobiao-mahjong' ? 'mcr' : 'riichi';
        if (!state.ruleSets.some(rs => rs.id === base)) throw new Error(`缺少 ${base} 规则集`);
        const mapShape = node => {
          if (!node || typeof node !== 'object') return node;
          const out = copy(node);
          const walk = item => {
            if (item?.kind === 'check' && item.key === 'shape') {
              if (item.value === 'yiban') item.value = 'standard';
              else if (item.value === 'qidui') item.value = 'chiitoi';
              else if (item.value === 'shisanyao') item.value = 'kokushi';
            }
            if (Array.isArray(item?.children)) item.children.forEach(walk);
          };
          walk(out); return out;
        };
        const importedIds = new Map(pack.yaku.map((item, index) => [item.id, 'custom_' + Date.now().toString(36) + '_' + index]));
        const imported = pack.yaku.map((item, index) => {
          const ast = mapShape(item.ast || { kind: 'all', children: [] });
          const closedHan = Number(item.closedHan ?? item.points ?? 1);
          return {
            id: importedIds.get(item.id),
            name: item.name || `导入番种${index + 1}`,
            category: '自定义',
            ruleSetId: base,
            closedHan,
            openHan: item.openHan === undefined ? (item.category === 'yakuman' ? null : closedHan) : item.openHan,
            yakuman: Number(item.yakumanLevel ?? 0),
            enabled: true,
            ast: ['all', 'any', 'not'].includes(ast.kind) ? ast : { kind: 'all', children: [ast] },
            suppresses: (Array.isArray(item.suppresses) ? item.suppresses : []).map(id => importedIds.get(id) || MJOmcPack.studioSuppress(base === 'mcr' ? 'guobiao-mahjong' : 'riichi-mahjong', id)),
            description: item.description || '',
            builtin: false,
          };
        });
        if (!imported.length) throw new Error('包里没有番种');
        state.rules.push(...imported);
        state.activeRuleSetId = base;
        selectedId = imported[0].id;
        const example = (pack.yaku[0].examples || []).find(x => x && x.expect === true) || (pack.yaku[0].examples || [])[0];
        if (example) {
          state.hand = { concealed: example.concealed || '', winning: example.winning || '', melds: Array.isArray(example.melds) ? example.melds : [] };
          if (example.signals && typeof example.signals === 'object') Object.assign(activeValues(), example.signals);
        }
        save(); renderRuleSetChoices(); displayRules(); openRule(selectedId); renderHand(); renderSignals(); countExpected();
        notify(`已导入 ${imported.length} 条番种`);
      } catch (err) { notify(`导入失败：${err.message}`); }
      e.target.value = '';
    };
    $('importBtn').onclick = () => $('importFile').click();
    $('importFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const parsed = JSON.parse(await f.text()); if (Array.isArray(parsed?.yaku) && !Array.isArray(parsed?.rules)) { notify('这是番种包，不是工作室存档；请到简版编辑器导入'); e.target.value = ''; return; } state = upgrade(parsed); L.setCategories(state.categories); selectedId = state.rules.find(r => owner(r) === state.activeRuleSetId)?.id; save(); renderRuleSetChoices(); if (selectedId) openRule(selectedId); renderHand(); renderSignals(); palette(); notify('存档导入成功'); } catch (err) { notify(`导入失败：${err.message}`); } e.target.value = ''; };
    $('resetBtn').onclick = () => { if (!confirm('恢复全部预设将清除本地修改、自定义番型及信号量。请先导出备份。确定继续？')) return; state = base(); L.setCategories(state.categories); save(); openRule(state.rules[0].id); renderHand(); renderSignals(); notify('已恢复预设'); };
  }
  function applyBriefUI() {
    if (!BRIEF) return;
    document.body.classList.add('brief-mode');
    const hide = id => { const el = $(id); if (el) el.style.display = 'none'; };
    hide('manageRuleSetsBtn'); hide('exportBtn'); hide('importBtn'); hide('resetBtn'); hide('newSignalBtn'); hide('exampleBtn');
    const newRule = $('newRuleBtn'); if (newRule) newRule.textContent = '＋ 新番种';
    const brandStrong = document.querySelector('.brand strong'); if (brandStrong) brandStrong.textContent = '番种简报';
    const brandSub = document.querySelector('.brand span'); if (brandSub) brandSub.textContent = '只加番种';
    const switchLabel = document.querySelector('.ruleset-switch span'); if (switchLabel) switchLabel.textContent = '规则模式';
    const tag = document.querySelector('.small-tag'); if (tag) tag.style.display = 'none';
    const ruleRuleset = $('ruleRuleset'); if (ruleRuleset) ruleRuleset.disabled = true;
    const sample = $('briefSampleBtn'); if (sample) sample.style.display = BRIEF_BASE === 'riichi' ? '' : 'none';
    const briefImport = $('briefImportBtn'); if (briefImport) briefImport.style.display = '';
    const library = document.querySelector('.library'), topActions = document.querySelector('.top-actions');
    if (library && topActions) {
      const actions = document.createElement('div'); actions.className = 'brief-actions';
      while (topActions.firstChild) actions.appendChild(topActions.firstChild);
      library.appendChild(actions);
    }
    const tester = document.querySelector('.tester'), intro = document.querySelector('.builder-intro'), paletteHost = $('palette'), exprHost = $('exprPalette');
    if (tester && intro && paletteHost && exprHost) {
      const dock = document.createElement('section'); dock.className = 'palette-dock';
      dock.append(intro, paletteHost, exprHost);
      tester.insertBefore(dock, tester.firstChild);
    }
  }
  function init() { applyBriefUI(); installTileSystemEditor(); palette(); renderExprPalette(); renderTiles(); renderHand(); renderSignals(); bindEvents(); renderRuleSetChoices(); if (selectedId) openRule(selectedId); else displayRules(); }
  init();
})();

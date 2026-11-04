const assert = require('node:assert/strict');
require('./language.js');
require('./rules.js');
const packer = require('./omc-pack.js');
const stream = { kind: 'check', key: 'signal', name: 'tsumo', value: true };
const make = (id, suppresses = [], ast = stream) => ({ id, name: id, closedHan: 1, openHan: 1, suppresses, ast });

const pack = packer.buildPack({ ruleSet: { id: 'riichi' }, packId: 'test', rules: [make('custom_a', ['honitsu', 'custom_b']), make('custom_b')] });
assert.deepEqual(pack.yaku[0].suppresses, ['riichi.honitsu', pack.yaku[1].id]);
assert.deepEqual(packer.lint(pack), []);

// 覆盖目标没随包导出（没载入 / 没启用）：跳过它，而不是阻断导出。
// 游戏侧只接受引用包内番种或立直原有番种的包，所以这种目标本来就该丢。
const alone = packer.buildPack({ ruleSet: { id: 'riichi' }, packId: 'test', rules: [make('custom_a', ['honitsu', 'custom_sample_missing'])] });
assert.deepEqual(alone.yaku[0].suppresses, ['riichi.honitsu']);
assert.deepEqual(packer.lint(alone), []);

// 真正的拼写错误仍然报错
assert.throws(() => packer.buildPack({ ruleSet: { id: 'riichi' }, packId: 'test', rules: [make('custom_a', ['honitsu_typo'])] }), /覆盖目标不可导出/);

const semantics = (ast) => packer.lintSemantics(packer.buildPack({ ruleSet: { id: 'riichi' }, packId: 'demo', rules: [make('custom_x', [], ast)] }));

// 面子属性 honor 用在面子对象上：面子没有 honor
const badPath = semantics({ kind: 'all', children: [{ kind: 'quantifier', source: 'groups', variable: 'g', mode: 'some', children: [{ kind: 'compare', left: 'g.honor', op: 'eq', right: 'true' }] }] });
assert.ok(badPath.errors.some((message) => /honor/.test(message) && /面子/.test(message)), '应报出 g.honor 不适用于面子');

// 数值公式收到文本参数
const badArgs = semantics({ kind: 'compare', left: 'mul(2,"sequence")', op: 'eq', right: '3' });
assert.ok(badArgs.errors.some((message) => /mul/.test(message)), '应报出 mul 参数不是数字');

// 比较两侧类型不一致：面子类型 = 数字
const badCompare = semantics({ kind: 'all', children: [{ kind: 'quantifier', source: 'groups', variable: 'g', mode: 'some', children: [{ kind: 'compare', left: 'g.type', op: 'eq', right: '3' }] }] });
assert.ok(badCompare.errors.some((message) => /类型不一致/.test(message)), '应报出 g.type 与数字比较');

// 覆盖目标不在立直番种表里
const badSuppress = packer.lintSemantics({ base: { rulesetId: 'riichi-mahjong' }, yaku: [{ name: 'x', ast: stream, suppresses: ['riichi.doesNotExist'] }] });
assert.ok(badSuppress.errors.some((message) => /不在立直番种表内/.test(message)), '应报出未知立直番种');

// 正常写法不误报：g.center 是数字、g.0.rank 是牌上的序数、p.0.0.center 是分区里第一个面子的中心数
const good = semantics({ kind: 'all', children: [
  { kind: 'quantifier', source: 'groups', variable: 'g', mode: 'some', children: [
    { kind: 'compare', left: 'g.center', op: 'eq', right: '3' },
    { kind: 'compare', left: 'g.0.rank', op: 'gte', right: '2' },
  ] },
  { kind: 'quantifier', source: 'groupPartitions', variable: 'p', mode: 'some', children: [
    { kind: 'compare', left: 'add(p.0.0.center,p.0.1.center)', op: 'eq', right: 'mul(2,pair.rank)' },
    { kind: 'compare', left: 'p.0.0.suit', op: 'eq', right: 'p.0.1.suit' },
  ] },
] });
assert.deepEqual(good.errors, []);

console.log('番种包映射、覆盖跳过与语义检查通过');

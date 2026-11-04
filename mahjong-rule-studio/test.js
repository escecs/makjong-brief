/* Run: node test.js */
const assert=require('node:assert/strict');
const L=require('./language.js');
const E=require('./engine.js');
const R=require('./rules.js');
require('./mcr-rules.js');
require('./ruleset-model.js');
const base=()=>Object.fromEntries(R.signals.map(s=>[s.name,s.default]));
const mcrRules=()=>R.rules.filter(r=>r.ruleset==='mcr');
const riichiRules=()=>R.rules.filter(r=>(r.ruleset||'riichi')==='riichi');
function inspect(concealed,winning,updates={},melds=[],rules=riichiRules()){
  return E.analyze({concealed,winning,melds},rules,{...base(),...updates});
}
function includes(result,id){return result.hits?.some(y=>y.id===id)}
function run(name,func){try{func();console.log('PASS',name);}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1;}}
run('能解析多种花色压缩记法',()=>assert.deepEqual(E.parseTiles('123m44p7z'),['1m','2m','3m','4p','4p','7z']));
run('三色同顺正常判定',()=>{
 const v=inspect('123m123p123s456s5p','5p');assert.equal(v.complete,true);assert.ok(includes(v,'sanshoku'));assert.equal(v.han,2);
});
run('平和与两面听',()=>{
 const v=inspect('123m456m345p67s55p','8s');assert.ok(includes(v,'pinfu'));assert.equal(v.variant.wait,'ryanmen');
});
run('九数贯通：每组数字不重复时成立',()=>{
 const v=inspect('111m234m555p678s9s','9s');assert.ok(includes(v,'nineNumbers'));
});
run('九数贯通：数字跨面子重复时不成立',()=>{
 const v=inspect('111m234m345p678s9s','9s');assert.ok(!includes(v,'nineNumbers'));
});
run('九数贯通：缺数字时不成立',()=>{
 const v=inspect('111m234m555p678s8s','8s');assert.ok(!includes(v,'nineNumbers'));
});
run('九数贯通：雀头与面子重号时不成立',()=>{
 const v=inspect('111m234m555p789s9s','9s');assert.ok(!includes(v,'nineNumbers'));
});
run('聚五数：12345 覆盖',()=>{
 const v=inspect('123m234m345m555m1m','1m');assert.ok(includes(v,'gatherFive'));
});
run('聚四数覆盖聚五数',()=>{
 const v=inspect('123m123m234m444m1m','1m');assert.ok(includes(v,'gatherFour'));assert.ok(!includes(v,'gatherFive'));
});
run('间五数：13579 覆盖',()=>{
 const v=inspect('111m333m555m777m9m','9m',{},[],riichiRules().filter(r=>r.id==='gapFive'));assert.ok(includes(v,'gapFive'));
});
run('类别名词：自定义类别同时驱动表达式与条件节点',()=>{
 try{
  L.setCategories([{key:'red',label:'红牌',kind:'tiles',tiles:['5z']}]);
  assert.equal(L.category('5z','red'),true);
  assert.equal(L.category('6z','red'),false);
  assert.equal(E.tileCategory('5z','red',{}),true);
  assert.equal(E.tileCategory('6z','red',{}),false);
 }finally{L.setCategories(null);}
});
run('一气通贯：123/456/789 成立',()=>{
 const v=inspect('123m456m789m111z2z','2z');assert.ok(includes(v,'ittsu'));
});
run('一气通贯：123/345/789 不成立',()=>{
 const v=inspect('123m345m789m111z2z','2z');assert.ok(!includes(v,'ittsu'));
});
run('立直+自摸+宝牌',()=>{
 const v=inspect('123m456m345p67s55p','8s',{riichi:true,tsumo:true,doraCount:2});assert.ok(includes(v,'riichi'));assert.ok(includes(v,'tsumo'));assert.equal(v.bonus,2);
});
run('两立直覆盖普通立直',()=>{
 const v=inspect('123m456m345p67s55p','8s',{riichi:true,doubleRiichi:true});assert.ok(includes(v,'doubleRiichi'));assert.ok(!includes(v,'riichi'));
});
run('七对子是独立分解',()=>{
 const v=inspect('1122m3344p5566s7z','7z');assert.equal(v.complete,true);assert.ok(includes(v,'chiitoi'));
});
run('国士无双判定',()=>{
 const v=inspect('19m19p19s1234567z','1m');assert.ok(includes(v,'kokushi'));assert.equal(v.yakuman,1);
});
run('九莲宝灯判定',()=>{
 const v=inspect('1112345678999m','5m');assert.ok(includes(v,'chuuren'));assert.equal(v.yakuman,1);assert.equal(v.variant.shape,'standard');
});
run('协同和示例：两个序数差相等',()=>{
 const rules=R.rules.map(r=>({...r,enabled:r.id==='cooperative'}));const v=inspect('111p234p333s456s7m','7m',{},[],rules);
 assert.equal(v.complete,true);assert.ok(includes(v,'cooperative'));
});
run('镜同和覆盖协同和',()=>{
 const rules=R.rules.map(r=>({...r,enabled:['cooperative','mirrorEqual'].includes(r.id)}));const v=inspect('123m456m123p456p5s','5s',{},[],rules);
 assert.ok(includes(v,'mirrorEqual'));assert.ok(!includes(v,'cooperative'));assert.equal(v.han,3);
});
run('对称和：围绕雀头镜像',()=>{
 const rules=R.rules.map(r=>({...r,enabled:r.id==='symmetric'}));const v=inspect('123p567p234s456s4m','4m',{},[],rules);
 assert.ok(includes(v,'symmetric'));assert.equal(v.han,3);
});
run('副露吃牌计数和门清限定',()=>{
 const v=inspect('123p123s456s5p','5p',{},[{source:'chi',pattern:'123m'}]);
 assert.equal(v.complete,true);assert.equal(v.data.closed,false);assert.ok(includes(v,'sanshoku'));assert.equal(v.han,1);
});
run('不合法的第五张同牌会拒绝',()=>{
 assert.throws(()=>inspect('1111m234p456p789s','1m'),/超过/);
});
run('自定义信号的比较',()=>{
 const context=inspect('123m123p123s456s5p','5p',{customNumber:3},[],[{id:'custom',name:'自定义',enabled:true,closedHan:4,openHan:4,yakuman:0,ast:{kind:'check',key:'signal',name:'customNumber',op:'gte',value:2}}]);
 assert.ok(includes(context,'custom'));assert.equal(context.han,4);
});
run('通用量词：三元面子组合可表达三色同顺',()=>{
 const ast={kind:'quantifier',source:'groupTriples',variable:'g',mode:'some',children:[
  {kind:'compare',left:'same(g.0.type,g.1.type,g.2.type)',op:'eq',right:'true'},
  {kind:'compare',left:'g.0.type',op:'eq',right:'"sequence"'},
  {kind:'compare',left:'same(g.0.center,g.1.center,g.2.center)',op:'eq',right:'true'},
  {kind:'compare',left:'unique(g.0.suit,g.1.suit,g.2.suit)',op:'eq',right:'3'}
 ]};
 const v=inspect('123m123p123s456s5p','5p',{},[],[{id:'dsl',name:'DSL',enabled:true,closedHan:2,openHan:1,yakuman:0,ast}]);
 assert.ok(includes(v,'dsl'));
});
run('通用量词：两两划分与算术可表达等距关系',()=>{
 const ast={kind:'quantifier',source:'groupPartitions',variable:'p',mode:'some',children:[
  {kind:'compare',left:'p.0.0.suit',op:'eq',right:'p.0.1.suit'},
  {kind:'compare',left:'p.1.0.suit',op:'eq',right:'p.1.1.suit'},
  {kind:'compare',left:'absdiff(p.0.0.center,p.0.1.center)',op:'eq',right:'absdiff(p.1.0.center,p.1.1.center)'}
 ]};
 const v=inspect('111p234p333s456s7m','7m',{},[],[{id:'dsl',name:'DSL',enabled:true,closedHan:1,openHan:1,yakuman:0,ast}]);
 assert.ok(includes(v,'dsl'));
});
run('通用量词：全部与计数模式可嵌套旧条件',()=>{
 const ast={kind:'all',children:[
  {kind:'quantifier',source:'groups',variable:'g',mode:'every',children:[{kind:'compare',left:'g.concealed',op:'eq',right:'true'}]},
  {kind:'quantifier',source:'groups',variable:'g',mode:'count',op:'gte',value:4,children:[{kind:'compare',left:'g.tileCount',op:'gte',right:'3'}]}
 ]};
 const v=inspect('123m123p123s456s5p','5p',{},[],[{id:'dsl',name:'DSL',enabled:true,closedHan:1,openHan:1,yakuman:0,ast}]);
 assert.ok(includes(v,'dsl'));
});
run('国标：一色双龙会由四元组合和属性比较识别',()=>{
 const v=inspect('1122337788995m','5m',{},[],mcrRules());assert.ok(includes(v,'mcr_pure_terminal_chows'));
});
run('国标：一色四节高',()=>{
 const v=inspect('111222333444m5p','5p',{},[],mcrRules());assert.ok(includes(v,'mcr_four_pure_shifted_pungs'));
});
run('国标：三色三步高',()=>{
 const v=inspect('123m777m234p9p345s','9p',{},[],mcrRules());assert.ok(includes(v,'mcr_mixed_shifted_chows'));
});
run('国标：全大',()=>{
 const v=inspect('777m789m888p9p999s','9p',{},[],mcrRules());assert.ok(includes(v,'mcr_all_big'));
});
run('国标：花龙',()=>{
 const v=inspect('123m456p789s111z2z','2z',{},[],mcrRules());assert.ok(includes(v,'mcr_mixed_straight'));
});
run('国标：花龙不误判 123/567/789',()=>{
 const v=inspect('123m567p789s111z2z','2z',{},[],mcrRules());assert.ok(!includes(v,'mcr_mixed_straight'));
});
run('国标：清龙 123/456/789',()=>{
 const v=inspect('123m456m789m111z2z','2z',{},[],mcrRules());assert.ok(includes(v,'mcr_pure_straight'));
});
run('国标：清龙不误判 123/345/789',()=>{
 const v=inspect('123m345m789m111z2z','2z',{},[],mcrRules());assert.ok(!includes(v,'mcr_pure_straight'));
});
run('国标：全带五使用面子局部牌集合',()=>{
 const v=inspect('345m5m456p555s567s','5m',{},[],mcrRules());assert.ok(includes(v,'mcr_all_fives'));
});
run('所有内置番型的根节点都是逻辑容器',()=>{
 for(const rule of R.rules)assert.ok(['all','any','not'].includes(rule.ast.kind),rule.id);
});
run('量词积木拆分为存在/全部/不存在/匹配数量',()=>{
 const modes=Object.values(R.blockDefs).filter(def=>def.kind==='quantifier').map(def=>def.defaults.mode).sort();
 assert.deepEqual(modes,['count','every','none','some']);
});
run('表达式积木：解析与还原',()=>{
 const samples=['g.type','g.0.type','g1.0.type','面子.0.type','g.0','g.0.center','pair.suit','t','tiles','tileKinds.0.suit','signals.roundWind','p.0.0.suit','category(t,"winds")','unique(g.0.suit,g.1.suit,g.2.suit)','add(g.0.center,g.1.center,g.2.center,g.3.center)','arithmeticStep(values(tileKinds,"rank"))','select(tiles,"suit","ne","z")','same(g.0.suit,g.1.suit)','"sequence"','"m"','true','false','5'];
 for(const source of samples)assert.equal(L.expressionString(L.parseExpression(source)),source);
});
run('表达式积木：内置比较式都能结构化',()=>{
 const visit=node=>{
  if(!node)return;
  if(node.kind==='compare'){L.parseExpression(node.left);L.parseExpression(node.right);}
  for(const child of node.children||[])visit(child);
 };
 for(const rule of R.rules)visit(rule.ast);
});
run('表达式积木：无法解析时抛错',()=>{assert.throws(()=>L.parseExpression('g..type'));});
run('绑定变量：改名会同步改写引用',()=>{
 assert.equal(L.renameVariable('g.0.type','g','g1'),'g1.0.type');
 assert.equal(L.renameVariable('category(g.0,"winds")','g','g1'),'category(g1.0,"winds")');
 assert.equal(L.renameVariable('g.tiles','g','g1'),'g1.tiles');
 assert.equal(L.renameVariable('g1.0.type','g','g2'),'g1.0.type');
 assert.equal(L.renameVariable('pair.suit','g','g1'),'pair.suit');
 assert.equal(L.renameVariable('"g"','g','g1'),'"g"');
 assert.equal(L.renameVariable('g..bad','g','g1'),'g..bad');
 assert.equal(L.renameVariable('面子分组1.0.type','面子分组1','面子分组2'),'面子分组2.0.type');
});
run('公式积木：每个公式都有中文版式',()=>{
 for(const f of R.expressionSpec.functions){
  assert.ok(Array.isArray(f.layout)&&f.layout.length,f.name+' 缺少 layout');
  const joined=f.layout.some(part=>part.join!==undefined);
  const refs=f.layout.filter(part=>part.arg!==undefined).map(part=>part.arg);
  for(const index of refs)assert.ok(Number.isInteger(index)&&index>=0&&index<f.max,f.name+' 的参数下标越界');
  if(!joined){
   assert.equal(new Set(refs).size,refs.length,f.name+' 重复引用参数');
   assert.deepEqual([...refs].sort((a,b)=>a-b),Array.from({length:f.min},(_,i)=>i),f.name+' 的参数与 min 不一致');
  }
 }
});
run('公式积木：内置表达式只使用已定义的公式',()=>{
 const known=new Set(R.expressionSpec.functions.map(f=>f.name));
 const walk=node=>{
  if(!node)return;
  if(node.type==='call'){assert.ok(known.has(node.name),'未定义的公式 '+node.name);node.args.forEach(walk);}
 };
 const visit=node=>{
  if(!node)return;
  if(node.kind==='compare'){walk(L.parseExpression(node.left));walk(L.parseExpression(node.right));}
  for(const child of node.children||[])visit(child);
 };
 for(const rule of R.rules)visit(rule.ast);
});
run('国标分组：每个分组只出现一次并按分值降序',()=>{
 const groups=R.groupRules(R.rules,'mcr');
 assert.deepEqual(groups,['88分','64分','48分','32分','24分','16分','12分','8分','6分','4分','2分','1分']);
 assert.equal(groups.filter(g=>g==='2分').length,1);
 assert.equal(groups.filter(g=>g==='1分').length,1);
});
run('国标分组：覆盖全部国标番种的分组',()=>{
 const categories=[...new Set(R.rules.filter(r=>r.ruleset==='mcr').map(r=>r.category))];
 assert.deepEqual(new Set(R.groupRules(R.rules,'mcr')),new Set(categories));
});
run('立直分组：固定顺序且不重复',()=>{
 const groups=R.groupRules(R.rules,'riichi');
 assert.equal(new Set(groups).size,groups.length);
 assert.equal(groups[0],'一番');
});
run('国标：五门齐',()=>{
 const v=inspect('123m456p789s111z5z','5z',{},[],mcrRules());assert.ok(includes(v,'mcr_all_types'));
});
run('国标：重复计分番种按匹配次数计',()=>{
 const v=inspect('555z666z123m456p1z','1z',{},[],mcrRules());
 const hit=v.hits.find(r=>r.id==='mcr_dragon_pung');
 assert.ok(hit);assert.equal(hit.awarded,4);
});
run('结算：国标放铳与自摸支付',()=>{
 const rs=R.defaultRuleSets.find(x=>x.id==='mcr');
 const sig=Object.fromEntries(rs.signalSpecs.map(s=>[s.name,s.default]));
 const hand={concealed:'123m123p123s456s5p',winning:'5p',melds:[]};
 const rules=R.rules.filter(r=>r.ruleset==='mcr');
 const ron=E.analyze(hand,rules,sig,rs);
 assert.equal(ron.settlement.ron,ron.han+8);
 assert.equal(ron.settlement.ronOther,8);
 assert.equal(ron.settlement.winner,ron.han+24);
 sig.tsumo=true;
 const tsumo=E.analyze(hand,rules,sig,rs);
 assert.equal(tsumo.settlement.tsumoDealerWin,tsumo.han+8);
 assert.equal(tsumo.settlement.winner,(tsumo.han+8)*3);
});
run('结算：立直符数与点数',()=>{
 const rs=R.defaultRuleSets.find(x=>x.id==='riichi');
 const sig=Object.fromEntries(rs.signalSpecs.map(s=>[s.name,s.default]));
 const hand={concealed:'123m456m345p67s55p',winning:'8s',melds:[]};
 const rules=R.rules.filter(r=>r.ruleset==='riichi');
 const ron=E.analyze(hand,rules,sig,rs);
 assert.equal(ron.fu,30);
 assert.equal(ron.settlement.winner,1000);
 sig.tsumo=true;
 const tsumo=E.analyze(hand,rules,sig,rs);
 assert.equal(tsumo.fu,20);
 assert.equal(tsumo.settlement.winner,1500);
});
run('国标：十三幺默认启用，七星不靠保留24分但共用全不靠结构',()=>{
 const rs=R.defaultRuleSets.find(x=>x.id==='mcr');
 assert.ok(rs.winStructures.find(s=>s.id==='kokushi')?.enabled);
 assert.ok(R.rules.some(r=>r.id==='mcr_greater_honors_knitted'));
 const v=inspect('1234567z147m258p','3s',{},[],mcrRules());
 assert.equal(v.variant.shape,'lesserKnitted');
 assert.ok(includes(v,'mcr_greater_honors_knitted'));
 assert.ok(!includes(v,'mcr_lesser_honors_knitted'));
 const ordinary=inspect('147m258p369s1234z','5z',{},[],mcrRules());
 assert.equal(ordinary.variant.shape,'lesserKnitted');
 assert.ok(includes(ordinary,'mcr_lesser_honors_knitted'));
 assert.ok(!includes(ordinary,'mcr_greater_honors_knitted'));
});

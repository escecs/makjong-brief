/* Editable rule data. Built-ins are composed from small facts, quantifiers and comparisons. */
(function(root){
 'use strict';
 const C=(key,value,op='eq',extra={})=>({kind:'check',key,value,op,...extra});
 const ALL=(...children)=>({kind:'all',children});
 const ANY=(...children)=>({kind:'any',children});
 const Q=(source,variable,...children)=>({kind:'quantifier',source,variable,mode:'some',children});
 const EVERY=(source,variable,...children)=>({kind:'quantifier',source,variable,mode:'every',children});
 const COUNT=(source,variable,op,value,...children)=>({kind:'quantifier',source,variable,mode:'count',op,value,children});
 const NONE=(source,variable,...children)=>({kind:'quantifier',source,variable,mode:'none',children});
 const X=(left,op,right)=>({kind:'compare',left,op,right});
 const E={closed:()=>C('closed',true),signal:(name,value=true)=>C('signal',value,'eq',{name}),shape:name=>C('shape',name),in:cat=>C('tilesIn',cat),contains:cat=>C('contains',cat),suit:(op,n)=>C('suitCount',n,op),meld:(filter,op,n)=>C('meldCount',n,op,{filter}),pair:cat=>C('pairIn',cat),wait:type=>C('wait',type),has:(key,val=true)=>C(key,val)};
 const ruleSets={riichi:{id:'riichi',name:'立直麻将',unit:'番'},mcr:{id:'mcr',name:'国标麻将',unit:'分'},taiwan:{id:'taiwan',name:'港式台湾麻将',unit:'台'}};
 const list=[];
 const add=(id,name,category,han,openHan,ast,opts={})=>list.push({id,name,category,closedHan:han,openHan,ast,ruleset:opts.ruleset||'riichi',yakuman:opts.yakuman||0,suppresses:opts.suppresses||[],enabled:opts.enabled!==false,description:opts.description||'',builtin:true});
 const seq=(v,i)=>X(`${v}.${i}.type`,'eq','"sequence"');
 const trip=(v,i)=>X(`${v}.${i}.family`,'eq','"tripletLike"');

 add('riichi','立直','一番',1,null,ALL(E.closed(),E.signal('riichi')));
 add('ippatsu','一发','一番',1,null,ALL(E.closed(),ANY(E.signal('riichi'),E.signal('doubleRiichi')),E.signal('ippatsu')));
 add('tsumo','门前清自摸和','一番',1,null,ALL(E.closed(),E.signal('tsumo')));
 add('pinfu','平和','一番',1,null,ALL(E.shape('standard'),E.closed(),COUNT('groups','g','eq',4,X('g.type','eq','"sequence"')),E.pair('nonValue'),E.wait('ryanmen')));
 add('tanyao','断幺九','一番',1,1,EVERY('tiles','t',X('category(t,"simples")','eq','true')));
 add('iipeikou','一杯口','一番',1,null,ALL(E.shape('standard'),E.closed(),Q('groupPairs','g',seq('g',0),seq('g',1),X('g.0.suit','eq','g.1.suit'),X('g.0.center','eq','g.1.center'))));
 for(const [id,name,tile] of [['haku','役牌·白','5z'],['hatsu','役牌·发','6z'],['chun','役牌·中','7z']])add(id,name,'一番',1,1,Q('groups','g',X('g.family','eq','"tripletLike"'),X('g.0','eq',`"${tile}"`)));
 add('seat','役牌·自风','一番',1,1,Q('groups','g',X('g.family','eq','"tripletLike"'),X('g.0','eq','signals.seatWind')));
 add('round','役牌·场风','一番',1,1,Q('groups','g',X('g.family','eq','"tripletLike"'),X('g.0','eq','signals.roundWind')));
 add('rinshan','岭上开花','一番',1,1,ALL(E.signal('tsumo'),E.signal('rinshan')));
 add('chankan','抢杠','一番',1,1,ALL(E.signal('tsumo',false),E.signal('chankan')));
 add('haitei','海底摸月','一番',1,1,ALL(E.signal('tsumo'),E.signal('haitei')));
 add('houtei','河底捞鱼','一番',1,1,ALL(E.signal('tsumo',false),E.signal('houtei')));
 add('doubleRiichi','两立直','二番',2,null,ALL(E.closed(),E.signal('doubleRiichi')),{suppresses:['riichi']});
 add('chiitoi','七对子','二番',2,null,ALL(E.closed(),E.shape('chiitoi')));
 add('sanshoku','三色同顺','二番',2,1,ALL(E.shape('standard'),Q('groupTriples','g',seq('g',0),seq('g',1),seq('g',2),X('same(g.0.center,g.1.center,g.2.center)','eq','true'),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'))));
 add('ittsu','一气通贯','二番',2,1,ALL(E.shape('standard'),Q('groupTriples','g',seq('g',0),seq('g',1),seq('g',2),X('same(g.0.suit,g.1.suit,g.2.suit)','eq','true'),X('unique(g.0.center,g.1.center,g.2.center)','eq','3'),X('min(g.0.center,g.1.center,g.2.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center)','eq','8'),X('arithmeticStep(g.0.center,g.1.center,g.2.center)','eq','3'))));
 add('chanta','混全带幺九','二番',2,1,ALL(E.shape('standard'),X('category(pair,"yaochu")','eq','true'),EVERY('groups','g',Q('g.tiles','t',X('category(t,"yaochu")','eq','true'))),Q('groups','g',X('g.type','eq','"sequence"'))));
 add('toitoi','对对和','二番',2,2,ALL(E.shape('standard'),EVERY('groups','g',X('g.family','eq','"tripletLike"'))));
 add('sanankou','三暗刻','二番',2,2,ALL(E.shape('standard'),E.meld('concealedTriplet','gte',3)));
 add('sanshokuDoukou','三色同刻','二番',2,2,ALL(E.shape('standard'),Q('groupTriples','g',trip('g',0),trip('g',1),trip('g',2),X('same(g.0.center,g.1.center,g.2.center)','eq','true'),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'))));
 add('sankantsu','三杠子','二番',2,2,COUNT('groups','g','eq',3,X('g.type','eq','"quad"')));
 add('shousangen','小三元','二番',2,2,ALL(E.shape('standard'),X('category(pair,"dragons")','eq','true'),COUNT('groups','g','eq',2,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true'))));
 add('honroutou','混老头','二番',2,2,EVERY('tiles','t',X('category(t,"yaochu")','eq','true')));
 add('ryanpeikou','二杯口','三番',3,null,ALL(E.shape('standard'),E.closed(),Q('groupPartitions','p',seq('p.0',0),seq('p.0',1),seq('p.1',0),seq('p.1',1),X('p.0.0.suit','eq','p.0.1.suit'),X('p.0.0.center','eq','p.0.1.center'),X('p.1.0.suit','eq','p.1.1.suit'),X('p.1.0.center','eq','p.1.1.center'))),{suppresses:['iipeikou']});
 add('junchan','纯全带幺九','三番',3,2,ALL(E.shape('standard'),X('category(pair,"terminals")','eq','true'),EVERY('groups','g',Q('g.tiles','t',X('category(t,"terminals")','eq','true'))),Q('groups','g',X('g.type','eq','"sequence"'))),{suppresses:['chanta']});
 add('honitsu','混一色','三番',3,2,ALL(E.suit('eq',1),E.contains('honors')));
 add('chinitsu','清一色','六番',6,5,ALL(E.suit('eq',1),EVERY('tiles','t',X('t.suit','ne','"z"'))),{suppresses:['honitsu']});
 const nineNumbers=ALL(
  E.shape('standard'),
  NONE('tiles','t',X('t.suit','eq','"z"')),
  NONE('groups','g',Q('g.tiles','t',X('t.rank','eq','pair.rank'))),
  ...Array.from({length:9},(_,i)=>{const r=String(i+1);return Q('tiles','t',X('t.rank','eq',r));}),
  ...Array.from({length:9},(_,i)=>{const r=String(i+1);return COUNT('groups','g','lte',1,Q('g.tiles','t',X('t.rank','eq',r)));})
 );
 add('nineNumbers','九数贯通','原创示例',6,6,nineNumbers,{description:'四面子一雀头，无字牌；1～9 每个数字恰好出现在一个面子或雀头中。'});
 const rankCover=ranks=>EVERY('tiles','t',ANY(...ranks.map(r=>X('t.rank','eq',String(r)))));
 const anyRankCover=sets=>ANY(...sets.map(rankCover));
 const noHonors=()=>NONE('tiles','t',X('t.suit','eq','"z"'));
 const windows=size=>Array.from({length:10-size},(_,i)=>Array.from({length:size},(_,j)=>i+j+1));
 const rankPairs=[];for(let a=1;a<=9;a++)for(let b=a+1;b<=9;b++)rankPairs.push([a,b]);
 add('gatherFive','聚五数','原创示例',1,1,ALL(noHonors(),anyRankCover(windows(5))),{description:'无字牌，所用数字都能被 12345～56789 之一覆盖。'});
 add('gatherFour','聚四数','原创示例',4,4,ALL(noHonors(),anyRankCover(windows(4))),{description:'无字牌，所用数字都能被 1234～6789 之一覆盖。'});
 add('gatherThree','聚三数','原创示例',7,7,ALL(noHonors(),anyRankCover(windows(3))),{description:'无字牌，所用数字都能被 123～789 之一覆盖。'});
 add('gapFive','间五数','原创示例',4,4,ALL(noHonors(),anyRankCover([[1,3,5,7,9]])),{description:'无字牌，所用数字都在 13579 内。'});
 add('gapFour','间四数','原创示例',6,6,ALL(noHonors(),anyRankCover([[1,3,5,7],[2,4,6,8],[3,5,7,9]])),{description:'无字牌，所用数字都在 1357 / 2468 / 3579 之一内。'});
 add('gapThree','间三数','原创示例',8,8,ALL(noHonors(),anyRankCover([[1,3,5],[2,4,6],[3,5,7],[4,6,8],[5,7,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9]])),{description:'无字牌，所用数字都在 135 / 246 / … / 159 之一内。'});
 add('twoRanks','两数','原创示例',10,10,ALL(noHonors(),anyRankCover(rankPairs)),{description:'无字牌，所用数字都能被任意两个数字覆盖。'});
 const originalPatterns=['gatherFive','gatherFour','gatherThree','gapFive','gapFour','gapThree','twoRanks'];
 const originalRules=list.filter(r=>originalPatterns.includes(r.id));
 for(const r of originalRules)r.suppresses=originalRules.filter(o=>o.closedHan<r.closedHan).map(o=>o.id);
 const y=(id,name,ast,opts={})=>add(id,name,'役满',0,null,ast,{...opts,yakuman:opts.yakuman||1});
 y('kokushi','国士无双',ALL(E.closed(),E.shape('kokushi')));
 y('suuankou','四暗刻',ALL(E.shape('standard'),E.meld('concealedTriplet','eq',4)));
 y('daisangen','大三元',COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true')));
 y('shousuushi','小四喜',ALL(X('category(pair,"winds")','eq','true'),COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true'))));
 y('daisuushi','大四喜',COUNT('groups','g','eq',4,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true')),{suppresses:['shousuushi']});
 y('tsuuiisou','字一色',EVERY('tiles','t',X('t.suit','eq','"z"')));
 y('chinroutou','清老头',EVERY('tiles','t',X('category(t,"terminals")','eq','true')));
 y('ryuuiisou','绿一色',E.in('green'));
 y('chuuren','九莲宝灯',ALL(E.closed(),E.shape('standard'),EVERY('tiles','t',X('t.suit','eq','pair.suit')),COUNT('tiles','t','gte',3,X('t.rank','eq','1')),COUNT('tiles','t','gte',3,X('t.rank','eq','9')),...Array.from({length:7},(_,i)=>COUNT('tiles','t','gte',1,X('t.rank','eq',String(i+2))))));
 y('suukantsu','四杠子',COUNT('groups','g','eq',4,X('g.type','eq','"quad"')));
 y('tenhou','天和',ALL(E.signal('dealer'),E.signal('tsumo'),E.signal('tenhou')));
 y('chiihou','地和',ALL(E.signal('dealer',false),E.signal('tsumo'),E.signal('chiihou')));
 add('cooperative','协同和','原创示例',1,1,ALL(E.shape('standard'),Q('groupPartitions','p',X('p.0.0.suit','eq','p.0.1.suit'),X('p.1.0.suit','eq','p.1.1.suit'),X('absdiff(p.0.0.center,p.0.1.center)','eq','absdiff(p.1.0.center,p.1.1.center)'))),{enabled:false,description:'两两划分、属性和绝对差组合。'});
 add('mirrorEqual','镜同和','原创示例',3,3,ALL(E.shape('standard'),Q('groupPartitions','p',X('p.0.0.suit','eq','p.0.1.suit'),X('p.1.0.suit','eq','p.1.1.suit'),X('p.0.0.center','eq','p.1.0.center'),X('p.0.1.center','eq','p.1.1.center'),X('p.0.0.family','eq','p.1.0.family'),X('p.0.1.family','eq','p.1.1.family'))),{enabled:false,suppresses:['cooperative'],description:'划分、属性引用和相等关系组合。'});
 add('symmetric','对称和','原创示例',3,3,ALL(E.shape('standard'),Q('groupPartitions','p',X('p.0.0.suit','eq','p.0.1.suit'),X('p.1.0.suit','eq','p.1.1.suit'),X('p.0.0.family','eq','p.0.1.family'),X('p.1.0.family','eq','p.1.1.family'),X('add(p.0.0.center,p.0.1.center)','eq','mul(2,pair.rank)'),X('add(p.1.0.center,p.1.1.center)','eq','mul(2,pair.rank)'))),{enabled:false,description:'划分、属性、加法和乘法组合。'});

 const m=(id,name,fan,ast,description)=>add(id,name,`${fan}分`,fan,fan,ast,{ruleset:'mcr',description});
 m('mcr_pure_terminal_chows','一色双龙会',64,ALL(E.shape('standard'),Q('groupQuads','g',seq('g',0),seq('g',1),seq('g',2),seq('g',3),X('unique(g.0.suit,g.1.suit,g.2.suit,g.3.suit)','eq','1'),X('g.0.suit','ne','"z"'),X('pair.suit','eq','g.0.suit'),X('pair.rank','eq','5'),X('unique(g.0.center,g.1.center,g.2.center,g.3.center)','eq','2'),X('min(g.0.center,g.1.center,g.2.center,g.3.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center,g.3.center)','eq','8'),X('add(g.0.center,g.1.center,g.2.center,g.3.center)','eq','20'))),'同一花色两副123、两副789，以同花色5作将。');
 m('mcr_four_pure_shifted_pungs','一色四节高',48,ALL(E.shape('standard'),Q('groupQuads','g',trip('g',0),trip('g',1),trip('g',2),trip('g',3),X('unique(g.0.suit,g.1.suit,g.2.suit,g.3.suit)','eq','1'),X('g.0.suit','ne','"z"'),X('unique(g.0.center,g.1.center,g.2.center,g.3.center)','eq','4'),X('sub(max(g.0.center,g.1.center,g.2.center,g.3.center),min(g.0.center,g.1.center,g.2.center,g.3.center))','eq','3'))),'同一花色四副序数连续递增一位的刻子或杠。');
 m('mcr_all_big','全大',24,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','gte','7')),'全部牌均为数牌7、8、9。');
 m('mcr_all_fives','全带五',16,ALL(E.shape('standard'),X('pair.rank','eq','5'),EVERY('groups','g',Q('g.tiles','t',X('t.rank','eq','5')))),'每副面子及将牌中都有数牌5。');
 m('mcr_knitted_straight','花龙',8,ALL(E.shape('standard'),Q('groupTriples','g',seq('g',0),seq('g',1),seq('g',2),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'),X('unique(g.0.center,g.1.center,g.2.center)','eq','3'),X('min(g.0.center,g.1.center,g.2.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center)','eq','8'),X('add(g.0.center,g.1.center,g.2.center)','eq','15'))),'三种花色的三副顺子连接成123、456、789。');
 m('mcr_mixed_shifted_chows','三色三步高',6,ALL(E.shape('standard'),Q('groupTriples','g',seq('g',0),seq('g',1),seq('g',2),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'),X('unique(g.0.center,g.1.center,g.2.center)','eq','3'),X('sub(max(g.0.center,g.1.center,g.2.center),min(g.0.center,g.1.center,g.2.center))','eq','2'))),'三种花色三副顺子起点依次递增一位。');
 m('mcr_all_types','五门齐',6,ALL(Q('tiles','t',X('t.suit','eq','"m"')),Q('tiles','t',X('t.suit','eq','"p"')),Q('tiles','t',X('t.suit','eq','"s"')),Q('tiles','t',X('category(t,"winds")','eq','true')),Q('tiles','t',X('category(t,"dragons")','eq','true'))),'万、筒、索、风牌、箭牌五类齐全。');

 // ── 港式台湾麻将（十六张）番种：台数照 core 的 scoring/fans/hk-taiwan ──
 // 结构 id 是 standard17 / shisanyaojiu / liguligu / shiliubuta（见 ruleset-model.js）。
 const t=(id,name,value,ast,opts={})=>add(id,name,`${value}台`,value,value,ast,{ruleset:'taiwan',...opts});
 t('tw_zimo','自摸',1,E.signal('tsumo'));
 t('tw_jiangyan','将眼',2,ALL(ANY(X('pair.rank','eq','2'),X('pair.rank','eq','5'),X('pair.rank','eq','8'))));
 t('tw_menqing','门清',5,E.closed());
 t('tw_menmo','门摸',5,ALL(E.closed(),E.signal('tsumo')),{suppresses:['tw_zimo']});
 t('tw_pinghu','平糊',5,ALL(E.shape('standard17'),E.closed(),COUNT('groups','g','eq',5,X('g.type','eq','"sequence"')),X('category(pair,"nonValue")','eq','true'),E.wait('ryanmen')));
 t('tw_gangshang','杠上自摸',5,ALL(E.signal('tsumo'),E.signal('rinshan')));
 t('tw_haidi','海底捞月',10,ALL(E.signal('tsumo'),E.signal('haitei')));
 t('tw_qianggang','抢杠',10,ALL(E.signal('tsumo',false),E.signal('chankan')));
 t('tw_sananke','三暗刻',20,E.meld('concealedTriplet','gte',3));
 t('tw_duiduihu','对对糊',40,ALL(E.shape('standard17'),EVERY('groups','g',X('g.family','eq','"tripletLike"'))));
 t('tw_hunyise','混一色',40,ALL(E.suit('eq',1),Q('tiles','t',X('t.suit','eq','"z"'))));
 t('tw_xiaosanyuan','小三元',40,ALL(E.shape('standard17'),X('category(pair,"dragons")','eq','true'),COUNT('groups','g','eq',2,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true'))));
 t('tw_liguligu','呖咕呖咕',40,E.shape('liguligu'));
 t('tw_shiliubuta','十六不搭',50,E.shape('shiliubuta'));
 t('tw_sianke','四暗刻',60,E.meld('concealedTriplet','gte',4),{suppresses:['tw_sananke']});
 t('tw_hunyaojiu','混么九',80,EVERY('tiles','t',X('category(t,"yaochu")','eq','true')),{suppresses:['tw_hunyise']});
 t('tw_quandaiyao','全带么',80,ALL(E.shape('standard17'),X('category(pair,"yaochu")','eq','true'),EVERY('groups','g',Q('g.tiles','t',X('category(t,"yaochu")','eq','true')))));
 t('tw_dasanyuan','大三元',80,COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true')),{suppresses:['tw_xiaosanyuan']});
 t('tw_shisanyaojiu','十三么九',100,E.shape('shisanyaojiu'));
 t('tw_qingyise','清一色',120,ALL(E.suit('eq',1),EVERY('tiles','t',X('t.suit','ne','"z"'))),{suppresses:['tw_hunyise']});
 t('tw_ziyise','字一色',120,EVERY('tiles','t',X('t.suit','eq','"z"')),{suppresses:['tw_hunyise','tw_hunyaojiu']});
 t('tw_xiaosixi','小四喜',120,ALL(X('category(pair,"winds")','eq','true'),COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true'))));
 t('tw_dasixi','大四喜',160,COUNT('groups','g','eq',4,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true')),{suppresses:['tw_xiaosixi']});
 t('tw_wuanke','五暗刻',180,E.meld('concealedTriplet','gte',5),{suppresses:['tw_sianke','tw_sananke']});
 t('tw_qingyaojiu','清么九',420,EVERY('tiles','t',X('category(t,"terminals")','eq','true')),{suppresses:['tw_hunyaojiu','tw_quandaiyao']});

 const signals=[{name:'tsumo',label:'自摸',type:'boolean',default:false},{name:'riichi',label:'立直',type:'boolean',default:false},{name:'doubleRiichi',label:'两立直',type:'boolean',default:false},{name:'ippatsu',label:'一发',type:'boolean',default:false},{name:'rinshan',label:'岭上摸牌',type:'boolean',default:false},{name:'chankan',label:'抢杠',type:'boolean',default:false},{name:'haitei',label:'海底摸月',type:'boolean',default:false},{name:'houtei',label:'河底捞鱼',type:'boolean',default:false},{name:'dealer',label:'庄家',type:'boolean',default:false},{name:'tenhou',label:'天和时机',type:'boolean',default:false},{name:'chiihou',label:'地和时机',type:'boolean',default:false},{name:'roundWind',label:'场风',type:'select',options:'1z,2z,3z,4z',default:'1z'},{name:'seatWind',label:'自风',type:'select',options:'1z,2z,3z,4z',default:'1z'},{name:'doraCount',label:'宝牌数量',type:'number',default:0},{name:'uraCount',label:'里宝牌数量',type:'number',default:0},{name:'akaCount',label:'赤宝牌数量',type:'number',default:0},{name:'waitCount',label:'听牌面数',type:'number',default:1}];
 const blockDefs={
  quantifierSome:{label:'存在',category:'逻辑容器',kind:'quantifier',defaults:{source:'groups',variable:'g',mode:'some',op:'eq',value:1,children:[]}},
  quantifierEvery:{label:'全部',category:'逻辑容器',kind:'quantifier',defaults:{source:'groups',variable:'g',mode:'every',op:'eq',value:1,children:[]}},
  quantifierNone:{label:'不存在',category:'逻辑容器',kind:'quantifier',defaults:{source:'groups',variable:'g',mode:'none',op:'eq',value:1,children:[]}},
  quantifierCount:{label:'匹配数量',category:'逻辑容器',kind:'quantifier',defaults:{source:'groups',variable:'g',mode:'count',op:'gte',value:1,children:[]}},compare:{label:'比较式',category:'比较判断',kind:'compare',defaults:{left:'g.type',op:'eq',right:'"sequence"'}},
  closed:{label:'门清状态',category:'基础事实',defaults:{value:true},type:'boolean'},signal:{label:'信号量比较',category:'基础事实',defaults:{name:'riichi',value:true,op:'eq'},type:'signal'},shape:{label:'结构分解族',category:'基础事实',defaults:{value:'standard'},type:'enum',options:[['standard','四面子一雀头'],['chiitoi','七对子结构'],['kokushi','十三幺结构'],['lesserKnitted','全不靠'],['knitted','组合龙']]},wait:{label:'和牌等待形式',category:'基础事实',defaults:{value:'ryanmen'},type:'enum',options:[['ryanmen','两面'],['tanki','单骑'],['kanchan','嵌张'],['penchan','边张'],['shanpon','双碰'],['special','特殊']]},
  tilesIn:{label:'所有牌属于基础集合',category:'兼容积木',hidden:true,defaults:{value:'simples'},type:'category'},contains:{label:'至少一张属于基础集合',category:'兼容积木',hidden:true,defaults:{value:'honors'},type:'category'},suitCount:{label:'数牌花色数量',category:'兼容积木',hidden:true,defaults:{value:1,op:'eq'},type:'number'},meldCount:{label:'面子数量',category:'兼容积木',hidden:true,defaults:{filter:'sequence',value:4,op:'eq'},type:'meldCount'},pairIn:{label:'雀头所属集合',category:'兼容积木',hidden:true,defaults:{value:'nonValue'},type:'category'},sequencePairs:{label:'相同顺子配对数',category:'兼容积木',hidden:true,defaults:{op:'gte',value:1},type:'number'},crossSuitSeq:{label:'存在三色同顺结构',category:'兼容积木',hidden:true,defaults:{value:true},type:'boolean'},crossSuitTrip:{label:'存在三色同刻结构',category:'兼容积木',hidden:true,defaults:{value:true},type:'boolean'},straight:{label:'存在同花色123/456/789',category:'兼容积木',hidden:true,defaults:{value:true},type:'boolean'},groupTouches:{label:'每组面子及雀头包含集合',category:'兼容积木',hidden:true,defaults:{value:'yaochu'},type:'category'},dragonPair:{label:'雀头是三元牌',category:'兼容积木',hidden:true,defaults:{value:true},type:'boolean'},windPair:{label:'雀头是风牌',category:'兼容积木',hidden:true,defaults:{value:true},type:'boolean'},meldHas:{label:'存在指定牌的刻类',category:'兼容积木',hidden:true,defaults:{name:'5z',filter:'tripletLike',value:true},type:'meldHas'},relation4:{label:'四面子两两分组关系',category:'兼容积木',hidden:true,defaults:{value:'sameDistance',typeMode:'family',differentSuits:false},type:'relation'},tileCount:{label:'指定牌的总数量',category:'兼容积木',hidden:true,defaults:{name:'1m',op:'gte',value:2},type:'tileCount'},groupAttributeCount:{label:'面子属性筛选计数',category:'兼容积木',hidden:true,defaults:{filter:'any',suit:'any',rank:0,op:'gte',value:2,typeMode:'family'},type:'groupAttributeCount'}
 };
 const categoryDefs=[
  {key:'simples',label:'中张牌（2～8）',kind:'computed'},
  {key:'terminals',label:'老头牌（1、9）',kind:'computed'},
  {key:'honors',label:'字牌',kind:'computed'},
  {key:'yaochu',label:'幺九牌',kind:'computed'},
  {key:'green',label:'绿牌',kind:'tiles',tiles:['2s','3s','4s','6s','8s','6z']},
  {key:'numbers',label:'全部数牌',kind:'computed'},
  {key:'winds',label:'风牌',kind:'computed'},
  {key:'dragons',label:'三元牌',kind:'computed'},
  {key:'value',label:'役牌',kind:'computed'},
  {key:'nonValue',label:'非役牌',kind:'computed'},
  {key:'reversible',label:'推不倒',kind:'tiles',tiles:['1p','2p','3p','4p','5p','8p','9p','2s','4s','5s','6s','8s','9s','5z']},
  {key:'evenNumber',label:'偶数牌',kind:'computed'},
  {key:'suit:m',label:'万子',kind:'computed'},
  {key:'suit:p',label:'筒子',kind:'computed'},
  {key:'suit:s',label:'索子',kind:'computed'}
 ];
 const categories=categoryDefs.map(c=>[c.key,c.label]);
 const operators=[['eq','='],['ne','≠'],['gte','≥'],['lte','≤'],['gt','>'],['lt','<']];
 const meldFilters=[['any','全部面子'],['sequence','顺子'],['triplet','刻子'],['tripletLike','刻类'],['quad','杠子'],['concealedTriplet','暗刻类'],['dragonTriplet','三元牌刻类'],['windTriplet','风牌刻类']];
 const relationModes=[['sameDistance','等距'],['sameSignature','同签名'],['mirrorAroundPair','关于雀头对称']];
 // 分组标题的固定顺序（国标按“NN分”从大到小自动排序，无需列举）。
 const categoryOrder={riichi:['一番','二番','三番','六番','役满','原创示例','自定义']};
 const fanValue=category=>{const m=/^(\d+)\s*分$/.exec(String(category??''));return m?Number(m[1]):-1;};
 // 返回去重后的分组名，每个分组只出现一次；国标按分值降序，非“NN分”的分组排在最后。
 function groupRules(rules,ruleSet){
  const visible=(rules||[]).filter(r=>(r.ruleSetId||r.ruleset||'riichi')===ruleSet);
  const seen=new Set(),groups=[];
  const push=category=>{if(category==null||seen.has(category))return;seen.add(category);groups.push(category);};
  (categoryOrder[ruleSet]||[]).forEach(push);
  [...new Set(visible.map(r=>r.category??''))]
   .filter(category=>!seen.has(category))
   .sort(ruleSet==='mcr'?(a,b)=>fanValue(b)-fanValue(a):()=>0)
   .forEach(push);
  return groups;
 }
 // 中文表达式积木的显示元数据：对象、属性、常量与公式。
 const expressionSpec={
  subjects:{
   group:{label:'面子'},groupTuple:{label:'面子组合'},partition:{label:'面子分组'},
   tile:{label:'牌'},tileList:{label:'牌种'},tileCollection:{label:'牌'},
   signals:{label:'信号量'},hand:{label:'手牌'},pair:{label:'雀头'},winning:{label:'和牌张'}
  },
  groupAttrs:[['','整个面子'],['type','类型（顺/刻/杠）'],['family','种类（顺/刻类）'],['suit','花色'],['rank','序数'],['center','中心数'],['open','副露'],['concealed','门清'],['concealedPung','暗刻'],['tileCount','牌数'],['tiles','牌张']],
  tileAttrs:[['','整张牌'],['rank','序数'],['suit','花色'],['honor','字牌'],['terminal','老头牌']],
  literals:{
   tile:[['1m','一万'],['2m','二万'],['3m','三万'],['4m','四万'],['5m','五万'],['6m','六万'],['7m','七万'],['8m','八万'],['9m','九万'],['1p','一筒'],['2p','二筒'],['3p','三筒'],['4p','四筒'],['5p','五筒'],['6p','六筒'],['7p','七筒'],['8p','八筒'],['9p','九筒'],['1s','一索'],['2s','二索'],['3s','三索'],['4s','四索'],['5s','五索'],['6s','六索'],['7s','七索'],['8s','八索'],['9s','九索'],['1z','东'],['2z','南'],['3z','西'],['4z','北'],['5z','白'],['6z','发'],['7z','中']],
   meldType:[['sequence','顺子'],['triplet','刻子'],['quad','杠子']],
   meldFamily:[['sequence','顺子'],['tripletLike','刻类']],
   suit:[['m','万'],['p','筒'],['s','索'],['z','字']],
   tileCategory:[['winds','风牌'],['dragons','三元牌'],['yaochu','幺九牌'],['terminals','老头牌'],['simples','中张牌'],['honors','字牌'],['green','绿牌'],['reversible','推不倒'],['evenNumber','偶数牌']],
   prop:[['suit','花色'],['rank','序数'],['center','中心数'],['family','种类（顺/刻类）'],['type','类型（顺/刻/杠）'],['tiles','牌张']]
  },
  functions:[
   {name:'category',label:'牌属于类别',min:2,max:2,args:{1:'tileCategory'}},
   {name:'containsCategory',label:'含类别牌',min:2,max:2,args:{1:'tileCategory'}},
   {name:'same',label:'全部相同',min:2,max:8},
   {name:'unique',label:'不同值数量',min:1,max:8},
   {name:'min',label:'最小值',min:1,max:8},
   {name:'max',label:'最大值',min:1,max:8},
   {name:'add',label:'求和',min:1,max:8},
   {name:'sub',label:'差值',min:2,max:2},
   {name:'mul',label:'乘积',min:2,max:8},
   {name:'abs',label:'绝对值',min:1,max:1},
   {name:'absdiff',label:'绝对差',min:2,max:2},
   {name:'mod',label:'余数',min:2,max:2},
   {name:'count',label:'数量',min:1,max:1},
   {name:'values',label:'属性列表',min:2,max:2,args:{1:'prop'}},
   {name:'select',label:'按条件筛选',min:4,max:4,args:{1:'prop',2:'operator'}},
   {name:'frequencyCount',label:'同牌张数统计',min:2,max:2,args:{1:'number'}},
   {name:'arithmeticStep',label:'等差步长',min:1,max:8},
   {name:'occurs',label:'出现次数',min:2,max:2},
   {name:'div',label:'除法',min:2,max:2},
   {name:'pow',label:'幂',min:2,max:2},
   {name:'floor',label:'向下取整',min:1,max:1},
   {name:'ceil',label:'向上取整',min:1,max:1},
   {name:'round',label:'四舍五入',min:1,max:1},
   {name:'if',label:'条件取值',min:3,max:3,args:{0:'bool',1:'number',2:'number'}},
   {name:'eq',label:'等于',min:2,max:2},
   {name:'ne',label:'不等于',min:2,max:2},
   {name:'gt',label:'大于',min:2,max:2},
   {name:'gte',label:'大于等于',min:2,max:2},
   {name:'lt',label:'小于',min:2,max:2},
   {name:'lte',label:'小于等于',min:2,max:2}
  ]
 };
 // 每种公式的中文语序：{arg:n} 为参数槽，{join:'、'} 为可变参数的连接符，{text:'…'} 为固定文字。
 const formulaLayouts={
  category:[{arg:0},{text:'牌属于类别'},{arg:1}],
  containsCategory:[{arg:0},{text:'含类别'},{arg:1},{text:'的牌'}],
  same:[{join:'、'},{text:'全部相同'}],
  unique:[{join:'、'},{text:'中不同值的数量'}],
  min:[{join:'、'},{text:'中的最小值'}],
  max:[{join:'、'},{text:'中的最大值'}],
  add:[{join:'、'},{text:'的和'}],
  sub:[{arg:0},{text:'减'},{arg:1}],
  mul:[{join:'、'},{text:'的积'}],
  abs:[{arg:0},{text:'的绝对值'}],
  absdiff:[{arg:0},{text:'与'},{arg:1},{text:'的绝对差'}],
  mod:[{arg:0},{text:'除以'},{arg:1},{text:'的余数'}],
  count:[{arg:0},{text:'的数量'}],
  values:[{arg:0},{text:'的'},{arg:1},{text:'列表'}],
  select:[{text:'从'},{arg:0},{text:'中筛选'},{arg:1},{arg:2},{arg:3}],
  frequencyCount:[{arg:0},{text:'中出现'},{arg:1},{text:'次的牌种数'}],
  arithmeticStep:[{join:'、'},{text:'的等差步长'}],
  occurs:[{arg:0},{text:'在'},{arg:1},{text:'中出现的次数'}],
  div:[{arg:0},{text:'除以'},{arg:1}],
  pow:[{arg:0},{text:'的'},{arg:1},{text:'次方'}],
  floor:[{arg:0},{text:'向下取整'}],
  ceil:[{arg:0},{text:'向上取整'}],
  round:[{arg:0},{text:'四舍五入'}],
  if:[{text:'如果'},{arg:0},{text:'则'},{arg:1},{text:'否则'},{arg:2}],
  eq:[{arg:0},{text:'等于'},{arg:1}],
  ne:[{arg:0},{text:'不等于'},{arg:1}],
  gt:[{arg:0},{text:'大于'},{arg:1}],
  gte:[{arg:0},{text:'大于等于'},{arg:1}],
  lt:[{arg:0},{text:'小于'},{arg:1}],
  lte:[{arg:0},{text:'小于等于'},{arg:1}]
 };
 for(const f of expressionSpec.functions)f.layout=formulaLayouts[f.name]||[{text:'未知公式'},{join:'、'}];
 // 番型根节点统一放进逻辑容器，便于在编辑器里继续添加条件。
 for(const rule of list)if(rule.ast&&!['all','any','not'].includes(rule.ast.kind))rule.ast={kind:'all',children:[rule.ast]};
 root.MJRules={rules:list,ruleSets,signals,blockDefs,categories,categoryDefs,operators,meldFilters,relationModes,expressionSpec,groupRules,C,ALL,ANY,Q,EVERY,COUNT,X};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.MJRules;
})(typeof window==='undefined'?globalThis:window);

/* Complete 81-fan MCR catalogue. Rules are data composed from generic language atoms. */
(function(root){
 'use strict';
 const R=root.MJRules;if(!R)return;
 R.rules=R.rules.filter(r=>r.ruleset!=='mcr');
 const {C,ALL,ANY,Q,EVERY,COUNT,X}=R;
 const shape=v=>C('shape',v),closed=()=>C('closed',true),signal=(name,value=true,op='eq')=>C('signal',value,op,{name});
 const seq=(v,i)=>X(`${v}.${i}.type`,'eq','"sequence"'),trip=(v,i)=>X(`${v}.${i}.family`,'eq','"tripletLike"');
 const m=(id,name,fan,ast,opts={})=>R.rules.push({id,name,category:`${fan}分`,closedHan:fan,openHan:fan,ast,ruleset:'mcr',yakuman:0,suppresses:[],enabled:true,description:opts.description||'',builtin:true,repeatMatches:Boolean(opts.repeatMatches),scoreExpr:opts.scoreExpr||null});
 const allTiles=(cat)=>EVERY('tiles','t',X(`category(t,"${cat}")`,'eq','true'));
 const allSeq=(v,n)=>Array.from({length:n},(_,i)=>seq(v,i));
 const allTrip=(v,n)=>Array.from({length:n},(_,i)=>trip(v,i));
 const sameSuit=(v,n)=>X(`unique(${Array.from({length:n},(_,i)=>`${v}.${i}.suit`).join(',')})`,'eq','1');
 const uniqueCenters=(v,n)=>X(`unique(${Array.from({length:n},(_,i)=>`${v}.${i}.center`).join(',')})`,'eq',String(n));
 const centers=(v,n)=>Array.from({length:n},(_,i)=>`${v}.${i}.center`).join(',');

 // 88 分（7）
 m('mcr_big_four_winds','大四喜',88,COUNT('groups','g','eq',4,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true')));
 m('mcr_big_three_dragons','大三元',88,COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true')));
 m('mcr_all_green','绿一色',88,allTiles('green'));
 m('mcr_nine_gates','九莲宝灯',88,ALL(closed(),shape('standard'),X('count(hand.concealed)','eq','13'),X('unique(values(hand.concealed,"suit"))','eq','1'),COUNT('hand.concealed','t','eq',3,X('t.rank','eq','1')),COUNT('hand.concealed','t','eq',3,X('t.rank','eq','9')),...Array.from({length:7},(_,i)=>COUNT('hand.concealed','t','eq',1,X('t.rank','eq',String(i+2))))));
 m('mcr_four_kongs','四杠',88,COUNT('groups','g','eq',4,X('g.type','eq','"quad"')));
 m('mcr_seven_shifted_pairs','连七对',88,ALL(shape('chiitoi'),X('count(tileKinds)','eq','7'),X('unique(values(tileKinds,"suit"))','eq','1'),X('tileKinds.0.suit','ne','"z"'),X('arithmeticStep(values(tileKinds,"rank"))','eq','1')));
 m('mcr_thirteen_orphans','十三幺',88,shape('kokushi'));

 // 64 分（6）
 m('mcr_all_terminals','清幺九',64,allTiles('terminals'));
 m('mcr_little_four_winds','小四喜',64,ALL(X('category(pair,"winds")','eq','true'),COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true'))));
 m('mcr_little_three_dragons','小三元',64,ALL(X('category(pair,"dragons")','eq','true'),COUNT('groups','g','eq',2,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true'))));
 m('mcr_all_honors','字一色',64,EVERY('tiles','t',X('t.suit','eq','"z"')));
 m('mcr_four_concealed_pungs','四暗刻',64,COUNT('groups','g','eq',4,X('g.concealedPung','eq','true')));
 m('mcr_pure_terminal_chows','一色双龙会',64,ALL(shape('standard'),Q('groupQuads','g',...allSeq('g',4),sameSuit('g',4),X('g.0.suit','ne','"z"'),X('pair.suit','eq','g.0.suit'),X('pair.rank','eq','5'),X('unique(g.0.center,g.1.center,g.2.center,g.3.center)','eq','2'),X('min(g.0.center,g.1.center,g.2.center,g.3.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center,g.3.center)','eq','8'),X('add(g.0.center,g.1.center,g.2.center,g.3.center)','eq','20'))));

 // 48 分（2）
 m('mcr_quadruple_chow','一色四同顺',48,Q('groupQuads','g',...allSeq('g',4),X('same(g.0.suit,g.1.suit,g.2.suit,g.3.suit)','eq','true'),X('same(g.0.center,g.1.center,g.2.center,g.3.center)','eq','true')));
 m('mcr_four_pure_shifted_pungs','一色四节高',48,Q('groupQuads','g',...allTrip('g',4),sameSuit('g',4),X('g.0.suit','ne','"z"'),uniqueCenters('g',4),X(`arithmeticStep(${centers('g',4)})`,'eq','1')));

 // 32 分（3）
 m('mcr_four_pure_shifted_chows','一色四步高',32,Q('groupQuads','g',...allSeq('g',4),sameSuit('g',4),uniqueCenters('g',4),ANY(X(`arithmeticStep(${centers('g',4)})`,'eq','1'),X(`arithmeticStep(${centers('g',4)})`,'eq','2'))));
 m('mcr_three_kongs','三杠',32,COUNT('groups','g','eq',3,X('g.type','eq','"quad"')));
 m('mcr_all_terminals_honors','混幺九',32,ALL(shape('standard'),allTiles('yaochu')));

 // 24 分（9）
 m('mcr_seven_pairs','七对',24,shape('chiitoi'));
 m('mcr_greater_honors_knitted','七星不靠',24,ALL(shape('lesserKnitted'),COUNT('tiles','t','eq',7,X('t.suit','eq','"z"'))));
 m('mcr_all_even_pungs','全双刻',24,ALL(shape('standard'),EVERY('groups','g',X('g.family','eq','"tripletLike"')),allTiles('evenNumber')));
 m('mcr_full_flush','清一色',24,ALL(X('unique(values(tiles,"suit"))','eq','1'),X('tileKinds.0.suit','ne','"z"')));
 m('mcr_pure_triple_chow','一色三同顺',24,Q('groupTriples','g',...allSeq('g',3),X('same(g.0.suit,g.1.suit,g.2.suit)','eq','true'),X('same(g.0.center,g.1.center,g.2.center)','eq','true')));
 m('mcr_pure_shifted_pungs','一色三节高',24,Q('groupTriples','g',...allTrip('g',3),sameSuit('g',3),uniqueCenters('g',3),X(`arithmeticStep(${centers('g',3)})`,'eq','1')));
 m('mcr_all_big','全大',24,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','gte','7')));
 m('mcr_all_middle','全中',24,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','gte','4'),X('t.rank','lte','6')));
 m('mcr_all_small','全小',24,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','lte','3')));

 // 16 分（6）
 m('mcr_pure_straight','清龙',16,Q('groupTriples','g',...allSeq('g',3),sameSuit('g',3),uniqueCenters('g',3),X('min(g.0.center,g.1.center,g.2.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center)','eq','8'),X('arithmeticStep(g.0.center,g.1.center,g.2.center)','eq','3')));
 m('mcr_three_suited_terminal_chows','三色双龙会',16,ALL(X('pair.rank','eq','5'),Q('groupPartitions','p',...allSeq('p.0',2),...allSeq('p.1',2),X('p.0.0.suit','eq','p.0.1.suit'),X('p.1.0.suit','eq','p.1.1.suit'),X('p.0.0.suit','ne','p.1.0.suit'),X('unique(p.0.0.center,p.0.1.center)','eq','2'),X('min(p.0.0.center,p.0.1.center)','eq','2'),X('max(p.0.0.center,p.0.1.center)','eq','8'),X('unique(p.1.0.center,p.1.1.center)','eq','2'),X('min(p.1.0.center,p.1.1.center)','eq','2'),X('max(p.1.0.center,p.1.1.center)','eq','8'),X('pair.suit','ne','p.0.0.suit'),X('pair.suit','ne','p.1.0.suit'))));
 m('mcr_pure_shifted_chows','一色三步高',16,Q('groupTriples','g',...allSeq('g',3),sameSuit('g',3),uniqueCenters('g',3),ANY(X(`arithmeticStep(${centers('g',3)})`,'eq','1'),X(`arithmeticStep(${centers('g',3)})`,'eq','2'))));
 m('mcr_all_fives','全带五',16,ALL(shape('standard'),X('pair.rank','eq','5'),EVERY('groups','g',Q('g.tiles','t',X('t.rank','eq','5')))));
 m('mcr_triple_pung','三同刻',16,Q('groupTriples','g',...allTrip('g',3),X('same(g.0.center,g.1.center,g.2.center)','eq','true'),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3')));
 m('mcr_three_concealed_pungs','三暗刻',16,COUNT('groups','g','eq',3,X('g.concealedPung','eq','true')));

 // 12 分（5）
 m('mcr_lesser_honors_knitted','全不靠',12,ALL(shape('lesserKnitted'),COUNT('tiles','t','lt',7,X('t.suit','eq','"z"'))));
 m('mcr_knitted_straight','组合龙',12,shape('knitted'));
 m('mcr_upper_four','大于五',12,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','gte','6')));
 m('mcr_lower_four','小于五',12,EVERY('tiles','t',X('t.suit','ne','"z"'),X('t.rank','lte','4')));
 m('mcr_big_three_winds','三风刻',12,COUNT('groups','g','eq',3,X('g.family','eq','"tripletLike"'),X('category(g.0,"winds")','eq','true')));

 // 8 分（9）
 m('mcr_mixed_straight','花龙',8,Q('groupTriples','g',...allSeq('g',3),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'),uniqueCenters('g',3),X('min(g.0.center,g.1.center,g.2.center)','eq','2'),X('max(g.0.center,g.1.center,g.2.center)','eq','8'),X('arithmeticStep(g.0.center,g.1.center,g.2.center)','eq','3'),X('add(g.0.center,g.1.center,g.2.center)','eq','15')));
 m('mcr_reversible_tiles','推不倒',8,allTiles('reversible'));
 m('mcr_mixed_triple_chow','三色三同顺',8,Q('groupTriples','g',...allSeq('g',3),X('same(g.0.center,g.1.center,g.2.center)','eq','true'),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3')));
 m('mcr_mixed_shifted_pungs','三色三节高',8,Q('groupTriples','g',...allTrip('g',3),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'),uniqueCenters('g',3),X(`arithmeticStep(${centers('g',3)})`,'eq','1')));
 m('mcr_chicken_hand','无番和',8,X('false','eq','true'));
 m('mcr_last_tile_draw','妙手回春',8,ALL(signal('tsumo'),signal('haitei')));
 m('mcr_last_tile_claim','海底捞月',8,ALL(signal('tsumo',false),signal('houtei')));
 m('mcr_replacement_tile','杠上开花',8,ALL(signal('tsumo'),signal('rinshan')));
 m('mcr_robbing_kong','抢杠和',8,ALL(signal('tsumo',false),signal('chankan')));

 // 6 分（7）
 m('mcr_all_pungs','碰碰和',6,ALL(shape('standard'),EVERY('groups','g',X('g.family','eq','"tripletLike"'))));
 m('mcr_half_flush','混一色',6,ALL(Q('tiles','t',X('t.suit','eq','"z"')),X('unique(values(select(tiles,"suit","ne","z"),"suit"))','eq','1')));
 m('mcr_mixed_shifted_chows','三色三步高',6,Q('groupTriples','g',...allSeq('g',3),X('unique(g.0.suit,g.1.suit,g.2.suit)','eq','3'),uniqueCenters('g',3),X(`arithmeticStep(${centers('g',3)})`,'eq','1')));
 m('mcr_all_types','五门齐',6,ALL(Q('tiles','t',X('t.suit','eq','"m"')),Q('tiles','t',X('t.suit','eq','"p"')),Q('tiles','t',X('t.suit','eq','"s"')),Q('tiles','t',X('category(t,"winds")','eq','true')),Q('tiles','t',X('category(t,"dragons")','eq','true'))));
 m('mcr_melded_hand','全求人',6,ALL(C('closed',false),signal('tsumo',false),C('wait','tanki'),EVERY('groups','g',X('g.open','eq','true'))));
 m('mcr_two_concealed_kongs','双暗杠',6,COUNT('groups','g','eq',2,X('g.type','eq','"quad"'),X('g.open','eq','false')));
 m('mcr_two_dragon_pungs','双箭刻',6,COUNT('groups','g','eq',2,X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true')));

 // 4 分（4）
 m('mcr_outside_hand','全带幺',4,ALL(X('category(pair,"yaochu")','eq','true'),EVERY('groups','g',Q('g.tiles','t',X('category(t,"yaochu")','eq','true')))));
 m('mcr_fully_concealed_hand','不求人',4,ALL(closed(),signal('tsumo')));
 m('mcr_two_melded_kongs','双明杠',4,COUNT('groups','g','eq',2,X('g.type','eq','"quad"'),X('g.open','eq','true')));
 m('mcr_last_tile','和绝张',4,signal('lastCopy'));

 // 2 分（10）
 m('mcr_dragon_pung','箭刻',2,Q('groups','g',X('g.family','eq','"tripletLike"'),X('category(g.0,"dragons")','eq','true')),{repeatMatches:true});
 m('mcr_prevalent_wind','圈风刻',2,Q('groups','g',X('g.family','eq','"tripletLike"'),X('g.0','eq','signals.roundWind')));
 m('mcr_seat_wind','门风刻',2,Q('groups','g',X('g.family','eq','"tripletLike"'),X('g.0','eq','signals.seatWind')));
 m('mcr_concealed_hand','门前清',2,ALL(closed(),signal('tsumo',false)));
 m('mcr_all_chows','平和',2,ALL(shape('standard'),EVERY('groups','g',X('g.type','eq','"sequence"')),X('pair.suit','ne','"z"')));
 m('mcr_tile_hog','四归一',2,X('frequencyCount(tiles,4)','gte','1'),{scoreExpr:'mul(2,frequencyCount(tiles,4))'});
 m('mcr_double_pung','双同刻',2,Q('groupPairs','g',...allTrip('g',2),X('g.0.center','eq','g.1.center'),X('g.0.suit','ne','g.1.suit')),{repeatMatches:true});
 m('mcr_two_concealed_pungs','双暗刻',2,COUNT('groups','g','eq',2,X('g.concealedPung','eq','true')));
 m('mcr_concealed_kong','暗杠',2,Q('groups','g',X('g.type','eq','"quad"'),X('g.open','eq','false')),{repeatMatches:true});
 m('mcr_all_simples','断幺',2,allTiles('simples'));

 // 1 分（13）
 m('mcr_pure_double_chow','一般高',1,Q('groupPairs','g',...allSeq('g',2),X('g.0.suit','eq','g.1.suit'),X('g.0.center','eq','g.1.center')),{repeatMatches:true});
 m('mcr_mixed_double_chow','喜相逢',1,Q('groupPairs','g',...allSeq('g',2),X('g.0.suit','ne','g.1.suit'),X('g.0.center','eq','g.1.center')),{repeatMatches:true});
 m('mcr_short_straight','连六',1,Q('groupPairs','g',...allSeq('g',2),X('g.0.suit','eq','g.1.suit'),X('absdiff(g.0.center,g.1.center)','eq','3')),{repeatMatches:true});
 m('mcr_two_terminal_chows','老少副',1,Q('groupPairs','g',...allSeq('g',2),X('g.0.suit','eq','g.1.suit'),X('unique(g.0.center,g.1.center)','eq','2'),X('min(g.0.center,g.1.center)','eq','2'),X('max(g.0.center,g.1.center)','eq','8')),{repeatMatches:true});
 m('mcr_terminal_honor_pung','幺九刻',1,Q('groups','g',X('g.family','eq','"tripletLike"'),X('category(g.0,"yaochu")','eq','true')),{repeatMatches:true});
 m('mcr_melded_kong','明杠',1,Q('groups','g',X('g.type','eq','"quad"'),X('g.open','eq','true')),{repeatMatches:true});
 m('mcr_one_voided_suit','缺一门',1,ALL(X('unique(values(select(tiles,"suit","ne","z"),"suit"))','gte','1'),X('unique(values(select(tiles,"suit","ne","z"),"suit"))','lte','2')));
 m('mcr_no_honors','无字',1,EVERY('tiles','t',X('t.suit','ne','"z"')));
 m('mcr_edge_wait','边张',1,C('wait','penchan'));
 m('mcr_closed_wait','坎张',1,C('wait','kanchan'));
 m('mcr_single_wait','单钓将',1,C('wait','tanki'));
 m('mcr_self_drawn','自摸',1,signal('tsumo'));
 m('mcr_flower_tiles','花牌',1,signal('flowerCount',0,'gt'),{scoreExpr:'signals.flowerCount'});

 for(const rule of R.rules)if(rule.ruleset==='mcr'&&rule.ast&&!['all','any','not'].includes(rule.ast.kind))rule.ast={kind:'all',children:[rule.ast]};
 const extraSignals=[{name:'lastCopy',label:'和绝张',type:'boolean',default:false},{name:'flowerCount',label:'花牌数量',type:'number',default:0}];
 for(const spec of extraSignals)if(!R.signals.some(s=>s.name===spec.name))R.signals.push(spec);
 R.mcrCount=R.rules.filter(r=>r.ruleset==='mcr').length;
 if(typeof module!=='undefined'&&module.exports)module.exports=R;
})(typeof window==='undefined'?globalThis:window);

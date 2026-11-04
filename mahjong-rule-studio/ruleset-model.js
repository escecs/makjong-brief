/* First-class rule-system definitions. Loaded after every built-in rule pack. */
(function(root){
 'use strict';
 const R=root.MJRules;
 const copy=value=>JSON.parse(JSON.stringify(value));
 const standardKinds=['m','p','s'].flatMap(s=>Array.from({length:9},(_,i)=>`${i+1}${s}`)).concat(Array.from({length:7},(_,i)=>`${i+1}z`));
 const mcrSettlement={base:'han',ron:'add(8,base)',ronOther:'8',tsumoDealerWin:'add(8,base)',tsumoNonDealerDealer:'add(8,base)',tsumoNonDealerOther:'add(8,base)'};
 const riichiSettlement={base:'if(gt(yakuman,0),mul(8000,yakuman),if(gte(han,13),8000,if(gte(han,11),6000,if(gte(han,8),4000,if(gte(han,6),3000,if(gte(han,5),2000,min(2000,mul(fu,pow(2,add(han,2))))))))))',ron:'mul(ceil(div(if(dealer,mul(base,6),mul(base,4)),100)),100)',ronOther:'0',tsumoDealerWin:'mul(ceil(div(mul(base,2),100)),100)',tsumoNonDealerDealer:'mul(ceil(div(mul(base,2),100)),100)',tsumoNonDealerOther:'mul(ceil(div(base,100)),100)'};
 const structures=[
  {id:'standard',label:'四面子一雀头',enabled:true,definition:{type:'standard',totalTiles:14,groupCount:4,pairCount:1,allowedMelds:['sequence','triplet','quad'],allowRepeatedPairs:false,consumeAll:true}},
  {id:'chiitoi',label:'七对子',enabled:true,definition:{type:'multiplicity',totalTiles:14,maxDeclaredMelds:0,allowedCounts:[0,2],unitSize:2,unitCount:7,consumeAll:true}},
  {id:'kokushi',label:'十三幺',enabled:true,definition:{type:'requiredKinds',totalTiles:14,maxDeclaredMelds:0,kinds:['1m','9m','1p','9p','1s','9s','1z','2z','3z','4z','5z','6z','7z'],minimumEach:1,duplicateUnits:1,onlyListedKinds:true,consumeAll:true}},
  {id:'lesserKnitted',label:'全不靠',enabled:false,definition:{type:'adapter',adapter:'lesserKnitted'}},
  {id:'knitted',label:'组合龙',enabled:false,definition:{type:'adapter',adapter:'knitted'}}
 ];
 // 港式台湾麻将（十六张）的四类和牌形：17 张一般形 + 三种门清特殊形。
 // 特殊形判定写在 engine.js 的 specialDecomps，口径照 core 的 scoring/hk-taiwan-shapes.ts。
 const taiwanStructures=[
  {id:'standard17',label:'一般形（五面子一雀头）',enabled:true,definition:{type:'standard',totalTiles:17,groupCount:5,pairCount:1,allowedMelds:['sequence','triplet','quad'],allowRepeatedPairs:false,consumeAll:true}},
  {id:'shisanyaojiu',label:'十三么九',enabled:true,definition:{type:'adapter',adapter:'shisanyaojiu'}},
  {id:'liguligu',label:'呖咕呖咕',enabled:true,definition:{type:'adapter',adapter:'liguligu'}},
  {id:'shiliubuta',label:'十六不搭',enabled:true,definition:{type:'adapter',adapter:'shiliubuta'}}
 ];
 const make=(id,name,unit,minimum,extra={})=>({
  id,name,scoreUnit:unit,minimumWinScore:minimum,winningHandTiles:14,builtin:true,
  tileSystem:{id:'custom',label:'自定义牌张集合',tileKinds:copy(standardKinds),copiesPerKind:4},
  settlement:copy(id==='mcr'?mcrSettlement:riichiSettlement),
  winStructures:copy(structures).map(s=>({...s,enabled:extra.structures?.includes(s.id)??s.enabled,definition:{...s.definition,...(extra.structureDefinitions?.[s.id]||{})}})),
  signalSpecs:copy(R.signals),
  scoringPolicy:{aggregation:'sum',chooseBestDecomposition:true,allowBonusWithoutPattern:false}
 });
 R.defaultRuleSets=[
  make('riichi','立直麻将','番',1),
  make('mcr','国标麻将 · 81番种','分',8,{structures:['standard','chiitoi','kokushi','lesserKnitted','knitted'],structureDefinitions:{chiitoi:{allowedCounts:[0,2,4]}}}),
  {
   id:'taiwan',name:'港式台湾麻将 · 十六张',scoreUnit:'台',minimumWinScore:0,winningHandTiles:17,builtin:true,
   tileSystem:{id:'custom',label:'自定义牌张集合',tileKinds:copy(standardKinds),copiesPerKind:4},
   // 不管底番：只算台数，不结算点数。
   settlement:{},
   winStructures:copy(taiwanStructures),
   signalSpecs:copy(R.signals),
   // 呖咕两食：嚦咕形与一般形各自结算后相加（见 engine.js 的 analyze）。
   scoringPolicy:{aggregation:'sum',chooseBestDecomposition:true,allowBonusWithoutPattern:false,liguguTwoReadings:true}
  }
 ];
 R.structureCatalog=[...structures,...taiwanStructures];
 R.blankRuleSet=function(id){return {
  id,name:'新规则体系',scoreUnit:'分',minimumWinScore:0,winningHandTiles:14,builtin:false,
  tileSystem:{id:'custom',label:'自定义牌张集合',tileKinds:copy(standardKinds),copiesPerKind:4},
  settlement:copy(mcrSettlement),
  winStructures:copy(structures).map(s=>({...s,enabled:s.id==='standard'})),
  signalSpecs:[],
  scoringPolicy:{aggregation:'sum',chooseBestDecomposition:true,allowBonusWithoutPattern:false}
 };};
 R.blankStructure=function(id){return {id,label:'新和牌结构',enabled:true,definition:{type:'standard',totalTiles:14,groupCount:4,pairCount:1,allowedMelds:['sequence','triplet','quad'],allowRepeatedPairs:false,consumeAll:true}};};
 R.standardTileKinds=standardKinds;
 R.settlementDefaults={mcr:mcrSettlement,riichi:riichiSettlement,taiwan:{}};
})(typeof window==='undefined'?globalThis:window);

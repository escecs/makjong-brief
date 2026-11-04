/* Mahjong Rule Studio — hand decomposition and declarative condition evaluator.
   No dependencies, no server, MIT licensed example. */
(function (root) {
  'use strict';
  const Language=root.MJLanguage||(typeof require!=='undefined'?require('./language.js'):null);
  const suits = ['m', 'p', 's'];
  const winds = ['1z', '2z', '3z', '4z'];
  const dragons = ['5z', '6z', '7z'];
  const yaochu = new Set([...suits.flatMap(s => [`1${s}`, `9${s}`]), ...winds, ...dragons]);
  const green = new Set(['2s','3s','4s','6s','8s','6z']);
  const allKinds = [...suits.flatMap(s=>Array.from({length:9},(_,i)=>`${i+1}${s}`)),...Array.from({length:7},(_,i)=>`${i+1}z`)];
  const tileSort=(a,b)=>allKinds.indexOf(a)-allKinds.indexOf(b);
  const rank=t=>Number(t[0]);
  const suit=t=>t[1];
  const tile=(r,s)=>`${r}${s}`;

  function parseTiles(input) {
    const src=String(input||'').toLowerCase().replace(/[\s,，;；]+/g,'');
    if (!src) return [];
    const result=[];
    let remaining=src;
    const re=/([0-9]+)([mpsz])/g;
    let hit;
    while((hit=re.exec(src))!==null){
      const [,digits,s]=hit;
      for(const ch of digits) {
        const n=Number(ch);
        if(n<1 || n>(s==='z'?7:9)) throw Error(`非法牌 ${ch}${s}。字牌仅允许 1z～7z。`);
        result.push(tile(n,s));
      }
      remaining=remaining.replace(hit[0],'');
    }
    if(remaining) throw Error(`无法识别的牌输入：${remaining}。示例：123m456p789s11z`);
    return result.sort(tileSort);
  }
  function formatTiles(tiles){
    const groups=[];
    for(const s of ['m','p','s','z']){
      const found=(tiles||[]).filter(t=>suit(t)===s).sort(tileSort);
      if(found.length) groups.push(found.map(rank).join('')+s);
    }
    return groups.join(' ');
  }
  function countMap(tiles){const m=Object.create(null);for(const t of tiles)m[t]=(m[t]||0)+1;return m;}
  function tileCategory(t,cat,ctx){
    return Language?Language.category(t,cat,ctx):false;
  }
  function normalizedType(g,mode='family'){
    if(g.type==='pair')return 'pair';
    if(mode==='family')return g.type==='sequence'?'sequence':'tripletLike';
    return g.type;
  }
  function makeMeld(code, pattern) {
    const tiles=parseTiles(pattern);
    const types={chi:'sequence',pon:'triplet',kanOpen:'quad',kanClosed:'quad',kanAdded:'quad'};
    const type=types[code];
    if(!type)throw Error('未知副露类型');
    const need=type==='quad'?4:3;
    if(tiles.length!==need)throw Error(`该面子需要 ${need} 张牌。`);
    if(type==='sequence'){
      if(suit(tiles[0])==='z'||tiles.some(t=>suit(t)!==suit(tiles[0]))||rank(tiles[1])!==rank(tiles[0])+1||rank(tiles[2])!==rank(tiles[1])+1)throw Error('吃牌必须为同花色连续三张数牌。');
    }else if(tiles.some(t=>t!==tiles[0]))throw Error('碰牌与杠牌必须由相同的牌组成。');
    return {type, tiles, open:code!=='kanClosed', origin:'declared', source:code};
  }
  function validation(hand,ruleSet={}){
    const declared=(hand.melds||[]).map(m=>makeMeld(m.source,m.pattern));
    const maximumGroups=Math.max(0,...(ruleSet.winStructures||[]).map(s=>Number(s.definition?.groupCount)||0),Math.floor((Number(ruleSet.winningHandTiles||14)-2)/3));
    if(declared.length>maximumGroups)throw Error(`当前规则体系最多允许 ${maximumGroups} 组副露或明示杠。`);
    const concealed=parseTiles(hand.concealed);
    const winning=parseTiles(hand.winning);
    const required=Number(ruleSet.winningHandTiles||14)-1-3*declared.length;
    if(concealed.length!==required)throw Error(`已有 ${declared.length} 组副露，暗手牌应有 ${required} 张，现在是 ${concealed.length} 张。`);
    if(winning.length!==1)throw Error('和牌张必须恰好一张。');
    const tiles=[...concealed,...winning[0]?[winning[0]]:[],...declared.flatMap(m=>m.tiles)];
    const tileKinds=Array.isArray(ruleSet.tileSystem?.tileKinds)?ruleSet.tileSystem.tileKinds:allKinds,copies=Math.max(1,Number(ruleSet.tileSystem?.copiesPerKind)||4),allowed=new Set(tileKinds);
    for(const t of tiles)if(!allowed.has(t))throw Error(`${t} 不属于当前规则体系的牌张集合。`);
    for(const [t,n] of Object.entries(countMap(tiles)))if(n>copies)throw Error(`${t} 出现 ${n} 张，超过当前牌张体系允许的 ${copies} 张。`);
    const closed=declared.every(m=>!m.open);
    return {concealed,winning:winning[0],declared,closed,tiles,tileKinds};
  }
  function sequence(t){return suit(t)!=='z'&&rank(t)<=7?[t,tile(rank(t)+1,suit(t)),tile(rank(t)+2,suit(t))]:null;}
  function componentDecomps(data,groupTarget=4,pairTarget=1,allowedMelds=['sequence','triplet','quad'],allowRepeatedPairs=false){
    const n=groupTarget-data.declared.length,allowed=new Set(allowedMelds);
    if(n<0||pairTarget<0||data.declared.some(g=>!allowed.has(g.type)))return [];
    const c=countMap([...data.concealed,data.winning]);
    const results=[],kinds=data.tileKinds||allKinds;
    function recur(groups,pairs){
      const t=kinds.find(t=>(c[t]||0)>0);
      if(!t){if(groups.length===n&&pairs.length===pairTarget)results.push({groups:groups.map(g=>({...g,tiles:[...g.tiles]})),pairs:[...pairs]});return;}
      if(pairs.length<pairTarget&&c[t]>=2&&(allowRepeatedPairs||!pairs.includes(t))){c[t]-=2;recur(groups,[...pairs,t]);c[t]+=2;}
      if(groups.length>=n)return;
      if(allowed.has('triplet')&&c[t]>=3){c[t]-=3;recur([...groups,{type:'triplet',tiles:[t,t,t],open:false,origin:'concealed'}],pairs);c[t]+=3;}
      const seq=sequence(t);
      if(allowed.has('sequence')&&seq&&seq.every(x=>c[x]>0)){
        seq.forEach(x=>c[x]--);
        recur([...groups,{type:'sequence',tiles:seq,open:false,origin:'concealed'}],pairs);
        seq.forEach(x=>c[x]++);
      }
    }
    recur([],[]);
    const output=[];
    for(const result of results){
        const groups=[...data.declared,...result.groups],pairs=result.pairs;
        const winPlacements=[...groups.map((g,i)=>g.origin==='concealed'&&g.tiles.includes(data.winning)?i:-1).filter(i=>i>=0)];
        if(pairs.includes(data.winning))winPlacements.push(-1);
        if(!winPlacements.length)winPlacements.push(-1);
        for(const winGroupIndex of winPlacements){
          const wait=waitType(groups,winGroupIndex,data.winning);
          const id=`${pairs.join(',')}|${groups.map(g=>g.type+':'+formatTiles(g.tiles)+':'+g.open).join(';')}|${winGroupIndex}`;
          output.push({shape:'standard',groups,pair:pairs[0]||null,pairs,winGroupIndex,wait,id});
        }
    }
    const used=new Set();return output.filter(v=>!used.has(v.id)&&used.add(v.id));
  }
  function standardDecomps(data){return componentDecomps(data,4,1,['sequence','triplet','quad'],false);}
  function waitType(groups,index,winning){
    if(index<0)return 'tanki';
    const g=groups[index];
    if(g.type!=='sequence')return 'shanpon';
    const r=rank(winning),start=rank(g.tiles[0]);
    if(r===start+1)return 'kanchan';
    if((start===1&&r===3)||(start===7&&r===7))return 'penchan';
    return 'ryanmen';
  }
  function specialDecomps(data){
    const counts=countMap([...data.concealed,data.winning]);
    const values=Object.values(counts);
    const out=[];
    if(!data.declared.length&&values.length===7&&values.every(v=>v===2))out.push({shape:'chiitoi',groups:[],pair:null,wait:'tanki',winGroupIndex:-1,id:'chiitoi'});
    if(!data.declared.length&&[...yaochu].every(t=>(counts[t]||0)>=1)&&Object.keys(counts).every(t=>yaochu.has(t))&&Object.values(counts).reduce((a,b)=>a+b,0)===14)
      out.push({shape:'kokushi',groups:[],pair:null,wait:'special',winGroupIndex:-1,id:'kokushi'});
    // ── 港式台湾麻将（17 张）的三种门清特殊形 ──
    // 定义照 core 的 scoring/hk-taiwan-shapes.ts，保证两边判定口径一致。
    if(!data.declared.length&&Object.values(counts).reduce((a,b)=>a+b,0)===17){
      // 十三么九：十三种么九字各一张，余下四张 = 一张么九对子 + 一组面子（顺或刻）
      if([...yaochu].every(t=>(counts[t]||0)>=1)){
        const rest={...counts};
        for(const t of yaochu){rest[t]--;if(!rest[t])delete rest[t];}
        for(const pairType of yaochu){
          if((rest[pairType]||0)<1)continue;
          rest[pairType]--;
          const three=allKinds.flatMap(t=>Array.from({length:rest[t]||0},()=>t));
          const meldOk=three.length===3&&(
            three.every(t=>t===three[0])||
            (suit(three[0])!=='z'&&three.every(t=>suit(t)===suit(three[0]))&&rank(three[1])===rank(three[0])+1&&rank(three[2])===rank(three[1])+1)
          );
          rest[pairType]=(rest[pairType]||0)+1;
          if(meldOk){out.push({shape:'shisanyaojiu',groups:[],pair:pairType,wait:'special',winGroupIndex:-1,id:'shisanyaojiu'});break;}
        }
      }
      const entries=Object.entries(counts).filter(([,c])=>c>0);
      // 呖咕呖咕：八对子 + 一张单张（四张同牌算两对）
      if(entries.every(([,c])=>c>=2&&c<=4)
        &&entries.reduce((s,[,c])=>s+Math.floor(c/2),0)===8
        &&entries.reduce((s,[,c])=>s+(c%2?1:0),0)===1){
        out.push({shape:'liguligu',groups:[],pair:null,wait:'special',winGroupIndex:-1,id:'liguligu'});
      }
      // 十六不搭：七种字齐 + 每门三张且同门相邻至少隔三数 + 一眼
      if(entries.length===16&&entries.filter(([,c])=>c===2).length===1&&entries.every(([,c])=>c===1||c===2)){
        const unique=new Set(entries.map(([t])=>t));
        let ok=[...winds,...dragons].every(t=>unique.has(t));
        for(const su of suits){
          if(!ok)break;
          const ranks=[...unique].filter(t=>suit(t)===su).map(rank).sort((a,b)=>a-b);
          if(ranks.length!==3||ranks[1]-ranks[0]<3||ranks[2]-ranks[1]<3)ok=false;
        }
        if(ok)out.push({shape:'shiliubuta',groups:[],pair:entries.find(([,c])=>c===2)[0],wait:'special',winGroupIndex:-1,id:'shiliubuta'});
      }
    }
    const perms=[['m','p','s'],['m','s','p'],['p','m','s'],['p','s','m'],['s','m','p'],['s','p','m']];
    const rankSets=[[1,4,7],[2,5,8],[3,6,9]];
    for(const perm of perms){
      const knitted=rankSets.flatMap((rs,i)=>rs.map(r=>tile(r,perm[i]))),allowed=new Set([...knitted,...winds,...dragons]);
      const whole=[...data.concealed,data.winning];
      if(!data.declared.length&&whole.length===14&&new Set(whole).size===14&&whole.every(t=>allowed.has(t))){
        out.push({shape:'lesserKnitted',groups:[],pair:null,wait:'special',winGroupIndex:-1,id:`unconnected:${perm.join('')}`});
      }
      if(data.declared.length>1||!knitted.every(t=>(counts[t]||0)>=1))continue;
      const rest={...counts};knitted.forEach(t=>rest[t]--);
      const remaining=allKinds.flatMap(t=>Array.from({length:rest[t]||0},()=>t));
      const expected=data.declared.length?2:5;if(remaining.length!==expected)continue;
      for(const p of allKinds){
        if((rest[p]||0)<2)continue;
        rest[p]-=2;
        const rem=allKinds.flatMap(t=>Array.from({length:rest[t]||0},()=>t));
        let extra=[];
        if(!rem.length&&data.declared.length===1)extra=[];
        else if(rem.length===3&&rem.every(t=>t===rem[0]))extra=[{type:'triplet',tiles:rem,open:false,origin:'concealed'}];
        else if(rem.length===3&&suit(rem[0])!=='z'&&rem.every(t=>suit(t)===suit(rem[0]))&&rank(rem[1])===rank(rem[0])+1&&rank(rem[2])===rank(rem[1])+1)extra=[{type:'sequence',tiles:rem,open:false,origin:'concealed'}];
        if(data.declared.length+extra.length===1)out.push({shape:'knitted',groups:[...data.declared,...extra],pair:p,wait:'special',winGroupIndex:-1,id:`knitted:${perm.join('')}:${p}:${formatTiles(rem)}`});
        rest[p]+=2;
      }
    }
    return out;
  }
  function structureDecomps(data,structures){
    const enabled=(structures||[]).filter(s=>s.enabled!==false),special=specialDecomps(data),out=[];
    const logicalTileCount=data.concealed.length+1+data.declared.length*3;
    for(const structure of enabled){
      const def=structure.definition||{type:'adapter',adapter:structure.id};
      if(def.type==='standard'){
        const allowed=new Set(def.allowedMelds||['sequence','triplet','quad']);
        if(Number(def.totalTiles||14)!==logicalTileCount)continue;
        for(const variant of componentDecomps(data,Number(def.groupCount??4),Number(def.pairCount??1),[...allowed],Boolean(def.allowRepeatedPairs))){
          out.push({...variant,shape:structure.id,id:`${structure.id}:${variant.id}`});
        }
        continue;
      }
      if(def.type==='multiplicity'){
        if(data.declared.length>Number(def.maxDeclaredMelds??0)||logicalTileCount!==Number(def.totalTiles||14))continue;
        const counts=Object.values(countMap([...data.concealed,data.winning])),allowed=new Set((def.allowedCounts||[]).map(Number)),size=Math.max(1,Number(def.unitSize)||1);
        if(counts.some(n=>!allowed.has(n))||counts.some(n=>n%size!==0))continue;
        const units=counts.reduce((sum,n)=>sum+n/size,0);
        if(units===Number(def.unitCount||0))out.push({shape:structure.id,groups:[],pair:null,wait:'special',winGroupIndex:-1,id:`${structure.id}:${formatTiles([...data.concealed,data.winning])}`});
        continue;
      }
      if(def.type==='requiredKinds'){
        if(data.declared.length>Number(def.maxDeclaredMelds??0)||logicalTileCount!==Number(def.totalTiles||14))continue;
        const counts=countMap([...data.concealed,data.winning]),kinds=new Set(def.kinds||[]),minimum=Math.max(0,Number(def.minimumEach)||0);
        if([...kinds].some(t=>(counts[t]||0)<minimum))continue;
        if(def.onlyListedKinds&&Object.keys(counts).some(t=>!kinds.has(t)))continue;
        const extras=[...kinds].reduce((sum,t)=>sum+Math.max(0,(counts[t]||0)-minimum),0);
        if(extras===Number(def.duplicateUnits||0))out.push({shape:structure.id,groups:[],pair:null,wait:'special',winGroupIndex:-1,id:`${structure.id}:${formatTiles([...data.concealed,data.winning])}`});
        continue;
      }
      const adapter=def.adapter||structure.id;
      special.filter(v=>v.shape===adapter).forEach(v=>out.push({...v,shape:structure.id,id:`${structure.id}:${v.id}`}));
    }
    const used=new Set();return out.filter(v=>!used.has(v.id)&&used.add(v.id));
  }
  function meldCenter(g){return g.type==='sequence'?rank(g.tiles[1]):rank(g.tiles[0]);}
  function isConcealedTriplet(g,i,ctx){
    if(g.type!=='triplet'&&g.type!=='quad')return false;
    if(g.open)return false;
    if(ctx.signals.tsumo!==true && i===ctx.variant.winGroupIndex && g.type==='triplet')return false;
    return true;
  }
  function meldCount(ctx,filter){
    return ctx.variant.groups.filter((g,i)=>{
      if(filter==='any')return true;
      if(filter==='sequence')return g.type==='sequence';
      if(filter==='triplet')return g.type==='triplet';
      if(filter==='quad')return g.type==='quad';
      if(filter==='tripletLike')return g.type==='triplet'||g.type==='quad';
      if(filter==='concealedTriplet')return isConcealedTriplet(g,i,ctx);
      if(filter==='dragonTriplet')return g.type!=='sequence'&&dragons.includes(g.tiles[0]);
      if(filter==='windTriplet')return g.type!=='sequence'&&winds.includes(g.tiles[0]);
      if(filter==='suitSequence')return g.type==='sequence'&&suit(g.tiles[0])!=='z';
      return false;
    }).length;
  }
  function sequencePairs(ctx){const c={};for(const g of ctx.variant.groups.filter(g=>g.type==='sequence')){const k=g.tiles[0];c[k]=(c[k]||0)+1;}return Object.values(c).reduce((a,n)=>a+Math.floor(n/2),0);}
  function crossSuitPattern(ctx,kind){
    for(let n=1;n<=(kind==='sequence'?7:9);n++){
      if(suits.every(s=>ctx.variant.groups.some(g=>{
        const ok=kind==='sequence'?g.type==='sequence':g.type!=='sequence';
        return ok&&suit(g.tiles[0])===s&&rank(g.tiles[0])===n;
      })))return true;
    }
    return false;
  }
  function straight(ctx){return suits.some(s=>[1,4,7].every(n=>ctx.variant.groups.some(g=>g.type==='sequence'&&suit(g.tiles[0])===s&&rank(g.tiles[0])===n)));}
  function groupTouches(ctx,category){
    return ctx.variant.shape==='standard' && tileCategory(ctx.variant.pair,category,ctx) && ctx.variant.groups.every(g=>g.tiles.some(t=>tileCategory(t,category,ctx)));
  }
  const partitions=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]];
  function relation4(ctx,mode,typeMode='family',differentSuits=false){
    if(ctx.variant.shape!=='standard'||ctx.variant.groups.length!==4)return false;
    const g=ctx.variant.groups;
    if(g.some(m=>suit(m.tiles[0])==='z'))return false;
    const center=rank(ctx.variant.pair||'0z');
    if(mode==='mirrorAroundPair'&&(!ctx.variant.pair||suit(ctx.variant.pair)==='z'))return false;
    return partitions.some(([[a,b],[c,d]])=>{
      const A=g[a],B=g[b],C=g[c],D=g[d];
      const sameSuit=(x,y)=>suit(x.tiles[0])===suit(y.tiles[0]);
      if(!sameSuit(A,B)||!sameSuit(C,D))return false;
      if(differentSuits&&sameSuit(A,C))return false;
      const r=x=>meldCenter(x),t=x=>normalizedType(x,typeMode);
      if(mode==='sameDistance')return Math.abs(r(A)-r(B))===Math.abs(r(C)-r(D));
      if(mode==='sameSignature'){
        const sig=x=>`${t(x)}|${r(x)}`;
        return [sig(A),sig(B)].sort().join(';')===[sig(C),sig(D)].sort().join(';');
      }
      if(mode==='mirrorAroundPair')return t(A)===t(B)&&t(C)===t(D)&&r(A)+r(B)===2*center&&r(C)+r(D)===2*center;
      return false;
    });
  }
  function cmp(a,op,b){
    if(op==='eq')return a===b;
    if(op==='ne')return a!==b;
    if(op==='gte')return Number(a)>=Number(b);
    if(op==='lte')return Number(a)<=Number(b);
    if(op==='gt')return Number(a)>Number(b);
    if(op==='lt')return Number(a)<Number(b);
    return false;
  }
  function evaluateNode(node,ctx,env={}){
    if(!node)return true;
    if(node.kind==='all')return (node.children||[]).every(n=>evaluateNode(n,ctx,env));
    if(node.kind==='any')return (node.children||[]).some(n=>evaluateNode(n,ctx,env));
    if(node.kind==='not')return !evaluateNode((node.children||[])[0],ctx,env);
    if(Language?.supports(node))return Language.evaluateNode(node,ctx,env,(child,nextEnv)=>evaluateNode(child,ctx,nextEnv));
    if(node.kind!=='check')return false;
    const op=node.op||'eq',v=node.value;
    const gr=ctx.variant.groups;
    switch(node.key){
      case 'closed':return cmp(ctx.closed,op,Boolean(v));
      case 'signal':return cmp(ctx.signals[node.name],op,v);
      case 'shape':return cmp(ctx.variant.shape,op,v);
      case 'tilesIn':return ctx.tiles.every(t=>tileCategory(t,v,ctx));
      case 'contains':return ctx.tiles.some(t=>tileCategory(t,v,ctx));
      case 'suitCount':return cmp(new Set(ctx.tiles.filter(t=>suit(t)!=='z').map(suit)).size,op,Number(v));
      case 'meldCount':return cmp(meldCount(ctx,node.filter||'sequence'),op,Number(v));
      case 'pairIn':return ctx.variant.shape==='standard'&&cmp(tileCategory(ctx.variant.pair,v,ctx),op,true);
      case 'wait':return cmp(ctx.variant.wait,op,v);
      case 'sequencePairs':return cmp(sequencePairs(ctx),op,Number(v));
      case 'crossSuitSeq':return cmp(crossSuitPattern(ctx,'sequence'),op,Boolean(v));
      case 'crossSuitTrip':return cmp(crossSuitPattern(ctx,'triplet'),op,Boolean(v));
      case 'straight':return cmp(straight(ctx),op,Boolean(v));
      case 'groupTouches':return cmp(groupTouches(ctx,v),op,true);
      case 'dragonPair':return ctx.variant.shape==='standard'&&cmp(dragons.includes(ctx.variant.pair),op,Boolean(v));
      case 'windPair':return ctx.variant.shape==='standard'&&cmp(winds.includes(ctx.variant.pair),op,Boolean(v));
      case 'meldHas':return cmp(gr.some(g=>(node.filter==='tripletLike'?g.type!=='sequence':g.type===node.filter)&&g.tiles[0]===(node.name==='seatWind'?ctx.seatWind:node.name==='roundWind'?ctx.roundWind:node.name)),op,Boolean(v));
      case 'relation4':return cmp(relation4(ctx,v,node.typeMode||'family',Boolean(node.differentSuits)),op,true);
      case 'tileCount':return cmp(ctx.tiles.filter(t=>t===node.name).length,op,Number(v));
      case 'groupAttributeCount':{
        const count=gr.filter(g=>{
          if(node.filter&&node.filter!=='any'&&normalizedType(g,node.typeMode||'family')!==node.filter)return false;
          if(node.suit&&node.suit!=='any'&&suit(g.tiles[0])!==node.suit)return false;
          if(node.rank&&Number(node.rank)!==meldCenter(g))return false;
          return true;
        }).length;
        return cmp(count,op,Number(v));
      }
      default:return false;
    }
  }
  function repeatQuantifier(node){
   if(!node)return null;
   if(node.kind==='quantifier')return node;
   if(node.kind==='all'&&node.children?.length===1)return repeatQuantifier(node.children[0]);
   return null;
  }
  function calculateFu(variant,data,signals,active){
    if(!variant)return 0;
    if(variant.shape==='chiitoi')return 25;
    if(variant.shape!=='standard'||!variant.groups||!variant.groups.length)return 0;
    if((active||[]).some(r=>r.id==='pinfu'))return signals.tsumo?20:30;
    let fu=20;
    if(signals.tsumo)fu+=2;else if(data.closed)fu+=10;
    for(const g of variant.groups){
      if(g.type==='sequence')continue;
      const t=g.tiles[0],honor=suit(t)==='z',terminal=!honor&&(rank(t)===1||rank(t)===9);
      const unit=(honor||terminal)?4:2;
      fu+=unit*(g.type==='quad'?4:1)*(g.open?1:2);
    }
    const pair=variant.pair;
    if(pair){
      if(Language.category(pair,'dragons',{signals}))fu+=2;
      const wind=pair===signals.roundWind||pair===signals.seatWind;
      if(wind)fu+=2;
      if(pair===signals.roundWind&&pair===signals.seatWind)fu+=2;
    }
    if(['kanchan','penchan','tanki'].includes(variant.wait))fu+=2;
    return Math.ceil(fu/10)*10;
  }
  function scoreVariant(variant,data,rules,signals,ruleSet={}){
    const ctx={variant,signals,closed:data.closed,tiles:data.tiles,concealed:data.concealed,hand:{concealed:data.concealed,winning:data.winning,declared:data.declared},winning:data.winning,roundWind:signals.roundWind||'1z',seatWind:signals.seatWind||'1z'};
    const ruleSetId=ruleSet.id||rules[0]?.ruleSetId||rules[0]?.ruleset||'riichi';
    const matches=r=>{try{return evaluateNode(r.ast,ctx);}catch{return false;}};
    let hits=rules.filter(r=>r.id!=='mcr_chicken_hand'&&r.enabled!==false && matches(r) && (data.closed || r.openHan!==null || r.yakuman));
    if(ruleSetId==='mcr'&&!hits.length){const chicken=rules.find(r=>r.id==='mcr_chicken_hand'&&r.enabled!==false);if(chicken)hits=[chicken];}
    const removed=new Set();
    // Higher-value matches are applied first; suppression uses persistent rule ids.
    [...hits].sort((a,b)=>(Number(b.yakuman||0)*100+Number(b.closedHan||0))-(Number(a.yakuman||0)*100+Number(a.closedHan||0))).forEach(r=>{
      if(removed.has(r.id))return;
      for(const target of r.suppresses||[])removed.add(target);
    });
    const active=hits.filter(r=>!removed.has(r.id));
    const yakuman=active.filter(r=>r.yakuman>0);
    if(yakuman.length)return {valid:true,variant, hits:yakuman,han:0,bonus:0,yakuman:yakuman.reduce((a,r)=>a+Number(r.yakuman),0),fu:0,ctx};
    const normal=active.filter(r=>!r.yakuman).map(r=>{
      let awarded=data.closed?Number(r.closedHan||0):Number(r.openHan||0);
      if(r.scoreExpr)awarded=Number(Language.expression(r.scoreExpr,ctx,{}))||0;
      else if(r.repeatMatches){const q=repeatQuantifier(r.ast);if(q)awarded*=Language.quantifierMatches(q,ctx,{},(child,env)=>evaluateNode(child,ctx,env));}
      return {...r,awarded};
    });
    const policy=ruleSet.scoringPolicy||{},awards=normal.map(r=>r.awarded);
    const yakuHan=policy.aggregation==='max'?Math.max(0,...awards):awards.reduce((a,n)=>a+n,0);
    const bonus=ruleSetId==='mcr'?0:Math.max(0,Number(signals.doraCount)||0)+Math.max(0,Number(signals.akaCount)||0)+(signals.riichi||signals.doubleRiichi?Math.max(0,Number(signals.uraCount)||0):0);
    const valid=yakuHan>0||(policy.allowBonusWithoutPattern&&bonus>0),minimum=Math.max(0,Number(ruleSet.minimumWinScore)||0);
    if(!valid)return {valid:false,meetsMinimum:false,variant,hits:[],han:0,bonus:0,yakuman:0,fu:0,ctx};
    return {valid:true,meetsMinimum:yakuHan+bonus>=minimum,variant,hits:normal,han:yakuHan,bonus,yakuman:0,fu:calculateFu(variant,data,signals,normal),ctx};
  }
  function settlementFor(result,ruleSet,signals){
    const cfg=ruleSet?.settlement||{};
    if(!result||!result.valid||!cfg.base)return null;
    const env={han:Number(result.han)+Number(result.bonus),fu:Number(result.fu)||0,bonus:Number(result.bonus)||0,yakuman:Number(result.yakuman)||0,dealer:signals.dealer===true,tsumo:signals.tsumo===true,players:4};
    const ctx=result.ctx||{signals};
    const evaluate=source=>{try{return Number(Language.expression(String(source),ctx,env))||0;}catch{return 0;}};
    const base=evaluate(cfg.base);env.base=base;
    const ron=evaluate(cfg.ron),ronOther=evaluate(cfg.ronOther);
    const dealerWin=evaluate(cfg.tsumoDealerWin),dealerPay=evaluate(cfg.tsumoNonDealerDealer),otherPay=evaluate(cfg.tsumoNonDealerOther);
    const payments=[];let winner=0;
    if(signals.tsumo){
      if(env.dealer){winner=dealerWin*3;payments.push({role:'每家',amount:dealerWin,count:3});}
      else {winner=dealerPay+otherPay*2;payments.push({role:'庄家',amount:dealerPay,count:1},{role:'闲家',amount:otherPay,count:2});}
    }else{winner=ron+ronOther*2;payments.push({role:'点炮者',amount:ron,count:1},{role:'其他家',amount:ronOther,count:2});}
    return {base,winner,payments,ron,ronOther,tsumoDealerWin:dealerWin,tsumoNonDealerDealer:dealerPay,tsumoNonDealerOther:otherPay,tsumo:signals.tsumo===true,dealer:env.dealer};
  }
  function analyze(hand,rules,signals,ruleSet={}){
    const data=validation(hand,ruleSet);
    const variants=Array.isArray(ruleSet.winStructures)?structureDecomps(data,ruleSet.winStructures):[...standardDecomps(data),...specialDecomps(data)];
    if(!variants.length)return {complete:false,valid:false,error:`这 ${Number(ruleSet.winningHandTiles||14)} 张牌无法组成合法和牌型（包含所选副露）。`,variants:0,data};
    const evaluated=variants.map(v=>scoreVariant(v,data,rules,signals,ruleSet));
    const ranking=v=>v.yakuman*100000+(v.han+v.bonus)*100+(v.valid?1:0);
    // 呖咕两食：嚦咕形与一般形各自独立结算，然后把两边番数相加（照 core 的口径，
    // 不是取高）。同一个番种两边都中时只算一次，取数值大的那次。
    if(ruleSet.scoringPolicy?.liguguTwoReadings){
      const bestOf=list=>list.filter(v=>v.valid).sort((a,b)=>ranking(b)-ranking(a))[0];
      const liGu=bestOf(evaluated.filter(v=>v.variant.shape==='liguligu'));
      const basic=bestOf(evaluated.filter(v=>!['liguligu','shisanyaojiu','shiliubuta'].includes(v.variant.shape)));
      if(liGu&&basic){
        const byId=new Map();
        for(const hit of [...basic.hits,...liGu.hits]){
          const current=byId.get(hit.id);
          if(!current||Number(hit.awarded||0)>Number(current.awarded||0))byId.set(hit.id,hit);
        }
        const hits=[...byId.values()];
        const han=hits.reduce((sum,hit)=>sum+Number(hit.awarded||0),0);
        const bonus=Number(basic.bonus||0)+Number(liGu.bonus||0);
        const minimum=Math.max(0,Number(ruleSet.minimumWinScore)||0);
        evaluated.push({valid:true,meetsMinimum:han+bonus>=minimum,variant:liGu.variant,hits,han,bonus,yakuman:0,fu:0,ctx:liGu.ctx,twoReadings:true});
      }
    }
    if(ruleSet.scoringPolicy?.chooseBestDecomposition!==false)evaluated.sort((a,b)=>ranking(b)-ranking(a));
    const best=evaluated[0];
    if(best.valid)best.settlement=settlementFor(best,ruleSet,signals);
    return {...best,complete:true,variants:variants.length,data};
  }
  root.MJEngine={allKinds,suits,winds,dragons,rank,suit,tileSort,parseTiles,formatTiles,makeMeld,validation,componentDecomps,standardDecomps,specialDecomps,structureDecomps,evaluateNode,analyze,calculateFu,settlementFor,tileCategory,relation4};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MJEngine;
})(typeof window==='undefined'?globalThis:window);

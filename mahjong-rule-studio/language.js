/* Mahjong Rule Language — generic collections, bindings, expressions and quantifiers. */
(function(root){
 'use strict';

 const operators=['eq','ne','gte','lte','gt','lt'];
 const sources={
  groups:'全部面子',
  tiles:'全部牌张',
  groupPairs:'面子的二元组合',
  groupTriples:'面子的三元组合',
  groupQuads:'面子的四元组合',
  groupPartitions:'四面子的两两划分',
  tileKinds:'手牌中的不同牌种'
 };

 function combinations(items,size){
  const out=[];
  function visit(start,picked){
   if(picked.length===size){out.push(picked.slice());return;}
   for(let i=start;i<=items.length-(size-picked.length);i++)visit(i+1,[...picked,items[i]]);
  }
  visit(0,[]);return out;
 }
 function partitions4(items){
  if(items.length!==4)return [];
  return [
   [[items[0],items[1]],[items[2],items[3]]],
   [[items[0],items[2]],[items[1],items[3]]],
   [[items[0],items[3]],[items[1],items[2]]]
  ];
 }
 function collection(name,ctx,env={}){
  const groups=ctx.variant.groups||[],tiles=ctx.tiles||[];
  if(name==='groups')return groups;
  if(name==='tiles')return tiles;
  if(name==='groupPairs')return combinations(groups,2);
  if(name==='groupTriples')return combinations(groups,3);
  if(name==='groupQuads')return combinations(groups,4);
  if(name==='groupPartitions')return partitions4(groups);
  if(name==='tileKinds')return [...new Set(tiles)];
  const resolved=expression(name,ctx,env);
  return Array.isArray(resolved)?resolved:[];
 }
 function groupValue(group,key,ctx){
  if(!group||!Array.isArray(group.tiles))return undefined;
  if(/^\d+$/.test(String(key)))return group.tiles[Number(key)];
  const first=group.tiles[0],rank=Number(first?.[0]),suit=first?.[1];
  if(key==='suit')return suit;
  if(key==='rank')return rank;
  if(key==='center')return group.type==='sequence'?rank+1:rank;
  if(key==='family')return group.type==='sequence'?'sequence':'tripletLike';
  if(key==='concealed')return !group.open;
  if(key==='concealedPung'){
   if(group.type!=='triplet'&&group.type!=='quad'||group.open)return false;
   const index=ctx?.variant?.groups?.indexOf(group)??-2;
   return !(ctx?.signals?.tsumo!==true&&index===ctx?.variant?.winGroupIndex&&group.type==='triplet');
  }
  if(key==='tileCount')return group.tiles.length;
  return group[key];
 }
 function tileValue(tile,key){
  if(typeof tile!=='string'||!/^[1-9][mpsz]$/.test(tile))return undefined;
  if(key==='rank')return Number(tile[0]);
  if(key==='suit')return tile[1];
  if(key==='honor')return tile[1]==='z';
  if(key==='terminal')return tile[1]!=='z'&&(tile[0]==='1'||tile[0]==='9');
  return undefined;
 }
 function property(value,key,ctx){
  if(Array.isArray(value))return value[Number(key)];
  if(value&&Array.isArray(value.tiles))return groupValue(value,key,ctx);
  const tileProp=tileValue(value,key);if(tileProp!==undefined)return tileProp;
  return value?.[key];
 }
 function resolvePath(path,ctx,env){
  const parts=String(path).split('.');
  let value;
  if(Object.prototype.hasOwnProperty.call(env,parts[0]))value=env[parts.shift()];
  else if(parts[0]==='hand'){value=ctx.hand||ctx;parts.shift();}
  else if(parts[0]==='pair'){value=ctx.variant.pair;parts.shift();}
  else if(parts[0]==='winning'){value=ctx.winning;parts.shift();}
  else if(parts[0]==='signals'){value=ctx.signals;parts.shift();}
  else if(parts[0] in sources){value=collection(parts.shift(),ctx,env);}
  else return undefined;
  for(const key of parts)value=property(value,key,ctx);
  return value;
 }
 function splitArgs(src){
  const out=[];let depth=0,quote='',start=0;
  for(let i=0;i<src.length;i++){
   const ch=src[i];
   if(quote){if(ch===quote&&src[i-1]!=='\\')quote='';continue;}
   if(ch==='"'||ch==="'"){quote=ch;continue;}
   if(ch==='(')depth++;
   else if(ch===')')depth--;
   else if(ch===','&&depth===0){out.push(src.slice(start,i).trim());start=i+1;}
  }
  if(src.slice(start).trim()||src.trim()==='')out.push(src.slice(start).trim());
  return out;
 }
 let categoryDefs=null;
 function setCategories(list){
  if(!Array.isArray(list)){categoryDefs=null;return;}
  const map=Object.create(null);
  for(const item of list){if(item&&item.key)map[item.key]=item;}
  categoryDefs=map;
 }
 function category(tile,cat,ctx){
  if(typeof tile!=='string')return false;
  if(cat==='all')return true;
  if((cat==='dragon'||cat==='wind')&&(!categoryDefs||!categoryDefs[cat]))cat=cat==='dragon'?'dragons':'winds';
  let def=null;
  if(categoryDefs){
   def=categoryDefs[cat]||null;
   if(!def&&!String(cat).startsWith('tile:'))return false;
  }
  if(def&&Array.isArray(def.tiles))return def.tiles.includes(tile);
  if(cat==='simples')return tile[1]!=='z'&&Number(tile[0])>=2&&Number(tile[0])<=8;
  if(cat==='terminals')return tile[1]!=='z'&&(tile[0]==='1'||tile[0]==='9');
  if(cat==='honors')return tile[1]==='z';
  if(cat==='numbers')return tile[1]!=='z';
  if(cat==='winds')return ['1z','2z','3z','4z'].includes(tile);
  if(cat==='dragons')return ['5z','6z','7z'].includes(tile);
  if(cat==='yaochu')return category(tile,'terminals',ctx)||category(tile,'honors',ctx);
  if(cat==='value')return category(tile,'dragons',ctx)||tile===ctx?.seatWind||tile===ctx?.roundWind;
  if(cat==='nonValue')return !category(tile,'dragons',ctx)&&tile!==ctx?.seatWind&&tile!==ctx?.roundWind;
  if(cat==='green')return ['2s','3s','4s','6s','8s','6z'].includes(tile);
  if(cat==='reversible')return ['1p','2p','3p','4p','5p','8p','9p','2s','4s','5s','6s','8s','9s','5z'].includes(tile);
  if(cat==='evenNumber')return tile[1]!=='z'&&Number(tile[0])%2===0;
  if(String(cat).startsWith('suit:'))return tile[1]===String(cat).slice(5);
  if(String(cat).startsWith('tile:'))return tile===String(cat).slice(5);
  return false;
 }
 function call(name,args,ctx){
  const flat=values=>values.flat(Infinity);
  if(name==='abs')return Math.abs(Number(args[0]));
  if(name==='absdiff')return Math.abs(Number(args[0])-Number(args[1]));
  if(name==='add')return flat(args).reduce((a,b)=>Number(a)+Number(b),0);
  if(name==='sub')return Number(args[0])-Number(args[1]);
  if(name==='mul')return args.reduce((a,b)=>Number(a)*Number(b),1);
  if(name==='mod')return Number(args[0])%Number(args[1]);
  if(name==='min')return Math.min(...flat(args).map(Number));
  if(name==='max')return Math.max(...flat(args).map(Number));
  if(name==='div'){const d=Number(args[1]);return d?Number(args[0])/d:0;}
  if(name==='pow')return Math.pow(Number(args[0]),Number(args[1]));
  if(name==='floor')return Math.floor(Number(args[0]));
  if(name==='ceil')return Math.ceil(Number(args[0]));
  if(name==='round')return Math.round(Number(args[0]));
  if(name==='if')return args[0]?args[1]:args[2];
  if(name==='eq')return cmp(args[0],'eq',args[1]);
  if(name==='ne')return cmp(args[0],'ne',args[1]);
  if(name==='gt')return cmp(args[0],'gt',args[1]);
  if(name==='gte')return cmp(args[0],'gte',args[1]);
  if(name==='lt')return cmp(args[0],'lt',args[1]);
  if(name==='lte')return cmp(args[0],'lte',args[1]);
  if(name==='count')return Array.isArray(args[0])?args[0].length:0;
  if(name==='unique')return new Set(args.flat()).size;
  if(name==='same')return args.every(v=>Object.is(v,args[0]));
  if(name==='category')return category(args[0],String(args[1]),ctx);
  if(name==='containsCategory')return Boolean(args[0]?.tiles?.some(t=>category(t,String(args[1]),ctx)));
  if(name==='values')return Array.isArray(args[0])?args[0].map(v=>property(v,String(args[1]),ctx)):[];
  if(name==='select')return Array.isArray(args[0])?args[0].filter(v=>cmp(property(v,String(args[1]),ctx),String(args[2]),args[3])):[];
  if(name==='occurs')return Array.isArray(args[1])?args[1].filter(v=>Object.is(v,args[0])).length:0;
  if(name==='frequencyCount'){
   if(!Array.isArray(args[0]))return 0;const counts={};args[0].forEach(v=>{const k=String(v);counts[k]=(counts[k]||0)+1;});
   return Object.values(counts).filter(n=>n===Number(args[1])).length;
  }
  if(name==='arithmeticStep'){
   const xs=[...new Set(flat(args).map(Number))].sort((a,b)=>a-b);
   if(xs.length<2)return 0;const step=xs[1]-xs[0];return xs.every((v,i)=>i===0||v-xs[i-1]===step)?step:-1;
  }
  throw Error(`未知公式函数：${name}`);
 }
 function expression(input,ctx,env={}){
  const src=String(input??'').trim();
  if(!src)return '';
  if(/^[-+]?\d+(\.\d+)?$/.test(src))return Number(src);
  if(src==='true'||src==='false')return src==='true';
  if(src==='null')return null;
  if((src.startsWith('"')&&src.endsWith('"'))||(src.startsWith("'")&&src.endsWith("'")))return src.slice(1,-1);
  const callMatch=src.match(/^([A-Za-z_][A-Za-z_0-9]*)\((.*)\)$/s);
  if(callMatch)return call(callMatch[1],splitArgs(callMatch[2]).map(x=>expression(x,ctx,env)),ctx);
  const value=resolvePath(src,ctx,env);
  if(value===undefined)throw Error(`公式无法解析：${src}`);
  return value;
 }
 // 将表达式字符串解析为可编辑的结构：属性路径、字面量、公式调用。
 function parseExpression(input){
  const src=String(input??'').trim();
  let i=0;
  const fail=message=>{throw Error(message||`无法解析表达式：${src}`);};
  const skip=()=>{while(i<src.length&&/\s/.test(src[i]))i++;};
  const readIdent=()=>{skip();const start=i;while(i<src.length&&/[A-Za-z_0-9\u4e00-\u9fa5]/.test(src[i]))i++;if(i===start)fail();return src.slice(start,i);};
  function atom(){
   skip();
   const ch=src[i];
   if(ch==='"'||ch==='\''){
    const quote=ch;i++;let out='';
    while(i<src.length){
     const c=src[i++];
     if(c==='\\'){out+=src[i++]??'';continue;}
     if(c===quote)return {type:'literal',value:out};
     out+=c;
    }
    fail('字符串缺少结束引号');
   }
   if(ch!==undefined&&/[-\d]/.test(ch)){
    const number=/^[-+]?\d+(?:\.\d+)?/.exec(src.slice(i));
    if(number){i+=number[0].length;return {type:'literal',value:Number(number[0])};}
   }
   const name=readIdent();
   skip();
   if(src[i]==='('){
    i++;const args=[];skip();
    if(src[i]!==')'){
     for(;;){
      args.push(atom());skip();
      if(src[i]===','){i++;continue;}
      break;
     }
    }
    skip();
    if(src[i]!==')')fail('函数缺少右括号');
    i++;
    return {type:'call',name,args};
   }
   if(name==='true')return {type:'literal',value:true};
   if(name==='false')return {type:'literal',value:false};
   if(name==='null')return {type:'literal',value:null};
   const parts=[name];
   for(;;){
    skip();
    if(src[i]!=='.')break;
    i++;skip();
    if(/\d/.test(src[i]??'')){
     const index=/^\d+/.exec(src.slice(i));
     i+=index[0].length;parts.push(index[0]);
    }else parts.push(readIdent());
   }
   return {type:'path',parts};
  }
  const node=atom();skip();
  if(i<src.length)fail(`表达式末尾有多余内容：${src.slice(i)}`);
  return node;
 }
 // 结构还原为引擎可求值的表达式字符串。
 function expressionString(node){
  if(!node)return '';
  if(node.type==='literal'){
   if(node.value===null)return 'null';
   return typeof node.value==='string'?JSON.stringify(node.value):String(node.value);
  }
  if(node.type==='path')return (node.parts||[]).join('.');
  if(node.type==='call')return `${node.name}(${(node.args||[]).map(expressionString).join(',')})`;
  return '';
 }
 // 把表达式里的某个绑定变量前缀替换为新名字（只改路径，不改字符串常量）。
 function renameVariable(src,oldName,newName){
  if(typeof src!=='string'||!oldName||!newName)return src;
  let ast;
  try{ast=parseExpression(src);}catch{return src;}
  const walk=node=>{
   if(!node)return;
   if(node.type==='path'&&node.parts&&node.parts[0]===oldName)node.parts[0]=newName;
   if(node.type==='call')(node.args||[]).forEach(walk);
  };
  walk(ast);
  return expressionString(ast);
 }
 function cmp(a,op,b){
  if(op==='eq')return Object.is(a,b);
  if(op==='ne')return !Object.is(a,b);
  if(op==='gte')return Number(a)>=Number(b);
  if(op==='lte')return Number(a)<=Number(b);
  if(op==='gt')return Number(a)>Number(b);
  if(op==='lt')return Number(a)<Number(b);
  return false;
 }
 function supports(node){return node?.kind==='quantifier'||node?.kind==='compare';}
 function quantifierMatches(node,ctx,env,evaluateChild){
  const values=collection(node.source,ctx,env),variable=node.variable||'item';
  return values.filter(value=>{const next={...env,[variable]:value};return (node.children||[]).every(child=>evaluateChild(child,next));}).length;
 }
 function evaluateNode(node,ctx,env,evaluateChild){
  if(node.kind==='compare')return cmp(expression(node.left,ctx,env),node.op||'eq',expression(node.right,ctx,env));
  const values=collection(node.source,ctx,env),matches=quantifierMatches(node,ctx,env,evaluateChild);
  if(node.mode==='every')return values.length>0&&matches===values.length;
  if(node.mode==='none')return matches===0;
  if(node.mode==='count')return cmp(matches,node.op||'eq',Number(node.value||0));
  return matches>0;
 }

 root.MJLanguage={sources,operators,collection,expression,expressionString,parseExpression,renameVariable,category,setCategories,supports,evaluateNode,quantifierMatches,combinations,partitions4};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.MJLanguage;
})(typeof window==='undefined'?globalThis:window);

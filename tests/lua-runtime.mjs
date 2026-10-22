// Executa o script Lua real; apenas os comandos Redis são simulados.
import fengari from 'fengari';
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=fengari;
function push(L,value){
 if(value===null||value===undefined)lua.lua_pushnil(L);
 else if(typeof value==='boolean')lua.lua_pushboolean(L,value);
 else if(typeof value==='number')lua.lua_pushnumber(L,value);
 else if(typeof value==='string')lua.lua_pushstring(L,to_luastring(value));
 else{
  lua.lua_newtable(L);
  if(Array.isArray(value))value.forEach((v,i)=>{push(L,v);lua.lua_rawseti(L,-2,i+1);});
  else for(const [key,v] of Object.entries(value)){push(L,v);lua.lua_setfield(L,-2,to_luastring(key));}
 }
}
function read(L,index){
 const type=lua.lua_type(L,index);
 if(type===lua.LUA_TNIL)return null;
 if(type===lua.LUA_TBOOLEAN)return lua.lua_toboolean(L,index);
 if(type===lua.LUA_TNUMBER)return lua.lua_tonumber(L,index);
 if(type===lua.LUA_TSTRING)return to_jsstring(lua.lua_tostring(L,index));
 if(type===lua.LUA_TTABLE){
  const object={},absolute=lua.lua_absindex(L,index);let count=0,array=true;
  lua.lua_pushnil(L);
  while(lua.lua_next(L,absolute)){
   const key=read(L,-2);object[key]=read(L,-1);count++;
   if(typeof key!=='number'||!Number.isInteger(key)||key<1)array=false;
   lua.lua_pop(L,1);
  }
  return array&&count>0&&Object.keys(object).every(k=>Number(k)<=count)?Array.from({length:count},(_,i)=>object[i+1]):object;
 }
 throw Error('Tipo Lua inesperado: '+type);
}
export function executeLua(script,keys,args,command){
 const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
 function callback(fn){return state=>{try{const values=Array.from({length:lua.lua_gettop(state)},(_,i)=>read(state,i+1));push(state,fn(...values));return 1;}catch(e){lua.lua_pushstring(state,to_luastring(e.message));return lua.lua_error(state);}};}
 function global(name,functions){lua.lua_newtable(L);for(const [key,fn] of Object.entries(functions)){lua.lua_pushcfunction(L,callback(fn));lua.lua_setfield(L,-2,to_luastring(key));}lua.lua_setglobal(L,to_luastring(name));}
 try{
  global('cjson',{decode:JSON.parse,encode:JSON.stringify});
  global('redis',{call:(...commandArgs)=>{const value=command(commandArgs);return Array.isArray(value)?value.map(v=>v??false):value??false;}});
  push(L,keys);lua.lua_setglobal(L,to_luastring('KEYS'));
  push(L,args.map(String));lua.lua_setglobal(L,to_luastring('ARGV'));
  const status=lauxlib.luaL_dostring(L,to_luastring('unpack=table.unpack\n'+script));
  if(status!==lua.LUA_OK)throw Error(to_jsstring(lua.lua_tostring(L,-1)));
  return read(L,-1);
 }finally{lua.lua_close(L);}
}

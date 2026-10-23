
local rows=cjson.decode(ARGV[1])
local received=tonumber(ARGV[2])
local ack={}
for _,r in ipairs(rows) do
 local old=redis.call('HGET',KEYS[2],r.id)
 if not old then
  r.receivedAt=received
  local seq=redis.call('INCR',KEYS[4])
  r.seq=seq
  local encoded=cjson.encode(r)
  redis.call('HSET',KEYS[2],r.id,encoded)
  redis.call('ZADD',KEYS[3],seq,r.id)
  old=encoded
 end
 local saved=cjson.decode(old)
 table.insert(ack,{id=saved.id,receivedAt=saved.receivedAt,seq=saved.seq})
end
for _,k in ipairs(KEYS) do redis.call('EXPIRE',k,ARGV[3]) end
return cjson.encode(ack)

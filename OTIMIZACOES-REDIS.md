# Redução de comandos no Upstash Redis

Esta versão usa o mesmo banco e o mesmo formato de chaves da aplicação Redis original. Não é a versão Supabase.

## O que mudou

- A gravação de um lote consulta os IDs com um único HMGET, reserva sequências com INCRBY e grava as medições com um HSET e um ZADD para o lote inteiro. Antes, havia HGET, INCR, HSET e ZADD para cada medição nova.
- O celular envia lotes a cada 3 segundos, sem diminuir a frequência de captura nem descartar medições.
- O painel consulta aproximadamente a cada 3 segundos, inclusive ocioso. A aba oculta pausa as consultas; retornar à aba retoma o painel.
- Após falha, as tentativas recuam de 30 segundos até 5 minutos. O botão Sincronizar agora permite tentar manualmente.
- A confirmação de envio só altera os registros em memória depois de ser gravada no celular. Uma falha na gravação local mantém o lote pendente para reenvio idempotente.
- A chave de acesso ao Redis continua restrita à função Vercel.

## Resultado medido nos testes

Para um lote de 200 medições novas, o código original executou 806 comandos e esta versão executou 10, contando GET de autorização, EVAL, comandos internos do Lua e renovação das quatro chaves. Isso é aproximadamente 98,8% menos comandos nesse lote de gravação.

Esse resultado não representa uma promessa de redução de 98,8% na conta inteira: tamanho dos lotes, consultas dos painéis, reenvios, regiões e uso de outros aplicativos afetam o total. Apenas agrupar requisições HTTP em pipeline não eliminaria os comandos internos.

A captura continua a mesma. O envio em lotes e a consulta do painel podem acrescentar alguns segundos até uma medição aparecer no PC.

## Como publicar

1. Faça uma cópia do projeto atual para conservar a versão anterior.
2. Atualize o repositório conectado à Vercel com o conteúdo desta pasta, preservando a estrutura api/, public/, package.json e vercel.json. Não envie node_modules.
3. Mantenha o MESMO banco Upstash e o par KV_REST_API_URL/KV_REST_API_TOKEN, ou UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN. Não precisa criar storage novo.
4. Faça Redeploy e recarregue o celular e os painéis do PC no mesmo domínio. Pare a captura antes de recarregar; não limpe os dados do navegador.
5. As sessões e links existentes continuam válidos se o banco ainda contiver suas chaves. Se a sessão tiver expirado ou o banco tiver sido substituído, toque em Sincronizar agora no celular para gerar uma sessão nova e reenviar os registros locais. Nesse caso, copie o novo link para o PC.

## Como conferir o consumo

Feche abas antigas do painel, pois uma página que ainda executa o código anterior continua consultando o banco. Anote o contador de comandos, capture por um período fixo com um único celular e um único painel, e compare com outro período da mesma duração. Considere o atraso de atualização do contador.

Os 2,9 mil comandos da captura correspondem a cerca de 0,58% de uma franquia de 500 mil. Esse contador mede comandos, não o espaço armazenado em bytes.

A retenção dos dados permanece em 7 dias sem novos envios. A otimização não elimina o consumo nem torna o plano ilimitado.

## Validação

Execute npm ci e npm test. Os testes executam o script Lua real em um interpretador com comandos Redis simulados. Eles verificam idempotência, repetição de IDs no mesmo lote, sequência, compatibilidade com chaves antigas, autorização, paginação, fila offline e pausa de consultas.

Não foi publicado um deployment nem feito um teste com seu Upstash real nesta entrega.

Referência sobre contagem de comandos internos do Lua: https://upstash.com/docs/redis/sdks/ratelimit-ts/costs.

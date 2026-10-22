# Versão Redis otimizada

Esta pasta mantém o Upstash Redis. Consulte OTIMIZACOES-REDIS.md para publicar a atualização e entender o consumo. A versão Supabase permanece separada.

# Sensor com dashboard no computador — Vercel

## Atualizar o projeto que já funcionou

1. Substitua os arquivos do projeto pelo conteúdo desta pasta. Publique a pasta inteira que contém api/, public/, package.json e vercel.json. Não publique apenas public/.
2. Na Vercel, abra seu projeto → Storage → Create Database/Browse Marketplace → Upstash for Redis. Crie ou conecte um banco e vincule ao MESMO projeto, incluindo o ambiente Production. Confira o plano e seus limites antes de confirmar.
3. A integração deve adicionar as credenciais em Settings → Environment Variables. Este projeto reconhece:
   - KV_REST_API_URL e KV_REST_API_TOKEN; ou
   - UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN.
   Use o par completo fornecido pela integração. Não use o token read-only. Não coloque credenciais em public/, no Git ou no navegador.
4. Faça Redeploy para aplicar os arquivos e variáveis. Mantenha Framework Other, Output Directory public e Build Command vazio.

A integração de armazenamento injeta credenciais no projeto: https://vercel.com/docs/marketplace-storage
Integração Redis: https://vercel.com/marketplace/upstash/upstash-kv

Sem dependências npm adicionais, túnel, servidor local ou equipamento extra. Há uma função HTTP na Vercel e um Redis externo durável. Não usa arquivo local ou memória da função para compartilhar dados.

## Caminho recomendado: começar pelo celular

1. Abra o MESMO endereço de produção que já funcionou, agora atualizado.
2. Crie/retome sua sessão local e toque em Ativar painel PC.
3. Toque em Copiar link do painel e envie esse link para o computador.
4. No computador, abra o link completo. Ele termina em /dashboard.html#session=...&token=...
5. No celular, autorize, calibre imóvel por 3 s e inicie. As leituras chegam ao painel em poucos segundos.

As sessões locais da versão anterior continuam disponíveis se usar o mesmo domínio e navegador; podem ser enviadas ao painel com Ativar painel PC.

## Alternativa: começar pelo computador

1. Abra https://SEU-PROJETO.vercel.app/dashboard.html.
2. Nomeie a carga e crie uma sessão compartilhada.
3. Copie o link de captura exibido e abra no celular. Copie antes de recarregar o painel: por segurança, o link de visualização não recupera a credencial de escrita.
4. No celular, autorize, calibre e inicie.

Não é necessário estar na mesma rede: o celular pode usar 4G/5G. Use um celular por sessão. Os links completos são as credenciais de acesso: compartilhe somente com as pessoas autorizadas. O dashboard tem credencial de leitura; o celular tem credencial de escrita.

## O que o painel mostra

- X/Y/Z e resultante reais; gráfico das 200 leituras mais recentes.
- Eventos e alerta visual de início de movimento brusco; som opcional ativado pelo usuário.
- Estado de comunicação com o servidor, última leitura, horário recebido e indicação de dados desatualizados após 10 s.
- Estado informado pelo celular (início, encerramento, segundo plano, intervalo de captura).
- Exportação CSV de medições/eventos recebidos no computador. Lista mostra últimos 50 eventos; CSV inclui todos os recebidos.

## Sem internet

O celular mantém as leituras em IndexedDB, mesmo com o painel ativado. A cada 5 s tenta enviar até 3 lotes de 200 registros. Ao retornar a conexão, envia a fila pendente com IDs estáveis. O servidor insere cada ID uma única vez, em uma operação Lua com comandos Redis agrupados, e mantém o primeiro horário de recebimento. O computador consulta novos registros por sequência, sem duplicar o histórico: cerca de 5 s com dados recentes e 30 s ocioso. As consultas ficam suspensas quando a aba está oculta. Em falhas, as tentativas recuam de 30 s até 5 min.

Sem internet no celular, o computador não recebe novas leituras. Com internet apenas no celular, o dashboard recupera o histórico quando for reaberto/conectado. Não feche ou limpe os dados do celular antes de sincronizar. Reabrir a página exige internet. A janela de gravação local é aproximadamente 1 s; fechamento abrupto pode perder o pequeno lote ainda em memória.

O banco remove a sessão após 7 dias sem novos envios. Exporte os CSVs para conservar os registros. Consumo e disponibilidade dependem do plano contratado na Vercel/Upstash. A aplicação não pretende substituir instrumentação industrial.

## Teste rápido

1. Parado: calibre e espere 10 s com o aparelho fixo; resultante próxima de zero.
2. Suave: mova lentamente mantendo orientação; acompanhe o gráfico no PC.
3. Pulso controlado: segure firmemente sobre superfície macia e acelere/desacelere brevemente a mão, sem bater/soltar/arremessar. Ajuste a sensibilidade se necessário.
4. Offline: desligue a internet do celular por 15 s mantendo a tela ligada e a página aberta. O painel deve indicar atraso. Religue: a fila deve diminuir, sem duplicar eventos; horário de ocorrência será anterior ao recebimento.

Mantenha o celular fixado, página visível e tela ligada; posição e orientação influenciam as leituras. Navegador em segundo plano/tela bloqueada podem suspender a captura. O aplicativo tenta Screen Wake Lock quando disponível. Safari/iPhone e Chrome/Android variam em suporte e permissões.

Prioriza aceleração sem gravidade; alternativa usa filtro de 0,8 s, limitado em rotações/acelerações prolongadas. Calibração de 3 s exige ao menos 20 amostras e rejeita RMS vetorial acima de 0,45 m/s². Captura aproximada a 20 Hz e registro a 10 Hz, sujeitos ao navegador; pulsos muito curtos podem não ser capturados.

Sensibilidade S=0..100: limiares de resultante 7−0,05S m/s² E variação vetorial 65−0,5S m/s³. Ambos devem ser atingidos. Fecha após 400 ms abaixo de 60% do limiar de resultante, com intervalo de 1,5 s para reduzir repetição. Duração é aproximada. Alertas indicam movimento brusco, não dano nem força de impacto. Horários de ocorrência dependem do relógio do celular; deixe-o automático.

## Se não conectar

- Erro sobre Upstash: conecte o banco ao projeto/Production, confira os nomes das variáveis acima e faça Redeploy.
- API não encontrada: confirme que api/sync.js está na raiz do projeto ao lado de public e vercel.json. Não configure Root Directory como public.
- Sensores sem dados: abra diretamente no Safari/Chrome, autorize movimento e mantenha primeiro plano/tela ligada.
- Login Vercel antes de abrir a aplicação: verifique a proteção de acesso do deployment na sua conta. A aplicação não exige cadastro próprio.
- Sem leituras novas no PC: confira o envio no celular e a mensagem de última leitura no dashboard. Computador conectado não comprova que o celular esteja capturando.

## Validação desta entrega

    node --test tests/*.test.mjs

Doze testes passaram, incluindo execução do Lua real em interpretador de teste, comparação do número de comandos, compatibilidade com chaves antigas, fila offline, autorização, paginação e intervalos de novas tentativas. Para executar: npm ci e npm test. Redis e sensores são simulados nos testes; não há consumo da sua cota nessa validação.

Os testes usam navegador/sensores e Redis simulados somente no ambiente de teste. Não há modo de demonstração na aplicação. Não houve validação desta integração com um Redis real nem deployment na sua conta Vercel nesta execução. O teste físico da versão anterior foi confirmado por você; esta extensão precisa do banco conectado e Redeploy para ser testada entre os dispositivos.

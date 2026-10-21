# Sensor de movimento — versão simples para Vercel

Esta versão substitui o protótipo anterior. Não execute INICIAR.cmd, servidor Node ou SSH.

## Publicar — um comando

Com Node.js instalado no computador:

1. Extraia o ZIP completo.
2. Abra o terminal na pasta sensor-vercel, onde está vercel.json.
3. Execute:

    npx vercel --prod

Se pedir instalação da CLI, confirme. Faça login na SUA conta Vercel e confirme a criação do projeto. A configuração do arquivo vercel.json define site estático e pasta public. Não configure variáveis de ambiente, banco ou comando de build.

O comando imprime o endereço HTTPS de produção. Abra esse endereço diretamente no Safari/Chrome do celular. Use o endereço da aplicação publicada, não o painel administrativo da Vercel.

Alternativa: suba o conteúdo da pasta em um repositório GitHub e importe na Vercel. Framework: Other. Root Directory: pasta que contém vercel.json. Output Directory: public. Build Command: vazio. Se houver proteção de acesso, ajuste a proteção do deployment na sua conta para permitir o teste no celular; a aplicação em si não possui login.

## Usar no celular

1. Digite o nome e toque em Criar sessão.
2. Toque em Autorizar sensor e aceite a permissão.
3. Apoie/fixe o celular, toque em Calibrar e mantenha imóvel por 3 segundos.
4. Toque em Iniciar. Observe X, Y, Z, resultante e gráfico.
5. Toque em Encerrar e exporte os dois CSVs para guardar/compartilhar.

Deixe a página visível e a tela ligada. A aplicação tenta impedir o bloqueio se o navegador permitir. Tela bloqueada/segundo plano podem suspender o sensor. Chrome Android e Safari iPhone são candidatos ao teste; não há garantia de suporte em todos os dispositivos. Se o sensor não fornecer leituras válidas, a interface informa isso e bloqueia o início.

## Três verificações

- Parado: após calibrar, inicie e espere 10 segundos. Resultante próxima de zero, com ruído pequeno.
- Suave: desloque lentamente o suporte mantendo a orientação; acompanhe o gráfico e a ausência de alertas na sensibilidade padrão.
- Pulso controlado: segure firmemente sobre superfície macia e faça uma curta aceleração/desaceleração da mão. Não bata, solte ou arremesse o aparelho. Aumente a sensibilidade se necessário.

O alerta indica padrão de movimento brusco; não mede força de impacto nem comprova dano.

## O que esta versão faz

- Acelerômetro real; sem GPS ou demonstração na aplicação.
- Sessões locais neste navegador, guardadas em IndexedDB e selecionáveis para retomar/exportar. O código da sessão identifica o registro local e não conecta outro aparelho.
- Registros persistidos aproximadamente a cada segundo. Uma interrupção abrupta pode perder o pequeno lote ainda em memória. Limpar dados do navegador remove as sessões; exporte o CSV.
- A página já carregada pode seguir registrando sem internet, enquanto o navegador permitir. Não há sincronização com servidor. Reabrir a página exige internet e nova calibração.
- Prioriza acceleration sem gravidade, com viés estimado em repouso. Caso indisponível, usa accelerationIncludingGravity e filtro de gravidade passa-baixa de 0,8 s. Rotações e acelerações prolongadas podem gerar desvios nesse método alternativo.
- Calibração exige pelo menos 20 amostras em 3 s e rejeita desvio vetorial RMS acima de 0,45 m/s².
- Processamento aproximado a 20 Hz e gravação a 10 Hz, sujeito ao navegador. Pulsos curtos podem não ser capturados.
- Sensibilidade S: limiar de aceleração 7 − 0,05 S m/s²; limiar da variação vetorial 65 − 0,5 S m/s³. Ambos devem ser ultrapassados. Padrão S=50: 4,5 m/s² e 40 m/s³.
- Evento encerra 400 ms após a última leitura acima de 60% do limite; intervalo de 1,5 s reduz repetições. Duração aproximada entre primeiro disparo e última leitura acima do limite de manutenção. Parada manual e interrupção de captura marcam evento como parcial no CSV.
- Horários vêm do relógio do celular. Não há horário de recebimento de servidor porque não há envio.
- A lista mostra os 30 eventos mais recentes e o gráfico as 150 amostras mais recentes. O CSV inclui todo o registro da sessão. Projetado para testes curtos; histórico completo fica em memória durante uso.

## Verificação

Sem dependências ou build. Sintaxe conferida e dois testes automatizados passaram, incluindo fluxo de sessão, autorização, calibração, pulso, gravação e retomada, usando sensor e armazenamento simulados SOMENTE nos testes:

    node --test tests/sensor.test.mjs

Não houve teste físico em celular nem validação visual em navegador nesta execução. Nenhum deployment na sua conta Vercel foi realizado por esta conversa; o pacote está pronto para você publicar.

# Preparação do ranking histórico CFF

Pedido do Matheus em 20/10/2026: preparar o futuro ranking histórico enquanto
chegam os torneios antigos, incluindo Copa América, FFCS Americas e World Cup.
Este documento é o ponto de continuação para qualquer chat trabalhando no projeto.

## Estado atual

O ranking anual de 2025/2026 está publicado. O histórico está em preparação:
**nenhuma classificação histórica foi calculada ou publicada**. Não implementar
uma tabela com aparência definitiva enquanto faltam eventos e metodologia.

`ranking-data/historico-catalogo.json` registra as fontes disponíveis por edição
e as famílias que ainda aguardam material. Não é consumido pela página pública.
Cada edição tem um ID único; diferentes arquivos ou fases podem ser fontes do
mesmo evento. O inventário é inicial, não prova que todos os torneios de um ano
estão cadastrados. `reviewStatus: pending` indica revisão para o histórico,
não um problema no torneio ou no ranking anual já existente.

## Arquitetura prevista

| Camada | Conteúdo / responsabilidade |
| --- | --- |
| Fontes existentes | Arquivos de torneios, classificações completas, datas e participantes; reaproveitar sem duplicar toda a base |
| Catálogo por edição | Identidade única do evento, família, fontes e cobertura revisada |
| Identidade das equipes | ID estável da organização, nomes usados em cada época e aliases com período de validade |
| Metodologia versionada | Faixas de colocação, pesos por competição/época e regras de desempate explícitas |
| Geração offline | Validar e somar resultados uma vez, fora do navegador; registrar fontes e hashes |
| Resumos públicos futuros | Total compacto; campanhas de uma equipe carregadas somente ao abrir seus detalhes |

O histórico deve usar **resultados por competição**, e não simplesmente somar os
rankings anuais. Uma mudança na metodologia histórica não deve alterar o anual.
O gerador atual `scripts/build-annual-ranking.cjs` é referência de validação,
não um leitor universal: ele contém adaptações próprias de 2025/2026 e formatos
com 12 finalistas. Campeonatos antigos podem ter outros formatos e tamanhos.

Sem Firebase, Durable Objects, polling ou varredura de arquivos de torneios por
visitante. A soma deve ser pré-calculada, os recortes pequenos e os detalhes
carregados por demanda com cache. Cards devem compartilhar os dados já abertos.

## Conferências antes de contar um torneio

1. Confirmar edição, disciplina, datas, participantes e encerramento.
2. Reconciliar a classificação geral com todas as fases: quem caiu antes da
   final também precisa de resultado. A tabela da final sozinha pode ser parcial.
3. Preservar colocações oficiais, empates e campeão do Champion Rush; não ordenar
   tudo novamente pelo total bruto de pontos das partidas.
4. Identificar a equipe que conquistou o resultado naquela data. Mudança de
   jogadores não transfere pontos para outra organização. Rebrands e fusões
   precisam de decisão documentada, não de aliases globais automáticos.
5. Exigir confirmação de cobertura e perfil de pontuação antes de incluir a edição.
   Fonte ausente ou incompleta é pendência, nunca derrota ou pontuação zero.
6. Contar a edição uma única vez. Grupos, Point Rush, repescagem e final pertencem
   ao mesmo evento; referências duplicadas a Overview e Knockout não são edições.
7. Separar Battle Royale de Clash Squad, showmatches e qualificatórias. A eventual
   inclusão de cada tipo precisa fazer parte da metodologia aprovada.

### Casos que já exigem cuidado

- Em 2025, **Fluxo e W7M Esports disputaram separadamente**. O alias FLUXO W7M
  usado em uma fonte antiga não autoriza juntar as duas organizações em todo ano.
- A World Cup antiga e a **Esports World Cup (EWC)** são famílias distintas.
- FFCS Americas deve manter seu cadastro próprio; sem convertê-la em FFWS apenas
  pela semelhança dos nomes ou pelo período sem Mundial presencial.
- O recorte EWC 2025 usado no anual contém somente brasileiros. Para um histórico
  mundial, seria necessário cadastrar os demais participantes/resultados.
- A EWC 2026 tem arquivo de final: conferir cobertura dos eliminados antes dela.
- LBFF 1 tem arquivo local sem linhas em `final.rows`: conferir as outras seções
  e o contexto da edição antes de determinar se há resultado que possa pontuar.
- Global 2026 só poderá entrar encerrado; a validação do anual já cobre as 24
  posições com final, repescagem e eliminações na primeira fase.

## Decisões para quando o material estiver completo

- Alcance: equipes brasileiras ou todas as regiões; início e fim do período.
- Competições elegíveis, incluindo regionais antigos e eventos independentes.
- Pesos de Copa América, FFCS, World Cup e outras famílias. Os pesos do anual
  são referência; nenhum peso novo está aprovado por esta preparação.
- Comparação de épocas: soma absoluta de conquistas e/ou recorte por era, sem
  esconder que o número de torneios e de participantes muda ao longo dos anos.
- Empates, desclassificações, edições interrompidas e continuidade de organizações.

## Como continuar quando chegarem os arquivos

1. Ler `docs/MAPA-DADOS.md` e este guia; conferir o catálogo existente.
2. Receber os arquivos por edição; manter Overview, Knockout e demais páginas
   agrupados, com origem e separação explícitas (o ZIP do organizador serve).
3. Extrair participantes, classificação geral, datas e informações essenciais.
   Guardar o código-fonte como evidência; publicar apenas JSON normalizado.
4. Comparar com o catálogo antes de criar um novo ID. Acrescentar fontes à edição
   existente quando se tratar do mesmo torneio.
5. Revisar classificações e identidades por pequenos lotes, como nos Mundiais.
   Anotar exatamente o que faltar e confirmar as decisões de pontuação.
6. Depois da revisão/metodologia, construir o gerador e a página usando a
   identidade visual e o editor de cards já existentes. Exibir cobertura e versão
   para o usuário entender quais torneios estão contabilizados.

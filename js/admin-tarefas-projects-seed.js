(() => {
  'use strict';
  const companies = [];
  function company(id, name, networks) { companies.push({id,name,networks}); }
  function network(name, fields) { return {name,fields}; }
  const field = (label,text) => ({label,text});
  company('bms','BMS&Co.',[
    network('LinkedIn',[field('Chamada','Grupo empresarial que conecta marcas, competências e oportunidades de negócio.'),field('Sobre',`A BMS&Co. é um grupo empresarial brasileiro que reúne empresas especializadas e negócios próprios em diferentes áreas de atuação.

Conectamos estratégia, gestão e capital para desenvolver negócios com visão de longo prazo. Nosso modelo combina a autonomia de cada marca com uma estrutura compartilhada de suporte e colaboração.

Conheça nossas empresas e converse conosco sobre projetos, parcerias e oportunidades de investimento.`)]),
    network('Instagram',[field('Nome','BMS&Co. • Grupo empresarial'),field('Bio',`Grupo empresarial que conecta marcas e desenvolve negócios.
Estratégia, gestão e capital.
Conheça nossas empresas ↓`)]),
    network('Facebook',[field('Apresentação','Grupo empresarial que conecta marcas, competências e oportunidades de negócio.')])
  ]);
  company('abcm','ABCM',[
    network('LinkedIn',[field('Chamada','Comunicação e marketing com estratégia, criatividade e visão de negócio. Uma marca do grupo BMS.'),field('Sobre',`A ABCM é a Agência Brasileira de Comunicação e Marketing. Unimos estratégia, criatividade e execução para desenvolver projetos de comunicação alinhados aos desafios de marcas e negócios.

Atuamos em estratégia de marca, criação de campanhas, conteúdo e social, experiências e ativações, inteligência e performance.

Uma marca do grupo BMS.`)]),
    network('Instagram',[field('Nome','ABCM • Comunicação e Marketing'),field('Bio',`Comunicação e marketing para marcas e negócios.
Estratégia, criação e execução.
Uma marca do grupo BMS
Conheça nossas soluções ↓`)]),
    network('Facebook',[field('Apresentação','Comunicação, marketing e criação com visão de negócio. Uma marca do grupo BMS.')])
  ]);
  company('clan','CLAN',[
    network('LinkedIn',[field('Chamada','Produção audiovisual, eventos e transmissões ao vivo. Uma marca do grupo BMS.'),field('Sobre',`A Clan é uma produtora audiovisual com atuação em eventos, transmissões e conteúdo ao vivo para marcas e creators.

Reunimos competências de produção e operação técnica para realizar projetos de diferentes formatos, incluindo eventos e competições de esports.

Uma marca do grupo BMS.`)]),
    network('Instagram',[field('Nome','Clan • Produção Audiovisual'),field('Bio',`Produção audiovisual, eventos e transmissões ao vivo.
Uma marca do grupo BMS
Vamos produzir seu próximo projeto ↓`)]),
    network('Facebook',[field('Apresentação','Produção audiovisual, eventos e transmissões ao vivo. Uma marca do grupo BMS.')])
  ]);
  company('outlane','OUTLANE',[
    network('Behance',[field('Descrição',`Outlane is a Brazil-based creative production studio working with global brands.

Our work spans visual identity, design, video editing, motion graphics and broadcast design.

Explore our projects and get in touch.
outlanestudio.com

A BMS company.`)]),
    network('Vimeo',[field('Descrição',`Design in motion. Stories on screen.

Explore Outlane’s video, motion graphics and broadcast portfolio.

Based in Brazil. Working with global brands.
outlanestudio.com

A BMS company.`)]),
    network('LinkedIn',[field('Chamada','Brazil-based creative production for global brands. Design, video, motion and broadcast. A BMS company.'),field('About',`Outlane is a creative production studio based in Brazil, working with brands internationally.

We bring design, video editing, motion graphics and broadcast design together in one dedicated team. With deliverables in English and a defined monthly scope, we help brands meet their creative production needs without building an entire in-house team.

A BMS company.`)]),
    network('Instagram',[field('Nome','Outlane • Creative Production'),field('Bio',`Your creative team in Brazil.
Design, video, motion & broadcast.
A BMS company
Explore our work ↓`)]),
    network('Facebook',[field('Apresentação','Brazil-based creative production for global brands. A BMS company.')])
  ]);
  company('thrive','THRIVE',[
    network('LinkedIn',[field('Chamada','Marketing de performance para aquisição e crescimento. Uma marca do grupo BMS.'),field('Sobre',`A Thrive atua em marketing de performance, conectando mídia, dados e objetivos de aquisição.

Desenvolvemos ações orientadas pelas necessidades de cada negócio, com foco em acompanhar o desempenho e identificar oportunidades de otimização.

Uma marca do grupo BMS.`)]),
    network('Instagram',[field('Nome','Thrive • Marketing de Performance'),field('Bio',`Marketing de performance para aquisição e crescimento.
Uma marca do grupo BMS
Conheça nossas soluções ↓`)]),
    network('Facebook',[field('Apresentação','Marketing de performance para aquisição e crescimento. Uma marca do grupo BMS.')])
  ]);
  company('bhive','BHIVE',[
    network('LinkedIn',[field('Chamada','Gestão comercial de creators e talentos. Uma marca do grupo BMS.'),field('Sobre',`A Bhive atua na gestão comercial de creators e influenciadores, conectando talentos e marcas para desenvolver oportunidades de parceria.

Nosso trabalho aproxima a identidade de cada creator dos objetivos de comunicação e negócio dos parceiros.

Uma marca do grupo BMS.`)]),
    network('Instagram',[field('Nome','Bhive • Creators e Talentos'),field('Bio',`Gestão comercial de creators e talentos.
Uma marca do grupo BMS
Marcas e creators: conecte-se ↓`)]),
    network('Facebook',[field('Apresentação','Gestão comercial de creators e conexão com marcas. Uma marca do grupo BMS.')])
  ]);
  company('nfa','NFA',[
    network('TikTok',[field('Bio',`Jogadas, bastidores e competições da NFA.
Uma marca do grupo BMS`)]),
    network('X',[field('Bio','Esports, competições e comunidade. Acompanhe os campeonatos, os resultados e as novidades da NFA. Uma marca do grupo BMS.')]),
    network('YouTube',[field('Descrição',`Competições, transmissões e conteúdo de esports.

Acompanhe os campeonatos da NFA, os confrontos e os momentos que movimentam nossa comunidade.

Inscreva-se e confira a programação do canal.

Uma marca do grupo BMS.
Para parcerias, acesse nosso site oficial.`)]),
    network('Kick',[field('Descrição',`Competições e transmissões ao vivo da NFA.

Acompanhe os confrontos e participe da comunidade.

Uma marca do grupo BMS.`)]),
    network('LinkedIn',[field('Chamada','Competições, conteúdo e comunidade de esports. Uma marca do grupo BMS.'),field('Sobre',`A NFA atua no universo dos esports, reunindo competições, conteúdo e comunidade.

Conectamos jogadores, público e marcas por meio de campeonatos, transmissões e projetos ligados à cultura dos games.

Uma marca do grupo BMS. Entre em contato para conhecer as possibilidades de parceria.`)]),
    network('Instagram',[field('Nome','NFA • Esports'),field('Bio',`Esports, competições e comunidade.
Uma marca do grupo BMS
Acompanhe os campeonatos e as transmissões ↓`)]),
    network('Facebook',[field('Apresentação','Competições, conteúdo e comunidade de esports. Uma marca do grupo BMS.')])
  ]);
  company('mmr','MMR',[
    network('TikTok',[field('Bio',`Free Fire, ranking e comunidade.
Uma marca do grupo BMS`)]),
    network('X',[field('Bio','Matchmaking, ranking e comunidade de Free Fire. Acompanhe as novidades da MMR. Uma marca do grupo BMS.')]),
    network('YouTube',[field('Descrição',`Conheça a MMR, plataforma de matchmaking e ranking de Free Fire.

Acompanhe novidades, conteúdos sobre a plataforma e o universo competitivo da comunidade.

Uma marca do grupo BMS.
Acesse: mmranking.com`)]),
    network('LinkedIn',[field('Chamada','Tecnologia de matchmaking e ranking para o Free Fire competitivo. Uma marca do grupo BMS.'),field('Sobre',`A MMR é uma plataforma de matchmaking e ranking voltada ao Free Fire competitivo.

Conectamos jogadores e organizamos experiências de competição, com recursos para acompanhar rankings e participar da comunidade.

Uma marca do grupo BMS.`)]),
    network('Instagram',[field('Nome','MMR • Matchmaking e Ranking'),field('Bio',`Matchmaking e ranking de Free Fire.
Uma marca do grupo BMS
Conheça a plataforma ↓`)]),
    network('Facebook',[field('Apresentação','Plataforma de matchmaking e ranking de Free Fire. Uma marca do grupo BMS.')])
  ]);
  company('mundo-sinuca','MUNDO DA SINUCA',[
    network('TikTok',[field('Bio',`Jogadas, disputas e histórias da sinuca.
Uma marca do grupo BMS`)]),
    network('YouTube',[field('Descrição',`O encontro de quem joga, acompanha e vive a sinuca.

Assista às competições, acompanhe os confrontos e conheça as histórias e os protagonistas do esporte.

Inscreva-se e confira a programação das transmissões.

Uma marca do grupo BMS.
Marcas e parceiros: consulte o link comercial do canal.`)]),
    network('Instagram',[field('Nome','Mundo da Sinuca'),field('Bio',`Jogos, competições e histórias da sinuca.
Uma marca do grupo BMS
Acompanhe os jogos ou anuncie com a gente ↓`)]),
    network('Facebook',[field('Apresentação','Jogos, competições e histórias para quem vive a sinuca. Uma marca do grupo BMS.')])
  ]);
  company('grupo-sinuca','GRUPO SINUCA — INSTITUCIONAL',[
    network('LinkedIn',[field('Chamada','Competições, conteúdo e oportunidades de parceria na sinuca. Uma marca do grupo BMS.'),field('Sobre',`O Grupo Sinuca atua no desenvolvimento de competições, conteúdo e comunidade em torno da sinuca.

Conectamos o esporte, seus protagonistas e o público, criando oportunidades para marcas participarem desse universo por meio de projetos e parcerias.

Uma marca do grupo BMS. Conheça nossas iniciativas e possibilidades comerciais.`)])
  ]);
  company('blackframe','BLACKFRAME STUDIOS',[
    network('YouTube',[field('Descrição',`Conheça a BlackFrame Studios: espaços para gravações, lives e eventos na Lapa, em São Paulo.

Explore os ambientes e as possibilidades de produção para o seu próximo projeto.

Uma marca do grupo BMS.
Visitas e orçamentos: blackframestudios.com.br`)]),
    network('LinkedIn',[field('Chamada','Estúdios para produções audiovisuais e eventos em São Paulo. Uma marca do grupo BMS.'),field('Sobre',`A BlackFrame Studios oferece espaços para locação na Lapa, em São Paulo, para gravações, transmissões ao vivo e eventos corporativos.

Com dois estúdios, recebe projetos como podcasts, videocasts, campanhas, cursos e apresentações. Equipamentos e equipe técnica podem ser contratados conforme as necessidades da produção.

Uma marca do grupo BMS. Conheça os espaços e agende uma visita.`)]),
    network('Instagram',[field('Nome','BlackFrame Studios • Locação'),field('Bio',`Estúdios para locação na Lapa, SP.
Gravações, lives e eventos.
Uma marca do grupo BMS
Agende sua visita ↓`)]),
    network('Facebook',[field('Apresentação','Estúdios para gravações, lives e eventos na Lapa, SP. Uma marca do grupo BMS.')])
  ]);
  window.CFF_TASKS_PROJECTS_SEED = {id:'bms-social-20261008',name:'Atualização das redes sociais',description:'Grupo BMS · Textos recebidos em 08/10/2026',companies};
})();

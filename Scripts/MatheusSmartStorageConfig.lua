return {
    VERSION = "0.1.1",

    -- Automático: se um baú recebe um item que já existia em outro baú,
    -- move APENAS o que entrou agora para o baú que já tinha mais desse item.
    AUTO_ENABLED = true,
    AUTO_INTERVAL_MS = 4000,
    MAX_AUTO_MOVES_PER_TICK = 2,

    -- Segurança: espaça RPCs para não bombardear o jogo/servidor.
    MOVE_DELAY_MS = 1200,
    AFTER_MOVE_SETTLE_MS = 1800,
    MAX_MANUAL_MOVES_PER_RUN = 30,

    -- Ctrl+Shift+J = juntar itens repetidos no baú que já tem a maior quantidade.
    DEBUG = true,
}

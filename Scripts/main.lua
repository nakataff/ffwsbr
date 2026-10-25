local MOD = "MatheusSmartStorage"

local okHelpers, UEHelpers = pcall(require, "UEHelpers")
local okConfig, CONFIG = pcall(require, "MatheusSmartStorageConfig")
if not okConfig or type(CONFIG) ~= "table" then
    CONFIG = {
        VERSION = "0.1.1",
        AUTO_ENABLED = true,
        AUTO_INTERVAL_MS = 4000,
        MAX_AUTO_MOVES_PER_TICK = 2,
        MOVE_DELAY_MS = 1200,
        AFTER_MOVE_SETTLE_MS = 1800,
        MAX_MANUAL_MOVES_PER_RUN = 30,
        DEBUG = true,
    }
end

local busy = false
local baseline = nil
local lastBaseKey = nil
local guidLibrary = nil
local warned = {}
local rngSeeded = false

local function log(msg)
    print(string.format("[%s] %s\n", MOD, tostring(msg)))
end

local function debuglog(msg)
    if CONFIG.DEBUG then log(msg) end
end

local function warn_once(key, msg)
    if warned[key] then return end
    warned[key] = true
    log("AVISO: " .. msg)
end

local function safe_valid(obj)
    if obj == nil then return false end
    local ok, valid = pcall(function() return obj:IsValid() end)
    return ok and valid == true
end

local function safe_full_name(obj)
    if not safe_valid(obj) then return "<invalid>" end
    local ok, name = pcall(function() return obj:GetFullName() end)
    return ok and tostring(name) or "<unknown>"
end

local function get_player_controller()
    if okHelpers and UEHelpers then
        local ok, pc = pcall(function() return UEHelpers:GetPlayerController() end)
        if ok and safe_valid(pc) then return pc end
    end
    local ok, pc = pcall(function() return FindFirstOf("PalPlayerController") end)
    if ok and safe_valid(pc) then return pc end
    return nil
end

local function get_player_location(pc)
    if not safe_valid(pc) then return nil end
    local okPawn, pawn = pcall(function() return pc.Pawn end)
    if not okPawn or not safe_valid(pawn) then return nil end
    local okLoc, loc = pcall(function() return pawn:K2_GetActorLocation() end)
    return okLoc and loc or nil
end

local function get_current_base(pc)
    local loc = get_player_location(pc)
    if not loc then return nil end
    local okMgr, manager = pcall(function() return FindFirstOf("PalBaseCampManager") end)
    if not okMgr or not safe_valid(manager) then return nil end
    local okBase, base = pcall(function() return manager:GetInRangedBaseCamp(loc, 0.0) end)
    if okBase and safe_valid(base) then return base end
    return nil
end

local function guid_key_from_guid(guid)
    if guid == nil then return nil end
    local ok, a, b, c, d = pcall(function()
        return guid.A, guid.B, guid.C, guid.D
    end)
    if not ok then return nil end
    if a == nil or b == nil or c == nil or d == nil then return nil end
    if tonumber(a) == 0 and tonumber(b) == 0 and tonumber(c) == 0 and tonumber(d) == 0 then return nil end
    return table.concat({tostring(a), tostring(b), tostring(c), tostring(d)}, ":")
end

local function container_key(containerId)
    if containerId == nil then return nil end
    local ok, guid = pcall(function() return containerId.ID end)
    if not ok then return nil end
    return guid_key_from_guid(guid)
end

local function base_key(base)
    if not safe_valid(base) then return nil end
    local ok, guid = pcall(function() return base:GetId() end)
    if not ok then return nil end
    return guid_key_from_guid(guid)
end

local function enum_is_normal_chest(value)
    local s = tostring(value or "")
    if s:find("GuildChest", 1, true) or s:find("ItemBoothStore", 1, true) or s:find("Other", 1, true) then
        return false
    end
    if s:find("Chest", 1, true) then return true end
    local n = tonumber(s)
    return n == 0 -- EPalBaseCampItemContainerType::Chest no SDK atual
end

local function find_storage_module(base)
    if not safe_valid(base) then return nil end
    local okArray, modules = pcall(function() return base.ModuleArray end)
    if not okArray or modules == nil then return nil end
    for i = 1, #modules do
        local module = modules[i]
        if safe_valid(module) then
            local okInfos, infos = pcall(function() return module.ContainerInfos end)
            if okInfos and infos ~= nil then
                return module
            end
        end
    end
    return nil
end

local function get_chest_container_ids(base)
    local storageModule = find_storage_module(base)
    if not storageModule then
        return nil, "módulo de armazenamento da base não encontrado"
    end

    local okInfos, infos = pcall(function() return storageModule.ContainerInfos end)
    if not okInfos or infos == nil then
        return nil, "ContainerInfos indisponível"
    end

    local ids = {}
    local seen = {}
    for i = 1, #infos do
        local info = infos[i]
        local okType, chestType = pcall(function() return info.Type end)
        if okType and enum_is_normal_chest(chestType) then
            local okId, cid = pcall(function() return info.ContainerIdCache end)
            if okId and cid ~= nil then
                local key = container_key(cid)
                if key and not seen[key] then
                    seen[key] = true
                    ids[#ids + 1] = { key = key, id = cid }
                end
            end
        end
    end

    if #ids == 0 then
        return nil, "nenhum baú normal com ContainerId válido foi encontrado"
    end
    return ids, nil
end

local function get_item_manager()
    local ok, manager = pcall(function() return FindFirstOf("PalItemContainerManager") end)
    if ok and safe_valid(manager) then return manager end
    return nil
end

local function get_item_name(slot)
    local okId, itemId = pcall(function() return slot:GetItemId() end)
    if not okId or itemId == nil then return nil end
    local okStatic, staticId = pcall(function() return itemId.StaticId end)
    if not okStatic or staticId == nil then return nil end
    local okStr, value = pcall(function() return staticId:ToString() end)
    local s = okStr and tostring(value) or tostring(staticId)
    if s == "" or s == "None" or s == "NAME_None" then return nil end
    return s
end

local function snapshot_chest(manager, entry)
    local okContainer, container = pcall(function() return manager:GetContainer(entry.id) end)
    if not okContainer or not safe_valid(container) then return nil end

    local chest = {
        key = entry.key,
        id = entry.id,
        totals = {},
        slots = {},
    }

    local okNum, num = pcall(function() return container:Num() end)
    if not okNum or type(num) ~= "number" or num < 0 or num > 1000 then return nil end

    for index = 0, num - 1 do
        local okSlot, slot = pcall(function() return container:Get(index) end)
        if okSlot and safe_valid(slot) then
            local okEmpty, empty = pcall(function() return slot:IsEmpty() end)
            if okEmpty and not empty then
                local okCount, count = pcall(function() return slot:GetStackCount() end)
                local item = get_item_name(slot)
                count = okCount and tonumber(count) or 0
                if item and count and count > 0 then
                    chest.totals[item] = (chest.totals[item] or 0) + count
                    chest.slots[item] = chest.slots[item] or {}
                    chest.slots[item][#chest.slots[item] + 1] = {
                        index = index,
                        count = count,
                    }
                end
            end
        end
    end

    return chest
end

local function build_snapshot()
    local pc = get_player_controller()
    if not pc then return nil, "player controller ainda não está pronto" end

    local base = get_current_base(pc)
    if not base then return nil, "fique dentro do raio da base para usar o mod" end

    local ids, idsErr = get_chest_container_ids(base)
    if not ids then return nil, idsErr end

    local manager = get_item_manager()
    if not manager then return nil, "PalItemContainerManager não encontrado" end

    local snap = {
        base = base,
        baseKey = base_key(base) or safe_full_name(base),
        chests = {},
        byKey = {},
    }

    for _, entry in ipairs(ids) do
        local chest = snapshot_chest(manager, entry)
        if chest then
            snap.chests[#snap.chests + 1] = chest
            snap.byKey[chest.key] = chest
        end
    end

    if #snap.chests == 0 then
        return nil, "IDs da base foram encontrados, mas nenhum container pôde ser lido"
    end

    return snap, nil
end

local function counts_only(snap)
    local out = { baseKey = snap.baseKey, chests = {} }
    for _, chest in ipairs(snap.chests) do
        local copy = {}
        for item, amount in pairs(chest.totals) do copy[item] = amount end
        out.chests[chest.key] = copy
    end
    return out
end

local function plan_manual(snap)
    local byItem = {}
    for _, chest in ipairs(snap.chests) do
        for item, amount in pairs(chest.totals) do
            if amount > 0 then
                byItem[item] = byItem[item] or {}
                byItem[item][#byItem[item] + 1] = { chest = chest, amount = amount }
            end
        end
    end

    local ops = {}
    for item, holders in pairs(byItem) do
        if #holders >= 2 then
            table.sort(holders, function(a, b)
                if a.amount == b.amount then return a.chest.key < b.chest.key end
                return a.amount > b.amount
            end)
            local target = holders[1]
            for i = 2, #holders do
                local source = holders[i]
                ops[#ops + 1] = {
                    mode = "manual",
                    item = item,
                    sourceKey = source.chest.key,
                    targetKey = target.chest.key,
                    amount = source.amount,
                    sourceBefore = source.amount,
                    targetBefore = target.amount,
                }
            end
        end
    end

    table.sort(ops, function(a, b)
        if a.item == b.item then return a.amount > b.amount end
        return a.item < b.item
    end)
    return ops
end

local function plan_auto(previous, snap)
    if not previous or previous.baseKey ~= snap.baseKey then return {} end
    local ops = {}

    for _, source in ipairs(snap.chests) do
        local oldChest = previous.chests[source.key] or {}
        for item, currentAmount in pairs(source.totals) do
            local before = oldChest[item] or 0
            local delta = currentAmount - before
            if delta > 0 then
                -- O destino é decidido pelo estado ANTES do depósito.
                -- Se o baú que recebeu já era o principal daquele item, não mexe.
                local bestKey = nil
                local bestAmount = 0
                for chestKey, oldTotals in pairs(previous.chests) do
                    local amount = oldTotals[item] or 0
                    if amount > bestAmount or (amount == bestAmount and amount > 0 and (bestKey == nil or chestKey < bestKey)) then
                        bestKey = chestKey
                        bestAmount = amount
                    end
                end

                if bestKey and bestAmount > 0 and bestKey ~= source.key and snap.byKey[bestKey] then
                    ops[#ops + 1] = {
                        mode = "auto",
                        item = item,
                        sourceKey = source.key,
                        targetKey = bestKey,
                        amount = delta,
                        sourceBefore = currentAmount,
                        targetBefore = bestAmount,
                    }
                end
            end
        end
    end

    table.sort(ops, function(a, b)
        if a.amount == b.amount then return a.item < b.item end
        return a.amount > b.amount
    end)
    return ops
end

local function get_network_item(pc)
    if not safe_valid(pc) then return nil end
    local okTransmitter, transmitter = pcall(function() return pc.Transmitter end)
    if not okTransmitter or not safe_valid(transmitter) then return nil end
    local okItem, item = pcall(function() return transmitter:GetItem() end)
    if okItem and safe_valid(item) then return item end
    return nil
end

local function seed_rng_once()
    if rngSeeded then return end
    rngSeeded = true
    local seed = os.time()
    pcall(function() math.randomseed(seed) end)
end

local function new_request_guid()
    if not safe_valid(guidLibrary) then
        local ok, obj = pcall(function()
            return StaticFindObject("/Script/Engine.Default__KismetGuidLibrary")
        end)
        if ok and safe_valid(obj) then guidLibrary = obj end
    end
    if safe_valid(guidLibrary) then
        local ok, guid = pcall(function() return guidLibrary:NewGuid() end)
        if ok and guid ~= nil then return guid end
    end

    seed_rng_once()
    return {
        A = math.random(1, 2147483646),
        B = math.random(1, 2147483646),
        C = math.random(1, 2147483646),
        D = math.random(1, 2147483646),
    }
end

local function resolve_fresh_operation(op)
    local snap, err = build_snapshot()
    if not snap then return nil, err end
    local source = snap.byKey[op.sourceKey]
    local target = snap.byKey[op.targetKey]
    if not source or not target or source.key == target.key then
        return nil, "origem/destino não existem mais"
    end
    if (target.totals[op.item] or 0) <= 0 then
        return nil, "o destino não contém mais " .. op.item
    end
    local available = source.totals[op.item] or 0
    if available <= 0 then return nil, "origem já não contém " .. op.item end

    local moveAmount = math.min(available, tonumber(op.amount) or available)
    if moveAmount <= 0 then return nil, "quantidade inválida" end

    local manager = get_item_manager()
    if not manager then return nil, "PalItemContainerManager não encontrado" end
    local okContainer, container = pcall(function() return manager:GetContainer(source.id) end)
    if not okContainer or not safe_valid(container) then return nil, "container de origem indisponível" end

    local froms = {}
    local remaining = moveAmount
    local okNum, num = pcall(function() return container:Num() end)
    if not okNum or type(num) ~= "number" then return nil, "não consegui ler slots da origem" end

    for index = 0, num - 1 do
        if remaining <= 0 then break end
        local okSlot, slot = pcall(function() return container:Get(index) end)
        if okSlot and safe_valid(slot) and get_item_name(slot) == op.item then
            local okCount, count = pcall(function() return slot:GetStackCount() end)
            count = okCount and tonumber(count) or 0
            if count and count > 0 then
                local take = math.min(count, remaining)
                local okSid, slotId = pcall(function() return slot:GetSlotId() end)
                if okSid and slotId ~= nil then
                    froms[#froms + 1] = { SlotId = slotId, Num = take }
                    remaining = remaining - take
                end
            end
        end
    end

    if #froms == 0 then return nil, "nenhum slot válido para mover" end
    return {
        pc = get_player_controller(),
        target = target,
        froms = froms,
        requested = moveAmount - remaining,
    }, nil
end

local function perform_operation(op)
    local resolved, err = resolve_fresh_operation(op)
    if not resolved then
        debuglog(string.format("SKIP %s: %s", tostring(op.item), tostring(err)))
        return false
    end

    local net = get_network_item(resolved.pc)
    if not net then
        warn_once("netitem", "componente de rede de itens não encontrado; nenhuma movimentação foi enviada")
        return false
    end

    local requestId = new_request_guid()
    local ok, rpcErr = pcall(function()
        net:RequestMoveToContainer_ToServer(requestId, resolved.target.id, resolved.froms)
    end)
    if not ok then
        log(string.format("ERRO RPC %s: %s", tostring(op.item), tostring(rpcErr)))
        return false
    end

    log(string.format(
        "%s: solicitado mover %d x %s para o baú que já tinha mais",
        op.mode == "auto" and "AUTO" or "JUNTAR",
        resolved.requested,
        tostring(op.item)
    ))
    return true
end

local function schedule_game(ms, fn)
    if type(ExecuteInGameThreadWithDelay) == "function" then
        ExecuteInGameThreadWithDelay(ms, fn)
    else
        ExecuteWithDelay(ms, function()
            ExecuteInGameThread(fn)
        end)
    end
end

local function refresh_baseline_and_unlock()
    local snap = build_snapshot()
    if snap then
        baseline = counts_only(snap)
        lastBaseKey = snap.baseKey
    else
        baseline = nil
        lastBaseKey = nil
    end
    busy = false
end

local function run_queue(ops, label, limit)
    if busy then
        log(label .. ": já existe uma operação em andamento")
        return
    end
    if #ops == 0 then
        log(label .. ": nada para mover")
        return
    end

    local maxOps = math.min(#ops, limit or #ops)
    busy = true
    log(string.format("%s: %d movimentação(ões) planejada(s); executando até %d", label, #ops, maxOps))

    local index = 1
    local function step()
        if index > maxOps then
            schedule_game(CONFIG.AFTER_MOVE_SETTLE_MS, refresh_baseline_and_unlock)
            if #ops > maxOps then
                log(string.format("%s: limite de segurança atingido; pressione o atalho novamente para continuar", label))
            end
            return
        end
        perform_operation(ops[index])
        index = index + 1
        schedule_game(CONFIG.MOVE_DELAY_MS, step)
    end
    step()
end

local function manual_consolidate()
    if busy then
        log("JUNTAR: aguarde a operação atual terminar")
        return
    end
    local snap, err = build_snapshot()
    if not snap then
        log("JUNTAR: " .. tostring(err))
        return
    end
    local ops = plan_manual(snap)
    run_queue(ops, "JUNTAR", CONFIG.MAX_MANUAL_MOVES_PER_RUN)
end

local function auto_tick()
    if busy or not CONFIG.AUTO_ENABLED then return end

    local snap, err = build_snapshot()
    if not snap then
        if baseline ~= nil then debuglog("AUTO pausado: " .. tostring(err)) end
        baseline = nil
        lastBaseKey = nil
        return
    end

    if lastBaseKey ~= snap.baseKey or baseline == nil then
        baseline = counts_only(snap)
        lastBaseKey = snap.baseKey
        debuglog(string.format("AUTO baseline criada: %d baú(s)", #snap.chests))
        return
    end

    local ops = plan_auto(baseline, snap)
    if #ops == 0 then
        baseline = counts_only(snap)
        return
    end

    -- Atualiza já o baseline e trava enquanto as RPCs assentam, evitando eco/loop.
    baseline = counts_only(snap)
    run_queue(ops, "AUTO", CONFIG.MAX_AUTO_MOVES_PER_TICK)
end

local function self_test()
    local a = { key = "A", totals = { Wood = 429 }, slots = {} }
    local b = { key = "B", totals = { Wood = 201 }, slots = {} }
    local snap = { baseKey = "BASE", chests = {a, b}, byKey = {A = a, B = b} }
    local manual = plan_manual(snap)
    assert(#manual == 1, "manual deveria criar 1 operação")
    assert(manual[1].targetKey == "A", "manual deveria escolher o baú com 429")
    assert(manual[1].sourceKey == "B" and manual[1].amount == 201, "manual deveria mover os 201")

    local previous = { baseKey = "BASE", chests = { A = { Wood = 429 }, B = {} } }
    local currentA = { key = "A", totals = { Wood = 429 }, slots = {} }
    local currentB = { key = "B", totals = { Wood = 10 }, slots = {} }
    local current = { baseKey = "BASE", chests = {currentA, currentB}, byKey = {A=currentA, B=currentB} }
    local auto = plan_auto(previous, current)
    assert(#auto == 1, "auto deveria detectar depósito novo")
    assert(auto[1].sourceKey == "B" and auto[1].targetKey == "A", "auto deveria voltar madeira para A")
    assert(auto[1].amount == 10, "auto deveria mover só o delta de 10")

    local previousSplit = { baseKey = "BASE", chests = { A = { Wood = 429 }, B = { Wood = 201 } } }
    currentB.totals.Wood = 211
    local autoSplit = plan_auto(previousSplit, current)
    assert(#autoSplit == 1 and autoSplit[1].amount == 10, "auto não deve mexer nos 201 antigos")

    local previousLargest = { baseKey = "BASE", chests = { A = { Wood = 429 }, B = { Wood = 201 } } }
    local largestA = { key = "A", totals = { Wood = 439 }, slots = {} }
    local largestB = { key = "B", totals = { Wood = 201 }, slots = {} }
    local largestCurrent = { baseKey = "BASE", chests = {largestA, largestB}, byKey = {A=largestA, B=largestB} }
    local alreadyCorrect = plan_auto(previousLargest, largestCurrent)
    assert(#alreadyCorrect == 0, "auto não deve tirar item do baú que já era o principal")
end

local okSelf, selfErr = pcall(self_test)
if okSelf then
    log("SELFTEST OK | regra 429+201 e roteamento por delta validados")
else
    log("SELFTEST FALHOU: " .. tostring(selfErr))
    CONFIG.AUTO_ENABLED = false
end

local okBind, bindErr = pcall(function()
    RegisterKeyBind(Key.J, { ModifierKey.CONTROL, ModifierKey.SHIFT }, function()
        ExecuteInGameThread(function()
            local ok, err = pcall(manual_consolidate)
            if not ok then log("ERRO JUNTAR: " .. tostring(err)) end
        end)
    end)
end)
if not okBind then log("ERRO ao registrar Ctrl+Shift+J: " .. tostring(bindErr)) end

local function safe_auto_tick()
    local ok, err = pcall(auto_tick)
    if not ok then
        busy = false
        baseline = nil
        lastBaseKey = nil
        log("ERRO AUTO (fail-safe): " .. tostring(err))
    end
end

local function start_loop()
    if type(LoopInGameThreadWithDelay) == "function" then
        LoopInGameThreadWithDelay(CONFIG.AUTO_INTERVAL_MS, safe_auto_tick)
    else
        LoopAsync(CONFIG.AUTO_INTERVAL_MS, function()
            ExecuteInGameThread(safe_auto_tick)
            return false
        end)
    end
end

local okLoop, loopErr = pcall(start_loop)
if not okLoop then log("ERRO ao iniciar loop automático: " .. tostring(loopErr)) end

log(string.format(
    "v%s carregado | AUTO=%s | Ctrl+Shift+J = Juntar iguais | sem hook em RPC",
    tostring(CONFIG.VERSION), tostring(CONFIG.AUTO_ENABLED)
))

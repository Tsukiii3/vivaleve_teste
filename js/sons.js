/**
 * Pluma - Sons relaxantes
 * 5 sons ambiente gerados na hora com Web Audio (sem arquivos de áudio).
 * O som escolhido fica salvo e volta a tocar ao trocar de página.
 */

(function () {
    'use strict';

    const KEY = 'pluma_som_ambiente';

    const SONS = [
        { id: 'chuva',    nome: 'Chuva',             emoji: '🌧️', desc: 'Chuva suave na janela' },
        { id: 'mar',      nome: 'Ondas do mar',      emoji: '🌊', desc: 'Vai e vem tranquilo' },
        { id: 'vento',    nome: 'Vento suave',       emoji: '🍃', desc: 'Brisa entre as árvores' },
        { id: 'fogueira', nome: 'Fogueira',          emoji: '🔥', desc: 'Estalos aconchegantes' },
        { id: 'tigelas',  nome: 'Tigelas tibetanas', emoji: '🔔', desc: 'Meditação profunda' }
    ];

    let ctx = null;
    let master = null;
    let ruidoBranco = null;
    let ruidoMarrom = null;
    let atual = null; // { id, bus, nodes, timers, ativo }

    // ---------- Estado salvo ----------
    function lerEstado() {
        const padrao = { id: null, tocando: false, volume: 0.6 };
        try {
            return Object.assign(padrao, JSON.parse(localStorage.getItem(KEY) || '{}'));
        } catch (e) {
            return padrao;
        }
    }

    function salvarEstado(parcial) {
        try {
            localStorage.setItem(KEY, JSON.stringify(Object.assign(lerEstado(), parcial)));
        } catch (e) { /* armazenamento indisponível */ }
    }

    // ---------- Áudio base ----------
    function obterContexto() {
        if (ctx) return ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = lerEstado().volume;
        master.connect(ctx.destination);
        criarBuffersDeRuido();
        return ctx;
    }

    function criarBuffersDeRuido() {
        const tamanho = ctx.sampleRate * 4;
        ruidoBranco = ctx.createBuffer(1, tamanho, ctx.sampleRate);
        ruidoMarrom = ctx.createBuffer(1, tamanho, ctx.sampleRate);
        const b = ruidoBranco.getChannelData(0);
        const m = ruidoMarrom.getChannelData(0);
        let ultimo = 0;
        for (let i = 0; i < tamanho; i++) {
            const w = Math.random() * 2 - 1;
            b[i] = w;
            ultimo = (ultimo + 0.02 * w) / 1.02;
            m[i] = ultimo * 3.5;
        }
    }

    function rodando() {
        return ctx && ctx.state === 'running';
    }

    // Registra um nó para ser parado/desconectado ao encerrar o som
    function reg(som, node) {
        som.nodes.push(node);
        return node;
    }

    function ruido(som, buffer) {
        const src = reg(som, ctx.createBufferSource());
        src.buffer = buffer;
        src.loop = true;
        src.start(0, Math.random() * 3);
        return src;
    }

    function oscilador(som, tipo, freq) {
        const osc = reg(som, ctx.createOscillator());
        osc.type = tipo;
        osc.frequency.value = freq;
        osc.start();
        return osc;
    }

    function filtro(som, tipo, freq, q) {
        const f = reg(som, ctx.createBiquadFilter());
        f.type = tipo;
        f.frequency.value = freq;
        if (q) f.Q.value = q;
        return f;
    }

    function ganho(som, valor) {
        const g = reg(som, ctx.createGain());
        g.gain.value = valor;
        return g;
    }

    // Repete uma função em intervalos aleatórios (só quando o áudio está rodando)
    function repetir(som, fn, minMs, maxMs) {
        const passo = () => {
            if (!som.ativo) return;
            if (rodando()) fn();
            const t = setTimeout(passo, minMs + Math.random() * (maxMs - minMs));
            som.timers.push(t);
        };
        const t = setTimeout(passo, minMs);
        som.timers.push(t);
    }

    // ---------- Os 5 sons ----------
    const construtores = {
        chuva(som) {
            const a = ganho(som, 0.34);
            ruido(som, ruidoBranco).connect(filtro(som, 'highpass', 700)).connect(filtro(som, 'lowpass', 7500)).connect(a);
            a.connect(som.bus);

            const b = ganho(som, 0.1);
            ruido(som, ruidoBranco).connect(filtro(som, 'bandpass', 2800, 0.6)).connect(b);
            b.connect(som.bus);

            // gotas
            repetir(som, () => {
                const t = ctx.currentTime;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 1800 + Math.random() * 3200;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.035, t + 0.004);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
                osc.connect(g).connect(som.bus);
                osc.start(t);
                osc.stop(t + 0.06);
            }, 60, 260);
        },

        mar(som) {
            const grave = ganho(som, 0.5);
            const lp = filtro(som, 'lowpass', 600);
            ruido(som, ruidoMarrom).connect(lp).connect(grave);
            grave.connect(som.bus);

            const lfoGanho = oscilador(som, 'sine', 0.11);
            const lfoGanhoDepth = ganho(som, 0.32);
            lfoGanho.connect(lfoGanhoDepth).connect(grave.gain);

            const lfoFiltro = oscilador(som, 'sine', 0.11);
            const lfoFiltroDepth = ganho(som, 350);
            lfoFiltro.connect(lfoFiltroDepth).connect(lp.frequency);

            // espuma
            const espuma = ganho(som, 0.04);
            ruido(som, ruidoBranco).connect(filtro(som, 'highpass', 2500)).connect(espuma);
            espuma.connect(som.bus);
            const lfoEspuma = oscilador(som, 'sine', 0.11);
            const lfoEspumaDepth = ganho(som, 0.035);
            lfoEspuma.connect(lfoEspumaDepth).connect(espuma.gain);
        },

        vento(som) {
            const g = ganho(som, 0.55);
            const bp = filtro(som, 'bandpass', 480, 0.9);
            ruido(som, ruidoBranco).connect(bp).connect(g);
            g.connect(som.bus);

            const lfoFreq = oscilador(som, 'sine', 0.07);
            lfoFreq.connect(ganho(som, 260)).connect(bp.frequency);

            const lfoGanho = oscilador(som, 'sine', 0.13);
            lfoGanho.connect(ganho(som, 0.28)).connect(g.gain);

            // assobio leve
            const s = ganho(som, 0.05);
            const bp2 = filtro(som, 'bandpass', 1100, 6);
            ruido(som, ruidoBranco).connect(bp2).connect(s);
            s.connect(som.bus);
            oscilador(som, 'sine', 0.05).connect(ganho(som, 350)).connect(bp2.frequency);
        },

        fogueira(som) {
            const g = ganho(som, 0.45);
            ruido(som, ruidoMarrom).connect(filtro(som, 'lowpass', 260)).connect(g);
            g.connect(som.bus);

            const estalo = (forte) => {
                const t = ctx.currentTime;
                const src = ctx.createBufferSource();
                src.buffer = ruidoBranco;
                const bp = ctx.createBiquadFilter();
                bp.type = 'bandpass';
                bp.frequency.value = 1400 + Math.random() * 3600;
                bp.Q.value = 1.2;
                const env = ctx.createGain();
                const pico = (forte ? 0.7 : 0.25) * (0.5 + Math.random() * 0.5);
                const dur = 0.015 + Math.random() * (forte ? 0.07 : 0.03);
                env.gain.setValueAtTime(0.0001, t);
                env.gain.exponentialRampToValueAtTime(pico, t + 0.002);
                env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                src.connect(bp).connect(env).connect(som.bus);
                src.start(t, Math.random() * 3);
                src.stop(t + dur + 0.02);
            };
            repetir(som, () => {
                estalo(false);
                if (Math.random() < 0.25) setTimeout(() => som.ativo && rodando() && estalo(false), 30 + Math.random() * 60);
            }, 50, 420);
            repetir(som, () => estalo(true), 700, 2600);
        },

        tigelas(som) {
            // base contínua (acorde aberto de Lá menor)
            [110, 164.81, 220, 277.18].forEach((freq, i) => {
                const osc = oscilador(som, 'sine', freq);
                const g = ganho(som, 0.045);
                osc.connect(g).connect(som.bus);
                const lfo = oscilador(som, 'sine', 0.05 + i * 0.023);
                lfo.connect(ganho(som, 0.03)).connect(g.gain);
            });

            // batidas de tigela
            const notas = [220, 261.63, 293.66, 329.63, 392];
            const bater = () => {
                const t = ctx.currentTime;
                const base = notas[Math.floor(Math.random() * notas.length)];
                [[1, 0.22, 7], [2.76, 0.09, 4], [5.4, 0.04, 2.5]].forEach(([razao, pico, dur]) => {
                    const osc = ctx.createOscillator();
                    const g = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = base * razao;
                    g.gain.setValueAtTime(0.0001, t);
                    g.gain.exponentialRampToValueAtTime(pico, t + 0.015);
                    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                    osc.connect(g).connect(som.bus);
                    osc.start(t);
                    osc.stop(t + dur + 0.1);
                });
            };
            som.timers.push(setTimeout(() => som.ativo && rodando() && bater(), 600));
            repetir(som, bater, 6500, 11000);
        }
    };

    // ---------- Controle ----------
    function tocar(id) {
        const c = obterContexto();
        if (!c || !construtores[id]) return;
        if (atual) encerrar(atual, 0.25);

        const som = { id, nodes: [], timers: [], ativo: true, bus: null };
        som.bus = c.createGain();
        som.bus.gain.value = 0.0001;
        som.bus.connect(master);
        construtores[id](som);
        som.bus.gain.setTargetAtTime(1, c.currentTime, 0.6); // fade in
        atual = som;

        salvarEstado({ id, tocando: true });
        garantirRetomada();
        atualizarUI();
    }

    function encerrar(som, fade) {
        som.ativo = false;
        som.timers.forEach(clearTimeout);
        const c = ctx;
        som.bus.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3);
        setTimeout(() => {
            som.nodes.forEach((n) => {
                try { if (n.stop) n.stop(); } catch (e) { /* já parado */ }
                try { n.disconnect(); } catch (e) { /* ok */ }
            });
            try { som.bus.disconnect(); } catch (e) { /* ok */ }
        }, fade * 1000 + 100);
    }

    function parar() {
        if (atual) {
            encerrar(atual, 0.9);
            atual = null;
        }
        salvarEstado({ tocando: false });
        atualizarUI();
    }

    function alternar(id) {
        if (atual && atual.id === id) parar();
        else tocar(id);
    }

    function definirVolume(v) {
        salvarEstado({ volume: v });
        if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    }

    // Navegadores só liberam áudio depois de um toque/clique na página
    function garantirRetomada() {
        if (!ctx) return;
        ctx.resume().then(atualizarUI).catch(() => {});
        if (ctx.state === 'running') return;
        const liberar = () => {
            ctx.resume().then(atualizarUI).catch(() => {});
            ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.removeEventListener(e, liberar, true));
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, liberar, true));
    }

    // ---------- Interface ----------
    let painel, botao, status, botaoParar, slider;

    function montarUI() {
        const acoes = document.querySelector('.header-actions');
        if (!acoes) return false;

        botao = document.createElement('button');
        botao.className = 'icon-btn';
        botao.id = 'somToggle';
        botao.type = 'button';
        botao.setAttribute('aria-label', 'Sons relaxantes');
        botao.setAttribute('aria-expanded', 'false');
        botao.setAttribute('aria-controls', 'somPanel');
        botao.innerHTML = '<i class="fas fa-music"></i>';
        acoes.insertBefore(botao, acoes.firstChild);

        painel = document.createElement('div');
        painel.className = 'som-panel';
        painel.id = 'somPanel';
        painel.setAttribute('role', 'dialog');
        painel.setAttribute('aria-label', 'Sons relaxantes');
        painel.innerHTML = `
            <div class="som-head">
                <strong>Sons relaxantes</strong>
                <button type="button" class="icon-btn" id="somFechar" aria-label="Fechar"><i class="fas fa-times"></i></button>
            </div>
            <p class="som-status" id="somStatus" aria-live="polite"></p>
            <div class="som-lista">
                ${SONS.map((s) => `
                <button type="button" class="som-item" data-som="${s.id}" aria-pressed="false">
                    <span class="som-emoji" aria-hidden="true">${s.emoji}</span>
                    <span class="som-texto">
                        <span class="som-nome">${s.nome}</span>
                        <span class="som-desc">${s.desc}</span>
                    </span>
                    <span class="som-eq" aria-hidden="true"><i></i><i></i><i></i></span>
                </button>`).join('')}
            </div>
            <div class="som-controles">
                <span class="som-vol-ico" aria-hidden="true">🔈</span>
                <input type="range" id="somVolume" min="0" max="100" aria-label="Volume">
                <button type="button" class="som-parar" id="somParar">Parar</button>
            </div>`;
        document.body.appendChild(painel);

        status = painel.querySelector('#somStatus');
        botaoParar = painel.querySelector('#somParar');
        slider = painel.querySelector('#somVolume');
        slider.value = Math.round(lerEstado().volume * 100);

        botao.addEventListener('click', (e) => { e.stopPropagation(); abrirPainel(!painel.classList.contains('open')); });
        painel.querySelector('#somFechar').addEventListener('click', () => abrirPainel(false));
        painel.addEventListener('click', (e) => e.stopPropagation());
        painel.querySelectorAll('.som-item').forEach((el) => {
            el.addEventListener('click', () => alternar(el.dataset.som));
        });
        botaoParar.addEventListener('click', parar);
        slider.addEventListener('input', () => definirVolume(slider.value / 100));

        document.addEventListener('click', () => abrirPainel(false));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirPainel(false); });

        document.querySelectorAll('[data-abrir-sons]').forEach((el) => {
            el.addEventListener('click', (e) => { e.stopPropagation(); abrirPainel(true); });
        });
        return true;
    }

    function abrirPainel(abrir) {
        painel.classList.toggle('open', abrir);
        botao.setAttribute('aria-expanded', String(abrir));
    }

    function atualizarUI() {
        if (!painel) return;
        const tocando = !!atual;
        botao.classList.toggle('tocando', tocando);
        botaoParar.disabled = !tocando;
        painel.querySelectorAll('.som-item').forEach((el) => {
            el.setAttribute('aria-pressed', String(tocando && atual.id === el.dataset.som));
        });
        if (!tocando) {
            status.textContent = 'Escolha um som para tocar durante o app.';
        } else {
            const nome = SONS.find((s) => s.id === atual.id).nome;
            status.textContent = rodando()
                ? `Tocando: ${nome}`
                : `${nome} — toque na tela para retomar o som`;
        }
    }

    // ---------- Início ----------
    document.addEventListener('DOMContentLoaded', () => {
        if (!montarUI()) return;
        const estado = lerEstado();
        if (estado.tocando && estado.id) {
            tocar(estado.id); // retoma o som da página anterior
        } else {
            atualizarUI();
        }
    });
})();

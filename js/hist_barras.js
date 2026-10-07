//Variáveis globais


let isPaused = true;     
let storyEnded = false; 
let hasStartedPlayback = false;
const instructionsPopup = document.getElementById("popup-folha");


const TOTAL_ITEMS = document.querySelectorAll(".historia-item").length;

const barsContainer = document.getElementById("barras");
const startOverlay = document.getElementById("startOverlay");
const compassIndicator = document.getElementById("estado-atual");

const storyItems = [];

let currentIndex = 0;
let currentMode = "default";
let displayedMode = "default";
let modeSwitchId = 0;
const audioFadeFrames = new WeakMap();

let rafId = null;
let isSkipping = false;
let started = false;

const VIDEO_FADE_DURATION = 400;
const AUDIO_FADE_DURATION = 400;


function updateCompassDirection(direction) {
    if (compassIndicator) {
        compassIndicator.dataset.direction = direction;
        compassIndicator.removeAttribute("data-ball-light");
    }
}

function lightenCompassBall() {
    if (["w", "e"].includes(compassIndicator?.dataset.direction)) {
        compassIndicator.dataset.ballLight = "true";
    }
}



/* ------------ Obter os 3 vídeos de uma cena (video default, video filme e video livro) ------------ */

function getVideos(item) {

    if (!item) {
        return {
            default: null,
            book: null,
            movie: null
        };
    }

    return {
        default: item.querySelector(".video-default"),
        book: item.querySelector(".video-livro"),
        movie: item.querySelector(".video-filme")
    };
}


/* ------------ Irregularidade visual das barras (tamanho + textura aleatórios) ------------ */
/*
 * Isto NÃO mexe no .bar__fill (barra amarela de progressão).
 * Mexe apenas no .bar (o "invólucro" de cada barra): largura, altura e textura.
 */

const TOTAL_TEXTURAS = 6; // nº de texturas disponíveis -> classes .bar--textura-1 a .bar--textura-5

// Variação de tamanho: percentagem do tamanho base já definido no CSS (--bar-width / --bar-height)
// Largura: ligeiramente reduzida em relação ao tamanho base
const VARIACAO_LARGURA_MIN = 0.5; // 60% do tamanho base
const VARIACAO_LARGURA_MAX = 1; // 90% do tamanho base

// Altura: aumentada mais em relação ao tamanho base
const VARIACAO_ALTURA_MIN = 1; // 90% do tamanho base
const VARIACAO_ALTURA_MAX = 1.6; // 140% do tamanho base

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

function aplicarTamanhoETexturaAleatorios(bar) {

    // Tamanho base tal como o CSS o calculou (var(--bar-width) / var(--bar-height))
    const estiloAtual = getComputedStyle(bar);
    const larguraBase = parseFloat(estiloAtual.width);
    const alturaBase = parseFloat(estiloAtual.height);

    // Largura e altura aleatórias, a partir do tamanho base, com intervalos independentes
    bar.style.width =
        `${larguraBase * randomBetween(VARIACAO_LARGURA_MIN, VARIACAO_LARGURA_MAX)}px`;

    bar.style.height =
        `${alturaBase * randomBetween(VARIACAO_ALTURA_MIN, VARIACAO_ALTURA_MAX)}px`;

    // Textura aleatória entre 1 e TOTAL_TEXTURAS
    const texturaEscolhida = Math.floor(Math.random() * TOTAL_TEXTURAS) + 1;
    bar.classList.add(`bar--textura-${texturaEscolhida}`);
}


/* ------------ Criação das barras amarelas de progressão na história ------------ */

for (let i = 0; i < TOTAL_ITEMS; i++) {

    const item = document.getElementById(`item-${i}`);

    if (!item) {
        console.warn(`Não foi encontrado #item-${i}`);
        continue;
    }

    storyItems.push(item);

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "bar__fill";

    bar.appendChild(fill);
    barsContainer.appendChild(bar);

    // Aplicar tamanho e textura aleatórios a esta barra (só ao invólucro, não ao fill)
    aplicarTamanhoETexturaAleatorios(bar);
}

const barEls = document.querySelectorAll(".bar");
const barFills = document.querySelectorAll(".bar__fill");


/* ------------ Fade de transição dos audios ------------ */

function fadeAudio(video, targetVolume, duration = AUDIO_FADE_DURATION) {

    if (!video) return;

    const previousFrame = audioFadeFrames.get(video);
    if (previousFrame !== undefined) {
        cancelAnimationFrame(previousFrame);
    }

    if (duration <= 0) {
        video.volume = targetVolume;
        audioFadeFrames.delete(video);
        return;
    }

    const startVolume = video.volume;
    const startTime = performance.now();

    function animateAudio(now) {

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        /* Ease in/out suave*/
        const eased =
            progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        video.volume =
            startVolume +
            (targetVolume - startVolume) * eased;

        if (progress < 1) {
            audioFadeFrames.set(video, requestAnimationFrame(animateAudio));
        } else {
            video.volume = targetVolume;
            audioFadeFrames.delete(video);
        }
    }

    audioFadeFrames.set(video, requestAnimationFrame(animateAudio));
}


/* =========================================================
   MOSTRAR VÍDEO + CONTROLAR ÁUDIO
   ========================================================= */

function getModeVideo(videos, mode) {
    if (mode === "book") return videos.book;
    if (mode === "movie") return videos.movie;
    return videos.default;
}

function waitForVideoEvent(video, eventName, isReady = () => false) {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            video.removeEventListener(eventName, onReady);
            video.removeEventListener("error", onError);
        };
        const onReady = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error(`Falha ao carregar o vídeo: ${video.currentSrc || video.querySelector("source")?.src || "fonte desconhecida"}`));
        };

        video.addEventListener(eventName, onReady, { once: true });
        video.addEventListener("error", onError, { once: true });
        if (isReady()) onReady();
    });
}

function ensureVideoReady(video, eventName = "loadeddata") {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        return Promise.resolve();
    }

    const ready = waitForVideoEvent(
        video,
        eventName,
        () => video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    );
    if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.networkState !== HTMLMediaElement.NETWORK_LOADING
    ) {
        video.load();
    }
    return ready;
}

async function syncVideoToMaster(video, masterVideo) {
    if (video === masterVideo || !Number.isFinite(masterVideo.currentTime)) return;

    const duration = Number.isFinite(video.duration) ? video.duration : masterVideo.currentTime;
    const targetTime = Math.min(masterVideo.currentTime, Math.max(0, duration - 0.05));
    if (Math.abs(video.currentTime - targetTime) < 0.05) return;

    const seeked = waitForVideoEvent(video, "seeked");
    video.currentTime = targetTime;
    await seeked;
}

async function showModeVideo(mode, fade = true) {
    const currentItem = storyItems[currentIndex];
    if (!currentItem) return;

    const videos = getVideos(currentItem);
    const masterVideo = videos.default;
    const activeVideo = getModeVideo(videos, mode);
    if (!activeVideo) {
        console.error(`Não foi encontrado o vídeo do modo "${mode}" na cena ${currentIndex + 1}.`);
        return;
    }

    const switchId = ++modeSwitchId;
    const previousVideo = getModeVideo(videos, displayedMode);

    try {
        await ensureVideoReady(activeVideo);
        await syncVideoToMaster(activeVideo, masterVideo);

        if (switchId !== modeSwitchId) return;

        if (!isPaused) {
            activeVideo.volume = 0;
            try {
                await activeVideo.play();
            } catch (error) {
                if (!(isPaused && error.name === "AbortError")) throw error;
            }
            if (!isPaused) await syncVideoToMaster(activeVideo, masterVideo);
        }

        if (switchId !== modeSwitchId) {
            if (activeVideo !== masterVideo && activeVideo !== getModeVideo(videos, currentMode)) {
                activeVideo.pause();
            }
            return;
        }

        const allVideos = [videos.default, videos.book, videos.movie].filter(Boolean);
        activeVideo.style.transition = `opacity ${fade ? VIDEO_FADE_DURATION : 0}ms ease-in-out`;
        activeVideo.style.zIndex = "2";

        if (fade) {
            activeVideo.style.opacity = "0";
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        activeVideo.style.opacity = "1";
        if (fade) {
            fadeAudio(activeVideo, 1, AUDIO_FADE_DURATION);
        } else {
            activeVideo.volume = isPaused ? 0 : 1;
        }

        allVideos.forEach(video => {
            if (video === activeVideo) return;
            video.style.transition = `opacity ${fade ? VIDEO_FADE_DURATION : 0}ms ease-in-out`;
            video.style.opacity = "0";
            video.style.zIndex = "1";
            fadeAudio(video, 0, fade ? AUDIO_FADE_DURATION : 0);
        });

        if (fade) {
            await new Promise(resolve => setTimeout(resolve, VIDEO_FADE_DURATION));
        }

        if (switchId !== modeSwitchId) return;

        allVideos.forEach(video => {
            if (video !== activeVideo && video !== masterVideo) {
                video.pause();
            }
        });
        displayedMode = mode;
    } catch (error) {
        if (switchId !== modeSwitchId) return;
        console.error(`Não foi possível mudar para o modo "${mode}":`, error);
        if (previousVideo) {
            currentMode = displayedMode;
            currentItem.classList.toggle("w-pressed", displayedMode === "book");
            currentItem.classList.toggle("e-pressed", displayedMode === "movie");
        }
    }
}

/* =========================================================
   PREPARAR O RELÓGIO DA CENA E O VÍDEO SELECIONADO
   ========================================================= */

async function startAllVideos(item) {

    if (!item) return;

    const videos = getVideos(item);
    const activeVideo = getModeVideo(videos, currentMode);
    const requiredVideos = [...new Set([videos.default, activeVideo].filter(Boolean))];
    const loadId = ++modeSwitchId;

    [videos.default, videos.book, videos.movie].forEach(video => {
        if (!video) return;
        video.pause();
        video.volume = 0;
        video.style.opacity = video === activeVideo ? "1" : "0";
        video.style.zIndex = video === activeVideo ? "2" : "1";
    });

    try {
        await Promise.all(requiredVideos.map(video => ensureVideoReady(video)));
        if (loadId !== modeSwitchId) return;

        requiredVideos.forEach(video => {
            video.currentTime = 0;
            video.volume = video === activeVideo ? 1 : 0;
        });
        displayedMode = currentMode;

        if (!isPaused && !storyEnded) {
            try {
                await Promise.all(requiredVideos.map(video => video.play()));
            } catch (error) {
                if (!(isPaused && error.name === "AbortError")) throw error;
            }
            if (isPaused || storyEnded) {
                requiredVideos.forEach(video => video.pause());
            }
        }
    } catch (error) {
        if (loadId === modeSwitchId) {
            console.error(`Não foi possível preparar a cena ${currentIndex + 1}:`, error);
        }
    }
}

/* =========================================================
   PARAR OS VÍDEOS DE UMA CENA
   ========================================================= */

function stopAllVideos(item, reset = true) {

    if (!item) return;

    const videos = getVideos(item);

    const allVideos = [
        videos.default,
        videos.book,
        videos.movie
    ];

    allVideos.forEach(video => {

        if (!video) return;

        video.pause();

        /*
         * Garantir que o áudio fica desligado
         * quando a cena deixa de estar ativa.
         */

        video.volume = 0;

        if (reset) {

            try {

                video.currentTime = 0;

            } catch (error) {

                // Ignorar
            }
        }
    });
}


/* =========================================================
   DEFINIR O MODO
   ========================================================= */

function setMode(mode) {

    const currentItem = storyItems[currentIndex];

    if (!currentItem) return;

    currentMode = mode;


    /* =====================================================
       DEFAULT
       ===================================================== */

    if (mode === "default") {

        currentItem.classList.remove(
            "w-pressed",
            "e-pressed"
        );

        showModeVideo("default", true);
        lightenCompassBall();

        return;
    }


    /* =====================================================
       LIVRO
       ===================================================== */

    if (mode === "book") {

        currentItem.classList.add("w-pressed");
        currentItem.classList.remove("e-pressed");

        showModeVideo("book", true);

        return;
    }


    /* =====================================================
       FILME
       ===================================================== */

    if (mode === "movie") {

        currentItem.classList.add("e-pressed");
        currentItem.classList.remove("w-pressed");

        showModeVideo("movie", true);

        return;
    }
}


/* =========================================================
   OBTER O VÍDEO PRINCIPAL / MASTER
   ========================================================= */

function getMasterVideo(item) {

    if (!item) return null;

    /*
     * O Default é usado como referência temporal
     * para a barra e para terminar a cena.
     */

    return item.querySelector(".video-default");
}


/* =========================================================
   PREPARAR UMA CENA
   ========================================================= */

function activateItem(index) {

    cancelAnimationFrame(rafId);

    currentIndex = index;

    // Resetar para default APENAS se estivermos a iniciar a história no primeiro tijolo
    if (index === 0) {
        currentMode = "default";
    }

    // 1. Assegurar que os vídeos desta cena (e da próxima) são carregados
    prepareItemVideos(index);


    /* =====================================================
       ATUALIZAR ESTADO DAS CENAS
       ===================================================== */

    storyItems.forEach((item, i) => {

        if (!item) return;

        item.classList.toggle(
            "active",
            i === index
        );

        // Limpar as classes de teclado APENAS das cenas inativas
        if (i !== index) {
            item.classList.remove(
                "w-pressed",
                "e-pressed"
            );
        }

        /* =================================================
           OUTRAS CENAS
           ================================================= */

        if (i !== index) {

            stopAllVideos(
                item,
                true
            );

            const videos = getVideos(item);

            [
                videos.default,
                videos.book,
                videos.movie
            ].forEach(video => {

                if (!video) return;

                video.style.opacity = "0";
                video.style.zIndex = "1";
                video.volume = 0;
            });
        }


        /* =================================================
           BARRAS
           ================================================= */

        const bar = barEls[i];

        if (!bar) return;

        /* =================================================
           CENA ANTERIOR / CONCLUÍDA
           ================================================= */

        if (i < index) {

            bar.classList.remove("active");
            bar.classList.add("completed");

            bar.classList.toggle(
                "shift-right",
                i % 2 === 0
            );

            bar.classList.toggle(
                "shift-left",
                i % 2 !== 0
            );

            barFills[i].style.width = "100%";
        }

        /* =================================================
           CENA ATUAL
           ================================================= */

        else if (i === index) {

            bar.classList.remove("completed");
            bar.classList.add("active");

            if (i % 2 === 0) {

                bar.classList.add("shift-right");
                bar.classList.remove("shift-left");

            } else {

                bar.classList.add("shift-left");
                bar.classList.remove("shift-right");
            }

            barFills[i].style.transition = "none";
            barFills[i].style.width = "0%";
        }

        /* =================================================
           CENA FUTURA
           ================================================= */

        else {

            bar.classList.remove(
                "active",
                "completed",
                "shift-left",
                "shift-right"
            );

            barFills[i].style.width = "0%";
        }
    });


    /* =====================================================
       CENA ATUAL
       ===================================================== */

    const currentItem = storyItems[index];

    if (!currentItem) return;

    const videos = getVideos(currentItem);

    startAllVideos(currentItem);

    if (currentMode === "book") {
        currentItem.classList.add("w-pressed");
        currentItem.classList.remove("e-pressed");
    } else if (currentMode === "movie") {
        currentItem.classList.add("e-pressed");
        currentItem.classList.remove("w-pressed");
    } else {
        currentItem.classList.remove("w-pressed", "e-pressed");
    }


    /* =====================================================
       QUANDO O DEFAULT TERMINAR
       ===================================================== */

    const masterVideo = getMasterVideo(currentItem);

    if (masterVideo) {

        masterVideo.onended = () => {
            goToNext();
        };
    }


    /* =====================================================
       INICIAR A BARRA
       ===================================================== */

    updateProgress();
}


/* =========================================================
   ATUALIZAR BARRA
   ========================================================= */

function updateProgress() {

    const currentItem =
        storyItems[currentIndex];

    if (!currentItem) return;

    const masterVideo =
        getMasterVideo(currentItem);

    if (
        masterVideo &&
        Number.isFinite(masterVideo.duration) &&
        masterVideo.duration > 0
    ) {

        const progress =
            (
                masterVideo.currentTime /
                masterVideo.duration
            ) * 100;

        barFills[currentIndex].style.width =
            `${Math.min(progress, 100)}%`;
    }

    rafId =
        requestAnimationFrame(
            updateProgress
        );
}


/* =========================================================
   AVANÇAR PARA A PRÓXIMA CENA
   ========================================================= */
function goToNext() {

    if (isSkipping) return;

    cancelAnimationFrame(rafId);

    if (barFills[currentIndex]) {
        barFills[currentIndex].style.width = "100%";
    }

    const next = currentIndex + 1;

    if (next < storyItems.length) {

        /* =================================================
           NÃO É A ÚLTIMA CENA: parar tudo e avançar normalmente
           ================================================= */

        const currentItem = storyItems[currentIndex];

        if (currentItem) {

            const videos = getVideos(currentItem);

            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.volume = 0;
            });

            stopAllVideos(currentItem, true); // aqui o reset a 0 está correto
        }

        activateItem(next);

    } else {

        /* =================================================
           CHEGOU À ÚLTIMA CENA (10ª barra)
           A história fica parada, com o vídeo no último frame
           ================================================= */

        finishStory();
    }
}

function finishStory() {
    storyEnded = true;
    isPaused = true;
    clearTimeout(hideButtonTimeout);

    const currentItem = storyItems[currentIndex];

    if (currentItem) {
        const videos = getVideos(currentItem);

        [videos.default, videos.book, videos.movie].forEach(video => {
            if (!video) return;
            video.pause();
            video.volume = 0;
        });
    }

    playPauseContainer.style.display = "";
    btnPlay.classList.add("fade-out");
    btnPause.classList.add("fade-out");
    btnTryAgain.classList.remove("fade-out");
}


/* =========================================================
   VOLTAR PARA A CENA ANTERIOR
   ========================================================= */

function goToPrevious() {

    if (isSkipping) return;

    isSkipping = true;

    cancelAnimationFrame(rafId);


    /* =====================================================
       ESCONDER SUAVEMENTE A CENA ATUAL
       ===================================================== */

    const currentItem =
        storyItems[currentIndex];

    if (currentItem) {

        const videos =
            getVideos(currentItem);

        const activeVideo =
            currentMode === "book"
                ? videos.book
                : currentMode === "movie"
                    ? videos.movie
                    : videos.default;


        /* =================================================
           FADE DE VÍDEO
           ================================================= */

        if (activeVideo) {

            activeVideo.style.transition =
                `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;

            activeVideo.style.opacity =
                "0";


            /* =============================================
               FADE DE ÁUDIO
               ============================================= */

            fadeAudio(
                activeVideo,
                0,
                AUDIO_FADE_DURATION
            );
        }
    }


    /* =====================================================
       BARRA
       ===================================================== */

    if (barFills[currentIndex]) {

        barFills[currentIndex].style.transition =
            `width ${VIDEO_FADE_DURATION}ms ease-in-out`;

        barFills[currentIndex].style.width =
            "0%";
    }


    /* =====================================================
       MUDAR DE CENA
       ===================================================== */

    setTimeout(() => {

        /*
         * Garantir que os vídeos da cena anterior
         * ficam completamente silenciosos.
         */

        if (currentItem) {

            const videos =
                getVideos(currentItem);

            [
                videos.default,
                videos.book,
                videos.movie
            ].forEach(video => {

                if (!video) return;

                video.volume = 0;
            });

            stopAllVideos(
                currentItem,
                true
            );
        }


        const previousIndex =
            currentIndex - 1;

        if (previousIndex >= 0) {

            activateItem(
                previousIndex
            );

        } else {

            activateItem(0);
        }

        isSkipping = false;

    }, VIDEO_FADE_DURATION);
}


/* =========================================================
   START
   ========================================================= */

/*startOverlay.addEventListener(
    "click",
    () => {

        if (started) return;

        started = true;

        startOverlay.classList.add(
            "hidden"
        );

        activateItem(0);
    }
);
*/

/* =========================================================
   TECLADO
   ========================================================= */

document.addEventListener(
    "keydown",
    (e) => {

        if (e.repeat) return;
        if (!hasStartedPlayback) return;
        if (
            instructionsPopup &&
            getComputedStyle(instructionsPopup).display !== "none"
        ) return;

        const key =
            e.key.toLowerCase();

        const currentItem =
            storyItems[currentIndex];

        if (!currentItem) return;

        if (["n", "w", "s", "e"].includes(key)) {
            updateCompassDirection(key);
        }


        /* =================================================
           N = CENA ANTERIOR
           ================================================= */

        if (key === "n") {

            goToPrevious();

            return;
        }


        /* =========================================================
   S = CENA SEGUINTE
   ========================================================= */

if (key === "s") {

    if (isSkipping) return;

    isSkipping = true;

    cancelAnimationFrame(rafId);

    if (barFills[currentIndex]) {
        barFills[currentIndex].style.transition =
            `width ${VIDEO_FADE_DURATION}ms ease-in-out`;
        barFills[currentIndex].style.width = "100%";
    }

    const videos = getVideos(currentItem);

    const activeVideo =
        currentMode === "book"
            ? videos.book
            : currentMode === "movie"
                ? videos.movie
                : videos.default;

    const nextIndex = currentIndex + 1;
    const isLastScene = nextIndex >= storyItems.length;

    if (isLastScene) {

        /* =================================================
           ÚLTIMA CENA: sem fade nem reset, fica no último frame
           ================================================= */

        [videos.default, videos.book, videos.movie].forEach(video => {
            if (!video) return;
            video.pause();
            video.volume = 0;
        });

        finishStory();
        isSkipping = false;

        return;
    }

    /* =====================================================
       FADE DO VÍDEO + ÁUDIO (cenas normais)
       ===================================================== */

    if (activeVideo) {
        activeVideo.style.transition = `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;
        activeVideo.style.opacity = "0";
        fadeAudio(activeVideo, 0, AUDIO_FADE_DURATION);
    }

    setTimeout(() => {

        [videos.default, videos.book, videos.movie].forEach(video => {
            if (!video) return;
            video.volume = 0;
            video.pause();
            try {
                video.currentTime = 0;
            } catch (error) {
                // Ignorar
            }
        });

        isSkipping = false;
        activateItem(nextIndex);

    }, VIDEO_FADE_DURATION);

    return;
}
        /* =================================================
           W = LIVRO
           ================================================= */

        if (key === "w") {

            if (currentMode === "book") {

                /*
                 * W novamente -> Default
                 */

                setMode("default");

            } else {

                /*
                 * W -> Livro
                 */

                setMode("book");
            }

            return;
        }


        /* =================================================
           E = FILME
           ================================================= */

        if (key === "e") {

            if (currentMode === "movie") {

                /*
                 * E novamente -> Default
                 */

                setMode("default");

            } else {

                /*
                 * E -> Filme
                 */

                setMode("movie");
            }

            return;
        }
    }
);


/* =========================================================
   CARREGAR APENAS OS VÍDEOS DA CENA NECESSÁRIA
   ========================================================= */
function prepareItemVideos(index) {
    const nextItem = storyItems[index + 1];
    if (nextItem) {
        const nextDefaultVideo = getVideos(nextItem).default;
        if (nextDefaultVideo?.readyState === 0) nextDefaultVideo.load();
    }
}

const playPauseContainer = document.getElementById("play-pause-container");
const btnPlay  = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const btnTryAgain = document.getElementById("btn-try-again");

let hideButtonTimeout = null;

// Mostra o ícone correto consoante o estado atual
function updatePlayPauseIcon() {
    if (isPaused) {
        btnPlay.classList.remove("fade-out");
        btnPause.classList.add("fade-out");
    } else {
        btnPause.classList.remove("fade-out");
        btnPlay.classList.add("fade-out");
    }
}

// Esconde ambos os ícones
function hideActiveButton() {
    btnPlay.classList.add("fade-out");
    btnPause.classList.add("fade-out");
}

// Revela o botão certo ao clicar no ecrã; se estiver a reproduzir, esconde-o de novo pouco depois
function revealPlayPauseButton() {

    if (storyEnded) return;

    clearTimeout(hideButtonTimeout);
    updatePlayPauseIcon();

    if (!isPaused) {
        hideButtonTimeout = setTimeout(() => {
            hideActiveButton();
        }, 2000);
    }
}

// Dá efetivamente play/pause. Só é chamado ao clicar num dos botões.
function togglePlayPause() {

    if (storyEnded) return;

    clearTimeout(hideButtonTimeout);

    isPaused = !isPaused;
    if (!isPaused) {
        hasStartedPlayback = true;
    }

    const currentItem = storyItems[currentIndex];
    const videos = getVideos(currentItem);
    if (isPaused) {
        [videos.default, getModeVideo(videos, currentMode)]
            .filter((video, index, list) => video && list.indexOf(video) === index)
            .forEach(video => video.pause());
    } else {
        [videos.default, getModeVideo(videos, currentMode)]
            .filter((video, index, list) => video && list.indexOf(video) === index)
            .forEach(video => {
                if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
                video.play().catch(error => {
                    console.error("Não foi possível retomar a reprodução:", error);
                });
            });
    }

    updatePlayPauseIcon();

    if (!isPaused) {
        hideButtonTimeout = setTimeout(() => {
            hideActiveButton();
        }, 200);//100
    }
}

function restartStory() {
    clearTimeout(hideButtonTimeout);
    storyEnded = false;
    isPaused = false;
    hasStartedPlayback = true;
    isSkipping = false;
    currentMode = "default";
    updateCompassDirection("center");

    btnTryAgain.classList.add("fade-out");
    playPauseContainer.style.display = "";
    updatePlayPauseIcon();

    activateItem(0);

    hideButtonTimeout = setTimeout(() => {
        hideActiveButton();
    }, 200);
}

[btnPlay, btnPause].forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlayPause();
    });
});

btnTryAgain.addEventListener("click", (e) => {
    e.stopPropagation();
    restartStory();
});

playPauseContainer.addEventListener("click", () => {
    revealPlayPauseButton();
});

// Estado inicial: vídeo pausado -> mostra o ícone de play
updatePlayPauseIcon();
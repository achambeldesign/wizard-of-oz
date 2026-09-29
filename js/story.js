//Variáveis globais
const TOTAL_ITEMS = 10; // nº total de barras

const barsContainer = document.getElementById("barras");
const startOverlay = document.getElementById("startOverlay");
const statusIndicator = document.getElementById("estado-atual");

const storyItems = [];

let currentIndex = 0;
let currentMode = "default";

let rafId = null;
let isSkipping = false;
let started = false;

const VIDEO_FADE_DURATION = 400;
const AUDIO_FADE_DURATION = 400;


/* ------------ Estado atual na história (indicação para o utilizador) ------------ */
function updateStatus(modeText, keyName = "None") {

    if (!statusIndicator) return;

    const currentPart = currentIndex + 1;

    statusIndicator.innerHTML =
        `<strong>${currentPart}</strong> /10 | ` +
        `Key: <strong>${keyName}</strong> | ` +
        `Mode: <strong>${modeText}</strong>`;
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
}

const barEls = document.querySelectorAll(".bar");
const barFills = document.querySelectorAll(".bar__fill");


/* ------------ Fade de transição dos audios ------------ */

function fadeAudio(video, targetVolume, duration = AUDIO_FADE_DURATION) {

    if (!video) return;

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

            requestAnimationFrame(animateAudio);

        } else {

            video.volume = targetVolume;
        }
    }

    requestAnimationFrame(animateAudio);
}


/* ------------ Fade de transição dos videos ------------ */

function fadeVideo(video, targetOpacity, duration = VIDEO_FADE_DURATION) {

    if (!video) return;

    video.style.transition =
        `opacity ${duration}ms ease-in-out`;

    video.style.opacity = targetOpacity;
}


/* =========================================================
   MOSTRAR VÍDEO + CONTROLAR ÁUDIO
   ========================================================= */

function showModeVideo(mode, fade = true) {

    const currentItem = storyItems[currentIndex];

    if (!currentItem) return;

    const videos = getVideos(currentItem);

    const allVideos = [
        videos.default,
        videos.book,
        videos.movie
    ];


    /* =====================================================
       ESCOLHER VÍDEO ATIVO
       ===================================================== */

    let activeVideo = videos.default;

    if (mode === "book") {
        activeVideo = videos.book;
    }

    if (mode === "movie") {
        activeVideo = videos.movie;
    }


    /* =====================================================
       VÍDEO
       ===================================================== */

    allVideos.forEach(video => {

        if (!video) return;

        if (video === activeVideo) {

            video.style.transition =
                `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;

            video.style.opacity = "1";
            video.style.zIndex = "2";

        } else {

            video.style.transition =
                `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;

            video.style.opacity = "0";
            video.style.zIndex = "1";
        }
    });


    /* =====================================================
       ÁUDIO
       ===================================================== */

    allVideos.forEach(video => {

        if (!video) return;

        if (video === activeVideo) {

            if (fade) {

                fadeAudio(
                    video,
                    1,
                    AUDIO_FADE_DURATION
                );

            } else {

                video.volume = 1;
            }

        } else {

            if (fade) {

                fadeAudio(
                    video,
                    0,
                    AUDIO_FADE_DURATION
                );

            } else {

                video.volume = 0;
            }
        }
    });
}


/* =========================================================
   INICIAR OS 3 VÍDEOS AO MESMO TEMPO
   ========================================================= */

function startAllVideos(item) {

    if (!item) return;

    const videos = getVideos(item);

    const allVideos = [
        videos.default,
        videos.book,
        videos.movie
    ].filter(Boolean);


    // Colocar todos no início
    allVideos.forEach(video => {

        video.pause();

        try {
            video.currentTime = 0;
        } catch (error) {
            console.warn("Não foi possível definir currentTime:", error);
        }

        // Apenas o Default tem áudio inicialmente
        video.volume =
            video === videos.default
                ? 1
                : 0;
    });


    // Esperar que todos tenham metadata
    const waitForMetadata = allVideos.map(video => {

        if (video.readyState >= 1) {
            return Promise.resolve();
        }

        return new Promise(resolve => {

            video.addEventListener(
                "loadedmetadata",
                resolve,
                { once: true }
            );
        });
    });


    Promise.all(waitForMetadata).then(() => {

        // Garantir novamente que começam exatamente no início
        allVideos.forEach(video => {

            try {
                video.currentTime = 0;
            } catch (error) {
                // Ignorar
            }
        });


        // Dar play aos três
        allVideos.forEach(video => {

            video.play().catch(error => {

                console.warn(
                    "Erro ao iniciar vídeo:",
                    error
                );
            });
        });

    });
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

        updateStatus(
            "Default",
            "None"
        );

        return;
    }


    /* =====================================================
       LIVRO
       ===================================================== */

    if (mode === "book") {

        currentItem.classList.add("w-pressed");
        currentItem.classList.remove("e-pressed");

        showModeVideo("book", true);

        updateStatus(
            "Book",
            "W"
        );

        return;
    }


    /* =====================================================
       FILME
       ===================================================== */

    if (mode === "movie") {

        currentItem.classList.add("e-pressed");
        currentItem.classList.remove("w-pressed");

        showModeVideo("movie", true);

        updateStatus(
            "Movie",
            "E"
        );

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

    /*
     * Garantir que todos começam sincronizados.
     */
    startAllVideos(currentItem);


    /*
     * APLICAR O MODO ATUAL (Persistência)
     * Como acabámos de iniciar a cena, fade = false (aplica as opacidades e volume de imediato)
     */
    if (currentMode === "book") {
        
        currentItem.classList.add("w-pressed");
        currentItem.classList.remove("e-pressed");
        showModeVideo("book", false);
        updateStatus("Book", "W");

    } else if (currentMode === "movie") {
        
        currentItem.classList.add("e-pressed");
        currentItem.classList.remove("w-pressed");
        showModeVideo("movie", false);
        updateStatus("Movie", "E");

    } else {
        
        currentItem.classList.remove("w-pressed", "e-pressed");
        showModeVideo("default", false);
        updateStatus("Default", "None");

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


    /* =====================================================
       COMPLETAR BARRA
       ===================================================== */

    if (barFills[currentIndex]) {

        barFills[currentIndex].style.width =
            "100%";
    }


    /* =====================================================
       PARAR VÍDEOS DA CENA ATUAL
       ===================================================== */

    const currentItem =
        storyItems[currentIndex];

    if (currentItem) {

        const videos =
            getVideos(currentItem);

        /*
         * Desligar imediatamente o áudio
         * antes de parar os vídeos.
         */

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


    /* =====================================================
       PRÓXIMA CENA
       ===================================================== */

    const next =
        currentIndex + 1;

    if (next < storyItems.length) {

        activateItem(next);

    } else {

        /*
         * Quando chegar ao fim,
         * limpar todas as barras.
         */

        barEls.forEach((bar, i) => {

            bar.classList.remove(
                "active",
                "completed",
                "shift-left",
                "shift-right"
            );

            barFills[i].style.width =
                "0%";
        });

        activateItem(0);
    }
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

        const key =
            e.key.toLowerCase();

        const currentItem =
            storyItems[currentIndex];

        if (!currentItem) return;


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


    /* =====================================================
       COMPLETAR BARRA
       ===================================================== */

    if (barFills[currentIndex]) {

        barFills[currentIndex].style.transition =
            `width ${VIDEO_FADE_DURATION}ms ease-in-out`;

        barFills[currentIndex].style.width = "100%";
    }


    /* =====================================================
       OBTER VÍDEOS
       ===================================================== */

    const videos = getVideos(currentItem);

    const activeVideo =
        currentMode === "book"
            ? videos.book
            : currentMode === "movie"
                ? videos.movie
                : videos.default;


    /* =====================================================
       FADE DO VÍDEO + ÁUDIO
       ===================================================== */

    if (activeVideo) {

        activeVideo.style.transition =
            `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;

        activeVideo.style.opacity = "0";

        fadeAudio(
            activeVideo,
            0,
            AUDIO_FADE_DURATION
        );
    }


    /* =====================================================
       ESPERAR O FADE
       ===================================================== */

    setTimeout(() => {

        /*
         * Desligar completamente o áudio
         * dos três vídeos da cena atual.
         */

        [
            videos.default,
            videos.book,
            videos.movie
        ].forEach(video => {

            if (!video) return;

            video.volume = 0;
            video.pause();

            try {
                video.currentTime = 0;
            } catch (error) {
                // Ignorar
            }
        });


        /* =================================================
           AVANÇAR DIRETAMENTE
           ================================================= */

        const nextIndex = currentIndex + 1;


        if (nextIndex < storyItems.length) {

            /*
             * Tiramos o bloqueio ANTES de activateItem().
             */

            isSkipping = false;

            activateItem(nextIndex);

        } else {

            /*
             * Chegou ao fim.
             * Voltar à primeira cena.
             */

            barEls.forEach((bar, i) => {

                bar.classList.remove(
                    "active",
                    "completed",
                    "shift-left",
                    "shift-right"
                );

                barFills[i].style.width = "0%";
            });

            isSkipping = false;

            activateItem(0);
        }

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
    const item = storyItems[index];
    if (!item) return;

    const videos = item.querySelectorAll("video");
    videos.forEach(video => {
        // Se o vídeo ainda não começou a carregar
        if (video.readyState === 0) {
            video.load(); 
        }
    });

    // Pré-carregar em segundo plano a cena seguinte (se existir)
    const nextItem = storyItems[index + 1];
    if (nextItem) {
        nextItem.querySelectorAll("video").forEach(v => {
            if (v.readyState === 0) v.load();
        });
    }
}
// Variáveis globais
let isPaused = true;     
let storyEnded = false;  

const TOTAL_ITEMS = 10; 

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


/* ------------ Estado atual na história ------------ */
function updateStatus(modeText, keyName = "None") {
    if (!statusIndicator) return;
    const currentPart = currentIndex + 1;
    statusIndicator.innerHTML =
        `<strong>${currentPart}</strong> /10 | ` +
        `Key: <strong>${keyName}</strong> | ` +
        `Mode: <strong>${modeText}</strong>`;
}

/* ------------ Obter os 3 vídeos de uma cena ------------ */
function getVideos(item) {
    if (!item) {
        return { default: null, book: null, movie: null };
    }
    return {
        default: item.querySelector(".video-default"),
        book: item.querySelector(".video-livro"),
        movie: item.querySelector(".video-filme")
    };
}

/* ------------ Criação das barras amarelas de progressão ------------ */
const textures = [
    "images/texture1.png",
    "images/texture2.png",
    "images/texture3.png",
    "images/texture4.png",
    "images/texture5.png"
];

for (let i = 0; i < TOTAL_ITEMS; i++) {
    const item = document.getElementById(`item-${i}`);
    if (!item) continue;

    storyItems.push(item);

    const bar = document.createElement("div");
    bar.className = "bar";

    const randomWidth = Math.floor(Math.random() * 30) + 70;   
    const randomHeight = Math.floor(Math.random() * 10) + 12;  
    bar.style.width = `${randomWidth}px`;
    bar.style.height = `${randomHeight}px`;

    const fill = document.createElement("div");
    fill.className = "bar__fill";

    const textureDiv = document.createElement("div");
    textureDiv.className = "bar__texture";
    
    const randomTexture = textures[Math.floor(Math.random() * textures.length)];
    textureDiv.style.backgroundImage = `url('${randomTexture}')`;

    const minOpacity = 0.15;
    const maxOpacity = 0.85;
    const progressiveOpacity = minOpacity + (i / (TOTAL_ITEMS - 1)) * (maxOpacity - minOpacity);
    textureDiv.style.opacity = progressiveOpacity;

    bar.appendChild(fill);
    bar.appendChild(textureDiv);
    barsContainer.appendChild(bar);
}

const barEls = document.querySelectorAll(".bar");
const barFills = document.querySelectorAll(".bar__fill");

/* ------------ Fade de transição dos áudios ------------ */
function fadeAudio(video, targetVolume, duration = AUDIO_FADE_DURATION) {
    if (!video) return;
    const startVolume = video.volume;
    const startTime = performance.now();

    function animateAudio(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        video.volume = startVolume + (targetVolume - startVolume) * eased;

        if (progress < 1) {
            requestAnimationFrame(animateAudio);
        } else {
            video.volume = targetVolume;
        }
    }
    requestAnimationFrame(animateAudio);
}

/* ------------ Mostrar Vídeo + Controlar Áudio ------------ */
function showModeVideo(mode, fade = true) {
    const currentItem = storyItems[currentIndex];
    if (!currentItem) return;

    const videos = getVideos(currentItem);
    const allVideos = [videos.default, videos.book, videos.movie];

    let activeVideo = videos.default;
    if (mode === "book") activeVideo = videos.book;
    if (mode === "movie") activeVideo = videos.movie;

    allVideos.forEach(video => {
        if (!video) return;
        if (video === activeVideo) {
            video.style.transition = `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;
            video.style.opacity = "1";
            video.style.zIndex = "2";
        } else {
            video.style.transition = `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;
            video.style.opacity = "0";
            video.style.zIndex = "1";
        }
    });

    allVideos.forEach(video => {
        if (!video) return;
        if (video === activeVideo) {
            if (fade) fadeAudio(video, 1, AUDIO_FADE_DURATION);
            else video.volume = 1;
        } else {
            if (fade) fadeAudio(video, 0, AUDIO_FADE_DURATION);
            else video.volume = 0;
        }
    });
}

/* ------------ Iniciar os vídeos ------------ */
function startAllVideos(item) {
    if (!item) return;
    const videos = getVideos(item);
    const allVideos = [videos.default, videos.book, videos.movie].filter(Boolean);

    allVideos.forEach(video => {
        video.pause();
        try { video.currentTime = 0; } catch (e) {}
        video.volume = (video === videos.default) ? 1 : 0;
    });

    const waitForMetadata = allVideos.map(video => {
        if (video.readyState >= 1) return Promise.resolve();
        return new Promise(resolve => {
            video.addEventListener("loadedmetadata", resolve, { once: true });
        });
    });

    Promise.all(waitForMetadata).then(() => {
        allVideos.forEach(video => {
            try { video.currentTime = 0; } catch (e) {}
        });

        if (!isPaused && !storyEnded) {
            allVideos.forEach(video => {
                video.play().catch(error => console.warn("Erro ao iniciar vídeo:", error));
            });
        }
    });
}

function stopAllVideos(item, reset = true) {
    if (!item) return;
    const videos = getVideos(item);
    [videos.default, videos.book, videos.movie].forEach(video => {
        if (!video) return;
        video.pause();
        video.volume = 0;
        if (reset) {
            try { video.currentTime = 0; } catch (e) {}
        }
    });
}

function setMode(mode) {
    const currentItem = storyItems[currentIndex];
    if (!currentItem) return;
    currentMode = mode;

    if (mode === "default") {
        currentItem.classList.remove("w-pressed", "e-pressed");
        showModeVideo("default", true);
        updateStatus("Default", "None");
        return;
    }
    if (mode === "book") {
        currentItem.classList.add("w-pressed");
        currentItem.classList.remove("e-pressed");
        showModeVideo("book", true);
        updateStatus("Book", "W");
        return;
    }
    if (mode === "movie") {
        currentItem.classList.add("e-pressed");
        currentItem.classList.remove("w-pressed");
        showModeVideo("movie", true);
        updateStatus("Movie", "E");
        return;
    }
}

function getMasterVideo(item) {
    if (!item) return null;
    return item.querySelector(".video-default");
}

function activateItem(index) {
    cancelAnimationFrame(rafId);
    currentIndex = index;

    if (index === 0) currentMode = "default";

    prepareItemVideos(index);

    storyItems.forEach((item, i) => {
        if (!item) return;
        item.classList.toggle("active", i === index);

        if (i !== index) {
            item.classList.remove("w-pressed", "e-pressed");
            stopAllVideos(item, true);
            const videos = getVideos(item);
            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.style.opacity = "0";
                video.style.zIndex = "1";
                video.volume = 0;
            });
        }

        const bar = barEls[i];
        if (!bar) return;

        if (i < index) {
            bar.classList.remove("active");
            bar.classList.add("completed");
            bar.classList.toggle("shift-right", i % 2 === 0);
            bar.classList.toggle("shift-left", i % 2 !== 0);
            barFills[i].style.width = "100%";
        } else if (i === index) {
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
        } else {
            bar.classList.remove("active", "completed", "shift-left", "shift-right");
            barFills[i].style.width = "0%";
        }
    });

    const currentItem = storyItems[index];
    if (!currentItem) return;

    startAllVideos(currentItem);

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

    const masterVideo = getMasterVideo(currentItem);
    if (masterVideo) {
        masterVideo.onended = () => { goToNext(); };
    }

    updateProgress();
}

function updateProgress() {
    const currentItem = storyItems[currentIndex];
    if (!currentItem) return;

    const masterVideo = getMasterVideo(currentItem);
    if (masterVideo && Number.isFinite(masterVideo.duration) && masterVideo.duration > 0) {
        const progress = (masterVideo.currentTime / masterVideo.duration) * 100;
        barFills[currentIndex].style.width = `${Math.min(progress, 100)}%`;
    }
    rafId = requestAnimationFrame(updateProgress);
}

function goToNext() {
    if (isSkipping) return;
    cancelAnimationFrame(rafId);

    if (barFills[currentIndex]) {
        barFills[currentIndex].style.width = "100%";
    }

    const next = currentIndex + 1;
    if (next < storyItems.length) {
        const currentItem = storyItems[currentIndex];
        if (currentItem) {
            const videos = getVideos(currentItem);
            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.volume = 0;
            });
            stopAllVideos(currentItem, true);
        }
        activateItem(next);
    } else {
        storyEnded = true;
        isPaused = true;
        const currentItem = storyItems[currentIndex];
        if (currentItem) {
            const videos = getVideos(currentItem);
            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.pause();
                video.volume = 0;
            });
        }
        const playPauseContainer = document.getElementById("play-pause-container");
        if (playPauseContainer) playPauseContainer.style.display = "none";
    }
}

function goToPrevious() {
    if (isSkipping) return;
    isSkipping = true;
    cancelAnimationFrame(rafId);

    const currentItem = storyItems[currentIndex];
    if (currentItem) {
        const videos = getVideos(currentItem);
        const activeVideo = currentMode === "book" ? videos.book : currentMode === "movie" ? videos.movie : videos.default;
        if (activeVideo) {
            activeVideo.style.transition = `opacity ${VIDEO_FADE_DURATION}ms ease-in-out`;
            activeVideo.style.opacity = "0";
            fadeAudio(activeVideo, 0, AUDIO_FADE_DURATION);
        }
    }

    if (barFills[currentIndex]) {
        barFills[currentIndex].style.transition = `width ${VIDEO_FADE_DURATION}ms ease-in-out`;
        barFills[currentIndex].style.width = "0%";
    }

    setTimeout(() => {
        if (currentItem) {
            const videos = getVideos(currentItem);
            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.volume = 0;
            });
            stopAllVideos(currentItem, true);
        }

        const previousIndex = currentIndex - 1;
        if (previousIndex >= 0) {
            activateItem(previousIndex);
        } else {
            activateItem(0);
        }
        isSkipping = false;
    }, VIDEO_FADE_DURATION);
}

/* ------------ Teclado ------------ */
document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    const currentItem = storyItems[currentIndex];
    if (!currentItem) return;

    if (key === "n") {
        goToPrevious();
        return;
    }

    if (key === "s") {
        if (isSkipping) return;
        isSkipping = true;
        cancelAnimationFrame(rafId);

        if (barFills[currentIndex]) {
            barFills[currentIndex].style.transition = `width ${VIDEO_FADE_DURATION}ms ease-in-out`;
            barFills[currentIndex].style.width = "100%";
        }

        const videos = getVideos(currentItem);
        const activeVideo = currentMode === "book" ? videos.book : currentMode === "movie" ? videos.movie : videos.default;

        const nextIndex = currentIndex + 1;
        const isLastScene = nextIndex >= storyItems.length;

        if (isLastScene) {
            [videos.default, videos.book, videos.movie].forEach(video => {
                if (!video) return;
                video.pause();
                video.volume = 0;
            });
            storyEnded = true;
            isPaused = true;
            const playPauseContainer = document.getElementById("play-pause-container");
            if (playPauseContainer) playPauseContainer.style.display = "none";
            isSkipping = false;
            return;
        }

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
                try { video.currentTime = 0; } catch (e) {}
            });
            isSkipping = false;
            activateItem(nextIndex);
        }, VIDEO_FADE_DURATION);
        return;
    }

    if (key === "w") {
        setMode(currentMode === "book" ? "default" : "book");
        return;
    }

    if (key === "e") {
        setMode(currentMode === "movie" ? "default" : "movie");
        return;
    }
});

function prepareItemVideos(index) {
    const item = storyItems[index];
    if (!item) return;

    item.querySelectorAll("video").forEach(video => {
        if (video.readyState === 0) video.load();
    });

    const nextItem = storyItems[index + 1];
    if (nextItem) {
        nextItem.querySelectorAll("video").forEach(v => {
            if (v.readyState === 0) v.load();
        });
    }
}

/* ------------ Play / Pause Control (Seguro) ------------ */
const playPauseContainer = document.getElementById("play-pause-container");
const btnPlay  = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");

let hideButtonTimeout = null;

function updatePlayPauseIcon() {
    if (!btnPlay || !btnPause) return;
    if (isPaused) {
        btnPlay.classList.remove("fade-out");
        btnPause.classList.add("fade-out");
    } else {
        btnPause.classList.remove("fade-out");
        btnPlay.classList.add("fade-out");
    }
}

function hideActiveButton() {
    if (btnPlay) btnPlay.classList.add("fade-out");
    if (btnPause) btnPause.classList.add("fade-out");
}

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

function togglePlayPause() {
    if (storyEnded) return;
    clearTimeout(hideButtonTimeout);

    isPaused = !isPaused;

    const currentItem = storyItems[currentIndex];
    const videos = getVideos(currentItem);
    const allVideos = [videos.default, videos.book, videos.movie].filter(Boolean);

    if (isPaused) {
        allVideos.forEach(v => v.pause());
    } else {
        allVideos.forEach(v => v.play());
    }

    updatePlayPauseIcon();

    if (!isPaused) {
        hideButtonTimeout = setTimeout(() => {
            hideActiveButton();
        }, 200);
    }
}

if (btnPlay && btnPause) {
    [btnPlay, btnPause].forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            togglePlayPause();
        });
    });
}

if (playPauseContainer) {
    playPauseContainer.addEventListener("click", () => {
        revealPlayPauseButton();
    });
}

updatePlayPauseIcon();
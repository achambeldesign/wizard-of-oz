document.addEventListener('DOMContentLoaded', () => {
    const shoesVideo = document.getElementById('sapatosRuby');
    let currentAudio = null; // Variável audio atual

    //Array dos 4 audios 
    const audios = [
        'sound/shoes/shoes_1.mp3',
        'sound/shoes/shoes_2.mp3',
        'sound/shoes/shoes_3.mp3',
        'sound/shoes/shoes_4.mp3',
    ];

    shoesVideo.pause();
    shoesVideo.currentTime = 0;

    function playRandomAudio() {
        const randomIndex = Math.floor(Math.random() * audios.length);
        currentAudio = new Audio(audios[randomIndex]);
        
        currentAudio.play().catch(error => console.log("Erro:", error));
    }

    shoesVideo.addEventListener('click', (e) => {
        e.preventDefault();
        if (shoesVideo.paused) {
            shoesVideo.play();
        }
        if (!shoesVideo.paused && !shoesVideo.ended) {
            playRandomAudio();
        }
    });

    // Redireciona para o index.html
    function performRedirect() {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    }

    // Quando a animação dos sapatos terminar, verificamos se ainda falta tocar aúdio
    shoesVideo.addEventListener('ended', () => {
        // Se houver áudio por tocar, esperamos que ele acabe
        if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
            console.log("Esperar que o audio termine");
            currentAudio.addEventListener('ended', performRedirect);
        } else {
            // Se não houver áudio, redireciona logo para página index.html
            performRedirect();
        }
    });
});
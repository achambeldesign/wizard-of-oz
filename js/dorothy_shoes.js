document.addEventListener('DOMContentLoaded', () => {
    const shoesVideo = document.getElementById('sapatosRuby');
    let currentAudio = null;

    // Array com os 5 áudios
    const audios = [
        'sound/shoes/shoes_1.mp3',
        'sound/shoes/shoes_2.mp3',
        'sound/shoes/shoes_3.mp3',
        'sound/shoes/shoes_4.mp3',
        'sound/shoes/shoes_5.mp3',
    ];

    shoesVideo.pause();
    shoesVideo.currentTime = 0;

    // Função para baralhar um array (Algoritmo Fisher-Yates)
    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Obter ou criar a permutação atual guardada no localStorage
    function getShuffledPlaylist() {
        let playlist = JSON.parse(localStorage.getItem('shoeAudioPlaylist'));
        let currentIndex = parseInt(localStorage.getItem('shoeAudioCurrentIndex'), 10);

        // Se não existir playlist ou se já tivermos reproduzido todos, criamos uma nova permutação
        if (!playlist || !Array.isArray(playlist) || isNaN(currentIndex) || currentIndex >= playlist.length) {
            playlist = audios.map((_, index) => index);
            shuffleArray(playlist);
            currentIndex = 0;
            
            localStorage.setItem('shoeAudioPlaylist', JSON.stringify(playlist));
            localStorage.setItem('shoeAudioCurrentIndex', currentIndex);
        }

        return { playlist, currentIndex };
    }

    function playNextPermutedAudio() {
        let { playlist, currentIndex } = getShuffledPlaylist();

        // Obter o índice do áudio atual na permutação
        const selectedIndex = playlist[currentIndex];

        // Avançar o índice para a próxima posição na próxima reprodução
        currentIndex++;
        localStorage.setItem('shoeAudioCurrentIndex', currentIndex);

        // Tocar o áudio correspondente
        currentAudio = new Audio(audios[selectedIndex]);
        currentAudio.play().catch(error => console.log("Erro:", error));
    }

    shoesVideo.addEventListener('click', (e) => {
        e.preventDefault();
        if (shoesVideo.paused) {
            shoesVideo.play();
        }
        if (!shoesVideo.paused && !shoesVideo.ended) {
            playNextPermutedAudio();
        }
    });

    function performRedirect() {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    }

    shoesVideo.addEventListener('ended', () => {
        if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
            console.log("Esperar que o audio termine");
            currentAudio.addEventListener('ended', performRedirect);
        } else {
            performRedirect();
        }
    });
});
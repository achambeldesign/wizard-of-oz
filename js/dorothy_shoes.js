document.addEventListener('DOMContentLoaded', () => {
    const shoesVideo = document.getElementById('sapatosRuby');
    let currentAudio = null;

    //Array 5 audios
    const audios = [
        'sound/shoes/shoes_1.mp3',
        'sound/shoes/shoes_2.mp3',
        'sound/shoes/shoes_3.mp3',
        'sound/shoes/shoes_4.mp3',
        'sound/shoes/shoes_5.mp3',
    ];

    shoesVideo.pause();
    shoesVideo.currentTime = 0;

    function playRandomAudio() {
        // Obter o último índice guardado no localStorage (se existir)
        const lastIndex = localStorage.getItem('lastShoeAudioIndex');
        
        // Criação array com os índices todos 
        let availableIndexes = audios.map((_, index) => index);

        // Se houver um índice anterior e houver mais do que 1 áudio disponível, remove-o
        if (lastIndex !== null && audios.length > 1) {
            const parsedLastIndex = parseInt(lastIndex, 10);
            availableIndexes = availableIndexes.filter(index => index !== parsedLastIndex);
        }

        // Escolher aleatoriamente um índice de entre os disponíveis
        const randomAvailablePosition = Math.floor(Math.random() * availableIndexes.length);
        const selectedIndex = availableIndexes[randomAvailablePosition];

        // Guardar este novo índice no localStorage para a próxima vez
        localStorage.setItem('lastShoeAudioIndex', selectedIndex);

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
            playRandomAudio();
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
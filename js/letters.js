/* ------------ Criação das Palavras (p5) do Menu index.html (https://editor.p5js.org/achambel2002/sketches/N8YrcWPz7)------------ */
function criarTextoFlutuante(id, texto, canvasW, canvasH) {
  new p5((p) => {
    let font;
    let letras = [];

    p.preload = function () {
      font = p.loadFont("./font/Oz.ttf");
    };

    p.setup = function () {
      const canvas = p.createCanvas(canvasW, canvasH);
      canvas.parent(id);

      p.textFont(font);
      p.textSize(40);
      p.textAlign(p.LEFT, p.BASELINE);

      for (let i = 0; i < texto.length; i++) {
        letras.push({
          char: texto[i],
          offset: p.random(1000)
        });
      }
    };

    p.draw = function () {
      p.clear();

      let larguraTotal = 0;
      for (let l of letras) larguraTotal += p.textWidth(l.char);
      let x = (p.width - larguraTotal) / 2;

      for (let l of letras) {
        let floatY = p.sin(p.frameCount * 0.02 + l.offset) * 5;

        // Sombras das letras
        for (let i = 5; i > 0; i--) {
          p.fill(29, 13, 7, 80); // Cor de sombra escura
          p.text(
            l.char,
            x + i * 1.2,
            p.height / 2 + floatY + i * 1.2
          );
        }

        // Letra principal
        p.fill(228, 197, 180); // Cor da letra
        p.text(l.char, x, p.height / 2 + floatY);
        x += p.textWidth(l.char);
      }
    };
  });
}

/* Criação das palavras */
criarTextoFlutuante("about",   "About",   350, 150);
criarTextoFlutuante("credits", "Credits", 350, 150);
criarTextoFlutuante("story",   "Story",   300, 100);
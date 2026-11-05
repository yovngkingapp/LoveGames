/* config.js — datos personales y catálogo de juegos del portal. */
window.CONFIG = {
  /* Versión del esquema de almacenamiento. Si cambia, los datos viejos se ignoran. */
  ESQUEMA: 1,
  PREFIJO: 'yaj:',

  NOMBRE_SITIO: 'El rincón de Yajaira',
  DESTINATARIA: 'Yajaira',
  SUBTITULO: 'Cuatro juegos tranquilos para cuando quieras desconectar un rato.',
  FIRMA: 'Hecho con cariño para Yajaira.',

  /* Frases que aparecen al azar en el modal de victoria. */
  MENSAJES_VICTORIA: [
    'Te lo dije: eres buena en esto.',
    'Otra victoria para la colección.',
    'Se nota que le pusiste cabeza.',
    'Qué bien lo hiciste, de verdad.',
    'Ese tablero no sabía con quién estaba jugando.',
    'Un aplauso silencioso desde acá.',
    'Impecable. Vamos por otra.',
    'Me encanta verte ganar.'
  ],

  /* Catálogo de tarjetas. Si el archivo del juego no está cargado,
     estos datos se usan como respaldo y la tarjeta dice "Próximamente". */
  JUEGOS: [
    {
      id: 'sudoku',
      nombre: 'Sudoku',
      descripcion: 'Completa la cuadrícula sin repetir números.'
    },
    {
      id: 'minesweeper',
      nombre: 'Buscaminas',
      descripcion: 'Despeja el campo sin pisar una mina.'
    },
    {
      id: 'mahjong',
      nombre: 'Mahjong',
      descripcion: 'Empareja fichas y despeja el tablero.'
    },
    {
      id: 'colorswitch',
      nombre: 'Color Switch',
      descripcion: 'Cruza los aros al ritmo justo.'
    }
  ]
};
